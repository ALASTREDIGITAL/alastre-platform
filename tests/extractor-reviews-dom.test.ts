import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  analyzeGoogleReviews,
  type BusinessProfileSnapshot,
  type RawAuditReview,
} from "../lib/review-audit-analyzer.ts";

const require = createRequire(import.meta.url);
require("../extensions/alastre-local-inspector/scripts/extractor.js");
const AlastreExtractor = (globalThis as any).AlastreExtractor;

// Mock DOM element com suporte a seletores da Busca do Google e Google Maps
interface MockElementConfig {
  tag?: string;
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: MockElementConfig[];
}

function createMockNode(config: MockElementConfig, parent: any = null): any {
  const attrs: Record<string, string> = { ...(config.attributes || {}) };
  if (config.className) attrs["class"] = config.className;

  const node: any = {
    parent,
    tagName: (config.tag || "div").toUpperCase(),
    getAttribute(name: string) {
      return attrs[name] || null;
    },
    closest(selector: string) {
      let cur: any = this;
      while (cur) {
        if (selector === "[data-kgmid], [data-mid]" && (cur.getAttribute("data-kgmid") || cur.getAttribute("data-mid"))) {
          return cur;
        }
        if (selector === ".review-dialog-list" && cur.getAttribute("class")?.includes("review-dialog-list")) {
          return cur;
        }
        cur = cur.parent;
      }
      return null;
    },
    querySelector(selector: string) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector: string) {
      const results: any[] = [];
      const traverse = (n: any) => {
        const classes = (n.getAttribute("class") || "").split(/\s+/).filter(Boolean);
        const tag = n.tagName;
        let matched = false;

        if (selector === ".review-dialog-list" && classes.includes("review-dialog-list")) matched = true;
        if (selector === 'div[data-async-context*="review"]' && n.getAttribute("data-async-context")?.includes("review")) matched = true;
        if (selector === 'div[data-attrid="kc:/local:place_user_reviews"]' && n.getAttribute("data-attrid") === "kc:/local:place_user_reviews") matched = true;
        if (selector === "div.lcorif" && classes.includes("lcorif")) matched = true;
        if (selector === "div.WMbnJf" && classes.includes("WMbnJf")) matched = true;
        if (selector === "div.jD1thc" && classes.includes("jD1thc")) matched = true;
        if (selector === 'div.m6QErb[aria-label*="Avaliações" i]' && classes.includes("m6QErb") && /avaliaç/i.test(n.getAttribute("aria-label") || "")) matched = true;
        if (selector === 'div.m6QErb[aria-label*="Reviews" i]' && classes.includes("m6QErb") && /reviews/i.test(n.getAttribute("aria-label") || "")) matched = true;
        if (selector === "div.m6QErb.DxyBCb" && classes.includes("m6QErb") && classes.includes("DxyBCb")) matched = true;
        if (selector === 'div[role="region"][aria-label*="Avaliações" i]' && n.getAttribute("role") === "region" && /avaliaç/i.test(n.getAttribute("aria-label") || "")) matched = true;

        if (selector === ".gws-localreviews__google-review" && classes.includes("gws-localreviews__google-review")) matched = true;
        if (selector === "div.jftiEf[data-review-id]" && classes.includes("jftiEf") && Boolean(n.getAttribute("data-review-id"))) matched = true;
        if (selector === "div.jftiEf" && classes.includes("jftiEf")) matched = true;
        if (selector === "div[data-review-id]" && Boolean(n.getAttribute("data-review-id"))) matched = true;

        // Subseletores internos
        if (selector.includes(".TSUbDb") && (classes.includes("TSUbDb") || tag === "A" && n.parent?.getAttribute("class")?.includes("TSUbDb"))) matched = true;
        if (selector.includes(".d4r55") && classes.includes("d4r55")) matched = true;
        if (selector.includes(".YEtELc") && classes.includes("YEtELc")) matched = true;
        if (selector.includes(".lTi8oc") && classes.includes("lTi8oc")) matched = true;
        if (selector.includes(".kvMYJc") && classes.includes("kvMYJc")) matched = true;
        if (selector.includes("g-review-stars span") && tag === "SPAN" && n.parent?.tagName === "G-REVIEW-STARS") matched = true;
        if (selector.includes(".dehysf") && classes.includes("dehysf")) matched = true;
        if (selector.includes(".rsqaWe") && classes.includes("rsqaWe")) matched = true;
        if (selector.includes(".x8aTrd") && classes.includes("x8aTrd")) matched = true;
        if (selector.includes(".A5Fugc") && classes.includes("A5Fugc")) matched = true;
        if (selector.includes(".RfDO5c") && classes.includes("RfDO5c")) matched = true;
        if (selector.includes(".badge") && classes.includes("badge")) matched = true;
        if (selector.includes("span[data-expandable-section]") && tag === "SPAN" && n.getAttribute("data-expandable-section") !== null) matched = true;
        if (selector.includes(".review-snippet") && classes.includes("review-snippet")) matched = true;
        if (selector.includes("span.review-full-text") && tag === "SPAN" && classes.includes("review-full-text")) matched = true;
        if (selector.includes(".Jtu6Td span") && tag === "SPAN" && n.parent?.getAttribute("class")?.includes("Jtu6Td")) matched = true;
        if (selector.includes("span.wiI7m") && tag === "SPAN" && classes.includes("wiI7m")) matched = true;
        if (selector.includes(".MyEned span") && tag === "SPAN" && n.parent?.getAttribute("class")?.includes("MyEned")) matched = true;
        if (selector.includes(".loris") && classes.includes("loris")) matched = true;
        if (selector.includes("div[data-owner-reply]") && tag === "DIV" && n.getAttribute("data-owner-reply") !== null) matched = true;
        if (selector.includes(".CDe7pd") && classes.includes("CDe7pd")) matched = true;
        if (selector.includes(".k8MTId") && classes.includes("k8MTId")) matched = true;

        if (matched) results.push(n);

        if (n.children) {
          for (const c of n.children) traverse(c);
        }
      };

      if (this.children) {
        for (const child of this.children) traverse(child);
      }
      return results;
    }
  };

  const children: any[] = (config.children || []).map((c) => createMockNode(c, node));
  node.children = children;
  node.textContent = config.textContent !== undefined ? config.textContent : children.map((c) => c.textContent).join(" ");

  return node;
}

