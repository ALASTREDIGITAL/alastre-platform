import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedOrigin,
  validateAuditSessionEnvelope,
  calculateLocalScoreV2,
  MAX_ENVELOPE_SIZE_BYTES
} from "../lib/audit-session-verifier.ts";
import type { AuditSessionEnvelope, AuditChecklistCriterion } from "../lib/pre-audit-types.ts";

describe("AuditSessionEnvelope & Security Verifier Suite", () => {
  it("valida origens autorizadas da Alastre Platform e rejeita origens não autorizadas", () => {
    // Origens permitidas
    assert.strictEqual(isAllowedOrigin("http://localhost:5175"), true);
    assert.strictEqual(isAllowedOrigin("http://127.0.0.1:5175"), true);
    assert.strictEqual(isAllowedOrigin("http://localhost:3000"), true);
    assert.strictEqual(isAllowedOrigin("https://app.alastre.digital"), true);
    assert.strictEqual(isAllowedOrigin("https://alastre.digital"), true);
    assert.strictEqual(isAllowedOrigin("https://homolog.alastre.digital"), true);

    // Origens maliciosas ou não autorizadas (devem falhar)
    assert.strictEqual(isAllowedOrigin("https://evil.com"), false);
    assert.strictEqual(isAllowedOrigin("https://google.com"), false);
    assert.strictEqual(isAllowedOrigin("http://localhost:8080"), false);
    assert.strictEqual(isAllowedOrigin("https://alastre.digital.attacker.com"), false);
    assert.strictEqual(isAllowedOrigin(""), false);
    assert.strictEqual(isAllowedOrigin("null"), false);
  });

  it("valida a estrutura de um AuditSessionEnvelope v2.0 íntegro", () => {
    const validEnvelope: AuditSessionEnvelope = {
      version: "2.0",
      sessionId: "b7654321-1234-4321-8765-abcdef123456",
      timestamp: new Date().toISOString(),
      sourceUrl: "https://www.google.com/maps/place/Barbearia+Dutra",
      searchContext: {
        query: "Barbearia em Porto Feliz",
        sampleSize: 15
      },
      profile: {
        name: { value: "Barbearia Dutra", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        primaryCategory: { value: "Barbearia", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        secondaryCategories: { value: ["Salão de beleza"], status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        cid: { value: "1234567890", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        placeId: { value: "ChIJabcdef123456", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        coordinates: { value: { lat: -23.215, lng: -47.524 }, status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        isClaimed: { value: null, status: "unavailable", source: "dom_selector", collectedAt: new Date().toISOString() },
        phone: { value: "(15) 99999-1234", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        website: { value: "https://barbeariadutra.com.br", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        address: { value: "R. Justino Giongo Bueno, 74", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        hours: { value: "Seg-Sáb: 09:00 - 19:00", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        rating: { value: 5.0, status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        reviewCount: { value: 178, status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        photosCount: { value: 45, status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() },
        url: { value: "https://maps.google.com/...", status: "confirmed", source: "url_param", collectedAt: new Date().toISOString() }
      },
      reviews: [],
      competitors: [],
      checklist: [],
      score: {
        version: "2.0",
        observableQualityScore: 85,
        coverageIndex: 82,
        totalCriteriaCount: 22,
        evaluatedCriteriaCount: 18,
        unobservableCriteriaCount: 4,
        status: "bom",
        breakdown: { compliantCount: 15, warningCount: 3, nonCompliantCount: 0, notEvaluableCount: 4 },
        disclaimer: "Score baseado em dados públicos."
      },
      metadata: {
        extensionVersion: "2.0.0",
        extractionDurationMs: 450,
        collectedBy: "alastre_local_inspector",
        collectionMode: "visible_public_dom"
      }
    };

    const res = validateAuditSessionEnvelope(validEnvelope);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  it("rejeita envelopes com schema inválido, sessionId ausente ou tamanho acima do limite", () => {
    // 1. Sem sessionId
    const noSession = { version: "2.0", timestamp: new Date().toISOString(), profile: {} };
    const res1 = validateAuditSessionEnvelope(noSession);
    assert.strictEqual(res1.isValid, false);
    assert.ok(res1.errors.some((e) => e.includes("sessionId")));

    // 2. Versão errada
    const badVer = { version: "1.0", sessionId: "1234567890", timestamp: new Date().toISOString(), profile: {} };
    const res2 = validateAuditSessionEnvelope(badVer);
    assert.strictEqual(res2.isValid, false);
    assert.ok(res2.errors.some((e) => e.includes("Versão do schema")));

    // 3. Payload gigante (> 500 KB)
    const giantPayload = {
      version: "2.0",
      sessionId: "1234567890-uuid",
      timestamp: new Date().toISOString(),
      profile: { name: { value: "Teste", status: "confirmed", source: "dom_selector", collectedAt: new Date().toISOString() } },
      reviews: new Array(5000).fill({ author: "Fake Reviewer".repeat(10), text: "Review gigantesca ".repeat(20) }),
      competitors: [],
      checklist: []
    };
    const res3 = validateAuditSessionEnvelope(giantPayload);
    assert.strictEqual(res3.isValid, false);
    assert.ok(res3.errors.some((e) => e.includes("excede o limite máximo")));
  });

  it("calcula o Local Score v2 separando Qualidade Observada de Cobertura da Coleta", () => {
    const mockChecklist: AuditChecklistCriterion[] = [
      // Critério observável 1 (Compliant: 10/10)
      {
        id: "c1",
        category: "identity",
        title: "Nome",
        observedValue: "Barbearia Dutra",
        evidenceStatus: "confirmed",
        evaluationStatus: "compliant",
        explanation: "OK",
        evaluationBasis: "Diretrizes",
        recommendedAction: "Nenhuma",
        scoreWeight: 10,
        pointsEarned: 10,
        isObservablePublicly: true
      },
      // Critério observável 2 (Warning: 5/10)
      {
        id: "c2",
        category: "identity",
        title: "Categorias",
        observedValue: "1 categoria",
        evidenceStatus: "confirmed",
        evaluationStatus: "warning",
        explanation: "Apenas 1",
        evaluationBasis: "Diretrizes",
        recommendedAction: "Adicionar mais",
        scoreWeight: 10,
        pointsEarned: 5,
        isObservablePublicly: true
      },
      // Critério INDISPONÍVEL (deve ser excluído do denominador, NÃO penalizar!)
      {
        id: "c3",
        category: "media",
        title: "Vídeos do Proprietário",
        observedValue: "Não identificável",
        evidenceStatus: "unavailable",
        evaluationStatus: "not_evaluable",
        explanation: "Indisponível publicamente",
        evaluationBasis: "Diretrizes",
        recommendedAction: "Subir vídeos",
        scoreWeight: 10,
        pointsEarned: 0,
        isObservablePublicly: false
      }
    ];

    const score = calculateLocalScoreV2(mockChecklist);

    // Total observável = c1 (10) + c2 (10) = 20 pontos de peso.
    // Pontos ganhos = 10 + 5 = 15.
    // Score observável = (15 / 20) * 100 = 75!
    assert.strictEqual(score.observableQualityScore, 75);
    assert.strictEqual(score.status, "bom");
    assert.strictEqual(score.totalCriteriaCount, 3);
    assert.strictEqual(score.evaluatedCriteriaCount, 2);
    assert.strictEqual(score.unobservableCriteriaCount, 1);
    // Cobertura = 2 observáveis de 3 critérios = 67%
    assert.strictEqual(score.coverageIndex, 67);
  });
});
