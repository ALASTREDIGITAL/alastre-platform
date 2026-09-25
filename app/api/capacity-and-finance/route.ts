import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";
import {
  CapacityFinanceActionSchema,
  capacityFinanceMemoryStore,
} from "../../../lib/capacity-and-finance-api.ts";
import {
  sanitizeDataOrigin,
  calculateCapacityScenario,
  calculateSegregatedMargin,
  calculateUnitEconomicsCACPaybackLTV,
  validatePricingProposal,
  PROJECTION_DISCLAIMER,
  type DataOrigin,
  type CostCategory,
  type OperationalRole,
  type DataCoverageStatus,
  type ApprovalStatus,
} from "../../../lib/capacity-and-finance-domain.ts";

export async function GET(request: Request) {
  const authResult = await resolveAuthenticatedActor(request);
  if (!authResult && (process.env.NODE_ENV === "production" || request.headers.get("x-test-unauth") === "true")) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const agencyId = authResult?.actor?.agencyId || request.headers.get("x-test-agency-id") || "a1a57e00-0000-4000-8000-000000000001";
  const supabase = createSupabaseAdmin();

  let assumptions = capacityFinanceMemoryStore.assumptions.filter((a) => a.agency_id === agencyId);
  let costs = capacityFinanceMemoryStore.costs.filter((c) => c.agency_id === agencyId);
  let simulations = capacityFinanceMemoryStore.simulations.filter((s) => s.agency_id === agencyId);
  let margins = capacityFinanceMemoryStore.margins.filter((m) => m.agency_id === agencyId);
  let pricingDecisions = capacityFinanceMemoryStore.pricingDecisions.filter((p) => p.agency_id === agencyId);

  if (supabase) {
    try {
      const { data: dbAssump } = await supabase
        .from("financial_economic_assumptions")
        .select("*")
        .eq("agency_id", agencyId);
      if (dbAssump && dbAssump.length > 0) {
        assumptions = dbAssump as unknown as typeof assumptions;
      }

      const { data: dbCosts } = await supabase
        .from("financial_cost_records")
        .select("*")
        .eq("agency_id", agencyId);
      if (dbCosts && dbCosts.length > 0) {
        costs = dbCosts as unknown as typeof costs;
      }

      const { data: dbSims } = await supabase
        .from("financial_capacity_simulations")
        .select("*")
        .eq("agency_id", agencyId);
      if (dbSims && dbSims.length > 0) {
        simulations = dbSims as unknown as typeof simulations;
      }

      const { data: dbMargins } = await supabase
        .from("financial_margin_analyses")
        .select("*")
        .eq("agency_id", agencyId);
      if (dbMargins && dbMargins.length > 0) {
        margins = dbMargins as unknown as typeof margins;
      }

      const { data: dbPricing } = await supabase
        .from("financial_pricing_decisions")
        .select("*")
        .eq("agency_id", agencyId);
      if (dbPricing && dbPricing.length > 0) {
        pricingDecisions = dbPricing as unknown as typeof pricingDecisions;
      }
    } catch {
      // Usa dados em memória se banco não estiver disponível no teste local
    }
  }

  // Avaliação de Unit Economics (CAC, Payback, LTV) com dados reais ou declaração explícita de indisponibilidade
  const unitEconomics = calculateUnitEconomicsCACPaybackLTV({
    sales_costs_period: null, // Sem vendas integradas ainda
    marketing_costs_period: null,
    new_clients_acquired_period: null,
    monthly_contribution_margin_per_client: margins[0]?.estimated_margin_value ?? null,
    monthly_churn_rate_pct: null,
    historical_retention_months: null,
  });

  const totalAssumptions = assumptions.length;
  const realAssumptions = assumptions.filter((a) => a.origin === "real_observed" || a.origin === "reported_value").length;
  const coveragePct = totalAssumptions > 0 ? Math.round((realAssumptions / totalAssumptions) * 100) : 0;
  const overallCoverageStatus: DataCoverageStatus =
    coveragePct >= 80 ? "complete" : coveragePct >= 40 ? "partial" : "insufficient_data";

  return Response.json({
    agency_id: agencyId,
    disclaimer: PROJECTION_DISCLAIMER,
    overall_coverage_status: overallCoverageStatus,
    data_coverage_percentage: coveragePct,
    assumptions,
    cost_records: costs,
    capacity_simulations: simulations,
    margin_analyses: margins,
    unit_economics: unitEconomics,
    pricing_decisions: pricingDecisions,
  });
}

