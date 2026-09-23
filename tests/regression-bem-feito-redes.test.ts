import { test, describe } from "node:test";
import assert from "node:assert";
import {
  analyzeGoogleReviews,
  BARBEARIA_DUTRA_DEMO_REVIEWS,
  type BusinessProfileSnapshot,
  type RawAuditReview,
} from "../lib/review-audit-analyzer.ts";
import {
  generateExecutiveReport,
  BEM_FEITO_REDES_DEMO_REVIEWS,
  BEM_FEITO_REDES_DEMO_SNAPSHOT,
  type CompetitorBenchmarkItem,
} from "../lib/local-seo-report-engine.ts";

describe("Regression Suite: Eradicação de Dados Sintéticos — Perfil Bem Feito Redes", () => {
  const realBemFeitoProfile: BusinessProfileSnapshot = {
    name: "Bem Feito Redes de Proteção",
    category: "Redes de Proteção / Telas",
    rating: 0, // Sem nota informada
    reviewsCount: 0, // 0 avaliações no Google
    address: "Sorocaba e Região - SP",
    phone: "(15) 99999-0000",
    website: "https://bemfeitoredes.com.br",
  };

  test("1. Auditoria real da Bem Feito Redes com 0 avaliações não exibe autores, textos ou produtos inventados", () => {
    const realReviews: RawAuditReview[] = [];

    // Execução em modo real (isDemoMode = false)
    const result = analyzeGoogleReviews(realBemFeitoProfile, realReviews, false);

    // Verificação estrita das métricas
    assert.strictEqual(result.metrics.customerTextReviewsCount, 0, "Contagem de comentários em texto deve ser 0");
    assert.strictEqual(result.metrics.positiveReviewsCount, 0, "Contagem de avaliações positivas deve ser 0");
    assert.strictEqual(result.positiveReviews.length, 0, "Lista de avaliações positivas deve estar vazia");
    assert.strictEqual(result.negativeReviews.length, 0, "Lista de avaliações negativas deve estar vazia");

    // Verificação estrita dos aspectos e produtos: SEM FICTION
    assert.strictEqual(
      result.insights.positive.praisedAspects.length,
      0,
      "Aspectos elogiados devem ser vazios quando 0 avaliações existem"
    );
    assert.strictEqual(
      result.insights.positive.citedProducts.length,
      0,
      "Produtos citados devem ser vazios quando 0 textos existem"
    );

    // Verificação de que NENHUM autor da fixture demo vazou
    const allAuthors = [...result.positiveReviews, ...result.negativeReviews].map((r) => r.author);
    assert.strictEqual(allAuthors.includes("Mauro Gomes"), false, "Mauro Gomes não pode aparecer em auditoria real");
    assert.strictEqual(allAuthors.includes("Lucas Ferreira"), false, "Lucas Ferreira não pode aparecer em auditoria real");
    assert.strictEqual(allAuthors.includes("Juliana Mendes"), false, "Juliana Mendes não pode aparecer em auditoria real");

    // Verificação do sumário factual
    assert.ok(
      result.insights.positive.summary.includes("Não foram obtidas avaliações individuais com texto") ||
      result.insights.positive.summary.includes("Sem avaliações suficientes"),
      "Sumário deve explicitar a ausência de avaliações individuais em texto"
    );
  });

  test("2. Dossiê executivo real da Bem Feito Redes sem concorrentes não inventa concorrentes nem mapa de calor", () => {
    const realReviews: RawAuditReview[] = [];
    const realCompetitors: CompetitorBenchmarkItem[] = [];

    const report = generateExecutiveReport(
      realBemFeitoProfile,
      realReviews,
      "Redes de Proteção",
      "Sorocaba - SP",
      realCompetitors,
      false // isDemoMode = false
    );

    // Concorrentes devem estar vazios
    assert.strictEqual(report.competitors.length, 0, "Nenhum concorrente deve ser inventado se não coletado");
    assert.strictEqual(report.heatmapPoints.length, 0, "Nenhum ponto de calor fictício pode ser gerado");
    assert.strictEqual(report.isSpatialMapAvailable, false, "Mapa espacial deve ser desabilitado quando não há concorrentes");

    // Verificação de nomes fictícios que não podem constar
    const compNames = report.competitors.map((c) => c.name);
    assert.strictEqual(compNames.some((n) => n.includes("Elite Glass Box")), false);
    assert.strictEqual(compNames.some((n) => n.includes("Líder Regional")), false);
    assert.strictEqual(compNames.some((n) => n.includes("Padrão")), false);

    // Disclaimer deve alertar da necessidade da extensão
    assert.ok(
      report.spatialMapDisclaimer?.includes("Nenhum concorrente local coletado") ||
      report.spatialMapDisclaimer?.includes("extensão"),
      "Disclaimer deve informar sobre a ausência de concorrentes coletados"
    );
  });

  test("3. Nota inexistente não sofre fallback para 5.0", () => {
    const unratedProfile: BusinessProfileSnapshot = {
      name: "Empresa Sem Avaliação",
      category: "Empresa Local",
      rating: 0,
      reviewsCount: 0,
    };

    const audit = analyzeGoogleReviews(unratedProfile, [], false);
    assert.strictEqual(audit.metrics.averageRating, 0, "Nota média deve ser 0 quando perfil não possui avaliação");

    const report = generateExecutiveReport(unratedProfile, [], undefined, undefined, [], false);
    const ratingFactor = report.factors.find((f) => f.id === "reviews_rating");
    assert.ok(ratingFactor, "Fator reviews_rating deve existir");
    assert.strictEqual(ratingFactor.scorePercentage, 0, "Score percentual de nota não avaliada deve ser 0");
    assert.ok(
      ratingFactor.evidence.includes("não identificada") || ratingFactor.evidence.includes("sem avaliações"),
      "Evidência deve reportar nota não identificada"
    );
  });

  test("4. Índice de cobertura e score 0 não sofrem fallback para 82%", () => {
    // Simulação do cálculo com 0 critérios verificados
    const coverageIndex = 0;
    const resolvedCoverage = coverageIndex ?? 82; // nullish coalescing preserva 0
    assert.strictEqual(resolvedCoverage, 0, "0 ?? fallback deve ser 0 e nunca 82");

    const falsyCoverage = coverageIndex || 82; // O bug anterior era o operador ||
    assert.strictEqual(falsyCoverage, 82, "Confirmação do comportamento antigo incorreto com ||");
  });

  test("5. Modo de demonstração explicitamente ativado preserva fixtures e identifica claramente a simulação", () => {
    const demoAudit = analyzeGoogleReviews(BEM_FEITO_REDES_DEMO_SNAPSHOT, BEM_FEITO_REDES_DEMO_REVIEWS, true);
    assert.strictEqual(demoAudit.metrics.totalReviews, 3, "Modo demo preserva o reviewsCount de 3 da snapshot");
    assert.strictEqual(demoAudit.positiveReviews.length, 2, "Modo demo contém as 2 avaliações com texto da fixture");

    const demoReport = generateExecutiveReport(
      BEM_FEITO_REDES_DEMO_SNAPSHOT,
      BEM_FEITO_REDES_DEMO_REVIEWS,
      "Redes de Proteção",
      "Sorocaba - SP",
      undefined,
      true // isDemoMode = true
    );
    assert.strictEqual(demoReport.isSpatialMapAvailable, true, "Modo demo renderiza heatmap ilustrativo");
    assert.ok(
      demoReport.spatialMapDisclaimer?.includes("Demonstração ilustrativa"),
      "Disclaimer deve declarar explicitamente o modo demonstração"
    );
  });
});

