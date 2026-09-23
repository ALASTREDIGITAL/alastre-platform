// Domínio do DNA e Inteligência do Cliente — Alastre Platform

export type DnaGovernance = {
  responsible?: string;
  target_date?: string;
  next_action?: string;
};

export type DnaFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type DnaBusinessData = {
  name?: string;
  segment?: string;
  city?: string;
  cities?: string[] | string;
  state?: string;
  neighborhood?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram_url?: string;
  hours?: string;
  opening_date?: string;
  audience?: string;
  service_area?: string;
  description?: string;
  primary_service?: string;
  objective?: string;
  services?: string[];
  differentiators?: string[];
  additional_categories?: string[];
  tone_of_voice?: string;
  editorial_instructions?: string;
  governance?: DnaGovernance;
  faq?: DnaFaqItem[];
  [key: string]: unknown;
};

export type DnaLocalIntelligence = {
  primary_keyword?: string;
  keywords?: string[];
  priorities?: string[];
  missing_information?: string[];
  ignored_missing_items?: string[];
  competitors?: string[];
  diagnosis?: {
    score?: number;
    status?: string;
    strengths?: string[];
    priorities?: string[];
    method?: string;
  } | null;
  [key: string]: unknown;
};

export type DnaPaidMediaRules = {
  negative_keywords?: string[];
  forbidden_claims?: string[];
  daily_budget_limit?: string | number;
  target_cpa?: string | number;
  notes?: string;
  [key: string]: unknown;
};

export type DnaProfile = {
  status: "confirmed" | "needs_review" | "draft";
  version: number;
  business_data: DnaBusinessData;
  local_intelligence: DnaLocalIntelligence;
  paid_media_rules: DnaPaidMediaRules;
  source_summary?: Record<string, unknown>;
};

export type CompletenessResult = {
  percentage: number;
  filledCount: number;
  totalCount: number;
  items: Array<{
    id: string;
    label: string;
    filled: boolean;
    ignored: boolean;
    section: "identity" | "services" | "voice" | "seo";
  }>;
};

export const TONE_OF_VOICE_PRESETS = [
  {
    id: "profissional",
    name: "Profissional & Técnico",
    description: "Comunicação formal, clara, técnica e focada em credibilidade e autoridade institucional.",
  },
  {
    id: "acolhedor",
    name: "Acolhedor & Consultivo",
    description: "Comunicação calorosa, humanizada, prestativa e focada em cuidado, empatia e bem-estar do cliente.",
  },
  {
    id: "comercial",
    name: "Direto & Comercial",
    description: "Comunicação ágil, persuasiva, orientada a valor, benefícios claros e chamada para ação objetiva.",
  },
  {
    id: "descontraido",
    name: "Descontraído & Moderno",
    description: "Linguagem leve, atual, dinâmica e próxima, com tom conversacional e acessível.",
  },
  {
    id: "personalizado",
    name: "Personalizado / Exclusivo da Marca",
    description: "Diretrizes e regras específicas definidas sob medida no campo de instruções.",
  },
];

/**
 * Validação de pendências críticas que impedem a homologação oficial do DNA.
 */
export function getCriticalPendingFields(business: DnaBusinessData = {}): string[] {
  const missing: string[] = [];
  if (!business.name?.trim()) missing.push("Nome da empresa");
  if (!business.segment?.trim()) missing.push("Segmento / Categoria principal");
  if (!business.city?.trim() && (!Array.isArray(business.cities) || business.cities.length === 0)) {
    missing.push("Cidade de atuação");
  }
  if (!business.primary_service?.trim()) missing.push("Serviço principal de tração");
  if (!business.phone?.trim() && !business.whatsapp?.trim()) {
    missing.push("Contato (WhatsApp ou Telefone)");
  }
  return missing;
}

/**
 * Calcula a completude REAL do DNA com base no preenchimento efetivo dos campos vitais.
 */
