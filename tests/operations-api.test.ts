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
  const otherAgencyId = "00000000-0000-0000-0000-000000000002";
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

  // 10. Rejeição de Vínculos Cross-Tenant e Isolamento Multi-Tenant na API
  await t.test("10. API rejeita acesso e mutações em recursos de outra agência (cross-tenant)", async () => {
    const foreignWfId = "f0000000-0000-0000-0000-000000000099";
    const foreignItemId = "f0000000-0000-0000-0000-000000000088";
    const foreignExcId = "f0000000-0000-0000-0000-000000000077";

    // Injeta dados da Agência B no store
    operationsMemoryStore.workflows.push({
      id: foreignWfId,
      agency_id: otherAgencyId,
      client_id: "c2000000-0000-0000-0000-000000000002",
      unit_id: null,
      service_id: null,
      template_id: null,
      title: "Workflow Confidencial Agência B",
      workflow_type: "implementation",
      status: "pending",
      priority: "high",
      progress_percentage: 0,
      total_estimated_minutes: 100,
      total_actual_minutes: 0,
      blocked_reason: null,
      target_start_date: "2026-09-25",
      target_due_date: null,
      started_at: null,
      completed_at: null,
      assigned_actor_id: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    operationsMemoryStore.workItems.push({
      id: foreignItemId,
      agency_id: otherAgencyId,
      client_id: "c2000000-0000-0000-0000-000000000002",
      workflow_id: foreignWfId,
      unit_id: null,
      title: "Tarefa Secreta Agência B",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "todo",
      priority: "high",
      estimated_minutes: 30,
      actual_minutes: 0,
      due_date: null,
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      assigned_actor_id: null,
      assigned_actor_name: null,
      requires_approval: false,
      approval_item_id: null,
      evidence_required: false,
      evidence_text: null,
      evidence_url: null,
      acceptance_criteria: "",
      sop_reference: null,
      blocked_reason: null,
      client_action_required: null,
      completed_at: null,
      completed_by_actor_id: null,
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    operationsMemoryStore.exceptions.push({
      id: foreignExcId,
      agency_id: otherAgencyId,
      client_id: "c2000000-0000-0000-0000-000000000002",
      workflow_id: foreignWfId,
      work_item_id: foreignItemId,
      severity: "critical",
      status: "open",
      category: "system_error",
      description: "Incidente da Agência B",
      resolution_notes: null,
      reported_by_actor_id: "actor-b@other.com",
      resolved_by_actor_id: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 10.1 list_workspace para Agência A NÃO traz recursos da Agência B
    const listReq = createMockRequest({ action: "list_workspace" });
    const listRes = await POST(listReq as any);
    const listData = await listRes.json();
    assert.equal(
      listData.workflows.some((w: any) => w.id === foreignWfId),
      false,
      "Workflow da Agência B não deve ser listado para Agência A"
    );
    assert.equal(
      listData.workItems.some((i: any) => i.id === foreignItemId),
      false,
      "Work item da Agência B não deve ser listado para Agência A"
    );
    assert.equal(
      listData.exceptions.some((e: any) => e.id === foreignExcId),
      false,
      "Exceção da Agência B não deve ser listada para Agência A"
    );

    // 10.2 Tentar iniciar tarefa da Agência B como Agência A
    const startReq = createMockRequest({
      action: "start_task",
      work_item_id: foreignItemId,
    });
    const startRes = await POST(startReq as any);
    assert.equal(startRes.status, 404, "Tentativa de iniciar tarefa de outro tenant deve retornar 404");

    // 10.3 Tentar concluir tarefa da Agência B como Agência A
    const completeReq = createMockRequest({
      action: "complete_task",
      work_item_id: foreignItemId,
    });
    const completeRes = await POST(completeReq as any);
    assert.equal(completeRes.status, 404, "Tentativa de concluir tarefa de outro tenant deve retornar 404");

    // 10.4 Tentar apontar tempo em tarefa da Agência B
    const logTimeReq = createMockRequest({
      action: "log_time",
      client_id: clientId,
      work_item_id: foreignItemId,
      minutes_spent: 30,
    });
    const logTimeRes = await POST(logTimeReq as any);
    assert.equal(logTimeRes.status, 404, "Tentativa de apontar tempo em tarefa de outro tenant deve retornar 404");

    // 10.5 Tentar resolver exceção da Agência B
    const resolveExcReq = createMockRequest({
      action: "resolve_exception",
      exception_id: foreignExcId,
      resolution_notes: "Tentativa cross-tenant",
    });
    const resolveExcRes = await POST(resolveExcReq as any);
    assert.equal(resolveExcRes.status, 404, "Tentativa de resolver exceção de outro tenant deve retornar 404");
  });
});
