import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/client-onboarding/route.ts";

Object.assign(process.env, { NODE_ENV: "development" });

function createMockRequest(
  body: unknown,
  authenticatedEmail: string | null = "operator@alastre.com",
  extraHeaders: Record<string, string> = {}
): Request {
  const headers = new Headers();
  if (authenticatedEmail) {
    headers.set("oai-authenticated-user-email", authenticatedEmail);
  }
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }
  return new Request("http://localhost:5173/api/client-onboarding", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("03. API: Rejeita requisições não autenticadas em produção (Fail-secure)", async () => {
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    const req = createMockRequest({ action: "list_onboardings" }, null);
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, "Acesso não identificado.");
  } finally {
    Object.assign(process.env, { NODE_ENV: "development" });
  }
});

test("03. API: Rejeita payloads inválidos ou ações desconhecidas (Zod validation)", async () => {
  const req = createMockRequest({ action: "invalid_action_unknown" });
  const res = await POST(req);
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.error, "Payload inválido.");
});

test("03. API: Ciclo de vida operacional completo do Onboarding", async () => {
  // 1. Iniciar Onboarding a partir de Handoff
  const handoffId = `handoff-test-${Date.now()}`;
  const startReq = createMockRequest({
    action: "start_from_handoff",
    salesHandoffId: handoffId,
    idempotencyKey: `idem-${Date.now()}`,
  });
  const startRes = await POST(startReq);
  assert.strictEqual(startRes.status, 200);
  const startData = await startRes.json();
  assert.strictEqual(startData.success, true);
  assert.ok(startData.onboardingId);
  const onboardingId = startData.onboardingId;

  // 1.1 Idempotência: Iniciar novamente com o mesmo handoff deve retornar o mesmo onboardingId
  const repeatReq = createMockRequest({
    action: "start_from_handoff",
    salesHandoffId: handoffId,
  });
  const repeatRes = await POST(repeatReq);
  assert.strictEqual(repeatRes.status, 200);
  const repeatData = await repeatRes.json();
  assert.strictEqual(repeatData.onboardingId, onboardingId);

  // 2. Obter Workspace inicial
  const wsReq = createMockRequest({
    action: "get_onboarding_workspace",
    onboardingId,
  });
  const wsRes = await POST(wsReq);
  assert.strictEqual(wsRes.status, 200);
  const wsData = await wsRes.json();
  assert.strictEqual(wsData.onboarding.id, onboardingId);
  assert.strictEqual(wsData.onboarding.status, "awaiting_commercial_review");
  assert.strictEqual(wsData.requirements.length, 12, "Deve inicializar com 12 requisitos padrão");
  assert.strictEqual(wsData.readiness.isReady, false);

  // 3. Conferência da Venda: Aprovar revisão comercial
  const reviewReq = createMockRequest({
    action: "review_sales",
    onboardingId,
    decision: "approved",
    notes: "Escopo e valores conferidos com sucesso.",
  });
  const reviewRes = await POST(reviewReq);
  assert.strictEqual(reviewRes.status, 200);
  const reviewData = await reviewRes.json();
  assert.strictEqual(reviewData.status, "awaiting_operations_review");

  // 4. Criação Transacional de Cliente e Unidade Sede
  const createClientReq = createMockRequest({
    action: "create_or_link_client_transactional",
    onboardingId,
    clientName: "Vidraçaria Cristal Sorocaba",
    unitName: "Vidraçaria Cristal - Sede Campolim",
    unitCity: "Sorocaba",
    unitStateUf: "SP",
  });
  const createClientRes = await POST(createClientReq);
  assert.strictEqual(createClientRes.status, 200);
  const createClientData = await createClientRes.json();
  assert.strictEqual(createClientData.success, true);
  assert.ok(createClientData.clientId);
  assert.ok(createClientData.unitId);
  assert.strictEqual(createClientData.status, "awaiting_client_information");

  // 5. Cadastrar Unidade Adicional (Filial)
  const addUnitReq = createMockRequest({
    action: "upsert_unit",
    onboardingId,
    name: "Vidraçaria Cristal - Filial Votorantim",
    unitType: "branch",
    isPhysicalStore: true,
    hasServiceArea: true,
    serviceRadiusKm: 25,
    city: "Votorantim",
    stateUf: "SP",
  });
  const addUnitRes = await POST(addUnitReq);
  assert.strictEqual(addUnitRes.status, 200);
  const addUnitData = await addUnitRes.json();
  assert.strictEqual(addUnitData.success, true);
  assert.strictEqual(addUnitData.unit.name, "Vidraçaria Cristal - Filial Votorantim");

  // 6. Atualizar Requisito com Verificação e com Dispensa Justificada
  const req1 = wsData.requirements[0]; // Dados fiscais
  const verifyReq = createMockRequest({
    action: "update_requirement",
    onboardingId,
    requirementId: req1.id,
    status: "verified",
    evidenceText: "Cartão CNPJ e contrato social conferidos",
  });
  const verifyRes = await POST(verifyReq);
  assert.strictEqual(verifyRes.status, 200);

  const req2 = wsData.requirements[10]; // Histórico da empresa
  const waiveReq = createMockRequest({
    action: "update_requirement",
    onboardingId,
    requirementId: req2.id,
    status: "waived",
    waivedReason: "Cliente recém-aberto, sem histórico comercial prévio relevante.",
  });
  const waiveRes = await POST(waiveReq);
  assert.strictEqual(waiveRes.status, 200);

  // 6.1 Rejeita dispensa sem justificativa
  const invalidWaiveReq = createMockRequest({
    action: "update_requirement",
    onboardingId,
    requirementId: req2.id,
    status: "waived",
    waivedReason: "",
  });
  const invalidWaiveRes = await POST(invalidWaiveReq);
  assert.strictEqual(invalidWaiveRes.status, 400);

  // 6.2 Atualizar e Confirmar DNA com campos mínimos
  const dnaReq = createMockRequest({
    action: "update_dna",
    onboardingId,
    status: "confirmed",
    facts: {
      company_name: "Vidraçaria Cristal Sorocaba",
      segment: "Vidraçaria e Esquadrias",
      city: "Sorocaba",
      state_uf: "SP",
      primary_service: "Instalação de Vidros Temperados",
      phone: "(15) 3211-0000",
    },
  });
  const dnaRes = await POST(dnaReq);
  assert.strictEqual(dnaRes.status, 200);

  // 7. Salvar Baseline Factual
  const baselineReq = createMockRequest({
    action: "save_baseline",
    onboardingId,
    profileCompletenessScore: 65,
    currentRating: 4.7,
    currentReviewCount: 18,
    unansweredReviewsCount: 3,
    rankingVisibilityNotes: "Posição 8 média no Local Pack para 'vidraçaria sorocaba'.",
    contentAudit: { hasCoverPhoto: true, hasLogo: true, photosCount: 6, hasAttributes: false },
    collectionLimitations: ["Histórico de chamadas não integrado antes do início do contrato"],
  });
  const baselineRes = await POST(baselineReq);
  assert.strictEqual(baselineRes.status, 200);
  const baselineData = await baselineRes.json();
  assert.strictEqual(baselineData.success, true);
  assert.strictEqual(baselineData.baseline.currentRating, 4.7);

  // 8. Gerar Plano de Implantação
  const planReq = createMockRequest({
    action: "generate_plan",
    onboardingId,
    targetStartDate: "2026-10-01",
  });
  const planRes = await POST(planReq);
  assert.strictEqual(planRes.status, 200);
  const planData = await planRes.json();
  assert.strictEqual(planData.success, true);
  assert.ok(planData.plan.items.length > 0);
  assert.ok(planData.plan.totalSetupMinutes > 0);

  // 9. Calcular Prontidão
  const readinessReq = createMockRequest({
    action: "calculate_readiness",
    onboardingId,
  });
  const readinessRes = await POST(readinessReq);
  assert.strictEqual(readinessRes.status, 200);

  // 10. Submeter para Ativação (Approval Gate)
  const submitReq = createMockRequest({
    action: "submit_activation",
    onboardingId,
    notes: "Tudo pronto e conferido para ativação.",
  });
  const submitRes = await POST(submitReq);
  assert.strictEqual(submitRes.status, 200);

  // 10.1 Prova do Activation Gate Real: com requisitos pendentes, aprovação deve falhar com 409
  const prematureApproveReq = createMockRequest(
    {
      action: "approve_activation",
      onboardingId,
      notes: "Tentativa de ativação prematura.",
    },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  );
  const prematureApproveRes = await POST(prematureApproveReq);
  assert.strictEqual(prematureApproveRes.status, 409);
  const prematureData = await prematureApproveRes.json();
  assert.ok(prematureData.missingCriteria.length > 0);

  // 10.2 Cumprir ou dispensar justificadamente todos os requisitos obrigatórios restantes
  for (const r of wsData.requirements) {
    if (r.id !== req1.id && r.id !== req2.id) {
      const fulfillReq = createMockRequest({
        action: "update_requirement",
        onboardingId,
        requirementId: r.id,
        status: "verified",
        evidenceText: `Comprovante validado para ${r.title}`,
      });
      const fulfillRes = await POST(fulfillReq);
      assert.strictEqual(fulfillRes.status, 200);
    }
  }

  // 11. Aprovar Ativação Operacional
  const approveReq = createMockRequest(
    {
      action: "approve_activation",
      onboardingId,
      notes: "Ativação autorizada pela liderança.",
    },
    "lead@alastre.com",
    { "x-alastre-test-role": "operations_lead" }
  );
  const approveRes = await POST(approveReq);
  assert.strictEqual(approveRes.status, 200);
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.status, "active");
  assert.ok(approveData.activatedAt);
});

