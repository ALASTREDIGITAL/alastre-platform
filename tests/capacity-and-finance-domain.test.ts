(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeDataOrigin,
  calculateCapacityScenario,
  calculateSegregatedMargin,
  calculateUnitEconomicsCACPaybackLTV,
  validatePricingProposal,
  PROJECTION_DISCLAIMER,
  type RoleCapacityInput,
} from "../lib/capacity-and-finance-domain.ts";

test("Módulo 08 — Capacidade e Financeiro: Origem Rastreável de Premissas", async (t) => {
  await t.test("reclassifica fato para hipótese se referência de evidência estiver ausente", () => {
    const origin1 = sanitizeDataOrigin("real_observed", null);
    assert.equal(origin1, "hypothesis");

    const origin2 = sanitizeDataOrigin("reported_value", "   ");
    assert.equal(origin2, "hypothesis");

    const origin3 = sanitizeDataOrigin("real_observed", "Folha de Pagamento 2026");
    assert.equal(origin3, "real_observed");
  });
});

test("Módulo 08 — Capacidade e Financeiro: Simulação de Capacidade e Gargalos", async (t) => {
  await t.test("calcula ocupação e identifica gargalo dominante para cenários (10, 25, 50, 100 clientes)", () => {
    const roleInputs: RoleCapacityInput[] = [
      {
        role: "analyst",
        available_monthly_hours_per_head: 160,
        headcount: 1,
        estimated_minutes_per_client: 480, // 8h/cliente
      },
      {
        role: "specialist",
        available_monthly_hours_per_head: 160,
        headcount: 1,
        estimated_minutes_per_client: 120, // 2h/cliente
      },
    ];

    // Cenário 10 clientes: Analyst precisa de 80h/160h (50% ocupação)
    const sim10 = calculateCapacityScenario("agency-test", 10, roleInputs);
    assert.equal(sim10.length, 2);
    const analyst10 = sim10.find((s) => s.operational_role === "analyst");
    assert.ok(analyst10);
    assert.equal(analyst10.planned_monthly_hours, 80);
    assert.equal(analyst10.occupancy_rate_pct, 50);
    assert.equal(analyst10.is_dominant_bottleneck, true); // Ocupação maior (50% vs 12.5%)

    // Cenário 25 clientes: Analyst precisa de 200h/160h (125% ocupação -> colapso de qualidade)
    const sim25 = calculateCapacityScenario("agency-test", 25, roleInputs);
    const analyst25 = sim25.find((s) => s.operational_role === "analyst");
    assert.ok(analyst25);
    assert.equal(analyst25.occupancy_rate_pct, 125);
    assert.equal(analyst25.quality_risk_level, "critical");
    assert.equal(analyst25.hiring_trigger_clients, 17); // Break-even de contratação a 17 clientes
  });

  await t.test("trata ausência de dados de entrada como dados insuficientes", () => {
    const simEmpty = calculateCapacityScenario("agency-test", 10, []);
    assert.equal(simEmpty[0].data_coverage_status, "insufficient_data");
    assert.ok(simEmpty[0].missing_data_fields.includes("role_inputs"));
  });
});

test("Módulo 08 — Capacidade e Financeiro: Margem Segregada (Contratado vs Faturado vs Recebido)", async (t) => {
  await t.test("segrega estritamente valor contratado, faturado e recebido sem misturar métricas", () => {
    const margin = calculateSegregatedMargin({
      agency_id: "agency-test",
      contracted_value: 3000,
      invoiced_value: 2500,
      received_value: 2000,
      estimated_cost: 1000,
      actual_cost: 1100,
    });

    assert.equal(margin.contracted_value, 3000);
    assert.equal(margin.invoiced_value, 2500);
    assert.equal(margin.received_value, 2000);

    // Margem estimada usa contratado (3000 - 1000 = 2000)
    assert.equal(margin.estimated_margin_value, 2000);
    assert.equal(margin.estimated_margin_pct, 66.67);

    // Margem realizada usa faturado e custo real (2500 - 1100 = 1400)
    assert.equal(margin.actual_margin_value, 1400);
    assert.equal(margin.actual_margin_pct, 56);
  });
});

