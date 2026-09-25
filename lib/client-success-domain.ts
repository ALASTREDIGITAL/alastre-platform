/**
 * Módulo 07: Sucesso do Cliente (Customer Success Domain)
 * Regras de negócio para Health Score explicável, Scorecards de Valor, Reuniões e Decisões,
 * Risco de Churn e Recuperação, Renovação e Expansão, e Cancelamento e Offboarding.
 *
 * Isolamento rigoroso por agency_id e client_id.
 */

export type HealthScoreStatus =
  | "excellent"
  | "good"
  | "attention"
  | "critical"
  | "insufficient_data";

export type DataCoverageStatus = "complete" | "partial" | "insufficient";

export type PrimaryCauseType =
  | "alastre_delivery_failure"
  | "channel_limitation"
  | "client_dependency_failure"
  | "insufficient_data"
  | "none";

export interface PillarScore {
  score: number | null; // 0-100 ou null se dados insuficientes
  weight: number;
  data_available: boolean;
  notes?: string;
}

export interface CauseBreakdown {
  alastre_issues_count: number;
  channel_limitations_count: number;
  client_dependencies_count: number;
  insufficient_data_fields: string[];
}

export interface ClientHealthScoreInput {
  client_id: string;
  agency_id: string;
  operational_delivery?: PillarScore | null;
  quality_compliance?: PillarScore | null;
  client_cooperation?: PillarScore | null;
  perceived_value?: PillarScore | null;
  indicator_evolution?: PillarScore | null;
  churn_risk_factor?: PillarScore | null;
  active_scope?: PillarScore | null;
  cause_breakdown?: CauseBreakdown | null;
}

export interface ClientHealthScoreResult {
  client_id: string;
  agency_id: string;
  overall_score: number;
  status: HealthScoreStatus;
  coverage_pct: number;
  data_status: DataCoverageStatus;
  operational_delivery_score: number | null;
  quality_compliance_score: number | null;
  client_cooperation_score: number | null;
  perceived_value_score: number | null;
  indicator_evolution_score: number | null;
  churn_risk_factor_score: number | null;
  active_scope_score: number | null;
  primary_cause: PrimaryCauseType;
  cause_breakdown: CauseBreakdown;
  calculated_at: string;
}

export interface ScorecardRecommendation {
  id: string;
  title: string;
  rationale: string;
  service_id?: string | null;
  type: "improvement" | "expansion" | "process_adjustment";
}

export interface ClientScorecard {
  id: string;
  agency_id: string;
  client_id: string;
  period_label: string;
  health_score_snapshot: number;
  completed_deliveries_count: number;
  verified_evidences_count: number;
  observed_indicators: Record<string, unknown>;
  collection_limitations: string[];
  improvements_implemented: string[];
  client_pendencies: string[];
  next_steps: string[];
  recommendations: ScorecardRecommendation[];
  disclaimer_no_guarantee: string;
  created_at: string;
}

export type DecisionStatus = "proposed" | "approved" | "converted_to_task" | "completed";

export interface ClientMeetingDecision {
  id: string;
  agency_id: string;
  meeting_id: string;
  client_id: string;
  decision: string;
  responsible_actor_id: string;
  deadline?: string | null;
  status: DecisionStatus;
  work_item_id?: string | null;
  created_at: string;
}

export interface ClientMeeting {
  id: string;
  agency_id: string;
  client_id: string;
  service_id?: string | null;
  meeting_date: string;
  objective: string;
  participants: string[];
  analyzed_data_summary?: string | null;
  risks_identified: string[];
  next_steps: string[];
  decisions: ClientMeetingDecision[];
  created_at: string;
}

export type ChurnRiskSeverity = "low" | "medium" | "high" | "critical";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface ChurnSignal {
  id: string;
  signal_type: "nps_drop" | "unresponsive_client" | "sla_breach" | "non_conformity" | "scope_reduction_request" | "other";
  severity: ChurnRiskSeverity;
  description: string;
  detected_at: string;
  evidence_reference?: string | null;
}

