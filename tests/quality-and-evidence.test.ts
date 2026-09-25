(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evidenceTypeLabels,
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
  qualityMemoryStore,
} from "../lib/quality-api.ts";
import { operationsMemoryStore } from "../app/api/operations/route.ts";
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

test("Módulo 06 — Hardening: Verificação de Migration e FKs Compostas", async (t) => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925060000_quality_and_evidence_hardening.sql",
  );

  await t.test("confirma que a migration de hardening existe", () => {
    assert.ok(fs.existsSync(migrationPath), "Migration 20260925060000 deve existir");
  });

  await t.test("valida presença de todas as foreign keys compostas e RPC de hardening", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    // Pre-validations
    assert.ok(sql.includes("INCONSISTENCIA CROSS-TENANT DETECTADA"));

    // Composite FKs
    assert.ok(sql.includes("quality_evidences_agency_unit_fk"));
    assert.ok(sql.includes("quality_evidences_agency_service_fk"));
    assert.ok(sql.includes("quality_checklist_runs_agency_template_fk"));
    assert.ok(sql.includes("quality_nc_agency_workflow_fk"));
    assert.ok(sql.includes("quality_nc_agency_evidence_fk"));
    assert.ok(sql.includes("quality_nc_agency_corrective_item_fk"));

    // RPC Security Hardening
    assert.ok(sql.includes("create or replace function public.quality_create_corrective_action"));
    assert.ok(sql.includes("security definer"));
    assert.ok(sql.includes("set search_path = ''"));
    assert.ok(sql.includes("grant execute on function public.quality_create_corrective_action to service_role"));
  });
});

test("Módulo 06 — Hardening: Criação Atômica de Ação Corretiva sem Workflow Prévio", async (t) => {
  qualityMemoryStore.clear();
  operationsMemoryStore.clear();

  const agencyId = "00000000-0000-0000-0000-000000000001";
  const clientId = "11111111-1111-4111-a111-111111111111";
  const ncId = "88888888-8888-4888-a888-888888888888";

  // Inserir Não Conformidade sem workflow prévio
  qualityMemoryStore.nonConformities.push({
    id: ncId,
    agency_id: agencyId,
    client_id: clientId,
    workflow_id: null,
    title: "Falha de Tagging em GA4",
    severity: "high",
    status: "open",
    root_cause: "Container desalinhado",
    impact: "Perda de eventos",
    opened_by_actor_id: "test-actor-id",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await t.test("cria workflow válido e tarefa corretiva vinculados de forma atômica", async () => {
    const req = new Request("http://localhost:3000/api/quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_corrective_action",
        non_conformity_id: ncId,
        title: "Reconfiguração de Container GTM",
        priority: "urgent",
      }),
    });

    const res = await qualityRouteHandler(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.workflow_id);
    assert.ok(data.corrective_work_item);
    assert.equal(data.non_conformity.status, "action_created");

    // Confirmar que o workflow foi criado no Motor de Operações (Módulo 04)
    const createdWf = operationsMemoryStore.workflows.find((w) => w.id === data.workflow_id);
    assert.ok(createdWf);
    assert.equal(createdWf.agency_id, agencyId);
    assert.equal(createdWf.client_id, clientId);
    assert.equal(createdWf.workflow_type, "exception");

    // Confirmar que a tarefa foi criada vinculada ao novo workflow
    const createdItem = operationsMemoryStore.workItems.find(
      (i) => i.id === data.corrective_work_item.id,
    );
    assert.ok(createdItem);
    assert.equal(createdItem.workflow_id, data.workflow_id);
    assert.equal(createdItem.agency_id, agencyId);
  });
});

test("Módulo 06 — Hardening: Prevenção de Falso Sucesso em Caso de Falha", async (t) => {
  qualityMemoryStore.clear();

  await t.test("rejeita criação de ação corretiva para NC inexistente com erro 404 e success: false", async () => {
    const req = new Request("http://localhost:3000/api/quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_corrective_action",
        non_conformity_id: "00000000-0000-0000-0000-999999999999",
        title: "Ação Inexistente",
      }),
    });

    const res = await qualityRouteHandler(req);
    assert.equal(res.status, 404);

    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes("não encontrada"));
  });
});

test("Módulo 06 — Hardening: Isolamento Estrito entre Múltiplas Agências", async (t) => {
  qualityMemoryStore.clear();

  const agencyA = "00000000-0000-0000-0000-000000000001";
  const agencyB = "99999999-9999-9999-9999-999999999999";

  // Evidência pertencente à Agência A
  qualityMemoryStore.evidences.push({
    id: "ev-agency-a",
    agency_id: agencyA,
    work_item_id: "item-a",
    evidence_type: "screenshot",
    origin: "manual",
    verification_status: "pending",
    responsible_actor_id: "actor-a",
    captured_at: new Date().toISOString(),
    verifiable_reference: "https://agencia-a.com/print.png",
    sanitized_metadata: {},
    is_locked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await t.test("agência A visualiza apenas suas próprias evidências", async () => {
    const fetchReq = new Request("http://localhost:3000/api/quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch_workspace" }),
    });

    const fetchRes = await qualityRouteHandler(fetchReq);
    const fetchData = await fetchRes.json();
    assert.equal(fetchData.success, true);
    assert.equal(fetchData.evidences.length, 1);
    assert.equal(fetchData.evidences[0].id, "ev-agency-a");
  });
});
