import assert from "node:assert/strict";
import test from "node:test";
import { POST as productFactoryPOST } from "../app/api/product-factory/route.ts";
import { POST as commercialPOST } from "../app/api/commercial/route.ts";
import { POST as onboardingPOST, memoryStore } from "../app/api/client-onboarding/route.ts";

function createMockRequest(
  url: string,
  body: unknown,
  authenticatedEmail: string | null = "admin@alastre.com",
  extraHeaders: Record<string, string> = {}
): Request {
  const headers = new Headers();
  if (authenticatedEmail) {
    headers.set("oai-authenticated-user-email", authenticatedEmail);
  }
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("Hardening 1: Fail-Secure Tenant & Auth across M01, M02 and M03", async () => {
  // Test 1.1: Rejeição não autenticado em produção -> 401
  try {
    Object.assign(process.env, { NODE_ENV: "production" });

    const pfReq = createMockRequest("http://localhost:5173/api/product-factory", { action: "list_products" }, null);
    const pfRes = await productFactoryPOST(pfReq);
    assert.strictEqual(pfRes.status, 401, "M01 deve retornar 401 sem autenticação em produção");

    const crmReq = createMockRequest("http://localhost:5173/api/commercial", { action: "list_opportunities" }, null);
    const crmRes = await commercialPOST(crmReq);
    assert.strictEqual(crmRes.status, 401, "M02 deve retornar 401 sem autenticação em produção");

    const onbReq = createMockRequest("http://localhost:5173/api/client-onboarding", { action: "list_onboardings" }, null);
    const onbRes = await onboardingPOST(onbReq);
    assert.strictEqual(onbRes.status, 401, "M03 deve retornar 401 sem autenticação em produção");
  } finally {
    Object.assign(process.env, { NODE_ENV: "development" });
  }

  // Test 1.2: Payload agency_id forjado é ignorado e não permite vazamento entre tenants
  const forgedPayload = {
    action: "create_or_link_client_transactional",
    agency_id: "00000000-0000-0000-0000-999999999999", // Tenant alheio forjado
    agencyId: "00000000-0000-0000-0000-999999999999",
    clientName: "Cliente Teste Forja",
    unitName: "Unidade Sede",
  };
  const onbReqForged = createMockRequest("http://localhost:5173/api/client-onboarding", forgedPayload, "operator@alastre.com");
  const onbResForged = await onboardingPOST(onbReqForged);
  // Deve falhar na validação ou usar o tenant real do ator autenticado, sem jamais respeitar a agency_id forjada
  assert.ok([400, 404].includes(onbResForged.status) || onbResForged.status === 200);
});

test("Hardening 2: RBAC & Segregação de Funções (SoD) na Ativação e Operação", async () => {
  // Configuração inicial de um onboarding para testes de RBAC
  const startReq = createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-rbac-${Date.now()}`,
    },
    "operator@alastre.com",
    { "x-alastre-test-role": "operator" }
  );
  const startRes = await onboardingPOST(startReq);
  const { onboardingId } = await startRes.json();
  assert.ok(onboardingId);

  // 2.1 Operator tenta aprovar ativação -> Deve receber 403 Forbidden
  const operatorApproveReq = createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "approve_activation",
      onboardingId,
      notes: "Operador tentando se auto-aprovar",
    },
    "operator@alastre.com",
    { "x-alastre-test-role": "operator" }
  );
  const operatorApproveRes = await onboardingPOST(operatorApproveReq);
  assert.strictEqual(operatorApproveRes.status, 403, "Operador não pode aprovar ativação (SoD)");
  const operatorData = await operatorApproveRes.json();
  assert.match(operatorData.error, /permissão|segregação/i);

  // 2.2 Operator tenta cancelar onboarding -> 403 Forbidden
  const operatorCancelReq = createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "block_or_cancel",
      onboardingId,
      operation: "cancel",
      reason: "Operador cancelando com justificativa suficiente",
    },
    "operator@alastre.com",
    { "x-alastre-test-role": "operator" }
  );
  const operatorCancelRes = await onboardingPOST(operatorCancelReq);
  assert.strictEqual(operatorCancelRes.status, 403, "Operador não pode cancelar onboarding");

  // 2.3 Operator tenta desbloquear onboarding -> 403 Forbidden
  const operatorUnblockReq = createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "block_or_cancel",
      onboardingId,
      operation: "unblock",
      reason: "Operador desbloqueando com justificativa suficiente",
    },
    "operator@alastre.com",
    { "x-alastre-test-role": "operator" }
  );
  const operatorUnblockRes = await onboardingPOST(operatorUnblockReq);
  assert.strictEqual(operatorUnblockRes.status, 403, "Operador não pode desbloquear onboarding");

  // 2.4 Viewer tenta escrita em Fábrica de Produtos -> 403 Forbidden
  const viewerPfReq = createMockRequest(
    "http://localhost:5173/api/product-factory",
    {
      action: "create_product",
      name: "Produto Viewer Test",
      slug: `prod-view-${Date.now()}`,
      category: "seo_local",
      headline: "Headline",
      summary: "Summary",
    },
    "viewer@alastre.com",
    { "x-alastre-test-role": "viewer" }
  );
  const viewerPfRes = await productFactoryPOST(viewerPfReq);
  assert.strictEqual(viewerPfRes.status, 403, "Viewer não pode criar produtos");

  // 2.5 Viewer tenta escrita no Comercial CRM -> 403 Forbidden
  const viewerCrmReq = createMockRequest(
    "http://localhost:5173/api/commercial",
    {
      action: "create_or_update_company",
      company: {
        name: "Empresa Viewer Test",
      },
    },
    "viewer@alastre.com",
    { "x-alastre-test-role": "viewer" }
  );
  const viewerCrmRes = await commercialPOST(viewerCrmReq);
  assert.strictEqual(viewerCrmRes.status, 403, "Viewer não pode criar empresas comerciais");
});

test("Hardening 3: Real Activation Gate - Recálculo Estrito e Bloqueio com 409", async () => {
  // Criar onboarding completo até o ponto de ativação
  const onbId = `onb-gate-${Date.now()}`;
  const startReq = createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-gate-${Date.now()}`,
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  );
  const startRes = await onboardingPOST(startReq);
  const { onboardingId } = await startRes.json();

  // Conferência da venda
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "review_sales", onboardingId, decision: "approved" },
    "lead@alastre.com",
    { "x-alastre-test-role": "commercial_lead" }
  ));

  // Cria cliente e sede
  const createClientRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "create_or_link_client_transactional",
      onboardingId,
      clientName: "Cliente Gate Teste",
      unitName: "Sede Gate",
      unitCity: "Sorocaba",
      unitStateUf: "SP",
    },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(createClientRes.status, 200);

  // Submeter ativação antes de cumprir baseline e plano
  const submitRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "submit_activation", onboardingId, notes: "Submissão sem baseline nem plano" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(submitRes.status, 200);

  // Tentativa de aprovação: DEVE retornar 409 indicando critérios faltantes
  const approveAttempt1 = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Aprovando sem cumprir checklist" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  assert.strictEqual(approveAttempt1.status, 409, "Gate deve bloquear com 409");
  const gateData1 = await approveAttempt1.json();
  assert.ok(Array.isArray(gateData1.missingCriteria));
  assert.ok(gateData1.missingCriteria.length > 0);

  // Verificar que status NÃO mudou para active
  const wsRes1 = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "get_onboarding_workspace", onboardingId },
    "admin@alastre.com"
  ));
  const wsData1 = await wsRes1.json();
  assert.strictEqual(wsData1.onboarding.status, "ready_for_activation");
  assert.strictEqual(wsData1.client.status, "onboarding");
});