export function calculateDnaCompleteness(
  business: DnaBusinessData = {},
  local: DnaLocalIntelligence = {},
  paidMedia: DnaPaidMediaRules = {}
): CompletenessResult {
  const has = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return true;
    return false;
  };

  const ignoredSet = new Set(Array.isArray(local.ignored_missing_items) ? local.ignored_missing_items : []);

  const checks = [
    { id: "name", label: "Nome da empresa", rawFilled: has(business.name), section: "identity" as const },
    { id: "segment", label: "Segmento / Ramo de atuação", rawFilled: has(business.segment), section: "identity" as const },
    { id: "city", label: "Cidade(s) atendida(s)", rawFilled: has(business.city) || has(business.cities), section: "identity" as const },
    { id: "address", label: "Endereço comercial ou área", rawFilled: has(business.address) || has(business.service_area), section: "identity" as const },
    { id: "contact", label: "Contato (WhatsApp ou Telefone)", rawFilled: has(business.whatsapp) || has(business.phone), section: "identity" as const },
    { id: "primary_service", label: "Serviço principal definido", rawFilled: has(business.primary_service), section: "services" as const },
    { id: "services_list", label: "Catálogo de serviços adicionais (pelo menos 2)", rawFilled: Array.isArray(business.services) && business.services.length >= 2, section: "services" as const },
    { id: "differentiators", label: "Diferenciais competitivos", rawFilled: Array.isArray(business.differentiators) && business.differentiators.length > 0, section: "services" as const },
    { id: "tone_of_voice", label: "Tom de voz da IA estabelecido", rawFilled: has(business.tone_of_voice), section: "voice" as const },
    { id: "guardrails", label: "Regras do que a IA NUNCA pode falar", rawFilled: has(business.editorial_instructions) || (Array.isArray(paidMedia.forbidden_claims) && paidMedia.forbidden_claims.length > 0), section: "voice" as const },
    { id: "keywords", label: "Palavra-chave principal ou secundárias", rawFilled: has(local.primary_keyword) || (Array.isArray(local.keywords) && local.keywords.length > 0), section: "seo" as const },
  ];

  const items = checks.map((c) => {
    const isIgnored = ignoredSet.has(`check_${c.id}`);
    const filled = c.rawFilled || isIgnored;
    return {
      id: c.id,
      label: c.label,
      filled,
      ignored: isIgnored,
      section: c.section,
    };
  });

  const filledCount = items.filter((c) => c.filled).length;
  const totalCount = items.length;
  const percentage = Math.round((filledCount / totalCount) * 100);

  return {
    percentage,
    filledCount,
    totalCount,
    items,
  };
}

/**
 * Monta o checklist de pendências acionável combinando missing_information com campos não preenchidos.
 */
export function buildMissingInfoChecklist(
  completeness: CompletenessResult,
  missingFromAnalysis: string[] = [],
  ignoredItems: string[] = []
): Array<{ id: string; label: string; completed: boolean; ignored: boolean; section: string }> {
  const result: Array<{ id: string; label: string; completed: boolean; ignored: boolean; section: string }> = [];
  const ignoredSet = new Set(ignoredItems);

  // Itens da completude
  for (const item of completeness.items) {
    const isIgnored = ignoredSet.has(`check_${item.id}`);
    result.push({
      id: `check_${item.id}`,
      label: item.label,
      completed: item.filled,
      ignored: isIgnored,
      section: item.section,
    });
  }

  // Itens extras sugeridos na análise da IA
  const knownLabels = new Set(completeness.items.map((i) => i.label.toLowerCase()));
  for (const rawItem of missingFromAnalysis) {
    const clean = rawItem.trim();
    if (!clean) continue;
    if (!knownLabels.has(clean.toLowerCase())) {
      const id = `missing_${clean.toLowerCase().replaceAll(/\s+/g, "_")}`;
      const isIgnored = ignoredSet.has(id);
      result.push({
        id,
        label: clean.charAt(0).toUpperCase() + clean.slice(1),
        completed: isIgnored,
        ignored: isIgnored,
        section: "geral",
      });
    }
  }

  return result;
}

/**
 * Simula exatamente como o backend compila o briefing para os agentes de IA (SEO Local e Anúncios).
 */
export function buildAiPromptPreview(
  clientName: string,
  business: DnaBusinessData,
  local: DnaLocalIntelligence,
  paidMedia: DnaPaidMediaRules
): {
  summary: string;
  rules: string[];
  contextJson: Record<string, unknown>;
} {
  const services = Array.isArray(business.services) ? business.services : [];
  const cities = Array.isArray(business.cities)
    ? business.cities.join(", ")
    : typeof business.cities === "string"
    ? business.cities
    : business.city || "Não especificada";

  const voice = business.tone_of_voice || "Padrão profissional e seguro";
  const guardrails = business.editorial_instructions || "Não inventar dados; usar somente fatos do DNA.";
  const forbidden = Array.isArray(paidMedia.forbidden_claims) ? paidMedia.forbidden_claims : [];
  const competitors = Array.isArray(local.competitors) ? local.competitors : [];
  const faq = Array.isArray(business.faq) ? business.faq : [];

  const rules: string[] = [
    "Fatos estritos: somente usar informações confirmadas no DNA.",
    `Tom de voz ativo: ${voice}.`,
    `Localidade prioritária: ${cities}.`,
    `Serviço principal de tração: ${business.primary_service || "Não definido"}.`,
  ];

  if (guardrails) {
    rules.push(`Diretriz editorial: ${guardrails}`);
  }

  if (forbidden.length > 0) {
    rules.push(`Termos e alegações proibidas: ${forbidden.join(" · ")}`);
  }

  if (competitors.length > 0) {
    rules.push(`Concorrentes diretos para diferenciação: ${competitors.join(", ")}`);
  }

  if (faq.length > 0) {
    rules.push(`Base de respostas rápidas (FAQ): ${faq.length} perguntas cadastradas.`);
  }

  const contextJson = {
    nome_empresa: clientName || business.name,
    segmento: business.segment || "—",
    cidades: cities,
    servicos: services,
    servico_principal: business.primary_service,
    diferenciais: business.differentiators ?? [],
    tom_de_voz: voice,
    diretriz_editorial: guardrails,
    proibicoes: forbidden,
    palavras_chave: local.keywords ?? [],
    palavra_chave_principal: local.primary_keyword,
    concorrentes: competitors,
    faq: faq.map((f) => ({ p: f.question, r: f.answer })),
  };

  const summary = `Cliente: ${clientName || business.name || "Sem nome"} | Segmento: ${business.segment || "—"} | Cidade: ${cities} | ${services.length} serviços | ${faq.length} FAQs.`;

  return {
    summary,
    rules,
    contextJson,
  };
}