test("03. API: Fluxo de Divergência Comercial bloqueia e não cria cliente", async () => {
  // Iniciar onboarding
  const handoffId = `handoff-divergent-${Date.now()}`;
  const startReq = createMockRequest({
    action: "start_from_handoff",
    salesHandoffId: handoffId,
  });
  const startRes = await POST(startReq);
  const { onboardingId } = await startRes.json();

  // Registrar divergência
  const divReq = createMockRequest({
    action: "record_divergence",
    onboardingId,
    reason: "Promessa comercial de ranking número 1 garantido em contrato divergente da política.",
    issues: ["promessa_indevida_ranking"],
  });
  const divRes = await POST(divReq);
  assert.strictEqual(divRes.status, 200);
  const divData = await divRes.json();
  assert.strictEqual(divData.status, "blocked");
  assert.ok(divData.divergenceReason.includes("ranking"));

  // Verificar Workspace: está bloqueado e sem cliente
  const wsReq = createMockRequest({
    action: "get_onboarding_workspace",
    onboardingId,
  });
  const wsRes = await POST(wsReq);
  const wsData = await wsRes.json();
  assert.strictEqual(wsData.onboarding.status, "blocked");
  assert.strictEqual(wsData.client, null, "Cliente NÃO deve ser criado quando houver divergência");
});