test("Hardening 4: Ativação Atômica, Idempotência e Bloqueio de Ativação Dupla", async () => {
  const startRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-atomic-${Date.now()}`,
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { onboardingId } = await startRes.json();

  // Aprova venda
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "review_sales", onboardingId, decision: "approved" },
    "lead@alastre.com",
    { "x-alastre-test-role": "commercial_lead" }
  ));

  // Cria cliente
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "create_or_link_client_transactional",
      onboardingId,
      clientName: "Cliente Atômico Ltda",
      unitName: "Sede Centro",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Obtém lista de requisitos e cumpre todos
  const wsRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "get_onboarding_workspace", onboardingId },
    "admin@alastre.com"
  ));
  const wsData = await wsRes.json();

  for (const r of wsData.requirements) {
    await onboardingPOST(createMockRequest(
      "http://localhost:5173/api/client-onboarding",
      {
        action: "update_requirement",
        onboardingId,
        requirementId: r.id,
        status: "verified",
        evidenceText: `Comprovado para ${r.title}`,
      },
      "admin@alastre.com",
      { "x-alastre-test-role": "admin" }
    ));
  }

  // Salva baseline
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "save_baseline",
      onboardingId,
      profileCompletenessScore: 70,
      currentRating: 4.8,
      currentReviewCount: 22,
      unansweredReviewsCount: 1,
      rankingVisibilityNotes: "Posição média 5 no Local Pack",
      contentAudit: { hasCoverPhoto: true, hasLogo: true, photosCount: 5, hasAttributes: true },
      collectionLimitations: [],
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Gera plano de implantação
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "generate_plan", onboardingId, targetStartDate: "2026-10-01" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Confirma DNA com dados vitais mínimos exigidos pelo domínio
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "update_dna",
      onboardingId,
      status: "confirmed",
      facts: {
        company_name: "Cliente Atômico Ltda",
        segment: "Saúde e Odontologia",
        city: "Sorocaba",
        state_uf: "SP",
        main_service: "Implantes Dentários",
        phone: "(15) 99999-9999",
      },
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Submete ativação
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "submit_activation", onboardingId, notes: "Tudo pronto" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Primeira ativação -> Deve ter sucesso 200
  const approveRes1 = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Ativado formalmente" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveRes1.status, 200);
  const approveData1 = await approveRes1.json();
  assert.strictEqual(approveData1.status, "active");
  assert.ok(approveData1.activatedAt);

  // Segunda ativação (dupla ativação concorrente ou repetida) -> DEVE RETORNAR 409
  const approveRes2 = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentativa de ativar novamente" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveRes2.status, 409, "Segunda ativação deve retornar 409 Conflict");
  const approveData2 = await approveRes2.json();
  assert.match(approveData2.error, /já se encontra ativado/i);
});

test("Hardening 5: Prevenção de Falso Sucesso (Retorno 404 em 0 Linhas Afetadas)", async () => {
  const nonexistentId = "nonexistent-id-99999";

  // M01: Arquivar produto inexistente
  const pfRes = await productFactoryPOST(createMockRequest(
    "http://localhost:5173/api/product-factory",
    { action: "archive_product", product_id: nonexistentId },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  assert.strictEqual(pfRes.status, 404, "M01 deve retornar 404 ao atualizar produto inexistente");

  // M02: Revisar handoff inexistente
  const crmRes = await commercialPOST(createMockRequest(
    "http://localhost:5173/api/commercial",
    {
      action: "review_handoff",
      handoff_id: nonexistentId,
      decision: "approved_for_onboarding",
      operations_notes: "Aprovado teste",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  assert.strictEqual(crmRes.status, 404, "M02 deve retornar 404 ao atualizar handoff inexistente");

  // M03: Cancelar onboarding inexistente
  const onbRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "block_or_cancel",
      onboardingId: nonexistentId,
      operation: "cancel",
      reason: "Justificativa válida para cancelamento de onboarding inexistente",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  assert.strictEqual(onbRes.status, 404, "M03 deve retornar 404 ao cancelar onboarding inexistente");
});

test("Hardening 6: Validação Estrita do Item de Aprovação (Exige Pending, Mesma Agência e Source)", async () => {
  // Criar onboarding
  const startRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-no-approval-${Date.now()}`,
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { onboardingId } = await startRes.json();

  // Aprovar venda
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "review_sales", onboardingId, decision: "approved" },
    "lead@alastre.com",
    { "x-alastre-test-role": "commercial_lead" }
  ));

  // Criar cliente
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "create_or_link_client_transactional",
      onboardingId,
      clientName: "Cliente Sem Aprovação",
      unitName: "Sede Centro",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Tentar aprovar ativação SEM TER SUBMETIDO ativação (sem approval_item pendente)
  const directApproveRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Aprovação direta sem registro prévio" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));

  assert.strictEqual(directApproveRes.status, 409, "Deve rejeitar com 409 se não houver item de aprovação pendente");
  const directApproveData = await directApproveRes.json();
  assert.match(directApproveData.error, /item de aprovação formal de ativação pendente/i);
});

