/**
 * Módulo 08: Capacidade e Financeiro (Capacity and Finance Domain)
 * Regras de negócio para premissas econômicas versionadas, consolidação de custos e tempo,
 * simulações de capacidade e gargalos, margens segregadas (contratado vs faturado vs recebido),
 * CAC/Payback/LTV sem dados sintéticos, e precificação e descontos protegidos.
 *
 * Isolamento rigoroso por agency_id e salvaguardas de decisão humana.
 */

export type DataOrigin =
  | "real_observed"
  | "reported_value"
  | "estimate"
  | "hypothesis"
  | "unavailable";

export type CostCategory =
  | "labor"
  | "software"
  | "ai"
  | "customer_service"
  | "sales"
  | "implementation"
  | "rework"
  | "other_operational";

export type OperationalRole =
  | "client"
  | "client_service"
  | "analyst"
  | "specialist"
  | "manager"
  | "automation_ai";

export type DataCoverageStatus = "complete" | "partial" | "insufficient_data";

export type QualityRiskLevel = "low" | "medium" | "high" | "critical";

export type DiscountType =
  | "scope_reduction"
  | "frequency_reduction"
  | "support_reduction"
  | "contractual_tradeoff"
  | "unjustified";

export type ApprovalStatus =
  | "draft"
  | "in_review"
  | "pending_human_approval"
  | "approved"
  | "rejected"
  | "superseded";

export const PROJECTION_DISCLAIMER =
  "Projeções econômicas e financeiras são simulações baseadas em premissas declaradas e rastreáveis, não constituindo garantia de receita, lucro ou desempenho financeiro futuro.";

export interface EconomicAssumption {
  id: string;
  agency_id: string;
  cost_type: CostCategory;
  value: number;
  currency: string;
  period: "hourly" | "daily" | "monthly" | "yearly" | "per_unit" | "per_ticket";
  origin: DataOrigin;
  evidence_reference?: string | null;
  hypothesis_description?: string | null;
  responsible_name: string;
  effective_date: string;
  version: number;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface CostRecord {
  id: string;
  agency_id: string;
  client_id?: string | null;
  unit_id?: string | null;
  service_id?: string | null;
  product_definition_id?: string | null;
  scope_item_id?: string | null;
  workflow_id?: string | null;
  work_item_id?: string | null;
  cost_category: CostCategory;
  operational_role?: OperationalRole | null;
  delivery_mode?: "implementation" | "recurring" | null;
  estimated_minutes: number;
  actual_minutes: number;
  estimated_cost: number;
  actual_cost: number;
  currency: string;
  origin: DataOrigin;
  assumption_id?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RoleCapacityInput {
  role: OperationalRole;
  available_monthly_hours_per_head: number;
  headcount: number;
  estimated_minutes_per_client: number;
  actual_minutes_per_client?: number | null;
  rework_minutes_per_client?: number | null;
  sla_fulfillment_pct?: number | null;
}

export interface CapacitySimulationResult {
  id: string;
  agency_id: string;
  scenario_clients_count: number;
  operational_role: OperationalRole;
  available_monthly_hours: number;
  planned_monthly_hours: number;
  actual_monthly_hours: number;
  rework_monthly_hours: number;
  sla_fulfillment_pct: number;
  occupancy_rate_pct: number;
  is_dominant_bottleneck: boolean;
  quality_risk_level: QualityRiskLevel;
  hiring_trigger_clients: number | null;
  data_coverage_status: DataCoverageStatus;
  missing_data_fields: string[];
  calculated_at: string;
}

export interface SegregatedMarginInput {
  agency_id: string;
  client_id?: string | null;
  product_definition_id?: string | null;
  proposal_id?: string | null;
  contracted_value: number; // Valor contratado em proposta/contrato
  invoiced_value?: number | null; // Valor faturado (nota emitida)
  received_value?: number | null; // Valor efetivamente recebido (caixa)
  estimated_cost: number;
  actual_cost?: number | null;
}

export interface SegregatedMarginResult {
  id: string;
  agency_id: string;
  client_id?: string | null;
  product_definition_id?: string | null;
  proposal_id?: string | null;
  contracted_value: number;
  invoiced_value: number;
  received_value: number;
  estimated_cost: number;
  actual_cost: number;
  estimated_margin_value: number;
  actual_margin_value: number;
  estimated_margin_pct: number;
  actual_margin_pct: number;
  hiring_break_even_clients: number | null;
  quality_degradation_risk: QualityRiskLevel;
  data_coverage_status: DataCoverageStatus;
  missing_data_fields: string[];
  analyzed_at: string;
}

export interface UnitEconomicsInput {
  sales_costs_period?: number | null;
  marketing_costs_period?: number | null;
  new_clients_acquired_period?: number | null;
  monthly_contribution_margin_per_client?: number | null;
  monthly_churn_rate_pct?: number | null;
  historical_retention_months?: number | null;
}

export interface UnitEconomicsResult {
  cac: number | null;
  payback_months: number | null;
  ltv: number | null;
  status: DataCoverageStatus;
  missing_data_fields: string[];
  explanation: string;
}

export interface PricingEvaluationInput {
  proposal_id: string;
  product_definition_id?: string | null;
  list_setup_price: number;
  list_monthly_price: number;
  proposed_setup_price: number;
  proposed_monthly_price: number;
  estimated_operational_cost: number;
  discount_applied_pct: number;
  discount_type?: DiscountType | null;
  discount_counterpart_description?: string | null;
  is_cost_estimated: boolean;
  is_counterpart_documented: boolean;
}

export interface PricingEvaluationResult {
  proposal_id: string;
  can_approve: boolean;
  requires_human_approval: boolean;
  approval_status: ApprovalStatus;
  blocking_reasons: string[];
  evaluated_margin_pct: number;
  justification_summary: string;
}

/**
 * Valida a origem de uma premissa econômica: se não houver evidência/referência,
 * a premissa deve ser classificada como hipótese ou estimativa, nunca como fato (real_observed/reported_value).
 */
export function sanitizeDataOrigin(
  origin: DataOrigin,
  evidenceReference?: string | null
): DataOrigin {
  const hasEvidence = typeof evidenceReference === "string" && evidenceReference.trim().length > 0;
  if (!hasEvidence && (origin === "real_observed" || origin === "reported_value")) {
    return "hypothesis";
  }
  return origin;
}

/**
 * Calcula a capacidade operacional e identifica o gargalo dominante para um cenário de clientes.
 */
export function calculateCapacityScenario(
  agencyId: string,
  scenarioClientsCount: number,
  roleInputs: RoleCapacityInput[]
): CapacitySimulationResult[] {
  if (!roleInputs || roleInputs.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        agency_id: agencyId,
        scenario_clients_count: scenarioClientsCount,
        operational_role: "analyst",
        available_monthly_hours: 0,
        planned_monthly_hours: 0,
        actual_monthly_hours: 0,
        rework_monthly_hours: 0,
        sla_fulfillment_pct: 0,
        occupancy_rate_pct: 0,
        is_dominant_bottleneck: false,
        quality_risk_level: "low",
        hiring_trigger_clients: null,
        data_coverage_status: "insufficient_data",
        missing_data_fields: ["role_inputs", "labor_assumptions"],
        calculated_at: new Date().toISOString(),
      },
    ];
  }

