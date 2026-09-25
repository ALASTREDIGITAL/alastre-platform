/**
 * Módulo 06: Qualidade e Evidências (Quality and Evidence Domain)
 * Regras de negócio, estrutura de evidências canônicas, checklists versionados,
 * segregação de funções, não conformidades e histórico imutável.
 *
 * Isolamento rigoroso por agency_id e client_id.
 */

export type EvidenceType =
  | "before_after"
  | "screenshot"
  | "url"
  | "external_id"
  | "sanitized_payload"
  | "manual_confirmation"
  | "automated_validation"
  | "collection_limitation";

export type EvidenceOrigin = "manual" | "automated" | "provider" | "system";

export type VerificationStatus = "pending" | "verified" | "rejected" | "dispensed";

export type ChecklistCategory =
  | "local_seo"
  | "google_ads"
  | "meta_ads"
  | "tracking"
  | "onboarding"
  | "general";

export type RiskLevel = "low" | "normal" | "high" | "critical";

export type ReviewPolicy = "mandatory" | "sampled" | "optional";

export type ChecklistRunStatus =
  | "in_progress"
  | "pending_review"
  | "approved"
  | "rejected"
  | "waived";

export type CriterionCriticality = "low" | "medium" | "high" | "critical";

export type CriterionResultStatus = "pending" | "passed" | "failed" | "waived";

export type NonConformitySeverity = "low" | "medium" | "high" | "critical";

export type NonConformityStatus =
  | "open"
  | "in_analysis"
  | "action_created"
  | "reopened"
  | "resolved"
  | "waived";

export type QualityAuditAction =
  | "created"
  | "verified"
  | "rejected"
  | "modified"
  | "waived"
  | "locked"
  | "reopened";

