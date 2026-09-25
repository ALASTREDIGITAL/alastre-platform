import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ProspectingJob,
  ProspectingLead,
  SanitizedBlockTelemetry,
  DncRecord,
  AccessAuditLog,
  WorkerCompleteRequest,
  WorkerCompleteResponse,
  WorkerFailRequest,
  WorkerFailResponse,
  WorkerHeartbeatResponse,
  WorkerClaimResponse,
  DncScope,
} from "./types.ts";
import { buildIdentityKey, hashDncIdentifier } from "./prospecting-identity.ts";

export const EXECUTION_DEADLINE_MS = 5 * 60 * 1000; // 5 minutos inegociáveis
export const QUEUE_TIMEOUT_MS = 30 * 1000;          // 30 segundos limite na fila sem claim (Requisito 5)
export const OPERATIONAL_LEASE_MS = 30 * 1000;     // 30 segundos de renovação curta
export const MAX_JOB_ATTEMPTS = 2;                 // Limite rígido de tentativas
export const SUPERVISOR_HEARTBEAT_THRESHOLD_MS = 10 * 1000; // 10s para considerar supervisor online

export function resolveSharedStorePath(): string {
  if (process.env.PROSPECTING_PERSIST_STORE_PATH) {
    return process.env.PROSPECTING_PERSIST_STORE_PATH;
  }
  if (typeof process !== "undefined" && process.cwd && process.cwd().startsWith("/bundle")) {
    return "C:/Projetos/ALASTRE DIGITAL/ALASTRE-PLATFORM/scripts/poc/work/poc-lease-store.json";
  }
  return path.resolve(process.cwd(), "scripts", "poc", "work", "poc-lease-store.json");
}

/**
 * ============================================================================
 * AVISO DE ARQUITETURA DE TESTE / PROTÓTIPO NÃO-PRODUTIVO (REQUISITO 2):
 *
 * Esta classe é um Test Double / In-Memory & File-backed Test Store desenvolvido
 * exclusivamente para a PoC e para suíte de testes automatizados.
 *
 * ROTAS DESTINADAS AO CLOUDFLARE NÃO PODEM DEPENDER DE `global Map` EM PRODUÇÃO.
 *
 * Para o ambiente de produção (Cloudflare Workers / Edge), o armazenamento DEVE ser
 * transacional com banco de dados durável (ex: PostgreSQL com transações atômicas
 * `SELECT ... FOR UPDATE SKIP LOCKED` via Supabase/Hyperdrive, ou Cloudflare D1 /
 * Durable Objects com transações serializáveis).
 *
 * NÃO É DECLARADA NEM SIMULADA ATOMICIDADE POSTGRESQL NESTE PROTÓTIPO DE TESTE.
 * ============================================================================
 */
export class ProspectingLeaseManager {
  private jobs: Map<string, ProspectingJob> = new Map();
  // Índice único por (job_id, identity_key) conforme requisito 3
  private leadsByJobAndIdentity: Map<string, ProspectingLead> = new Map();
  private blockTelemetryStore: Map<string, SanitizedBlockTelemetry> = new Map();
  private dncStore: Map<string, DncRecord> = new Map();
  private auditLogs: AccessAuditLog[] = [];
  private lastSupervisorHeartbeatAt: string | null = null;
  private supervisorWorkerId: string | null = null;
  private supervisorCapabilities: string[] = [];
  private filePath: string | null = null;

  constructor(filePath?: string | null) {
    if (filePath !== undefined) {
      this.filePath = filePath;
    } else {
      this.filePath = resolveSharedStorePath();
    }

    this.jobs.clear();
    this.leadsByJobAndIdentity.clear();
    this.blockTelemetryStore.clear();
    this.dncStore.clear();
    this.auditLogs = [];
    this.lastSupervisorHeartbeatAt = null;
    this.supervisorWorkerId = null;
    this.supervisorCapabilities = [];

    this.loadFromFile();
  }

