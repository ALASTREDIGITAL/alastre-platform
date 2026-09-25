export const profileAuditCatalog = [
  ["name", "Nome"],
  ["primary_category", "Categoria principal"],
  ["additional_categories", "Categorias adicionais"],
  ["description", "Descrição"],
  ["phone", "Telefone"],
  ["website", "Website"],
  ["address", "Endereço / área"],
  ["hours", "Horários"],
  ["special_hours", "Horários especiais"],
  ["services", "Serviços"],
  ["products", "Produtos"],
  ["attributes", "Atributos"],
  ["photos", "Fotos"],
  ["logo", "Logo"],
  ["cover", "Capa"],
  ["links", "Links"],
  ["questions", "Perguntas e respostas"],
  ["completeness", "Completude geral"],
] as const;

export const dataOrigins = [
  "provider",
  "manual",
  "evidence",
  "inference",
  "hypothesis",
  "unavailable",
] as const;

export type DataOrigin = (typeof dataOrigins)[number];

export const dataOriginLabels: Record<DataOrigin, string> = {
  provider: "Provedor (API)",
  manual: "Manual (Operador)",
  evidence: "Evidência documental",
  inference: "Inferência (DNA)",
  hypothesis: "Hipótese de melhoria",
  unavailable: "Indisponível (N/D)",
};

export const localScoreWeights = {
  profile: 20,
  relevance: 15,
  reputation: 20,
  content: 15,
  authority: 10,
  local_presence: 10,
  conversion: 10,
} as const;

export const opportunityCategories = [
  "Perfil",
  "Avaliações",
  "Conteúdo",
  "Palavras-chave",
  "Concorrência",
  "Conversão",
  "Autoridade",
  "Presença Local",
] as const;

export const keywordIntents = [
  "Transacional",
  "Comercial",
  "Local",
  "Informacional",
  "Marca",
] as const;

export const dataConfidenceLabels = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  none: "Sem evidência",
} as const;

export type LocalRankProviderStatus =
  | "not_configured"
  | "ready"
  | "syncing"
  | "healthy"
  | "error";

export interface LocalRankProvider {
  readonly status: LocalRankProviderStatus;
  readonly name: string | null;
}

export const unconfiguredLocalRankProvider: LocalRankProvider = {
  status: "not_configured",
  name: null,
};

export const defaultCitationsCatalog = [
  { directory_name: "Google Maps / Business Profile", category: "Maps / Provedor Principal" },
  { directory_name: "Apple Maps / Business Connect", category: "Maps / Mobile" },
  { directory_name: "Apontador", category: "Diretório Local BR" },
  { directory_name: "Yelp Brasil", category: "Diretório / Avaliações" },
  { directory_name: "Guia Mais", category: "Diretório de Negócios" },
  { directory_name: "TeleListas", category: "Diretório Comercial" },
  { directory_name: "Facebook Page", category: "Redes Sociais" },
  { directory_name: "Instagram Business", category: "Redes Sociais" },
  { directory_name: "Bing Places", category: "Motor de Busca" },
] as const;

export const NO_RANKING_PROMISE_DISCLAIMER =
  "O posicionamento no Local Pack e no Google Maps é determinado exclusivamente pelos algoritmos do Google com base em relevância, distância e proeminência. A Alastre Platform executa melhorias operacionais auditáveis e fundamentadas em evidências, porém NUNCA garante posições específicas, volume exato de leads, conversões ou vendas.";

export const WRITE_MODE_DISABLED_DISCLAIMER =
  "Modo de escrita externa desativado (ALASTRE_WRITE_MODE=disabled). Todas as postagens, respostas e alterações de perfil permanecem em rascunho ou pendentes de aprovação na Alastre Platform e NÃO são enviadas ao Google.";
