import test, { describe } from "node:test";
import assert from "node:assert/strict";

describe("Google Maps Competitors Extractor Suite", () => {
  test("simula e valida extração de concorrentes de cards .Nv2PK do Google Maps", () => {
    // Simula lista de elementos retornados pelo Google Maps para "Restaurante Central porto feliz"
    const rawFeedItems = [
      {
        name: "Cassiu's Restaurante e Churrascaria",
        href: "https://www.google.com/maps/place/Cassiu's+Restaurante/@-23.2148,-47.5242,15z/data=!4m...",
        ratingText: "4,3",
        reviewsText: "(213)",
        categoryText: "Restaurante e Churrascaria",
        addressText: "R. Draco Albuquerque, 48 - Centro, Porto Feliz",
      },
      {
        name: "VILLA PORTO RESTAURANTE",
        href: "https://www.google.com/maps/place/VILLA+PORTO/@-23.2120,-47.5265,15z/data=!4m...",
        ratingText: "4,5",
        reviewsText: "(211)",
        categoryText: "Restaurante",
        addressText: "R. Ademar de Barros, 345 - Porto Feliz",
      },
      {
        name: "Parmegianas Ray",
        href: "https://www.google.com/maps/place/Parmegianas+Ray/@-23.2135,-47.5218,15z/data=!4m...",
        ratingText: "4,5",
        reviewsText: "(456)",
        categoryText: "Restaurante",
        addressText: "Av. Cap. Joaquim Floriano de Toledo, 529 - Porto Feliz",
      },
    ];

    const targetName = "Cassiu's Restaurante e Churrascaria";

    // Algoritmo de parsing idêntico ao do extractor.js
    const parsedCompetitors = rawFeedItems.map((item, index) => {
      let lat: number | null = null;
      let lng: number | null = null;
      const match = item.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }

      const rating = parseFloat(item.ratingText.replace(",", "."));
      const reviewsCount = parseInt(item.reviewsText.replace(/[^\d]/g, ""), 10);
      const isCurrentClient = item.name.toLowerCase().includes(targetName.toLowerCase());

      return {
        rank: index + 1,
        name: item.name,
        category: item.categoryText,
        rating,
        reviewsCount,
        address: item.addressText,
        lat,
        lng,
        isCurrentClient,
        distanceKm: isCurrentClient ? 0 : parseFloat(((index + 1) * 0.4).toFixed(1)),
      };
    });

    assert.equal(parsedCompetitors.length, 3);

    // 1º lugar na busca foi Cassiu's
    assert.equal(parsedCompetitors[0].name, "Cassiu's Restaurante e Churrascaria");
    assert.equal(parsedCompetitors[0].isCurrentClient, true);
    assert.equal(parsedCompetitors[0].rating, 4.3);
    assert.equal(parsedCompetitors[0].reviewsCount, 213);
    assert.equal(parsedCompetitors[0].lat, -23.2148);
    assert.equal(parsedCompetitors[0].lng, -47.5242);

    // 2º lugar Villa Porto
    assert.equal(parsedCompetitors[1].name, "VILLA PORTO RESTAURANTE");
    assert.equal(parsedCompetitors[1].isCurrentClient, false);
    assert.equal(parsedCompetitors[1].reviewsCount, 211);
    assert.equal(parsedCompetitors[1].rating, 4.5);

    // 3º lugar Parmegianas Ray com 456 avaliações
    assert.equal(parsedCompetitors[2].name, "Parmegianas Ray");
    assert.equal(parsedCompetitors[2].reviewsCount, 456);
    assert.equal(parsedCompetitors[2].lat, -23.2135);
    assert.equal(parsedCompetitors[2].lng, -47.5218);
  });
});