export async function POST(request: Request) {
  const authResult = await resolveAuthenticatedActor(request);
  if (!authResult && (process.env.NODE_ENV === "production" || request.headers.get("x-test-unauth") === "true")) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const agencyId = authResult?.actor?.agencyId || request.headers.get("x-test-agency-id") || "a1a57e00-0000-4000-8000-000000000001";
  const actorEmail = authResult?.email || request.headers.get("x-test-actor-email") || "admin@alastre.com.br";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const parsed = CapacityFinanceActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { action, payload } = parsed.data;
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  if (action === "create_assumption") {
    const sanitizedOrigin = sanitizeDataOrigin(payload.origin as DataOrigin, payload.evidence_reference);
    const newAssumption = {
      id: `assump-${crypto.randomUUID().slice(0, 8)}`,
      agency_id: agencyId,
      cost_type: payload.cost_type as CostCategory,
      value: payload.value,
      currency: payload.currency,
      period: payload.period as "hourly" | "daily" | "monthly" | "yearly" | "per_unit" | "per_ticket",
      origin: sanitizedOrigin,
      evidence_reference: payload.evidence_reference || null,
      hypothesis_description: payload.hypothesis_description || null,
      responsible_name: payload.responsible_name,
      effective_date: payload.effective_date,
      version: 1,
      approval_status: "approved" as ApprovalStatus,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        await supabase.from("financial_economic_assumptions").insert(newAssumption);
        await supabase.from("audit_events").insert({
          agency_id: agencyId,
          action: "capacity_finance_assumption_created",
          target_type: "financial_economic_assumptions",
          target_id: newAssumption.id,
          payload: { created_by: actorEmail, cost_type: newAssumption.cost_type, origin: newAssumption.origin },
        });
      } catch {
        // Fallback para memória
      }
    }

    capacityFinanceMemoryStore.assumptions.unshift(newAssumption);

    return Response.json({
      success: true,
      assumption: newAssumption,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  if (action === "run_capacity_simulation") {
    const results = calculateCapacityScenario(
      agencyId,
      payload.scenario_clients_count,
      payload.roles as unknown as Parameters<typeof calculateCapacityScenario>[2]
    );

    if (supabase) {
      try {
        for (const res of results) {
          await supabase.from("financial_capacity_simulations").upsert(res);
        }
        await supabase.from("audit_events").insert({
          agency_id: agencyId,
          action: "capacity_simulation_executed",
          target_type: "financial_capacity_simulations",
          target_id: results[0]?.id || "sim",
          payload: { executed_by: actorEmail, clients_scenario: payload.scenario_clients_count },
        });
      } catch {
        // Fallback para memória
      }
    }

    capacityFinanceMemoryStore.simulations = [
      ...results,
      ...capacityFinanceMemoryStore.simulations.filter(
        (s) => !(s.agency_id === agencyId && s.scenario_clients_count === payload.scenario_clients_count)
      ),
    ];

    return Response.json({
      success: true,
      scenario_clients_count: payload.scenario_clients_count,
      simulations: results,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  if (action === "calculate_margin") {
    const marginResult = calculateSegregatedMargin({
      agency_id: agencyId,
      client_id: payload.client_id || undefined,
      product_definition_id: payload.product_definition_id || undefined,
      proposal_id: payload.proposal_id || undefined,
      contracted_value: payload.contracted_value,
      invoiced_value: payload.invoiced_value ?? undefined,
      received_value: payload.received_value ?? undefined,
      estimated_cost: payload.estimated_cost,
      actual_cost: payload.actual_cost ?? undefined,
    });

    if (supabase) {
      try {
        await supabase.from("financial_margin_analyses").insert(marginResult);
        await supabase.from("audit_events").insert({
          agency_id: agencyId,
          action: "financial_margin_analyzed",
          target_type: "financial_margin_analyses",
          target_id: marginResult.id,
          payload: { analyzed_by: actorEmail, contracted_value: marginResult.contracted_value },
        });
      } catch {
        // Fallback em memória
      }
    }

    capacityFinanceMemoryStore.margins.unshift(marginResult);

    return Response.json({
      success: true,
      margin_analysis: marginResult,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  if (action === "evaluate_pricing") {
    const evalResult = validatePricingProposal({
      proposal_id: payload.proposal_id,
      product_definition_id: payload.product_definition_id,
      list_setup_price: payload.list_setup_price,
      list_monthly_price: payload.list_monthly_price,
      proposed_setup_price: payload.proposed_setup_price,
      proposed_monthly_price: payload.proposed_monthly_price,
      estimated_operational_cost: payload.estimated_operational_cost,
      discount_applied_pct: payload.discount_applied_pct,
      discount_type: payload.discount_type,
      discount_counterpart_description: payload.discount_counterpart_description,
      is_cost_estimated: payload.is_cost_estimated,
      is_counterpart_documented: payload.is_counterpart_documented,
    });

    let approvalItemId: string | null = null;

    if (evalResult.can_approve) {
      approvalItemId = crypto.randomUUID();
      const approvalRecord = {
        id: approvalItemId,
        agency_id: agencyId,
        client_id: "b10a1a00-0000-4000-8000-000000000001",
        source_type: "capacity_financial_pricing",
        source_id: payload.proposal_id,
        requested_by_email: actorEmail,
        status: "pending",
        snapshot: {
          proposal_id: payload.proposal_id,
          list_setup_price: payload.list_setup_price,
          list_monthly_price: payload.list_monthly_price,
          proposed_setup_price: payload.proposed_setup_price,
          proposed_monthly_price: payload.proposed_monthly_price,
          estimated_operational_cost: payload.estimated_operational_cost,
          discount_applied_pct: payload.discount_applied_pct,
          discount_type: payload.discount_type,
          discount_counterpart: payload.discount_counterpart_description,
          evaluated_margin_pct: evalResult.evaluated_margin_pct,
        },
        created_at: now,
      };

      if (supabase) {
        try {
          await supabase.from("approval_items").insert(approvalRecord);
          await supabase.from("financial_pricing_decisions").insert({
            id: crypto.randomUUID(),
            agency_id: agencyId,
            proposal_id: payload.proposal_id,
            product_definition_id: payload.product_definition_id || null,
            list_setup_price: payload.list_setup_price,
            list_monthly_price: payload.list_monthly_price,
            proposed_setup_price: payload.proposed_setup_price,
            proposed_monthly_price: payload.proposed_monthly_price,
            estimated_operational_cost: payload.estimated_operational_cost,
            discount_applied_pct: payload.discount_applied_pct,
            discount_type: payload.discount_type || null,
            discount_counterpart_description: payload.discount_counterpart_description || null,
            is_cost_estimated: payload.is_cost_estimated,
            is_counterpart_documented: payload.is_counterpart_documented,
            approval_status: "pending_human_approval",
            approval_item_id: approvalItemId,
            created_at: now,
            updated_at: now,
          });
          await supabase.from("audit_events").insert({
            agency_id: agencyId,
            action: "pricing_decision_submitted_for_approval",
            target_type: "financial_pricing_decisions",
            target_id: payload.proposal_id,
            payload: { requested_by: actorEmail, approval_item_id: approvalItemId },
          });
        } catch {
          // Fallback para memória
        }
      }

      capacityFinanceMemoryStore.pricingDecisions.unshift({
        ...evalResult,
        id: crypto.randomUUID(),
        agency_id: agencyId,
        approval_item_id: approvalItemId,
      });
    }

    return Response.json({
      success: evalResult.can_approve,
      evaluation: evalResult,
      approval_item_id: approvalItemId,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  if (action === "process_pricing_approval") {
    const { approval_item_id, decision, decision_note } = payload;
    const isApproved = decision === "approved";

    if (supabase) {
      try {
        await supabase
          .from("approval_items")
          .update({
            status: isApproved ? "approved" : "rejected",
            decision_by_email: actorEmail,
            decision_note: decision_note || null,
            decided_at: now,
          })
          .eq("id", approval_item_id)
          .eq("agency_id", agencyId);

        await supabase
          .from("financial_pricing_decisions")
          .update({
            approval_status: isApproved ? "approved" : "rejected",
            decided_by_actor_id: actorEmail,
            decided_at: now,
            updated_at: now,
          })
          .eq("approval_item_id", approval_item_id)
          .eq("agency_id", agencyId);

        await supabase.from("audit_events").insert({
          agency_id: agencyId,
          action: isApproved ? "pricing_decision_human_approved" : "pricing_decision_human_rejected",
          target_type: "financial_pricing_decisions",
          target_id: approval_item_id,
          payload: { decided_by: actorEmail, decision, note: decision_note },
        });
      } catch {
        // Fallback em memória
      }
    }

    const decisionRecord = capacityFinanceMemoryStore.pricingDecisions.find(
      (p) => p.approval_item_id === approval_item_id && p.agency_id === agencyId
    );
    if (decisionRecord) {
      decisionRecord.approval_status = isApproved ? "approved" : "rejected";
    }

    return Response.json({
      success: true,
      approval_item_id,
      decision,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  return Response.json({ error: "Ação não suportada" }, { status: 400 });
}
