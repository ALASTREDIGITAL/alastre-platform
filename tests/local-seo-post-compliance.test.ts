import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateGbpPostContent,
  localSeoRequest,
  postTypes,
  ctaActions,
  socialChannels,
} from "../lib/local-seo-domain.ts";
import { getReviewSentiment } from "../lib/local-seo-types.ts";

describe("SEO Local GBP Post & Compliance Suite", () => {
  test("validador detecta número de telefone no corpo do texto para evitar rejeição no Google", () => {
    const withPhone = "Entre em contato conosco hoje mesmo pelo telefone (19) 98765-4321 e marque sua consulta!";
    const result = validateGbpPostContent(withPhone);
    assert.equal(result.warnings.length > 0, true);
    assert.ok(result.warnings.some((w) => w.includes("rejeita postagens com número de telefone")));

    const withoutPhone = "Venha conhecer nosso novo espaço odontológico no centro de Campinas e garanta um sorriso saudável.";
    const cleanResult = validateGbpPostContent(withoutPhone);
    assert.ok(!cleanResult.warnings.some((w) => w.includes("número de telefone")));
  });

  test("calcula a faixa ideal de tamanho de texto para o Google Maps (150 a 300 caracteres)", () => {
    const shortText = "Visite nosso site.";
    const shortResult = validateGbpPostContent(shortText);
    assert.equal(shortResult.idealLength, false);
    assert.ok(shortResult.warnings.some((w) => w.includes("curto")));

    const idealText = "Conheça os tratamentos preventivos mais modernos da nossa clínica em Campinas. Cuidar da saúde bucal é essencial para o bem-estar de toda a sua família o ano todo.";
    assert.ok(idealText.length >= 150 && idealText.length <= 300);
    const idealResult = validateGbpPostContent(idealText);
    assert.equal(idealResult.idealLength, true);
    assert.equal(idealResult.valid, true);

    const longText = "a".repeat(1550);
    const longResult = validateGbpPostContent(longText);
    assert.equal(longResult.valid, false);
    assert.ok(longResult.errors.length > 0);
  });

  test("valida payload de postagem do tipo OFERTA com cupom e datas", () => {
    const validOffer = {
      action: "local_seo_post_save",
      client_id: "00000000-0000-4000-8000-000000000000",
      payload: {
        theme: "Campanha de Primavera",
        objective: "Oferta",
        post_type: "offer",
        offer_title: "20% OFF na Primeira Limpeza",
        coupon_code: "PRIMAVERA20",
        offer_terms: "Válido até 31/10/2026",
        start_date: "2026-10-01",
        end_date: "2026-10-31",
        cta_action: "BOOK",
        cta_url: "https://clinica.com.br/agendar",
        channels: ["gbp", "instagram"],
        body: "Aproveite nossa condição especial para cuidar do seu sorriso nesta primavera!",
        related_keywords: ["limpeza dental campinas"],
        origin: "human",
      },
    };
    const parsed = localSeoRequest.safeParse(validOffer);
    assert.equal(parsed.success, true);
    if (parsed.success && parsed.data.action === "local_seo_post_save") {
      assert.equal(parsed.data.payload.post_type, "offer");
      assert.equal(parsed.data.payload.coupon_code, "PRIMAVERA20");
      assert.equal(parsed.data.payload.cta_action, "BOOK");
      assert.deepEqual(parsed.data.payload.channels, ["gbp", "instagram"]);
    }
  });

  test("valida payload de postagem do tipo EVENTO com título e CTA", () => {
    const validEvent = {
      action: "local_seo_post_save",
      client_id: "00000000-0000-4000-8000-000000000000",
      payload: {
        theme: "Inauguração da Nova Unidade",
        objective: "Institucional",
        post_type: "event",
        event_title: "Coquetel de Inauguração Taquaral",
        start_date: "2026-11-15",
        end_date: "2026-11-15",
        cta_action: "SIGN_UP",
        cta_url: "https://clinica.com.br/inauguracao",
        channels: ["gbp", "facebook"],
        body: "Convidamos você e sua família para conhecer nossa mais nova unidade com tecnologia de ponta.",
        related_keywords: [],
        origin: "agent",
      },
    };
    const parsed = localSeoRequest.safeParse(validEvent);
    assert.equal(parsed.success, true);
  });

  test("rejeita postagens com tipos ou CTAs inválidos", () => {
    const invalidCta = {
      action: "local_seo_post_save",
      client_id: "00000000-0000-4000-8000-000000000000",
      payload: {
        theme: "Teste",
        post_type: "invalido",
        body: "Texto de teste",
      },
    };
    assert.equal(localSeoRequest.safeParse(invalidCta).success, false);
  });

  test("classifica sentimentos de avaliações com base na nota de estrelas", () => {
    assert.equal(getReviewSentiment(5), "positive");
    assert.equal(getReviewSentiment(4), "positive");
    assert.equal(getReviewSentiment(3), "neutral");
    assert.equal(getReviewSentiment(2), "critical");
    assert.equal(getReviewSentiment(1), "critical");
  });

  test("expõe constantes padronizadas do Google Business Profile", () => {
    assert.deepEqual(postTypes, ["standard", "offer", "event"]);
    assert.ok(ctaActions.includes("LEARN_MORE"));
    assert.ok(ctaActions.includes("CALL"));
    assert.ok(ctaActions.includes("BOOK"));
    assert.deepEqual(socialChannels, ["gbp", "instagram", "facebook"]);
  });
});
