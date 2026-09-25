(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import {
  evidenceTypeLabels,
  verificationStatusLabels,
  ncSeverityLabels,
  sanitizeTextContent,
  sanitizeMetadataObject,
  determineReviewPolicy,
  validateSegregationOfDuties,
  checkWorkItemCompletionBlock,
  type QualityNonConformity,
} from "../lib/quality-domain.ts";
import {
  CreateEvidenceSchema,
  OpenNonConformitySchema,
  CreateCorrectiveActionSchema,
  qualityMemoryStore,
} from "../lib/quality-api.ts";
import { POST as qualityRouteHandler } from "../app/api/quality/route.ts";

test("Módulo 06 — Qualidade e Evidências: Sanitização de Segredos e Tipos Canônicos", async (t) => {
  await t.test("contém exatamente os 8 tipos canônicos de evidência", () => {
    const types = Object.keys(evidenceTypeLabels);
    assert.equal(types.length, 8);
    assert.ok(types.includes("before_after"));
    assert.ok(types.includes("screenshot"));
    assert.ok(types.includes("url"));
    assert.ok(types.includes("external_id"));
    assert.ok(types.includes("sanitized_payload"));
    assert.ok(types.includes("manual_confirmation"));
    assert.ok(types.includes("automated_validation"));
    assert.ok(types.includes("collection_limitation"));
  });

  await t.test("remove segredos, senhas e tokens de textos e metadados", () => {
    const rawText = "Conexão com Bearer eyJhbGciOiJIUzI1Ni... e password=Secret123!";
    const cleanedText = sanitizeTextContent(rawText);
    assert.ok(!cleanedText.includes("Secret123!"));
    assert.ok(cleanedText.includes("[SEGREDOS_REMOVIDOS]"));

    const rawMeta = {
      user: "operador@alastre.digital",
      api_key: "ak_live_99999",
      secret_token: "st_123456",
      normal_field: "dados_validos",
    };
    const cleanedMeta = sanitizeMetadataObject(rawMeta);
    assert.equal(cleanedMeta.api_key, "[REMOVIDO_POR_SEGURANCA]");
    assert.equal(cleanedMeta.secret_token, "[REMOVIDO_POR_SEGURANCA]");
    assert.equal(cleanedMeta.normal_field, "dados_validos");
  });
});

test("Módulo 06 — Qualidade e Evidências: Segregação de Funções e Revisão por Risco", async (t) => {
  await t.test("determina política de revisão mandatória para alto risco e crítico", () => {
    assert.equal(determineReviewPolicy("critical"), "mandatory");
    assert.equal(determineReviewPolicy("high"), "mandatory");
    assert.equal(determineReviewPolicy("normal"), "sampled");
    assert.equal(determineReviewPolicy("low"), "optional");
  });

  await t.test("impede autoaprovação em tarefas de alto risco quando executor = verificador", () => {
    const executor = "actor-111";
    const verifier = "actor-111";

    const result = validateSegregationOfDuties(executor, verifier, "high", "mandatory");
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("Segregação de funções obrigatória"));

    const distinctResult = validateSegregationOfDuties("actor-111", "actor-222", "high", "mandatory");
    assert.equal(distinctResult.allowed, true);
  });
});

test("Módulo 06 — Qualidade e Evidências: Bloqueio por Não Conformidade Crítica", async (t) => {
  const workItemId = "55555555-5555-4555-a555-555555555555";

  const activeNCs: QualityNonConformity[] = [
    {
      id: "nc-01",
      agency_id: "00000000-0000-4000-a000-000000000001",
      client_id: "11111111-1111-4111-a111-111111111111",
      work_item_id: workItemId,
      title: "Falha crítica no setup de tags",
      severity: "critical",
      status: "open",
      root_cause: "Incompatibilidade de script",
      impact: "Vazamento de dados",
      opened_by_actor_id: "actor-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  await t.test("bloqueia conclusão do work_item quando existe NC crítica aberta", () => {
    const check = checkWorkItemCompletionBlock(workItemId, activeNCs);
    assert.equal(check.blocked, true);
    assert.equal(check.blockingNonConformities.length, 1);
  });

  await t.test("desbloqueia conclusão do work_item quando NC crítica é resolvida ou dispensada", () => {
    const resolvedNCs: QualityNonConformity[] = [
      {
        ...activeNCs[0]!,
        status: "resolved",
      },
    ];
    const check = checkWorkItemCompletionBlock(workItemId, resolvedNCs);
    assert.equal(check.blocked, false);
    assert.equal(check.blockingNonConformities.length, 0);
  });
});

test("Módulo 06 — API: Validação de Schemas Zod e Ações de Servidor", async (t) => {
  const workItemId = "11111111-1111-4111-a111-111111111111";

  await t.test("valida esquema de criação de evidência", () => {
    const validPayload = {
      action: "create_evidence",
      work_item_id: workItemId,
      evidence_type: "screenshot",
      verifiable_reference: "https://drive.google.com/file/d/123",
      sanitized_metadata: { browser: "Chrome" },
    };
    const parsed = CreateEvidenceSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
  });

  await t.test("valida esquema de abertura de não conformidade", () => {
    const validNc = {
      action: "open_non_conformity",
      client_id: "22222222-2222-4222-a222-222222222222",
      work_item_id: workItemId,
      title: "Desvio na validação de SEO",
      severity: "high",
      root_cause: "Falta de evidência de palavras-chave",
      impact: "Atraso no relatório",
    };
    const parsed = OpenNonConformitySchema.safeParse(validNc);
    assert.equal(parsed.success, true);
  });
});

test("Módulo 06 — API: Rota HTTP POST /api/quality com Isolamento de Ator", async (t) => {
  qualityMemoryStore.clear();

  await t.test("rejeita requisição não autenticada com status 401", async () => {
    const req = new Request("http://localhost:3000/api/quality", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-unauth": "true",
      },
      body: JSON.stringify({ action: "fetch_workspace" }),
    });

    const res = await qualityRouteHandler(req);
    assert.equal(res.status, 401);
  });

  await t.test("executa fluxo completo de criação de evidência e auditoria em memória", async () => {
    const createReq = new Request("http://localhost:3000/api/quality", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-alastre-bridge-secret": "91221baeea876d7c95a885fa0cf6621aac40867915ac8291149339321d874b31",
        "x-alastre-user-email": "ag.alastredigital@gmail.com",
      },
      body: JSON.stringify({
        action: "create_evidence",
        work_item_id: "33333333-3333-4333-a333-333333333333",
        evidence_type: "url",
        verifiable_reference: "https://alastre.digital/evidencia-teste",
        sanitized_metadata: { test: true },
      }),
    });

    const createRes = await qualityRouteHandler(createReq);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.ok(createData.evidence.id);
    assert.equal(createData.evidence.verification_status, "pending");
  });
});
