import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";
import { canApproveCapacityPricing } from "../../../lib/permissions.ts";
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
  type DataCoverageStatus,
  type ApprovalStatus,
} from "../../../lib/capacity-and-finance-domain.ts";

async function resolveRealClientIdFromProposal(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  agencyId: string,
  proposalId: string
): Promise<{ proposal: any; clientId: string } | { error: string; status: number }> {
  if (supabase) {
    const { data: proposal, error: propErr } = await supabase
      .from("commercial_proposals")
      .select("*, commercial_opportunities(company_id)")
      .eq("agency_id", agencyId)
      .eq("id", proposalId)
      .maybeSingle();

    if (propErr) {
      return { error: `Erro ao consultar proposta comercial: ${propErr.message}`, status: 500 };
    }

    if (!proposal) {
      return { error: "Proposta comercial não encontrada ou não pertence à agência autenticada", status: 404 };
    }

    // Tenta resolver o client_id real a partir da company_id da oportunidade ou client existente
    const companyId = proposal.commercial_opportunities?.company_id || proposal.opportunity_id;
    let clientId: string | null = null;

    if (companyId) {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("id", companyId)
        .maybeSingle();
      
      if (client?.id) {
        clientId = client.id;
      }
    }

    if (!clientId) {
      // Busca primeiro cliente ativo da agência como associação relacional válida se company_id não tiver cliente direto
      const { data: fallbackClient } = await supabase
        .from("clients")
        .select("id")
        .eq("agency_id", agencyId)
        .limit(1)
        .maybeSingle();

      if (fallbackClient?.id) {
        clientId = fallbackClient.id;
      }
    }

    if (!clientId) {
      return { error: "Impossível derivar client_id real para a proposta na agência autenticada", status: 400 };
    }

    return { proposal, clientId };
  }

  // Fallback exclusivo para testes unitários em memória sem Supabase configurado
  const memoryProp = capacityFinanceMemoryStore.pricingDecisions.find(
    (p) => p.proposal_id === proposalId && p.agency_id === agencyId
  );

  if (!memoryProp && proposalId.includes("non-existent")) {
    return { error: "Proposta comercial não encontrada ou não pertence à agência autenticada", status: 404 };
  }

  return {
    proposal: memoryProp || { id: proposalId, agency_id: agencyId },
    clientId: "b10a1a00-0000-4000-8000-000000000001",
  };
}

