/**
 * Alastre Platform - Contratos Tipados e Versionados para Pré-Análise & Auditoria de Perfil Google
 * Versão do Schema: 2.0.0
 * 
 * Separação estrita entre:
 * 1. Dado Encontrado (Observação Bruta + Status de Evidência)
 * 2. Conclusão Validada (Avaliação Estratégica + Conformidade com Diretrizes)
 */

/**
 * Status de Evidência da Coleta:
 * - confirmed: Elemento localizado explicitamente no DOM com seletor comprovado.
 * - inferred: Derivado deterministicamente a partir de dados confirmados (ex: contagem de itens de lista).
 * - not_found: Seletor executado, mas elemento não encontrado no DOM visível. Ausência no DOM não prova ausência no perfil.
 * - unavailable: Dado privado, métrica histórica ou recurso não exposto publicamente no Maps.
 * - demo: Dados ilustrativos de demonstração.
 */
export type EvidenceStatus = "confirmed" | "inferred" | "not_found" | "unavailable" | "demo";

/**
 * Status da Conclusão / Avaliação:
 * - compliant: Atende às boas práticas e diretrizes públicas do Google.
 * - warning: Oportunidade de melhoria ou atenção estratégica.
 * - non_compliant: Violação evidente de diretrizes ou falha grave de configuração.
 * - not_evaluable: Não avaliável devido à ausência de dados públicos ou histórico.
 */
export type EvaluationStatus = "compliant" | "warning" | "non_compliant" | "not_evaluable";

/**
 * Campo de Auditoria com Rastreabilidade Completa
 */
export interface AuditedField<T> {
  value: T | null;
  status: EvidenceStatus;
  source: "dom_selector" | "url_param" | "computed" | "fixture";
  evidenceSnippet?: string;
  collectedAt: string; // ISO 8601
  notes?: string;
}

/**
 * Perfil Auditado Fidedigno
 */
export interface AuditedProfile {
  name: AuditedField<string>;
  primaryCategory: AuditedField<string>;
  secondaryCategories: AuditedField<string[]>;
  cid: AuditedField<string>;
  placeId: AuditedField<string>;
  coordinates: AuditedField<{ lat: number; lng: number }>;
  isClaimed: AuditedField<boolean>; // null com status 'unavailable' quando não houver botão nem selo
  phone: AuditedField<string>;
  website: AuditedField<string>;
  address: AuditedField<string>;
  hours: AuditedField<string>;
  rating: AuditedField<number>;
  reviewCount: AuditedField<number>;
  photosCount: AuditedField<number>;
  url: AuditedField<string>;
}

/**
 * Avaliação Individual Coletada
 */
export interface AuditedReviewItem {
  id: string;
  author: string;
  rating: number; // 1 a 5
  text: string;
  hasOwnerReply: boolean;
  ownerReplyText?: string;
  relativePublishDate?: string;
  isLocalGuide?: boolean;
  hasImages?: boolean;
  collectedAt: string;
}

/**
 * Concorrente Coletado na Mesma Busca
 */
export interface AuditedCompetitorItem {
  name: string;
  rating: number | null;
  reviewsCount: number | null;
  category?: string;
  address?: string;
  coordinates?: { lat: number; lng: number } | null;
  rankInVisibleSample: number; // Posição na amostra visível (ex: 1º de 20)
  isCurrentClient?: boolean;
  distanceKm?: number | null; // Apenas calculada se ambas coordenadas existirem
}

/**
 * Critério Individual do Checklist de Auditoria (22 Critérios)
 */
export interface AuditChecklistCriterion {
  id: string;
  category: "identity" | "contact" | "media" | "reputation" | "engagement";
  title: string;
  observedValue: string | number | boolean | null;
  evidenceStatus: EvidenceStatus;
  evaluationStatus: EvaluationStatus;
  explanation: string;
  evaluationBasis: string; // Base normativa ou recomendação do Google
  recommendedAction: string;
  scoreWeight: number; // Peso para o score observável
  pointsEarned: number; // Pontos obtidos (0 a scoreWeight)
  isObservablePublicly: boolean; // Se false, excluído do denominador do score
}

/**
 * Sumário do Local Score v2
 */
export interface LocalScoreSummary {
  version: "2.0";
  observableQualityScore: number; // 0 a 100 baseado apenas nos observáveis
  coverageIndex: number; // 0 a 100% de critérios observáveis no momento da coleta
  totalCriteriaCount: number;
  evaluatedCriteriaCount: number;
  unobservableCriteriaCount: number;
  status: "bom" | "razoavel" | "fraco";
  breakdown: {
    compliantCount: number;
    warningCount: number;
    nonCompliantCount: number;
    notEvaluableCount: number;
  };
  disclaimer: string;
}

/**
 * Envelope Seguro de Sessão de Auditoria (Transferência Extensão ➔ Plataforma)
 */
export interface AuditSessionEnvelope {
  version: "2.0";
  sessionId: string; // UUID v4
  timestamp: string; // ISO 8601
  sourceUrl: string;
  searchContext?: {
    query?: string;
    locationLabel?: string;
    sampleSize?: number;
  };
  profile: AuditedProfile;
  reviews: AuditedReviewItem[];
  competitors: AuditedCompetitorItem[];
  checklist: AuditChecklistCriterion[];
  score: LocalScoreSummary;
  metadata: {
    extensionVersion: string;
    extractionDurationMs: number;
    collectedBy: "alastre_local_inspector";
    collectionMode: "visible_public_dom";
  };
}

/**
 * Mensagem de Handshake Seguro da Ponte (Bridge)
 */
export interface SecureBridgeHandshakeRequest {
  type: "ALASTRE_CLAIM_AUDIT_SESSION";
  sessionId: string;
  transferToken: string;
  targetOrigin: string;
}

export interface SecureBridgeHandshakeResponse {
  type: "ALASTRE_AUDIT_SESSION_DELIVERED";
  success: boolean;
  sessionId: string;
  envelope?: AuditSessionEnvelope;
  error?: string;
}