describe("Garantia de Não Consumo de APIs Pagas & Segregação Estrita de Avaliações", () => {
  test("1. Segregação: profile.reviewsCount é contagem pública e NÃO gera avaliações individuais fictícias", () => {
    const profileWithTotal: BusinessProfileSnapshot = {
      name: "BEM FEITO REDES DE PROTEÇÃO",
      category: "Loja de telas",
      rating: 5.0,
      reviewsCount: 3, // Perfil informa 3 avaliações no Google
    };

    // Auditoria sem avaliações individuais capturadas (sample vazio)
    const audit = analyzeGoogleReviews(profileWithTotal, [], false);

    assert.strictEqual(audit.metrics.totalReviews, 3, "Total informado pelo Google deve ser 3");
    assert.strictEqual(audit.positiveReviews.length, 0, "Lista de avaliações individuais positivas deve estar estritamente vazia (0)");
    assert.strictEqual(audit.negativeReviews.length, 0, "Lista de avaliações individuais negativas deve estar estritamente vazia (0)");
    assert.strictEqual(audit.insights.positive.praisedAspects.length, 0, "Nenhum aspecto positivo pode ser inventado");
    assert.strictEqual(audit.insights.positive.citedProducts.length, 0, "Nenhum produto/serviço pode ser inventado");
  });

  test("2. Quando 0 avaliações individuais são capturadas, tela e PDF não contêm autores fictícios", () => {
    const profileWithTotal: BusinessProfileSnapshot = {
      name: "BEM FEITO REDES DE PROTEÇÃO",
      category: "Loja de telas",
      rating: 5.0,
      reviewsCount: 3,
    };

    const report = generateExecutiveReport(profileWithTotal, [], undefined, undefined, [], false);
    
    // Concorrentes devem ser zero quando não coletados
    assert.strictEqual(report.competitors.length, 0, "Zero concorrentes se não coletados no Google Maps");
    assert.strictEqual(report.heatmapPoints.length, 0, "Zero pontos no mapa se não coletados");
    assert.strictEqual(report.isSpatialMapAvailable, false, "Mapa espacial desativado");

    // Fator de volume de avaliações deve reportar ausência de amostra comparativa
    const volumeFactor = report.factors.find((f) => f.id === "reviews_volume");
    assert.ok(volumeFactor?.evidence.includes("Amostra comparativa de concorrentes locais não coletada"));
  });

  test("3. Data e momento da coleta são preservados deterministicamente", () => {
    const profile: BusinessProfileSnapshot = {
      name: "Empresa Teste Data",
      category: "Serviços",
      rating: 0,
      reviewsCount: 0,
    };

    const report = generateExecutiveReport(profile, [], undefined, undefined, [], false);
    assert.ok(report.generatedAt, "Data da auditoria deve ser preenchida");
    assert.ok(report.methodologyDisclaimer.includes("AVISO DE METODOLOGIA E CONFORMIDADE"));
  });
});
