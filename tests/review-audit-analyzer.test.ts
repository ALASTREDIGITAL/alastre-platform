import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeGoogleReviews,
  extractFrequentWords,
  BARBEARIA_DUTRA_DEMO_SNAPSHOT,
  BARBEARIA_DUTRA_DEMO_REVIEWS,
  type RawAuditReview,
} from "../lib/review-audit-analyzer.ts";

describe("Review Audit Analyzer (GBPCheck Engine)", () => {
  test("calcula os 12 KPIs oficiais fielmente para a demonstração da Barbearia Dutra", () => {
    const result = analyzeGoogleReviews(BARBEARIA_DUTRA_DEMO_SNAPSHOT, BARBEARIA_DUTRA_DEMO_REVIEWS);

    // 1. Total e médias
    assert.equal(result.metrics.totalReviews, 178); // snapshot total
    assert.equal(result.metrics.averageRating, 5.0);
    assert.ok(result.metrics.averageCommentLength > 0);

    // 2. Respostas do dono
    assert.equal(result.metrics.ownerRepliesCount, 11);
    assert.equal(result.metrics.responseRatePercentage, 100.0);

    // 3. Comentários dos clientes
    assert.equal(result.metrics.customerTextReviewsCount, 11);
    assert.equal(result.metrics.withCommentsPercentage, 100.0);

    // 4. Local Guides
    assert.equal(result.metrics.localGuidesCount, 6);
    assert.ok(result.metrics.localGuidesPercentage > 50);

    // 5. Positivas vs Negativas (1 a 3 estrelas)
    assert.equal(result.metrics.positiveReviewsCount, 10);
    assert.equal(result.metrics.negativeReviewsCount, 1);
  });

  test("calcula distribuição de notas e donuts de proporção corretamente", () => {
    const customReviews: RawAuditReview[] = [
      { author: "Cliente 1", rating: 5, text: "Excelente", isLocalGuide: true, ownerReply: { text: "Obrigado" } },
      { author: "Cliente 2", rating: 5, text: "Muito bom", isLocalGuide: false },
      { author: "Cliente 3", rating: 4, text: "Bom serviço", isLocalGuide: false },
      { author: "Cliente 4", rating: 2, text: "Demorou", isLocalGuide: false },
    ];

    const result = analyzeGoogleReviews(
      { name: "Teste Local", category: "Serviço", rating: 4.0, reviewsCount: 4 },
      customReviews
    );

    // Distribuição de notas
    const star5 = result.ratingDistribution.find((d) => d.stars === 5);
    const star4 = result.ratingDistribution.find((d) => d.stars === 4);
    const star2 = result.ratingDistribution.find((d) => d.stars === 2);
    assert.equal(star5?.count, 2);
    assert.equal(star4?.count, 1);
    assert.equal(star2?.count, 1);

    // Donuts
    assert.equal(result.donuts.responses.find((d) => d.name === "Com Resposta")?.value, 1);
    assert.equal(result.donuts.responses.find((d) => d.name === "Sem Resposta")?.value, 3);
    assert.equal(result.donuts.localGuides.find((d) => d.name === "Local Guides")?.value, 1);
    assert.equal(result.donuts.localGuides.find((d) => d.name === "Usuários Normais")?.value, 3);
  });

  test("extrai palavras frequentes excluindo stop words em português", () => {
    const reviews: RawAuditReview[] = [
      { author: "A", rating: 5, text: "Atendimento excelente na barbearia, melhor corte e atendimento muito top!" },
      { author: "B", rating: 5, text: "O atendimento da barbearia foi excelente, recomendo a todos." }
    ];

    const words = extractFrequentWords(reviews);
    const wordNames = words.map((w) => w.word);

    // Deve conter palavras substantivas/adjetivos
    assert.ok(wordNames.includes("atendimento"));
    assert.ok(wordNames.includes("excelente"));
    assert.ok(wordNames.includes("barbearia"));

    // Não deve conter stopwords em português
    assert.ok(!wordNames.includes("o"));
    assert.ok(!wordNames.includes("da"));
    assert.ok(!wordNames.includes("na"));
    assert.ok(!wordNames.includes("foi"));
    assert.ok(!wordNames.includes("muito"));
  });

  test("gera salvaguarda em insights negativos quando há menos de 3 avaliações negativas", () => {
    const result = analyzeGoogleReviews(BARBEARIA_DUTRA_DEMO_SNAPSHOT, BARBEARIA_DUTRA_DEMO_REVIEWS);
    
    // Apenas 1 review negativa (< 3)
    assert.equal(result.insights.negative.hasEnoughData, false);
    assert.ok(result.insights.negative.dataMessage?.includes("Não existem informações negativas suficientes"));
    assert.ok(result.insights.positive.praisedAspects.length > 0);
    assert.ok(result.insights.positive.opportunities.length > 0);
  });
});
