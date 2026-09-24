import { z } from "zod";
import {
  OPPORTUNITY_STAGES,
  PRIORITY_LEVELS,
  FOLLOW_UP_CADENCES,
  LOSS_REASON_CODES,
  type CommercialProposal,
  type FollowUpActivity,
  type SalesHandoff,
  type CommercialDiagnosis,
  type QualificationAssessment,
  type PrioritizationAssessment,
} from "./commercial-crm-domain.ts";

export type {
  OpportunityStage,
  PriorityLevel,
  QualificationResult,
  ProposalStatus,
  FollowUpCadence,
  LossReasonCode,
  HandoffStatus,
  CommercialMetrics,
  ForecastScenario,
} from "./commercial-crm-domain.ts";

// ==============================================================================
// Schemas de Empresa (ProspectCompany) e Contato (ProspectContact)
// ==============================================================================

export const ProspectCompanySchema = z.object({
  id: z.string(),
  agency_id: z.string(),
  name: z.string().min(1),
  trade_name: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state_uf: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  identity_key: z.string().min(1),
  maps_url: z.string().nullable().optional(),
  place_id: z.string().nullable().optional(),
  cid: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  review_count: z.number().int().nullable().optional(),
  observed_profile_quality: z
    .enum(["incomplete", "claimed", "unclaimed", "verified"])
    .default("incomplete"),
  units_count: z.number().int().min(1).default(1),
  notes: z.string().default(""),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProspectCompany = z.infer<typeof ProspectCompanySchema>;

export const ProspectContactSchema = z.object({
  id: z.string(),
  agency_id: z.string(),
  company_id: z.string(),
  name: z.string().min(1),
  role_title: z.string().default(""),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  is_decision_maker: z.boolean().default(false),
  is_primary: z.boolean().default(false),
  notes: z.string().default(""),
  created_at: z.string(),
});
export type ProspectContact = z.infer<typeof ProspectContactSchema>;

// ==============================================================================
// Schema de Oportunidade Comercial (CommercialOpportunity)
// ==============================================================================

export const CommercialOpportunitySchema = z.object({
  id: z.string(),
  agency_id: z.string(),
  company_id: z.string(),
  title: z.string().min(1),
  stage: z.enum(OPPORTUNITY_STAGES),
  priority: z.enum(PRIORITY_LEVELS).default("media_prioridade"),
  origin: z
    .enum(["prospecting", "inbound", "referral", "outbound_manual", "local_audit"])
    .default("prospecting"),
  product_definition_id: z.string().nullable().optional(),
  product_version: z.number().int().min(1).default(1),
  responsible_actor_id: z.string().min(1),
  responsible_name: z.string().min(1),
  last_activity_at: z.string(),
  next_action: z.string().min(1),
  next_action_deadline: z.string(),
  estimated_setup_value: z.number().nullable().optional(),
  estimated_mrr_value: z.number().nullable().optional(),
  blocking_reason: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
  loss_reason_code: z.enum(LOSS_REASON_CODES).nullable().optional(),
  loss_reason_details: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CommercialOpportunity = z.infer<typeof CommercialOpportunitySchema>;

// Workspace completo retornado para visualização 360 da oportunidade
export interface OpportunityWorkspaceData {
  opportunity: CommercialOpportunity;
  company: ProspectCompany;
  contacts: ProspectContact[];
  prioritization: PrioritizationAssessment | null;
  qualification: QualificationAssessment | null;
  diagnosis: CommercialDiagnosis | null;
  proposals: CommercialProposal[];
  activities: FollowUpActivity[];
  handoff: SalesHandoff | null;
}

// ==============================================================================
// Schemas de Requisição da API Server-Side
// ==============================================================================

export const commercialCrmRequestSchema = z.discriminatedUnion("action", [
  // 1. Listar Empresas
  z.object({
    action: z.literal("list_companies"),
    segment: z.string().optional(),
    city: z.string().optional(),
    search: z.string().optional(),
  }),

  // 2. Obter Empresa por ID
  z.object({
    action: z.literal("get_company"),
    company_id: z.string().min(1),
  }),

  // 3. Criar ou Atualizar Empresa
  z.object({
    action: z.literal("create_or_update_company"),
    company: z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      trade_name: z.string().optional(),
      segment: z.string().optional(),
      city: z.string().optional(),
      state_uf: z.string().optional(),
      website: z.string().optional(),
      phone: z.string().optional(),
      identity_key: z.string().optional(),
      maps_url: z.string().optional(),
      place_id: z.string().optional(),
      cid: z.string().optional(),
      rating: z.number().optional(),
      review_count: z.number().optional(),
      observed_profile_quality: z.enum(["incomplete", "claimed", "unclaimed", "verified"]).optional(),
      units_count: z.number().int().optional(),
      notes: z.string().optional(),
    }),
  }),

  // 4. Listar Oportunidades
  z.object({
    action: z.literal("list_opportunities"),
    stage: z.enum(OPPORTUNITY_STAGES).optional(),
    priority: z.enum(PRIORITY_LEVELS).optional(),
    responsible_actor_id: z.string().optional(),
    search: z.string().optional(),
  }),

  // 5. Obter Workspace da Oportunidade
  z.object({
    action: z.literal("get_opportunity_workspace"),
    opportunity_id: z.string().min(1),
  }),

  // 6. Criar Oportunidade
  z.object({
    action: z.literal("create_opportunity"),
    company_id: z.string().min(1),
    title: z.string().min(1),
    origin: z.enum(["prospecting", "inbound", "referral", "outbound_manual", "local_audit"]).optional().default("prospecting"),
    product_definition_id: z.string().optional(),
    product_version: z.number().int().min(1).optional().default(1),
    responsible_actor_id: z.string().min(1),
    responsible_name: z.string().min(1),
    next_action: z.string().min(1),
    next_action_deadline: z.string().min(1),
    priority: z.enum(PRIORITY_LEVELS).optional().default("media_prioridade"),
  }),

  // 7. Atualizar Estágio da Oportunidade
  z.object({
    action: z.literal("update_opportunity_stage"),
    opportunity_id: z.string().min(1),
    target_stage: z.enum(OPPORTUNITY_STAGES),
    next_action: z.string().min(1),
    next_action_deadline: z.string().min(1),
    responsible_actor_id: z.string().optional(),
    loss_reason_code: z.enum(LOSS_REASON_CODES).optional(),
    loss_reason_details: z.string().optional(),
    blocking_reason: z.string().optional(),
  }),

  // 8. Salvar Priorização
  z.object({
    action: z.literal("save_prioritization"),
    opportunity_id: z.string().min(1),
    input: z.object({
      segment: z.string().nullish(),
      city: z.string().nullish(),
      units_count: z.number().int().nullish(),
      rating: z.number().nullish(),
      review_count: z.number().int().nullish(),
      has_website: z.boolean().nullish(),
      has_phone: z.boolean().nullish(),
      has_whatsapp: z.boolean().nullish(),
      observed_profile_quality: z.enum(["incomplete", "claimed", "unclaimed", "verified"]).nullish(),
      investment_signals: z.boolean().nullish(),
      visible_problems: z.array(z.string()).optional(),
      improvement_potential: z.array(z.string()).optional(),
    }),
  }),

  // 9. Salvar Qualificação
  z.object({
    action: z.literal("save_qualification"),
    opportunity_id: z.string().min(1),
    dimensions: z.object({
      fit: z.enum(["high", "medium", "low", "unclear"]),
      problem: z.enum(["confirmed_severe", "moderate", "superficial", "none"]),
      impact: z.enum(["high_financial", "medium", "low", "unknown"]),
      priority: z.enum(["immediate", "this_quarter", "exploratory", "none"]),
      decision: z.enum(["direct_owner", "influencer_present", "gatekeeper_only", "unknown"]),
      investment_capacity: z.enum(["healthy_budget", "limited_budget", "insufficient", "unverified"]),
      expectation: z.enum(["realistic", "high_demanding", "unrealistic_guarantees", "unclear"]),
      cooperation: z.enum(["collaborative", "neutral", "resistant", "unknown"]),
    }),
    evidences: z.array(z.string()).default([]),
    hypotheses: z.array(z.string()).default([]),
    gaps: z.array(z.string()).default([]),
  }),

  // 10. Salvar Diagnóstico Comercial (11 passos)
  z.object({
    action: z.literal("save_diagnosis"),
    opportunity_id: z.string().min(1),
    step_answers: z.object({
      context: z.string().default(""),
      current_situation: z.string().default(""),
      problem: z.string().default(""),
      impact: z.string().default(""),
      history: z.string().default(""),
      objective: z.string().default(""),
      diagnosis: z.string().default(""),
      gap: z.string().default(""),
      relevant_solution: z.string().default(""),
      investment: z.string().default(""),
      decision_next_steps: z.string().default(""),
    }),
    evidences: z.array(z.string()).default([]),
    expectations: z.string().default(""),
    red_flags: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
    decision: z.string().default(""),
    next_steps: z.string().default(""),
  }),

  // 11. Salvar ou Atualizar Proposta
  z.object({
    action: z.literal("upsert_proposal"),
    opportunity_id: z.string().min(1),
    proposal_id: z.string().optional(),
    product_definition_id: z.string().min(1),
    product_version: z.number().int().min(1).default(1),
    setup_price: z.number().min(0),
    monthly_price: z.number().min(0),
    discount_setup_percentage: z.number().min(0).max(100).default(0),
    discount_monthly_percentage: z.number().min(0).max(100).default(0),
    discount_justification: z.string().nullish(),
    discount_counterpart: z.string().nullish(),
    selected_scope_items: z.array(z.string()).default([]),
    scope_adjustments: z.array(z.string()).default([]),
    payment_terms: z.string().default(""),
    valid_until: z.string().min(1),
    dependencies: z.array(z.string()).default([]),
    expectations: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
  }),

  // 12. Enviar Proposta (torna imutável e avança estágio)
  z.object({
    action: z.literal("send_proposal"),
    opportunity_id: z.string().min(1),
    proposal_id: z.string().min(1),
  }),

  // 13. Criar Nova Versão de Proposta (v+1)
  z.object({
    action: z.literal("create_proposal_version"),
    opportunity_id: z.string().min(1),
    base_proposal_id: z.string().min(1),
  }),

  // 14. Criar ou Atualizar Atividade / Follow-up
  z.object({
    action: z.literal("upsert_activity"),
    opportunity_id: z.string().min(1),
    activity_id: z.string().optional(),
    cadence: z.enum(FOLLOW_UP_CADENCES),
    title: z.string().min(1),
    objective: z.string().min(1),
    deadline: z.string().min(1),
    notes: z.string().default(""),
    actor_id: z.string().min(1),
  }),

  // 15. Concluir Atividade
  z.object({
    action: z.literal("complete_activity"),
    activity_id: z.string().min(1),
    notes: z.string().default(""),
  }),

  // 16. Salvar Handoff de Vendas
  z.object({
    action: z.literal("save_handoff"),
    opportunity_id: z.string().min(1),
    proposal_id: z.string().min(1),
    checklist: z.object({
      company_data_confirmed: z.boolean().default(false),
      key_contacts_identified: z.boolean().default(false),
      core_problem_documented: z.boolean().default(false),
      objective_metrics_aligned: z.boolean().default(false),
      product_version_locked: z.boolean().default(false),
      scope_items_confirmed: z.boolean().default(false),
      setup_timeline_agreed: z.boolean().default(false),
      recurring_schedule_agreed: z.boolean().default(false),
      pricing_and_terms_communicated: z.boolean().default(false),
      promises_documented: z.boolean().default(false),
      client_expectations_realistic: z.boolean().default(false),
      operational_risks_identified: z.boolean().default(false),
      dependencies_mapped: z.boolean().default(false),
      no_unilateral_pricing: z.boolean().default(false),
    }),
    promises_made: z.string().default(""),
    client_expectations: z.string().default(""),
    operational_risks: z.string().default(""),
    critical_dependencies: z.string().default(""),
    missing_data: z.string().default(""),
  }),

  // 17. Submeter Handoff para Revisão Operacional
  z.object({
    action: z.literal("submit_handoff_review"),
    opportunity_id: z.string().min(1),
    handoff_id: z.string().min(1),
  }),

  // 18. Avaliar Handoff (Operação aprova, pede ajuste ou bloqueia)
  z.object({
    action: z.literal("review_handoff"),
    handoff_id: z.string().min(1),
    decision: z.enum(["approved_for_onboarding", "changes_requested", "blocked"]),
    operations_notes: z.string().default(""),
  }),

  // 19. Métricas e Previsão Comercial (Forecast)
  z.object({
    action: z.literal("get_metrics_and_forecast"),
  }),
]);

export type CommercialCrmRequest = z.infer<typeof commercialCrmRequestSchema>;
export type CommercialCrmRequestInput = z.input<typeof commercialCrmRequestSchema>;

// ==============================================================================
// Cliente Tipado para Invocação da API
// ==============================================================================

export async function callCommercialCrmApi<T = unknown>(
  payload: CommercialCrmRequestInput,
  token?: string | null
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("/api/commercial", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        error: json?.error || `Falha na requisição (${res.status})`,
        status: res.status,
      };
    }

    return {
      ok: true,
      data: json as T,
      status: res.status,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro de rede ao conectar à Central Comercial.";
    return {
      ok: false,
      error: errorMsg,
      status: 500,
    };
  }
}
