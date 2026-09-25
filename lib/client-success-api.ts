import { z } from "zod";
import {
  calculateClientHealthScore,
  buildClientScorecard,
  validateExpansionRecommendation,
  NO_RANKING_PROMISE_DISCLAIMER,
  type ClientHealthScoreResult,
  type ClientScorecard,
  type ClientMeeting,
  type ClientMeetingDecision,
  type ChurnRiskAssessment,
  type ExpansionRecommendation,
  type CancellationRequest,
  type OffboardingInventory,
  type ChurnSignal,
  type AccessRevocationItem,
  type ScorecardRecommendation,
} from "./client-success-domain.ts";
import { operationsMemoryStore } from "../app/api/operations/route.ts";

/**
 * Zod Schemas para Ações da API de Sucesso do Cliente
 */

export const PillarScoreSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  weight: z.number().default(1),
  data_available: z.boolean().default(true),
  notes: z.string().optional(),
});

export const CauseBreakdownSchema = z.object({
  alastre_issues_count: z.number().default(0),
  channel_limitations_count: z.number().default(0),
  client_dependencies_count: z.number().default(0),
  insufficient_data_fields: z.array(z.string()).default([]),
});

export const CalculateHealthSchema = z.object({
  action: z.literal("calculate_health"),
  client_id: z.string().uuid("ID do cliente inválido"),
  operational_delivery: PillarScoreSchema.optional().nullable(),
  quality_compliance: PillarScoreSchema.optional().nullable(),
  client_cooperation: PillarScoreSchema.optional().nullable(),
  perceived_value: PillarScoreSchema.optional().nullable(),
  indicator_evolution: PillarScoreSchema.optional().nullable(),
  churn_risk_factor: PillarScoreSchema.optional().nullable(),
  active_scope: PillarScoreSchema.optional().nullable(),
  cause_breakdown: CauseBreakdownSchema.optional().nullable(),
});

export const CreateScorecardSchema = z.object({
  action: z.literal("create_scorecard"),
  client_id: z.string().uuid("ID do cliente inválido"),
  period_label: z.string().min(2, "Rótulo de período obrigatório"),
  health_score_snapshot: z.number().min(0).max(100),
  completed_deliveries_count: z.number().min(0).default(0),
  verified_evidences_count: z.number().min(0).default(0),
  observed_indicators: z.record(z.unknown()).default({}),
  collection_limitations: z.array(z.string()).default([]),
  improvements_implemented: z.array(z.string()).default([]),
  client_pendencies: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  recommendations: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      rationale: z.string(),
      service_id: z.string().optional().nullable(),
      type: z.enum(["improvement", "expansion", "process_adjustment"]),
    })
  ).default([]),
});

export const CreateMeetingSchema = z.object({
  action: z.literal("create_meeting"),
  client_id: z.string().uuid("ID do cliente inválido"),
  service_id: z.string().uuid().optional().nullable(),
  meeting_date: z.string().default(() => new Date().toISOString()),
  objective: z.string().min(5, "Objetivo é obrigatório"),
  participants: z.array(z.string()).min(1, "Ao menos um participante é obrigatório"),
  analyzed_data_summary: z.string().optional().nullable(),
  risks_identified: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
});

