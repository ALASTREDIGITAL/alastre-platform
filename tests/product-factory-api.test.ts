import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/product-factory/route.ts";
import { STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS } from "../lib/product-factory-domain.ts";

function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/product-factory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Módulo 01: Fábrica de Produtos - API Server-side", () => {
  it("rejeita requisições não autenticadas em produção (fail-secure)", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      const req = createMockRequest({ action: "list_products" });
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

      // 1. Sem ação
      const req1 = createMockRequest({});
      const res1 = await POST(req1);
      assert.equal(res1.status, 400);

      // 2. Ação desconhecida
      const req2 = createMockRequest({ action: "unknown_action" });
      const res2 = await POST(req2);
      assert.equal(res2.status, 400);
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  it("impõe limite de no máximo 7 perguntas por rodada na API", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "development" });

      // Tenta salvar rodada com 8 perguntas
      const overLimitQuestions = Array.from({ length: 8 }, (_, i) => ({
        id: `q_${i + 1}`,
        category: "operations",
        question_text: `Pergunta ${i + 1}`,
        is_required: true,
        expected_type: "text",
      }));

      const req = createMockRequest({
        action: "save_discovery_round",
        product_id: "prod_test",
        round_number: 1,
        status: "in_progress",
        questions: overLimitQuestions,
        answers: [],
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error || json.details);
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  it("executa o ciclo completo de criação, descoberta, escopo, SOPs, RACI, viabilidade e versionamento", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "development" });

      // 1. Criar Produto
      const createReq = createMockRequest({
        action: "create_product",
        name: "SEO Local e Google Business Profile",
        slug: "seo-local-gbp",
        summary: "Produto oficial de posicionamento e gestão contínua de fichas",
        target_objective: "Atrair clientes locais qualificados no raio de 5km",
        target_market: "Prestadores de serviços e clínicas com sede física",
        icp_description: "Ticket médio acima de R$ 300, pelo menos 1 recepcionista",
        anti_icp_description: "Lojas 100% digitais ou sem ponto comercial",
        transformational_promise: "Posicionar a empresa entre as principais escolhas do Local Pack com evidências auditadas",
        controllable_deliverables: [
          "Auditoria de 18 pontos",
          "Otimização de categorias e atributos",
          "4 postagens mensais com foto real",
          "Respostas técnicas em até 24h",
        ],
        influenciable_indicators: [
          "Visualizações na Busca e Maps",
          "Chamadas telefônicas e rotas",
        ],
        external_results: [
          "Faturamento ou volume de vendas no caixa",
        ],
      });

      const createRes = await POST(createReq);
      assert.equal(createRes.status, 200);
      const createJson = await createRes.json();
      assert.equal(createJson.ok, true);
      assert.ok(createJson.product.id);
      const productId = createJson.product.id;
      assert.equal(createJson.product.version, 1);
      assert.equal(createJson.product.status, "draft");

      // 2. Salvar Rodada de Descoberta com 7 perguntas e respostas
      const round1 = STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS[0];
      const answers = round1.questions.map((q) => ({
        question_id: q.id,
        answer_text: "Informação operacional verificada e documentada na agência.",
        classification: "evidence" as const,
        confidence: "high" as const,
        is_blocking_gap: false,
      }));

      const saveDiscoveryReq = createMockRequest({
        action: "save_discovery_round",
        product_id: productId,
        round_number: 1,
        status: "completed",
        questions: round1.questions,
        answers,
      });

      const saveDiscoveryRes = await POST(saveDiscoveryReq);
      assert.equal(saveDiscoveryRes.status, 200);
      const discoveryJson = await saveDiscoveryRes.json();
      assert.equal(discoveryJson.ok, true);
      assert.equal(discoveryJson.session.round_number, 1);
      assert.equal(discoveryJson.session.answers.length, 7);

      // 3. Salvar Matriz de Escopo (Separando Setup e Recorrência)
      const saveScopeReq = createMockRequest({
        action: "save_scope_items",
        product_id: productId,
        items: [
          {
            activity_name: "Auditoria Inicial e Correção de NAP",
            description: "Nome, endereço e telefone padronizados",
            delivery_type: "setup",
            frequency: "once",
            default_role: "analyst",
            estimated_minutes: 120,
            is_automatable: true,
            client_participation_required: false,
            dependencies: [],
            acceptance_criteria: "Relatório de conformidade sem erros",
            required_evidence: "Print e registro auditado no painel",
            scope_classification: "included",
            sort_order: 1,
          },
          {
            activity_name: "Publicação Semanal de Posts",
            description: "Novidades e fotos reais da operação",
            delivery_type: "recurring",
            frequency: "weekly",
            default_role: "analyst",
            estimated_minutes: 30,
            is_automatable: true,
            client_participation_required: false,
            dependencies: ["Auditoria Inicial e Correção de NAP"],
            acceptance_criteria: "Post publicado sem telefone no corpo e com CTA oficial",
            required_evidence: "ID da publicação no Google",
            scope_classification: "included",
            sort_order: 2,
          },
        ],
      });

      const saveScopeRes = await POST(saveScopeReq);
      assert.equal(saveScopeRes.status, 200);
      const scopeJson = await saveScopeRes.json();
      assert.equal(scopeJson.ok, true);
      assert.equal(scopeJson.items.length, 2);

      // 4. Salvar Procedimentos Operacionais Padrão (SOPs)
      const saveSopsReq = createMockRequest({
        action: "save_sops",
        product_id: productId,
        sops: [
          {
            name: "SOP-01: Auditoria Técnica de Ficha",
            objective: "Garantir consistência cadastral e conformidade com diretrizes do Google",
            trigger: "Início do onboarding do cliente",
            responsible_role: "analyst",
            prerequisites: ["Acesso de administrador na ficha"],
            tools_required: ["Alastre Platform", "Google Search Console"],
            steps: [
              { order: 1, title: "Verificar NAP", instruction: "Conferir Nome, Endereço e Telefone" },
              { order: 2, title: "Checar Categorias", instruction: "Garantir categoria primária correta" },
            ],
            quality_checklist: ["Telefone no padrão E.164", "Horário especial de feriados configurado"],
            completion_criteria: "Checklist 100% preenchido",
            required_evidence: "Snapshot salvo na plataforma",
            estimated_minutes: 60,
            errors_and_exceptions: ["Ficha suspensa pelo Google: acionar processo de contestação"],
          },
          {
            name: "SOP-02: Publicação Semanal de Posts Locais",
            objective: "Manter atividade constante e engajamento",
            trigger: "Toda terça-feira às 10h",
            responsible_role: "analyst",
            prerequisites: ["Foto real aprovada pelo cliente"],
            tools_required: ["Editor de Conteúdo Alastre"],
            steps: [
              { order: 1, title: "Elaborar Texto", instruction: "Texto entre 150 e 300 caracteres sem número de telefone" },
              { order: 2, title: "Submeter para Aprovação", instruction: "Enviar para Central de Aprovações" },
            ],
            quality_checklist: ["Foto real sem texto sobreposto excessivo", "CTA coerente"],
            completion_criteria: "Post aprovado e publicado",
            required_evidence: "Post ID retornado pelo adapter",
            estimated_minutes: 30,
            errors_and_exceptions: ["Rejeição por spam: reescrever texto removendo termos promocionais agressivos"],
          },
        ],
      });

      const saveSopsRes = await POST(saveSopsReq);
      assert.equal(saveSopsRes.status, 200);
      const sopsJson = await saveSopsRes.json();
      assert.equal(sopsJson.ok, true);
      assert.equal(sopsJson.sops.length, 2);

      // 5. Salvar Matriz RACI
      const saveRaciReq = createMockRequest({
        action: "save_raci",
        product_id: productId,
        assignments: [
          {
            activity_name: "Auditoria Inicial e Correção de NAP",
            role: "analyst",
            is_future_role: false,
            raci_type: "R",
          },
          {
            activity_name: "Publicação Semanal de Posts",
            role: "analyst",
            is_future_role: false,
            raci_type: "R",
          },
          {
            activity_name: "Aprovação de Conteúdo",
            role: "manager",
            is_future_role: false,
            raci_type: "A",
          },
        ],
      });

      const saveRaciRes = await POST(saveRaciReq);
      assert.equal(saveRaciRes.status, 200);
      const raciJson = await saveRaciRes.json();
      assert.equal(raciJson.ok, true);
      assert.equal(raciJson.raci.length, 3);

      // 6. Calcular Checkpoint de Viabilidade
      const calcViabReq = createMockRequest({
        action: "calculate_viability",
        product_id: productId,
      });

      const calcViabRes = await POST(calcViabReq);
      assert.equal(calcViabRes.status, 200);
      const viabJson = await calcViabRes.json();
      assert.equal(viabJson.ok, true);
      assert.ok(viabJson.viability);
      assert.ok(viabJson.viability.viability_score > 0);
      assert.equal(viabJson.viability.total_setup_hours, 2.0); // 120 min = 2.0h
      assert.equal(viabJson.viability.total_recurring_monthly_hours, 2.0); // 30 min * 4 = 120 min = 2.0h

      // 7. Submeter para Revisão Humana
      const submitReq = createMockRequest({
        action: "submit_for_review",
        product_id: productId,
        submission_note: "Produto consistente e verificado",
      });
      const submitRes = await POST(submitReq);
      assert.equal(submitRes.status, 200);
      const submitJson = await submitRes.json();
      assert.equal(submitJson.ok, true);
      assert.equal(submitJson.product.status, "in_review");

      // 8. Obter Workspace Completo
      const getWsReq = createMockRequest({
        action: "get_product",
        product_id: productId,
      });
      const getWsRes = await POST(getWsReq);
      assert.equal(getWsRes.status, 200);
      const wsJson = await getWsRes.json();
      assert.equal(wsJson.product.id, productId);
      assert.equal(wsJson.product.status, "in_review");
      assert.equal(wsJson.sessions.length, 1);
      assert.equal(wsJson.scopeItems.length, 2);
      assert.equal(wsJson.sops.length, 2);
      assert.equal(wsJson.raci.length, 3);
      assert.ok(wsJson.viability);
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  it("impõe isolamento multiempresa e rejeita estritamente qualquer tentativa cross-tenant", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "development" });

      const AGENCY_A = "00000000-0000-0000-0000-000000000001";
      const AGENCY_B = "00000000-0000-0000-0000-000000000002";

      // 1. Agência A cria um produto A
      const createProdAReq = createMockRequest(
        {
          action: "create_product",
          name: "Produto da Agência A",
          slug: "produto-agencia-a",
        },
        { "x-alastre-agency-id": AGENCY_A },
      );
      const createProdARes = await POST(createProdAReq);
      assert.equal(createProdARes.status, 200);
      const prodAJson = await createProdARes.json();
      const productAId = prodAJson.product.id;
      assert.equal(prodAJson.product.agency_id, AGENCY_A);

      // 2. Agência A salva um item de escopo legítimo no produto A
      const scopeAId = `scope_${productAId}_1`;
      const saveScopeAReq = createMockRequest(
        {
          action: "save_scope_items",
          product_id: productAId,
          items: [
            {
              id: scopeAId,
              activity_name: "Atividade Exclusiva Agência A",
              delivery_type: "setup",
              frequency: "once",
              default_role: "analyst",
              estimated_minutes: 60,
              is_automatable: false,
              client_participation_required: false,
              acceptance_criteria: "Critério A",
              required_evidence: "Evidência A",
              scope_classification: "included",
            },
          ],
        },
        { "x-alastre-agency-id": AGENCY_A },
      );
      const saveScopeARes = await POST(saveScopeAReq);
      assert.equal(saveScopeARes.status, 200);

      // 3. Agência B tenta ACESSAR o produto da Agência A -> DEVE FALHAR (404)
      const getProdByBReq = createMockRequest(
        {
          action: "get_product",
          product_id: productAId,
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const getProdByBRes = await POST(getProdByBReq);
      assert.equal(getProdByBRes.status, 404, "Agência B não pode visualizar produto da Agência A");

      // 4. Agência B tenta MODIFICAR descoberta do produto da Agência A -> DEVE FALHAR (404)
      const saveDiscoveryByBReq = createMockRequest(
        {
          action: "save_discovery_round",
          product_id: productAId,
          round_number: 1,
          status: "completed",
          questions: [],
          answers: [],
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const saveDiscoveryByBRes = await POST(saveDiscoveryByBReq);
      assert.equal(saveDiscoveryByBRes.status, 404, "Agência B não pode alterar descoberta da Agência A");

      // 5. Agência B tenta MODIFICAR escopo do produto da Agência A -> DEVE FALHAR (404)
      const saveScopeByBReq = createMockRequest(
        {
          action: "save_scope_items",
          product_id: productAId,
          items: [],
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const saveScopeByBRes = await POST(saveScopeByBReq);
      assert.equal(saveScopeByBRes.status, 404, "Agência B não pode alterar escopo da Agência A");

      // 6. Agência B tenta CALCULAR VIABILIDADE do produto da Agência A -> DEVE FALHAR (404)
      const calcViabByBReq = createMockRequest(
        {
          action: "calculate_viability",
          product_id: productAId,
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const calcViabByBRes = await POST(calcViabByBReq);
      assert.equal(calcViabByBRes.status, 404, "Agência B não pode calcular viabilidade da Agência A");

      // 7. Agência B cria legitimamente seu próprio Produto B
      const createProdBReq = createMockRequest(
        {
          action: "create_product",
          name: "Produto da Agência B",
          slug: "produto-agencia-b",
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const createProdBRes = await POST(createProdBReq);
      assert.equal(createProdBRes.status, 200);
      const prodBJson = await createProdBRes.json();
      const productBId = prodBJson.product.id;
      assert.equal(prodBJson.product.agency_id, AGENCY_B);

      // 8. Agência B tenta associar um SOP ao seu produto B usando o scope_item_id da Agência A -> DEVE FALHAR (400)
      const saveSopCrossTenantReq = createMockRequest(
        {
          action: "save_sops",
          product_id: productBId,
          sops: [
            {
              name: "SOP Invasor",
              scope_item_id: scopeAId, // Pertence à Agência A!
              trigger: "Gatilho",
              responsible_role: "analyst",
              completion_criteria: "Critério",
              required_evidence: "Evidência",
            },
          ],
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const saveSopCrossTenantRes = await POST(saveSopCrossTenantReq);
      assert.equal(saveSopCrossTenantRes.status, 400, "SOP não pode apontar para item de escopo de outra agência");
      const sopCrossJson = await saveSopCrossTenantRes.json();
      assert.match(sopCrossJson.error, /outra agência/);

      // 9. Agência B tenta associar um RACI ao seu produto B usando o scope_item_id da Agência A -> DEVE FALHAR (400)
      const saveRaciCrossTenantReq = createMockRequest(
        {
          action: "save_raci",
          product_id: productBId,
          assignments: [
            {
              activity_name: "Atividade Invasora",
              scope_item_id: scopeAId, // Pertence à Agência A!
              role: "analyst",
              is_future_role: false,
              raci_type: "R",
            },
          ],
        },
        { "x-alastre-agency-id": AGENCY_B },
      );
      const saveRaciCrossTenantRes = await POST(saveRaciCrossTenantReq);
      assert.equal(saveRaciCrossTenantRes.status, 400, "RACI não pode apontar para item de escopo de outra agência");
      const raciCrossJson = await saveRaciCrossTenantRes.json();
      assert.match(raciCrossJson.error, /outra agência/);
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });
});