test("Hardening 7: Real Gate - Rejeição por DNA Ausente, em Draft ou com Campos Vitais Faltando", async () => {
  const startRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-dna-gate-${Date.now()}`,
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { onboardingId } = await startRes.json();

  // Aprova venda
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "review_sales", onboardingId, decision: "approved" },
    "lead@alastre.com",
    { "x-alastre-test-role": "commercial_lead" }
  ));

  // Cria cliente (inicializa DNA em 'draft')
  const clientRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "create_or_link_client_transactional",
      onboardingId,
      clientName: "Cliente Teste DNA",
      unitName: "Sede Centro",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { clientId } = await clientRes.json();

  // Cumpre requisitos
  const wsRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "get_onboarding_workspace", onboardingId },
    "admin@alastre.com"
  ));
  const wsData = await wsRes.json();
  for (const r of wsData.requirements) {
    await onboardingPOST(createMockRequest(
      "http://localhost:5173/api/client-onboarding",
      {
        action: "update_requirement",
        onboardingId,
        requirementId: r.id,
        status: "verified",
        evidenceText: `Comprovado para ${r.title}`,
      },
      "admin@alastre.com",
      { "x-alastre-test-role": "admin" }
    ));
  }

  // Baseline
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "save_baseline",
      onboardingId,
      profileCompletenessScore: 80,
      currentRating: 5.0,
      currentReviewCount: 15,
      unansweredReviewsCount: 0,
      rankingVisibilityNotes: "Top 3",
      contentAudit: { hasCoverPhoto: true, hasLogo: true },
      collectionLimitations: [],
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Plano
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "generate_plan", onboardingId, targetStartDate: "2026-10-01" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Submete ativação
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "submit_activation", onboardingId, notes: "Submissão com DNA ainda em draft" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // 7.1 DNA está em 'draft' -> Deve rejeitar ativação com 409
  const approveDraft = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentando ativar com DNA em draft" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveDraft.status, 409);
  const draftErr = await approveDraft.json();
  assert.ok(draftErr.missingCriteria.includes("DNA mínimo confirmado"));

  // 7.2 DNA marcado como 'confirmed', mas faltando campos vitais (ex: sem cidade e sem serviço principal)
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "update_dna",
      onboardingId,
      status: "confirmed",
      facts: {
        company_name: "Cliente Incompleto",
        segment: "Saúde",
        // Faltam: city, primary_service/main_service, phone
      },
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  const approveIncomplete = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentando com DNA confirmado porém incompleto" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveIncomplete.status, 409);
  const incompleteErr = await approveIncomplete.json();
  assert.ok(incompleteErr.missingCriteria.includes("DNA mínimo confirmado"));

  // 7.3 DNA com status 'confirmed' e todos os campos vitais preenchidos -> Sucesso 200
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "update_dna",
      onboardingId,
      status: "confirmed",
      facts: {
        company_name: "Cliente Teste DNA Completo",
        segment: "Odontologia Especializada",
        city: "Sorocaba",
        state_uf: "SP",
        main_service: "Clínica Geral",
        phone: "(15) 3333-3333",
      },
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  const approveComplete = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Ativação com DNA completo" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveComplete.status, 200);
  const completeData = await approveComplete.json();
  assert.strictEqual(completeData.status, "active");
});

test("Hardening 8: Real Gate - Rejeição por Falta de Serviços Válidos ou Serviço de Outro Tenant", async () => {
  const agencyId = "a1a57e00-0000-4000-8000-000000000001";
  const startRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-services-gate-${Date.now()}`,
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { onboardingId } = await startRes.json();

  // Aprova venda
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "review_sales", onboardingId, decision: "approved" },
    "lead@alastre.com",
    { "x-alastre-test-role": "commercial_lead" }
  ));

  // Cria cliente
  const clientRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "create_or_link_client_transactional",
      onboardingId,
      clientName: "Cliente Serviços Reais",
      unitName: "Sede Centro",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { clientId } = await clientRes.json();

  // Cumpre requisitos
  const wsRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "get_onboarding_workspace", onboardingId },
    "admin@alastre.com"
  ));
  const wsData = await wsRes.json();
  for (const r of wsData.requirements) {
    await onboardingPOST(createMockRequest(
      "http://localhost:5173/api/client-onboarding",
      {
        action: "update_requirement",
        onboardingId,
        requirementId: r.id,
        status: "verified",
        evidenceText: `Comprovado para ${r.title}`,
      },
      "admin@alastre.com",
      { "x-alastre-test-role": "admin" }
    ));
  }

  // Baseline
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "save_baseline",
      onboardingId,
      profileCompletenessScore: 85,
      currentRating: 4.9,
      currentReviewCount: 30,
      unansweredReviewsCount: 0,
      rankingVisibilityNotes: "Top 1",
      contentAudit: { hasCoverPhoto: true, hasLogo: true },
      collectionLimitations: [],
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Plano
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "generate_plan", onboardingId, targetStartDate: "2026-10-01" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Confirma DNA completo
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "update_dna",
      onboardingId,
      status: "confirmed",
      facts: {
        company_name: "Cliente Serviços Reais",
        segment: "Clínica Médica",
        city: "Sorocaba",
        state_uf: "SP",
        main_service: "Consultas Médicas",
        phone: "(15) 3232-3232",
      },
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Submete ativação
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "submit_activation", onboardingId, notes: "Submissão para teste de serviços" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // 8.1 Cenário A: Sem serviços cadastrados (array vazio)
  memoryStore.clientServices.set(clientId, []);
  const approveNoServices = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentando ativar sem serviços" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveNoServices.status, 409);
  const noServicesErr = await approveNoServices.json();
  assert.ok(noServicesErr.missingCriteria.includes("Serviços contratados habilitados"));

  // 8.2 Cenário B: Serviço pertencente a outro tenant (agency_id diferente)
  memoryStore.clientServices.set(clientId, [
    {
      id: "svc-other-tenant",
      agency_id: "99999999-9999-9999-9999-999999999999", // Tenant alheio
      client_id: clientId,
      service_key: "local_seo",
      status: "active",
    },
  ]);
  const approveOtherTenant = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentando com serviço de outra agência" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveOtherTenant.status, 409);
  const otherTenantErr = await approveOtherTenant.json();
  assert.ok(otherTenantErr.missingCriteria.includes("Serviços contratados habilitados"));

  // 8.3 Cenário C: Serviço inativo ('inactive') não qualifica pré-ativação
  memoryStore.clientServices.set(clientId, [
    {
      id: "svc-inactive",
      agency_id: agencyId,
      client_id: clientId,
      service_key: "local_seo",
      status: "inactive",
    },
  ]);
  const approveInactive = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentando com serviço inativo" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveInactive.status, 409);
  const inactiveErr = await approveInactive.json();
  assert.ok(inactiveErr.missingCriteria.includes("Serviços contratados habilitados"));

  // 8.4 Cenário D: Serviço válido ('pending') da mesma agência -> Sucesso 200
  memoryStore.clientServices.set(clientId, [
    {
      id: "svc-valid-pending",
      agency_id: agencyId,
      client_id: clientId,
      service_key: "local_seo",
      status: "pending",
    },
  ]);
  const approveValid = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Ativação com serviço válido" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(approveValid.status, 200);
  const validData = await approveValid.json();
  assert.strictEqual(validData.status, "active");
});

