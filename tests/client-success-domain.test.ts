(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateClientHealthScore,
  buildClientScorecard,
  validateExpansionRecommendation,
  NO_RANKING_PROMISE_DISCLAIMER,
} from "../lib/client-success-domain.ts";

test("Módulo 07 — Sucesso do Cliente: Cálculo e Explicabilidade do Health Score", async (t) => {
  const agencyId = "00000000-0000-4000-a000-000000000001";
  const clientId = "11111111-1111-4111-a111-111111111111";

  await t.test("calcula health score excelente quando todos os pilares estão completos e elevados", () => {
    const res = calculateClientHealthScore({
      agency_id: agencyId,
      client_id: clientId,
      operational_delivery: { score: 90, weight: 1, data_available: true },
      quality_compliance: { score: 95, weight: 1, data_available: true },
      client_cooperation: { score: 85, weight: 1, data_available: true },
      perceived_value: { score: 90, weight: 1, data_available: true },
      indicator_evolution: { score: 88, weight: 1, data_available: true },
      churn_risk_factor: { score: 92, weight: 1, data_available: true },
      active_scope: { score: 90, weight: 1, data_available: true },
    });

    assert.equal(res.status, "excellent");
    assert.equal(res.coverage_pct, 100);
    assert.equal(res.data_status, "complete");
    assert.ok(res.overall_score >= 85);
    assert.equal(res.primary_cause, "none");
  });

  await t.test("trata dados insuficientes sem converter ausência em nota negativa arbitrária", () => {
    const res = calculateClientHealthScore({
      agency_id: agencyId,
      client_id: clientId,
      operational_delivery: { score: null, weight: 1, data_available: false },
      quality_compliance: { score: null, weight: 1, data_available: false },
      client_cooperation: { score: null, weight: 1, data_available: false },
      perceived_value: { score: null, weight: 1, data_available: false },
      indicator_evolution: { score: null, weight: 1, data_available: false },
    });

    assert.equal(res.status, "insufficient_data");
    assert.equal(res.data_status, "insufficient");
    assert.equal(res.overall_score, 0);
    assert.equal(res.primary_cause, "insufficient_data");
    assert.ok(res.cause_breakdown.insufficient_data_fields.length > 0);
  });

  await t.test("segrega adequadamente falha do cliente de falha operacional da Alastre", () => {
    const res = calculateClientHealthScore({
      agency_id: agencyId,
      client_id: clientId,
      operational_delivery: { score: 95, weight: 1, data_available: true },
      quality_compliance: { score: 90, weight: 1, data_available: true },
      client_cooperation: { score: 40, weight: 1, data_available: true },
      perceived_value: { score: 50, weight: 1, data_available: true },
      indicator_evolution: { score: 60, weight: 1, data_available: true },
      churn_risk_factor: { score: 50, weight: 1, data_available: true },
      active_scope: { score: 80, weight: 1, data_available: true },
      cause_breakdown: {
        alastre_issues_count: 0,
        channel_limitations_count: 0,
        client_dependencies_count: 4,
        insufficient_data_fields: [],
      },
    });

    assert.equal(res.primary_cause, "client_dependency_failure");
  });
});

test("Módulo 07 — Sucesso do Cliente: Scorecard de Valor e Regra de Isenção", async (t) => {
  await t.test("gera scorecard estruturado contendo a mensagem de isenção de garantia", () => {
    const scorecard = buildClientScorecard({
      agency_id: "00000000-0000-4000-a000-000000000001",
      client_id: "11111111-1111-4111-a111-111111111111",
      period_label: "Setembro / 2026",
      health_score_snapshot: 85,
      completed_deliveries_count: 10,
      verified_evidences_count: 8,
      collection_limitations: ["GBP API pendente"],
      improvements_implemented: ["SEO Local Otimizado"],
      client_pendencies: ["Aprovação de orçamento"],
    });

    assert.equal(scorecard.health_score_snapshot, 85);
    assert.equal(scorecard.completed_deliveries_count, 10);
    assert.equal(scorecard.verified_evidences_count, 8);
    assert.equal(scorecard.disclaimer_no_guarantee, NO_RANKING_PROMISE_DISCLAIMER);
    assert.ok(scorecard.disclaimer_no_guarantee.includes("Não há promessa de ranking"));
  });
});

test("Módulo 07 — Sucesso do Cliente: Validação de Expansão e Fit", async (t) => {
  await t.test("rejeita recomendação de expansão sem justificativa completa de fit e valor", () => {
    const invalid = validateExpansionRecommendation({
      type: "expansion_service",
      demonstrated_fit_rationale: "curto",
      evidenced_value_rationale: "val",
      operational_impact_assessment: "imp",
    });

    assert.equal(invalid.valid, false);
    assert.ok(invalid.reason?.includes("fit demonstrado"));
  });

  await t.test("aceita recomendação de expansão devidamente fundamentada", () => {
    const valid = validateExpansionRecommendation({
      type: "expansion_service",
      demonstrated_fit_rationale: "Cliente possui fit excelente para expansão de SEO Local.",
      evidenced_value_rationale: "Valor demonstrado pelas evidências do Módulo 06 no ciclo anterior.",
      operational_impact_assessment: "Capacidade operacional disponível e alocada no Módulo 04.",
    });

    assert.equal(valid.valid, true);
  });
});