export interface ChurnRiskAssessment {
  id: string;
  agency_id: string;
  client_id: string;
  risk_severity: ChurnRiskSeverity;
  confidence_level: ConfidenceLevel;
  data_coverage_pct: number;
  reason_summary: string;
  signals: ChurnSignal[];
  recovery_plan_summary?: string | null;
  recovery_work_item_ids: string[];
  assessed_at: string;
}

export type ExpansionType =
  | "renewal"
  | "scope_review"
  | "expansion_unit"
  | "expansion_service"
  | "upsell"
  | "downsell";

export type HumanApprovalStatus = "pending" | "approved" | "rejected";

export interface ExpansionRecommendation {
  id: string;
  agency_id: string;
  client_id: string;
  type: ExpansionType;
  target_service_name?: string | null;
  demonstrated_fit_rationale: string;
  evidenced_value_rationale: string;
  operational_impact_assessment: string;
  human_approval_status: HumanApprovalStatus;
  commercial_opportunity_id?: string | null;
  commercial_proposal_id?: string | null;
  approved_by_actor_id?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export type CancellationStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "rejected"
  | "offboarding_in_progress"
  | "completed";

export interface CancellationRequest {
  id: string;
  agency_id: string;
  client_id: string;
  request_date: string;
  primary_motive: string;
  detailed_reason?: string | null;
  status: CancellationStatus;
  transition_plan?: string | null;
  approved_by_actor_id?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface AccessRevocationItem {
  id: string;
  service_name: string;
  account_identifier: string;
  status: "pending_revocation" | "task_created" | "revoked_manually";
  assigned_actor_id?: string | null;
  notes?: string | null;
}

export type DataExportStatus = "not_requested" | "pending" | "ready" | "exported" | "failed";
export type FinalClientStatus = "offboarding_in_progress" | "archived" | "retained_history";

export interface OffboardingInventory {
  id: string;
  agency_id: string;
  cancellation_request_id: string;
  client_id: string;
  access_items: AccessRevocationItem[];
  offboarding_work_item_ids: string[];
  data_export_status: DataExportStatus;
  data_export_reference?: string | null;
  retention_policy_note: string;
  final_client_status: FinalClientStatus;
  created_at: string;
}

export const NO_RANKING_PROMISE_DISCLAIMER =
  "Resultados influenciados por múltiplos fatores externos. Não há promessa de ranking, leads, conversões ou vendas.";

/**
 * Calcula o Health Score decomposto do cliente com cobertura de dados e segregação de causas.
 */
export function calculateClientHealthScore(
  input: ClientHealthScoreInput
): ClientHealthScoreResult {
  const pillars = [
    { name: "operational_delivery", val: input.operational_delivery },
    { name: "quality_compliance", val: input.quality_compliance },
    { name: "client_cooperation", val: input.client_cooperation },
    { name: "perceived_value", val: input.perceived_value },
    { name: "indicator_evolution", val: input.indicator_evolution },
    { name: "churn_risk_factor", val: input.churn_risk_factor },
    { name: "active_scope", val: input.active_scope },
  ];

  let availablePillarsCount = 0;
  let totalScoreWeighted = 0;
  let totalWeight = 0;
  const insufficientFields: string[] = [];

  for (const p of pillars) {
    if (p.val && p.val.data_available && typeof p.val.score === "number") {
      availablePillarsCount++;
      const w = p.val.weight || 1;
      totalScoreWeighted += p.val.score * w;
      totalWeight += w;
    } else {
      insufficientFields.push(p.name);
    }
  }

  const coverage_pct = Math.round((availablePillarsCount / pillars.length) * 100);

  let data_status: DataCoverageStatus = "insufficient";
  if (coverage_pct >= 80) {
    data_status = "complete";
  } else if (coverage_pct >= 30) {
    data_status = "partial";
  }

  let overall_score = 0;
  let status: HealthScoreStatus = "insufficient_data";

  if (data_status !== "insufficient" && totalWeight > 0) {
    overall_score = Math.round(totalScoreWeighted / totalWeight);
    if (overall_score >= 85) {
      status = "excellent";
    } else if (overall_score >= 70) {
      status = "good";
    } else if (overall_score >= 50) {
      status = "attention";
    } else {
      status = "critical";
    }
  }

  const cb: CauseBreakdown = input.cause_breakdown ?? {
    alastre_issues_count: 0,
    channel_limitations_count: 0,
    client_dependencies_count: 0,
    insufficient_data_fields: insufficientFields,
  };
  cb.insufficient_data_fields = insufficientFields;

  // Determinar causa primária se score for baixo ou dados insuficientes
  let primary_cause: PrimaryCauseType = "none";
  if (data_status === "insufficient") {
    primary_cause = "insufficient_data";
  } else if (overall_score < 70) {
    if (cb.client_dependencies_count > cb.alastre_issues_count && cb.client_dependencies_count > cb.channel_limitations_count) {
      primary_cause = "client_dependency_failure";
    } else if (cb.channel_limitations_count > cb.alastre_issues_count) {
      primary_cause = "channel_limitation";
    } else if (cb.alastre_issues_count > 0) {
      primary_cause = "alastre_delivery_failure";
    } else {
      primary_cause = "client_dependency_failure";
    }
  }

  return {
    client_id: input.client_id,
    agency_id: input.agency_id,
    overall_score,
    status,
    coverage_pct,
    data_status,
    operational_delivery_score: input.operational_delivery?.data_available ? (input.operational_delivery.score ?? null) : null,
    quality_compliance_score: input.quality_compliance?.data_available ? (input.quality_compliance.score ?? null) : null,
    client_cooperation_score: input.client_cooperation?.data_available ? (input.client_cooperation.score ?? null) : null,
    perceived_value_score: input.perceived_value?.data_available ? (input.perceived_value.score ?? null) : null,
    indicator_evolution_score: input.indicator_evolution?.data_available ? (input.indicator_evolution.score ?? null) : null,
    churn_risk_factor_score: input.churn_risk_factor?.data_available ? (input.churn_risk_factor.score ?? null) : null,
    active_scope_score: input.active_scope?.data_available ? (input.active_scope.score ?? null) : null,
    primary_cause,
    cause_breakdown: cb,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Constrói um Scorecard de Valor padronizado.
 */
export function buildClientScorecard(params: {
  agency_id: string;
  client_id: string;
  period_label: string;
  health_score_snapshot: number;
  completed_deliveries_count: number;
  verified_evidences_count: number;
  observed_indicators?: Record<string, unknown>;
  collection_limitations?: string[];
  improvements_implemented?: string[];
  client_pendencies?: string[];
  next_steps?: string[];
  recommendations?: ScorecardRecommendation[];
}): ClientScorecard {
  return {
    id: crypto.randomUUID(),
    agency_id: params.agency_id,
    client_id: params.client_id,
    period_label: params.period_label,
    health_score_snapshot: params.health_score_snapshot,
    completed_deliveries_count: params.completed_deliveries_count,
    verified_evidences_count: params.verified_evidences_count,
    observed_indicators: params.observed_indicators ?? {},
    collection_limitations: params.collection_limitations ?? [],
    improvements_implemented: params.improvements_implemented ?? [],
    client_pendencies: params.client_pendencies ?? [],
    next_steps: params.next_steps ?? [],
    recommendations: params.recommendations ?? [],
    disclaimer_no_guarantee: NO_RANKING_PROMISE_DISCLAIMER,
    created_at: new Date().toISOString(),
  };
}

/**
 * Valida os requisitos para recomendar Expansão ou Renovação.
 */
export function validateExpansionRecommendation(rec: {
  type: ExpansionType;
  demonstrated_fit_rationale: string;
  evidenced_value_rationale: string;
  operational_impact_assessment: string;
}): { valid: boolean; reason?: string } {
  if (!rec.demonstrated_fit_rationale || rec.demonstrated_fit_rationale.trim().length < 10) {
    return { valid: false, reason: "Recomendação exige justificativa de fit demonstrado." };
  }
  if (!rec.evidenced_value_rationale || rec.evidenced_value_rationale.trim().length < 10) {
    return { valid: false, reason: "Recomendação exige valor ou necessidade evidenciada." };
  }
  if (!rec.operational_impact_assessment || rec.operational_impact_assessment.trim().length < 10) {
    return { valid: false, reason: "Recomendação exige avaliação de impacto operacional." };
  }
  return { valid: true };
}
