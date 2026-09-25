import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidWorkItemTransition,
  evaluateDependencies,
  validateWorkItemCompletion,
  categorizeOperationalQueues,
  calculateCapacityMetrics,
  buildWorkflowFromTemplate,
  type WorkItem,
  type WorkflowTemplate,
} from "../lib/operations-domain.ts";

test("Módulo 04 Operations Engine — Transições de Status de Work Items", () => {
  // 1. Transições válidas a partir de 'todo'
  assert.equal(isValidWorkItemTransition("todo", "in_progress"), true);
  assert.equal(isValidWorkItemTransition("todo", "blocked_by_dependency"), true);
  assert.equal(isValidWorkItemTransition("todo", "blocked_by_client"), true);
  assert.equal(isValidWorkItemTransition("todo", "cancelled"), true);
  assert.equal(isValidWorkItemTransition("todo", "completed"), false, "Não pode pular direto de todo para completed");

  // 2. Transições a partir de 'in_progress'
  assert.equal(isValidWorkItemTransition("in_progress", "completed"), true);
  assert.equal(isValidWorkItemTransition("in_progress", "in_review"), true);
  assert.equal(isValidWorkItemTransition("in_progress", "blocked_by_client"), true);
  assert.equal(isValidWorkItemTransition("in_progress", "todo"), true);

  // 3. 'completed' é estado terminal
  assert.equal(isValidWorkItemTransition("completed", "todo"), false);
  assert.equal(isValidWorkItemTransition("completed", "in_progress"), false);
  assert.equal(isValidWorkItemTransition("completed", "completed"), true, "Mesmo estado é permitido");

  // 4. 'in_review' só pode ir para 'completed' ou voltar para 'in_progress'
  assert.equal(isValidWorkItemTransition("in_review", "completed"), true);
  assert.equal(isValidWorkItemTransition("in_review", "in_progress"), true);
  assert.equal(isValidWorkItemTransition("in_review", "todo"), false);
});

test("Módulo 04 Operations Engine — Avaliação Rígida de Dependências", () => {
  const allItems: Array<Pick<WorkItem, "id" | "status" | "title">> = [
    { id: "dep-01", status: "completed", title: "Conexão Google" },
    { id: "dep-02", status: "in_progress", title: "Auditoria NAP" },
    { id: "dep-03", status: "completed", title: "Pesquisa de Termos" },
  ];

  // Caso 1: Dependência única satisfeita
  const item1 = { id: "task-01", depends_on_item_ids: ["dep-01"] };
  const res1 = evaluateDependencies(item1, allItems);
  assert.equal(res1.allowed, true);
  assert.equal(res1.blockingDependencies.length, 0);

  // Caso 2: Dependência não satisfeita (dep-02 está in_progress)
  const item2 = { id: "task-02", depends_on_item_ids: ["dep-01", "dep-02"] };
  const res2 = evaluateDependencies(item2, allItems);
  assert.equal(res2.allowed, false);
  assert.deepEqual(res2.blockingDependencies, ["dep-02"]);
  assert.deepEqual(res2.blockingTitles, ["Auditoria NAP"]);

  // Caso 3: Dependência inexistente no conjunto
  const item3 = { id: "task-03", depends_on_item_ids: ["dep-99"] };
  const res3 = evaluateDependencies(item3, allItems);
  assert.equal(res3.allowed, false);
  assert.deepEqual(res3.blockingDependencies, ["dep-99"]);

  // Caso 4: Sem dependências (sempre liberado)
  const item4 = { id: "task-04", depends_on_item_ids: [] };
  const res4 = evaluateDependencies(item4, allItems);
  assert.equal(res4.allowed, true);
});

test("Módulo 04 Operations Engine — Validação de Conclusão e Evidência", () => {
  // 1. Tarefa com evidência obrigatória sem evidência fornecida
  const itemWithEv = { evidence_required: true, requires_approval: false };
  const failEv = validateWorkItemCompletion(itemWithEv, {});
  assert.equal(failEv.valid, false);
  assert.match(failEv.error || "", /comprovação documental/);

  // 2. Tarefa com evidência textual fornecida
  const passEv = validateWorkItemCompletion(itemWithEv, { evidence_text: "Post publicado no GBP" });
  assert.equal(passEv.valid, true);

  // 3. Tarefa com URL de evidência
  const passUrl = validateWorkItemCompletion(itemWithEv, { evidence_url: "https://business.google.com/123" });
  assert.equal(passUrl.valid, true);

  // 4. Tarefa que requer aprovação da liderança
  const itemWithAppr = { evidence_required: false, requires_approval: true };
  const resAppr = validateWorkItemCompletion(itemWithAppr, {});
  assert.equal(resAppr.valid, true);
  assert.equal(resAppr.requiresApproval, true);
});

