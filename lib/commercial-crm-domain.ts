/**
 * Módulo 02: Comercial e CRM - Domínio e Contratos
 *
 * Princípios mandatórios:
 * - Não criar um segundo mecanismo de prospecção.
 * - Reutilizar identidade, deduplicação, DNC, leases, tentativas e auditoria existentes.
 * - Empresa, contato, oportunidade e cliente são entidades diferentes.
 * - Uma empresa prospectada não se torna cliente automaticamente.
 * - Fit, intenção e oportunidade são dimensões diferentes.
 * - Nenhuma oportunidade pode ficar sem responsável, próxima ação e prazo.
 * - Nenhuma venda pode iniciar onboarding sem handoff aprovado.
 * - Nenhum preço ou escopo pode ser criado fora de uma definição aprovada da Fábrica de Produtos.
 * - Preservar isolamento por agency_id.
 */

// ==============================================================================
// 1. Estados da Oportunidade e Transições de Pipeline (Entrega 02.1)
// ==============================================================================

export const OPPORTUNITY_STAGES = [
  "new",
  "researched",
  "prioritized",
  "contact_ready",
  "contacted",
  "responded",
  "qualified",
  "diagnosis_scheduled",
  "diagnosis_completed",
  "proposal_prepared",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
  "nurture",
  "disqualified",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const ALLOWED_OPPORTUNITY_TRANSITIONS: Record<OpportunityStage, readonly OpportunityStage[]> = {
  new: ["researched", "disqualified"],
  researched: ["prioritized", "disqualified"],
  prioritized: ["contact_ready", "nurture", "disqualified"],
  contact_ready: ["contacted", "nurture", "disqualified"],
  contacted: ["responded", "nurture", "closed_lost", "disqualified"],
  responded: ["qualified", "nurture", "closed_lost", "disqualified"],
  qualified: ["diagnosis_scheduled", "proposal_prepared", "nurture", "closed_lost", "disqualified"],
  diagnosis_scheduled: ["diagnosis_completed", "nurture", "closed_lost"],
  diagnosis_completed: ["proposal_prepared", "nurture", "closed_lost"],
  proposal_prepared: ["proposal_sent", "nurture", "closed_lost"],
  proposal_sent: ["negotiation", "closed_won", "closed_lost", "nurture"],
  negotiation: ["closed_won", "closed_lost", "nurture", "proposal_prepared"],
  closed_won: ["nurture"],
  closed_lost: ["nurture", "researched"],
  nurture: ["contact_ready", "qualified", "closed_lost", "disqualified"],
  disqualified: ["researched"],
} as const;

export function canTransitionOpportunity(
  currentStage: OpportunityStage,
  targetStage: OpportunityStage
): boolean {
  if (currentStage === targetStage) return true;
  const allowed = ALLOWED_OPPORTUNITY_TRANSITIONS[currentStage];
  return allowed ? allowed.includes(targetStage) : false;
}

export function assertValidOpportunityTransition(
  currentStage: OpportunityStage,
  targetStage: OpportunityStage
): void {
  if (!canTransitionOpportunity(currentStage, targetStage)) {
    throw new Error(
      `Transição de estágio inválida: não é permitido avançar de '${currentStage}' diretamente para '${targetStage}'.`
    );
  }
}

// ==============================================================================
// 2. Priorização (Entrega 02.2)
// ==============================================================================

export const PRIORITY_LEVELS = [
  "alta_prioridade",
  "media_prioridade",
  "baixa_prioridade",
  "descartar",
] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export interface DimensionScore {
  score: number; // 0 a 100
  factors: string[];
  gaps: string[];
  hypotheses: string[];
}

export interface PrioritizationAssessment {
  id: string;
  agency_id: string;
  opportunity_id: string;
  fit: DimensionScore;
  intent: DimensionScore;
  opportunity: DimensionScore;
  priority: PriorityLevel;
  explanation: string;
  assessed_by_actor_id: string;
  assessed_at: string;
}

export interface PrioritizationInput {
  segment?: string | null;
  city?: string | null;
  units_count?: number | null;
  rating?: number | null;
  review_count?: number | null;
  has_website?: boolean | null;
  has_phone?: boolean | null;
  has_whatsapp?: boolean | null;
  observed_profile_quality?: "incomplete" | "claimed" | "unclaimed" | "verified" | null;
  investment_signals?: boolean | null;
  visible_problems?: string[];
  improvement_potential?: string[];
}

/**
 * Calcula a priorização observável sem inventar dados ausentes.
 * Ausência de dado vira gap/hipótese, nunca evidência negativa definitiva.
 */
export function calculatePrioritization(input: PrioritizationInput): {
  fit: DimensionScore;
  intent: DimensionScore;
  opportunity: DimensionScore;
  priority: PriorityLevel;
  explanation: string;
} {
  // 1. FIT (adequação estrutural)
  const fitFactors: string[] = [];
  const fitGaps: string[] = [];
  const fitHypotheses: string[] = [];
  let fitScore = 50;

  if (input.segment && input.segment.trim().length > 0) {
    fitFactors.push(`Segmento identificado: ${input.segment.trim()}`);
    fitScore += 15;
  } else {
    fitGaps.push("Segmento de atuação não detalhado");
  }

  if (input.city && input.city.trim().length > 0) {
    fitFactors.push(`Localização confirmada: ${input.city.trim()}`);
    fitScore += 15;
  } else {
    fitGaps.push("Cidade/Localização não especificada");
  }

  if (input.units_count !== null && input.units_count !== undefined) {
    if (input.units_count > 1) {
      fitFactors.push(`Negócio multi-unidade (${input.units_count} unidades)`);
      fitScore += 20;
    } else {
      fitFactors.push("Unidade única");
    }
  } else {
    fitHypotheses.push("Suposição de unidade única por falta de dado de expansão");
  }

  fitScore = Math.min(100, Math.max(0, fitScore));

  // 2. INTENT (sinais de interesse ou urgência)
  const intentFactors: string[] = [];
  const intentGaps: string[] = [];
  const intentHypotheses: string[] = [];
  let intentScore = 40;

  if (input.investment_signals === true) {
    intentFactors.push("Sinais observados de investimento recente em presença digital");
    intentScore += 35;
  } else if (input.investment_signals === false) {
    intentFactors.push("Sem sinais evidentes de investimento ativo");
  } else {
    intentGaps.push("Sinais de investimento não apurados");
  }

  if (input.has_whatsapp === true) {
    intentFactors.push("Canal de atendimento direto (WhatsApp) ativo");
    intentScore += 25;
  } else if (input.has_whatsapp === null || input.has_whatsapp === undefined) {
    intentHypotheses.push("Presença de WhatsApp não verificada");
  }

  intentScore = Math.min(100, Math.max(0, intentScore));

  // 3. OPPORTUNITY (problema demonstrável que conseguimos resolver)
  const oppFactors: string[] = [];
  const oppGaps: string[] = [];
  const oppHypotheses: string[] = [];
  let oppScore = 40;

  if (input.has_website === false) {
    oppFactors.push("Ausência de website próprio para capturar buscas orgânicas");
    oppScore += 20;
  } else if (input.has_website === null || input.has_website === undefined) {
    oppGaps.push("Website não verificado");
  }

  if (input.rating !== null && input.rating !== undefined) {
    if (input.rating < 4.4) {
      oppFactors.push(`Avaliação média (${input.rating.toFixed(1)}) abaixo do padrão ideal de mercado`);
      oppScore += 25;
    } else {
      oppFactors.push(`Boa avaliação observada (${input.rating.toFixed(1)})`);
    }
  } else {
    oppHypotheses.push("Nota média não disponível publicamente na coleta");
  }

  if (input.review_count !== null && input.review_count !== undefined) {
    if (input.review_count < 15) {
      oppFactors.push(`Volume baixo de avaliações (${input.review_count}), fácil superação com processo ativo`);
      oppScore += 20;
    } else {
      oppFactors.push(`Volume consolidado de avaliações (${input.review_count})`);
    }
  } else {
    oppGaps.push("Contagem de avaliações não encontrada");
  }

  if (input.observed_profile_quality === "incomplete" || input.observed_profile_quality === "unclaimed") {
    oppFactors.push("Perfil de negócios com lacunas evidentes ou incompleto");
    oppScore += 15;
  }

  if (input.visible_problems && input.visible_problems.length > 0) {
    oppFactors.push(`Problemas visíveis catalogados: ${input.visible_problems.join(", ")}`);
    oppScore += 10;
  }

  oppScore = Math.min(100, Math.max(0, oppScore));

  // Matriz de Decisão Observável de Prioridade
  const combinedScore = (fitScore * 0.35) + (intentScore * 0.25) + (oppScore * 0.40);
  let priority: PriorityLevel;

  if (fitScore < 30) {
    priority = "descartar";
  } else if (combinedScore >= 70) {
    priority = "alta_prioridade";
  } else if (combinedScore >= 45) {
    priority = "media_prioridade";
  } else {
    priority = "baixa_prioridade";
  }

  const explanation = `Priorização calculada: Fit ${fitScore.toFixed(0)}%, Intenção ${intentScore.toFixed(0)}%, Oportunidade ${oppScore.toFixed(0)}%. Classificação: ${priority}.`;

  return {
    fit: { score: fitScore, factors: fitFactors, gaps: fitGaps, hypotheses: fitHypotheses },
    intent: { score: intentScore, factors: intentFactors, gaps: intentGaps, hypotheses: intentHypotheses },
    opportunity: { score: oppScore, factors: oppFactors, gaps: oppGaps, hypotheses: oppHypotheses },
    priority,
    explanation,
  };
}

// ==============================================================================
// 3. Qualificação Comercial (Entrega 02.3)
// ==============================================================================

export const QUALIFICATION_RESULTS = [
  "qualified",
  "nurture",
  "no_fit",
  "high_risk",
] as const;

export type QualificationResult = (typeof QUALIFICATION_RESULTS)[number];

export interface QualificationDimensions {
  fit: "high" | "medium" | "low" | "unclear";
  problem: "confirmed_severe" | "moderate" | "superficial" | "none";
  impact: "high_financial" | "medium" | "low" | "unknown";
  priority: "immediate" | "this_quarter" | "exploratory" | "none";
  decision: "direct_owner" | "influencer_present" | "gatekeeper_only" | "unknown";
  investment_capacity: "healthy_budget" | "limited_budget" | "insufficient" | "unverified";
  expectation: "realistic" | "high_demanding" | "unrealistic_guarantees" | "unclear";
  cooperation: "collaborative" | "neutral" | "resistant" | "unknown";
}

export interface QualificationAssessment {
  id: string;
  agency_id: string;
  opportunity_id: string;
  dimensions: QualificationDimensions;
  result: QualificationResult;
  evidences: string[];
  hypotheses: string[];
  gaps: string[];
  responsible_actor_id: string;
  evaluated_at: string;
  explanation: string;
}

export function evaluateQualification(
  dimensions: QualificationDimensions,
  _evidences: string[],
  _hypotheses: string[],
  _gaps: string[],
  _responsible_actor_id: string
): {
  result: QualificationResult;
  explanation: string;
} {
  // Salvaguardas críticas de risco
  if (dimensions.expectation === "unrealistic_guarantees") {
    return {
      result: "high_risk",
      explanation: "Expectativa irreal de garantia de posicionamento externo ou faturamento sem base operacional.",
    };
  }

  if (dimensions.investment_capacity === "insufficient" || dimensions.fit === "low") {
    return {
      result: "no_fit",
      explanation: "Capacidade de investimento incompatível ou modelo de negócio sem aderência à entrega do serviço.",
    };
  }

  if (
    dimensions.fit === "high" &&
    (dimensions.problem === "confirmed_severe" || dimensions.problem === "moderate") &&
    (dimensions.decision === "direct_owner" || dimensions.decision === "influencer_present") &&
    (dimensions.investment_capacity === "healthy_budget" || dimensions.investment_capacity === "limited_budget") &&
    dimensions.cooperation !== "resistant"
  ) {
    return {
      result: "qualified",
      explanation: "Fit comprovado, problema demonstrável alinhado, decisor acessível e orçamento viável.",
    };
  }

  if (
    dimensions.priority === "exploratory" ||
    dimensions.priority === "this_quarter" ||
    dimensions.decision === "gatekeeper_only" ||
    dimensions.investment_capacity === "unverified"
  ) {
    return {
      result: "nurture",
      explanation: "Momento ainda exploratório ou decisor ainda não acessado diretamente. Manter em nutrição de relacionamento.",
    };
  }

  return {
    result: "nurture",
    explanation: "Critérios pendentes de confirmação antes de avançar para diagnóstico formal.",
  };
}

// ==============================================================================
// 4. Diagnóstico Comercial (Entrega 02.5)
// ==============================================================================

export interface CommercialDiagnosisStepAnswers {
  context: string;            // 1. Contexto e momento da empresa
  current_situation: string;  // 2. Como atrai e atende clientes hoje
  problem: string;            // 3. Principal dor / sintoma percebido
  impact: string;             // 4. Impacto financeiro ou operacional da dor
  history: string;            // 5. O que já tentou e histórico
  objective: string;          // 6. Meta nos próximos 3 a 6 meses
  diagnosis: string;          // 7. Gargalo diagnosticado pelo consultor comercial
  gap: string;                // 8. O que falta para fechar a distância
  relevant_solution: string;  // 9. Solução da fábrica recomendada (ex: SEO Local)
  investment: string;         // 10. Faixa de investimento aceitável
  decision_next_steps: string;// 11. Decisão do cliente e próximo passo acordado
}

export interface CommercialDiagnosis {
  id: string;
  agency_id: string;
  opportunity_id: string;
  step_answers: CommercialDiagnosisStepAnswers;
  evidences: string[];
  expectations: string;
  red_flags: string[];
  risks: string[];
  decision: string;
  next_steps: string;
  conducted_by_actor_id: string;
  conducted_at: string;
}

export function validateDiagnosisCompleteness(answers: Partial<CommercialDiagnosisStepAnswers>): {
  complete: boolean;
  missingSteps: string[];
} {
  const steps: (keyof CommercialDiagnosisStepAnswers)[] = [
    "context",
    "current_situation",
    "problem",
    "impact",
    "history",
    "objective",
    "diagnosis",
    "gap",
    "relevant_solution",
    "investment",
    "decision_next_steps",
  ];

  const missingSteps = steps.filter(
    (step) => !answers[step] || answers[step]!.trim().length === 0
  );

  return {
    complete: missingSteps.length === 0,
    missingSteps,
  };
}

// ==============================================================================
// 5. Propostas Comerciais e Imutabilidade (Entrega 02.6)
// ==============================================================================

export const PROPOSAL_STATUSES = [
  "draft",
  "internal_review",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "superseded",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface ProposalVersion {
  version: number;
  setup_price: number;
  monthly_price: number;
  discount_setup_percentage: number;
  discount_monthly_percentage: number;
  discount_justification?: string | null;
  discount_counterpart?: string | null;
  selected_scope_items: string[];
  scope_adjustments: string[];
  payment_terms: string;
  valid_until: string;
  is_immutable: boolean;
  status: ProposalStatus;
  created_at: string;
}

export interface CommercialProposal {
  id: string;
  agency_id: string;
  opportunity_id: string;
  product_definition_id: string;
  product_version: number;
  version: number;
  status: ProposalStatus;
  is_immutable: boolean;
  setup_price: number;
  monthly_price: number;
  discount_setup_percentage: number;
  discount_monthly_percentage: number;
  discount_justification: string | null;
  discount_counterpart: string | null;
  scope_adjustments: string[];
  selected_scope_items: string[];
  payment_terms: string;
  valid_until: string;
  dependencies: string[];
  expectations: string[];
  risks: string[];
  sent_at: string | null;
  decided_at: string | null;
  created_by_actor_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Validação de desconto comercial:
 * Nenhum desconto > 0 pode ser concedido sem justificativa e contrapartida documentadas.
 */
export function validateProposalDiscount(proposal: {
  discount_setup_percentage: number;
  discount_monthly_percentage: number;
  discount_justification?: string | null;
  discount_counterpart?: string | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const hasDiscount =
    proposal.discount_setup_percentage > 0 || proposal.discount_monthly_percentage > 0;

  if (hasDiscount) {
    if (!proposal.discount_justification || proposal.discount_justification.trim().length < 10) {
      errors.push("Desconto exige justificativa comercial clara com no mínimo 10 caracteres.");
    }
    if (!proposal.discount_counterpart || proposal.discount_counterpart.trim().length < 5) {
      errors.push("Desconto exige contrapartida explícita do cliente (ex: fidelidade contratual ampliada, pagamento antecipado, redução de escopo).");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verifica se a proposta é editável ou se tornou imutável.
 */
export function isProposalEditable(status: ProposalStatus, is_immutable: boolean): boolean {
  if (is_immutable) return false;
  return status === "draft" || status === "internal_review";
}

// ==============================================================================
// 6. Follow-up e Motivos de Perda (Entrega 02.7)
// ==============================================================================

export const FOLLOW_UP_CADENCES = [
  "first_contact",
  "post_diagnosis",
  "post_proposal",
  "unresponsive_lead",
  "not_now",
  "lost_proposal",
  "nurture",
  "custom",
] as const;

export type FollowUpCadence = (typeof FOLLOW_UP_CADENCES)[number];

export interface FollowUpActivity {
  id: string;
  agency_id: string;
  opportunity_id: string;
  cadence: FollowUpCadence;
  title: string;
  objective: string;
  status: "pending" | "completed" | "cancelled";
  deadline: string;
  completed_at: string | null;
  actor_id: string;
  notes: string;
  created_at: string;
}

export const LOSS_REASON_CODES = [
  "sem_orcamento",
  "sem_prioridade",
  "sem_fit",
  "concorrente",
  "preco",
  "expectativa_incompativel",
  "sem_decisor",
  "adiado",
  "solucao_interna",
  "nao_respondeu",
  "produto_inadequado",
] as const;

export type LossReasonCode = (typeof LOSS_REASON_CODES)[number];

export const LOSS_REASON_LABELS: Record<LossReasonCode, string> = {
  sem_orcamento: "Sem orçamento disponível",
  sem_prioridade: "Sem prioridade no momento",
  sem_fit: "Sem aderência operacional (No fit)",
  concorrente: "Optou por concorrente",
  preco: "Preço elevado (requer explicação detalhada)",
  expectativa_incompativel: "Expectativa desalinhada do escopo da agência",
  sem_decisor: "Não conseguimos contato com o tomador de decisão",
  adiado: "Projeto adiado para período futuro",
  solucao_interna: "Optou por executar internamente",
  nao_respondeu: "Lead sem resposta após cadência completa",
  produto_inadequado: "Necessidade técnica fora do portfólio de produtos",
};

/**
 * Validação mandatória de motivo de perda.
 * "Preço" JAMAIS pode ser registrado sem justificativa detalhada.
 */
export function validateLossReason(
  code: LossReasonCode,
  details?: string | null
): { valid: boolean; error?: string } {
  if (code === "preco") {
    if (!details || details.trim().length < 10) {
      return {
        valid: false,
        error: "O motivo 'Preço' não pode ser registrado isoladamente. Detalhe a faixa comparada, restrição informada ou objeção exata do cliente (mínimo 10 caracteres).",
      };
    }
  }
  return { valid: true };
}

// ==============================================================================
// 7. Handoff de Vendas para Onboarding (Entrega 02.8)
// ==============================================================================

export const HANDOFF_STATUSES = [
  "draft",
  "commercial_review",
  "operations_review",
  "approved_for_onboarding",
  "changes_requested",
  "blocked",
] as const;

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export interface SalesHandoffChecklist {
  company_data_confirmed: boolean;
  key_contacts_identified: boolean;
  core_problem_documented: boolean;
  objective_metrics_aligned: boolean;
  product_version_locked: boolean;
  scope_items_confirmed: boolean;
  setup_timeline_agreed: boolean;
  recurring_schedule_agreed: boolean;
  pricing_and_terms_communicated: boolean;
  promises_documented: boolean;
  client_expectations_realistic: boolean;
  operational_risks_identified: boolean;
  dependencies_mapped: boolean;
  no_unilateral_pricing: boolean;
}

export interface SalesHandoff {
  id: string;
  agency_id: string;
  opportunity_id: string;
  company_id: string;
  proposal_id: string;
  status: HandoffStatus;
  checklist: SalesHandoffChecklist;
  promises_made: string;
  client_expectations: string;
  operational_risks: string;
  critical_dependencies: string;
  missing_data: string;
  operations_reviewer_actor_id: string | null;
  operations_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Verifica se o handoff atende a todos os critérios antes de submeter para operações.
 */
export function validateHandoffChecklist(checklist: Partial<SalesHandoffChecklist>): {
  ready: boolean;
  missingItems: (keyof SalesHandoffChecklist)[];
} {
  const requiredKeys: (keyof SalesHandoffChecklist)[] = [
    "company_data_confirmed",
    "key_contacts_identified",
    "core_problem_documented",
    "objective_metrics_aligned",
    "product_version_locked",
    "scope_items_confirmed",
    "setup_timeline_agreed",
    "recurring_schedule_agreed",
    "pricing_and_terms_communicated",
    "promises_documented",
    "client_expectations_realistic",
    "operational_risks_identified",
    "dependencies_mapped",
    "no_unilateral_pricing",
  ];

  const missingItems = requiredKeys.filter((key) => checklist[key] !== true);

  return {
    ready: missingItems.length === 0,
    missingItems,
  };
}

// ==============================================================================
// 8. Métricas e Previsão Comercial / Forecast (Entrega 02.9)
// ==============================================================================

export interface CommercialMetrics {
  status: "ok" | "insufficient_data";
  message?: string;
  total_prospected: number;
  total_opportunities: number;
  total_qualified: number;
  total_diagnoses: number;
  total_proposals: number;
  total_closed_won: number;
  total_closed_lost: number;
  total_setup_revenue: number;
  total_new_mrr: number;
  stage_conversion_rates?: Record<string, number>;
  average_days_in_stage?: Record<string, number>;
  loss_reasons_breakdown?: Record<string, number>;
}

export function calculateCommercialMetrics(
  opportunities: {
    stage: OpportunityStage;
    created_at: string;
    closed_at?: string | null;
    estimated_setup_value?: number | null;
    estimated_mrr_value?: number | null;
    loss_reason_code?: LossReasonCode | null;
  }[],
  prospectedCompaniesCount: number
): CommercialMetrics {
  // Volume mínimo para cálculos de taxas seguras: pelo menos 5 oportunidades fechadas
  const closedCount = opportunities.filter(
    (o) => o.stage === "closed_won" || o.stage === "closed_lost"
  ).length;

  const totalOpportunities = opportunities.length;
  const wonOpps = opportunities.filter((o) => o.stage === "closed_won");
  const lostOpps = opportunities.filter((o) => o.stage === "closed_lost");

  const totalSetupRevenue = wonOpps.reduce((acc, curr) => acc + (curr.estimated_setup_value || 0), 0);
  const totalNewMrr = wonOpps.reduce((acc, curr) => acc + (curr.estimated_mrr_value || 0), 0);

  const qualifiedCount = opportunities.filter((o) =>
    ["qualified", "diagnosis_scheduled", "diagnosis_completed", "proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(o.stage)
  ).length;

  const diagnosesCount = opportunities.filter((o) =>
    ["diagnosis_completed", "proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(o.stage)
  ).length;

  const proposalsCount = opportunities.filter((o) =>
    ["proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(o.stage)
  ).length;

  // Breakdown de motivos de perda
  const lossReasonsBreakdown: Record<string, number> = {};
  for (const lost of lostOpps) {
    if (lost.loss_reason_code) {
      lossReasonsBreakdown[lost.loss_reason_code] =
        (lossReasonsBreakdown[lost.loss_reason_code] || 0) + 1;
    }
  }

  if (totalOpportunities < 3 || closedCount < 2) {
    return {
      status: "insufficient_data",
      message: "Dados insuficientes para exibição de taxas estatísticas e tempo médio confiáveis.",
      total_prospected: prospectedCompaniesCount,
      total_opportunities: totalOpportunities,
      total_qualified: qualifiedCount,
      total_diagnoses: diagnosesCount,
      total_proposals: proposalsCount,
      total_closed_won: wonOpps.length,
      total_closed_lost: lostOpps.length,
      total_setup_revenue: totalSetupRevenue,
      total_new_mrr: totalNewMrr,
      loss_reasons_breakdown: lossReasonsBreakdown,
    };
  }

  // Taxas calculadas
  const stageConversionRates: Record<string, number> = {
    prospect_to_opportunity: prospectedCompaniesCount > 0 ? (totalOpportunities / prospectedCompaniesCount) * 100 : 0,
    opportunity_to_qualified: totalOpportunities > 0 ? (qualifiedCount / totalOpportunities) * 100 : 0,
    qualified_to_proposal: qualifiedCount > 0 ? (proposalsCount / qualifiedCount) * 100 : 0,
    proposal_to_win: proposalsCount > 0 ? (wonOpps.length / proposalsCount) * 100 : 0,
    win_rate: closedCount > 0 ? (wonOpps.length / closedCount) * 100 : 0,
  };

  return {
    status: "ok",
    total_prospected: prospectedCompaniesCount,
    total_opportunities: totalOpportunities,
    total_qualified: qualifiedCount,
    total_diagnoses: diagnosesCount,
    total_proposals: proposalsCount,
    total_closed_won: wonOpps.length,
    total_closed_lost: lostOpps.length,
    total_setup_revenue: totalSetupRevenue,
    total_new_mrr: totalNewMrr,
    stage_conversion_rates: stageConversionRates,
    loss_reasons_breakdown: lossReasonsBreakdown,
  };
}

export interface ForecastScenario {
  name: "conservative" | "base" | "aggressive";
  label: string;
  assumptions: string[];
  projected_closed_won_count: number;
  projected_setup_revenue: number;
  projected_new_mrr: number;
}

export function generateForecast(
  openOpportunities: {
    stage: OpportunityStage;
    priority: PriorityLevel;
    estimated_setup_value?: number | null;
    estimated_mrr_value?: number | null;
  }[]
): {
  scenarios: ForecastScenario[];
  generated_at: string;
} {
  // Separa oportunidades com potencial real
  const high = openOpportunities.filter((o) => o.priority === "alta_prioridade");
  const medium = openOpportunities.filter((o) => o.priority === "media_prioridade");

  const avgSetup =
    openOpportunities.reduce((acc, o) => acc + (o.estimated_setup_value || 0), 0) /
      Math.max(1, openOpportunities.filter((o) => (o.estimated_setup_value || 0) > 0).length) || 1500;

  const avgMrr =
    openOpportunities.reduce((acc, o) => acc + (o.estimated_mrr_value || 0), 0) /
      Math.max(1, openOpportunities.filter((o) => (o.estimated_mrr_value || 0) > 0).length) || 1200;

  // Cenário Conservador: 30% das altas prioridades
  const consCount = Math.floor(high.length * 0.3);
  const consSetup = consCount * avgSetup;
  const consMrr = consCount * avgMrr;

  // Cenário Base: 60% das altas prioridades + 25% das médias
  const baseCount = Math.floor(high.length * 0.6 + medium.length * 0.25);
  const baseSetup = baseCount * avgSetup;
  const baseMrr = baseCount * avgMrr;

  // Cenário Agressivo: 85% das altas prioridades + 50% das médias
  const aggCount = Math.floor(high.length * 0.85 + medium.length * 0.5);
  const aggSetup = aggCount * avgSetup;
  const aggMrr = aggCount * avgMrr;

  return {
    generated_at: new Date().toISOString(),
    scenarios: [
      {
        name: "conservative",
        label: "Conservador",
        assumptions: [
          "Conversão de apenas 30% das oportunidades de alta prioridade",
          "Nenhuma conversão de oportunidades de média prioridade",
          `Ticket médio de implantação: R$ ${avgSetup.toFixed(2)} e MRR: R$ ${avgMrr.toFixed(2)}`,
        ],
        projected_closed_won_count: consCount,
        projected_setup_revenue: consSetup,
        projected_new_mrr: consMrr,
      },
      {
        name: "base",
        label: "Cenário Base (Mais Provável)",
        assumptions: [
          "Conversão de 60% das oportunidades de alta prioridade",
          "Conversão de 25% das oportunidades de média prioridade",
          `Ticket médio de implantação: R$ ${avgSetup.toFixed(2)} e MRR: R$ ${avgMrr.toFixed(2)}`,
        ],
        projected_closed_won_count: baseCount,
        projected_setup_revenue: baseSetup,
        projected_new_mrr: baseMrr,
      },
      {
        name: "aggressive",
        label: "Agressivo (Teto Operacional)",
        assumptions: [
          "Conversão de 85% das oportunidades de alta prioridade",
          "Conversão de 50% das oportunidades de média prioridade",
          "Follow-up estrito sem atrasos em cadência",
        ],
        projected_closed_won_count: aggCount,
        projected_setup_revenue: aggSetup,
        projected_new_mrr: aggMrr,
      },
    ],
  };
}

// ==============================================================================
// 9. Salvaguardas Mandatórias da Oportunidade
// ==============================================================================

export interface OpportunityValidationInput {
  title: string;
  responsible_actor_id: string;
  next_action: string;
  next_action_deadline: string;
  stage: OpportunityStage;
  estimated_setup_value?: number | null;
  estimated_mrr_value?: number | null;
  has_proposal?: boolean;
}

/**
 * Nenhuma oportunidade pode ficar sem responsável, próxima ação e prazo.
 * Valor estimado só pode existir quando houver proposta preparada.
 */
export function validateOpportunityIntegrity(input: OpportunityValidationInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length === 0) {
    errors.push("Título da oportunidade é obrigatório.");
  }

  if (!input.responsible_actor_id || input.responsible_actor_id.trim().length === 0) {
    errors.push("Responsável da oportunidade é obrigatório.");
  }

  if (!input.next_action || input.next_action.trim().length === 0) {
    errors.push("Próxima ação é obrigatória em todas as etapas da oportunidade.");
  }

  if (!input.next_action_deadline || input.next_action_deadline.trim().length === 0) {
    errors.push("Prazo da próxima ação é obrigatório.");
  } else {
    const deadlineDate = new Date(input.next_action_deadline);
    if (isNaN(deadlineDate.getTime())) {
      errors.push("Prazo da próxima ação deve ser uma data válida.");
    }
  }

  // Salvaguarda: valor estimado somente quando existir proposta
  const hasValue =
    (input.estimated_setup_value !== null && input.estimated_setup_value !== undefined && input.estimated_setup_value > 0) ||
    (input.estimated_mrr_value !== null && input.estimated_mrr_value !== undefined && input.estimated_mrr_value > 0);

  if (hasValue && !input.has_proposal && !["proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(input.stage)) {
    errors.push("Valores financeiros estimados só podem ser vinculados após a elaboração de proposta formal.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detecta oportunidades paradas (stale) que necessitam de atenção imediata.
 */
export function detectStaleOpportunities<T extends {
  id: string;
  next_action_deadline: string;
  last_activity_at: string;
  stage: OpportunityStage;
}>(opportunities: T[], thresholdDays: number = 7): {
  staleCount: number;
  staleOpportunities: (T & { reason: string })[];
} {
  const now = new Date().getTime();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  const staleList: (T & { reason: string })[] = [];

  for (const opp of opportunities) {
    if (opp.stage === "closed_won" || opp.stage === "closed_lost" || opp.stage === "disqualified") {
      continue;
    }

    const deadlineTime = new Date(opp.next_action_deadline).getTime();
    const lastActivityTime = new Date(opp.last_activity_at).getTime();

    if (!isNaN(deadlineTime) && deadlineTime < now) {
      staleList.push({
        ...opp,
        reason: "Prazo da próxima ação está vencido.",
      });
    } else if (!isNaN(lastActivityTime) && now - lastActivityTime > thresholdMs) {
      staleList.push({
        ...opp,
        reason: `Sem nenhuma atividade nos últimos ${thresholdDays} dias.`,
      });
    }
  }

  return {
    staleCount: staleList.length,
    staleOpportunities: staleList,
  };
}