export interface QualityEvidence {
  id: string;
  agency_id: string;
  work_item_id: string;
  client_id?: string | null;
  unit_id?: string | null;
  service_id?: string | null;
  delivery_item_type?: string | null;
  delivery_item_id?: string | null;
  evidence_type: EvidenceType;
  origin: EvidenceOrigin;
  verification_status: VerificationStatus;
  responsible_actor_id: string;
  verified_by_actor_id?: string | null;
  verified_at?: string | null;
  captured_at: string;
  verifiable_reference: string;
  before_reference?: string | null;
  after_reference?: string | null;
  sanitized_metadata: Record<string, unknown>;
  limitation_note?: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistCriterionTemplate {
  id: string;
  criterion: string;
  criticality: CriterionCriticality;
  is_mandatory: boolean;
  required_evidence_type?: EvidenceType | null;
  description?: string;
}

export interface QualityChecklistTemplate {
  id: string;
  agency_id: string;
  title: string;
  slug: string;
  category: ChecklistCategory;
  risk_level: RiskLevel;
  version: number;
  is_active: boolean;
  items: ChecklistCriterionTemplate[];
  created_at: string;
  updated_at: string;
}

export interface CriterionRunResult {
  id: string;
  criterion: string;
  criticality: CriterionCriticality;
  is_mandatory: boolean;
  required_evidence_type?: EvidenceType | null;
  evidence_id?: string | null;
  result: CriterionResultStatus;
  executed_by_actor_id?: string | null;
  reviewed_by_actor_id?: string | null;
  verified_by_actor_id?: string | null;
  waived_justification?: string | null;
  notes?: string | null;
}

export interface QualityChecklistRun {
  id: string;
  agency_id: string;
  work_item_id: string;
  client_id?: string | null;
  template_id?: string | null;
  checklist_version: number;
  risk_level: RiskLevel;
  review_policy: ReviewPolicy;
  status: ChecklistRunStatus;
  criteria_results: CriterionRunResult[];
  executed_by_actor_id?: string | null;
  reviewed_by_actor_id?: string | null;
  verified_by_actor_id?: string | null;
  verified_at?: string | null;
  waived_justification?: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityNonConformity {
  id: string;
  agency_id: string;
  client_id: string;
  work_item_id?: string | null;
  workflow_id?: string | null;
  evidence_id?: string | null;
  title: string;
  severity: NonConformitySeverity;
  status: NonConformityStatus;
  root_cause: string;
  impact: string;
  corrective_work_item_id?: string | null;
  opened_by_actor_id: string;
  assigned_actor_id?: string | null;
  resolved_by_actor_id?: string | null;
  resolved_at?: string | null;
  verified_by_actor_id?: string | null;
  verified_at?: string | null;
  waive_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityAuditHistoryEntry {
  id: string;
  agency_id: string;
  entity_type: "evidence" | "checklist_run" | "non_conformity";
  entity_id: string;
  action: QualityAuditAction;
  actor_id: string;
  previous_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  change_reason: string;
  created_at: string;
}

/**
 * Sanitização rigorosa de metadados e referências para prevenir vazamento de segredos,
 * tokens OAuth, senhas ou chaves de API.
 */
const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /access_token["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+/gi,
  /refresh_token["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+/gi,
  /client_secret["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+/gi,
  /api_key["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+/gi,
  /password["']?\s*[:=]\s*["']?[^"'\s,]+/gi,
  /secret["']?\s*[:=]\s*["']?[^"'\s,]+/gi,
];

export function sanitizeTextContent(text: string): string {
  if (!text) return text;
  let cleaned = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[SEGREDOS_REMOVIDOS]");
  }
  return cleaned;
}

export function sanitizeMetadataObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("key") ||
      lowerKey.includes("auth")
    ) {
      result[key] = "[REMOVIDO_POR_SEGURANCA]";
      continue;
    }

    if (typeof val === "string") {
      result[key] = sanitizeTextContent(val);
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      result[key] = sanitizeMetadataObject(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Determina a política de revisão com base no nível de risco e criticidade da atividade.
 */
export function determineReviewPolicy(riskLevel: RiskLevel): ReviewPolicy {
  switch (riskLevel) {
    case "critical":
    case "high":
      return "mandatory";
    case "normal":
      return "sampled";
    case "low":
    default:
      return "optional";
  }
}

/**
 * Valida a regra de segregação de funções.
 * Em tarefas de alto risco ou políticas com segregação exigida, o responsável pela execução
 * não pode aprovar ou verificar o próprio trabalho (impedimento de autoaprovação).
 */
export function validateSegregationOfDuties(
  executedByActorId: string,
  verifierActorId: string,
  riskLevel: RiskLevel,
  reviewPolicy: ReviewPolicy,
): { allowed: boolean; reason?: string } {
  if (!executedByActorId || !verifierActorId) {
    return { allowed: true };
  }

  const requiresSegregation =
    riskLevel === "critical" || riskLevel === "high" || reviewPolicy === "mandatory";

  if (requiresSegregation && executedByActorId === verifierActorId) {
    return {
      allowed: false,
      reason:
        "Segregação de funções obrigatória: o responsável pela preparação/execução não pode auto-aprovar ou verificar a atividade de alto risco.",
    };
  }

  return { allowed: true };
}

/**
 * Verifica se um work_item pode ser concluído operacionalmente.
 * Se houver alguma Não Conformidade CRÍTICA aberta ou em análise para o item, a conclusão é bloqueada.
 */
export function checkWorkItemCompletionBlock(
  workItemId: string,
  nonConformities: QualityNonConformity[],
): { blocked: boolean; blockingNonConformities: QualityNonConformity[] } {
  const activeCriticalNCs = nonConformities.filter(
    (nc) =>
      nc.work_item_id === workItemId &&
      nc.severity === "critical" &&
      ["open", "in_analysis", "action_created", "reopened"].includes(nc.status),
  );

  return {
    blocked: activeCriticalNCs.length > 0,
    blockingNonConformities: activeCriticalNCs,
  };
}

/**
 * Rótulos descritivos dos tipos de evidência para o Modo Simples
 */
export const evidenceTypeLabels: Record<EvidenceType, string> = {
  before_after: "Comparativo Antes / Depois",
  screenshot: "Captura de Tela (Print)",
  url: "Endereço da Web (URL)",
  external_id: "Identificador Externo",
  sanitized_payload: "Registro Técnico Sanitizado",
  manual_confirmation: "Confirmação Manual pelo Operador",
  automated_validation: "Validação Automática pelo Sistema",
  collection_limitation: "Limitação ou Indisponibilidade de Coleta",
};

/**
 * Rótulos descritivos de status para o Modo Simples
 */
export const verificationStatusLabels: Record<VerificationStatus, string> = {
  pending: "Aguardando Revisão",
  verified: "Verificado e Aprovado",
  rejected: "Rejeitado / Necessita Ajuste",
  dispensed: "Dispensa Formalizada",
};

/**
 * Rótulos descritivos de severidade de Não Conformidades
 */
export const ncSeverityLabels: Record<NonConformitySeverity, string> = {
  low: "Baixo Impacto",
  medium: "Médio Impacto",
  high: "Alto Risco Operacional",
  critical: "Crítico (Bloqueia Conclusão)",
};