  // 1. Calcula totais de horas planejadas, disponíveis, realizadas e ocupação por função
  const rawSimulations = roleInputs.map((input) => {
    const headcount = Math.max(1, input.headcount);
    const availableHours = (input.available_monthly_hours_per_head || 160) * headcount;
    const plannedMinutes = (input.estimated_minutes_per_client || 0) * scenarioClientsCount;
    const plannedHours = Number((plannedMinutes / 60).toFixed(2));

    const actualMinutes = (input.actual_minutes_per_client ?? input.estimated_minutes_per_client) * scenarioClientsCount;
    const actualHours = Number((actualMinutes / 60).toFixed(2));

    const reworkMinutes = (input.rework_minutes_per_client || 0) * scenarioClientsCount;
    const reworkHours = Number((reworkMinutes / 60).toFixed(2));

    const occupancyRate = availableHours > 0 ? Number(((plannedHours / availableHours) * 100).toFixed(2)) : 0;
    const slaFulfillment = input.sla_fulfillment_pct ?? 100;

    // Determina risco de qualidade
    let qualityRiskLevel: QualityRiskLevel = "low";
    if (occupancyRate > 95 || reworkHours > availableHours * 0.25 || slaFulfillment < 75) {
      qualityRiskLevel = "critical";
    } else if (occupancyRate > 85 || reworkHours > availableHours * 0.15 || slaFulfillment < 85) {
      qualityRiskLevel = "high";
    } else if (occupancyRate > 75 || reworkHours > availableHours * 0.10) {
      qualityRiskLevel = "medium";
    }

    // Calcula o ponto de contratação (número de clientes em que a ocupação atinge >85%)
    let hiringTriggerClients: number | null = null;
    if (input.estimated_minutes_per_client > 0) {
      const maxClientsPerHead = Math.floor((availableHours * 60 * 0.85) / input.estimated_minutes_per_client);
      hiringTriggerClients = Math.max(1, maxClientsPerHead);
    }

    return {
      id: crypto.randomUUID(),
      agency_id: agencyId,
      scenario_clients_count: scenarioClientsCount,
      operational_role: input.role,
      available_monthly_hours: availableHours,
      planned_monthly_hours: plannedHours,
      actual_monthly_hours: actualHours,
      rework_monthly_hours: reworkHours,
      sla_fulfillment_pct: slaFulfillment,
      occupancy_rate_pct: occupancyRate,
      is_dominant_bottleneck: false,
      quality_risk_level: qualityRiskLevel,
      hiring_trigger_clients: hiringTriggerClients,
      data_coverage_status: "complete" as DataCoverageStatus,
      missing_data_fields: [] as string[],
      calculated_at: new Date().toISOString(),
    };
  });

