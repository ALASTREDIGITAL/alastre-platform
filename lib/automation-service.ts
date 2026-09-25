import { createSupabaseAdmin } from "./connection-hub/supabase-admin.ts";
import type { ActorContext } from "./connection-hub/repository.ts";
import {
  computeWritePlanHash,
  sanitizeSensitiveData,
  type AutomationAiLimitRecord,
  type AutomationAiUsageLogRecord,
  type AutomationJobRecord,
  type AutomationSyncStateRecord,
  type AutomationWritePlanRecord,
} from "./automation-domain.ts";
import { canApproveAutomationWrite, canExecuteAutomationWrite, canManageAutomationQueue } from "./permissions.ts";
import { serverEnv } from "./server-env.ts";

export type MemoryApprovalItem = {
  id: string;
  agency_id: string;
  client_id: string | null;
  source_type: string;
  source_id: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  title: string;
  summary: string;
  proposed_payload: Record<string, unknown>;
  created_by_actor_id: string;
  decided_by_actor_id?: string | null;
  decided_at?: string | null;
  decision_notes?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Memory Store para testes locais unitários sem banco de dados configurado
 */
export class AutomationMemoryStore {
  public syncStates: AutomationSyncStateRecord[] = [];
  public jobs: AutomationJobRecord[] = [];
  public writePlans: AutomationWritePlanRecord[] = [];
  public approvalItems: MemoryApprovalItem[] = [];
  public aiUsageLogs: AutomationAiUsageLogRecord[] = [];
  public aiLimits: AutomationAiLimitRecord[] = [];
  public auditLogs: Array<{ agency_id: string; action: string; payload: Record<string, unknown> }> = [];

  public clear() {
    this.syncStates = [];
    this.jobs = [];
    this.writePlans = [];
    this.approvalItems = [];
    this.aiUsageLogs = [];
    this.aiLimits = [];
    this.auditLogs = [];
  }
}

export const automationMemoryStore = new AutomationMemoryStore();

export class AutomationService {
  private readonly db = createSupabaseAdmin();

  private isDbAvailable(): boolean {
    return this.db !== null && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  }

  /**
   * Visão Geral do Módulo 09
   */
  async getOverview(actor: ActorContext) {
    if (!this.isDbAvailable()) {
      const agencySyncs = automationMemoryStore.syncStates.filter((s) => s.agency_id === actor.agencyId);
      const agencyJobs = automationMemoryStore.jobs.filter((j) => j.agency_id === actor.agencyId);
      const agencyPlans = automationMemoryStore.writePlans.filter((p) => p.agency_id === actor.agencyId);
      const agencyAiLogs = automationMemoryStore.aiUsageLogs.filter((l) => l.agency_id === actor.agencyId);
      const agencyAiLimits = automationMemoryStore.aiLimits.filter((lm) => lm.agency_id === actor.agencyId);

      return {
        write_mode: (serverEnv("ALASTRE_WRITE_MODE") ?? "disabled") as "disabled" | "enabled",
        sync_states: agencySyncs,
        jobs: agencyJobs,
        write_plans: agencyPlans,
        ai_usage_logs: agencyAiLogs,
        ai_limits: agencyAiLimits,
        summary: {
          total_syncs: agencySyncs.length,
          active_jobs: agencyJobs.filter((j) => ["pending", "queued", "running"].includes(j.status)).length,
          dead_letter_jobs: agencyJobs.filter((j) => j.status === "dead_letter").length,
          pending_write_plans: agencyPlans.filter((p) => p.status === "pending_approval").length,
        },
      };
    }

    const [syncsRes, jobsRes, plansRes, aiLogsRes, aiLimitsRes] = await Promise.all([
      this.db!.from("automation_sync_states").select("*").eq("agency_id", actor.agencyId),
      this.db!.from("automation_jobs").select("*").eq("agency_id", actor.agencyId).order("created_at", { ascending: false }).limit(50),
      this.db!.from("automation_write_plans").select("*").eq("agency_id", actor.agencyId).order("created_at", { ascending: false }).limit(50),
      this.db!.from("automation_ai_usage_logs").select("*").eq("agency_id", actor.agencyId).order("created_at", { ascending: false }).limit(50),
      this.db!.from("automation_ai_limits").select("*").eq("agency_id", actor.agencyId),
    ]);

    if (syncsRes.error || jobsRes.error || plansRes.error || aiLogsRes.error || aiLimitsRes.error) {
      throw new Error("automation_database_error");
    }

    const syncs = syncsRes.data as AutomationSyncStateRecord[];
    const jobs = jobsRes.data as AutomationJobRecord[];
    const plans = plansRes.data as AutomationWritePlanRecord[];
    const aiLogs = aiLogsRes.data as AutomationAiUsageLogRecord[];
    const aiLimits = aiLimitsRes.data as AutomationAiLimitRecord[];

    return {
      write_mode: (serverEnv("ALASTRE_WRITE_MODE") ?? "disabled") as "disabled" | "enabled",
      sync_states: syncs,
      jobs,
      write_plans: plans,
      ai_usage_logs: aiLogs,
      ai_limits: aiLimits,
      summary: {
        total_syncs: syncs.length,
        active_jobs: jobs.filter((j) => ["pending", "queued", "running"].includes(j.status)).length,
        dead_letter_jobs: jobs.filter((j) => j.status === "dead_letter").length,
        pending_write_plans: plans.filter((p) => p.status === "pending_approval").length,
      },
    };
  }

  /**
   * Disparo de sincronização incremental
   */
  async triggerSync(actor: ActorContext, input: { connection_id: string; capability: string; force_full_sync?: boolean }) {
    if (!this.isDbAvailable()) {
      let state = automationMemoryStore.syncStates.find(
        (s) => s.agency_id === actor.agencyId && s.connection_id === input.connection_id && s.capability === input.capability,
      );
      const now = new Date().toISOString();
      if (!state) {
        state = {
          id: `sync-${Date.now()}`,
          agency_id: actor.agencyId,
          connection_id: input.connection_id,
          capability: input.capability,
          sync_cursor: `cursor-${Date.now()}`,
          status: "success",
          last_synced_at: now,
          last_success_at: now,
          last_error_sanitized: null,
          next_sync_at: new Date(Date.now() + 3600_000).toISOString(),
          sync_attempts: 1,
          max_attempts: 5,
          backoff_seconds: 60,
          created_at: now,
          updated_at: now,
        };
        automationMemoryStore.syncStates.push(state);
      } else {
        state.status = "success";
        state.sync_cursor = `cursor-${Date.now()}`;
        state.last_synced_at = now;
        state.last_success_at = now;
        state.last_error_sanitized = null;
        state.updated_at = now;
      }
      return state;
    }

    const { data: conn, error: connErr } = await this.db!
      .from("integration_connections")
      .select("id, status")
      .eq("agency_id", actor.agencyId)
      .eq("id", input.connection_id)
      .maybeSingle();

    if (connErr || !conn) throw new Error("connection_not_found");
    if (conn.status === "disconnected" || conn.status === "revoked") {
      throw new Error("connection_unavailable");
    }

    const now = new Date().toISOString();
    const nextSync = new Date(Date.now() + 3600_000).toISOString();
    const cursor = `cursor-${Date.now()}`;

    const { data, error } = await this.db!
      .from("automation_sync_states")
      .upsert(
        {
          agency_id: actor.agencyId,
          connection_id: input.connection_id,
          capability: input.capability,
          sync_cursor: cursor,
          status: "success",
          last_synced_at: now,
          last_success_at: now,
          last_error_sanitized: null,
          next_sync_at: nextSync,
          sync_attempts: 1,
          updated_at: now,
        },
        { onConflict: "agency_id,connection_id,capability" },
      )
      .select("*")
      .single();

    if (error || !data) throw new Error("sync_trigger_failed");

    await this.audit(actor, "automation.sync_triggered", "automation_sync_state", data.id, {
      connection_id: input.connection_id,
      capability: input.capability,
    });

    return data as AutomationSyncStateRecord;
  }

  /**
   * Enfileiramento de Job na Fila com Idempotência
   */
  async enqueueJob(
    actor: ActorContext,
    input: {
      client_id?: string | null;
      connection_id?: string | null;
      work_item_id?: string | null;
      evidence_id?: string | null;
      idempotency_key: string;
      capability: string;
      action_name: string;
      payload: Record<string, unknown>;
      max_attempts?: number;
      timeout_seconds?: number;
    },
  ) {
    const sanitizedPayload = sanitizeSensitiveData(input.payload);

    if (!this.isDbAvailable()) {
      const existing = automationMemoryStore.jobs.find(
        (j) => j.agency_id === actor.agencyId && j.idempotency_key === input.idempotency_key,
      );
      if (existing) {
        return { job: existing, deduplicated: true };
      }

      const now = new Date().toISOString();
      const newJob: AutomationJobRecord = {
        id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        agency_id: actor.agencyId,
        client_id: input.client_id ?? null,
        connection_id: input.connection_id ?? null,
        work_item_id: input.work_item_id ?? null,
        evidence_id: input.evidence_id ?? null,
        idempotency_key: input.idempotency_key,
        capability: input.capability,
        action_name: input.action_name,
        sanitized_payload: sanitizedPayload,
        status: "pending",
        attempts: 0,
        max_attempts: input.max_attempts ?? 3,
        timeout_seconds: input.timeout_seconds ?? 30,
        backoff_seconds: 60,
        last_error_sanitized: null,
        scheduled_at: now,
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      };
      automationMemoryStore.jobs.push(newJob);
      return { job: newJob, deduplicated: false };
    }

    const { data: existing, error: findErr } = await this.db!
      .from("automation_jobs")
      .select("*")
      .eq("agency_id", actor.agencyId)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();

    if (findErr) throw new Error("job_query_failed");
    if (existing) {
      return { job: existing as AutomationJobRecord, deduplicated: true };
    }

    const { data: inserted, error: insertErr } = await this.db!
      .from("automation_jobs")
      .insert({
        agency_id: actor.agencyId,
        client_id: input.client_id ?? null,
        connection_id: input.connection_id ?? null,
        work_item_id: input.work_item_id ?? null,
        evidence_id: input.evidence_id ?? null,
        idempotency_key: input.idempotency_key,
        capability: input.capability,
        action_name: input.action_name,
        sanitized_payload: sanitizedPayload,
        status: "pending",
        attempts: 0,
        max_attempts: input.max_attempts ?? 3,
        timeout_seconds: input.timeout_seconds ?? 30,
        backoff_seconds: 60,
      })
      .select("*")
      .single();

    if (insertErr || !inserted) throw new Error("job_enqueue_failed");

    await this.audit(actor, "automation.job_enqueued", "automation_job", inserted.id, {
      idempotency_key: input.idempotency_key,
      capability: input.capability,
      action_name: input.action_name,
    });

    return { job: inserted as AutomationJobRecord, deduplicated: false };
  }

  /**
   * Processamento / Simulação de Job
   */
  async processJob(
    actor: ActorContext,
    input: {
      job_id: string;
      simulate_outcome: "success" | "fail_retryable" | "fail_fatal";
      simulated_error_code?: string;
    },
  ) {
    if (!this.isDbAvailable()) {
      const job = automationMemoryStore.jobs.find((j) => j.agency_id === actor.agencyId && j.id === input.job_id);
      if (!job) throw new Error("job_not_found");

      const now = new Date().toISOString();
      job.started_at = job.started_at ?? now;
      job.attempts += 1;

      if (input.simulate_outcome === "success") {
        job.status = "completed";
        job.completed_at = now;
        job.last_error_sanitized = null;
      } else if (input.simulate_outcome === "fail_fatal" || job.attempts >= job.max_attempts) {
        job.status = "dead_letter";
        job.last_error_sanitized = input.simulated_error_code ?? "fatal_execution_failure";
      } else {
        job.status = "failed";
        job.last_error_sanitized = input.simulated_error_code ?? "temporary_execution_failure";
      }
      job.updated_at = now;

      return job;
    }

    const { data: job, error: jobErr } = await this.db!
      .from("automation_jobs")
      .select("*")
      .eq("agency_id", actor.agencyId)
      .eq("id", input.job_id)
      .maybeSingle();

    if (jobErr || !job) throw new Error("job_not_found");

    const currentAttempts = job.attempts + 1;
    const now = new Date().toISOString();

    let newStatus: "completed" | "failed" | "dead_letter" = "completed";
    let lastError: string | null = null;

    if (input.simulate_outcome === "success") {
      newStatus = "completed";
    } else if (input.simulate_outcome === "fail_fatal" || currentAttempts >= job.max_attempts) {
      newStatus = "dead_letter";
      lastError = input.simulated_error_code ?? "fatal_execution_failure";
    } else {
      newStatus = "failed";
      lastError = input.simulated_error_code ?? "temporary_execution_failure";
    }

    const { data: updated, error: updateErr } = await this.db!
      .from("automation_jobs")
      .update({
        attempts: currentAttempts,
        status: newStatus,
        last_error_sanitized: lastError,
        started_at: job.started_at ?? now,
        completed_at: newStatus === "completed" ? now : null,
        updated_at: now,
      })
      .eq("agency_id", actor.agencyId)
      .eq("id", input.job_id)
      .select("*")
      .single();

    if (updateErr || !updated) throw new Error("job_update_failed");

    await this.audit(actor, `automation.job_${newStatus}`, "automation_job", job.id, {
      attempts: currentAttempts,
      status: newStatus,
      error_code: lastError,
    });

    return updated as AutomationJobRecord;
  }

  /**
   * Cancelamento manual de Job
   */
  async cancelJob(actor: ActorContext, input: { job_id: string; reason?: string }) {
    if (!canManageAutomationQueue(actor.role)) {
      throw new Error("actor_forbidden");
    }

    if (!this.isDbAvailable()) {
      const job = automationMemoryStore.jobs.find((j) => j.agency_id === actor.agencyId && j.id === input.job_id);
      if (!job) throw new Error("job_not_found");
      job.status = "cancelled";
      job.last_error_sanitized = input.reason ?? "job_cancelled_by_operator";
      job.updated_at = new Date().toISOString();
      return job;
    }

    const { data: updated, error } = await this.db!
      .from("automation_jobs")
      .update({
        status: "cancelled",
        last_error_sanitized: input.reason ?? "job_cancelled_by_operator",
        updated_at: new Date().toISOString(),
      })
      .eq("agency_id", actor.agencyId)
      .eq("id", input.job_id)
      .select("*")
      .single();

    if (error || !updated) throw new Error("job_cancel_failed");

    await this.audit(actor, "automation.job_cancelled", "automation_job", input.job_id, {
      reason: input.reason ?? "manual_cancel",
    });

    return updated as AutomationJobRecord;
  }

  /**
   * Criação Atômica de Plano Imutável de Escrita Externa e Item de Aprovação
   */
  async createWritePlan(
    actor: ActorContext,
    input: {
      client_id?: string | null;
      connection_id?: string | null;
      work_item_id?: string | null;
      capability: string;
      action_type: string;
      plan_payload: Record<string, unknown>;
      supports_rollback?: boolean;
      compensation_plan?: Record<string, unknown> | null;
    },
  ) {
    const sanitizedPlan = sanitizeSensitiveData(input.plan_payload);
    const planHash = computeWritePlanHash({
      agencyId: actor.agencyId,
      clientId: input.client_id,
      capability: input.capability,
      actionType: input.action_type,
      sanitizedPlan,
    });

    if (!this.isDbAvailable()) {
      const existing = automationMemoryStore.writePlans.find(
        (p) => p.agency_id === actor.agencyId && p.plan_hash === planHash,
      );
      if (existing) return existing;

      const now = new Date().toISOString();
      const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const apprId = `appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // In-Memory Atomic creation
      const apprItem: MemoryApprovalItem = {
        id: apprId,
        agency_id: actor.agencyId,
        client_id: input.client_id ?? null,
        source_type: "automation_write",
        source_id: planId,
        status: "pending",
        title: `Escrita Externa: ${input.action_type} (${input.capability})`,
        summary: `Plano imutável registrado com hash SHA-256 ${planHash.slice(0, 12)}...`,
        proposed_payload: { plan_hash: planHash, plan: sanitizedPlan },
        created_by_actor_id: actor.actorId,
        created_at: now,
        updated_at: now,
      };

      const plan: AutomationWritePlanRecord = {
        id: planId,
        agency_id: actor.agencyId,
        client_id: input.client_id ?? null,
        connection_id: input.connection_id ?? null,
        approval_item_id: apprId,
        work_item_id: input.work_item_id ?? null,
        capability: input.capability,
        action_type: input.action_type,
        plan_hash: planHash,
        sanitized_plan: sanitizedPlan,
        status: "pending_approval",
        supports_rollback: input.supports_rollback ?? false,
        compensation_plan: input.compensation_plan ? sanitizeSensitiveData(input.compensation_plan) : null,
        created_by_actor_id: actor.actorId,
        approved_by_actor_id: null,
        approved_at: null,
        executed_at: null,
        created_at: now,
        updated_at: now,
      };

      automationMemoryStore.approvalItems.push(apprItem);
      automationMemoryStore.writePlans.push(plan);
      return plan;
    }

    // Supabase RPC Transacional Atômica: automation_create_write_plan
    const { data: rpcRes, error: rpcErr } = await this.db!.rpc("automation_create_write_plan", {
      p_actor_id: actor.actorId,
      p_client_id: input.client_id ?? null,
      p_connection_id: input.connection_id ?? null,
      p_work_item_id: input.work_item_id ?? null,
      p_capability: input.capability,
      p_action_type: input.action_type,
      p_plan_hash: planHash,
      p_sanitized_plan: sanitizedPlan,
      p_supports_rollback: input.supports_rollback ?? false,
      p_compensation_plan: input.compensation_plan ? sanitizeSensitiveData(input.compensation_plan) : null,
    });

    if (rpcErr || !rpcRes) {
      const errMsg = rpcErr?.message ?? "write_plan_create_failed";
      if (errMsg.includes("actor_forbidden")) throw new Error("actor_forbidden");
      if (errMsg.includes("invalid_plan_hash")) throw new Error("invalid_plan_hash");
      throw new Error("write_plan_create_failed");
    }

    return rpcRes as AutomationWritePlanRecord;
  }

  /**
   * Aprovação Humana do Plano de Escrita (Exclusiva para Liderança: owner, admin, operations_lead)
   */
  async approveWritePlan(
    actor: ActorContext,
    input: { plan_id: string; plan_hash: string; decision_notes?: string },
  ) {
    if (!canApproveAutomationWrite(actor.role)) {
      throw new Error("actor_forbidden");
    }

    if (!this.isDbAvailable()) {
      const plan = automationMemoryStore.writePlans.find(
        (p) => p.agency_id === actor.agencyId && p.id === input.plan_id,
      );
      if (!plan) throw new Error("write_plan_not_found");
      if (plan.plan_hash !== input.plan_hash) throw new Error("plan_hash_mismatch");
      if (plan.status !== "pending_approval") throw new Error("write_plan_not_pending");

      const apprItem = automationMemoryStore.approvalItems.find(
        (a) => a.agency_id === actor.agencyId && a.id === plan.approval_item_id && a.source_type === "automation_write" && a.source_id === plan.id,
      );

      if (!apprItem) throw new Error("approval_item_not_found");
      if (apprItem.status !== "pending") throw new Error("approval_item_not_pending");
      if (apprItem.proposed_payload.plan_hash !== input.plan_hash) throw new Error("plan_hash_mismatch");

      const now = new Date().toISOString();
      apprItem.status = "approved";
      apprItem.decided_by_actor_id = actor.actorId;
      apprItem.decided_at = now;
      apprItem.decision_notes = input.decision_notes ?? "Aprovado via Central de Aprovações";
      apprItem.updated_at = now;

      plan.status = "approved";
      plan.approved_by_actor_id = actor.actorId;
      plan.approved_at = now;
      plan.updated_at = now;

      await this.audit(actor, "automation.write_plan_approved", "automation_write_plan", plan.id, {
        plan_hash: input.plan_hash,
        approval_item_id: apprItem.id,
      });

      return plan;
    }

    const { data: rpcRes, error: rpcErr } = await this.db!.rpc("automation_approve_write_plan", {
      p_actor_id: actor.actorId,
      p_plan_id: input.plan_id,
      p_plan_hash: input.plan_hash,
      p_decision_notes: input.decision_notes ?? "Aprovado via Central de Aprovações",
    });

    if (rpcErr || !rpcRes) {
      const errMsg = rpcErr?.message ?? "write_plan_approve_failed";
      if (errMsg.includes("actor_forbidden")) throw new Error("actor_forbidden");
      if (errMsg.includes("write_plan_not_found")) throw new Error("write_plan_not_found");
      if (errMsg.includes("plan_hash_mismatch")) throw new Error("plan_hash_mismatch");
      if (errMsg.includes("write_plan_not_pending")) throw new Error("write_plan_not_pending");
      if (errMsg.includes("approval_item_not_found")) throw new Error("approval_item_not_found");
      if (errMsg.includes("approval_item_not_pending")) throw new Error("approval_item_not_pending");
      throw new Error("write_plan_approve_failed");
    }

    return rpcRes as AutomationWritePlanRecord;
  }

  /**
   * Execução Controlada do Plano de Escrita Externa
   * Validações Obrigatórias:
   * 1. RBAC via `canExecuteAutomationWrite(actor.role)` (Exclusivo para owner, admin, operations_lead)
   * 2. Hash recebido igual ao hash imutável armazenado
   * 3. IDEMPOTÊNCIA: Rejeita dupla execução / replay se plano já for 'executed' ou 'blocked_write_mode'
   * 4. ESTADO DO PLANO: Exige status 'approved' no plano (nunca 'pending_approval' ou 'draft')
   * 5. ESTADO DA APROVAÇÃO: Exige `approval_item.status === 'approved'` e `source_id === plan.id`
   * 6. TRAVA WRITE MODE: Com `ALASTRE_WRITE_MODE=disabled`, atualiza plano para 'blocked_write_mode'
   *    MAS PRESERVA `approval_item.status = 'approved'` (SEM rebaixar a aprovação humana).
   */
  async executeWritePlan(
    actor: ActorContext,
    input: { plan_id: string; plan_hash: string; approval_item_id?: string | null },
  ) {
    if (!canExecuteAutomationWrite(actor.role)) {
      throw new Error("actor_forbidden");
    }

    const currentWriteMode = (serverEnv("ALASTRE_WRITE_MODE") ?? "disabled").trim().toLowerCase();

    if (!this.isDbAvailable()) {
      const plan = automationMemoryStore.writePlans.find(
        (p) => p.agency_id === actor.agencyId && p.id === input.plan_id,
      );
      if (!plan) throw new Error("write_plan_not_found");
      if (plan.plan_hash !== input.plan_hash) throw new Error("plan_hash_mismatch");

      // Idempotência / Replay Check
      if (["executed", "blocked_write_mode", "rejected", "cancelled"].includes(plan.status)) {
        throw new Error("plan_already_processed");
      }

      // Validação de Aprovação Prévias
      if (plan.status !== "approved") {
        throw new Error("write_plan_not_approved");
      }

      const apprItem = automationMemoryStore.approvalItems.find(
        (a) => a.agency_id === actor.agencyId && a.id === plan.approval_item_id && a.source_type === "automation_write" && a.source_id === plan.id,
      );

      if (!apprItem || apprItem.status !== "approved") {
        throw new Error("approval_item_not_approved");
      }

      if (apprItem.proposed_payload.plan_hash !== input.plan_hash) {
        throw new Error("plan_hash_mismatch");
      }

      if (currentWriteMode === "disabled") {
        plan.status = "blocked_write_mode";
        plan.updated_at = new Date().toISOString();

        await this.audit(actor, "automation.write_plan_blocked_write_mode", "automation_write_plan", plan.id, {
          plan_hash: input.plan_hash,
          reason: "ALASTRE_WRITE_MODE está configurado como 'disabled'. A execução externa foi bloqueada em segurança.",
        });

        // PRESERVA o item de aprovação como 'approved'! Não altera a aprovação.
        return {
          plan,
          executed: false,
          reason: "ALASTRE_WRITE_MODE está configurado como 'disabled'. A execução externa foi bloqueada em segurança.",
        };
      }

      plan.status = "executed";
      plan.executed_at = new Date().toISOString();
      plan.updated_at = new Date().toISOString();
      return { plan, executed: true, reason: null };
    }

    const { data: rpcRes, error: rpcErr } = await this.db!.rpc("automation_execute_write_plan", {
      p_actor_id: actor.actorId,
      p_plan_id: input.plan_id,
      p_plan_hash: input.plan_hash,
    });

    if (rpcErr || !rpcRes) {
      const errMsg = rpcErr?.message ?? "write_plan_execute_failed";
      if (errMsg.includes("actor_forbidden")) throw new Error("actor_forbidden");
      if (errMsg.includes("write_plan_not_found")) throw new Error("write_plan_not_found");
      if (errMsg.includes("plan_hash_mismatch")) throw new Error("plan_hash_mismatch");
      if (errMsg.includes("plan_already_processed")) throw new Error("plan_already_processed");
      if (errMsg.includes("write_plan_not_approved")) throw new Error("write_plan_not_approved");
      if (errMsg.includes("approval_item_not_approved")) throw new Error("approval_item_not_approved");
      throw new Error("write_plan_execute_failed");
    }

    return rpcRes as {
      plan: AutomationWritePlanRecord;
      executed: boolean;
      reason: string | null;
    };
  }

  /**
   * Registro de Uso de IA e Atualização de Cotas
   */
  async recordAiUsage(
    actor: ActorContext,
    input: {
      client_id?: string | null;
      capability: string;
      model_name: string;
      tokens_input: number;
      tokens_output: number;
      estimated_cost_usd: number;
      sanitized_summary: string;
    },
  ) {
    if (!this.isDbAvailable()) {
      const now = new Date().toISOString();
      const logRecord: AutomationAiUsageLogRecord = {
        id: `ai-log-${Date.now()}`,
        agency_id: actor.agencyId,
        client_id: input.client_id ?? null,
        capability: input.capability,
        model_name: input.model_name,
        tokens_input: input.tokens_input,
        tokens_output: input.tokens_output,
        estimated_cost_usd: input.estimated_cost_usd,
        sanitized_summary: sanitizeSensitiveData(input.sanitized_summary),
        created_at: now,
      };
      automationMemoryStore.aiUsageLogs.push(logRecord);

      let limitRecord = automationMemoryStore.aiLimits.find(
        (l) => l.agency_id === actor.agencyId && l.capability === input.capability,
      );
      if (!limitRecord) {
        limitRecord = {
          id: `ai-limit-${Date.now()}`,
          agency_id: actor.agencyId,
          capability: input.capability,
          monthly_token_limit: 1_000_000,
          monthly_cost_limit_usd: 100.0,
          current_monthly_tokens: input.tokens_input + input.tokens_output,
          current_monthly_cost_usd: input.estimated_cost_usd,
          last_reset_at: now,
          created_at: now,
          updated_at: now,
        };
        automationMemoryStore.aiLimits.push(limitRecord);
      } else {
        limitRecord.current_monthly_tokens += input.tokens_input + input.tokens_output;
        limitRecord.current_monthly_cost_usd += input.estimated_cost_usd;
        limitRecord.updated_at = now;
      }

      return { log: logRecord, limits: limitRecord };
    }

    const now = new Date().toISOString();

    const { data: logRecord, error: logErr } = await this.db!
      .from("automation_ai_usage_logs")
      .insert({
        agency_id: actor.agencyId,
        client_id: input.client_id ?? null,
        capability: input.capability,
        model_name: input.model_name,
        tokens_input: input.tokens_input,
        tokens_output: input.tokens_output,
        estimated_cost_usd: input.estimated_cost_usd,
        sanitized_summary: sanitizeSensitiveData(input.sanitized_summary),
      })
      .select("*")
      .single();

    if (logErr || !logRecord) throw new Error("ai_usage_log_failed");

    const totalTokens = input.tokens_input + input.tokens_output;

    const { data: limitRecord } = await this.db!
      .from("automation_ai_limits")
      .select("*")
      .eq("agency_id", actor.agencyId)
      .eq("capability", input.capability)
      .maybeSingle();

    let updatedLimits: AutomationAiLimitRecord;

    if (!limitRecord) {
      const { data: insertedLimit, error: insErr } = await this.db!
        .from("automation_ai_limits")
        .insert({
          agency_id: actor.agencyId,
          capability: input.capability,
          monthly_token_limit: 1_000_000,
          monthly_cost_limit_usd: 100.0,
          current_monthly_tokens: totalTokens,
          current_monthly_cost_usd: input.estimated_cost_usd,
        })
        .select("*")
        .single();
      if (insErr || !insertedLimit) throw new Error("ai_limits_upsert_failed");
      updatedLimits = insertedLimit as AutomationAiLimitRecord;
    } else {
      const { data: updLimit, error: updErr } = await this.db!
        .from("automation_ai_limits")
        .update({
          current_monthly_tokens: limitRecord.current_monthly_tokens + totalTokens,
          current_monthly_cost_usd: Number(limitRecord.current_monthly_cost_usd) + input.estimated_cost_usd,
          updated_at: now,
        })
        .eq("agency_id", actor.agencyId)
        .eq("id", limitRecord.id)
        .select("*")
        .single();
      if (updErr || !updLimit) throw new Error("ai_limits_upsert_failed");
      updatedLimits = updLimit as AutomationAiLimitRecord;
    }

    return { log: logRecord as AutomationAiUsageLogRecord, limits: updatedLimits };
  }

  /**
   * Registro Imutável de Auditoria em audit_events
   */
  private async audit(actor: ActorContext, action: string, targetType: string, targetId: string, payload: Record<string, unknown>) {
    const sanitized = sanitizeSensitiveData(payload);
    if (!this.isDbAvailable()) {
      automationMemoryStore.auditLogs.push({
        agency_id: actor.agencyId,
        action,
        payload: { actor_id: actor.actorId, target_type: targetType, target_id: targetId, ...sanitized },
      });
      return;
    }

    await this.db!.from("audit_events").insert({
      agency_id: actor.agencyId,
      actor_user_id: null,
      action,
      target_type: targetType,
      target_id: targetId,
      payload: { actor_id: actor.actorId, role: actor.role, ...sanitized },
    });
  }
}

export const automationService = new AutomationService();
