import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { buildLocalSeoAiContext } from "../supabase/functions/_shared/local-seo-ai-context.ts";

describe("política mínima de dados para IA", () => {
  test("mantém somente campos públicos allowlisted", () => {
    const context = buildLocalSeoAiContext("post", {
      client: { name: "Empresa", id: "interno", email: "privado@exemplo.com" },
      dna: {
        business_data: {
          services: ["Serviço A"],
          cities: ["Campinas"],
          tone_of_voice: "Acolhedor",
          phone: "11999998888",
          financial: { revenue: 1000 },
        },
        paid_media_rules: { token: "não pode sair" },
      },
      briefing: {
        theme: "Tema",
        objective: "Objetivo",
        internal_id: "x",
        cta: "Fale conosco",
      },
    });
    assert.deepEqual(context, {
      kind: "post",
      business: {
        name: "Empresa",
        services: ["Serviço A"],
        localities: ["Campinas"],
        tone_of_voice: "Acolhedor",
      },
      theme: "Tema",
      objective: "Objetivo",
      cta: "Fale conosco",
    });
    assert.ok(!JSON.stringify(context).includes("token"));
    assert.ok(!JSON.stringify(context).includes("revenue"));
  });

  test("remove contato pessoal do texto autorizado da avaliação", () => {
    const context = buildLocalSeoAiContext("review_reply", {
      client: { name: "Empresa" },
      review: {
        rating: 5,
        review_text:
          "Gostei. Meu e-mail é pessoa@exemplo.com e telefone (11) 99999-8888",
        reviewer_name: "Nome privado",
        external_id: "interno",
      },
    });
    const serialized = JSON.stringify(context);
    assert.ok(serialized.includes("[email removido]"));
    assert.ok(serialized.includes("[telefone removido]"));
    assert.ok(!serialized.includes("Nome privado"));
    assert.ok(!serialized.includes("external_id"));
  });
});