  // 2. Identifica a função que representa o gargalo dominante (maior taxa de ocupação)
  let maxOccupancy = -1;
  let bottleneckIndex = -1;
  rawSimulations.forEach((sim, idx) => {
    if (sim.occupancy_rate_pct > maxOccupancy) {
      maxOccupancy = sim.occupancy_rate_pct;
      bottleneckIndex = idx;
    }
  });

  if (bottleneckIndex >= 0) {
    rawSimulations[bottleneckIndex].is_dominant_bottleneck = true;
  }

  return rawSimulations;
}

/**
 * Análise de margem com segregação mandatória de valor contratado, faturado e recebido.
 */
export function calculateSegregatedMargin(input: SegregatedMarginInput): SegregatedMarginResult {
  const missingFields: string[] = [];

  const contractedValue = input.contracted_value || 0;
  const invoicedValue = input.invoiced_value ?? 0;
  const receivedValue = input.received_value ?? 0;

  if (input.invoiced_value === undefined || input.invoiced_value === null) {
    missingFields.push("invoiced_value");
  }
  if (input.received_value === undefined || input.received_value === null) {
    missingFields.push("received_value");
  }
  if (input.actual_cost === undefined || input.actual_cost === null) {
    missingFields.push("actual_cost");
  }

  const estimatedCost = input.estimated_cost || 0;
  const actualCost = input.actual_cost ?? estimatedCost;

  const estimatedMarginValue = contractedValue - estimatedCost;
  const estimatedMarginPct = contractedValue > 0
    ? Number(((estimatedMarginValue / contractedValue) * 100).toFixed(2))
    : 0;

  const actualMarginValue = invoicedValue - actualCost;
  const actualMarginPct = invoicedValue > 0
    ? Number(((actualMarginValue / invoicedValue) * 100).toFixed(2))
    : 0;

  let qualityDegradationRisk: QualityRiskLevel = "low";
  if (estimatedMarginPct < 15 || (input.actual_cost && actualCost > estimatedCost * 1.3)) {
    qualityDegradationRisk = "critical";
  } else if (estimatedMarginPct < 25 || (input.actual_cost && actualCost > estimatedCost * 1.15)) {
    qualityDegradationRisk = "high";
  } else if (estimatedMarginPct < 35) {
    qualityDegradationRisk = "medium";
  }

  const coverageStatus: DataCoverageStatus =
    missingFields.length === 0 ? "complete" : missingFields.length <= 2 ? "partial" : "insufficient_data";

  return {
    id: crypto.randomUUID(),
    agency_id: input.agency_id,
    client_id: input.client_id || null,
    product_definition_id: input.product_definition_id || null,
    proposal_id: input.proposal_id || null,
    contracted_value: contractedValue,
    invoiced_value: invoicedValue,
    received_value: receivedValue,
    estimated_cost: estimatedCost,
    actual_cost: actualCost,
    estimated_margin_value: estimatedMarginValue,
    actual_margin_value: actualMarginValue,
    estimated_margin_pct: estimatedMarginPct,
    actual_margin_pct: actualMarginPct,
    hiring_break_even_clients: null,
    quality_degradation_risk: qualityDegradationRisk,
    data_coverage_status: coverageStatus,
    missing_data_fields: missingFields,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Calcula CAC, Payback e LTV com validação rigorosa de cobertura de dados.
 * NUNCA inventa ou estima métricas automaticamente se houver dados ausentes.
 */
export function calculateUnitEconomicsCACPaybackLTV(
  input: UnitEconomicsInput
): UnitEconomicsResult {
  const missingDataFields: string[] = [];

  const salesCosts = (input.sales_costs_period || 0) + (input.marketing_costs_period || 0);
  const newClients = input.new_clients_acquired_period;
  const monthlyMargin = input.monthly_contribution_margin_per_client;

  if (!input.sales_costs_period && !input.marketing_costs_period) {
    missingDataFields.push("custos_de_vendas_e_marketing");
  }
  if (!newClients || newClients <= 0) {
    missingDataFields.push("novos_clientes_adquiridos_no_periodo");
  }
  if (!monthlyMargin || monthlyMargin <= 0) {
    missingDataFields.push("margem_de_contribuicao_mensal_por_cliente");
  }

  const hasChurn = typeof input.monthly_churn_rate_pct === "number" && input.monthly_churn_rate_pct > 0;
  const hasRetention = typeof input.historical_retention_months === "number" && input.historical_retention_months > 0;

  if (!hasChurn && !hasRetention) {
    missingDataFields.push("historico_de_retencao_ou_taxa_de_churn");
  }

  if (missingDataFields.length > 0) {
    return {
      cac: null,
      payback_months: null,
      ltv: null,
      status: "insufficient_data",
      missing_data_fields: missingDataFields,
      explanation: `Dados insuficientes para cálculo confiável de métricas financeiras. Dados ausentes: ${missingDataFields.join(", ")}.`,
    };
  }

  const cac = Number((salesCosts / newClients!).toFixed(2));
  const paybackMonths = Number((cac / monthlyMargin!).toFixed(1));

  let lifetimeMonths = 12; // fallback de calculo interno apenas se retenção existe
  if (hasChurn) {
    lifetimeMonths = 100 / input.monthly_churn_rate_pct!;
  } else if (hasRetention) {
    lifetimeMonths = input.historical_retention_months!;
  }

  const ltv = Number((monthlyMargin! * lifetimeMonths).toFixed(2));

  return {
    cac,
    payback_months: paybackMonths,
    ltv,
    status: "complete",
    missing_data_fields: [],
    explanation: `Métricas unitárias calculadas com base em dados observados: CAC R$ ${cac.toLocaleString('pt-BR')}, Payback ${paybackMonths} meses e LTV R$ ${ltv.toLocaleString('pt-BR')}.`,
  };
}

/**
 * Valida a precificação e descontos protegidos de propostas comerciais.
 * Regras mandatórias:
 * 1. Preço não pode ser aprovado sem custo operacional estimado.
 * 2. Desconto exige contrapartida documentada ou redução de escopo/frequência/suporte.
 * 3. Nenhuma aprovação automática — decisões exigem aprovação humana.
 */
export function validatePricingProposal(
  input: PricingEvaluationInput
): PricingEvaluationResult {
  const blockingReasons: string[] = [];

  // Regra 1: Preço não pode ser aprovado sem custo operacional estimado
  if (!input.is_cost_estimated || input.estimated_operational_cost <= 0) {
    blockingReasons.push("Preço não pode ser aprovado sem custo operacional estimado.");
  }

  // Regra 2: Desconto exige contrapartida documentada ou redução de escopo, frequência ou atendimento
  if (input.discount_applied_pct > 0) {
    const isUnjustified = !input.discount_type || input.discount_type === "unjustified";
    if (!input.is_counterpart_documented || isUnjustified) {
      blockingReasons.push(
        "Desconto exige contrapartida documentada ou redução de escopo, frequência ou atendimento."
      );
    }
  }

  const totalProposedPrice = input.proposed_setup_price + input.proposed_monthly_price;
  const evaluatedMarginPct = totalProposedPrice > 0
    ? Number((((totalProposedPrice - input.estimated_operational_cost) / totalProposedPrice) * 100).toFixed(2))
    : 0;

  const canApprove = blockingReasons.length === 0;

  let justificationSummary = "Precificação em conformidade com as regras de viabilidade operacional e margem.";
  if (!canApprove) {
    justificationSummary = `Precificação bloqueada por não conformidade: ${blockingReasons.join(" ")}`;
  }

  return {
    proposal_id: input.proposal_id,
    can_approve: canApprove,
    requires_human_approval: true, // Toda aprovação sensível exige responsável humano
    approval_status: canApprove ? "pending_human_approval" : "rejected",
    blocking_reasons: blockingReasons,
    evaluated_margin_pct: evaluatedMarginPct,
    justification_summary: justificationSummary,
  };
}
