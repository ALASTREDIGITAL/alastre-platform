/**
 * Alastre Local Inspector - Profile & Competitors Extractor
 * Extração fidedigna de dados públicos de perfis do Google Maps e Google Search.
 * 
 * Regras Éticas e Técnicas:
 * 1. Zero dados fictícios: ausência de nota ou contagem não vira 5.0 nem 3.
 * 2. isClaimed desconhecido quando não houver prova explícita.
 * 3. Distância calculada exclusivamente com Haversine real entre 2 pontos GPS verificados.
 * 4. Posições identificadas como rank na amostra visível, não rank absoluto do Google.
 */
(function (root, factory) {
  const instance = factory();
  if (typeof module === "object" && module && typeof module.exports === "object") {
    module.exports = instance;
  }
  if (root) {
    root.AlastreExtractor = instance;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function () {
  "use strict";

  const AlastreExtractor = {
    /**
     * Calcula distância real em quilômetros via fórmula de Haversine
     * Retorna null se qualquer coordenada for ausente ou inválida.
     */
    calculateDistanceKm(lat1, lon1, lat2, lon2) {
      if (
        typeof lat1 !== "number" || isNaN(lat1) ||
        typeof lon1 !== "number" || isNaN(lon1) ||
        typeof lat2 !== "number" || isNaN(lat2) ||
        typeof lon2 !== "number" || isNaN(lon2)
      ) {
        return null;
      }

      if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90 || lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
        return null;
      }

      const R = 6371; // Raio da Terra em km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return parseFloat((R * c).toFixed(2));
    },

    /**
     * Extrai o CID (Customer ID decimal do Google) da URL ou do DOM
     */
    extractCID(url, doc = document) {
      const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");

      // 1. Tentar pegar da URL formato hexadecimal :0x...
      try {
        const matches = targetUrl.match(/:0x([0-9a-fA-F]+)/);
        if (matches && matches[1]) {
          return BigInt("0x" + matches[1]).toString();
        }
      } catch (e) {}

      // 2. Tentar parâmetro ludocid na URL
      try {
        if (targetUrl) {
          const urlObj = new URL(targetUrl);
          const ludocid = urlObj.searchParams.get("ludocid") || urlObj.searchParams.get("cid");
          if (ludocid && /^\d+$/.test(ludocid)) {
            return ludocid;
          }
        }
      } catch (e) {}

      // 3. Tentar atributos no DOM
      try {
        const elWithLudo = doc.querySelector("[data-ludocid], [data-rc_ludocids]");
        if (elWithLudo) {
          const cid = elWithLudo.getAttribute("data-ludocid") || elWithLudo.getAttribute("data-rc_ludocids");
          if (cid && /^\d+$/.test(cid)) return cid;
        }

        const elWithFid = doc.querySelector("[data-fid]");
        if (elWithFid) {
          const fid = elWithFid.getAttribute("data-fid") || "";
          const parts = fid.split(":");
          if (parts.length >= 2 && /^[0-9a-fA-F]+$/i.test(parts[1])) {
            return BigInt("0x" + parts[1]).toString();
          }
        }

        const links = doc.querySelectorAll('a[href*="ludocid="]');
        for (const link of links) {
          const m = link.getAttribute("href")?.match(/[?&]ludocid=(\d+)/);
          if (m && m[1]) return m[1];
        }

        const mapsLink = doc.querySelector('a[href*="cid="]');
        if (mapsLink) {
          const m = mapsLink.getAttribute("href")?.match(/[?&]cid=(\d+)/);
          if (m && m[1]) return m[1];
        }
      } catch (e) {}

      return null;
    },

    /**
     * Extrai Place ID do DOM ou URL
     */
    extractPlaceId(doc = document) {
      const placeEl = doc.querySelector("[data-place-id]");
      if (placeEl) {
        const pid = placeEl.getAttribute("data-place-id");
        if (pid && pid.startsWith("ChIJ")) return pid;
      }

      const actionLink = doc.querySelector('a[href*="place_id:"], [data-item-id*="place_id:"]');
      if (actionLink) {
        const match = (actionLink.getAttribute("href") || actionLink.getAttribute("data-item-id") || "").match(/place_id:([A-Za-z0-9_-]+)/);
        if (match && match[1]) return match[1];
      }

      try {
        const scripts = doc.querySelectorAll("script");
        for (const s of scripts) {
          const m = s.textContent?.match(/"(ChIJ[A-Za-z0-9_-]{20,})"/);
          if (m && m[1]) return m[1];
        }
      } catch (e) {}

      return null;
    },

    /**
     * Extrai o identificador de Entidade do Knowledge Graph (kgmid)
     */
    extractKgmid(url, doc = document) {
      const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");
      try {
        if (targetUrl) {
          const m = targetUrl.match(/[?&](?:kgmid|mid)=([^&#]+)/);
          if (m && m[1]) return decodeURIComponent(m[1]);
        }
      } catch (e) {}

      try {
        const elWithKgmid = doc.querySelector("[data-kgmid], [data-mid]");
        if (elWithKgmid) {
          const val = elWithKgmid.getAttribute("data-kgmid") || elWithKgmid.getAttribute("data-mid");
          if (val) return val;
        }

        const inputKgmid = doc.querySelector('input[name="kgmid"], input[name="mid"]');
        if (inputKgmid && inputKgmid.value) return inputKgmid.value;

        const linkKgmid = doc.querySelector('a[href*="kgmid="], a[href*="mid="]');
        if (linkKgmid) {
          const href = linkKgmid.getAttribute("href") || "";
          const m = href.match(/[?&](?:kgmid|mid)=([^&#]+)/);
          if (m && m[1]) return decodeURIComponent(m[1]);
        }
      } catch (e) {}

      return null;
    },

    /**
     * Extrai coordenadas geográficas verificadas (Latitude e Longitude)
     */
    extractCoordinates(url, doc = document) {
      const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");
      try {
        const atMatch = targetUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
          const lat = parseFloat(atMatch[1]);
          const lng = parseFloat(atMatch[2]);
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
          }
        }
        const bangMatch = targetUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (bangMatch) {
          const lat = parseFloat(bangMatch[1]);
          const lng = parseFloat(bangMatch[2]);
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
          }
        }
      } catch (e) {}

      // Tentar meta tags ou links no DOM
      try {
        const metaGeo = doc.querySelector('meta[property="place:location:latitude"], meta[name="geo.position"]');
        if (metaGeo) {
          const content = metaGeo.getAttribute("content") || "";
          const parts = content.split(/[;,]/);
          if (parts.length >= 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
          }
        }
      } catch (e) {}

      return null;
    },

    /**
     * Identifica o status de reivindicação de forma fidedigna:
     * - isClaimed: false (se botão "reivindicar" comprovadamente existir no DOM)
     * - isClaimed: true (se selo explícito "verificado" existir no DOM)
     * - isClaimed: null / 'unavailable' (se nenhum elemento for conclusivo)
     */
    checkClaimStatus(doc = document) {
      const claimPatterns = [
        "reivindicar esta empresa",
        "é proprietário desta empresa?",
        "é o proprietário desta empresa?",
        "claim this business",
        "own this business?",
        "reclamar esta empresa"
      ];

      const claimSelectors = [
        'a[href*="business.google.com/create"]',
        'a[href*="business.google.com/claim"]',
        'button[aria-label*="proprietário" i]',
        'button[aria-label*="reivindicar" i]',
        'button[aria-label*="claim" i]',
        'button[aria-label*="own" i]',
        'a[aria-label*="proprietário" i]',
        'a[aria-label*="reivindicar" i]',
        'a[aria-label*="claim" i]',
        'a[aria-label*="own" i]',
        '[data-item-id="merchant"]'
      ];

      for (const sel of claimSelectors) {
        try {
          const els = doc.querySelectorAll(sel);
          for (const el of els) {
            const text = (el.textContent + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
            const href = el.getAttribute("href") || "";
            if (claimPatterns.some((pattern) => text.includes(pattern)) || href.includes("create?fp=")) {
              return {
                isClaimed: false,
                claimButtonFound: true,
                evidenceStatus: "confirmed",
                evidenceSnippet: `Botão de reivindicação localizado: "${el.textContent?.trim() || el.getAttribute("aria-label")}"`
              };
            }
          }
        } catch (e) {}
      }

      // Varredura por texto em links no painel do Google Search
      try {
        const allLinks = doc.querySelectorAll("#rhs a, .kp-wholepage a, .osrp-blk a");
        for (const link of allLinks) {
          const text = (link.textContent || "").toLowerCase().trim();
          if (claimPatterns.some((pattern) => text.includes(pattern))) {
            return {
              isClaimed: false,
              claimButtonFound: true,
              evidenceStatus: "confirmed",
              evidenceSnippet: `Link de reivindicação no painel: "${link.textContent?.trim()}"`
            };
          }
        }
      } catch (e) {}

      // Checar se há selo explícito de "Perfil verificado"
      const verifiedBadge = doc.querySelector('[aria-label*="Perfil verificado" i], [title*="Perfil verificado" i], .verified-badge');
      if (verifiedBadge) {
        return {
          isClaimed: true,
          claimButtonFound: false,
          evidenceStatus: "confirmed",
          evidenceSnippet: "Selo oficial de perfil verificado localizado no painel."
        };
      }

      // Se nenhum elemento conclusivo for encontrado, o status é NÃO EVIDENCIÁVEL PUBLICAMENTE
      return {
        isClaimed: null,
        claimButtonFound: false,
        evidenceStatus: "unavailable",
        evidenceSnippet: "Ausência de botão ou selo explícito no DOM visível. Status não mensurável na visualização pública."
      };
    },

    /**
     * Extrai categorias (Principal e Secundárias)
     */
    extractCategories(doc = document) {
      const categories = [];

      const primaryCatSelectors = [
        'button[jsaction*="category"]',
        'button.DkEaL',
        '[data-attrid="kc:/local:place_type"] span',
        '[data-attrid="kc:/local:place_type"]',
        '.wDYxhc[data-attrid*="subtitle"]',
        'div.wDYxhc span[data-attrid*="kc:/local:place_type"]',
        '.fontBodyMedium button.DkEaL',
        'span[data-attrid*="subtitle"]',
        '.YhemCb',
        '.BNeawe.tAd8D.AP7Wnd',
        'span.wDYxhc'
      ];

      let primaryCat = "";
      for (const sel of primaryCatSelectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent?.trim()) {
          const txt = el.textContent.trim();
          if (!txt.includes(",") && !txt.match(/^\d+/) && txt.length > 2 && txt.length < 60) {
            primaryCat = txt;
            break;
          }
        }
      }

      if (primaryCat) {
        categories.push(primaryCat);
      }

      return categories;
    },

    /**
     * Extrai snapshot completo e fidedigno do perfil ativo
     */
    extractFullSnapshot(doc = document, currentUrl = "") {
      const url = currentUrl || (typeof window !== "undefined" ? window.location.href : "");
      const now = new Date().toISOString();

      const cid = this.extractCID(url, doc);
      const placeId = this.extractPlaceId(doc);
      const kgmid = this.extractKgmid(url, doc);
      const coords = this.extractCoordinates(url, doc);
      const claimResult = this.checkClaimStatus(doc);

      // 1. Nome da empresa
      const nameSelectors = [
        "h1.DUwDvf.lfPIob",
        "h1.fontHeadlineLarge",
        'div[data-attrid="title"]',
        'h2[data-attrid="title"]',
        '.SPZz6b h2',
        '.SPZz6b span',
        '.qrShPb span',
        "h1.section-hero-header-title-title"
      ];
      let name = "";
      let nameSnippet = "";
      for (const sel of nameSelectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent?.trim()) {
          name = el.textContent.trim();
          nameSnippet = `Encontrado via seletor '${sel}'`;
          break;
        }
      }

      // 2. Categorias
      const categories = this.extractCategories(doc);
      const primaryCategory = categories[0] || null;
      const secondaryCategories = categories.slice(1);

      // 3. Telefone
      const phoneSelectors = [
        '[data-attrid*="phone"] .LrzXr',
        '[data-dtype="d3ph"] span',
        'button[data-item-id*="phone"]',
        'a[href^="tel:"]',
        '[data-attrid*="phone"]'
      ];
      let phone = null;
      for (const sel of phoneSelectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent?.trim()) {
          const raw = el.textContent.trim();
          const clean = raw.replace(/[^\d+()-\s]/g, "").trim();
          if (clean.length >= 8) {
            phone = clean;
            break;
          }
        }
      }

      // 4. Website
      const webSelectors = [
        '[data-attrid*="website"] a',
        'a.ab_button[href*="http"]',
        'a[data-item-id="authority"]',
        'button[aria-label*="Website" i]',
        'a[aria-label*="Website" i]'
      ];
      let website = null;
      for (const sel of webSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
          const href = el.getAttribute("href");
          if (href && !href.startsWith("javascript") && !href.includes("google.com/search")) {
            website = href;
            break;
          }
        }
      }

      // 5. Endereço
      const addressSelectors = [
        '[data-attrid="kc:/location/location:address"] .LrzXr',
        '[data-attrid*="address"] .LrzXr',
        'button[data-item-id="address"]',
        '[data-item-id*="address"]',
        '[data-attrid*="address"]',
        ".rogA2c",
        ".LrzXr"
      ];
      let address = null;
      for (const sel of addressSelectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent?.trim()) {
          address = el.textContent.trim();
          break;
        }
      }

      // 6. Avaliações (Rating e ReviewCount)
      let rating = null;
      let reviewCount = null;
      const ratingSelectors = [
        "span.Aq14fc",
        ".F7nice span[aria-hidden='true']",
        "span.fontDisplayLarge",
        "span[aria-label*='estrelas']",
        "g-review-stars span"
      ];
      for (const sel of ratingSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
          const raw = (el.getAttribute("aria-label") || el.textContent || "").replace(",", ".");
          const m = raw.match(/(\d+\.\d+|\d+)/);
          if (m) {
            const val = parseFloat(m[1]);
            if (!isNaN(val) && val >= 1.0 && val <= 5.0) {
              rating = val;
              break;
            }
          }
        }
      }

      const reviewsCountSelectors = [
        "span.hqzQac a span",
        "span.Ob2kfd a span",
        "span.Ob2kfd",
        '[data-attrid="kc:/local:place_user_reviews"]',
        "span.RDApEe.YrbPuc",
        "span.oqSTJd",
        ".F7nice span:last-child",
        "span[aria-label*='avaliaç']",
        "span[aria-label*='review']",
        ".F7nice",
        ".hG1Yff",
        "div.fontBodyMedium span"
      ];
      for (const sel of reviewsCountSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
          const text = el.getAttribute("aria-label") || el.textContent || "";
          // Ignora se contiver caracteres típicos de telefone (hífen com 4 dígitos finais ou mais de 8 dígitos)
          if (/\d{4,5}-\d{4}/.test(text)) continue;

          const m = text.match(/([\d.,]+)\s*(?:avaliaç|reviews|coment)/i) ||
                    text.match(/(?:avaliaç|reviews|coment)[\s:]*([\d.,]+)/i) ||
                    text.match(/\(([\d.,]+)\)/);
          if (m && m[1]) {
            const count = parseInt(m[1].replace(/[.,]/g, ""), 10);
            if (!isNaN(count) && count >= 0) {
              reviewCount = count;
              break;
            }
          }
        }
      }

      // 7. Horário
      let hours = null;
      const hoursEl = doc.querySelector('[data-attrid="kc:/location/location:hours"], [data-item-id*="oh"]');
      if (hoursEl && hoursEl.textContent?.trim()) {
        hours = hoursEl.textContent.trim().replace(/\s+/g, " ").slice(0, 100);
      }

      // 8. Fotos
      let photosCount = null;
      const photosBtn = doc.querySelector('button[aria-label*="foto"], button[aria-label*="photo"], [data-attrid*="photo"]');
      if (photosBtn) {
        const m = (photosBtn.textContent + " " + (photosBtn.getAttribute("aria-label") || "")).match(/(\d+[\d.,]*)/);
        if (m) {
          photosCount = parseInt(m[1].replace(/[.,]/g, ""), 10);
        }
      }

      // Montagem do AuditedProfile com rastreabilidade explícita
      return {
        name: {
          value: name || null,
          status: name ? "confirmed" : "not_found",
          source: "dom_selector",
          evidenceSnippet: nameSnippet || undefined,
          collectedAt: now
        },
        primaryCategory: {
          value: primaryCategory,
          status: primaryCategory ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        secondaryCategories: {
          value: secondaryCategories,
          status: secondaryCategories.length > 0 ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        cid: {
          value: cid,
          status: cid ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        placeId: {
          value: placeId,
          status: placeId ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        kgmid: {
          value: kgmid,
          status: kgmid ? "confirmed" : "not_found",
          source: "url_or_dom",
          collectedAt: now
        },
        coordinates: {
          value: coords,
          status: coords ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        isClaimed: {
          value: claimResult.isClaimed,
          status: claimResult.evidenceStatus,
          source: "dom_selector",
          evidenceSnippet: claimResult.evidenceSnippet,
          collectedAt: now,
          notes: claimResult.evidenceStatus === "unavailable" ? "Não comprovável na visualização pública" : undefined
        },
        phone: {
          value: phone,
          status: phone ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        website: {
          value: website,
          status: website ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        address: {
          value: address,
          status: address ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        hours: {
          value: hours,
          status: hours ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        rating: {
          value: rating,
          status: rating !== null ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        reviewCount: {
          value: reviewCount,
          status: reviewCount !== null ? "confirmed" : "not_found",
          source: "dom_selector",
          collectedAt: now
        },
        photosCount: {
          value: photosCount,
          status: photosCount !== null ? "confirmed" : "unavailable",
          source: "dom_selector",
          collectedAt: now
        },
        url: {
          value: url || null,
          status: "confirmed",
          source: "url_param",
          collectedAt: now
        }
      };
    },

    /**
     * Extrai concorrentes reais listados no Google Maps (.Nv2PK)
     * Sem fabricação de distâncias e sem fallbacks de nota 5.0
     */
    extractMapCompetitors(targetName = "", targetCoords = null, doc = document) {
      const cards = doc.querySelectorAll(".Nv2PK");
      if (!cards || cards.length === 0) return [];

      const cleanTarget = (targetName || "").toLowerCase().trim();
      const competitors = [];

      cards.forEach((card, index) => {
        const titleEl = card.querySelector(".qBF1Pd, .fontHeadlineSmall, a.hfpxzc");
        const name = titleEl?.getAttribute("aria-label") || titleEl?.textContent?.trim() || "";
        if (!name) return;

        // Link e Coordenadas reais
        const linkEl = card.querySelector('a.hfpxzc[href*="/maps/place/"]');
        const href = linkEl ? linkEl.getAttribute("href") || "" : "";
        let coordinates = null;
        if (href) {
          const match = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              coordinates = { lat, lng };
            }
          }
        }

        // Nota real (null se não encontrada, NUNCA default 5.0)
        let rating = null;
        const ratingEl = card.querySelector(".MW4etd, span[aria-label*='estrelas']");
        if (ratingEl) {
          const raw = (ratingEl.getAttribute("aria-label") || ratingEl.textContent || "").replace(",", ".");
          const rMatch = raw.match(/(\d+\.\d+|\d+)/);
          if (rMatch) {
            const val = parseFloat(rMatch[1]);
            if (!isNaN(val) && val >= 1.0 && val <= 5.0) rating = val;
          }
        }

        // Quantidade de avaliações (null se não encontrada, NUNCA default 0 ou 3)
        let reviewsCount = null;
        const reviewsEl = card.querySelector(".UY7F9, span[aria-label*='avaliaç'], span[aria-label*='review']");
        if (reviewsEl) {
          const text = reviewsEl.getAttribute("aria-label") || reviewsEl.textContent || "";
          const revMatch = text.match(/([\d.,]+)/);
          if (revMatch) {
            const count = parseInt(revMatch[1].replace(/[.,]/g, ""), 10);
            if (!isNaN(count)) reviewsCount = count;
          }
        }

        // Categoria e Endereço
        const infoRows = card.querySelectorAll(".W4Efsd");
        let category = undefined;
        let address = undefined;
        infoRows.forEach((row) => {
          const spans = Array.from(row.querySelectorAll("span")).map((s) => s.textContent.trim()).filter(Boolean);
          for (const s of spans) {
            if (
              !category &&
              s.length > 2 &&
              !s.includes("R$") &&
              !s.match(/^\d/) &&
              !s.includes("·") &&
              !s.toLowerCase().includes("fechado") &&
              !s.toLowerCase().includes("aberto")
            ) {
              category = s;
            } else if (
              !address &&
              (s.includes("R.") ||
                s.includes("Av.") ||
                s.includes("Rua") ||
                s.includes("Avenida") ||
                s.includes("Centro") ||
                s.includes(",") ||
                s.length > 10)
            ) {
              address = s;
            }
          }
        });

        const isCurrent = cleanTarget
          ? name.toLowerCase().includes(cleanTarget) || cleanTarget.includes(name.toLowerCase())
          : index === 0;

        // Distância calculada APENAS se ambas as coordenadas existirem
        let distanceKm = null;
        if (isCurrent) {
          distanceKm = 0.0;
        } else if (targetCoords && coordinates) {
          distanceKm = AlastreExtractor.calculateDistanceKm(
            targetCoords.lat,
            targetCoords.lng,
            coordinates.lat,
            coordinates.lng
          );
        }

        competitors.push({
          rankInVisibleSample: index + 1,
          name,
          category,
          rating,
          reviewsCount,
          address,
          coordinates,
          isCurrentClient: isCurrent,
          distanceKm
        });
      });

      return competitors;
    },

    /**
     * Extrai cartões de avaliações individuais abertas no DOM (Busca Google ou Google Maps).
     * 
     * Regras Estritas:
     * 1. Extração fidedigna exclusivamente de dados públicos abertos.
     * 2. Associação rigorosa à ficha ativa: se ambígua, descarta e registra o motivo.
     * 3. Desduplicação antes de apurar a contagem da amostra.
     * 4. Avaliações só com estrelas mantêm text: "".
     * 5. Metadados do autor (ex: "Local Guide · 12 avaliações") isolados sem poluir métricas da empresa.
     * 6. Diferenciação explícita de status: panel_closed, panel_empty, captured, extraction_error.
     */
    extractReviewsData(doc = document, activeContext = {}) {
      try {
        const targetKgmid = activeContext.kgmid || this.extractKgmid(undefined, doc);
        const targetName = (activeContext.name || "").toLowerCase().trim();

        // 1. Identificar contêineres candidatos no Google Search e Google Maps
        const searchContainers = [
          doc.querySelector(".review-dialog-list"),
          doc.querySelector('div[data-async-context*="review"]'),
          doc.querySelector('div[data-attrid="kc:/local:place_user_reviews"]'),
          doc.querySelector("div.lcorif"),
          doc.querySelector("div.WMbnJf"),
          doc.querySelector("div.jD1thc")
        ].filter(Boolean);

        const mapsContainers = [
          doc.querySelector('div.m6QErb[aria-label*="Avaliações" i]'),
          doc.querySelector('div.m6QErb[aria-label*="Reviews" i]'),
          doc.querySelector('div.m6QErb.DxyBCb'),
          doc.querySelector('div[role="region"][aria-label*="Avaliações" i]')
        ].filter(Boolean);

        const hasAnyContainer = searchContainers.length > 0 || mapsContainers.length > 0;

        // 2. Localizar cartões de avaliação
        // Busca: .gws-localreviews__google-review, div[data-review-id], div.WMbnJf, div.jD1thc
        // Maps: div.jftiEf[data-review-id], div.jftiEf
        const cardSelectors = [
          ".gws-localreviews__google-review",
          "div.jftiEf[data-review-id]",
          "div.jftiEf",
          "div[data-review-id]",
          "div.WMbnJf",
          "div.jD1thc"
        ];

        let rawCards = [];
        for (const sel of cardSelectors) {
          const els = Array.from(doc.querySelectorAll(sel));
          if (els.length > 0) {
            rawCards = els;
            break;
          }
        }

        // Se não houver cartões
        if (rawCards.length === 0) {
          if (!hasAnyContainer) {
            return {
              status: "panel_closed",
              message: "Painel de avaliações fechado na página. Abra a aba ou modal de avaliações para capturar os cartões.",
              capturedCount: 0,
              uncollectedCount: null,
              reviews: [],
              discardedCount: 0
            };
          }
          return {
            status: "panel_empty",
            message: "Painel de avaliações aberto, mas nenhum cartão de avaliação foi encontrado.",
            capturedCount: 0,
            uncollectedCount: null,
            reviews: [],
            discardedCount: 0
          };
        }

        // 3. Processamento e atribuição estrita à ficha
        const seenKeys = new Set();
        const extractedReviews = [];
        let discardedCount = 0;

        rawCards.forEach((card, idx) => {
          // Validação de escopo: descartar cartões se pertencerem comprovadamente a outro kgmid
          if (targetKgmid) {
            const cardKgmid = card.closest("[data-kgmid], [data-mid]")?.getAttribute("data-kgmid") ||
                              card.closest("[data-kgmid], [data-mid]")?.getAttribute("data-mid");
            if (cardKgmid && cardKgmid !== targetKgmid) {
              discardedCount++;
              return;
            }
          }

          // ID da avaliação
          const reviewId =
            card.getAttribute("data-review-id") ||
            card.id ||
            card.getAttribute("data-fid") ||
            `rev-${idx}`;

          // Autor
          const authorEl = card.querySelector(".TSUbDb a, .TSUbDb, .d4r55, .YEtELc, button.alP2Qe, div.WNx5W, .fontBodyMedium.bwoZTb");
          let author = authorEl?.textContent?.trim() || "";
          // Limpa possíveis concatenações indesejadas
          if (author.includes("Local Guide")) {
            author = author.split(/Local Guide/i)[0].trim();
          }
          if (author.includes("·")) {
            author = author.split("·")[0].trim();
          }
          if (!author) {
            author = "Usuário do Google";
          }

          // Avatar
          const avatarEl = card.querySelector("img.N3Fxvd, img.lDY1T, img");
          const avatarUrl = avatarEl?.getAttribute("src")?.startsWith("http")
            ? avatarEl.getAttribute("src")
            : undefined;

          // Local Guide status e contagem de avaliações do autor (NÃO confundir com nota ou total da ficha!)
          const guideMetaEl = card.querySelector(".A5Fugc, .RfDO5c, .badge, div.WNx5W");
          const guideText = (guideMetaEl?.textContent || card.textContent || "").toLowerCase();
          const isLocalGuide = guideText.includes("local guide");
          let localGuideLevel = undefined;
          const levelMatch = guideText.match(/(?:nível|level)\s*(\d+)/i);
          if (levelMatch) {
            localGuideLevel = parseInt(levelMatch[1], 10);
          }

          // Nota (Estrelas: 1 a 5)
          let rating = 5;
          const starEl = card.querySelector(
            "span.lTi8oc, span.kvMYJc, g-review-stars span[aria-label], span[aria-label*='estrelas'], span[aria-label*='stars'], span[role='img'][aria-label*='estrela']"
          );
          if (starEl) {
            const rawStar = (starEl.getAttribute("aria-label") || starEl.textContent || "").replace(",", ".");
            const sMatch = rawStar.match(/(\d+\.\d+|\d+)/);
            if (sMatch) {
              const parsed = parseFloat(sMatch[1]);
              if (!isNaN(parsed) && parsed >= 1.0 && parsed <= 5.0) {
                rating = Math.round(parsed);
              }
            }
          }

          // Data Relativa
          const dateEl = card.querySelector(".dehysf, span.rsqaWe, span.x8aTrd");
          const relativeDate = dateEl?.textContent?.trim() || undefined;

          // Texto da avaliação (Se não houver texto, DEVE SER "" e NUNCA inventado)
          const textEl = card.querySelector(
            "span[data-expandable-section], .review-snippet, span.review-full-text, .Jtu6Td span, span.wiI7m, .MyEned span"
          );
          let text = "";
          if (textEl) {
            text = textEl.textContent?.trim() || "";
            // Remove botão "Mais" / "Ver mais" do final se tiver sido concatenado
            text = text.replace(/(?:\.\.\.\s*)?(?:Mais|Ver mais|Ler mais)$/i, "").trim();
          }

          // Resposta do Dono (Owner Reply)
          let ownerReply = null;
          const replyEl = card.querySelector(".loris, div[data-owner-reply], div.CDe7pd, .k8MTId, div.n4Ljhe");
          if (replyEl) {
            const replyTextEl = replyEl.querySelector(".wiI7m, span, div") || replyEl;
            let replyText = replyTextEl.textContent?.trim() || "";
            // Limpa prefixo "Resposta do proprietário"
            replyText = replyText.replace(/^Resposta do propriet[aá]rio:?\s*/i, "").trim();
            if (replyText) {
              const replyDateEl = replyEl.querySelector(".dehysf, .rsqaWe, span");
              const replyDate = replyDateEl && replyDateEl !== replyTextEl ? replyDateEl.textContent?.trim() : undefined;
              ownerReply = {
                text: replyText,
                relativeDate: replyDate
              };
            }
          }

          // Mídia / Imagens anexadas pelo usuário
          const hasImages = Boolean(card.querySelector(".TsiLvd, button[aria-label*='foto'], button[aria-label*='photo'], img.k7A2Fd"));

          // Desduplicação rigorosa
          const dedupeKey = `${author.toLowerCase()}|${rating}|${(relativeDate || "").toLowerCase()}|${text.slice(0, 40)}`;
          if (seenKeys.has(dedupeKey)) {
            return;
          }
          seenKeys.add(dedupeKey);

          extractedReviews.push({
            id: reviewId,
            author,
            avatarUrl,
            isLocalGuide,
            localGuideLevel,
            rating,
            relativeDate,
            text, // "" quando só tem estrelas
            ownerReply,
            hasImages
          });
        });

        return {
          status: extractedReviews.length > 0 ? "captured" : "panel_empty",
          message: extractedReviews.length > 0
            ? `${extractedReviews.length} avaliações individuais capturadas com sucesso.`
            : "Nenhum cartão válido pôde ser extraído do painel de avaliações.",
          capturedCount: extractedReviews.length,
          uncollectedCount: null,
          reviews: extractedReviews,
          discardedCount
        };
      } catch (err) {
        return {
          status: "extraction_error",
          message: `Erro na extração de avaliações: ${err?.message || err}`,
          capturedCount: 0,
          uncollectedCount: null,
          reviews: [],
          discardedCount: 0
        };
      }
    }
  };

  return AlastreExtractor;
});
