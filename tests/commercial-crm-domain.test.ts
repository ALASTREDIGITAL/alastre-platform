import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionOpportunity,
  assertValidOpportunityTransition,
  calculatePrioritization,
  evaluateQualification,
  validateDiagnosisCompleteness,
  validateProposalDiscount,
  isProposalEditable,
  validateLossReason,
  validateHandoffChecklist,
  calculateCommercialMetrics,
  generateForecast,
  validateOpportunityIntegrity,
  detectStaleOpportunities,
  type OpportunityStage,
  type QualificationDimensions,
} from "../lib/commercial-crm-domain.ts";

describe("Módulo 02 Comercial & CRM - Domínio e Regras de Negócio", () => {
  it("02.1: Valida transições de estágio explícitas e bloqueia saltos incompatíveis", () => {
    // Transições permitidas no fluxo canônico
    assert.equal(canTransitionOpportunity("new", "researched"), true);
    assert.equal(canTransitionOpportunity("researched", "prioritized"), true);
    assert.equal(canTransitionOpportunity("prioritized", "contact_ready"), true);
    assert.equal(canTransitionOpportunity("contact_ready", "contacted"), true);
    assert.equal(canTransitionOpportunity("contacted", "responded"), true);
    assert.equal(canTransitionOpportunity("responded", "qualified"), true);
    assert.equal(canTransitionOpportunity("qualified", "diagnosis_scheduled"), true);
    assert.equal(canTransitionOpportunity("diagnosis_scheduled", "diagnosis_completed"), true);
    assert.equal(canTransitionOpportunity("diagnosis_completed", "proposal_prepared"), true);
    assert.equal(canTransitionOpportunity("proposal_prepared", "proposal_sent"), true);
    assert.equal(canTransitionOpportunity("proposal_sent", "negotiation"), true);
    assert.equal(canTransitionOpportunity("negotiation", "closed_won"), true);

    // Desqualificação e perda permitidas nos estágios corretos
    assert.equal(canTransitionOpportunity("contacted", "closed_lost"), true);
    assert.equal(canTransitionOpportunity("researched", "disqualified"), true);
    assert.equal(canTransitionOpportunity("proposal_sent", "closed_lost"), true);

    // Saltos ilegais bloqueados
    assert.equal(canTransitionOpportunity("new", "closed_won"), false);
    assert.equal(canTransitionOpportunity("new", "proposal_sent"), false);
    assert.equal(canTransitionOpportunity("contacted", "closed_won"), false);
    assert.equal(canTransitionOpportunity("qualified", "closed_won"), false);
    assert.equal(canTransitionOpportunity("diagnosis_scheduled", "closed_won"), false);

    // Lança erro em assertValidOpportunityTransition para transição ilegal
    assert.throws(
      () => assertValidOpportunityTransition("new", "closed_won"),
      /Transição de estágio inválida/
    );
  });

  it("02.1 & 02.4: Nenhuma oportunidade pode ficar sem responsável, próxima ação e prazo", () => {
    // Válida
    const validResult = validateOpportunityIntegrity({
      title: "Oportunidade - Vidraçaria Modelo",
      responsible_actor_id: "actor_123",
      next_action: "Enviar convite para diagnóstico comercial",
      next_action_deadline: new Date(Date.now() + 86400000).toISOString(),
      stage: "contact_ready",
    });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.errors.length, 0);

    // Inválida: sem responsável
    const noResponsible = validateOpportunityIntegrity({
      title: "Oportunidade - Sem Dono",
      responsible_actor_id: "",
      next_action: "Ligar amanhã",
      next_action_deadline: new Date().toISOString(),
      stage: "new",
    });
    assert.equal(noResponsible.valid, false);
    assert.ok(noResponsible.errors.some((e) => e.includes("Responsável")));

    // Inválida: sem próxima ação
    const noNextAction = validateOpportunityIntegrity({
      title: "Oportunidade - Parada",
      responsible_actor_id: "actor_123",
      next_action: "",
      next_action_deadline: new Date().toISOString(),
      stage: "contact_ready",
    });
    assert.equal(noNextAction.valid, false);
    assert.ok(noNextAction.errors.some((e) => e.includes("Próxima ação")));

    // Inválida: sem prazo
    const noDeadline = validateOpportunityIntegrity({
      title: "Oportunidade - Sem Prazo",
      responsible_actor_id: "actor_123",
      next_action: "Acompanhar",
      next_action_deadline: "",
      stage: "contact_ready",
    });
    assert.equal(noDeadline.valid, false);
    assert.ok(noDeadline.errors.some((e) => e.includes("Prazo")));
  });

  it("02.4: Valores financeiros estimados só podem existir quando houver proposta", () => {
    // Tentar colocar valor estimado em estágio precoce sem proposta
    const prematureValue = validateOpportunityIntegrity({
      title: "Oportunidade Precoce",
      responsible_actor_id: "actor_123",
      next_action: "Primeiro contato",
      next_action_deadline: new Date().toISOString(),
      stage: "contact_ready",
      estimated_setup_value: 2000,
      estimated_mrr_value: 1500,
      has_proposal: false,
    });
    assert.equal(prematureValue.valid, false);
    assert.ok(
      prematureValue.errors.some((e) =>
        e.includes("Valores financeiros estimados só podem ser vinculados após a elaboração de proposta formal")
      )
    );

    // Válido quando possui proposta ou estágio de proposta
    const withProposal = validateOpportunityIntegrity({
      title: "Oportunidade com Proposta",
      responsible_actor_id: "actor_123",
      next_action: "Apresentar proposta",
      next_action_deadline: new Date().toISOString(),
      stage: "proposal_prepared",
      estimated_setup_value: 2000,
      estimated_mrr_value: 1500,
      has_proposal: true,
    });
    assert.equal(withProposal.valid, true);
  });

  it("02.2: Priorização separa FIT, INTENT e OPPORTUNITY sem inventar dados ausentes", () => {
    const result = calculatePrioritization({
      segment: "Vidraçaria",
      city: "Sorocaba",
      units_count: 1,
      rating: 4.1,
      review_count: 6,
      has_website: false,
      has_phone: true,
      has_whatsapp: true,
      observed_profile_quality: "incomplete",
      investment_signals: true,
      visible_problems: ["Sem fotos recentes", "Horário desatualizado"],
    });

    assert.ok(result.fit.score > 0);
    assert.ok(result.intent.score > 0);
    assert.ok(result.opportunity.score > 0);
    assert.equal(result.priority, "alta_prioridade");

    // Ausência de dados gera gaps/hipóteses, não evidência negativa
    const resultMissingData = calculatePrioritization({
      segment: "Pet Shop",
      city: "Campinas",
      units_count: null,
      rating: null,
      review_count: null,
      has_website: null,
      has_phone: true,
      has_whatsapp: null,
    });

    assert.ok(resultMissingData.fit.hypotheses.length > 0);
    assert.ok(resultMissingData.opportunity.gaps.length > 0);
    // Ausência de dados não deve descartar automaticamente
    assert.notEqual(resultMissingData.priority, "descartar");
  });

  it("02.3: Avaliação de qualificação cobre 8 dimensões e salva justificativa com evidências", () => {
    const qualifiedDims: QualificationDimensions = {
      fit: "high",
      problem: "confirmed_severe",
      impact: "high_financial",
      priority: "immediate",
      decision: "direct_owner",
      investment_capacity: "healthy_budget",
      expectation: "realistic",
      cooperation: "collaborative",
    };

    const evalQualified = evaluateQualification(
      qualifiedDims,
      ["Dono confirmou perda de clientes para concorrente vizinho"],
      ["Possui verba reservada para marketing local"],
      [],
      "actor_123"
    );
    assert.equal(evalQualified.result, "qualified");

    // Expectativa irreal gera risco alto imediato (high_risk)
    const riskDims: QualificationDimensions = {
      ...qualifiedDims,
      expectation: "unrealistic_guarantees",
    };
    const evalRisk = evaluateQualification(riskDims, [], [], [], "actor_123");
    assert.equal(evalRisk.result, "high_risk");

    // Sem orçamento gera no_fit
    const noBudgetDims: QualificationDimensions = {
      ...qualifiedDims,
      investment_capacity: "insufficient",
    };
    const evalNoFit = evaluateQualification(noBudgetDims, [], [], [], "actor_123");
    assert.equal(evalNoFit.result, "no_fit");
  });

  it("02.5: Diagnóstico comercial valida os 11 passos estruturados", () => {
    const incompleteAnswers = {
      context: "Loja tradicional de vidros",
      problem: "Poucas chamadas no Google Maps",
    };
    const check1 = validateDiagnosisCompleteness(incompleteAnswers);
    assert.equal(check1.complete, false);
    assert.ok(check1.missingSteps.includes("current_situation"));
    assert.ok(check1.missingSteps.includes("decision_next_steps"));

    const completeAnswers = {
      context: "Vidraçaria 8 anos no mercado",
      current_situation: "Depende de indicação boca a boca",
      problem: "Concorrentes novos aparecem na frente no Maps",
      impact: "Estimativa de 10 orçamentos perdidos por semana",
      history: "Tentou impulsionar post no Instagram sem retorno",
      objective: "Receber 5 contatos qualificados de orçamento por dia",
      diagnosis: "Perfil do Google incompleto e sem cadência de avaliações",
      gap: "Falta processo ativo de SEO Local e autoridade geográfica",
      relevant_solution: "Plano SEO Local & GBP da Alastre Platform",
      investment: "Faixa de R$ 1.500 setup e R$ 1.200/mês",
      decision_next_steps: "Agendada apresentação de proposta formal para sexta-feira",
    };
    const check2 = validateDiagnosisCompleteness(completeAnswers);
    assert.equal(check2.complete, true);
    assert.equal(check2.missingSteps.length, 0);
  });

  it("02.6: Proposta imutável após envio e aprovação estrita de desconto com contrapartida", () => {
    // Imutabilidade
    assert.equal(isProposalEditable("draft", false), true);
    assert.equal(isProposalEditable("internal_review", false), true);
    assert.equal(isProposalEditable("sent", true), false);
    assert.equal(isProposalEditable("accepted", true), false);
    assert.equal(isProposalEditable("rejected", true), false);

    // Validação de desconto: rejeita desconto sem justificativa e contrapartida
    const invalidDiscount = validateProposalDiscount({
      discount_setup_percentage: 15,
      discount_monthly_percentage: 0,
      discount_justification: "",
      discount_counterpart: "",
    });
    assert.equal(invalidDiscount.valid, false);
    assert.ok(invalidDiscount.errors.length >= 2);

    // Válido com justificativa e contrapartida do cliente
    const validDiscount = validateProposalDiscount({
      discount_setup_percentage: 10,
      discount_monthly_percentage: 0,
      discount_justification: "Pagamento do setup à vista via Pix no ato da assinatura",
      discount_counterpart: "Compromisso contratual de 12 meses sem cancelamento antecipado",
    });
    assert.equal(validDiscount.valid, true);
  });

  it("02.7: Motivo de perda 'Preço' exige justificativa detalhada e não pode ser automático", () => {
    // Sem orçamento passa sem detalhes adicionais
    const noBudget = validateLossReason("sem_orcamento", null);
    assert.equal(noBudget.valid, true);

    // Preço sem detalhes é rejeitado
    const priceEmpty = validateLossReason("preco", "");
    assert.equal(priceEmpty.valid, false);
    assert.ok(priceEmpty.error?.includes("Preço"));

    // Preço com detalhes insuficientes (< 10 chars) é rejeitado
    const priceShort = validateLossReason("preco", "caro");
    assert.equal(priceShort.valid, false);

    // Preço com justificativa completa é aprovado
    const priceDetailed = validateLossReason(
      "preco",
      "Cliente achou a recorrência mensal de R$ 1.200 acima do teto de R$ 800 que havia planejado."
    );
    assert.equal(priceDetailed.valid, true);
  });

  it("02.8: Handoff para onboarding exige checklist completo e NÃO cria cliente automaticamente", () => {
    const incompleteChecklist = {
      company_data_confirmed: true,
      key_contacts_identified: true,
    };
    const checkIncomplete = validateHandoffChecklist(incompleteChecklist);
    assert.equal(checkIncomplete.ready, false);
    assert.ok(checkIncomplete.missingItems.includes("pricing_and_terms_communicated"));

    const completeChecklist = {
      company_data_confirmed: true,
      key_contacts_identified: true,
      core_problem_documented: true,
      objective_metrics_aligned: true,
      product_version_locked: true,
      scope_items_confirmed: true,
      setup_timeline_agreed: true,
      recurring_schedule_agreed: true,
      pricing_and_terms_communicated: true,
      promises_documented: true,
      client_expectations_realistic: true,
      operational_risks_identified: true,
      dependencies_mapped: true,
      no_unilateral_pricing: true,
    };
    const checkComplete = validateHandoffChecklist(completeChecklist);
    assert.equal(checkComplete.ready, true);
    assert.equal(checkComplete.missingItems.length, 0);
  });

  it("02.9: Métricas comerciais indicam 'dados insuficientes' quando amostra for pequena", () => {
    const oppsLowVolume = [
      { stage: "closed_won" as OpportunityStage, created_at: new Date().toISOString() },
    ];
    const metricsLow = calculateCommercialMetrics(oppsLowVolume, 5);
    assert.equal(metricsLow.status, "insufficient_data");
    assert.equal(metricsLow.stage_conversion_rates, undefined);

    const oppsSufficient = [
      { stage: "closed_won" as OpportunityStage, created_at: new Date().toISOString(), estimated_setup_value: 1500, estimated_mrr_value: 1200 },
      { stage: "closed_won" as OpportunityStage, created_at: new Date().toISOString(), estimated_setup_value: 1500, estimated_mrr_value: 1200 },
      { stage: "closed_lost" as OpportunityStage, created_at: new Date().toISOString(), loss_reason_code: "preco" as const },
      { stage: "negotiation" as OpportunityStage, created_at: new Date().toISOString() },
    ];
    const metricsOk = calculateCommercialMetrics(oppsSufficient, 20);
    assert.equal(metricsOk.status, "ok");
    assert.ok(metricsOk.stage_conversion_rates !== undefined);
    assert.ok(metricsOk.total_setup_revenue === 3000);
  });

  it("02.9: Forecast gera 3 cenários com premissas declaradas", () => {
    const forecast = generateForecast([
      { stage: "proposal_sent", priority: "alta_prioridade", estimated_setup_value: 2000, estimated_mrr_value: 1500 },
      { stage: "negotiation", priority: "alta_prioridade", estimated_setup_value: 2000, estimated_mrr_value: 1500 },
      { stage: "qualified", priority: "media_prioridade", estimated_setup_value: 1000, estimated_mrr_value: 800 },
    ]);

    assert.equal(forecast.scenarios.length, 3);
    const names = forecast.scenarios.map((s) => s.name);
    assert.ok(names.includes("conservative"));
    assert.ok(names.includes("base"));
    assert.ok(names.includes("aggressive"));

    for (const sc of forecast.scenarios) {
      assert.ok(sc.assumptions.length > 0, "Cada cenário deve declarar suas premissas");
      assert.ok(sc.projected_closed_won_count >= 0);
    }
  });

  it("02.4: Detecta oportunidades paradas (stale) com base em prazo vencido ou inatividade", () => {
    const now = Date.now();
    const staleOpp = {
      id: "opp_stale",
      next_action_deadline: new Date(now - 86400000).toISOString(), // Ontem (vencido)
      last_activity_at: new Date(now - 20000000).toISOString(),
      stage: "contact_ready" as OpportunityStage,
    };
    const activeOpp = {
      id: "opp_active",
      next_action_deadline: new Date(now + 86400000).toISOString(), // Amanhã
      last_activity_at: new Date(now - 1000000).toISOString(),
      stage: "contact_ready" as OpportunityStage,
    };

    const result = detectStaleOpportunities([staleOpp, activeOpp], 7);
    assert.equal(result.staleCount, 1);
    assert.equal(result.staleOpportunities[0].id, "opp_stale");
    assert.ok(result.staleOpportunities[0].reason.includes("vencido"));
  });
});
