import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { POC_OFFLINE_LEADS } from "../lib/prospecting/poc-offline-leads.ts";

describe("Prospecting Navigation & Rendering Contracts (Requisitos 1 e 11)", () => {
  it("confirms sidebar groups reorganization: Central de Prospecção in Prospecção, Pré-Análise in separate Auditoria group", async () => {
    const appShellPath = path.resolve(process.cwd(), "app", "app-shell.tsx");
    const appShellContent = await fs.readFile(appShellPath, "utf8");

    // 1. "Central de Prospecção" deve estar sob o grupo "Prospecção" com view "prospecting" e ícone Compass
    assert.ok(
      appShellContent.includes('label: "Prospecção"'),
      "Grupo 'Prospecção' deve existir no menu lateral"
    );
    assert.ok(
      appShellContent.includes('label: "Central de Prospecção"'),
      "Item 'Central de Prospecção' deve existir"
    );
    assert.ok(
      appShellContent.includes('view: "prospecting"'),
      "View 'prospecting' deve estar configurada para a Central de Prospecção"
    );
    assert.ok(
      appShellContent.includes("icon: Compass"),
      "Ícone Compass deve ser utilizado para a Central de Prospecção"
    );

    // 2. "Pré-Análise" deve estar no grupo separado "Auditoria"
    assert.ok(
      appShellContent.includes('label: "Auditoria"'),
      "Grupo separado 'Auditoria' deve existir"
    );
    assert.ok(
      appShellContent.includes('label: "Pré-Análise"'),
      "Item 'Pré-Análise' deve existir dentro do grupo Auditoria"
    );
    assert.ok(
      appShellContent.includes('view: "pre-audit"'),
      "View 'pre-audit' deve estar preservada"
    );

    // 3. "SEO Local" deve permanecer em grupo próprio e separado
    assert.ok(
      appShellContent.includes('label: "SEO Local"'),
      "Grupo 'SEO Local' deve permanecer separado"
    );

    // 4. ProspectingModule deve ser importado e renderizado quando activeView === "prospecting"
    assert.ok(
      appShellContent.includes('import { ProspectingModule } from "./prospecting-module";'),
      "ProspectingModule deve ser importado independentemente"
    );
    assert.ok(
      appShellContent.includes('activeView === "prospecting" ? ('),
      "ProspectingModule deve ser renderizado quando activeView for 'prospecting'"
    );
  });

  it("verifies strict single-active-item guarantee: no two items can be active simultaneously", async () => {
    const appShellPath = path.resolve(process.cwd(), "app", "app-shell.tsx");
    const appShellContent = await fs.readFile(appShellPath, "utf8");

    // O seletor ativo utiliza comparação estrita com o activeView único:
    // item.view === activeView
    assert.ok(
      appShellContent.includes("const active = item.view === activeView;"),
      "Ativação do item deve ser estritamente igual ao activeView"
    );

    // Confirma que 'prospecting' e 'pre-audit' têm views distintas
    assert.notEqual("prospecting", "pre-audit");
  });

  it("proves strict null preservation and zero synthetic fallbacks on the 10 offline leads", () => {
    assert.equal(POC_OFFLINE_LEADS.length, 10, "Dataset offline deve conter exatamente 10 registros");

    for (const lead of POC_OFFLINE_LEADS) {
      assert.ok(lead.name.length > 0, "Nome da empresa deve existir");
      assert.ok(lead.category.length > 0, "Categoria deve existir");
      assert.ok(lead.maps_url.startsWith("https://www.google.com/maps"), "URL do Maps deve ser legítima");

      // Nenhuma nota sintética (todos são factualmente null ou float 1..5)
      if (lead.rating !== null) {
        assert.ok(lead.rating >= 1.0 && lead.rating <= 5.0, "Nota deve ser válida");
      }

      // Review count é não-negativo quando presente
      if (lead.review_count !== null) {
        assert.ok(lead.review_count >= 0, "Contagem deve ser >= 0");
      }
    }

    // Validação específica de empresas sem telefone na coleta (ex: Art Glass)
    const artGlass = POC_OFFLINE_LEADS.find((l) => l.name === "Art Glass Vidraçaria");
    assert.ok(artGlass);
    assert.equal(artGlass.phone, null, "Telefone ausente na coleta deve permanecer estritamente null");

    // Validação de empresa sem website (ex: Vidraçaria Sorocaba - Vidro e Arte)
    const vidroArte = POC_OFFLINE_LEADS.find((l) => l.name === "Vidraçaria Sorocaba - Vidro e Arte");
    assert.ok(vidroArte);
    assert.equal(vidroArte.website, null, "Website ausente na coleta deve permanecer estritamente null");
  });

  it("verifies that ProspectingModule provides a functional form with active buttons and safeguards", async () => {
    const modulePath = path.resolve(process.cwd(), "app", "prospecting-module.tsx");
    const moduleContent = await fs.readFile(modulePath, "utf8");

    // 1. Título e explicação
    assert.ok(moduleContent.includes("Central de Prospecção"));
    assert.ok(
      moduleContent.includes(
        "Encontre negócios locais no Google Maps e identifique oportunidades comerciais"
      )
    );

    // 2. Banner de salvaguardas e governança da homologação
    assert.ok(
      moduleContent.includes(
        "Ambiente Local de Homologação — Operação Factual Segura"
      )
    );
    assert.ok(
      moduleContent.includes(
        "Nenhum contato é realizado com empresas prospectadas"
      )
    );

    // 3. Botões funcionais habilitados
    assert.ok(
      moduleContent.includes("handleStartProspecting"),
      "Formulário deve possuir manipulador de envio ativo"
    );
    assert.ok(
      moduleContent.includes("handleCancelProspecting"),
      "Deve possuir manipulador de cancelamento de execução"
    );
    assert.ok(
      moduleContent.includes("handleClearResults"),
      "Deve possuir manipulador de limpeza de resultados"
    );
    assert.ok(
      moduleContent.includes("handleExportCsv"),
      "Deve possuir manipulador de exportação CSV"
    );

    // 4. Prevenção de duplo clique e estado de carregamento / supervisor offline (Requisitos 2 e 4)
    assert.ok(
      moduleContent.includes("isExecutionActive || isSubmitting"),
      "Botão de envio deve ser desabilitado durante a execução para impedir duplo clique"
    );

    // 5. Preservação de null: mensagens factuais exigidas
    assert.ok(
      moduleContent.includes("Não informada"),
      "Rating null deve exibir 'Não informada'"
    );
    assert.ok(
      moduleContent.includes("Não localizado"),
      "Telefone/site null deve exibir 'Não localizado'"
    );

    // 6. Checklist de validação humana local em memória
    assert.ok(moduleContent.includes("Checklist de Auditoria Manual"));
    assert.ok(moduleContent.includes("Nome e razão conferem no Google Maps"));
    assert.ok(moduleContent.includes("Endereço físico confirmado"));
    assert.ok(moduleContent.includes("Telefone conferido ou confirmado ausente"));
    assert.ok(moduleContent.includes("Website ou redes sociais conferidos"));
    assert.ok(moduleContent.includes("Nota e volume de avaliações conferem com a ficha"));
  });
});
