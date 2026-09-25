(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Módulo 07 — UI e Navegação: Estrutura do Componente da Central de CS", async (t) => {
  await t.test("valida existência do arquivo de UI app/client-success-module.tsx", () => {
    const filePath = path.join(process.cwd(), "app", "client-success-module.tsx");
    assert.ok(fs.existsSync(filePath), "O componente app/client-success-module.tsx deve existir");

    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("export function ClientSuccessModule"), "Deve exportar a função ClientSuccessModule");
    assert.ok(content.includes("Modo Simples"), "Deve conter suporte ao Modo Simples como padrão");
    assert.ok(content.includes("Modo Avançado"), "Deve conter alternância para Modo Avançado");
    assert.ok(content.includes("Carteira & Health Score"), "Deve conter aba de Carteira e Health Score");
    assert.ok(content.includes("Scorecard de Valor"), "Deve conter aba de Scorecard de Valor");
    assert.ok(content.includes("Reuniões e Decisões"), "Deve conter aba de Reuniões e Decisões");
    assert.ok(content.includes("Riscos e Recuperação"), "Deve conter aba de Riscos e Recuperação");
    assert.ok(content.includes("Renovação e Escopo"), "Deve conter aba de Renovação e Escopo");
    assert.ok(content.includes("Expansão (Upsell)"), "Deve conter aba de Expansão");
    assert.ok(content.includes("Cancelamento & Offboarding"), "Deve conter aba de Cancelamento e Offboarding");
    assert.ok(content.includes("Histórico & Auditoria"), "Deve conter aba de Histórico");
  });

  await t.test("valida registro do módulo client-success em app/app-shell.tsx", () => {
    const appShellPath = path.join(process.cwd(), "app", "app-shell.tsx");
    const appShellContent = fs.readFileSync(appShellPath, "utf8");

    assert.ok(appShellContent.includes("client-success"), "app-shell.tsx deve incluir a view client-success");
    assert.ok(appShellContent.includes("ClientSuccessModule"), "app-shell.tsx deve importar e renderizar ClientSuccessModule");
    assert.ok(appShellContent.includes("Sucesso do Cliente"), "app-shell.tsx deve conter a opção Sucesso do Cliente no menu");
  });
});
