import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../extensions/alastre-local-inspector/scripts/extractor.js");
const AlastreExtractor = (globalThis as any).AlastreExtractor;

// Helper para criar nós DOM simulados com suporte preciso a seletores do Google Maps
interface MockElementConfig {
  tag?: string;
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: MockElementConfig[];
}

function createMockElement(config: MockElementConfig): any {
  const attrs = config.attributes || {};
  if (config.className) attrs["class"] = config.className;

  const children: any[] = (config.children || []).map((c) => createMockElement(c));

  const el = {
    tagName: (config.tag || "div").toUpperCase(),
    textContent: config.textContent !== undefined ? config.textContent : children.map((c) => c.textContent).join(" "),
    getAttribute(name: string) {
      return attrs[name] || null;
    },
    querySelector(selector: string) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector: string) {
      const matches: any[] = [];
      const matchSingle = (node: any, sel: string) => {
        const classes = (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
        const tag = node.tagName;

        if (sel === ".Nv2PK") return classes.includes("Nv2PK");
        if (sel === ".qBF1Pd") return classes.includes("qBF1Pd");
        if (sel === ".MW4etd") return classes.includes("MW4etd");
        if (sel === ".UY7F9") return classes.includes("UY7F9");
        if (sel === ".W4Efsd") return classes.includes("W4Efsd");
        if (sel === ".Aq14fc") return classes.includes("Aq14fc");
        if (sel === ".F7nice") return classes.includes("F7nice");
        if (sel === ".verified-badge") return classes.includes("verified-badge");

        if (sel === "a.hfpxzc" || sel === 'a.hfpxzc[href*="/maps/place/"]') {
          return tag === "A" && classes.includes("hfpxzc");
        }
        if (sel === "h1.DUwDvf" || sel.startsWith("h1.DUwDvf")) {
          return tag === "H1" && classes.includes("DUwDvf");
        }
        if (sel.startsWith("button[jsaction*=\"category\"]")) {
          return tag === "BUTTON" && Boolean(node.getAttribute("jsaction")?.includes("category"));
        }
        if (sel.startsWith("span.Aq14fc")) {
          return tag === "SPAN" && classes.includes("Aq14fc");
        }
        if (sel.startsWith("span.hqzQac")) {
          return tag === "SPAN" && classes.includes("hqzQac");
        }

        // Atributos específicos
        if (sel.includes('[data-place-id]')) return Boolean(node.getAttribute("data-place-id"));
        if (sel.includes('[data-ludocid]')) return Boolean(node.getAttribute("data-ludocid"));
        if (sel.includes('[data-fid]')) return Boolean(node.getAttribute("data-fid"));
        if (sel.includes('[data-dtype="d3ph"]')) return node.getAttribute("data-dtype") === "d3ph";
        if (sel.includes('[data-item-id="authority"]')) return node.getAttribute("data-item-id") === "authority";
        if (sel.includes('[data-attrid="kc:/location/location:address"]')) return node.getAttribute("data-attrid") === "kc:/location/location:address";
        if (sel.includes('[data-attrid="kc:/location/location:hours"]')) return node.getAttribute("data-attrid") === "kc:/location/location:hours";
        if (sel.includes('[data-attrid="title"]')) return node.getAttribute("data-attrid") === "title";

        // Claim patterns
        if (sel.includes("business.google.com/create")) {
          return Boolean(node.getAttribute("href")?.includes("business.google.com/create"));
        }
        if (sel.includes("reivindicar")) {
          const aria = (node.getAttribute("aria-label") || "").toLowerCase();
          const txt = (node.textContent || "").toLowerCase();
          return aria.includes("reivindicar") || txt.includes("reivindicar");
        }
        if (sel.includes("Perfil verificado")) {
          const aria = (node.getAttribute("aria-label") || "").toLowerCase();
          const title = (node.getAttribute("title") || "").toLowerCase();
          return aria.includes("perfil verificado") || title.includes("perfil verificado");
        }

        if (sel === "span" && tag === "SPAN") return true;
        if (sel === "a" && tag === "A") return true;
        if (sel === "button" && tag === "BUTTON") return true;

        return false;
      };

      const matchSelector = (node: any) => {
        const parts = selector.split(",").map((s) => s.trim());
        return parts.some((p) => matchSingle(node, p));
      };

      for (const child of children) {
        if (matchSelector(child)) matches.push(child);
        matches.push(...child.querySelectorAll(selector));
      }
      return matches;
    }
  };

  return el;
}

