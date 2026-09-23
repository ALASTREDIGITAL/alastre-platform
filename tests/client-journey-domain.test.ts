import test from "node:test";
import assert from "node:assert/strict";
import {
  JOURNEY_STAGES,
  JOURNEY_TASKS,
  calculateJourneyProgress,
  filterTasks,
  type ClientJourneyState,
} from "../lib/client-journey-domain.ts";

test("Client Journey domain - catálogo e integridade", () => {
  assert.equal(JOURNEY_STAGES.length, 8, "Deve conter exatamente 8 fases de esteira");
  assert.equal(JOURNEY_TASKS.length, 50, "Deve conter o catálogo completo de 50 tarefas mapeadas (44 GMN + 6 GTP)");

  const ids = new Set<string>();
  for (const task of JOURNEY_TASKS) {
    assert.ok(!ids.has(task.id), `ID duplicado detectado: ${task.id}`);
    ids.add(task.id);

    assert.ok(task.title.length > 5, `Título muito curto: ${task.id}`);
    assert.ok(task.description.length > 10, `Descrição muito curta: ${task.id}`);
    assert.ok(["gmn", "gtp", "both"].includes(task.track), `Trilha inválida: ${task.track}`);
    assert.ok(
      ["entrada", "organizando", "executando", "entregue"].includes(task.kanbanColumn),
      `Coluna kanban inválida: ${task.kanbanColumn}`,
    );
    assert.ok(
      JOURNEY_STAGES.some((s) => s.id === task.stageId),
      `Fase inválida associada à tarefa ${task.id}: ${task.stageId}`,
    );

    if (task.targetView) {
      assert.ok(
        typeof task.targetViewLabel === "string" && task.targetViewLabel.length > 0,
        `Tarefa com targetView deve possuir targetViewLabel: ${task.id}`,
      );
    }
  }
});

test("Client Journey domain - filtros por trilha e status", () => {
  const gmnTasks = filterTasks(JOURNEY_TASKS, { track: "gmn" });
  assert.equal(gmnTasks.length, 44, "Deve haver exatamente 44 tarefas na trilha GMN");
  assert.ok(
    gmnTasks.every((t) => t.track === "gmn" || t.track === "both"),
    "Filtro de GMN deve retornar apenas tarefas de GMN ou comuns",
  );

  const gtpTasks = filterTasks(JOURNEY_TASKS, { track: "gtp" });
  assert.equal(gtpTasks.length, 6, "Deve haver exatamente 6 tarefas na trilha GTP");
  assert.ok(
    gtpTasks.every((t) => t.track === "gtp" || t.track === "both"),
    "Filtro de GTP deve retornar apenas tarefas de GTP ou comuns",
  );

  const mockState: ClientJourneyState = {
    clientId: "cli-123",
    tasks: {
      "gmn-onb-whatsapp-group": { status: "completed" },
      "gmn-onb-data-form": { status: "in_progress" },
      "gmn-onb-contract-sign": { status: "blocked" },
    },
    lastUpdated: new Date().toISOString(),
  };

  const pendingOnly = filterTasks(JOURNEY_TASKS, {
    statusFilter: "pending",
    clientState: mockState,
  });
  assert.ok(
    !pendingOnly.some((t) => t.id === "gmn-onb-whatsapp-group"),
    "Tarefas concluídas não devem aparecer no filtro de pendentes",
  );
});

test("Client Journey domain - cálculo de progresso e fase ativa", () => {
  const emptyProgress = calculateJourneyProgress(undefined, JOURNEY_TASKS);
  assert.equal(emptyProgress.total, JOURNEY_TASKS.length);
  assert.equal(emptyProgress.completed, 0);
  assert.equal(emptyProgress.percentage, 0);
  assert.equal(emptyProgress.currentStage.id, "onboarding");

  // Marca todas as tarefas da fase de onboarding como concluídas
  const onboardingTasks = JOURNEY_TASKS.filter((t) => t.stageId === "onboarding");
  const state: ClientJourneyState = {
    clientId: "cli-456",
    tasks: Object.fromEntries(
      onboardingTasks.map((t) => [t.id, { status: "completed" }]),
    ),
    lastUpdated: new Date().toISOString(),
  };

  const nextProgress = calculateJourneyProgress(state, JOURNEY_TASKS);
  assert.equal(nextProgress.completed, onboardingTasks.length);
  assert.ok(nextProgress.percentage > 0 && nextProgress.percentage < 100);
  assert.equal(
    nextProgress.currentStage.id,
    "briefing",
    "Fase ativa deve avançar para Briefing quando Onboarding for concluído",
  );
});