test("Módulo 08 — Capacidade e Financeiro: CAC, Payback e LTV sem Dados Sintéticos", async (t) => {
  await t.test("retorna dados insuficientes quando métricas de vendas ou churn estão ausentes", () => {
    const result = calculateUnitEconomicsCACPaybackLTV({
      sales_costs_period: null,
      new_clients_acquired_period: null,
    });

    assert.equal(result.status, "insufficient_data");
    assert.equal(result.cac, null);
    assert.equal(result.payback_months, null);
    assert.equal(result.ltv, null);
    assert.ok(result.missing_data_fields.includes("custos_de_vendas_e_marketing"));
  });

  await t.test("calcula CAC, payback e LTV rastreáveis quando todos os dados reais existem", () => {
    const result = calculateUnitEconomicsCACPaybackLTV({
      sales_costs_period: 5000,
      marketing_costs_period: 5000,
      new_clients_acquired_period: 5, // CAC = 10.000 / 5 = R$ 2.000
      monthly_contribution_margin_per_client: 1000, // Payback = 2000 / 1000 = 2 meses
      monthly_churn_rate_pct: 5, // Retenção = 20 meses -> LTV = 1000 * 20 = R$ 20.000
    });

    assert.equal(result.status, "complete");
    assert.equal(result.cac, 2000);
    assert.equal(result.payback_months, 2);
    assert.equal(result.ltv, 20000);
  });
});

test("Módulo 08 — Capacidade e Financeiro: Precificação e Descontos Protegidos", async (t) => {
  await t.test("rejeita aprovação de preço se custo operacional não for estimado", () => {
    const evalResult = validatePricingProposal({
      proposal_id: "prop-test-1",
      list_setup_price: 1000,
      list_monthly_price: 2000,
      proposed_setup_price: 1000,
      proposed_monthly_price: 2000,
      estimated_operational_cost: 0,
      discount_applied_pct: 0,
      is_cost_estimated: false, // Custo não estimado
      is_counterpart_documented: false,
    });

    assert.equal(evalResult.can_approve, false);
    assert.ok(evalResult.blocking_reasons.some((r) => r.includes("custo operacional estimado")));
  });

  await t.test("rejeita desconto > 0% sem contrapartida documentada", () => {
    const evalResult = validatePricingProposal({
      proposal_id: "prop-test-2",
      list_setup_price: 1000,
      list_monthly_price: 2000,
      proposed_setup_price: 1000,
      proposed_monthly_price: 1800,
      estimated_operational_cost: 800,
      discount_applied_pct: 10,
      discount_type: "unjustified", // Desconto não justificado
      is_cost_estimated: true,
      is_counterpart_documented: false,
    });

    assert.equal(evalResult.can_approve, false);
    assert.ok(evalResult.blocking_reasons.some((r) => r.includes("contrapartida documentada")));
  });

  await t.test("encaminha precificação válida com desconto justificado para aprovação humana", () => {
    const evalResult = validatePricingProposal({
      proposal_id: "prop-test-3",
      list_setup_price: 1000,
      list_monthly_price: 2000,
      proposed_setup_price: 1000,
      proposed_monthly_price: 1800,
      estimated_operational_cost: 800,
      discount_applied_pct: 10,
      discount_type: "scope_reduction",
      discount_counterpart_description: "Redução de 1 relatório mensal",
      is_cost_estimated: true,
      is_counterpart_documented: true,
    });

    assert.equal(evalResult.can_approve, true);
    assert.equal(evalResult.requires_human_approval, true);
    assert.equal(evalResult.approval_status, "pending_human_approval");
  });
});