function createMockDocument(elements: MockElementConfig[]) {
  const root = createMockElement({ children: elements });
  return {
    querySelector: (sel: string) => root.querySelector(sel),
    querySelectorAll: (sel: string) => root.querySelectorAll(sel)
  };
}

describe("Extractor DOM Real Execution Suite", () => {
  it("extrai dados fidedignos de perfil completo sem fallbacks sintéticos", () => {
    const mockDoc = createMockDocument([
      { tag: "h1", className: "DUwDvf lfPIob", textContent: "Barbearia Dutra" },
      { tag: "button", attributes: { jsaction: "category.click" }, textContent: "Barbearia" },
      { tag: "div", attributes: { "data-place-id": "ChIJb7c9wX0zz5QRk2_12345" } },
      { tag: "div", attributes: { "data-ludocid": "987654321012345" } },
      { tag: "a", attributes: { "data-attrid": "kc:/location/location:address" }, textContent: "R. Justino Giongo Bueno, 74, Porto Feliz - SP" },
      { tag: "span", attributes: { "data-dtype": "d3ph" }, textContent: "(15) 99778-1759" },
      { tag: "a", attributes: { "data-item-id": "authority", href: "https://barbeariadutra.agenda.app" } },
      { tag: "span", className: "Aq14fc", textContent: "5,0" },
      { tag: "span", className: "hqzQac", children: [{ tag: "span", textContent: "178 avaliações" }] },
      { tag: "div", attributes: { "data-attrid": "kc:/location/location:hours" }, textContent: "Aberto ⋅ Fecha às 19:00" }
    ]);

    const url = "https://www.google.com/maps/place/Barbearia+Dutra/@-23.21456,-47.52345,17z/data=!3d-23.21456!4d-47.52345";
    const profile = AlastreExtractor.extractFullSnapshot(mockDoc, url);

    // Nome confirmado
    assert.strictEqual(profile.name.value, "Barbearia Dutra");
    assert.strictEqual(profile.name.status, "confirmed");

    // Categoria confirmada
    assert.strictEqual(profile.primaryCategory.value, "Barbearia");
    assert.strictEqual(profile.primaryCategory.status, "confirmed");

    // Identificadores técnicos
    assert.strictEqual(profile.placeId.value, "ChIJb7c9wX0zz5QRk2_12345");
    assert.strictEqual(profile.cid.value, "987654321012345");

    // Coordenadas verificadas reais
    assert.deepStrictEqual(profile.coordinates.value, { lat: -23.21456, lng: -47.52345 });
    assert.strictEqual(profile.coordinates.status, "confirmed");

    // Reivindicação: sem botão e sem selo -> DEVE SER 'unavailable', NUNCA true por padrão!
    assert.strictEqual(profile.isClaimed.value, null);
    assert.strictEqual(profile.isClaimed.status, "unavailable");

    // Avaliações reais
    assert.strictEqual(profile.rating.value, 5.0);
    assert.strictEqual(profile.reviewCount.value, 178);
  });

  it("identifica empresa NÃO reivindicada quando botão explícito estiver presente", () => {
    const mockDoc = createMockDocument([
      { tag: "h1", className: "DUwDvf", textContent: "Oficina do Zé" },
      { tag: "a", attributes: { href: "https://business.google.com/create?fp=123", "aria-label": "Reivindicar esta empresa" }, textContent: "Reivindicar esta empresa" }
    ]);

    const profile = AlastreExtractor.extractFullSnapshot(mockDoc, "https://maps.google.com");
    assert.strictEqual(profile.isClaimed.value, false);
    assert.strictEqual(profile.isClaimed.status, "confirmed");
  });

  it("identifica empresa com selo explícito de verificado", () => {
    const mockDoc = createMockDocument([
      { tag: "h1", className: "DUwDvf", textContent: "Clínica Vida" },
      { tag: "span", className: "verified-badge", attributes: { "aria-label": "Perfil verificado" }, textContent: "Perfil verificado" }
    ]);

    const profile = AlastreExtractor.extractFullSnapshot(mockDoc, "https://maps.google.com");
    assert.strictEqual(profile.isClaimed.value, true);
    assert.strictEqual(profile.isClaimed.status, "confirmed");
  });

  it("não inventa notas nem avaliações para perfis sem dados", () => {
    const mockDoc = createMockDocument([
      { tag: "h1", className: "DUwDvf", textContent: "Empresa Sem Reviews" }
    ]);

    const profile = AlastreExtractor.extractFullSnapshot(mockDoc, "https://maps.google.com");

    // Ausência no DOM NÃO deve virar 5.0 nem 3!
    assert.strictEqual(profile.rating.value, null);
    assert.strictEqual(profile.rating.status, "not_found");
    assert.strictEqual(profile.reviewCount.value, null);
    assert.strictEqual(profile.reviewCount.status, "not_found");
    assert.strictEqual(profile.phone.value, null);
    assert.strictEqual(profile.website.value, null);
    assert.strictEqual(profile.coordinates.value, null);
  });

  it("calcula distância real Haversine e rejeita cálculos com coordenadas incompletas", () => {
    const dist = AlastreExtractor.calculateDistanceKm(-23.2148, -47.5242, -23.2120, -47.5265);
    assert.ok(dist !== null && dist > 0.3 && dist < 0.5);

    // Coordenada ausente ou inválida -> NUNCA fabricar valor
    assert.strictEqual(AlastreExtractor.calculateDistanceKm(null, -47.5242, -23.2120, -47.5265), null);
    assert.strictEqual(AlastreExtractor.calculateDistanceKm(-23.2148, -47.5242, undefined, -47.5265), null);
    assert.strictEqual(AlastreExtractor.calculateDistanceKm(-23.2148, -47.5242, -23.2120, NaN), null);
  });

  it("extrai concorrentes reais de cards .Nv2PK com rank na amostra visível", () => {
    const mockDoc = createMockDocument([
      {
        tag: "div",
        className: "Nv2PK",
        children: [
          { tag: "div", className: "qBF1Pd", textContent: "Cassiu's Restaurante" },
          { tag: "a", className: "hfpxzc", attributes: { href: "/maps/place/Cassiu/@-23.2148,-47.5242,15z/data=!3d-23.2148!4d-47.5242" } },
          { tag: "span", className: "MW4etd", textContent: "4,3" },
          { tag: "span", className: "UY7F9", textContent: "(213)" }
        ]
      },
      {
        tag: "div",
        className: "Nv2PK",
        children: [
          { tag: "div", className: "qBF1Pd", textContent: "Villa Porto" },
          { tag: "a", className: "hfpxzc", attributes: { href: "/maps/place/Villa/@-23.2120,-47.5265,15z/data=!3d-23.2120!4d-47.5265" } },
          { tag: "span", className: "MW4etd", textContent: "4,5" },
          { tag: "span", className: "UY7F9", textContent: "(211)" }
        ]
      }
    ]);

    const targetCoords = { lat: -23.2148, lng: -47.5242 };
    const comps = AlastreExtractor.extractMapCompetitors("Cassiu's Restaurante", targetCoords, mockDoc);

    assert.strictEqual(comps.length, 2);
    // 1º Cassiu's (auditado)
    assert.strictEqual(comps[0].name, "Cassiu's Restaurante");
    assert.strictEqual(comps[0].isCurrentClient, true);
    assert.strictEqual(comps[0].rankInVisibleSample, 1);
    assert.strictEqual(comps[0].distanceKm, 0.0);
    assert.strictEqual(comps[0].rating, 4.3);
    assert.strictEqual(comps[0].reviewsCount, 213);

    // 2º Villa Porto (concorrente com distância calculada real)
    assert.strictEqual(comps[1].name, "Villa Porto");
    assert.strictEqual(comps[1].isCurrentClient, false);
    assert.strictEqual(comps[1].rankInVisibleSample, 2);
    assert.ok(comps[1].distanceKm > 0.3 && comps[1].distanceKm < 0.5);
    assert.strictEqual(comps[1].rating, 4.5);
    assert.strictEqual(comps[1].reviewsCount, 211);
  });
});
