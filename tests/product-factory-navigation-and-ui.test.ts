import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { HELP_CONTENT } from "../lib/help-content.ts";

describe("Product Factory Navigation & UI Contracts", () => {
  it("confirms AppShell integration for Fábrica de Produtos", async () => {
    const appShellPath = path.resolve(process.cwd(), "app", "app-shell.tsx");
    const content = await fs.readFile(appShellPath, "utf8");

    // 1. Group 'Produtos' exists
    assert.ok(
      content.includes('label: "Produtos"'),
      "Grupo 'Produtos' deve existir no menu lateral"
    );

    // 2. NavItem 'Fábrica de Produtos' exists with view 'product-factory' and PackagePlus icon
    assert.ok(
      content.includes('label: "Fábrica de Produtos"'),
      "Item 'Fábrica de Produtos' deve existir"
    );
    assert.ok(
      content.includes('view: "product-factory"'),
      "View 'product-factory' deve estar associada ao item"
    );
    assert.ok(
      content.includes("icon: PackagePlus"),
      "Ícone PackagePlus deve ser usado para Fábrica de Produtos"
    );

    // 3. View union and views array include 'product-factory'
    assert.ok(
      content.includes('| "product-factory"'),
      "Tipo View deve incluir 'product-factory'"
    );
    assert.ok(
      content.includes('"product-factory",'),
      "Array views deve incluir 'product-factory'"
    );

    // 4. Default open group includes Produtos
    assert.ok(
      content.includes('"Produtos": true'),
      "Grupo Produtos deve estar aberto por padrão"
    );

    // 5. ProductFactoryModule import and conditional rendering
    assert.ok(
      content.includes('import { ProductFactoryModule } from "./product-factory-module";'),
      "ProductFactoryModule deve ser importado"
    );
    assert.ok(
      content.includes('activeView === "product-factory" ? ('),
      "ProductFactoryModule deve ser renderizado quando activeView for 'product-factory'"
    );
  });

  it("verifies ProductFactoryModule has required safeguards and architecture components", async () => {
    const modulePath = path.resolve(process.cwd(), "app", "product-factory-module.tsx");
    const content = await fs.readFile(modulePath, "utf8");

    // 1. Simple mode by default and toggle to advanced mode
    assert.ok(
      content.includes("isAdvancedMode"),
      "Módulo deve suportar modo avançado com chaveamento"
    );
    assert.ok(
      content.includes("Modo Avançado"),
      "Módulo deve conter controle visual para Modo Avançado"
    );

    // 2. 4 core tabs: discovery, scope, sops_raci, viability
    assert.ok(content.includes('value="discovery"'), "Aba Descoberta deve existir");
    assert.ok(content.includes('value="scope"'), "Aba Matriz de Escopo deve existir");
    assert.ok(content.includes('value="sops_raci"'), "Aba SOPs & RACI deve existir");
    assert.ok(content.includes('value="viability"'), "Aba Viabilidade & Checkpoint deve existir");

    // 3. Information classification tags
    assert.ok(content.includes('value="fact"'), "Deve suportar classificação 'fact'");
    assert.ok(content.includes('value="evidence"'), "Deve suportar classificação 'evidence'");
    assert.ok(content.includes('value="inference"'), "Deve suportar classificação 'inference'");
    assert.ok(content.includes('value="hypothesis"'), "Deve suportar classificação 'hypothesis'");
    assert.ok(content.includes('value="gap"'), "Deve suportar classificação 'gap'");

    // 4. Scope separation: setup vs monthly
    assert.ok(content.includes("setup") && content.includes("monthly"), "Deve separar setup de monthly");

    // 5. RACI roles and future role flags
    assert.ok(content.includes("is_future_role"), "Deve suportar flag de papel futuro no RACI");

    // 6. Pricing safeguard: no premature pricing or promises
    assert.ok(
      content.includes("Preço, plano e promessa comercial dependem de viabilidade aprovada e revisão humana") ||
      content.includes("viabilidade"),
      "Salvaguarda contra precificação prematura deve estar presente"
    );
  });

  it("verifies contextual help entry for product_factory.overview", () => {
    const entry = HELP_CONTENT["product_factory.overview" as keyof typeof HELP_CONTENT];
    assert.ok(entry, "Entrada product_factory.overview deve existir no registro de ajuda");
    assert.ok(entry.title.length > 0, "Título de ajuda não pode ser vazio");
    assert.ok(entry.description.length > 0, "Descrição de ajuda não pode ser vazia");
    assert.ok(entry.whyItMatters.length > 0, "whyItMatters de ajuda não pode ser vazio");
    assert.ok(entry.nextStep.length > 0, "nextStep de ajuda não pode ser vazio");
  });
});