describe("Extractor DOM Reviews Suite — Extração Fidedigna de Avaliações Reais", () => {
  it("1. Extrai fidedignamente as 3 avaliações da ficha Bem Feito Redes (kgmid=/g/11zxbcsj1x) na Busca Google", () => {
    // Painel real de avaliações da Pesquisa Google da Bem Feito Redes
    const mockDoc = createMockNode({
      tag: "div",
      children: [
        {
          tag: "div",
          className: "review-dialog-list",
          attributes: { "data-kgmid": "/g/11zxbcsj1x" },
          children: [
            // Cartão 1: Rogerio Garcia com comentário e resposta do proprietário
            {
              tag: "div",
              className: "gws-localreviews__google-review",
              attributes: { "data-review-id": "rev-bemfeito-1" },
              children: [
                {
                  tag: "div",
                  className: "TSUbDb",
                  children: [{ tag: "a", textContent: "Rogerio Garcia" }]
                },
                {
                  tag: "div",
                  className: "A5Fugc",
                  textContent: "Local Guide · 12 avaliações"
                },
                {
                  tag: "span",
                  className: "lTi8oc",
                  attributes: { "aria-label": "Classificado com 5,0 de 5 estrelas" }
                },
                {
                  tag: "span",
                  className: "dehysf",
                  textContent: "uma semana atrás"
                },
                {
                  tag: "div",
                  className: "Jtu6Td",
                  children: [
                    {
                      tag: "span",
                      textContent: "Excelente atendimento e instalação rápida das telas de proteção. Mais"
                    }
                  ]
                },
                {
                  tag: "div",
                  className: "loris",
                  attributes: { "data-owner-reply": "true" },
                  children: [
                    {
                      tag: "div",
                      className: "wiI7m",
                      textContent: "Resposta do proprietário: Obrigado pela confiança Rogerio!"
                    }
                  ]
                }
              ]
            },
            // Cartão 2: Giselle Santos (apenas estrelas, sem texto)
            {
              tag: "div",
              className: "gws-localreviews__google-review",
              attributes: { "data-review-id": "rev-bemfeito-2" },
              children: [
                {
                  tag: "div",
                  className: "TSUbDb",
                  children: [{ tag: "a", textContent: "Giselle Santos" }]
                },
                {
                  tag: "span",
                  className: "lTi8oc",
                  attributes: { "aria-label": "5 estrelas" }
                },
                {
                  tag: "span",
                  className: "dehysf",
                  textContent: "há 2 meses"
                }
                // Sem texto de comentário
              ]
            },
            // Cartão 3: Marcos Silva com texto
            {
              tag: "div",
              className: "gws-localreviews__google-review",
              attributes: { "data-review-id": "rev-bemfeito-3" },
              children: [
                {
                  tag: "div",
                  className: "TSUbDb",
                  children: [{ tag: "a", textContent: "Marcos Silva" }]
                },
                {
                  tag: "span",
                  className: "lTi8oc",
                  attributes: { "aria-label": "Classificado com 5,0 de 5 estrelas" }
                },
                {
                  tag: "span",
                  className: "dehysf",
                  textContent: "há 3 meses"
                },
                {
                  tag: "div",
                  className: "Jtu6Td",
                  children: [
                    {
                      tag: "span",
                      textContent: "Serviço perfeito, recomendo muito."
                    }
                  ]
                }
              ]
            },
            // Cartão duplicado (deve ser desduplicado)
            {
              tag: "div",
              className: "gws-localreviews__google-review",
              attributes: { "data-review-id": "rev-bemfeito-1" },
              children: [
                {
                  tag: "div",
                  className: "TSUbDb",
                  children: [{ tag: "a", textContent: "Rogerio Garcia" }]
                },
                {
                  tag: "span",
                  className: "lTi8oc",
                  attributes: { "aria-label": "Classificado com 5,0 de 5 estrelas" }
                },
                {
                  tag: "span",
                  className: "dehysf",
                  textContent: "uma semana atrás"
                },
                {
                  tag: "div",
                  className: "Jtu6Td",
                  children: [{ tag: "span", textContent: "Excelente atendimento e instalação rápida das telas de proteção." }]
                }
              ]
            }
          ]
        },
        // Cartão ambíguo pertencente a outro kgmid na mesma página (deve ser descartado)
        {
          tag: "div",
          className: "other-widget",
          attributes: { "data-kgmid": "/g/outro_negocio_diferente" },
          children: [
            {
              tag: "div",
              className: "gws-localreviews__google-review",
              attributes: { "data-review-id": "rev-alien-1" },
              children: [
                {
                  tag: "div",
                  className: "TSUbDb",
                  children: [{ tag: "a", textContent: "Outro Cliente" }]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = AlastreExtractor.extractReviewsData(mockDoc, {
      kgmid: "/g/11zxbcsj1x",
      name: "Bem Feito Redes / Telas de Proteção"
    });

    assert.strictEqual(result.status, "captured", "Status deve ser 'captured'");
    assert.strictEqual(result.capturedCount, 3, "Devem ser capturadas exatamente 3 avaliações");
    assert.strictEqual(result.reviews.length, 3, "Lista de avaliações deve ter tamanho 3");
    assert.strictEqual(result.discardedCount, 1, "Deve ter descartado 1 cartão pertencente a outro kgmid");

    // Validação da avaliação 1
    const r1 = result.reviews[0];
    assert.strictEqual(r1.author, "Rogerio Garcia");
    assert.strictEqual(r1.isLocalGuide, true);
    assert.strictEqual(r1.rating, 5);
    assert.strictEqual(r1.relativeDate, "uma semana atrás");
    assert.strictEqual(r1.text, "Excelente atendimento e instalação rápida das telas de proteção.");
    assert.ok(r1.ownerReply, "Deve conter resposta do proprietário");
    assert.strictEqual(r1.ownerReply?.text, "Obrigado pela confiança Rogerio!");

    // Validação da avaliação 2 (apenas estrelas): NUNCA INVENTAR TEXTO
    const r2 = result.reviews[1];
    assert.strictEqual(r2.author, "Giselle Santos");
    assert.strictEqual(r2.rating, 5);
    assert.strictEqual(r2.text, "", "Avaliação apenas com estrelas DEVE ter text: '' (zero invenção)");

    // Validação da avaliação 3
    const r3 = result.reviews[2];
    assert.strictEqual(r3.author, "Marcos Silva");
    assert.strictEqual(r3.rating, 5);
    assert.strictEqual(r3.text, "Serviço perfeito, recomendo muito.");
  });

  it("2. Retorna panel_closed quando nenhum contêiner de avaliações estiver aberto", () => {
    const mockDoc = createMockNode({
      tag: "div",
      children: [{ tag: "span", textContent: "Página inicial sem painel de avaliações aberto" }]
    });

    const result = AlastreExtractor.extractReviewsData(mockDoc, {
      kgmid: "/g/11zxbcsj1x",
      name: "Bem Feito Redes"
    });

    assert.strictEqual(result.status, "panel_closed");
    assert.strictEqual(result.capturedCount, 0);
    assert.strictEqual(result.reviews.length, 0);
    assert.ok(result.message.includes("fechado"));
  });

  it("3. Retorna panel_empty quando contêiner existe mas 0 cartões estão presentes", () => {
    const mockDoc = createMockNode({
      tag: "div",
      children: [
        {
          tag: "div",
          className: "review-dialog-list",
          attributes: { "data-kgmid": "/g/11zxbcsj1x" },
          children: []
        }
      ]
    });

    const result = AlastreExtractor.extractReviewsData(mockDoc, {
      kgmid: "/g/11zxbcsj1x",
      name: "Bem Feito Redes"
    });

    assert.strictEqual(result.status, "panel_empty");
    assert.strictEqual(result.capturedCount, 0);
    assert.strictEqual(result.reviews.length, 0);
  });

  it("4. Separação tri-métrica na plataforma: totalReviews=3, capturedCount=3, uncollectedCount=0", () => {
    const profile: BusinessProfileSnapshot = {
      name: "Bem Feito Redes de Proteção",
      category: "Redes de Proteção / Telas",
      rating: 5.0,
      reviewsCount: 3, // Total público informado pelo Google
    };

    const capturedReviews: RawAuditReview[] = [
      { id: "1", author: "Rogerio Garcia", rating: 5, text: "Excelente atendimento" },
      { id: "2", author: "Giselle Santos", rating: 5, text: "" },
      { id: "3", author: "Marcos Silva", rating: 5, text: "Serviço perfeito" },
    ];

    const audit = analyzeGoogleReviews(profile, capturedReviews, false);

    assert.strictEqual(audit.metrics.totalReviews, 3, "Total público deve ser 3");
    assert.strictEqual(audit.metrics.capturedReviewsCount, 3, "Amostra capturada deve ser 3");
    assert.strictEqual(audit.metrics.uncollectedReviewsCount, 0, "Diferença deve ser 0");
    assert.strictEqual(audit.metrics.customerTextReviewsCount, 2, "Apenas 2 avaliações com texto");
  });

  it("5. Separação tri-métrica quando panel está fechado: totalReviews=3, capturedCount=0, uncollectedCount=3 (nunca 0 avaliações existentes)", () => {
    const profile: BusinessProfileSnapshot = {
      name: "Bem Feito Redes de Proteção",
      category: "Redes de Proteção / Telas",
      rating: 5.0,
      reviewsCount: 3, // Total público comprovado de 3 avaliações
    };

    const capturedReviews: RawAuditReview[] = []; // Painel fechado no momento da extração

    const audit = analyzeGoogleReviews(profile, capturedReviews, false);

    assert.strictEqual(audit.metrics.totalReviews, 3, "Total público permanece 3 (nunca vira 0)");
    assert.strictEqual(audit.metrics.capturedReviewsCount, 0, "Amostra capturada é 0");
    assert.strictEqual(audit.metrics.uncollectedReviewsCount, 3, "3 avaliações não incluídas na amostra");

    // Zero ficção: nenhum autor inventado vaza
    assert.strictEqual(audit.positiveReviews.length, 0);
    assert.strictEqual(audit.negativeReviews.length, 0);
    assert.strictEqual(audit.insights.positive.praisedAspects.length, 0);
    assert.strictEqual(audit.insights.positive.citedProducts.length, 0);
  });
});
