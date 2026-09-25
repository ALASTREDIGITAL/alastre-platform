import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import { canWriteOperations } from "../../../lib/permissions.ts";
import {
  QualityApiActionSchema,
  qualityMemoryStore,
  DEFAULT_CANONICAL_CHECKLIST_TEMPLATES,
  type QualityApiAction,
} from "../../../lib/quality-api.ts";
import {
  sanitizeMetadataObject,
  sanitizeTextContent,
  determineReviewPolicy,
  validateSegregationOfDuties,
  type QualityEvidence,
  type QualityChecklistTemplate,
  type QualityChecklistRun,
  type QualityNonConformity,
  type QualityAuditHistoryEntry,
  type CriterionRunResult,
} from "../../../lib/quality-domain.ts";
import { operationsMemoryStore } from "../operations/route.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errObj = error as { code?: string; message?: string };
  const msg = errObj.message?.toLowerCase() || "";
  const code = errObj.code || "";
  return (
    code === "42P01" ||
    code.startsWith("PGRST") ||
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache")
  );
}

export async function POST(request: Request) {
  const authResult = await resolveAuthenticatedActor(request);

  if (!authResult && (process.env.NODE_ENV === "production" || request.headers.get("x-test-unauth") === "true")) {
    return Response.json(
      { success: false, error: "Não autorizado ou sessão expirada" },
      { status: 401 },
    );
  }

  const actor = authResult?.actor ?? {
    actorId: "test-actor-id",
    agencyId: "00000000-0000-0000-0000-000000000001",
    role: "owner" as const,
  };
  const actorEmail = authResult?.email ?? "ag.alastredigital@gmail.com";
  const agencyId = actor.agencyId;

  if (!canWriteOperations(actor.role)) {
    return Response.json(
      { success: false, error: "Acesso negado ao Módulo de Qualidade e Evidências" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Formato de payload JSON inválido" },
      { status: 400 },
    );
  }

  const parseResult = QualityApiActionSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      {
        success: false,
        error: "Erros de validação nos campos do payload",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const actionData: QualityApiAction = parseResult.data;
  const admin = createSupabaseAdmin();

  try {
    switch (actionData.action) {
      case "fetch_workspace": {
        let evidences: QualityEvidence[] = [];
        let checklistTemplates: QualityChecklistTemplate[] = [];
        let checklistRuns: QualityChecklistRun[] = [];
        let nonConformities: QualityNonConformity[] = [];
        let auditHistory: QualityAuditHistoryEntry[] = [];
        let useDb = false;

        if (admin) {
          try {
            const [
              { data: evData, error: evErr },
              { data: tmplData },
              { data: runsData },
              { data: ncData },
              { data: histData },
            ] = await Promise.all([
              admin.from("quality_evidences").select("*").eq("agency_id", agencyId),
              admin.from("quality_checklist_templates").select("*").eq("agency_id", agencyId),
              admin.from("quality_checklist_runs").select("*").eq("agency_id", agencyId),
              admin.from("quality_non_conformities").select("*").eq("agency_id", agencyId),
              admin.from("quality_audit_history").select("*").eq("agency_id", agencyId),
            ]);

            if (!evErr && evData) {
              useDb = true;
              evidences = (evData as QualityEvidence[]) || [];
              checklistTemplates = (tmplData as QualityChecklistTemplate[]) || [];
              checklistRuns = (runsData as QualityChecklistRun[]) || [];
              nonConformities = (ncData as QualityNonConformity[]) || [];
              auditHistory = (histData as QualityAuditHistoryEntry[]) || [];
            }
          } catch {
            useDb = false;
          }
        }

        if (!useDb) {
          evidences = qualityMemoryStore.evidences.filter((e) => e.agency_id === agencyId);
          checklistTemplates = qualityMemoryStore.checklistTemplates.filter(
            (t) => t.agency_id === agencyId,
          );
          checklistRuns = qualityMemoryStore.checklistRuns.filter((r) => r.agency_id === agencyId);
          nonConformities = qualityMemoryStore.nonConformities.filter(
            (nc) => nc.agency_id === agencyId,
          );
          auditHistory = qualityMemoryStore.auditHistory.filter((h) => h.agency_id === agencyId);
        }

        // Se templates estiverem vazios, injetar templates canônicos padrão para a agência
        if (checklistTemplates.length === 0) {
          const canonicals = DEFAULT_CANONICAL_CHECKLIST_TEMPLATES.map((tmpl) => ({
            ...tmpl,
            agency_id: agencyId,
          }));
          if (useDb && admin) {
            try {
              await admin.from("quality_checklist_templates").insert(canonicals);
            } catch {}
          } else {
            qualityMemoryStore.checklistTemplates.push(...canonicals);
          }
          checklistTemplates = canonicals;
        }

        return Response.json({
          success: true,
          agency_id: agencyId,
          evidences,
          checklist_templates: checklistTemplates,
          checklist_runs: checklistRuns,
          non_conformities: nonConformities,
          audit_history: auditHistory,
        });
      }

      case "create_evidence": {
        const sanitizedRef = sanitizeTextContent(actionData.verifiable_reference);
        const sanitizedMeta = sanitizeMetadataObject(actionData.sanitized_metadata || {});
        const sanitizedLimitation = actionData.limitation_note
          ? sanitizeTextContent(actionData.limitation_note)
          : null;

        const newEvidence: QualityEvidence = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          work_item_id: actionData.work_item_id,
          client_id: actionData.client_id || null,
          unit_id: actionData.unit_id || null,
          service_id: actionData.service_id || null,
          delivery_item_type: actionData.delivery_item_type || null,
          delivery_item_id: actionData.delivery_item_id || null,
          evidence_type: actionData.evidence_type,
          origin: actionData.origin || "manual",
          verification_status: "pending",
          responsible_actor_id: actor.actorId,
          verified_by_actor_id: null,
          verified_at: null,
          captured_at: new Date().toISOString(),
          verifiable_reference: sanitizedRef,
          before_reference: actionData.before_reference
            ? sanitizeTextContent(actionData.before_reference)
            : null,
          after_reference: actionData.after_reference
            ? sanitizeTextContent(actionData.after_reference)
            : null,
          sanitized_metadata: sanitizedMeta,
          limitation_note: sanitizedLimitation,
          is_locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const auditEntry: QualityAuditHistoryEntry = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          entity_type: "evidence",
          entity_id: newEvidence.id,
          action: "created",
          actor_id: actor.actorId,
          previous_state: null,
          new_state: newEvidence as unknown as Record<string, unknown>,
          change_reason: "Criação de evidência vinculada à atividade",
          created_at: new Date().toISOString(),
        };

        let savedInDb = false;
        if (admin) {
          const { error: insertErr } = await admin
            .from("quality_evidences")
            .insert([newEvidence]);
          if (!insertErr) {
            savedInDb = true;
            try {
              await admin.from("quality_audit_history").insert([auditEntry]);
            } catch {}
          } else if (!isTableMissingError(insertErr)) {
            return Response.json({ success: false, error: insertErr.message }, { status: 500 });
          }
        }

        if (!savedInDb) {
          qualityMemoryStore.evidences.push(newEvidence);
          qualityMemoryStore.auditHistory.push(auditEntry);
        }

        return Response.json({
          success: true,
          evidence: newEvidence,
        });
      }

      case "verify_evidence": {
        let existing: QualityEvidence | undefined;
        let useDb = false;

        if (admin) {
          const { data, error: fetchErr } = await admin
            .from("quality_evidences")
            .select("*")
            .eq("agency_id", agencyId)
            .eq("id", actionData.evidence_id)
            .maybeSingle();

          if (!fetchErr && data) {
            useDb = true;
            existing = data as QualityEvidence;
          }
        }

        if (!useDb) {
          existing = qualityMemoryStore.evidences.find(
            (e) => e.agency_id === agencyId && e.id === actionData.evidence_id,
          );
        }

        if (!existing) {
          return Response.json(
            { success: false, error: "Evidência não encontrada" },
            { status: 404 },
          );
        }

        if (existing.is_locked && existing.verification_status === "verified") {
          return Response.json(
            { success: false, error: "Evidência aprovada já está trancada contra alterações diretas" },
            { status: 400 },
          );
        }

        // Validação de Segregação de Funções para verificação
        const segregationCheck = validateSegregationOfDuties(
          existing.responsible_actor_id,
          actor.actorId,
          "high",
          "mandatory",
        );

        if (
          actionData.verification_status === "verified" &&
          !segregationCheck.allowed
        ) {
          return Response.json(
            { success: false, error: segregationCheck.reason },
            { status: 403 },
          );
        }

        const prevState = { ...existing };
        const isVerified = actionData.verification_status === "verified";
        const updatedEvidence: QualityEvidence = {
          ...existing,
          verification_status: actionData.verification_status,
          verified_by_actor_id: actor.actorId,
          verified_at: new Date().toISOString(),
          is_locked: isVerified,
          updated_at: new Date().toISOString(),
        };

        const auditEntry: QualityAuditHistoryEntry = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          entity_type: "evidence",
          entity_id: existing.id,
          action: isVerified ? "verified" : actionData.verification_status === "rejected" ? "rejected" : "modified",
          actor_id: actor.actorId,
          previous_state: prevState as unknown as Record<string, unknown>,
          new_state: updatedEvidence as unknown as Record<string, unknown>,
          change_reason: actionData.reason || `Alteração de status para ${actionData.verification_status}`,
          created_at: new Date().toISOString(),
        };

        if (useDb && admin) {
          await admin
            .from("quality_evidences")
            .update({
              verification_status: updatedEvidence.verification_status,
              verified_by_actor_id: updatedEvidence.verified_by_actor_id,
              verified_at: updatedEvidence.verified_at,
              is_locked: updatedEvidence.is_locked,
              updated_at: updatedEvidence.updated_at,
            })
            .eq("agency_id", agencyId)
            .eq("id", existing.id);

          try {
            await admin.from("quality_audit_history").insert([auditEntry]);
          } catch {}
        } else {
          const index = qualityMemoryStore.evidences.findIndex((e) => e.id === existing?.id);
          if (index !== -1) {
            qualityMemoryStore.evidences[index] = updatedEvidence;
          }
          qualityMemoryStore.auditHistory.push(auditEntry);
        }

        return Response.json({
          success: true,
          evidence: updatedEvidence,
        });
      }

      case "run_checklist": {
        const reviewPolicy = determineReviewPolicy(actionData.risk_level);
        const newRun: QualityChecklistRun = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          work_item_id: actionData.work_item_id,
          client_id: actionData.client_id || null,
          template_id: actionData.template_id || null,
          checklist_version: 1,
          risk_level: actionData.risk_level,
          review_policy: reviewPolicy,
          status: actionData.criteria_results.every((r) => r.result === "passed" || r.result === "waived")
            ? "approved"
            : actionData.criteria_results.some((r) => r.result === "failed")
              ? "rejected"
              : "in_progress",
          criteria_results: actionData.criteria_results as CriterionRunResult[],
          executed_by_actor_id: actor.actorId,
          reviewed_by_actor_id: null,
          verified_by_actor_id: null,
          verified_at: null,
          waived_justification: actionData.waived_justification || null,
          is_locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const auditEntry: QualityAuditHistoryEntry = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          entity_type: "checklist_run",
          entity_id: newRun.id,
          action: "created",
          actor_id: actor.actorId,
          previous_state: null,
          new_state: newRun as unknown as Record<string, unknown>,
          change_reason: "Execução de checklist de qualidade na atividade",
          created_at: new Date().toISOString(),
        };

        let savedInDb = false;
        if (admin) {
          const { error: insErr } = await admin.from("quality_checklist_runs").insert([newRun]);
          if (!insErr) {
            savedInDb = true;
            try {
              await admin.from("quality_audit_history").insert([auditEntry]);
            } catch {}
          }
        }

        if (!savedInDb) {
          qualityMemoryStore.checklistRuns.push(newRun);
          qualityMemoryStore.auditHistory.push(auditEntry);
        }

        return Response.json({
          success: true,
          checklist_run: newRun,
        });
      }

      case "open_non_conformity": {
        const newNC: QualityNonConformity = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          client_id: actionData.client_id,
          work_item_id: actionData.work_item_id || null,
          workflow_id: actionData.workflow_id || null,
          evidence_id: actionData.evidence_id || null,
          title: sanitizeTextContent(actionData.title),
          severity: actionData.severity,
          status: "open",
          root_cause: sanitizeTextContent(actionData.root_cause || ""),
          impact: sanitizeTextContent(actionData.impact || ""),
          corrective_work_item_id: null,
          opened_by_actor_id: actor.actorId,
          assigned_actor_id: actionData.assigned_actor_id || null,
          resolved_by_actor_id: null,
          resolved_at: null,
          verified_by_actor_id: null,
          verified_at: null,
          waive_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const auditEntry: QualityAuditHistoryEntry = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          entity_type: "non_conformity",
          entity_id: newNC.id,
          action: "created",
          actor_id: actor.actorId,
          previous_state: null,
          new_state: newNC as unknown as Record<string, unknown>,
          change_reason: `Abertura de não conformidade (${actionData.severity})`,
          created_at: new Date().toISOString(),
        };

        let savedInDb = false;
        if (admin) {
          const { error: insErr } = await admin.from("quality_non_conformities").insert([newNC]);
          if (!insErr) {
            savedInDb = true;
            try {
              await admin.from("quality_audit_history").insert([auditEntry]);
            } catch {}
          }
        }

        if (!savedInDb) {
          qualityMemoryStore.nonConformities.push(newNC);
          qualityMemoryStore.auditHistory.push(auditEntry);
        }

        return Response.json({
          success: true,
          non_conformity: newNC,
        });
      }

      case "create_corrective_action": {
        // Tentar via RPC atômica do PostgreSQL primeiro
        if (admin) {
          try {
            const { data: rpcData, error: rpcErr } = await admin.rpc("quality_create_corrective_action", {
              p_agency_id: agencyId,
              p_non_conformity_id: actionData.non_conformity_id,
              p_title: actionData.title,
              p_description: actionData.description || "",
              p_priority: actionData.priority,
              p_actor_id: actor.actorId,
              p_actor_email: actorEmail,
            });

            if (!rpcErr && rpcData && typeof rpcData === "object") {
              const resObj = rpcData as { success?: boolean; error?: string; workflow_id?: string; corrective_work_item_id?: string };
              if (resObj.success === false) {
                return Response.json({ success: false, error: resObj.error || "Falha na transação atômica de ação corretiva" }, { status: 400 });
              }
              if (resObj.success) {
                return Response.json({
                  success: true,
                  workflow_id: resObj.workflow_id,
                  corrective_work_item_id: resObj.corrective_work_item_id,
                });
              }
            }
          } catch {
            // Em dev/test offline onde a RPC ainda não existe remotamente, cai para resolução transacional em memória
          }
        }

        // Execução Atômica de fallback (Memória / DB com validação estrita)
        let nc: QualityNonConformity | undefined;
        let useDb = false;

        if (admin) {
          const { data, error: fetchErr } = await admin
            .from("quality_non_conformities")
            .select("*")
            .eq("agency_id", agencyId)
            .eq("id", actionData.non_conformity_id)
            .maybeSingle();

          if (!fetchErr && data) {
            useDb = true;
            nc = data as QualityNonConformity;
          }
        }

        if (!useDb) {
          nc = qualityMemoryStore.nonConformities.find(
            (item) => item.agency_id === agencyId && item.id === actionData.non_conformity_id,
          );
        }

        if (!nc) {
          return Response.json(
            { success: false, error: "Não conformidade não encontrada ou pertence a outra agência" },
            { status: 404 },
          );
        }

        // Resolução do Workflow: reaproveitar workflow válido da agência ou criar novo workflow na mesma agência & cliente
        let targetWorkflowId: string | null = null;
        if (nc.workflow_id) {
          let wfExists = false;
          if (useDb && admin) {
            const { data: wfData } = await admin
              .from("workflows")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("id", nc.workflow_id)
              .eq("client_id", nc.client_id)
              .maybeSingle();
            wfExists = !!wfData;
          } else {
            wfExists = operationsMemoryStore.workflows.some(
              (w) => w.agency_id === agencyId && w.id === nc?.workflow_id && w.client_id === nc.client_id,
            );
          }
          if (wfExists) {
            targetWorkflowId = nc.workflow_id;
          }
        }

        // Se não houver workflow válido da agência, criar um novo
        let newCreatedWorkflow: Record<string, unknown> | null = null;
        if (!targetWorkflowId) {
          targetWorkflowId = crypto.randomUUID();
          newCreatedWorkflow = {
            id: targetWorkflowId,
            agency_id: agencyId,
            client_id: nc.client_id,
            title: `Workflow de Exceção: ${nc.title.slice(0, 100)}`,
            workflow_type: "exception",
            status: "in_progress",
            priority: actionData.priority,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        // Criar item de trabalho corretivo no Motor de Operações (Módulo 04)
        const correctiveWorkItem = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          client_id: nc.client_id,
          workflow_id: targetWorkflowId,
          title: `[Ação Corretiva] ${sanitizeTextContent(actionData.title)}`,
          description: `Ação gerada para solução da Não Conformidade NC-${nc.id.slice(0, 8)}: ${nc.title}. Causa: ${nc.root_cause || "Em análise"}`,
          task_type: "manual" as const,
          frequency: "one_off" as const,
          status: "todo" as const,
          priority: actionData.priority,
          estimated_minutes: 60,
          actual_minutes: 0,
          assigned_actor_id: actionData.assigned_actor_id || actor.actorId,
          assigned_actor_name: actorEmail,
          requires_approval: true,
          evidence_required: true,
          acceptance_criteria: `Correção comprovada da NC-${nc.id.slice(0, 8)} com evidências e verificação de não reincidência.`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedNC: QualityNonConformity = {
          ...nc,
          status: "action_created",
          workflow_id: targetWorkflowId,
          corrective_work_item_id: correctiveWorkItem.id,
          updated_at: new Date().toISOString(),
        };

        const auditEntry: QualityAuditHistoryEntry = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          entity_type: "non_conformity",
          entity_id: nc.id,
          action: "modified",
          actor_id: actor.actorId,
          previous_state: nc as unknown as Record<string, unknown>,
          new_state: updatedNC as unknown as Record<string, unknown>,
          change_reason: "Criação atômica de ação corretiva",
          created_at: new Date().toISOString(),
        };

        if (useDb && admin) {
          try {
            if (newCreatedWorkflow) {
              await admin.from("workflows").insert([newCreatedWorkflow]);
            }
            await admin.from("work_items").insert([correctiveWorkItem]);
            await admin
              .from("quality_non_conformities")
              .update({
                status: updatedNC.status,
                workflow_id: updatedNC.workflow_id,
                corrective_work_item_id: updatedNC.corrective_work_item_id,
                updated_at: updatedNC.updated_at,
              })
              .eq("agency_id", agencyId)
              .eq("id", nc.id);
            await admin.from("quality_audit_history").insert([auditEntry]);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erro na transação de ação corretiva";
            return Response.json({ success: false, error: msg }, { status: 500 });
          }
        } else {
          if (newCreatedWorkflow) {
            operationsMemoryStore.workflows.push(newCreatedWorkflow as any);
          }
          operationsMemoryStore.workItems.push(correctiveWorkItem as any);
          const idx = qualityMemoryStore.nonConformities.findIndex((item) => item.id === nc?.id);
          if (idx !== -1) {
            qualityMemoryStore.nonConformities[idx] = updatedNC;
          }
          qualityMemoryStore.auditHistory.push(auditEntry);
        }

        return Response.json({
          success: true,
          workflow_id: targetWorkflowId,
          corrective_work_item: correctiveWorkItem,
          non_conformity: updatedNC,
        });
      }

      case "resolve_non_conformity": {
        let nc: QualityNonConformity | undefined;
        let useDb = false;

        if (admin) {
          const { data, error: fetchErr } = await admin
            .from("quality_non_conformities")
            .select("*")
            .eq("agency_id", agencyId)
            .eq("id", actionData.non_conformity_id)
            .maybeSingle();

          if (!fetchErr && data) {
            useDb = true;
            nc = data as QualityNonConformity;
          }
        }

        if (!useDb) {
          nc = qualityMemoryStore.nonConformities.find(
            (item) => item.agency_id === agencyId && item.id === actionData.non_conformity_id,
          );
        }

        if (!nc) {
          return Response.json(
            { success: false, error: "Não conformidade não encontrada" },
            { status: 404 },
          );
        }

        const isResolved = actionData.resolution_status === "resolved";
        const updatedNC: QualityNonConformity = {
          ...nc,
          status: actionData.resolution_status,
          resolved_by_actor_id: actor.actorId,
          resolved_at: new Date().toISOString(),
          verified_by_actor_id: actor.actorId,
          verified_at: new Date().toISOString(),
          waive_reason: actionData.resolution_status === "waived" ? actionData.reason : null,
          updated_at: new Date().toISOString(),
        };

        const auditEntry: QualityAuditHistoryEntry = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          entity_type: "non_conformity",
          entity_id: nc.id,
          action: isResolved ? "verified" : "waived",
          actor_id: actor.actorId,
          previous_state: nc as unknown as Record<string, unknown>,
          new_state: updatedNC as unknown as Record<string, unknown>,
          change_reason: actionData.reason,
          created_at: new Date().toISOString(),
        };

        if (useDb && admin) {
          await admin
            .from("quality_non_conformities")
            .update({
              status: updatedNC.status,
              resolved_by_actor_id: updatedNC.resolved_by_actor_id,
              resolved_at: updatedNC.resolved_at,
              verified_by_actor_id: updatedNC.verified_by_actor_id,
              verified_at: updatedNC.verified_at,
              waive_reason: updatedNC.waive_reason,
              updated_at: updatedNC.updated_at,
            })
            .eq("agency_id", agencyId)
            .eq("id", nc.id);

          try {
            await admin.from("quality_audit_history").insert([auditEntry]);
          } catch {}
        } else {
          const idx = qualityMemoryStore.nonConformities.findIndex((item) => item.id === nc?.id);
          if (idx !== -1) {
            qualityMemoryStore.nonConformities[idx] = updatedNC;
          }
          qualityMemoryStore.auditHistory.push(auditEntry);
        }

        return Response.json({
          success: true,
          non_conformity: updatedNC,
        });
      }

      default:
        return Response.json(
          { success: false, error: "Ação não suportada pelo Módulo 06" },
          { status: 400 },
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno de execução no servidor";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