export type CopilotType = "keywords" | "competitors" | "voice" | "faq";

export type CopilotSuggestion = {
  type: "keyword" | "competitor" | "service" | "faq";
  value: string;
  extra?: string;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  suggestions?: CopilotSuggestion[];
  provider?: "gemini" | "openai" | "local_rules";
};

export const COPILOT_CONFIGS: Record<
  CopilotType,
  {
    title: string;
    description: string;
    scopeNotice: string;
    quickPrompts: string[];
  }
> = {
  keywords: {
    title: "Copiloto de Palavras-Chave Locais",
    description: "Pesquisa intenções de busca e termos comerciais na região do cliente.",
    scopeNotice: "Escopo Estrito: Apenas palavras-chave e SEO Local para esta conta.",
    quickPrompts: [
      "Quais os termos de maior intenção de compra no meu segmento?",
      "Sugira 5 palavras-chave focadas no bairro e cidade principal.",
      "Quais palavras de urgência ou atendimento rápido funcionam bem?",
    ],
  },
  competitors: {
    title: "Rastreador de Concorrentes & Mercado",
    description: "Investiga concorrentes no Google Maps e diferenciais na região.",
    scopeNotice: "Escopo Estrito: Apenas concorrência local e posicionamento de mercado.",
    quickPrompts: [
      "Quem são os principais concorrentes no Google Maps nesta cidade?",
      "O que os concorrentes da região mais destacam em seus perfis?",
      "Sugira concorrentes diretos para eu monitorar.",
    ],
  },
  voice: {
    title: "Consultor de Tom de Voz da Marca",
    description: "Calibra a personalidade e as diretrizes editoriais da IA.",
    scopeNotice: "Escopo Estrito: Apenas identidade verbal e tom de voz.",
    quickPrompts: [
      "Como calibrar um tom que transmita autoridade sem ser frio?",
      "Sugira regras editoriais para atender clientes de classe A/B.",
    ],
  },
  faq: {
    title: "Gerador de FAQ & Respostas Rápidas",
    description: "Mapeia as dúvidas e objeções mais frequentes de clientes.",
    scopeNotice: "Escopo Estrito: Apenas perguntas e respostas frequentes do nicho.",
    quickPrompts: [
      "Quais são as 5 dúvidas mais comuns antes de contratar este serviço?",
      "Como responder objeções sobre preço e forma de pagamento?",
    ],
  },
};

/**
 * Faz o parsing de sugestões clicáveis na resposta do Copiloto.
 */
export function parseCopilotSuggestions(
  text: string,
  copilotType: CopilotType
): {
  cleanText: string;
  suggestions: CopilotSuggestion[];
} {
  const suggestions: CopilotSuggestion[] = [];
  let cleanText = text;

  // Pattern 1: Tags explícitas [ADICIONAR_PALAVRA: x] ou [ADICIONAR_CONCORRENTE: y]
  const tagRegex = /\[ADICIONAR_(PALAVRA|CONCORRENTE|SERVICO):\s*([^\]]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    const kind = match[1].toUpperCase();
    const val = match[2].trim();
    if (val) {
      const type = kind === "CONCORRENTE" ? "competitor" : kind === "SERVICO" ? "service" : "keyword";
      if (!suggestions.some((s) => s.value.toLowerCase() === val.toLowerCase())) {
        suggestions.push({ type, value: val });
      }
    }
  }

  // Remove as tags do texto visível e limpa marcadores de lista órfãos
  cleanText = cleanText
    .replace(tagRegex, "")
    .replace(/^\s*[-*•]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Pattern 2: Se não usou tags explícitas, mas usou lista com termos em negrito
  if (suggestions.length === 0) {
    const boldListRegex = /^\s*[-*•]\s*\*\*([^*]+)\*\*/gm;
    let boldMatch: RegExpExecArray | null;
    while ((boldMatch = boldListRegex.exec(text)) !== null) {
      const val = boldMatch[1].trim();
      if (val.length >= 3 && val.length <= 80 && !val.includes(":") && !val.toLowerCase().startsWith("obs")) {
        const type = copilotType === "competitors" ? "competitor" : "keyword";
        if (!suggestions.some((s) => s.value.toLowerCase() === val.toLowerCase())) {
          suggestions.push({ type, value: val });
        }
      }
    }
  }

  return { cleanText, suggestions };
}
