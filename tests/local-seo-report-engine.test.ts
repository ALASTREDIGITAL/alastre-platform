import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateExecutiveReport,
  BEM_FEITO_REDES_DEMO_SNAPSHOT,
  BEM_FEITO_REDES_DEMO_REVIEWS,
} from "../lib/local-seo-report-engine.ts";

describe("Local SEO Executive Report Engine", () => {
  test("gera relatório fiel ao PDF da Bem Feito Redes de Proteção com categorização correta", () => {
    const report = generateExecutiveReport(
      BEM_FEITO_REDES_DEMO_SNAPSHOT,
      BEM_FEITO_REDES_DEMO_REVIEWS,
      "Loja de telas",
      "São Paulo / Diadema - SP"
    );

    // Score geral e métricas de saúde
    assert.ok(report.overallScore > 40 && report.overallScore < 85);
    assert.ok(report.healthCounts.bom > 0);
    assert.ok(report.healthCounts.fraco > 0);

    // Fatores críticos auditados (espelho do PDF)
    const postFactor = report.factors.find((f) => f.id === "recent_posts");
    assert.equal(postFactor?.status, "fraco");

    const reviewsVolumeFactor = report.factors.find((f) => f.id === "reviews_volume");
    assert.equal(reviewsVolumeFactor?.status, "fraco"); // Apenas 2 reviews vs 222 da média

    const phoneFactor = report.factors.find((f) => f.id === "phone_number");
    assert.equal(phoneFactor?.status, "bom"); // Telefone definido

    const websiteFactor = report.factors.find((f) => f.id === "website_link");
    assert.equal(websiteFactor?.status, "bom"); // Website definido
  });

  test("calcula benchmarking com concorrentes e pontos de calor geográficos", () => {
    const report = generateExecutiveReport(
      BEM_FEITO_REDES_DEMO_SNAPSHOT,
      BEM_FEITO_REDES_DEMO_REVIEWS,
      undefined,
      undefined,
      undefined,
      true
    );

    // Concorrentes mapeados
    assert.ok(report.competitors.length >= 10);
    const clientEntry = report.competitors.find((c) => c.isCurrentClient);
    assert.ok(clientEntry);
    assert.equal(clientEntry?.name, "Bem Feito Redes / Telas de Proteção (Sua Empresa)");

    // Mapa de calor com pontos
    assert.ok(report.heatmapPoints.length >= 5);
    const clientPoint = report.heatmapPoints.find((p) => p.isClient);
    assert.ok(clientPoint);

    // Zonas de raio
    assert.equal(report.visibilityZones.length, 3); // 1km, 3km, 5km
  });

  test("inclui plano de ação comercial de 4 semanas e aviso de conformidade jurídica", () => {
    const report = generateExecutiveReport(
      BEM_FEITO_REDES_DEMO_SNAPSHOT,
      BEM_FEITO_REDES_DEMO_REVIEWS
    );

    // Plano de 30 dias com 4 semanas
    assert.equal(report.actionPlan.length, 4);
    assert.ok(report.actionPlan[0].deliverables.length > 0);

    // Disclaimer de conformidade jurídica
    assert.ok(report.methodologyDisclaimer.includes("AVISO DE METODOLOGIA E CONFORMIDADE"));
    assert.ok(report.methodologyDisclaimer.includes("Não representa promessa ou garantia contratual"));
  });

  test("isola estritamente LAVANDERIA SWISS: categoria Lavanderia, concorrentes de lavanderia e sem contaminação", () => {
    const swissProfile = {
      name: "LAVANDERIA SWISS",
      rating: 5.0,
      reviewsCount: 3,
      address: "R. Suíça - Parque das Nações, Santo André - SP",
      phone: "(11) 98765-4321",
    };

    const report = generateExecutiveReport(swissProfile, [], undefined, undefined, undefined, true);

    // Categoria e palavra-chave inferida corretamente
    assert.equal(report.keyword, "Lavanderia");

    // Concorrentes devem ser de lavanderia (ex: 5àsec, Prima Clean), nunca telas de proteção ou vidraçaria
    const competitorNames = report.competitors.map((c) => c.name);
    assert.ok(competitorNames.some((n) => n.includes("5àsec") || n.includes("Prima Clean") || n.includes("Lava e Leva")));
    assert.ok(!competitorNames.some((n) => n.includes("Luca Redes") || n.includes("Telas Cupecê")));
    assert.ok(!competitorNames.some((n) => n.includes("Cristal Glass") || n.includes("Barbearia")));

    // Fator de volume
    const volumeFactor = report.factors.find((f) => f.id === "reviews_volume");
    assert.ok(volumeFactor);
    assert.ok(volumeFactor?.evidence.includes("3 avaliações públicas"));
  });

  test("isola Adonias Vidro e Alumínio: categoria Vidraçaria e concorrentes de vidro", () => {
    const adoniasProfile = {
      name: "Adonias Vidro e Alumínio",
      rating: 4.8,
      reviewsCount: 45,
      address: "Av. do Vidro, São Paulo - SP",
    };

    const report = generateExecutiveReport(adoniasProfile, [], undefined, undefined, undefined, true);

    assert.equal(report.keyword, "Vidraçaria");

    const competitorNames = report.competitors.map((c) => c.name);
    assert.ok(competitorNames.some((n) => n.includes("Cristal Glass") || n.includes("Box & Vidros") || n.includes("Central Alumínio")));
    assert.ok(!competitorNames.some((n) => n.includes("5àsec") || n.includes("Luca Redes")));
  });
});

