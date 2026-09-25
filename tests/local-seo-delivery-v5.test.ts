import test from "node:test";
import assert from "node:assert/strict";
import {
  dataOrigins,
  dataOriginLabels,
  defaultCitationsCatalog,
  NO_RANKING_PROMISE_DISCLAIMER,
  WRITE_MODE_DISABLED_DISCLAIMER,
  profileAuditCatalog,
  localScoreWeights,
  unconfiguredLocalRankProvider,
} from "../lib/local-seo-v2-domain.ts";
import {
  localSeoV2Request,
  calculatePartialScore,
  deterministicOpportunityRules,
} from "../lib/local-seo-v2-api.ts";
import { validateGbpPostContent } from "../lib/local-seo-domain.ts";

test("Módulo 05 — Entrega SEO Local: Origens de Dados e Isenção de Promessas", async (t) => {
  await t.test("contém exatamente as 6 origens de dados obrigatórias", () => {
    assert.deepEqual([...dataOrigins], [
      "provider",
      "manual",
      "evidence",
      "inference",
      "hypothesis",
      "unavailable",
    ]);

    assert.equal(dataOriginLabels.provider, "Provedor (API)");
    assert.equal(dataOriginLabels.manual, "Manual (Operador)");
    assert.equal(dataOriginLabels.evidence, "Evidência documental");
    assert.equal(dataOriginLabels.inference, "Inferência (DNA)");
    assert.equal(dataOriginLabels.hypothesis, "Hipótese de melhoria");
    assert.equal(dataOriginLabels.unavailable, "Indisponível (N/D)");
  });

  await t.test("declara isenção de promessas de ranking e vendas", () => {
    assert.ok(NO_RANKING_PROMISE_DISCLAIMER.includes("NUNCA garante posições"));
    assert.ok(NO_RANKING_PROMISE_DISCLAIMER.includes("algoritmos do Google"));
  });

  await t.test("declara bloqueio de escrita externa quando ALASTRE_WRITE_MODE=disabled", () => {
    assert.ok(WRITE_MODE_DISABLED_DISCLAIMER.includes("ALASTRE_WRITE_MODE=disabled"));
    assert.ok(WRITE_MODE_DISABLED_DISCLAIMER.includes("NÃO são enviadas ao Google"));
  });
});

test("Módulo 05 — Entrega SEO Local: Auditoria de Perfil e Diretórios", async (t) => {
  await t.test("possui os 18 pontos do catálogo de auditoria de perfil", () => {
    assert.equal(profileAuditCatalog.length, 18);
    const keys = profileAuditCatalog.map(([key]) => key);
    assert.ok(keys.includes("name"));
    assert.ok(keys.includes("primary_category"));
    assert.ok(keys.includes("phone"));
    assert.ok(keys.includes("website"));
    assert.ok(keys.includes("address"));
  });

  await t.test("contém catálogo padrão de diretórios para citações NAP", () => {
    assert.ok(defaultCitationsCatalog.length >= 7);
    const names = defaultCitationsCatalog.map((c) => c.directory_name);
    assert.ok(names.includes("Apontador"));
    assert.ok(names.includes("Yelp Brasil"));
    assert.ok(names.includes("Google Maps / Business Profile"));
  });

  await t.test("provedor de ranking inicia como não configurado", () => {
    assert.equal(unconfiguredLocalRankProvider.status, "not_configured");
    assert.equal(unconfiguredLocalRankProvider.name, null);
  });
});

test("Módulo 05 — Entrega SEO Local: Validação Zod da API e Ações do Motor de Operações", async (t) => {
  const validUuid = "11111111-1111-4111-a111-111111111111";

  await t.test("valida ação audit_save com data_origin", () => {
    const parsed = localSeoV2Request.safeParse({
      action: "audit_save",
      client_id: validUuid,
      check_key: "name",
      status: "ok",
      source: "manual",
      data_origin: "evidence",
    });
    assert.ok(parsed.success);
  });

  await t.test("valida ação citation_save para diretórios", () => {
    const parsed = localSeoV2Request.safeParse({
      action: "citation_save",
      client_id: validUuid,
      directory_name: "Yelp Brasil",
      status: "verified",
      nap_status: "consistent",
      source: "manual",
    });
    assert.ok(parsed.success);
  });

  await t.test("valida ação opportunity_create_work_item para o Motor de Operações", () => {
    const parsed = localSeoV2Request.safeParse({
      action: "opportunity_create_work_item",
      client_id: validUuid,
      id: validUuid,
    });
    assert.ok(parsed.success);
  });

  await t.test("valida ação post_create_work_item para o Motor de Operações", () => {
    const parsed = localSeoV2Request.safeParse({
      action: "post_create_work_item",
      client_id: validUuid,
      id: validUuid,
    });
    assert.ok(parsed.success);
  });

  await t.test("valida ação review_request_work_item para o Motor de Operações", () => {
    const parsed = localSeoV2Request.safeParse({
      action: "review_request_work_item",
      client_id: validUuid,
      title: "Coleta de Avaliações",
    });
    assert.ok(parsed.success);
  });

  await t.test("rejeita requisição sem client_id ou com UUID inválido", () => {
    const parsed = localSeoV2Request.safeParse({
      action: "opportunity_create_work_item",
      client_id: "invalid-uuid",
      id: validUuid,
    });
    assert.equal(parsed.success, false);
  });
});

test("Módulo 05 — Entrega SEO Local: Conformidade de Posts e Ausência de Evidências", async (t) => {
  await t.test("valida limites de caracteres e alerta sobre telefone no texto", () => {
    const validPost = validateGbpPostContent("Venha conhecer nossos serviços automotivos com atendimento especializado na região central.");
    assert.ok(validPost.valid);

    const postWithPhone = validateGbpPostContent("Ligue para nós no telefone (11) 98765-4321 e agende agora seu horário.");
    assert.ok(postWithPhone.valid);
    assert.ok(postWithPhone.warnings.some((w) => w.includes("número de telefone")));
  });

  await t.test("ausência de evidências não gera nota zero no Alastre Local Score", () => {
    const emptyScore = calculatePartialScore([]);
    assert.equal(emptyScore, null); // N/D, não zero!

    const partialScore = calculatePartialScore([{ check_key: "name", status: "ok" }]);
    assert.ok(partialScore !== null);
    assert.equal(partialScore.overall_score, 100);
    assert.equal(partialScore.confidence, "low");
  });
});