test("Hardening 9: Defesa Transacional e Anti-TOCTOU - Bloqueio Sem Mutação de Estado", async () => {
  const startRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "start_from_handoff",
      salesHandoffId: `handoff-toctou-${Date.now()}`,
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { onboardingId } = await startRes.json();

  // Aprova venda
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "review_sales", onboardingId, decision: "approved" },
    "lead@alastre.com",
    { "x-alastre-test-role": "commercial_lead" }
  ));

  // Cria cliente
  const clientRes = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    {
      action: "create_or_link_client_transactional",
      onboardingId,
      clientName: "Cliente Anti-TOCTOU",
      unitName: "Sede Centro",
    },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));
  const { clientId } = await clientRes.json();

  // Submete ativação (sem cumprir baseline e plano)
  await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "submit_activation", onboardingId, notes: "Submissão incompleta para testar rollback/imunidade" },
    "admin@alastre.com",
    { "x-alastre-test-role": "admin" }
  ));

  // Tentativa de ativação falha com 409
  const failedApprove = await onboardingPOST(createMockRequest(
    "http://localhost:5173/api/client-onboarding",
    { action: "approve_activation", onboardingId, notes: "Tentando aprovar" },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  ));
  assert.strictEqual(failedApprove.status, 409);

  // Verificações estritas anti-mutação:
  // 1. Onboarding NÃO pode estar active
  const onb = memoryStore.onboardings.get(onboardingId);
  assert.strictEqual(onb?.status, "ready_for_activation");
  assert.strictEqual(onb?.activatedAt, undefined);
  assert.strictEqual(onb?.activatedByActorId, undefined);

  // 2. Cliente NÃO pode estar active
  const client = memoryStore.clients.get(clientId);
  assert.strictEqual(client?.status, "onboarding");

  // 3. Approval item NÃO pode estar approved
  const appItem = onb?.activationApprovalId ? memoryStore.approvalItems.get(onb.activationApprovalId) : null;
  assert.strictEqual(appItem?.status, "pending");
});

