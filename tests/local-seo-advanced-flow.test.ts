import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePartialScore,
  deterministicOpportunityRules,
  localSeoV2Request,
} from "../lib/local-seo-v2-api.ts";

describe("SEO Local Advanced Flow & Opportunities Lifecycle", () => {
  const dummyClientId = "c1000000-0000-4000-8000-000000000001";
  const dummyOpportunityId = "d2000000-0000-4000-8000-000000000002";

  test("valida transição de status de oportunidade com valores suportados", () => {
    const validStatuses = [
      "detected",
      "analyzed",
      "action_prepared",
      "waiting_approval",
      "in_progress",
      "completed",
      "dismissed",
    ] as const;

    for (const status of validStatuses) {
      const parsed = localSeoV2Request.safeParse({
        action: "opportunity_status",
        client_id: dummyClientId,
        id: dummyOpportunityId,
        status,
      });
      assert.equal(parsed.success, true, `Deveria aceitar status ${status}`);
    }

    const invalid = localSeoV2Request.safeParse({
      action: "opportunity_status",
      client_id: dummyClientId,
      id: dummyOpportunityId,
      status: "deleted_or_invalid",
    });
    assert.equal(invalid.success, false, "Deveria rejeitar status inválido");
  });

  test("agrega oportunidade única crítica quando há 3 ou mais checks críticos", () => {
    const rules = deterministicOpportunityRules({
      checks: [
        { check_key: "hours", status: "critical" },
        { check_key: "phone", status: "critical" },
        { check_key: "address", status: "critical" },
        { check_key: "description", status: "attention" },
      ],
      approvedKeywords: 5,
      competitors: 2,
    });

    const criticalRule = rules.find((r) => r.origin === "rule:audit_critical_count");
    assert.ok(criticalRule, "Deveria gerar regra agregada crítica");
    assert.equal(criticalRule?.priority, "critical");
    assert.equal(criticalRule?.suggested_action, "open_profile");
    assert.equal(criticalRule?.category, "profile");
  });

  test("gera oportunidades granulares quando há menos de 3 checks críticos", () => {
    const rules = deterministicOpportunityRules({
      checks: [
        { check_key: "phone", status: "critical" },
        { check_key: "website", status: "attention" },
      ],
      approvedKeywords: 3,
      competitors: 1,
    });

    assert.equal(rules.length, 2);
    assert.ok(rules.some((r) => r.origin === "rule:audit:phone" && r.priority === "critical"));
    assert.ok(rules.some((r) => r.origin === "rule:audit:website" && r.priority === "high"));
  });

  test("calcula confiança 'medium' quando há 12 ou mais verificações validadas", () => {
    const checks = Array.from({ length: 12 }, (_, i) => ({
      check_key: `check_${i}`,
      status: "ok",
    }));

    const result = calculatePartialScore(checks);
    assert.ok(result);
    assert.equal(result?.overall_score, 100);
    assert.equal(result?.confidence, "medium");
    assert.equal(result?.state, "partial");
    assert.equal(result?.pillar_scores[0]?.evidence_count, 12);
  });

  test("calcula confiança 'low' quando há menos de 12 verificações validadas", () => {
    const checks = [
      { check_key: "name", status: "ok" },
      { check_key: "phone", status: "ok" },
      { check_key: "address", status: "attention" },
    ];

    const result = calculatePartialScore(checks);
    assert.ok(result);
    assert.equal(result?.confidence, "low");
    // (100 + 100 + 60) / 3 = 260 / 3 = 87
    assert.equal(result?.overall_score, 87);
  });
});
