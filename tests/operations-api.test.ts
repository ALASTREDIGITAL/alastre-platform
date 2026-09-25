import assert from "node:assert/strict";
import test from "node:test";
import { POST, operationsMemoryStore } from "../app/api/operations/route.ts";

function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/operations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("Módulo 04 Operations Engine — API Completa e Regras de Negócio", async (t) => {
  operationsMemoryStore.clear();

  const tenantAgencyId = "00000000-0000-0000-0000-000000000001";
  const clientId = "c1000000-0000-0000-0000-000000000001";

  // 1. Listar Workspace inicialmente vazio
  await t.test("1. list_workspace retorna estruturas e métricas iniciais", async () => {
    const req = createMockRequest({ action: "list_workspace" });
    const res = await POST(req as any);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.workflows));
    assert.ok(Array.isArray(data.workItems));
    assert.ok(Array.isArray(data.templates));
    assert.ok(data.queues);
    assert.ok(data.capacity);
  });

  let createdWorkflowId = "";

  // 2. Criar Workflow a partir de Template Canônico
  await t.test("2. create_workflow instancia workflow e tarefas a partir de template", async () => {
    const req = createMockRequest({
      action: "create_workflow",
      client_id: clientId,
      template_id: "a0000000-0000-0000-0000-000000000001", // Template de Setup SEO Local
      title: "Implantação SEO Local — Padaria Central",
      workflow_type: "implementation",
      priority: "high",
    });
    const res = await POST(req as any);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.workflow.title, "Implantação SEO Local — Padaria Central");
    assert.equal(data.workflow.priority, "high");
    assert.equal(data.createdItemsCount, 4);
    createdWorkflowId = data.workflow.id;
  });

  // 3. Validação de Dependências ao Iniciar Tarefas
  await t.test("3. start_task bloqueia tarefa quando dependência não está satisfeita", async () => {
    // Busca a tarefa 2 (Auditoria NAP) que depende da tarefa 1
    const task2 = operationsMemoryStore.workItems.find((i) => i.title.includes("Auditoria Completa"));
    assert.ok(task2, "Tarefa 2 deve existir");

    const req = createMockRequest({
      action: "start_task",
      work_item_id: task2.id,
    });
    const res = await POST(req as any);
    // Deve falhar com 409 Conflict devido a dependência pendente
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.match(data.error, /dependências/);
    assert.equal(task2.status, "blocked_by_dependency");
  });

  // 4. Execução da Tarefa 1 (Conferência de Acesso)
  await t.test("4. start_task e complete_task com evidência para liberar dependência", async () => {
    const task1 = operationsMemoryStore.workItems.find((i) => i.title.includes("Conferência de Acesso"));
    assert.ok(task1, "Tarefa 1 deve existir");

    // 4.1 Inicia tarefa 1 (sem dependências)
    const startReq = createMockRequest({
      action: "start_task",
      work_item_id: task1.id,
    });
    const startRes = await POST(startReq as any);
    assert.equal(startRes.status, 200);
    assert.equal(task1.status, "in_progress");

    // 4.2 Tentar concluir sem evidência (deve falhar pois evidence_required = true)
    const failCompleteReq = createMockRequest({
      action: "complete_task",
      work_item_id: task1.id,
      evidence_text: "",
    });
    const failRes = await POST(failCompleteReq as any);
    assert.equal(failRes.status, 400);

    // 4.3 Concluir com evidência válida
    const okCompleteReq = createMockRequest({
      action: "complete_task",
      work_item_id: task1.id,
      evidence_text: "Conexão no Connection Hub validada com sucesso.",
    });
    const okRes = await POST(okCompleteReq as any);
    assert.equal(okRes.status, 200);
    assert.equal(task1.status, "completed");
  });

  // 5. Início da Tarefa 2 após dependência liberada
  await t.test("5. start_task agora permite iniciar Tarefa 2", async () => {
    const task2 = operationsMemoryStore.workItems.find((i) => i.title.includes("Auditoria Completa"));
    assert.ok(task2);

    // Ajusta o ID da dependência para apontar para a task1 real
    const task1 = operationsMemoryStore.workItems.find((i) => i.title.includes("Conferência de Acesso"));
    task2.depends_on_item_ids = [task1!.id];

    const req = createMockRequest({
      action: "start_task",
      work_item_id: task2.id,
    });
    const res = await POST(req as any);
    assert.equal(res.status, 200);
    assert.equal(task2.status, "in_progress");
  });

  // 6. Apontamento de Horas (log_time)
  await t.test("6. log_time registra tempo e acumula no item e no workflow", async () => {
    const task2 = operationsMemoryStore.workItems.find((i) => i.title.includes("Auditoria Completa"));
    assert.ok(task2);

    const initialItemActual = task2.actual_minutes;

    const req = createMockRequest({
      action: "log_time",
      client_id: clientId,
      work_item_id: task2.id,
      minutes_spent: 45,
      notes: "Auditoria de 18 pontos realizada.",
    });
    const res = await POST(req as any);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.totalActualMinutes, initialItemActual + 45);

    const parentWf = operationsMemoryStore.workflows.find((w) => w.id === task2.workflow_id);
    assert.ok(parentWf);
    assert.equal(parentWf.total_actual_minutes, 45);
  });

  // 7. Bloqueio e Desbloqueio de Tarefa
  await t.test("7. block_task e unblock_task gerenciam impedimentos com cliente", async () => {
    const task3 = operationsMemoryStore.workItems.find((i) => i.title.includes("Otimização de Horários"));
    assert.ok(task3);

    // Bloquear
    const blockReq = createMockRequest({
      action: "block_task",
      work_item_id: task3.id,
      blocked_reason: "Cliente não enviou catálogo de serviços completo.",
      block_type: "client_action",
      client_action_required: "Enviar lista de preços em PDF.",
    });
    const blockRes = await POST(blockReq as any);
    assert.equal(blockRes.status, 200);
    assert.equal(task3.status, "blocked_by_client");
    assert.equal(task3.client_action_required, "Enviar lista de preços em PDF.");

    // Desbloquear
    const unblockReq = createMockRequest({
      action: "unblock_task",
      work_item_id: task3.id,
      resolution_notes: "PDF recebido.",
    });
    const unblockRes = await POST(unblockReq as any);
    assert.equal(unblockRes.status, 200);
    assert.equal(task3.status, "todo");
    assert.equal(task3.blocked_reason, null);
  });

  // 8. Tarefa que Requer Aprovação Humana da Liderança
  await t.test("8. complete_task em tarefa com requires_approval avança para in_review", async () => {
    const task3 = operationsMemoryStore.workItems.find((i) => i.title.includes("Otimização de Horários"));
    assert.ok(task3);
    task3.status = "in_progress";
    assert.equal(task3.requires_approval, true);

    const completeReq = createMockRequest({
      action: "complete_task",
      work_item_id: task3.id,
      evidence_text: "Descrições criadas e submetidas para aprovação.",
    });
    const completeRes = await POST(completeReq as any);
    assert.equal(completeRes.status, 200);
    const data = await completeRes.json();
    assert.equal(data.status, "in_review");
    assert.equal(task3.status, "in_review");
  });

  // 9. Registro e Resolução de Exceção Operacional
  await t.test("9. report_exception e resolve_exception registram e encerram incidentes", async () => {
    const reportReq = createMockRequest({
      action: "report_exception",
      client_id: clientId,
      workflow_id: createdWorkflowId,
      severity: "high",
      category: "sla_breach",
      description: "Estouro de prazo em revisão de postagens.",
    });
    const reportRes = await POST(reportReq as any);
    assert.equal(reportRes.status, 201);
    const reportData = await reportRes.json();
    assert.equal(reportData.success, true);
    const excId = reportData.exception.id;

    // Resolver
    const resolveReq = createMockRequest({
      action: "resolve_exception",
      exception_id: excId,
      resolution_notes: "Revisão efetuada pelo gestor de operações.",
    });
    const resolveRes = await POST(resolveReq as any);
    assert.equal(resolveRes.status, 200);
    const resolveData = await resolveRes.json();
    assert.equal(resolveData.exception.status, "resolved");
  });
});
