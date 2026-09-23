import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  keywordIntents,
  localScoreWeights,
  profileAuditCatalog,
  unconfiguredLocalRankProvider,
} from "../lib/local-seo-v2-domain.ts";
import {
  calculatePartialScore,
  deterministicOpportunityRules,
  localSeoV2Request,
} from "../lib/local-seo-v2-api.ts";

describe("SEO Local V2 domain", () => {
  test("mantém sete pilares com pesos explícitos", () => {
    assert.equal(Object.keys(localScoreWeights).length, 7);
    assert.equal(
      Object.values(localScoreWeights).reduce(
        (total, value) => total + value,
        0,
      ),
      100,
    );
  });

  test("prepara auditoria completa sem inventar estado", () => {
    assert.ok(
      profileAuditCatalog
        .map(([, label]) => label)
        .includes("Completude geral"),
    );
    assert.equal(profileAuditCatalog.length, 18);
  });

  test("separa ranking do Google Business Profile", () => {
    assert.equal(unconfiguredLocalRankProvider.status, "not_configured");
    assert.equal(unconfiguredLocalRankProvider.name, null);
  });

  test("define intenções operacionais", () => {
    assert.deepEqual(keywordIntents, [
      "Transacional",
      "Comercial",
      "Local",
      "Informacional",
      "Marca",
    ]);
  });

  test("calcula score somente com evidência verificada", () => {
    assert.equal(calculatePartialScore([]), null);
    assert.equal(
      calculatePartialScore([
        { check_key: "name", status: "ok" },
        { check_key: "hours", status: "critical" },
      ])?.overall_score,
      60,
    );
  });

  test("gera oportunidades determinísticas e deduplicáveis por origem", () => {
    const rules = deterministicOpportunityRules({
      checks: [],
      approvedKeywords: 0,
      competitors: 0,
    });
    assert.deepEqual(
      rules.map((rule) => rule.origin),
      ["rule:no_approved_keywords", "rule:no_competitors"],
    );
    assert.equal(
      new Set(rules.map((rule) => rule.origin)).size,
      rules.length,
    );
  });

  test("valida ações e escopo de cliente", () => {
    assert.equal(
      localSeoV2Request.safeParse({ action: "clients" }).success,
      true,
    );
    assert.equal(
      localSeoV2Request.safeParse({
        action: "workspace",
        client_id: "inválido",
      }).success,
      false,
    );
  });
});
