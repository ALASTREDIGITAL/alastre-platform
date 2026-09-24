import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionOnboarding,
  validateSalesConference,
  calculateActivationChecklist,
  generateDefaultRequirements,
  validateBaselineData,
  generateImplementationPlanFromProduct,
  ONBOARDING_STAGES_META,
} from "../lib/client-onboarding-domain.ts";

test("03.1 Onboarding Domain: Metadados e estágios do ciclo de vida", () => {
  const stages = [
    "draft",
    "awaiting_commercial_review",
    "awaiting_operations_review",
    "awaiting_client_information",
    "collecting_access",
    "building_dna",
    "establishing_baseline",
    "planning_implementation",
    "ready_for_activation",
    "active",
    "blocked",
    "cancelled",
  ] as const;

  for (const stage of stages) {
    const meta = ONBOARDING_STAGES_META[stage];
    assert.ok(meta, `Estágio ${stage} deve possuir metadados definidos`);
    assert.strictEqual(meta.id, stage);
    assert.ok(meta.label.length > 0);
    assert.ok(meta.description.length > 0);
  }
});

test("03.1 Onboarding Domain: Tabela estrita de transições de estágio", () => {
  // Transições válidas do fluxo canônico
  assert.strictEqual(canTransitionOnboarding("draft", "awaiting_commercial_review"), true);
  assert.strictEqual(canTransitionOnboarding("awaiting_commercial_review", "awaiting_operations_review"), true);
  assert.strictEqual(canTransitionOnboarding("awaiting_operations_review", "awaiting_client_information"), true);
  assert.strictEqual(canTransitionOnboarding("awaiting_client_information", "collecting_access"), true);
  assert.strictEqual(canTransitionOnboarding("collecting_access", "building_dna"), true);
  assert.strictEqual(canTransitionOnboarding("building_dna", "establishing_baseline"), true);
  assert.strictEqual(canTransitionOnboarding("establishing_baseline", "planning_implementation"), true);
  assert.strictEqual(canTransitionOnboarding("planning_implementation", "ready_for_activation"), true);
  assert.strictEqual(canTransitionOnboarding("ready_for_activation", "active"), true);

  // Bloqueio e cancelamento são permitidos a partir da maioria dos estágios ativos
  assert.strictEqual(canTransitionOnboarding("awaiting_client_information", "blocked"), true);
  assert.strictEqual(canTransitionOnboarding("building_dna", "cancelled"), true);
  assert.strictEqual(canTransitionOnboarding("blocked", "awaiting_operations_review"), true);

  // Transições proibidas (saltos arbitrários e bypass de etapas)
  assert.strictEqual(canTransitionOnboarding("draft", "active"), false, "Rascunho não pode ir direto para ativo");
  assert.strictEqual(canTransitionOnboarding("draft", "ready_for_activation"), false, "Rascunho não pode pular para pronto para ativação");
  assert.strictEqual(canTransitionOnboarding("awaiting_commercial_review", "ready_for_activation"), false);
  assert.strictEqual(canTransitionOnboarding("cancelled", "active"), false, "Cancelado é estado terminal");
  assert.strictEqual(canTransitionOnboarding("active", "draft"), false, "Ativo não pode regredir para rascunho");
  assert.strictEqual(canTransitionOnboarding("blocked", "active"), false, "Bloqueado não pode ir direto para ativo sem resolver etapas");
});

test("03.2 Conferência da Venda: Handoff aprovado e integridade de dados", () => {
  const validSale = {
    handoffStatus: "approved_for_onboarding",
    companyName: "Clínica Odonto Viva Sorocaba",
    contactsCount: 2,
    primaryContactName: "Dra. Juliana Mendes",
    productDefinitionId: "prod-seo-local-canonical",
    productVersion: 1,
    isProductApproved: true,
    setupPrice: 1500,
    monthlyPrice: 1200,
    hasSelectedScope: true,
    clientExpectations: "Aumentar agendamentos locais e ligações qualificadas",
    promisesMade: "Otimização de 18 pontos do Perfil Google e gestão de avaliações",
    operationalRisks: "Acesso de gerente ao GBP ainda não concedido pelo proprietário anterior",
    criticalDependencies: "Envio de fotos em alta resolução da fachada",
  };

  const result = validateSalesConference(validSale);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blockingIssues.length, 0);
  assert.strictEqual(result.divergenceReason, undefined);
});

