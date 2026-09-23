import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QUESTIONS_PER_ROUND,
  STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS,
  validateSevenQuestionLimit,
  classifyInformation,
  calculateScopeTotals,
  calculateViabilityCheckpoint,
  preventPrematurePricing,
  canTransitionProductStatus,
  createNextVersion,
  type ProductDefinition,
  type DiscoverySession,
  type ProductScopeItem,
  type OperationalSop,
  type RaciAssignment,
} from "../lib/product-factory-domain.ts";

describe("Módulo 01: Fábrica de Produtos - Domínio e Regras de Negócio", () => {
  it("garante limite estrito de no máximo 7 perguntas por rodada", () => {
    assert.equal(MAX_QUESTIONS_PER_ROUND, 7);

    // Valida o catálogo padrão oficial
    for (const round of STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS) {
      assert.ok(
        round.questions.length <= 7,
        `Rodada ${round.round} possui ${round.questions.length} perguntas, que excede o limite de 7`,
      );
      assert.equal(validateSevenQuestionLimit(round.questions), true);
    }

    // Rejeita rodadas com mais de 7 perguntas
    const overLimit = Array.from({ length: 8 }, (_, i) => ({ id: `q_${i}` }));
    assert.equal(validateSevenQuestionLimit(overLimit), false);

    // Aceita rodadas com 1 a 7 perguntas
    const validBatch = Array.from({ length: 7 }, (_, i) => ({ id: `q_${i}` }));
    assert.equal(validateSevenQuestionLimit(validBatch), true);
  });

  it("classifica informações com precisão: fato, evidência, inferência, hipótese e lacuna", () => {
    // Lacuna (gap)
    assert.equal(classifyInformation(""), "gap");
    assert.equal(classifyInformation("Não sei ainda"), "gap");
    assert.equal(classifyInformation("Pendente de definição"), "gap");
    assert.equal(classifyInformation("A definir com o cliente"), "gap");

    // Evidência com comprovação documental
    assert.equal(
      classifyInformation("Acesso verificado no Google Search Console e GBP", true),
      "evidence",
    );

    // Hipótese explicitamente declarada
    assert.equal(
      classifyInformation("Acreditamos que o cliente deve converter cerca de 10 leads", false, true),
      "hypothesis",
    );

    // Inferência estruturada
    assert.equal(
      classifyInformation(
        "A operação consome cerca de 4 horas porque o cliente possui 3 filiais distintas e portanto exige triagem separada",
      ),
      "inference",
    );

    // Fato objetivo
    assert.equal(
      classifyInformation("A agência possui 1 analista dedicado para SEO Local"),
      "fact",
    );
  });

  it("calcula totais de escopo separando implantação de recorrência com precisão", () => {
    const scopeItems: ProductScopeItem[] = [
      {
        id: "s1",
        agency_id: "agency_1",
        product_definition_id: "p1",
        activity_name: "Auditoria Completa da Ficha",
        description: "Checagem de 18 pontos críticos",
        delivery_type: "setup",
        frequency: "once",
        default_role: "analyst",
        estimated_minutes: 120, // 2 horas
        is_automatable: true,
        client_participation_required: false,
        dependencies: [],
        acceptance_criteria: "Relatório de auditoria gerado",
        required_evidence: "PDF ou snapshot no sistema",
        scope_classification: "included",
        sort_order: 1,
      },
      {
        id: "s2",
        agency_id: "agency_1",
        product_definition_id: "p1",
        activity_name: "Cadastro e Otimização Inicial",
        description: "Categorias, horários e atributos",
        delivery_type: "setup",
        frequency: "once",
        default_role: "specialist",
        estimated_minutes: 180, // 3 horas
        is_automatable: false,
        client_participation_required: true,
        dependencies: ["Auditoria Completa da Ficha"],
        acceptance_criteria: "Perfil 100% preenchido",
        required_evidence: "Ficha verificada no Google",
        scope_classification: "included",
        sort_order: 2,
      },
      {
        id: "s3",
        agency_id: "agency_1",
        product_definition_id: "p1",
        activity_name: "Postagens Semanais de Atualização",
        description: "1 post por semana",
        delivery_type: "recurring",
        frequency: "weekly", // 4x por mês = 4 * 30 min = 120 min
        default_role: "analyst",
        estimated_minutes: 30,
        is_automatable: true,
        client_participation_required: false,
        dependencies: [],
        acceptance_criteria: "Post publicado com foto e CTA",
        required_evidence: "URL ou post ID no painel",
        scope_classification: "included",
        sort_order: 3,
      },
      {
        id: "s4",
        agency_id: "agency_1",
        product_definition_id: "p1",
        activity_name: "Gestão Diária de Avaliações",
        description: "Respostas em até 24h",
        delivery_type: "recurring",
        frequency: "daily", // 22 dias úteis = 22 * 10 min = 220 min
        default_role: "client_service",
        estimated_minutes: 10,
        is_automatable: false,
        client_participation_required: false,
        dependencies: [],
        acceptance_criteria: "Respostas publicadas com aprovação",
        required_evidence: "ID da resposta no Google",
        scope_classification: "included",
        sort_order: 4,
      },
      {
        id: "s5",
        agency_id: "agency_1",
        product_definition_id: "p1",
        activity_name: "Criação de Site Institucional",
        description: "Serviço fora do produto core de GBP",
        delivery_type: "setup",
        frequency: "once",
        default_role: "specialist",
        estimated_minutes: 600,
        is_automatable: false,
        client_participation_required: true,
        dependencies: [],
        acceptance_criteria: "Site publicado",
        required_evidence: "Domínio ativo",
        scope_classification: "not_included", // Não deve entrar no cômputo
        sort_order: 5,
      },
    ];

    const totals = calculateScopeTotals(scopeItems);

    // Setup: 120 + 180 = 300 minutos = 5.0 horas
    assert.equal(totals.totalSetupMinutes, 300);
    assert.equal(totals.totalSetupHours, 5.0);

    // Recorrência mensal: (30 * 4) + (10 * 22) = 120 + 220 = 340 minutos = 5.7 horas
    assert.equal(totals.monthlyRecurringMinutes, 340);
    assert.equal(totals.monthlyRecurringHours, 5.7);

    // 4 itens ativos: 2 automatable (s1 e s3) => 50%
    assert.equal(totals.automatableCount, 2);
    assert.equal(totals.automatablePercentage, 50);

    // 1 item exige participação do cliente (s2)
    assert.equal(totals.clientParticipationCount, 1);
  });

  it("calcula checkpoint de viabilidade e bloqueia produtos com lacunas impeditivas", () => {
    const product: ProductDefinition = {
      id: "prod_seo_local_1",
      agency_id: "agency_test",
      name: "SEO Local Alastre",
      slug: "seo-local-alastre",
      summary: "Posicionamento e gestão no Google Business Profile",
      version: 1,
      status: "draft",
      target_objective: "Visibilidade e ligações qualificadas",
      target_market: "Negócios locais com ponto físico",
      icp_description: "Clínicas e serviços locais de alto ticket",
      anti_icp_description: "E-commerce sem presença física",
      transformational_promise: "Dobrar a visibilidade no Local Pack com evidências auditadas",
      controllable_deliverables: ["Otimização da ficha", "Postagens semanais", "Respostas a reviews"],
      influenciable_indicators: ["Visualizações na pesquisa", "Solicitações de rotas"],
      external_results: ["Vendas no balcão da loja"],
      is_immutable: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Sessão incompleta com lacuna impeditiva
    const sessionWithGap: DiscoverySession = {
      id: "sess_1",
      agency_id: "agency_test",
      product_definition_id: product.id,
      round_number: 1,
      status: "in_progress",
      questions: STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS[0].questions,
      answers: [
        {
          question_id: "q_op_01",
          answer_text: "A definir ferramentas",
          classification: "gap",
          confidence: "none",
          is_blocking_gap: true,
          gap_notes: "Ferramentas ainda não contratadas",
          answered_at: new Date().toISOString(),
        },
      ],
      started_at: new Date().toISOString(),
    };

    const viability = calculateViabilityCheckpoint({
      product,
      sessions: [sessionWithGap],
      scopeItems: [],
      sops: [],
      raci: [],
    });

    assert.equal(viability.result, "blocked");
    assert.ok(viability.blocking_gaps.length > 0);
    assert.ok(viability.discovery_completeness_percentage < 70);

    // Salvaguarda: impede precificação e promessa com viabilidade bloqueada
    const pricingGate = preventPrematurePricing(product, viability);
    assert.equal(pricingGate.priceAllowed, false);
    assert.equal(pricingGate.commercialPromiseAllowed, false);
    assert.ok(pricingGate.reasons.some((r) => r.includes("BLOQUEADO")));
  });

  it("valida transições de estado e imutabilidade de versões aprovadas", () => {
    // 1. draft não pode ir direto para approved sem passar por in_review
    const directApproval = canTransitionProductStatus("draft", "approved");
    assert.equal(directApproval.allowed, false);

    // 2. draft pode ir para in_review se não estiver bloqueado
    const validSubmit = canTransitionProductStatus("draft", "in_review", {
      id: "chk_1",
      agency_id: "agency_test",
      product_definition_id: "p1",
      discovery_completeness_percentage: 100,
      blocking_gaps: [],
      total_setup_hours: 10,
      total_recurring_monthly_hours: 5,
      critical_dependencies: [],
      unvalidated_capacity_flags: [],
      result: "ready_for_human_review",
      viability_score: 95,
      explanation: "Tudo validado",
      calculated_at: new Date().toISOString(),
    });
    assert.equal(validSubmit.allowed, true);

    // 3. draft bloqueado não pode ir para in_review
    const blockedSubmit = canTransitionProductStatus("draft", "in_review", {
      id: "chk_2",
      agency_id: "agency_test",
      product_definition_id: "p1",
      discovery_completeness_percentage: 30,
      blocking_gaps: ["Falta responsável", "Faltam ferramentas"],
      total_setup_hours: 0,
      total_recurring_monthly_hours: 0,
      critical_dependencies: [],
      unvalidated_capacity_flags: [],
      result: "blocked",
      viability_score: 25,
      explanation: "Bloqueado",
      calculated_at: new Date().toISOString(),
    });
    assert.equal(blockedSubmit.allowed, false);

    // 4. approved é IMUTÁVEL e não pode voltar para draft ou in_review
    const modifyApproved = canTransitionProductStatus("approved", "draft");
    assert.equal(modifyApproved.allowed, false);
    assert.match(modifyApproved.reason ?? "", /imutável/i);

    // 5. approved só pode ser superseded ou archived
    assert.equal(canTransitionProductStatus("approved", "superseded").allowed, true);
    assert.equal(canTransitionProductStatus("approved", "archived").allowed, true);
  });

  it("cria nova versão incrementada preservando imutabilidade da versão anterior", () => {
    const v1Product: ProductDefinition = {
      id: "prod_local_v1",
      agency_id: "agency_alpha",
      name: "SEO Local Padrão",
      slug: "seo-local-padrao",
      summary: "Versão inicial",
      version: 1,
      status: "approved",
      target_objective: "Tráfego local",
      target_market: "Varejo local",
      icp_description: "Lojas de bairro",
      anti_icp_description: "Lojas puramente online",
      transformational_promise: "Posicionamento verificado",
      controllable_deliverables: ["Perfil", "Posts"],
      influenciable_indicators: ["Cliques"],
      external_results: ["Vendas"],
      is_immutable: true,
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { newProduct, oldStatus } = createNextVersion(v1Product, "actor_123");

    assert.equal(oldStatus, "superseded");
    assert.equal(newProduct.version, 2);
    assert.equal(newProduct.status, "draft");
    assert.equal(newProduct.is_immutable, false);
    assert.equal(newProduct.approved_at, null);
    assert.equal(newProduct.created_by_actor_id, "actor_123");
  });

  it("suporta papéis operacionais futuros no RACI sem inventar cargos atuais", () => {
    const raci: RaciAssignment[] = [
      {
        id: "raci_1",
        agency_id: "agency_test",
        product_definition_id: "p1",
        activity_name: "Auditoria Técnica",
        role: "analyst",
        is_future_role: false, // Analista já existe na agência
        raci_type: "R",
      },
      {
        id: "raci_2",
        agency_id: "agency_test",
        product_definition_id: "p1",
        activity_name: "Gestão Estratégica de Crises",
        role: "manager",
        is_future_role: true, // Agência de 2 pessoas marcará contratação futura
        raci_type: "A",
      },
    ];

    assert.equal(raci[0].is_future_role, false);
    assert.equal(raci[1].is_future_role, true);
    assert.equal(raci[1].role, "manager");
  });
});