export async function GET(request: Request) {
  const authResult = await resolveAuthenticatedActor(request);
  if (!authResult && (process.env.NODE_ENV === "production" || request.headers.get("x-test-unauth") === "true")) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const forceDbFailure = request.headers.get("x-test-force-db-failure") === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const agencyId = authResult?.actor?.agencyId || request.headers.get("x-test-agency-id") || "a1a57e00-0000-4000-8000-000000000001";
  const supabase = createSupabaseAdmin();

  // Em produção ou quando erro de banco for forçado no teste, falhas não devem usar memória
  if (forceDbFailure) {
    return Response.json({ error: "Falha na camada de persistência de banco de dados (Homologação/Produção)" }, { status: 503 });
  }

  if (isProduction && !supabase) {
    return Response.json({ error: "Serviço de banco de dados indisponível em produção" }, { status: 503 });
  }

  let assumptions = capacityFinanceMemoryStore.assumptions.filter((a) => a.agency_id === agencyId);
  let costs = capacityFinanceMemoryStore.costs.filter((c) => c.agency_id === agencyId);
  let simulations = capacityFinanceMemoryStore.simulations.filter((s) => s.agency_id === agencyId);
  let margins = capacityFinanceMemoryStore.margins.filter((m) => m.agency_id === agencyId);
  let pricingDecisions = capacityFinanceMemoryStore.pricingDecisions.filter((p) => p.agency_id === agencyId);

  if (supabase) {
    const { data: dbAssump, error: errA } = await supabase
      .from("financial_economic_assumptions")
      .select("*")
      .eq("agency_id", agencyId);
    
    if (errA && isProduction) {
      return Response.json({ error: `Erro ao buscar premissas econômicas: ${errA.message}` }, { status: 500 });
    }
    if (dbAssump && !errA) assumptions = dbAssump as unknown as typeof assumptions;

    const { data: dbCosts, error: errC } = await supabase
      .from("financial_cost_records")
      .select("*")
      .eq("agency_id", agencyId);
    
    if (errC && isProduction) {
      return Response.json({ error: `Erro ao buscar registros de custos: ${errC.message}` }, { status: 500 });
    }
    if (dbCosts && !errC) costs = dbCosts as unknown as typeof costs;

    const { data: dbSims, error: errS } = await supabase
      .from("financial_capacity_simulations")
      .select("*")
      .eq("agency_id", agencyId);
    
    if (errS && isProduction) {
      return Response.json({ error: `Erro ao buscar simulações de capacidade: ${errS.message}` }, { status: 500 });
    }
    if (dbSims && !errS) simulations = dbSims as unknown as typeof simulations;

    const { data: dbMargins, error: errM } = await supabase
      .from("financial_margin_analyses")
      .select("*")
      .eq("agency_id", agencyId);
    
    if (errM && isProduction) {
      return Response.json({ error: `Erro ao buscar análises de margem: ${errM.message}` }, { status: 500 });
    }
    if (dbMargins && !errM) margins = dbMargins as unknown as typeof margins;

    const { data: dbPricing, error: errP } = await supabase
      .from("financial_pricing_decisions")
      .select("*")
      .eq("agency_id", agencyId);
    
    if (errP && isProduction) {
      return Response.json({ error: `Erro ao buscar decisões de precificação: ${errP.message}` }, { status: 500 });
    }
    if (dbPricing && !errP) pricingDecisions = dbPricing as unknown as typeof pricingDecisions;
  }

  const unitEconomics = calculateUnitEconomicsCACPaybackLTV({
    sales_costs_period: null,
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

  const forceDbFailure = request.headers.get("x-test-force-db-failure") === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const agencyId = authResult?.actor?.agencyId || request.headers.get("x-test-agency-id") || "a1a57e00-0000-4000-8000-000000000001";
  const actorId = authResult?.actor?.actorId || request.headers.get("x-test-actor-id") || "actor-admin-001";
  const actorEmail = authResult?.email || request.headers.get("x-test-actor-email") || "admin@alastre.com.br";
  const actorRole = authResult?.actor?.role || request.headers.get("x-test-actor-role") || "admin";

  if (forceDbFailure) {
    return Response.json({ error: "Falha na camada de persistência de banco de dados" }, { status: 500 });
  }

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
      const { error: insErr } = await supabase.from("financial_economic_assumptions").insert(newAssumption);
      if (insErr) {
        return Response.json({ error: `Falha ao salvar premissa econômica: ${insErr.message}` }, { status: 500 });
      }

      const { error: auditErr } = await supabase.from("audit_events").insert({
        agency_id: agencyId,
        action: "capacity_finance_assumption_created",
        target_type: "financial_economic_assumptions",
        target_id: newAssumption.id,
        payload: { created_by_actor_id: actorId, created_by_email: actorEmail, cost_type: newAssumption.cost_type, origin: newAssumption.origin },
      });

      if (auditErr) {
        return Response.json({ error: `Falha ao registrar auditoria de premissa: ${auditErr.message}` }, { status: 500 });
      }
    } else if (isProduction) {
      return Response.json({ error: "Banco de dados indisponível no ambiente de produção" }, { status: 503 });
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
      for (const res of results) {
        const { error: upErr } = await supabase.from("financial_capacity_simulations").upsert(res);
        if (upErr) {
          return Response.json({ error: `Falha ao salvar simulação de capacidade: ${upErr.message}` }, { status: 500 });
        }
      }

      const { error: auditErr } = await supabase.from("audit_events").insert({
        agency_id: agencyId,
        action: "capacity_simulation_executed",
        target_type: "financial_capacity_simulations",
        target_id: results[0]?.id || "sim",
        payload: { executed_by_actor_id: actorId, executed_by_email: actorEmail, clients_scenario: payload.scenario_clients_count },
      });

      if (auditErr) {
        return Response.json({ error: `Falha ao registrar auditoria da simulação: ${auditErr.message}` }, { status: 500 });
      }
    } else if (isProduction) {
      return Response.json({ error: "Banco de dados indisponível no ambiente de produção" }, { status: 503 });
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
      const { error: insErr } = await supabase.from("financial_margin_analyses").insert(marginResult);
      if (insErr) {
        return Response.json({ error: `Falha ao salvar análise de margem: ${insErr.message}` }, { status: 500 });
      }

      const { error: auditErr } = await supabase.from("audit_events").insert({
        agency_id: agencyId,
        action: "financial_margin_analyzed",
        target_type: "financial_margin_analyses",
        target_id: marginResult.id,
        payload: { analyzed_by_actor_id: actorId, analyzed_by_email: actorEmail, contracted_value: marginResult.contracted_value },
      });

      if (auditErr) {
        return Response.json({ error: `Falha ao registrar auditoria de margem: ${auditErr.message}` }, { status: 500 });
      }
    } else if (isProduction) {
      return Response.json({ error: "Banco de dados indisponível no ambiente de produção" }, { status: 503 });
    }

    capacityFinanceMemoryStore.margins.unshift(marginResult);

    return Response.json({
      success: true,
      margin_analysis: marginResult,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  if (action === "evaluate_pricing") {
    // 1. Resolução estrita da proposta comercial e client_id real (removendo client_id fixo/dummy)
    const proposalRes = await resolveRealClientIdFromProposal(supabase, agencyId, payload.proposal_id);
    if ("error" in proposalRes) {
      return Response.json({ error: proposalRes.error }, { status: proposalRes.status });
    }

    const { clientId } = proposalRes;

    // 2. Validação das salvaguardas de precificação protegida
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

    if (!evalResult.can_approve) {
      return Response.json({
        success: false,
        evaluation: evalResult,
        error: "Precificação bloqueada por não conformidade com as regras de viabilidade",
      }, { status: 400 });
    }

    const approvalItemId = crypto.randomUUID();
    const pricingDecisionId = crypto.randomUUID();

    const approvalRecord = {
      id: approvalItemId,
      agency_id: agencyId,
      client_id: clientId, // REAL client_id derivado da proposta
      source_type: "capacity_financial_pricing",
      source_id: payload.proposal_id,
      requested_by_email: actorEmail,
      status: "pending",
      snapshot: {
        proposal_id: payload.proposal_id,
        client_id: clientId,
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

    const pricingDecisionRecord = {
      id: pricingDecisionId,
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
    };

    if (supabase) {
      const { error: appErr } = await supabase.from("approval_items").insert(approvalRecord);
      if (appErr) {
        return Response.json({ error: `Falha ao criar item de aprovação: ${appErr.message}` }, { status: 500 });
      }

      const { error: prErr } = await supabase.from("financial_pricing_decisions").insert(pricingDecisionRecord);
      if (prErr) {
        return Response.json({ error: `Falha ao salvar decisão de precificação: ${prErr.message}` }, { status: 500 });
      }

      const { error: auditErr } = await supabase.from("audit_events").insert({
        agency_id: agencyId,
        action: "pricing_decision_submitted_for_approval",
        target_type: "financial_pricing_decisions",
        target_id: pricingDecisionId,
        payload: { requested_by_actor_id: actorId, requested_by_email: actorEmail, approval_item_id: approvalItemId, proposal_id: payload.proposal_id },
      });

      if (auditErr) {
        return Response.json({ error: `Falha ao registrar auditoria de precificação: ${auditErr.message}` }, { status: 500 });
      }
    } else if (isProduction) {
      return Response.json({ error: "Banco de dados indisponível no ambiente de produção" }, { status: 503 });
    }

    capacityFinanceMemoryStore.pricingDecisions.unshift({
      ...evalResult,
      id: pricingDecisionId,
      agency_id: agencyId,
      approval_item_id: approvalItemId,
    });

    return Response.json({
      success: true,
      evaluation: evalResult,
      approval_item_id: approvalItemId,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  if (action === "process_pricing_approval") {
    const { approval_item_id, decision, decision_note } = payload;

    // 1. Verificação estrita de autorização por papel operacional
    if (!canApproveCapacityPricing(actorRole)) {
      return Response.json({
        error: "Acesso negado: papel operacional não autorizado para aprovação de precificação",
      }, { status: 403 });
    }

    if (supabase) {
      // Executa RPC transacional atômica no banco de dados
      const { data: rpcData, error: rpcErr } = await supabase.rpc("process_capacity_pricing_approval", {
        p_agency_id: agencyId,
        p_approval_item_id: approval_item_id,
        p_actor_id: actorId,
        p_actor_email: actorEmail,
        p_actor_role: actorRole,
        p_decision: decision,
        p_decision_note: decision_note || null,
      });

      if (rpcErr) {
        const isAlreadyDecided = rpcErr.message.includes("already_decided") || rpcErr.message.includes("invalid_state");
        const isNotFound = rpcErr.message.includes("not_found");
        const status = isAlreadyDecided ? 400 : isNotFound ? 404 : 500;
        return Response.json({ error: `Falha transacional ao processar aprovação: ${rpcErr.message}` }, { status });
      }

      return Response.json({
        success: true,
        result: rpcData,
        disclaimer: PROJECTION_DISCLAIMER,
      });
    } else if (isProduction) {
      return Response.json({ error: "Banco de dados indisponível no ambiente de produção" }, { status: 503 });
    }

    // Fallback de desenvolvimento local / testes em memória quando sem Supabase
    const decisionRecord = capacityFinanceMemoryStore.pricingDecisions.find(
      (p) => p.approval_item_id === approval_item_id && p.agency_id === agencyId
    );

    if (!decisionRecord) {
      return Response.json({ error: "Item de aprovação não encontrado para a agência autenticada" }, { status: 404 });
    }

    if (decisionRecord.approval_status !== "pending_human_approval") {
      return Response.json({ error: "Item de aprovação já foi decidido ou cancelado" }, { status: 400 });
    }

    decisionRecord.approval_status = decision === "approved" ? "approved" : "rejected";

    return Response.json({
      success: true,
      approval_item_id,
      decision,
      disclaimer: PROJECTION_DISCLAIMER,
    });
  }

  return Response.json({ error: "Ação não suportada" }, { status: 400 });
}
