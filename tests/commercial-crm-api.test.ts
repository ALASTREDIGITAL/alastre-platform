import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/commercial/route.ts";

function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/commercial", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Módulo 02: Comercial & CRM - API Server-side", () => {
  it("rejeita requisições não autenticadas em produção (fail-secure)", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      const req = createMockRequest({ action: "list_companies" });
      const res = await POST(req);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error, "Acesso não identificado.");
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  it("rejeita requisições com payload inválido ou sem ação conhecida quando autenticado", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "development" });

      const req1 = createMockRequest({});
      const res1 = await POST(req1);
      assert.equal(res1.status, 400);

      const req2 = createMockRequest({ action: "non_existent_action" });
      const res2 = await POST(req2);
      assert.equal(res2.status, 400);
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  it("fluxo completo comercial: empresa, oportunidade, priorização, qualificação, diagnóstico, proposta, atividades, handoff e forecast", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "development" });

      // 1. Cadastra Empresa Prospectada com deduplicação por identity_key
      const compReq = createMockRequest({
        action: "create_or_update_company",
        company: {
          name: "Vidraçaria Cristal Sorocaba",
          trade_name: "Cristal Vidros",
          segment: "Vidraçaria",
          city: "Sorocaba",
          state_uf: "SP",
          phone: "15999991234",
          maps_url: "https://www.google.com/maps/place/Cristal+Vidros?cid=123456789",
          cid: "123456789",
          rating: 4.2,
          review_count: 8,
          observed_profile_quality: "incomplete",
        },
      });
      const compRes = await POST(compReq);
      const compJson = await compRes.json();
      if (compRes.status !== 200) {
        console.error("DEBUG compRes:", JSON.stringify(compJson));
      }
      assert.equal(compRes.status, 200);
      const { company } = compJson;
      assert.ok(company.id);
      assert.equal(company.identity_key, "cid:123456789");

      // Teste de deduplicação: reenviar a mesma empresa deve atualizar, não duplicar
      const compDupReq = createMockRequest({
        action: "create_or_update_company",
        company: {
          name: "Vidraçaria Cristal Sorocaba Atualizada",
          trade_name: "Cristal Vidros",
          segment: "Vidraçaria",
          city: "Sorocaba",
          state_uf: "SP",
          phone: "15999991234",
          maps_url: "https://www.google.com/maps/place/Cristal+Vidros?cid=123456789",
          cid: "123456789",
          rating: 4.5,
          review_count: 10,
          observed_profile_quality: "incomplete",
        },
      });
      const compDupRes = await POST(compDupReq);
      assert.equal(compDupRes.status, 200);
      const { company: compDup } = await compDupRes.json();
      assert.equal(compDup.id, company.id, "Empresa com mesmo identity_key deve ser reutilizada");

      // 2. Cria Oportunidade Comercial
      const oppReq = createMockRequest({
        action: "create_opportunity",
        company_id: company.id,
        title: "SEO Local e Google Maps - Cristal Vidros",
        origin: "prospecting",
        responsible_actor_id: "actor_local",
        responsible_name: "Rodrigo",
        next_action: "Realizar pré-análise e contato inicial",
        next_action_deadline: new Date(Date.now() + 86400000).toISOString(),
        priority: "alta_prioridade",
      });
      const oppRes = await POST(oppReq);
      assert.equal(oppRes.status, 200);
      const { opportunity: opp } = await oppRes.json();
      assert.ok(opp.id);
      assert.equal(opp.stage, "new");

      // 3. Bloqueio de salto incompatível (ex: new -> closed_won)
      const invalidJumpReq = createMockRequest({
        action: "update_opportunity_stage",
        opportunity_id: opp.id,
        target_stage: "closed_won",
        next_action: "Iniciar onboarding",
        next_action_deadline: new Date().toISOString(),
      });
      const invalidJumpRes = await POST(invalidJumpReq);
      assert.equal(invalidJumpRes.status, 400);

      // 4. Avança para 'researched' e 'prioritized'
      const advance1 = await POST(
        createMockRequest({
          action: "update_opportunity_stage",
          opportunity_id: opp.id,
          target_stage: "researched",
          next_action: "Priorizar lead",
          next_action_deadline: new Date().toISOString(),
        })
      );
      assert.equal(advance1.status, 200);

      // 5. Salva Priorização Observável
      const prioReq = createMockRequest({
        action: "save_prioritization",
        opportunity_id: opp.id,
        input: {
          segment: company.segment,
          city: company.city,
          rating: company.rating,
          review_count: company.review_count,
          has_website: false,
          has_phone: true,
          has_whatsapp: true,
          observed_profile_quality: "incomplete",
          investment_signals: true,
        },
      });
      const prioRes = await POST(prioReq);
      assert.equal(prioRes.status, 200);
      const { prioritization } = await prioRes.json();
      assert.equal(prioritization.priority, "alta_prioridade");

      // 6. Avança no pipeline: prioritized -> contact_ready -> contacted -> responded -> qualified
      await POST(createMockRequest({ action: "update_opportunity_stage", opportunity_id: opp.id, target_stage: "prioritized", next_action: "Preparar abordagem", next_action_deadline: new Date().toISOString() }));
      await POST(createMockRequest({ action: "update_opportunity_stage", opportunity_id: opp.id, target_stage: "contact_ready", next_action: "Ligar para decisor", next_action_deadline: new Date().toISOString() }));
      await POST(createMockRequest({ action: "update_opportunity_stage", opportunity_id: opp.id, target_stage: "contacted", next_action: "Aguardar retorno do WhatsApp", next_action_deadline: new Date().toISOString() }));
      await POST(createMockRequest({ action: "update_opportunity_stage", opportunity_id: opp.id, target_stage: "responded", next_action: "Qualificar interesse", next_action_deadline: new Date().toISOString() }));
      await POST(createMockRequest({ action: "update_opportunity_stage", opportunity_id: opp.id, target_stage: "qualified", next_action: "Agendar call de diagnóstico", next_action_deadline: new Date().toISOString() }));

      // 7. Salva Qualificação Comercial
      const qualReq = createMockRequest({
        action: "save_qualification",
        opportunity_id: opp.id,
        dimensions: {
          fit: "high",
          problem: "confirmed_severe",
          impact: "high_financial",
          priority: "immediate",
          decision: "direct_owner",
          investment_capacity: "healthy_budget",
          expectation: "realistic",
          cooperation: "collaborative",
        },
        evidences: ["Dono atendeu e confirmou interesse em dobrar rotas no Google Maps"],
        hypotheses: ["Pode fechar contrato de 12 meses"],
        gaps: [],
      });
      const qualRes = await POST(qualReq);
      assert.equal(qualRes.status, 200);
      const { qualification } = await qualRes.json();
      assert.equal(qualification.result, "qualified");

      // 8. Salva Diagnóstico Comercial em 11 passos
      const diagReq = createMockRequest({
        action: "save_diagnosis",
        opportunity_id: opp.id,
        step_answers: {
          context: "Vidraçaria em avenida de grande movimento em Sorocaba",
          current_situation: "Depende de indicação e fachada física",
          problem: "Concorrentes menores aparecem no topo das buscas locais",
          impact: "Estima R$ 15.000 em faturamento perdido todo mês",
          history: "Tentou impulsionar Instagram sem retorno mensurável",
          objective: "Tornar-se o top 3 no Google Maps em Sorocaba",
          diagnosis: "Perfil sem categorias secundárias e sem cadência de avaliações",
          gap: "Autoridade geográfica e gestão contínua de presença",
          relevant_solution: "Plano Canonical SEO Local & GBP da Alastre Platform",
          investment: "Faixa de R$ 1.500 setup e R$ 1.200/mês aceita com entusiasmo",
          decision_next_steps: "Enviar proposta formal para assinatura até sexta",
        },
        evidences: ["Prints do Maps com o concorrente ocupando o Local Pack"],
        expectations: "Melhoria gradual sem promessas milagrosas imediatas",
        red_flags: [],
        risks: ["Demora no envio de fotos da fachada pelo cliente"],
        decision: "Avançar para proposta",
        next_steps: "Elaborar proposta vinculada ao produto",
      });
      const diagRes = await POST(diagReq);
      assert.equal(diagRes.status, 200);

      // 9. Salva Proposta Comercial vinculada ao Produto
      const propReq = createMockRequest({
        action: "upsert_proposal",
        opportunity_id: opp.id,
        product_definition_id: "seo_local_gbp_canonical",
        product_version: 1,
        setup_price: 1500,
        monthly_price: 1200,
        discount_setup_percentage: 10,
        discount_monthly_percentage: 0,
        discount_justification: "Pagamento do setup à vista no Pix",
        discount_counterpart: "Fidelidade mínima contratual de 12 meses",
        selected_scope_items: ["auditoria_inicial", "otimizacao_perfil", "rotina_mensal"],
        scope_adjustments: [],
        payment_terms: "Setup no Pix + Recorrência mensal via boleto",
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
        dependencies: ["Acesso ao Perfil de Empresas do Google"],
        expectations: ["Relatórios mensais de evolução"],
        risks: ["Suspensão do Google caso haja dados inconsistentes prévios"],
      });
      const propRes = await POST(propReq);
      assert.equal(propRes.status, 200);
      const { proposal } = await propRes.json();
      assert.ok(proposal.id);
      assert.equal(proposal.is_immutable, false);

      // 10. Envia Proposta (torna imutável)
      const sendReq = createMockRequest({
        action: "send_proposal",
        opportunity_id: opp.id,
        proposal_id: proposal.id,
      });
      const sendRes = await POST(sendReq);
      assert.equal(sendRes.status, 200);
      const { proposal: sentProp } = await sendRes.json();
      assert.equal(sentProp.is_immutable, true);
      assert.equal(sentProp.status, "sent");

      // 11. Handoff de Vendas para Onboarding (Closed Won -> Handoff)
      await POST(
        createMockRequest({
          action: "update_opportunity_stage",
          opportunity_id: opp.id,
          target_stage: "closed_won",
          next_action: "Conferir checklist de handoff",
          next_action_deadline: new Date().toISOString(),
        })
      );

      const handoffReq = createMockRequest({
        action: "save_handoff",
        opportunity_id: opp.id,
        proposal_id: proposal.id,
        checklist: {
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
        },
        promises_made: "Otimização completa em 30 dias com relatórios mensais",
        client_expectations: "Aumento de ligações sem garantias contratuais de faturamento",
        operational_risks: "Cliente precisa fornecer fotos atualizadas",
        critical_dependencies: "Acesso de administrador ao perfil do GBP",
        missing_data: "Nenhum dado impeditivo pendente",
      });
      const handoffRes = await POST(handoffReq);
      assert.equal(handoffRes.status, 200);
      const { handoff } = await handoffRes.json();
      assert.ok(handoff.id);
      assert.equal(handoff.status, "draft");

      // Submete para operações
      const submitHandoffRes = await POST(
        createMockRequest({
          action: "submit_handoff_review",
          opportunity_id: opp.id,
          handoff_id: handoff.id,
        })
      );
      assert.equal(submitHandoffRes.status, 200);
      const { handoff: submittedHand } = await submitHandoffRes.json();
      assert.equal(submittedHand.status, "operations_review");

      // Operações aprova para onboarding (sem criar cliente automaticamente)
      const reviewRes = await POST(
        createMockRequest({
          action: "review_handoff",
          handoff_id: handoff.id,
          decision: "approved_for_onboarding",
          operations_notes: "Venda validada contra matriz da fábrica. Pronto para kickoff.",
        })
      );
      assert.equal(reviewRes.status, 200);
      const { handoff: reviewedHand } = await reviewRes.json();
      assert.equal(reviewedHand.status, "approved_for_onboarding");

      // 12. Workspace 360 da Oportunidade
      const workRes = await POST(
        createMockRequest({
          action: "get_opportunity_workspace",
          opportunity_id: opp.id,
        })
      );
      assert.equal(workRes.status, 200);
      const { workspace } = await workRes.json();
      assert.equal(workspace.opportunity.id, opp.id);
      assert.equal(workspace.company.id, company.id);
      assert.equal(workspace.prioritization?.priority, "alta_prioridade");
      assert.equal(workspace.qualification?.result, "qualified");
      assert.ok(workspace.diagnosis);
      assert.equal(workspace.proposals.length, 1);
      assert.equal(workspace.handoff?.status, "approved_for_onboarding");

      // 13. Métricas e Previsão Comercial (Forecast)
      const metricsRes = await POST(
        createMockRequest({
          action: "get_metrics_and_forecast",
        })
      );
      assert.equal(metricsRes.status, 200);
      const { metrics, forecast } = await metricsRes.json();
      assert.ok(metrics.total_opportunities >= 1);
      assert.equal(forecast.scenarios.length, 3);
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });
});