test("03.2 Conferência da Venda: Rejeita handoff não aprovado ou incompleto", () => {
  const unapprovedSale = {
    handoffStatus: "draft", // Não aprovado
    companyName: "Loja Teste",
    contactsCount: 0, // Sem contatos
    primaryContactName: undefined,
    productDefinitionId: undefined, // Sem produto vinculado
    productVersion: 1,
    isProductApproved: false, // Produto não aprovado
    setupPrice: -500, // Preço negativo
    monthlyPrice: 1000,
    hasSelectedScope: false,
  };

  const result = validateSalesConference(unapprovedSale);
  assert.strictEqual(result.valid, false);
  assert.ok(result.blockingIssues.length >= 4);
  assert.ok(result.divergenceReason?.includes("Divergência na conferência da venda"));
});

test("03.2 Conferência da Venda: Salvaguarda contra promessas de resultado externo proibidas", () => {
  const saleWithPromise = {
    handoffStatus: "approved_for_onboarding",
    companyName: "Auto Peças Sorocaba",
    contactsCount: 1,
    primaryContactName: "Carlos Alberto",
    productDefinitionId: "prod-seo-local-canonical",
    productVersion: 1,
    isProductApproved: true,
    setupPrice: 1000,
    monthlyPrice: 800,
    hasSelectedScope: true,
    promisesMade: "Prometemos garantia de 1º lugar no Google em 30 dias!",
  };

  const result = validateSalesConference(saleWithPromise);
  assert.strictEqual(result.valid, false);
  assert.ok(result.blockingIssues.some((issue) => issue.includes("Promessa indevida detectada")));
  assert.ok(result.divergenceReason?.includes("garantia de 1º lugar"));
});

test("03.5 Requisitos de Coleta: Geração dos 12 requisitos padrão", () => {
  const reqs = generateDefaultRequirements({
    agencyId: "agency-123",
    onboardingId: "onb-456",
    clientId: "client-789",
    unitId: "unit-001",
  });

  assert.strictEqual(reqs.length, 12, "Deve gerar exatamente as 12 categorias canônicas");

  const categories = reqs.map((r) => r.category);
  assert.ok(categories.includes("business_data"));
  assert.ok(categories.includes("key_contacts"));
  assert.ok(categories.includes("access_credentials"));
  assert.ok(categories.includes("products_services"));
  assert.ok(categories.includes("locations_and_hours"));
  assert.ok(categories.includes("consents_agreements"));

  // Requisitos críticos devem bloquear ativação
  const napReq = reqs.find((r) => r.category === "business_data");
  assert.strictEqual(napReq?.blocksActivation, true);
  assert.strictEqual(napReq?.isRequired, true);

  const accessReq = reqs.find((r) => r.category === "access_credentials");
  assert.strictEqual(accessReq?.blocksActivation, true);
});

test("03.8 Baseline: Validação contra zeros sintéticos e ausência de evidências", () => {
  // Baseline com nota 0.0 sem limitação documentada
  const invalidBaseline = validateBaselineData({
    source: "manual_audit",
    currentRating: 0,
    currentReviewCount: null,
    collectionLimitations: [],
  });
  assert.strictEqual(invalidBaseline.valid, false);
  assert.ok(invalidBaseline.warnings.length >= 1);

  // Baseline factual com explicitação de dados ausentes
  const validBaseline = validateBaselineData({
    source: "manual_audit",
    currentRating: 4.8,
    currentReviewCount: 32,
    collectionLimitations: ["Dados de chamadas indisponíveis antes do início da gestão"],
  });
  assert.strictEqual(validBaseline.valid, true);
  assert.strictEqual(validBaseline.warnings.length, 0);
});

