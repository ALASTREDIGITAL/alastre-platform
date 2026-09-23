/**
 * Alastre Platform - Verificador e Validador de Sessões de Auditoria v2.0
 * Garante validação de payload, limites de tamanho, retenção e conformidade.
 */

import type {
  AuditSessionEnvelope,
  AuditChecklistCriterion,
  LocalScoreSummary,
  EvidenceStatus,
  EvaluationStatus
} from "./pre-audit-types.ts";

export const MAX_ENVELOPE_SIZE_BYTES = 500 * 1024; // 500 KB
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas de retenção na plataforma
export const TRANSFER_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos para transferência inicial

export const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:(3000|5173|5174|5175)$/,
  /^http:\/\/127\.0\.0\.1:(3000|5173|5174|5175)$/,
  /^https:\/\/[a-z0-9-]+\.alastre\.digital$/,
  /^https:\/\/alastre\.digital$/,
  /^https:\/\/[a-z0-9-]+\.alastre\.com$/,
  /^https:\/\/alastre\.com$/
];

/**
 * Valida se uma origem web pertence à allowlist oficial da Alastre Platform
 */
export function isAllowedOrigin(origin: string): boolean {
  if (!origin || typeof origin !== "string") return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Valida a integridade estrutural e de segurança do AuditSessionEnvelope v2.0
 */
export function validateAuditSessionEnvelope(envelope: unknown): ValidationResult {
  const errors: string[] = [];

  if (!envelope || typeof envelope !== "object") {
    return { isValid: false, errors: ["Envelope de sessão deve ser um objeto."] };
  }

  const env = envelope as Partial<AuditSessionEnvelope>;

  if (env.version !== "2.0") {
    errors.push(`Versão do schema incompatível. Esperado: '2.0', recebido: '${env.version}'.`);
  }

  if (!env.sessionId || typeof env.sessionId !== "string" || env.sessionId.trim().length < 10) {
    errors.push("sessionId ausente ou inválido no envelope.");
  }

  if (!env.timestamp || isNaN(Date.parse(env.timestamp))) {
    errors.push("Timestamp da auditoria inválido ou ausente.");
  }

  if (!env.profile || typeof env.profile !== "object") {
    errors.push("Objeto de perfil auditado (profile) ausente.");
  } else {
    if (!env.profile.name || typeof env.profile.name !== "object" || !env.profile.name.status) {
      errors.push("Campo obrigatório profile.name ausente ou sem especificação de evidência.");
    }
  }

  if (!Array.isArray(env.reviews)) {
    errors.push("Lista de avaliações (reviews) deve ser um array.");
  }

  if (!Array.isArray(env.competitors)) {
    errors.push("Lista de concorrentes (competitors) deve ser um array.");
  }

  if (!Array.isArray(env.checklist)) {
    errors.push("Checklist de critérios deve ser um array.");
  }

  // Validação de tamanho serializado
  try {
    const serialized = JSON.stringify(envelope);
    if (serialized.length > MAX_ENVELOPE_SIZE_BYTES) {
      errors.push(
        `Tamanho do envelope (${(serialized.length / 1024).toFixed(1)} KB) excede o limite máximo permitido de ${MAX_ENVELOPE_SIZE_BYTES / 1024} KB.`
      );
    }
  } catch (e) {
    errors.push("Erro ao serializar envelope para validação de tamanho.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calcula o Local Score v2 separando Qualidade Observada de Cobertura
 */
export function calculateLocalScoreV2(checklist: AuditChecklistCriterion[]): LocalScoreSummary {
  let totalObservableWeight = 0;
  let earnedObservablePoints = 0;
  let observableCount = 0;
  let unobservableCount = 0;

  let compliantCount = 0;
  let warningCount = 0;
  let nonCompliantCount = 0;
  let notEvaluableCount = 0;

  for (const criterion of checklist) {
    if (criterion.isObservablePublicly && criterion.evidenceStatus !== "unavailable") {
      observableCount++;
      totalObservableWeight += criterion.scoreWeight;
      earnedObservablePoints += criterion.pointsEarned;
    } else {
      unobservableCount++;
    }

    switch (criterion.evaluationStatus) {
      case "compliant":
        compliantCount++;
        break;
      case "warning":
        warningCount++;
        break;
      case "non_compliant":
        nonCompliantCount++;
        break;
      case "not_evaluable":
        notEvaluableCount++;
        break;
    }
  }

  // Score de 0 a 100 baseado apenas nos critérios observáveis
  const observableQualityScore =
    totalObservableWeight > 0 ? Math.round((earnedObservablePoints / totalObservableWeight) * 100) : 0;

  // Índice de Cobertura: percentual de critérios que puderam ser inspecionados
  const coverageIndex =
    checklist.length > 0 ? Math.round((observableCount / checklist.length) * 100) : 0;

  const status: "bom" | "razoavel" | "fraco" =
    observableQualityScore >= 75 ? "bom" : observableQualityScore >= 50 ? "razoavel" : "fraco";

  return {
    version: "2.0",
    observableQualityScore,
    coverageIndex,
    totalCriteriaCount: checklist.length,
    evaluatedCriteriaCount: observableCount,
    unobservableCriteriaCount: unobservableCount,
    status,
    breakdown: {
      compliantCount,
      warningCount,
      nonCompliantCount,
      notEvaluableCount
    },
    disclaimer:
      "Este score avalia a conformidade do perfil com base nos dados públicos observáveis no momento da coleta e não garante ranqueamento ou posições específicas no algoritmo do Google."
  };
}
