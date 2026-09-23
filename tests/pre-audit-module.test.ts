import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateExecutiveReport,
  BEM_FEITO_REDES_DEMO_SNAPSHOT,
  BEM_FEITO_REDES_DEMO_REVIEWS,
  LAVANDERIA_SWISS_DEMO_SNAPSHOT,
  LAVANDERIA_SWISS_DEMO_REVIEWS,
} from "../lib/local-seo-report-engine.ts";
import {
  BARBEARIA_DUTRA_DEMO_SNAPSHOT,
  BARBEARIA_DUTRA_DEMO_REVIEWS,
} from "../lib/review-audit-analyzer.ts";
import {
  CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT,
  CASSIUS_PORTO_FELIZ_DEMO_REVIEWS,
  CASSIUS_PORTO_FELIZ_REAL_COMPETITORS,
} from "../lib/local-seo-report-engine.ts";

describe("PreAuditModule & Prospect Isolation Suite", () => {
  test("valida fixture oficial da Lavanderia Swiss para pré-análise", () => {
    assert.equal(LAVANDERIA_SWISS_DEMO_SNAPSHOT.name, "LAVANDERIA SWISS");
    assert.equal(LAVANDERIA_SWISS_DEMO_SNAPSHOT.category, "Lavanderia");
    assert.equal(LAVANDERIA_SWISS_DEMO_SNAPSHOT.rating, 5.0);
    assert.equal(LAVANDERIA_SWISS_DEMO_SNAPSHOT.reviewsCount, 3);
    assert.ok(LAVANDERIA_SWISS_DEMO_REVIEWS.length >= 3);
    assert.ok(LAVANDERIA_SWISS_DEMO_REVIEWS.every((r) => r.rating === 5));
  });

  test("gera relatório de pré-análise da Lavanderia Swiss sem contaminação", () => {
    const report = generateExecutiveReport(
      LAVANDERIA_SWISS_DEMO_SNAPSHOT,
      LAVANDERIA_SWISS_DEMO_REVIEWS,
      "Lavanderia",
      "Santo André - SP",
      undefined,
      true
    );

    // Categoria e concorrentes devem ser 100% de lavanderia
    assert.equal(report.keyword, "Lavanderia");
    assert.ok(report.competitors.length >= 5);
    const topComp = report.competitors[0];
    assert.ok(
      topComp.name.includes("5àsec") ||
      topComp.name.includes("Prima Clean") ||
      topComp.name.includes("Lavanderia")
    );

    // Garante que não há menção a redes, vidro ou barbearia
    const allCompNames = report.competitors.map((c) => c.name).join(" ");
    assert.ok(!allCompNames.includes("Luca Redes"));
    assert.ok(!allCompNames.includes("Cristal Glass"));
    assert.ok(!allCompNames.includes("Barbearia Dutra"));
  });

  test("assegura independência total entre presets de pré-análise", () => {
    const presets = [
      { snap: LAVANDERIA_SWISS_DEMO_SNAPSHOT, revs: LAVANDERIA_SWISS_DEMO_REVIEWS, expectedCat: "Lavanderia" },
      { snap: BEM_FEITO_REDES_DEMO_SNAPSHOT, revs: BEM_FEITO_REDES_DEMO_REVIEWS, expectedCat: "Loja de telas" },
      { snap: BARBEARIA_DUTRA_DEMO_SNAPSHOT, revs: BARBEARIA_DUTRA_DEMO_REVIEWS, expectedCat: "Barbearia" },
    ];

    for (const p of presets) {
      const report = generateExecutiveReport(p.snap, p.revs, undefined, undefined, undefined, true);
      assert.ok(report.overallScore > 0);
      assert.equal(report.profile.name, p.snap.name);
      assert.ok(report.factors.length >= 15);
    }
  });

  test("processa concorrentes 100% reais de Porto Feliz para Cassius Restaurante", () => {
    assert.equal(CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT.name, "Cassiu's Restaurante e Churrascaria");
    assert.equal(CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT.rating, 4.3);
    assert.equal(CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT.reviewsCount, 213);
    assert.ok(CASSIUS_PORTO_FELIZ_REAL_COMPETITORS.length >= 10);

    const report = generateExecutiveReport(
      CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT,
      CASSIUS_PORTO_FELIZ_DEMO_REVIEWS,
      "Restaurante e Churrascaria",
      "Porto Feliz - SP",
      CASSIUS_PORTO_FELIZ_REAL_COMPETITORS
    );

    // Deve ativar o sinalizador de dados reais do Google Maps
    assert.equal(report.isRealGoogleMapsData, true);

    // O líder de mercado real de Porto Feliz deve ser Parmegianas Ray com 456 avaliações
    assert.equal(report.topCompetitorReviews, 456);
    assert.equal(report.competitors[0].name, "Parmegianas Ray");
    assert.equal(report.competitors[0].reviewsCount, 456);
    assert.equal(report.competitors[0].rating, 4.5);

    // Segundo lugar real deve ser Cassiu's com 213 avaliações
    const cassiusComp = report.competitors.find((c) => c.isCurrentClient);
    assert.ok(cassiusComp);
    assert.equal(cassiusComp.name, "Cassiu's Restaurante e Churrascaria");
    assert.equal(cassiusComp.reviewsCount, 213);

    // Concorrentes reais da cidade devem estar presentes
    const compNames = report.competitors.map((c) => c.name).join(" ");
    assert.ok(compNames.includes("VILLA PORTO RESTAURANTE"));
    assert.ok(compNames.includes("Bonfá Restaurante"));
    assert.ok(compNames.includes("Du Levain Cozinha Artesanal"));
    assert.ok(compNames.includes("La Curva Gastronomia"));

    // NENHUM concorrente genérico simulado deve ser gerado
    assert.ok(!compNames.includes("Restaurante Líder Regional"));
    assert.ok(!compNames.includes("Restaurante Central Líder"));

    // Pontos do mapa de calor devem ter coordenadas reais de Porto Feliz (~ -23.21, ~ -47.52)
    assert.ok(report.heatmapPoints.length >= 8);
    const clientPoint = report.heatmapPoints.find((p) => p.isClient);
    assert.ok(clientPoint);
    assert.ok(clientPoint.lat < -23.1 && clientPoint.lat > -23.3);
    assert.ok(clientPoint.lng < -47.4 && clientPoint.lng > -47.6);
  });
});
