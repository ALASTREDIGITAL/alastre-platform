(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Módulo 08 — Capacidade e Financeiro: UI e Navegação", async (t) => {
  await t.test("módulo UI existe e contém as 8 abas obrigatórias", () => {
    const uiPath = path.join(process.cwd(), "app", "capacity-and-finance-module.tsx");
    assert.ok(fs.existsSync(uiPath));

    const content = fs.readFileSync(uiPath, "utf-8");

    // Abas obrigatórias
    assert.ok(content.includes("Visão Econômica"));
    assert.ok(content.includes("Premissas e Custos"));
    assert.ok(content.includes("Tempo e Retrabalho"));
    assert.ok(content.includes("Capacidade e Gargalos"));
    assert.ok(content.includes("Cenários de Crescimento"));
    assert.ok(content.includes("Margem e Viabilidade"));
    assert.ok(content.includes("Precificação e Descontos"));
    assert.ok(content.includes("Histórico e Auditoria"));

    // Contém seletor de Modo Simples / Avançado
    assert.ok(content.includes("Modo Avançado (Ativo)"));
    assert.ok(content.includes("Modo Simples"));

    // Contém aviso de Isenção (Projection Disclaimer)
    assert.ok(content.includes("Aviso de Isenção Econômica"));
  });

  await t.test("app-shell registra o Módulo 08 (Financeiro) direcionando para o componente real", () => {
    const appShellPath = path.join(process.cwd(), "app", "app-shell.tsx");
    const content = fs.readFileSync(appShellPath, "utf-8");

    assert.ok(content.includes('import { CapacityFinanceModule } from "./capacity-and-finance-module";'));
    assert.ok(content.includes('<CapacityFinanceModule onNavigate={(view) => navigateToView(view as View)} selectedClientId={selectedClient} />'));
  });
});
