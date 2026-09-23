import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  COPILOT_CONFIGS,
  parseCopilotSuggestions,
} from "../lib/dna-domain.ts";

describe("Copilotos Especializados Embutidos", () => {
  test("expõe configurações e avisos de escopo estrito para todos os copilotos", () => {
    const types = ["keywords", "competitors", "voice", "faq"] as const;
    for (const t of types) {
      const cfg = COPILOT_CONFIGS[t];
      assert.ok(cfg.title);
      assert.ok(cfg.scopeNotice.includes("Escopo Estrito"));
      assert.ok(cfg.quickPrompts.length >= 2);
    }
  });

  test("faz parsing de tags explícitas de sugestão de palavras-chave", () => {
    const rawAiResponse = `Aqui estão ótimas opções para seu segmento:
* [ADICIONAR_PALAVRA: implante dentario santo andre]
* [ADICIONAR_PALAVRA: clareamento dental preco]
Estas palavras têm alta intenção comercial.`;

    const parsed = parseCopilotSuggestions(rawAiResponse, "keywords");
    assert.equal(parsed.suggestions.length, 2);
    assert.equal(parsed.suggestions[0].type, "keyword");
    assert.equal(parsed.suggestions[0].value, "implante dentario santo andre");
    assert.equal(parsed.suggestions[1].value, "clareamento dental preco");
    assert.ok(!parsed.cleanText.includes("[ADICIONAR_PALAVRA"));
  });

  test("faz parsing de tags explícitas de concorrentes", () => {
    const rawAiResponse = `Identifiquei estes concorrentes fortes no Google Maps:
* [ADICIONAR_CONCORRENTE: Clinica Sorriso Prime]
* [ADICIONAR_CONCORRENTE: Odonto ABC Especialistas]`;

    const parsed = parseCopilotSuggestions(rawAiResponse, "competitors");
    assert.equal(parsed.suggestions.length, 2);
    assert.equal(parsed.suggestions[0].type, "competitor");
    assert.equal(parsed.suggestions[0].value, "Clinica Sorriso Prime");
  });

  test("faz parsing de listas em negrito quando o modelo não usa tags explícitas", () => {
    const rawAiResponse = `Sugiro os seguintes termos para você:
* **dentista 24 horas santo andre** - busca de emergência
* **protese dentaria fixa** - serviço de alto valor`;

    const parsed = parseCopilotSuggestions(rawAiResponse, "keywords");
    assert.equal(parsed.suggestions.length, 2);
    assert.equal(parsed.suggestions[0].value, "dentista 24 horas santo andre");
    assert.equal(parsed.suggestions[1].value, "protese dentaria fixa");
  });

  test("handleDnaCopilotChat bloqueia perguntas fora do escopo do negócio", async () => {
    const { handleDnaCopilotChat } = await import("../lib/dna-copilot-service.ts");
    const result = await handleDnaCopilotChat({
      functionUrl: "http://localhost:9999",
      bridgeSecret: "secret",
      email: "test@example.com",
      clientId: "00000000-0000-0000-0000-000000000000",
      copilotType: "keywords",
      message: "me dê uma receita de bolo de cenoura",
    });

    assert.ok(result.content.includes("meu escopo é restrito"));
  });

  test("handleDnaCopilotChat gera termos comerciais e tags de ação para estética automotiva", async () => {
    const { handleDnaCopilotChat } = await import("../lib/dna-copilot-service.ts");
    const result = await handleDnaCopilotChat({
      functionUrl: "http://localhost:9999",
      bridgeSecret: "secret",
      email: "test@example.com",
      clientId: "00000000-0000-0000-0000-000000000000",
      copilotType: "keywords",
      message: "Quais principais palavras chaves que meus concorrentes em são bernardo do campo estão trabalhando",
    });

    assert.ok(result.content.includes("[ADICIONAR_PALAVRA:"));
    const parsed = parseCopilotSuggestions(result.content, "keywords");
    assert.ok(parsed.suggestions.length > 0);
  });

  test("handleDnaCopilotChat aceita histórico multi-turn conversacional", async () => {
    const { handleDnaCopilotChat } = await import("../lib/dna-copilot-service.ts");
    const result = await handleDnaCopilotChat({
      functionUrl: "http://localhost:9999",
      bridgeSecret: "secret",
      email: "test@example.com",
      clientId: "00000000-0000-0000-0000-000000000000",
      copilotType: "keywords",
      message: "E quais termos de busca para vitrificação?",
      history: [
        { role: "user", content: "Quais palavras-chave para estética automotiva?" },
        { role: "assistant", content: "Sugiro polimento técnico e cristalização." },
      ],
      context: {
        client_name: "Pinheiro Estética Automotiva",
        segment: "Estética Automotiva",
        city: "São Bernardo do Campo",
        services: ["Polimento", "Vitrificação de Pintura", "Higienização"],
      },
    });

    assert.ok(result.content);
    assert.equal(result.copilot_type, "keywords");
  });
});