  public reset(purgeDisk = false): void {
    this.jobs.clear();
    this.leadsByJobAndIdentity.clear();
    this.blockTelemetryStore.clear();
    this.dncStore.clear();
    this.auditLogs = [];
    this.lastSupervisorHeartbeatAt = null;
    this.supervisorWorkerId = null;
    this.supervisorCapabilities = [];

    if (purgeDisk && this.filePath && fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath);
      } catch {
        // Ignora erro de remoção no reset
      }
    }
  }

  private loadFromFile(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (data.jobs) {
        this.jobs = new Map(Object.entries(data.jobs));
      }
      if (data.leadsByJobAndIdentity) {
        this.leadsByJobAndIdentity = new Map(Object.entries(data.leadsByJobAndIdentity));
      }
      if (data.blockTelemetryStore) {
        this.blockTelemetryStore = new Map(Object.entries(data.blockTelemetryStore));
      }
      if (data.dncStore) {
        this.dncStore = new Map(Object.entries(data.dncStore));
      }
      if (data.auditLogs && Array.isArray(data.auditLogs)) {
        this.auditLogs = data.auditLogs;
      }
      if (data.lastSupervisorHeartbeatAt) {
        this.lastSupervisorHeartbeatAt = data.lastSupervisorHeartbeatAt;
      }
      if (data.supervisorWorkerId) {
        this.supervisorWorkerId = data.supervisorWorkerId;
      }
      if (Array.isArray(data.supervisorCapabilities)) {
        this.supervisorCapabilities = data.supervisorCapabilities;
      }
    } catch {
      // Ignora erro de leitura concorrente temporária
    }
  }

  private saveToFile(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        jobs: Object.fromEntries(this.jobs.entries()),
        leadsByJobAndIdentity: Object.fromEntries(this.leadsByJobAndIdentity.entries()),
        blockTelemetryStore: Object.fromEntries(this.blockTelemetryStore.entries()),
        dncStore: Object.fromEntries(this.dncStore.entries()),
        auditLogs: this.auditLogs,
        lastSupervisorHeartbeatAt: this.lastSupervisorHeartbeatAt,
        supervisorWorkerId: this.supervisorWorkerId,
        supervisorCapabilities: this.supervisorCapabilities,
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
    } catch {
      // Ignora erro de escrita
    }
  }

  /**
   * Varre e expira jobs que ultrapassaram prazos limites:
   * - Jobs queued que excederam 30s sem reivindicação (Requisito 5).
   * - Jobs leased que excederam o deadline total de 5 minutos (Requisito 6).
   * - Jobs leased cujo lease expirou e excederam limite de tentativas (Requisito 6).
   */
  public sweepExpiredJobs(): void {
    this.loadFromFile();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    let changed = false;

    for (const job of this.jobs.values()) {
      // Requisito 5: Se nenhum supervisor reivindicar o job em até 30 segundos, marca como falha por supervisor indisponível
      if (job.status === "queued") {
        const queueDeadline = job.queue_deadline_at
          ? new Date(job.queue_deadline_at).getTime()
          : new Date(job.created_at).getTime() + QUEUE_TIMEOUT_MS;

        if (now > queueDeadline) {
          job.status = "failed";
          job.error_reason = "supervisor_unavailable_timeout";
          job.updated_at = nowIso;
          changed = true;
          continue;
        }
      }

      // Requisito 6: Aplicar corretamente o deadline total de 5 minutos inegociável
      if (
        job.status === "queued" ||
        job.status === "leased" ||
        job.status === "cancellation_requested"
      ) {
        if (job.execution_deadline_at) {
          if (now > new Date(job.execution_deadline_at).getTime()) {
            job.status = "failed";
            job.error_reason = "execution_deadline_exceeded";
            job.updated_at = nowIso;
            changed = true;
            continue;
          }
        }
      }

      // Limite rígido de retomadas
      if (job.status === "leased" && job.lease_expires_at) {
        if (
          now > new Date(job.lease_expires_at).getTime() &&
          job.attempt_count >= MAX_JOB_ATTEMPTS
        ) {
          job.status = "failed";
          job.error_reason = "max_attempts_exceeded";
          job.updated_at = nowIso;
          changed = true;
        }
      }
    }

    if (changed) {
      this.saveToFile();
    }
  }

  /**
   * Cria um job de prospecção isolado.
   * Aplica deadline total de 5 minutos imediatamente e timeout de fila de 30s (Requisitos 5 e 6).
   */
  public createJob(params: {
    agency_id: string;
    query: string;
    location: string;
    limit?: number;
    id?: string;
  }): ProspectingJob {
    this.sweepExpiredJobs();
    const id = params.id || `job_${crypto.randomUUID()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const queueDeadlineIso = new Date(now.getTime() + QUEUE_TIMEOUT_MS).toISOString();

    const job: ProspectingJob = {
      id,
      agency_id: params.agency_id,
      query: params.query.trim(),
      location: params.location.trim(),
      limit: params.limit && params.limit > 0 ? Math.min(params.limit, 50) : 10,
      status: "queued",
      attempt_count: 0,
      first_leased_at: null,
      queue_deadline_at: queueDeadlineIso,
      execution_deadline_at: null,
      lease_id: null,
      leased_at: null,
      lease_expires_at: null,
      heartbeat_at: null,
      worker_id: null,
      idempotency_key: null,
      error_reason: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.jobs.set(id, job);
    this.saveToFile();
    return { ...job };
  }

  public getJob(id: string): ProspectingJob | null {
    this.sweepExpiredJobs();
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  /**
   * Reivindicação atômica de trabalho.
   * Regras estritas:
   * - Jobs blocked, cancelled, cancellation_requested, completed ou com deadline expirado JAMAIS são reivindicados.
   * - attempt_count tem teto rígido (máx 2).
   * - first_leased_at e execution_deadline_at (5 minutos) são definidos no primeiro claim e NUNCA mais alterados.
   */
  public claimJob(workerId: string, capabilities: string[] = []): WorkerClaimResponse {
    this.sweepExpiredJobs();
    // Registra batimento do supervisor conectado (Requisito 1)
    this.recordSupervisorHeartbeat(workerId, capabilities);

    const now = new Date();
    const nowIso = now.toISOString();

    for (const job of this.jobs.values()) {
      // Condição 2: Jamais reivindicar jobs nestes estados terminais/bloqueantes
      if (
        job.status === "blocked" ||
        job.status === "cancelled" ||
        job.status === "cancellation_requested" ||
        job.status === "completed" ||
        job.status === "failed"
      ) {
        continue;
      }

      // Se já teve claim prévio, verifica o deadline imutável
      if (job.execution_deadline_at) {
        const deadlineTime = new Date(job.execution_deadline_at).getTime();
        if (now.getTime() > deadlineTime) {
          job.status = "failed";
          job.error_reason = "execution_deadline_exceeded";
          job.updated_at = nowIso;
          continue;
        }
      }

      // Verifica limite rígido de tentativas
      if (job.attempt_count >= MAX_JOB_ATTEMPTS) {
        job.status = "failed";
        job.error_reason = "max_attempts_exceeded";
        job.updated_at = nowIso;
        continue;
      }

      // Candidato: se está queued OU se o lease operacional curto expirou
      const isAvailable =
        job.status === "queued" ||
        (job.status === "leased" &&
          job.lease_expires_at &&
          now.getTime() > new Date(job.lease_expires_at).getTime());

      if (isAvailable) {
        // Primeiro claim define first_leased_at e execution_deadline_at imutáveis
        if (!job.first_leased_at) {
          job.first_leased_at = nowIso;
          job.execution_deadline_at = new Date(
            now.getTime() + EXECUTION_DEADLINE_MS
          ).toISOString();
        }

        job.attempt_count += 1;
        const newLeaseId = `lease_${crypto.randomUUID()}`;
        job.lease_id = newLeaseId;
        job.leased_at = nowIso;
        job.lease_expires_at = new Date(
          now.getTime() + OPERATIONAL_LEASE_MS
        ).toISOString();
        job.heartbeat_at = nowIso;
        job.worker_id = workerId;
        job.status = "leased";
        job.updated_at = nowIso;

        this.saveToFile();

        return {
          claimed: true,
          job: { ...job },
          lease_id: job.lease_id,
          lease_expires_at: job.lease_expires_at,
          execution_deadline_at: job.execution_deadline_at,
        };
      }
    }

    this.saveToFile();

    return {
      claimed: false,
      job: null,
      lease_id: null,
      lease_expires_at: null,
      execution_deadline_at: null,
      message: "No available jobs to claim",
    };
  }

  /**
   * Heartbeat periódico do worker.
   * Regras:
   * - Renova apenas o lease operacional curto (ex: 30s).
   * - NUNCA estende o execution_deadline_at imutável.
   * - Informa ao worker se houver cancellation_requested.
   */
  public heartbeat(
    jobId: string,
    leaseId: string,
    workerId: string
  ): WorkerHeartbeatResponse {
    this.loadFromFile();
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        acknowledged: false,
        lease_expires_at: null,
        execution_deadline_at: null,
        cancellation_requested: false,
        status: "failed",
      };
    }

    if (job.lease_id !== leaseId || job.worker_id !== workerId) {
      return {
        acknowledged: false,
        lease_expires_at: null,
        execution_deadline_at: job.execution_deadline_at,
        cancellation_requested: false,
        status: job.status,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Checagem inegociável do deadline de 5 minutos
    if (job.execution_deadline_at) {
      const deadline = new Date(job.execution_deadline_at).getTime();
      if (now.getTime() > deadline) {
        job.status = "failed";
        job.error_reason = "execution_deadline_exceeded";
        job.updated_at = nowIso;
        this.saveToFile();
        return {
          acknowledged: false,
          lease_expires_at: null,
          execution_deadline_at: job.execution_deadline_at,
          cancellation_requested: true,
          status: "failed",
        };
      }
    }

    // Se cancelamento cooperativo foi solicitado
    if (
      job.status === "cancellation_requested" ||
      job.status === "cancelled"
    ) {
      this.saveToFile();
      return {
        acknowledged: true,
        lease_expires_at: job.lease_expires_at,
        execution_deadline_at: job.execution_deadline_at,
        cancellation_requested: true,
        status: job.status,
      };
    }

    // Renova SOMENTE o lease operacional curto
    job.lease_expires_at = new Date(
      now.getTime() + OPERATIONAL_LEASE_MS
    ).toISOString();
    job.heartbeat_at = nowIso;
    job.updated_at = nowIso;

    this.saveToFile();

    return {
      acknowledged: true,
      lease_expires_at: job.lease_expires_at,
      execution_deadline_at: job.execution_deadline_at, // Imutável!
      cancellation_requested: false,
      status: job.status,
    };
  }

  /**
   * Solicita cancelamento cooperativo do job.
   * Requisito 7: Garantir que cancelar um job ainda enfileirado altere imediatamente seu estado para cancelado.
   */
  public requestCancellation(jobId: string, reason = "user_requested"): boolean {
    this.sweepExpiredJobs();
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (
      job.status === "completed" ||
      job.status === "cancelled" ||
      job.status === "failed" ||
      job.status === "blocked"
    ) {
      return false;
    }
    const nowIso = new Date().toISOString();
    // Se o job ainda está na fila (não reivindicado), cancela imediatamente
    if (job.status === "queued") {
      job.status = "cancelled";
      job.error_reason = reason;
      job.updated_at = nowIso;
      this.saveToFile();
      return true;
    }
    // Se já foi leased para um supervisor, solicita cancelamento cooperativo
    job.status = "cancellation_requested";
    job.error_reason = reason;
    job.updated_at = nowIso;
    this.saveToFile();
    return true;
  }

  /**
   * Finalização com entrega de leads pelo worker.
   * Regras:
   * - Validação do lease e deadline.
   * - Deduplicação por (job_id, identity_key). Nome isolado NÃO é identidade.
   * - Filtragem contra Do Not Contact (DNC) ativo.
   */
  public completeJob(params: WorkerCompleteRequest): WorkerCompleteResponse {
    this.loadFromFile();
    const { job_id, lease_id, worker_id, idempotency_key, leads } = params;
    const job = this.jobs.get(job_id);

    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }

    // Idempotência
    if (job.status === "completed" && job.idempotency_key === idempotency_key) {
      const existing = this.getLeadsForJob(job_id);
      return {
        success: true,
        total_received: leads.length,
        total_saved: existing.length,
        duplicates_discarded: 0,
        dnc_filtered: 0,
      };
    }

    if (job.lease_id !== lease_id || job.worker_id !== worker_id) {
      throw new Error(`Invalid lease or worker mismatch for job ${job_id}`);
    }

    const now = new Date();
    // Checagem de deadline
    if (job.execution_deadline_at) {
      if (now.getTime() > new Date(job.execution_deadline_at).getTime()) {
        job.status = "failed";
        job.error_reason = "execution_deadline_exceeded";
        job.updated_at = now.toISOString();
        this.saveToFile();
        throw new Error(`Execution deadline exceeded for job ${job_id}`);
      }
    }

    let saved = 0;
    let duplicates = 0;
    let dncFiltered = 0;

    for (const raw of leads) {
      // Constrói identity_key normalizada
      const identityKey = buildIdentityKey({
        cid: raw.cid,
        place_id: raw.place_id,
        maps_url: raw.maps_url,
        phone: raw.phone,
        name: raw.name,
      });

      if (!identityKey) {
        // Sem CID, Place ID, URL canônica ou telefone: descarta pois nome isolado não é definitivo
        duplicates += 1;
        continue;
      }

      // Verificação de DNC (hash sha256)
      const idHash = hashDncIdentifier(identityKey);
      const phoneHash = raw.phone ? hashDncIdentifier(raw.phone) : null;

      if (this.isDncActive(idHash, job.agency_id) || (phoneHash && this.isDncActive(phoneHash, job.agency_id))) {
        dncFiltered += 1;
        continue;
      }

      // Verificação de duplicata dentro do mesmo job via chave (job_id, identity_key)
      const uniqueCompoundKey = `${job_id}:${identityKey}`;
      if (this.leadsByJobAndIdentity.has(uniqueCompoundKey)) {
        duplicates += 1;
        continue;
      }

      const leadRecord: ProspectingLead = {
        id: `lead_${crypto.randomUUID()}`,
        job_id,
        identity_key: identityKey,
        name: raw.name.trim(),
        category: raw.category?.trim() || null,
        address: raw.address?.trim() || null,
        phone: raw.phone?.trim() || null,
        website: raw.website?.trim() || null,
        rating: typeof raw.rating === "number" ? raw.rating : null,
        review_count: typeof raw.review_count === "number" ? raw.review_count : null,
        maps_url: raw.maps_url?.trim() || null,
        place_id: raw.place_id?.trim() || null,
        cid: raw.cid?.trim() || null,
        created_at: now.toISOString(),
      };

      this.leadsByJobAndIdentity.set(uniqueCompoundKey, leadRecord);
      saved += 1;
    }

    job.status = "completed";
    job.idempotency_key = idempotency_key;
    job.updated_at = now.toISOString();

    this.jobs.set(job_id, job);
    this.saveToFile();

    return {
      success: true,
      total_received: leads.length,
      total_saved: saved,
      duplicates_discarded: duplicates,
      dnc_filtered: dncFiltered,
    };
  }

  /**
   * Registro de falha ou bloqueio sanitizado pelo worker.
   */
  public failJob(params: WorkerFailRequest): WorkerFailResponse {
    this.loadFromFile();
    const { job_id, lease_id, worker_id, reason, is_blocked, block_telemetry } = params;
    const job = this.jobs.get(job_id);

    if (!job) {
      return { acknowledged: false, status: "failed" };
    }

    if (job.lease_id !== lease_id || job.worker_id !== worker_id) {
      return { acknowledged: false, status: job.status };
    }

    const now = new Date().toISOString();
    job.updated_at = now;
    job.error_reason = reason;

    if (is_blocked && block_telemetry) {
      job.status = "blocked";
      // Sanitização estrita: apenas telemetria estruturada, sem HTML bruto nem CAPTCHA
      this.blockTelemetryStore.set(job_id, {
        block_type: block_telemetry.block_type,
        sanitized_url: block_telemetry.sanitized_url,
        http_status: block_telemetry.http_status,
        detected_at: block_telemetry.detected_at,
        collector_version: block_telemetry.collector_version,
      });
    } else if (
      job.status === "cancellation_requested" ||
      reason.toLowerCase().includes("cancel")
    ) {
      job.status = "cancelled";
    } else {
      job.status = "failed";
    }

    this.saveToFile();

    return { acknowledged: true, status: job.status };
  }

  public hasActiveJob(agencyId?: string): boolean {
    this.sweepExpiredJobs();
    for (const job of this.jobs.values()) {
      if (agencyId && job.agency_id !== agencyId) continue;
      if (job.status === "queued" || job.status === "leased") {
        return true;
      }
    }
    return false;
  }

  public getActiveJob(agencyId?: string): ProspectingJob | null {
    this.sweepExpiredJobs();
    for (const job of this.jobs.values()) {
      if (agencyId && job.agency_id !== agencyId) continue;
      if (job.status === "queued" || job.status === "leased") {
        return { ...job };
      }
    }
    return null;
  }

  public getAllJobs(): ProspectingJob[] {
    this.sweepExpiredJobs();
    return Array.from(this.jobs.values()).map((j) => ({ ...j }));
  }

  /**
   * Registra batimento de saúde do supervisor conectado (Requisito 1).
   */
  public recordSupervisorHeartbeat(workerId: string, capabilities: string[] = []): void {
    this.loadFromFile();
    this.lastSupervisorHeartbeatAt = new Date().toISOString();
    this.supervisorWorkerId = workerId;
    if (capabilities.length > 0) {
      this.supervisorCapabilities = capabilities;
    }
    this.saveToFile();
  }

  /**
   * Obtém o estado de saúde do supervisor com cálculo de tempo desde o último sinal (Requisitos 1 e 3).
   */
  public getSupervisorHealth(): {
    online: boolean;
    last_heartbeat: string | null;
    seconds_since_heartbeat: number | null;
    worker_id: string | null;
    message: string;
  } {
    this.loadFromFile();
    if (!this.lastSupervisorHeartbeatAt) {
      return {
        online: false,
        last_heartbeat: null,
        seconds_since_heartbeat: null,
        worker_id: null,
        message: "Motor de prospecção local offline. Nenhum supervisor conectado.",
      };
    }
    const diffMs = Date.now() - new Date(this.lastSupervisorHeartbeatAt).getTime();
    const secondsSince = Math.max(0, Math.round(diffMs / 1000));
    const isOnline = diffMs <= SUPERVISOR_HEARTBEAT_THRESHOLD_MS;
    return {
      online: isOnline,
      last_heartbeat: this.lastSupervisorHeartbeatAt,
      seconds_since_heartbeat: secondsSince,
      worker_id: this.supervisorWorkerId,
      message: isOnline
        ? "Motor de prospecção online e pronto para executar."
        : `Motor de prospecção local offline (último sinal há ${secondsSince}s).`,
    };
  }

  public getLeadsForJob(jobId: string): ProspectingLead[] {
    this.loadFromFile();
    const result: ProspectingLead[] = [];
    const prefix = `${jobId}:`;
    for (const [key, val] of this.leadsByJobAndIdentity.entries()) {
      if (key.startsWith(prefix)) {
        result.push({ ...val });
      }
    }
    return result;
  }

  public getBlockTelemetry(jobId: string): SanitizedBlockTelemetry | null {
    this.loadFromFile();
    const record = this.blockTelemetryStore.get(jobId);
    return record ? { ...record } : null;
  }

  /**
   * Adiciona registro durável de Do Not Contact (DNC) via hash SHA-256.
   */
  public addDncRecord(params: {
    rawIdentifier: string;
    scope: DncScope;
    agency_id?: string | null;
    reason: string;
  }): DncRecord {
    this.loadFromFile();
    const hash = hashDncIdentifier(params.rawIdentifier);
    const record: DncRecord = {
      identity_hash: hash,
      scope: params.scope,
      agency_id: params.scope === "agency" ? params.agency_id || null : null,
      reason: params.reason,
      created_at: new Date().toISOString(),
    };
    this.dncStore.set(`${record.scope}:${record.agency_id || "global"}:${hash}`, record);
    this.saveToFile();
    return record;
  }

  public isDncActive(hash: string, agencyId: string): boolean {
    if (this.dncStore.has(`global:global:${hash}`)) {
      return true;
    }
    if (this.dncStore.has(`agency:${agencyId}:${hash}`)) {
      return true;
    }
    return false;
  }

  /**
   * Auditoria com campos essenciais sem salvar IP de operador indiscriminadamente.
   */
  public recordAuditLog(params: {
    user_id: string;
    agency_id: string;
    action: string;
  }): AccessAuditLog {
    this.loadFromFile();
    const log: AccessAuditLog = {
      user_id: params.user_id,
      agency_id: params.agency_id,
      action: params.action,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(log);
    this.saveToFile();
    return log;
  }

  public getAuditLogs(): AccessAuditLog[] {
    this.loadFromFile();
    return [...this.auditLogs];
  }
}

export const globalProspectingLeaseManager = new ProspectingLeaseManager(resolveSharedStorePath());