test("Módulo 04 Operations Engine — Categorização de Filas Operacionais", () => {
  const refDate = "2026-09-24";
  const items: WorkItem[] = [
    {
      id: "1",
      agency_id: "ag-1",
      client_id: "cl-1",
      workflow_id: "wf-1",
      title: "Tarefa Vencida",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "todo",
      priority: "urgent",
      estimated_minutes: 30,
      actual_minutes: 0,
      due_date: "2026-09-20", // Ontem
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      requires_approval: false,
      evidence_required: false,
      acceptance_criteria: "",
      order_index: 0,
      created_at: refDate,
      updated_at: refDate,
    },
    {
      id: "2",
      agency_id: "ag-1",
      client_id: "cl-1",
      workflow_id: "wf-1",
      title: "Tarefa de Hoje",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "todo",
      priority: "high",
      estimated_minutes: 45,
      actual_minutes: 0,
      due_date: "2026-09-24", // Hoje
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      requires_approval: false,
      evidence_required: false,
      acceptance_criteria: "",
      order_index: 1,
      created_at: refDate,
      updated_at: refDate,
    },
    {
      id: "3",
      agency_id: "ag-1",
      client_id: "cl-1",
      workflow_id: "wf-1",
      title: "Tarefa Bloqueada",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "blocked_by_client",
      priority: "medium",
      estimated_minutes: 60,
      actual_minutes: 10,
      due_date: "2026-09-30",
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      requires_approval: false,
      evidence_required: false,
      acceptance_criteria: "",
      order_index: 2,
      created_at: refDate,
      updated_at: refDate,
    },
    {
      id: "4",
      agency_id: "ag-1",
      client_id: "cl-1",
      workflow_id: "wf-1",
      title: "Tarefa Concluída",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "completed",
      priority: "low",
      estimated_minutes: 30,
      actual_minutes: 25,
      due_date: "2026-09-22",
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      requires_approval: false,
      evidence_required: false,
      acceptance_criteria: "",
      order_index: 3,
      created_at: refDate,
      updated_at: refDate,
    },
  ];

  const queues = categorizeOperationalQueues(items, refDate);
  assert.equal(queues.overdue.length, 1);
  assert.equal(queues.overdue[0].id, "1");
  assert.equal(queues.attentionToday.length, 1);
  assert.equal(queues.attentionToday[0].id, "2");
  assert.equal(queues.blocked.length, 1);
  assert.equal(queues.blocked[0].id, "3");
  assert.equal(queues.completedCount, 1);
});

test("Módulo 04 Operations Engine — Cálculo de Métricas de Capacidade e Variância", () => {
  const items: WorkItem[] = [
    {
      id: "1",
      agency_id: "ag-1",
      client_id: "cl-1",
      workflow_id: "wf-1",
      title: "Task 1",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "completed",
      priority: "medium",
      estimated_minutes: 60,
      actual_minutes: 75, // +15 min
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      requires_approval: false,
      evidence_required: false,
      acceptance_criteria: "",
      order_index: 0,
      created_at: "",
      updated_at: "",
    },
    {
      id: "2",
      agency_id: "ag-1",
      client_id: "cl-1",
      workflow_id: "wf-1",
      title: "Task 2",
      description: "",
      task_type: "manual",
      frequency: "one_off",
      status: "in_progress",
      priority: "medium",
      estimated_minutes: 40,
      actual_minutes: 20,
      sla_hours: 24,
      sla_status: "on_track",
      depends_on_item_ids: [],
      requires_approval: false,
      evidence_required: false,
      acceptance_criteria: "",
      order_index: 1,
      created_at: "",
      updated_at: "",
    },
  ];

  const metrics = calculateCapacityMetrics(items);
  assert.equal(metrics.totalEstimatedMinutes, 100);
  assert.equal(metrics.totalActualMinutes, 95);
  assert.equal(metrics.varianceMinutes, -5);
  assert.equal(metrics.tasksCompleted, 1);
  assert.equal(metrics.tasksPending, 1);
});

test("Módulo 04 Operations Engine — Instanciação de Workflow a partir de Template", () => {
  const template: WorkflowTemplate = {
    id: "tpl-01",
    agency_id: "ag-01",
    name: "Setup SEO Local",
    slug: "setup-seo-local",
    version: 1,
    category: "local_seo",
    description: "Setup inicial do Google Meu Negócio",
    trigger_type: "onboarding_activated",
    is_active: true,
    estimated_total_minutes: 120,
    created_at: "",
    updated_at: "",
    definition: [
      {
        id: "t1",
        title: "Passo 1",
        description: "",
        task_type: "manual",
        frequency: "one_off",
        estimated_minutes: 30,
        sla_hours: 24,
        requires_approval: false,
        evidence_required: true,
        acceptance_criteria: "Critério 1",
        order_index: 0,
      },
      {
        id: "t2",
        title: "Passo 2",
        description: "",
        task_type: "hybrid",
        frequency: "one_off",
        estimated_minutes: 90,
        sla_hours: 48,
        requires_approval: true,
        evidence_required: true,
        acceptance_criteria: "Critério 2",
        order_index: 1,
        depends_on_task_ids: ["t1"],
      },
    ],
  };

  const client = { id: "cl-01", agency_id: "ag-01", name: "Padaria Alfa" };
  const result = buildWorkflowFromTemplate(template, client, { priority: "high" });

  assert.equal(result.workflow.title, "Setup SEO Local — Padaria Alfa");
  assert.equal(result.workflow.priority, "high");
  assert.equal(result.workflow.total_estimated_minutes, 120);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, "Passo 1");
  assert.equal(result.items[0].evidence_required, true);
  assert.equal(result.items[1].requires_approval, true);
  assert.deepEqual(result.items[1].depends_on_item_ids, ["t1"]);
});
