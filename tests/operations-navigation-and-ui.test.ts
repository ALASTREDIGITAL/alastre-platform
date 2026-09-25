import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("Módulo 04 Operations Engine — Navegação e Contratos de UI", async (t) => {
  const appShellContent = await readFile(`${root}/app/app-shell.tsx`, "utf8");
  const moduleUiContent = await readFile(`${root}/app/operations-engine-module.tsx`, "utf8");
  const helpContent = await readFile(`${root}/lib/help-content.ts`, "utf8");

  await t.test("1. AppShell registra view 'operations-engine' no tipo View e array views", () => {
    assert.match(appShellContent, /"operations-engine"/);
    assert.match(appShellContent, /export type View =\s*\|\s*"overview"\s*\|\s*"operations-engine"/);
  });

  await t.test("2. AppShell inclui 'Motor de Operações' no grupo Operação com destaque", () => {
    assert.match(appShellContent, /label:\s*"Motor de Operações"/);
    assert.match(appShellContent, /view:\s*"operations-engine"/);
    assert.match(appShellContent, /featured:\s*true/);
  });

  await t.test("3. AppShell renderiza OperationsEngineModule no chaveamento de views", () => {
    assert.match(appShellContent, /activeView === "operations-engine"/);
    assert.match(appShellContent, /<OperationsEngineModule\s+onNavigate=\{/);
  });

  await t.test("4. OperationsEngineModule trata estados essenciais (loading, vazio, indisponível, erro)", () => {
    // Loading
    assert.match(moduleUiContent, /Sincronizando tarefas operacionais/);
    // Indisponível
    assert.match(moduleUiContent, /IntegrationState/);
    // Vazio
    assert.match(moduleUiContent, /Nenhuma tarefa pendente nesta fila/);
    // Erro
    assert.match(moduleUiContent, /errorMessage/);
    // Feedback
    assert.match(moduleUiContent, /feedbackSuccess/);
  });

  await t.test("5. OperationsEngineModule implementa Modo Simples e Modo Avançado", () => {
    assert.match(moduleUiContent, /isAdvancedMode/);
    assert.match(moduleUiContent, /Modo Simples/);
    assert.match(moduleUiContent, /Modo Avançado/);
  });

  await t.test("6. OperationsEngineModule possui abas operacionais completas", () => {
    assert.match(moduleUiContent, /Filas & Atenção Hoje/);
    assert.match(moduleUiContent, /Workflows Ativos/);
    assert.match(moduleUiContent, /Quadro Visual \(Kanban\)/);
    assert.match(moduleUiContent, /Capacidade & Horas/);
    assert.match(moduleUiContent, /Templates de Serviço/);
  });

  await t.test("7. Registro de ajuda contextual em help-content.ts para operations.overview", () => {
    assert.match(helpContent, /"operations\.overview":/);
    assert.match(helpContent, /title:\s*"Central de Operações"/);
  });
});
