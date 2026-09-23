import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDnaCompleteness,
  buildMissingInfoChecklist,
  buildAiPromptPreview,
  getCriticalPendingFields,
  TONE_OF_VOICE_PRESETS,
} from "../lib/dna-domain.ts";

describe("Domínio do DNA & Editor Operacional", () => {
  test("calcula completude real de 0% para dados vazios", () => {
    const result = calculateDnaCompleteness({}, {}, {});
    assert.equal(result.percentage, 0);
    assert.equal(result.filledCount, 0);
    assert.equal(result.totalCount, 11);
  });

  test("calcula completude real proporcional quando preenchido parcialmente", () => {
    const result = calculateDnaCompleteness(
      {
        name: "Clínica Sorriso",
        segment: "Odontologia",
        city: "Santo André",
        whatsapp: "11988887777",
        primary_service: "Implante Dentário",
      },
      {},
      {}
    );
    // 5 campos preenchidos de 11 -> Math.round((5 / 11) * 100) = 45%
    assert.equal(result.filledCount, 5);
    assert.equal(result.percentage, 45);
  });

  test("calcula 100% de completude com todos os critérios vitais preenchidos", () => {
    const result = calculateDnaCompleteness(
      {
        name: "Auto Center Alastre",
        segment: "Oficina Mecânica",
        cities: ["São Bernardo", "Santo André"],
        address: "Av. Industrial, 500",
        phone: "1140028922",
        primary_service: "Alinhamento e Balanceamento",
        services: ["Troca de Óleo", "Freios", "Suspensão"],
        differentiators: ["Atendimento no mesmo dia", "Garantia de 1 ano"],
        tone_of_voice: "Profissional & Técnico",
        editorial_instructions: "Destacar agendamento sem fila e garantia.",
      },
      {
        primary_keyword: "oficina mecanica santo andre",
        keywords: ["alinhamento santo andre", "troca de oleo abc"],
      },
      {
        forbidden_claims: ["Não prometer conserto grátis"],
      }
    );
    assert.equal(result.filledCount, 11);
    assert.equal(result.percentage, 100);
  });

  test("identifica campos pendentes críticos para confirmação oficial", () => {
    const missing = getCriticalPendingFields({});
    assert.ok(missing.includes("Nome da empresa"));
    assert.ok(missing.includes("Segmento / Categoria principal"));
    assert.ok(missing.includes("Cidade de atuação"));
    assert.ok(missing.includes("Serviço principal de tração"));
    assert.ok(missing.includes("Contato (WhatsApp ou Telefone)"));

    const valid = getCriticalPendingFields({
      name: "Padaria Central",
      segment: "Panificação",
      city: "São Paulo",
      primary_service: "Pão Francês",
      whatsapp: "11999998888",
    });
    assert.equal(valid.length, 0);
  });

  test("suporta itens ignorados no checklist sem penalizar a completude", () => {
    const completeness = calculateDnaCompleteness(
      {
        name: "Serviço 100% Online",
        segment: "SaaS",
        city: "Brasil",
        primary_service: "Software de Gestão",
        whatsapp: "11999998888",
      },
      {
        ignored_missing_items: ["check_address"], // Ignorou endereço físico
      },
      {}
    );

    const addressCheck = completeness.items.find((i) => i.id === "address");
    assert.ok(addressCheck);
    assert.equal(addressCheck.ignored, true);
    assert.equal(addressCheck.filled, true);
  });

  test("monta checklist acionável com campos pendentes, ignorados e da análise", () => {
    const completeness = calculateDnaCompleteness(
      { name: "Pizzaria do Bairro" },
      {},
      {}
    );
    const checklist = buildMissingInfoChecklist(
      completeness,
      ["horário de funcionamento", "área de entrega"],
      ["check_address"]
    );

    assert.ok(checklist.length > 0);
    const nameItem = checklist.find((i) => i.id === "check_name");
    assert.ok(nameItem);
    assert.equal(nameItem.completed, true);

    const addressItem = checklist.find((i) => i.id === "check_address");
    assert.ok(addressItem);
    assert.equal(addressItem.ignored, true);

    const contactItem = checklist.find((i) => i.id === "check_contact");
    assert.ok(contactItem);
    assert.equal(contactItem.completed, false);

    const extraItem = checklist.find((i) => i.id.includes("entrega"));
    assert.ok(extraItem);
    assert.equal(extraItem.completed, false);
  });

  test("gera preview fiel do contexto da IA incluindo FAQ e concorrentes", () => {
    const preview = buildAiPromptPreview(
      "Alastre Tech",
      {
        name: "Alastre Tech",
        segment: "Software",
        city: "São Paulo",
        primary_service: "Desenvolvimento Web",
        tone_of_voice: "Direto & Comercial",
        editorial_instructions: "Focar em agilidade de entrega.",
        faq: [
          { id: "1", question: "Vocês atendem finais de semana?", answer: "Sim, via plantão 24/7." },
        ],
      },
      {
        keywords: ["software sp", "desenvolvimento sp"],
        competitors: ["TechCorp", "DevStudio"],
      },
      {
        forbidden_claims: ["Nunca prometer prazo de 24h sem orçamento"],
      }
    );

    assert.ok(preview.rules.some((r) => r.includes("Direto & Comercial")));
    assert.ok(preview.rules.some((r) => r.includes("Nunca prometer prazo de 24h")));
    assert.ok(preview.rules.some((r) => r.includes("TechCorp, DevStudio")));
    assert.ok(preview.rules.some((r) => r.includes("1 perguntas cadastradas")));
    assert.equal(preview.contextJson.nome_empresa, "Alastre Tech");
    assert.equal(preview.contextJson.segmento, "Software");
    assert.equal(Array.isArray(preview.contextJson.concorrentes), true);
    assert.equal(Array.isArray(preview.contextJson.faq), true);
  });

  test("expõe presets de tom de voz com descrições claras", () => {
    assert.ok(TONE_OF_VOICE_PRESETS.length >= 4);
    assert.ok(TONE_OF_VOICE_PRESETS.some((p) => p.id === "acolhedor"));
    assert.ok(TONE_OF_VOICE_PRESETS.some((p) => p.id === "profissional"));
  });
});