export const CreateMeetingDecisionSchema = z.object({
  action: z.literal("create_meeting_decision"),
  meeting_id: z.string().uuid("ID da reunião inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  decision: z.string().min(5, "Decisão é obrigatória"),
  responsible_actor_id: z.string().min(1, "Responsável é obrigatório"),
  deadline: z.string().optional().nullable(),
});

export const ConvertDecisionToWorkItemSchema = z.object({
  action: z.literal("convert_decision_to_work_item"),
  decision_id: z.string().uuid("ID da decisão inválido"),
  meeting_id: z.string().uuid("ID da reunião inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  title: z.string().min(3, "Título da tarefa obrigatório"),
  description: z.string().optional(),
  assignee_id: z.string().min(1, "Atribuído é obrigatório"),
  due_date: z.string().optional().nullable(),
});

export const CreateChurnAssessmentSchema = z.object({
  action: z.literal("create_churn_assessment"),
  client_id: z.string().uuid("ID do cliente inválido"),
  risk_severity: z.enum(["low", "medium", "high", "critical"]),
  confidence_level: z.enum(["low", "medium", "high"]),
  data_coverage_pct: z.number().min(0).max(100),
  reason_summary: z.string().min(5, "Resumo do motivo é obrigatório"),
  signals: z.array(
    z.object({
      id: z.string(),
      signal_type: z.enum(["nps_drop", "unresponsive_client", "sla_breach", "non_conformity", "scope_reduction_request", "other"]),
      severity: z.enum(["low", "medium", "high", "critical"]),
      description: z.string(),
      detected_at: z.string(),
      evidence_reference: z.string().optional().nullable(),
    })
  ).default([]),
  recovery_plan_summary: z.string().optional().nullable(),
});

export const CreateRecoveryTaskSchema = z.object({
  action: z.literal("create_recovery_task"),
  assessment_id: z.string().uuid("ID da avaliação de churn inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  title: z.string().min(3, "Título da tarefa é obrigatório"),
  description: z.string().optional(),
  assignee_id: z.string().min(1, "Atribuído é obrigatório"),
  due_date: z.string().optional().nullable(),
});

export const CreateExpansionRecommendationSchema = z.object({
  action: z.literal("create_expansion_recommendation"),
  client_id: z.string().uuid("ID do cliente inválido"),
  type: z.enum(["renewal", "scope_review", "expansion_unit", "expansion_service", "upsell", "downsell"]),
  target_service_name: z.string().optional().nullable(),
  demonstrated_fit_rationale: z.string().min(10, "Justificativa de fit demonstrado obrigatória"),
  evidenced_value_rationale: z.string().min(10, "Justificativa de valor evidenciado obrigatória"),
  operational_impact_assessment: z.string().min(10, "Avaliação de impacto operacional obrigatória"),
  commercial_opportunity_id: z.string().uuid().optional().nullable(),
  commercial_proposal_id: z.string().uuid().optional().nullable(),
});

export const ApproveExpansionSchema = z.object({
  action: z.literal("approve_expansion"),
  recommendation_id: z.string().uuid("ID da recomendação inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  decision: z.enum(["approved", "rejected"]),
  actor_id: z.string().optional(),
});

export const CreateCancellationRequestSchema = z.object({
  action: z.literal("create_cancellation_request"),
  client_id: z.string().uuid("ID do cliente inválido"),
  primary_motive: z.string().min(5, "Motivo principal é obrigatório"),
  detailed_reason: z.string().optional().nullable(),
  transition_plan: z.string().optional().nullable(),
});

export const ApproveCancellationSchema = z.object({
  action: z.literal("approve_cancellation"),
  cancellation_id: z.string().uuid("ID da solicitação de cancelamento inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  decision: z.enum(["approved", "rejected"]),
  actor_id: z.string().optional(),
});

export const CreateOffboardingInventorySchema = z.object({
  action: z.literal("create_offboarding_inventory"),
  cancellation_request_id: z.string().uuid("ID do cancelamento inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  access_items: z.array(
    z.object({
      id: z.string(),
      service_name: z.string(),
      account_identifier: z.string(),
      status: z.enum(["pending_revocation", "task_created", "revoked_manually"]),
      assigned_actor_id: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ).default([]),
  retention_policy_note: z.string().default("Evidências e histórico de auditoria retidos conforme política legal/contratual. Nenhum dado de auditoria foi destruído."),
});

export const CreateOffboardingTaskSchema = z.object({
  action: z.literal("create_offboarding_task"),
  inventory_id: z.string().uuid("ID do inventário de offboarding inválido"),
  cancellation_request_id: z.string().uuid("ID do cancelamento inválido"),
  client_id: z.string().uuid("ID do cliente inválido"),
  title: z.string().min(3, "Título da tarefa é obrigatório"),
  description: z.string().optional(),
  assignee_id: z.string().min(1, "Atribuído é obrigatório"),
  due_date: z.string().optional().nullable(),
});

export const ClientSuccessActionSchema = z.discriminatedUnion("action", [
  CalculateHealthSchema,
  CreateScorecardSchema,
  CreateMeetingSchema,
  CreateMeetingDecisionSchema,
  ConvertDecisionToWorkItemSchema,
  CreateChurnAssessmentSchema,
  CreateRecoveryTaskSchema,
  CreateExpansionRecommendationSchema,
  ApproveExpansionSchema,
  CreateCancellationRequestSchema,
  ApproveCancellationSchema,
  CreateOffboardingInventorySchema,
  CreateOffboardingTaskSchema,
]);

/**
 * In-Memory Store para suporte offline / testes do Módulo 07
 */
class ClientSuccessMemoryStore {
  public healthScores: ClientHealthScoreResult[] = [];
  public scorecards: ClientScorecard[] = [];
  public meetings: ClientMeeting[] = [];
  public meetingDecisions: ClientMeetingDecision[] = [];
  public churnAssessments: ChurnRiskAssessment[] = [];
  public expansionRecommendations: ExpansionRecommendation[] = [];
  public cancellationRequests: CancellationRequest[] = [];
  public offboardingInventories: OffboardingInventory[] = [];

  public clear() {
    this.healthScores = [];
    this.scorecards = [];
    this.meetings = [];
    this.meetingDecisions = [];
    this.churnAssessments = [];
    this.expansionRecommendations = [];
    this.cancellationRequests = [];
    this.offboardingInventories = [];
  }
}

export const clientSuccessMemoryStore = new ClientSuccessMemoryStore();
