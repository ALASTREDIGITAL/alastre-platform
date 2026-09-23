import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProspectingSupervisor } from "../scripts/poc/prospecting-supervisor.ts";

describe("Prospecting Scraper Parser & Rating Fidelity (Condições 5 e 6)", () => {
  const supervisor = new ProspectingSupervisor();

  it("correctly extracts review_rating into rating and review_count without synthetic coerction", () => {
    const rawJson = JSON.stringify([
      {
        title: "Vidraçaria Sorocaba - Vidro e Arte",
        category: "Vidraçaria",
        address: "Av. Ipanema, 5399",
        phone: "(15) 98811-0406",
        web_site: null,
        review_rating: 4.8,
        review_count: 128,
        cid: "18377103091494196184",
        place_id: "ChIJr5UM_AD1xZQR2JM-SeWVCP8",
        link: "https://www.google.com/maps/place/Vidra%C3%A7aria+Sorocaba",
      },
      {
        title: "Vidraçaria Sem Avaliações",
        category: "Vidraçaria",
        address: "Rua Nova, 100",
        phone: "(15) 3333-1111",
        web_site: "https://vidracarianova.com.br",
        review_rating: 0,
        review_count: 0,
        cid: "2222222222222222",
        place_id: "ChIJ222222222",
        link: "https://www.google.com/maps/place/Nova",
      },
      {
        title: "Vidraçaria Avaliação Desconhecida",
        category: "Vidraçaria",
        address: "Rua Sem Dados, 200",
        phone: "(15) 3333-2222",
        web_site: null,
        review_rating: null,
        review_count: null,
        cid: "3333333333333333",
        place_id: "ChIJ333333333",
        link: "https://www.google.com/maps/place/SemDados",
      },
    ]);

    const parsed = supervisor.parseRawScraperJson(rawJson, 10);
    assert.equal(parsed.length, 3);

    // 1. Empresa com notas legítimas
    assert.equal(parsed[0].name, "Vidraçaria Sorocaba - Vidro e Arte");
    assert.equal(parsed[0].rating, 4.8);
    assert.equal(parsed[0].review_count, 128);

    // 2. Empresa com zero avaliações (review_rating 0 mapeia para null pois não há nota média calculada)
    assert.equal(parsed[1].name, "Vidraçaria Sem Avaliações");
    assert.equal(parsed[1].rating, null);
    assert.equal(parsed[1].review_count, 0);

    // 3. Empresa com campos nulos (sem nota e sem contagem conhecida)
    assert.equal(parsed[2].name, "Vidraçaria Avaliação Desconhecida");
    assert.equal(parsed[2].rating, null);
    assert.equal(parsed[2].review_count, null, "Contagem desconhecida deve permanecer estritamente null, sem coerção para zero");
  });

  it("handles string rating with comma and rejects invalid rating strings", () => {
    const rawJson = JSON.stringify([
      {
        title: "Vidraçaria Nota Com Vírgula",
        review_rating: "4,9",
        review_count: "50",
        cid: "4444444444",
        link: "https://maps.google.com/?cid=4444444444",
      },
      {
        title: "Vidraçaria Nota Inválida Fora da Escala",
        review_rating: "9.9", // fora de 1..5
        review_count: "20",
        cid: "5555555555",
        link: "https://maps.google.com/?cid=5555555555",
      },
      {
        title: "Vidraçaria Nota Texto Corrompido",
        review_rating: "nota_boa",
        review_count: "invalido",
        cid: "6666666666",
        link: "https://maps.google.com/?cid=6666666666",
      },
    ]);

    const parsed = supervisor.parseRawScraperJson(rawJson, 10);
    assert.equal(parsed.length, 3);

    // 4,9 -> 4.9
    assert.equal(parsed[0].rating, 4.9);
    assert.equal(parsed[0].review_count, 50);

    // 9.9 -> rejeitado como null (fora de 1..5)
    assert.equal(parsed[1].rating, null, "Nota acima de 5.0 deve ser rejeitada como inválida");
    assert.equal(parsed[1].review_count, 20);

    // Texto corrompido -> null em ambos
    assert.equal(parsed[2].rating, null);
    assert.equal(parsed[2].review_count, null, "String inválida de contagem não pode ser convertida para número inventado");
  });

  it("supports NDJSON (JSON Lines) format correctly", () => {
    const ndjson = [
      JSON.stringify({ title: "Empresa Linha 1", cid: "101", review_rating: 4.5, review_count: 10 }),
      JSON.stringify({ title: "Empresa Linha 2", cid: "102", review_rating: 5.0, review_count: 3 }),
    ].join("\n");

    const parsed = supervisor.parseRawScraperJson(ndjson, 10);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].rating, 4.5);
    assert.equal(parsed[1].rating, 5.0);
  });

  it("proves factual mapping of raw-scraper-results.json without executing new scraping", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const rawPath = path.resolve(process.cwd(), "scripts", "poc", "output", "raw-scraper-results.json");
    const rawContent = await fs.readFile(rawPath, "utf8");

    const parsed = supervisor.parseRawScraperJson(rawContent, 10);
    assert.equal(parsed.length, 10, "Deve parsear exatamente as 10 empresas coletadas");

    // Validação da Ficha 1
    assert.ok(parsed[0].name.length > 0);
    assert.ok(parsed[0].category !== undefined);
    assert.ok(parsed[0].review_count !== undefined);
    assert.ok(parsed[0].phone !== undefined);
    assert.ok(parsed[0].cid !== undefined);

    // Validação geral: nenhum rating sintético ou inventado
    for (const item of parsed) {
      assert.ok(item.name.length > 0, "Todo item deve ter nome factual");
      assert.ok(item.maps_url && item.maps_url.startsWith("https://www.google.com/maps"), "URL do Maps deve ser válida");
      if (item.rating !== null) {
        assert.ok(typeof item.rating === "number" && item.rating >= 1 && item.rating <= 5, "Rating deve ser numérico válido entre 1 e 5");
      }
    }
  });
});

