(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import { POST as clientSuccessRouteHandler, GET as clientSuccessGetHandler } from "../app/api/client-success/route.ts";
import { clientSuccessMemoryStore } from "../lib/client-success-api.ts";
import { operationsMemoryStore } from "../app/api/operations/route.ts";

test("Módulo 07 — API: Ações de Health Score, Scorecards e Reuniões", async (t) => {
  clientSuccessMemoryStore.clear();

  const clientId = "11111111-1111-4111-a111-111111111111";

  await t.test("executa POST calculate_health via API", async () => {
    const req = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "calculate_health",
        client_id: clientId,
        operational_delivery: { score: 85, weight: 1, data_available: true },
        quality_compliance: { score: 90, weight: 1, data_available: true },
      }),
    });

    const res = await clientSuccessRouteHandler(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.healthScore);
    assert.equal(data.healthScore.client_id, clientId);
  });

  await t.test("executa POST create_meeting e converte decisão em tarefa do Módulo 04", async () => {
    // 1. Criar Reunião
    const reqMeeting = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_meeting",
        client_id: clientId,
        objective: "Alinhamento Trimestral de SEO Local",
        participants: ["Ana (CS Alastre)", "Carlos (Cliente)"],
      }),
    });
    const resMeeting = await clientSuccessRouteHandler(reqMeeting);
    assert.equal(resMeeting.status, 200);
    const dataMeeting = await resMeeting.json();
    const meetingId = dataMeeting.meeting.id;

    // 2. Criar Decisão
    const reqDec = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_meeting_decision",
        meeting_id: meetingId,
        client_id: clientId,
        decision: "Expandir o gerenciamento de reputação GBP para a unidade filiada",
        responsible_actor_id: "actor-cs-1",
      }),
    });
    const resDec = await clientSuccessRouteHandler(reqDec);
    assert.equal(resDec.status, 200);
    const dataDec = await resDec.json();
    const decisionId = dataDec.decision.id;

    // 3. Converter em Tarefa no Motor de Operações (Módulo 04)
    const reqTask = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "convert_decision_to_work_item",
        decision_id: decisionId,
        meeting_id: meetingId,
        client_id: clientId,
        title: "Expandir gerenciamento de reputação GBP filiada",
        description: "Decisão acordada em reunião trimestral com o cliente",
        assignee_id: "actor-cs-1",
      }),
    });
    const resTask = await clientSuccessRouteHandler(reqTask);
    assert.equal(resTask.status, 200);

    const dataTask = await resTask.json();
    assert.equal(dataTask.success, true);
    assert.ok(dataTask.work_item);
    assert.equal(dataTask.work_item.client_id, clientId);
    assert.ok(dataTask.work_item.title.includes("Expandir gerenciamento"));

    // Confirmar que o work_item foi registrado no store de Operações
    const createdItem = operationsMemoryStore.workItems.find((w) => w.id === dataTask.work_item.id);
    assert.ok(createdItem);
  });
});

test("Módulo 07 — API: Expansão, Churn e Offboarding", async (t) => {
  const clientId = "11111111-1111-4111-a111-111111111111";

  await t.test("cria e aprova recomendação de expansão com aprovação humana", async () => {
    // 1. Criar recomendação
    const reqExp = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_expansion_recommendation",
        client_id: clientId,
        type: "expansion_service",
        target_service_name: "Gestão Premium de SEO Local",
        demonstrated_fit_rationale: "Cliente atingiu score 90 no Alastre Local Score e demanda cobertura expandida.",
        evidenced_value_rationale: "Evidências verificadas no Módulo 06 comprovam consistência de entrega.",
        operational_impact_assessment: "Capacidade operacional verificada no Módulo 04 sem sobrecarga.",
      }),
    });

    const resExp = await clientSuccessRouteHandler(reqExp);
    assert.equal(resExp.status, 200);
    const dataExp = await resExp.json();
    assert.equal(dataExp.success, true);
    const recId = dataExp.recommendation.id;
    assert.equal(dataExp.recommendation.human_approval_status, "pending");

    // 2. Aprovar recomendação
    const reqApprove = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve_expansion",
        recommendation_id: recId,
        client_id: clientId,
        decision: "approved",
        actor_id: "gestor-cs-principal",
      }),
    });

    const resApprove = await clientSuccessRouteHandler(reqApprove);
    assert.equal(resApprove.status, 200);
    const dataApprove = await resApprove.json();
    assert.equal(dataApprove.success, true);
    assert.equal(dataApprove.status, "approved");
  });

  await t.test("solicita cancelamento e cria inventário de offboarding com retenção de auditoria", async () => {
    const reqCanc = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_cancellation_request",
        client_id: clientId,
        primary_motive: "Reestruturação interna do cliente",
        detailed_reason: "Cliente encerrará operações na região sul.",
      }),
    });

    const resCanc = await clientSuccessRouteHandler(reqCanc);
    assert.equal(resCanc.status, 200);
    const dataCanc = await resCanc.json();
    assert.equal(dataCanc.success, true);
    const cancId = dataCanc.cancellation_request.id;

    // Criar inventário de offboarding
    const reqOff = new Request("http://localhost/api/client-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_offboarding_inventory",
        cancellation_request_id: cancId,
        client_id: clientId,
        access_items: [
          {
            id: "acc_1",
            service_name: "Google Business Profile",
            account_identifier: "loja-centro@empresa.com",
            status: "pending_revocation",
          },
        ],
      }),
    });

    const resOff = await clientSuccessRouteHandler(reqOff);
    assert.equal(resOff.status, 200);
    const dataOff = await resOff.json();
    assert.equal(dataOff.success, true);
    assert.ok(dataOff.inventory.retention_policy_note.includes("Nenhum dado de auditoria foi destruído"));
  });

  await t.test("consulta dados consolidados via GET /api/client-success", async () => {
    const reqGet = new Request(`http://localhost/api/client-success?client_id=${clientId}`);
    const resGet = await clientSuccessGetHandler(reqGet);
    assert.equal(resGet.status, 200);
    const dataGet = await resGet.json();
    assert.equal(dataGet.success, true);
    assert.ok(Array.isArray(dataGet.healthScores));
    assert.ok(Array.isArray(dataGet.meetings));
    assert.ok(Array.isArray(dataGet.cancellationRequests));
    assert.ok(dataGet.disclaimer.includes("Não há promessa de ranking"));
  });
});