test("03.9 Plano de Implantação: Geração a partir de itens de escopo e cálculo de tempos", () => {
  const scopeItems = [
    {
      id: "scope-1",
      activityName: "Auditoria Completa 18 Itens Perfil Google",
      description: "Verificação dos 18 pontos do Perfil da Empresa",
      deliveryType: "setup" as const,
      frequency: "once" as const,
      defaultRole: "analyst",
      estimatedMinutes: 60,
      isAutomatable: true,
      clientParticipationRequired: false,
      dependencies: [],
      acceptanceCriteria: "Checklist de 18 pontos preenchido",
      requiredEvidence: "Relatório de auditoria salvo",
    },
    {
      id: "scope-2",
      activityName: "Programação de 12 Postagens Mensais",
      description: "Publicação de 3 posts por semana com novidades e ofertas",
      deliveryType: "recurring" as const,
      frequency: "monthly" as const,
      defaultRole: "analyst",
      estimatedMinutes: 180,
      isAutomatable: false,
      clientParticipationRequired: true,
      dependencies: ["scope-1"],
      acceptanceCriteria: "Postagens agendadas no calendário",
      requiredEvidence: "Links e previews aprovados",
    },
  ];

  const plan = generateImplementationPlanFromProduct({
    scopeItems,
    targetStartDate: "2026-10-01",
  });

  assert.strictEqual(plan.items.length, 2);
  assert.strictEqual(plan.totalSetupMinutes, 60);
  assert.strictEqual(plan.totalRecurringMonthlyMinutes, 180);
  assert.strictEqual(plan.items[0].plannedStartDate, "2026-10-01");
  assert.strictEqual(plan.items[0].deliveryType, "setup");
  assert.strictEqual(plan.items[1].deliveryType, "recurring");
});

test("03.10 Critérios de Ativação: Bloqueio quando critérios essenciais faltam", () => {
  const pendingActivation = calculateActivationChecklist({
    isSalesVerified: true,
    hasValidClient: true,
    unitsCount: 1,
    enabledServicesCount: 1,
    isDnaMinimumConfirmed: false, // Faltando
    pendingRequiredAccesses: 1,   // Faltando
    hasBaseline: false,          // Faltando
    hasImplementationPlan: false, // Faltando
    hasAssignedResponsible: true,
    hasOpenBlockers: false,
    isHumanApprovalRecorded: false,
  });

  assert.strictEqual(pendingActivation.isReady, false);
  assert.ok(pendingActivation.score < 100);
  assert.ok(pendingActivation.missingCriteria.includes("DNA mínimo confirmado"));
  assert.ok(pendingActivation.missingCriteria.includes("Baseline inicial estruturado"));
  assert.ok(pendingActivation.missingCriteria.includes("Plano de implantação gerado"));
});

test("03.10 Critérios de Ativação: Pronto quando todos os 11 critérios estão cumpridos", () => {
  const readyActivation = calculateActivationChecklist({
    isSalesVerified: true,
    hasValidClient: true,
    unitsCount: 1,
    enabledServicesCount: 1,
    isDnaMinimumConfirmed: true,
    pendingRequiredAccesses: 0,
    hasBaseline: true,
    hasImplementationPlan: true,
    hasAssignedResponsible: true,
    hasOpenBlockers: false,
    isHumanApprovalRecorded: true,
  });

  assert.strictEqual(readyActivation.isReady, true);
  assert.strictEqual(readyActivation.score, 100);
  assert.strictEqual(readyActivation.missingCriteria.length, 0);
  assert.strictEqual(readyActivation.items.every((i) => i.fulfilled), true);
});
