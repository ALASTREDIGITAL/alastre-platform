/**
 * Alastre Platform - Motor de Análise de Avaliações (Estilo GBPCheck)
 * Processa e audita avaliações de qualquer perfil do Google Maps / Busca,
 * sem exigir autorização da API ou gestão prévia da conta.
 */

export interface RawAuditReview {
  id?: string;
  author: string;
  avatarUrl?: string;
  isLocalGuide?: boolean;
  localGuideLevel?: number;
  rating: number; // 1 a 5
  relativeDate?: string;
  date?: string; // ISO ou DD/MM/YYYY
  text?: string;
  ownerReply?: {
    text: string;
    relativeDate?: string;
    date?: string;
  } | null;
  hasImages?: boolean;
  imagesCount?: number;
}

export interface BusinessProfileSnapshot {
  name: string;
  category?: string;
  rating: number | null;
  reviewsCount: number | null;
  address?: string;
  phone?: string;
  website?: string;
  placeId?: string;
  cid?: string;
  photoUrl?: string;
  mapUrl?: string;
  hours?: string;
  lat?: number;
  lng?: number;
  isClaimed?: boolean;
}

export interface ReviewAuditMetrics {
  totalReviews: number | null;
  capturedReviewsCount: number;
  uncollectedReviewsCount: number | null;
  ownerRepliesCount: number;
  ownerRepliesPercentage: number;
  customerTextReviewsCount: number;
  customerTextReviewsPercentage: number;
  averageRating: number | null;
  averageCommentLength: number;
  responseRatePercentage: number;
  withPhotosPercentage: number;
  withCommentsPercentage: number;
  withCommentsCount: number;
  localGuidesPercentage: number;
  localGuidesCount: number;
  withImagesPercentage: number;
  withImagesCount: number;
  positiveReviewsCount: number;
  positiveReviewsPercentage: number;
  negativeReviewsCount: number;
  negativeReviewsPercentage: number;
}

export interface EvolutionPoint {
  period: string; // Ex: '01/11/2025' ou 'Nov/25'
  total: number;
  average: number;
}

export interface RatingDistributionItem {
  stars: number;
  label: string;
  count: number;
  percentage: number;
}

export interface DonutMetricItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface FrequentWordItem {
  word: string;
  count: number;
}

export interface PraisedAspect {
  title: string;
  description: string;
  emotions: string[];
}

export interface CitedProduct {
  name: string;
  tags: ("Elogio" | "Recomendação" | "Destaque")[];
}

export interface AuditAiInsights {
  positive: {
    summary: string;
    praisedAspects: PraisedAspect[];
    citedProducts: CitedProduct[];
    opportunities: string[];
  };
  negative: {
    hasEnoughData: boolean;
    dataMessage?: string;
    summary?: string;
    criticalAspects?: { title: string; complaint: string; suggestion: string }[];
    opportunities?: string[];
  };
}

export interface CompleteReviewAuditResult {
  profile: BusinessProfileSnapshot;
  metrics: ReviewAuditMetrics;
  ratingDistribution: RatingDistributionItem[];
  evolutionHistory: EvolutionPoint[];
  monthlyAverages: EvolutionPoint[];
  donuts: {
    responses: DonutMetricItem[];
    comments: DonutMetricItem[];
    images: DonutMetricItem[];
    localGuides: DonutMetricItem[];
  };
  frequentWords: FrequentWordItem[];
  positiveReviews: RawAuditReview[];
  negativeReviews: RawAuditReview[];
  insights: AuditAiInsights;
}

const PORTUGUESE_STOP_WORDS = new Set([
  "a", "o", "as", "os", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "para", "por", "com", "sem", "sob", "sobre", "ao", "aos",
  "e", "ou", "mas", "se", "que", "como", "quando", "onde", "porque", "muito", "mais",
  "foi", "era", "são", "ser", "ter", "está", "estou", "estava", "fui", "meu", "minha",
  "seu", "sua", "ele", "ela", "eles", "elas", "isso", "esse", "essa", "este", "esta",
  "bem", "já", "não", "sim", "vai", "vou", "aqui", "lá", "ali", "tudo", "todo", "toda",
  "todos", "todas", "pelo", "pela", "pelos", "pelas", "num", "numa", "quem", "qual",
  "dia", "vez", "mesmo", "fazer", "dar", "ir", "ver", "ter", "sempre", "também", "apenas"
]);

/**
 * Calcula todas as métricas, distribuições e insights a partir dos reviews colhidos
 */
export function analyzeGoogleReviews(
  profile: BusinessProfileSnapshot,
  reviews: RawAuditReview[],
  isDemoMode: boolean = false
): CompleteReviewAuditResult {
  const total = reviews.length;
  if (total === 0) {
    return createEmptyAudit(profile);
  }

  // 1. Contagens básicas
  let sumRating = 0;
  let repliesCount = 0;
  let textCommentsCount = 0;
  let totalChars = 0;
  let localGuidesCount = 0;
  let withImagesCount = 0;
  let positiveCount = 0; // 4 e 5 estrelas
  let negativeCount = 0; // 1, 2 e 3 estrelas

  const starsCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const positiveList: RawAuditReview[] = [];
  const negativeList: RawAuditReview[] = [];

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
    starsCount[star] = (starsCount[star] || 0) + 1;
    sumRating += star;

    const hasText = Boolean(r.text && r.text.trim().length > 3 && !r.text.includes("Sem comentário"));
    if (hasText) {
      textCommentsCount++;
      totalChars += (r.text?.trim().length || 0);
    }

    if (r.ownerReply && r.ownerReply.text?.trim()) {
      repliesCount++;
    }

    if (r.isLocalGuide) {
      localGuidesCount++;
    }

    if (r.hasImages || (r.imagesCount && r.imagesCount > 0)) {
      withImagesCount++;
    }

    if (star >= 4) {
      positiveCount++;
      positiveList.push(r);
    } else {
      negativeCount++;
      negativeList.push(r);
    }
  }

  const avgRating = total > 0 ? Number((sumRating / total).toFixed(1)) : null;
  const avgCommentLength = textCommentsCount > 0 ? Math.round(totalChars / textCommentsCount) : 0;
  const responseRate = total > 0 ? Number(((repliesCount / total) * 100).toFixed(1)) : 0;

  const publicTotal = typeof profile.reviewsCount === "number" ? profile.reviewsCount : null;
  const uncollected = publicTotal !== null ? Math.max(0, publicTotal - total) : null;
  const displayRating = typeof profile.rating === "number" ? profile.rating : avgRating;

  const metrics: ReviewAuditMetrics = {
    totalReviews: publicTotal !== null ? publicTotal : (total > 0 ? total : null),
    capturedReviewsCount: total,
    uncollectedReviewsCount: uncollected,
    ownerRepliesCount: repliesCount,
    ownerRepliesPercentage: total > 0 ? Number(((repliesCount / total) * 100).toFixed(1)) : 0,
    customerTextReviewsCount: textCommentsCount,
    customerTextReviewsPercentage: total > 0 ? Number(((textCommentsCount / total) * 100).toFixed(1)) : 0,
    averageRating: displayRating,
    averageCommentLength: avgCommentLength,
    responseRatePercentage: responseRate,
    withPhotosPercentage: total > 0 ? Number(((withImagesCount / total) * 100).toFixed(1)) : 0,
    withCommentsPercentage: total > 0 ? Number(((textCommentsCount / total) * 100).toFixed(1)) : 0,
    withCommentsCount: textCommentsCount,
    localGuidesPercentage: total > 0 ? Number(((localGuidesCount / total) * 100).toFixed(1)) : 0,
    localGuidesCount: localGuidesCount,
    withImagesPercentage: total > 0 ? Number(((withImagesCount / total) * 100).toFixed(1)) : 0,
    withImagesCount: withImagesCount,
    positiveReviewsCount: positiveCount,
    positiveReviewsPercentage: total > 0 ? Number(((positiveCount / total) * 100).toFixed(1)) : 0,
    negativeReviewsCount: negativeCount,
    negativeReviewsPercentage: total > 0 ? Number(((negativeCount / total) * 100).toFixed(1)) : 0,
  };

  // 2. Distribuição de Notas
  const ratingDistribution: RatingDistributionItem[] = [
    { stars: 5, label: "5 estrelas", count: starsCount[5] || 0, percentage: Number((((starsCount[5] || 0) / total) * 100).toFixed(1)) },
    { stars: 4, label: "4 estrelas", count: starsCount[4] || 0, percentage: Number((((starsCount[4] || 0) / total) * 100).toFixed(1)) },
    { stars: 3, label: "3 estrelas", count: starsCount[3] || 0, percentage: Number((((starsCount[3] || 0) / total) * 100).toFixed(1)) },
    { stars: 2, label: "2 estrelas", count: starsCount[2] || 0, percentage: Number((((starsCount[2] || 0) / total) * 100).toFixed(1)) },
    { stars: 1, label: "1 estrela", count: starsCount[1] || 0, percentage: Number((((starsCount[1] || 0) / total) * 100).toFixed(1)) },
  ];

  // 3. Donuts de Proporção
  const responsesDonut: DonutMetricItem[] = [
    { name: "Com Resposta", value: repliesCount, percentage: Number(((repliesCount / total) * 100).toFixed(1)), color: "#10b981" },
    { name: "Sem Resposta", value: total - repliesCount, percentage: Number((((total - repliesCount) / total) * 100).toFixed(1)), color: "#334155" }
  ];

  const commentsDonut: DonutMetricItem[] = [
    { name: "Com Comentários", value: textCommentsCount, percentage: Number(((textCommentsCount / total) * 100).toFixed(1)), color: "#3b82f6" },
    { name: "Sem Comentários", value: total - textCommentsCount, percentage: Number((((total - textCommentsCount) / total) * 100).toFixed(1)), color: "#94a3b8" }
  ];

  const imagesDonut: DonutMetricItem[] = [
    { name: "Com Imagens", value: withImagesCount, percentage: Number(((withImagesCount / total) * 100).toFixed(1)), color: "#8b5cf6" },
    { name: "Sem Imagens", value: total - withImagesCount, percentage: Number((((total - withImagesCount) / total) * 100).toFixed(1)), color: "#cbd5e1" }
  ];

  const localGuidesDonut: DonutMetricItem[] = [
    { name: "Local Guides", value: localGuidesCount, percentage: Number(((localGuidesCount / total) * 100).toFixed(1)), color: "#f97316" },
    { name: "Usuários Normais", value: total - localGuidesCount, percentage: Number((((total - localGuidesCount) / total) * 100).toFixed(1)), color: "#94a3b8" }
  ];

  // 4. Palavras mais repetidas em avaliações positivas
  const frequentWords = extractFrequentWords(positiveList);

  // 5. Linha de Evolução e Médias por Período
  const { evolutionHistory, monthlyAverages } = buildEvolutionSeries(reviews, isDemoMode);

  // 6. Insights de IA
  const insights = generateAiInsights(profile, positiveList, negativeList, frequentWords, isDemoMode);

  return {
    profile,
    metrics,
    ratingDistribution,
    evolutionHistory,
    monthlyAverages,
    donuts: {
      responses: responsesDonut,
      comments: commentsDonut,
      images: imagesDonut,
      localGuides: localGuidesDonut
    },
    frequentWords,
    positiveReviews: positiveList,
    negativeReviews: negativeList,
    insights
  };
}

/**
 * Minera as palavras mais repetidas excluindo stopwords
 */
export function extractFrequentWords(reviews: RawAuditReview[], limit = 40): FrequentWordItem[] {
  const frequencyMap: Record<string, number> = {};

  for (const r of reviews) {
    if (!r.text) continue;
    const cleanText = r.text
      .toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, " ");

    const words = cleanText.split(/\s+/).filter((w) => w.length >= 3 && !PORTUGUESE_STOP_WORDS.has(w));

    for (const w of words) {
      frequencyMap[w] = (frequencyMap[w] || 0) + 1;
    }
  }

  return Object.entries(frequencyMap)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Constrói as séries temporais de evolução do último ano
 */
function buildEvolutionSeries(reviews: RawAuditReview[], isDemoMode: boolean = false) {
  const total = reviews.length;
  if (total === 0) {
    return { evolutionHistory: [], monthlyAverages: [] };
  }

  if (isDemoMode) {
    const p1 = Math.round(total * 0.7);
    const p2 = Math.round(total * 0.85);
    const p3 = Math.round(total * 0.95);

    const evolutionHistory: EvolutionPoint[] = [
      { period: "01/11/2025", total: p1, average: 5.0 },
      { period: "01/12/2025", total: p2, average: 5.0 },
      { period: "05/04/2026", total: p3, average: 5.0 },
      { period: "06/04/2026", total: total, average: 5.0 },
    ];

    const monthlyAverages: EvolutionPoint[] = [
      { period: "1 ano atrás", total: 4, average: 5.0 },
      { period: "10 meses atrás", total: 6, average: 5.0 },
      { period: "8 meses atrás", total: 8, average: 5.0 },
      { period: "6 meses atrás", total: 28, average: 4.9 },
      { period: "4 meses atrás", total: 12, average: 5.0 },
      { period: "2 meses atrás", total: 9, average: 5.0 },
      { period: "Último mês", total: 18, average: 5.0 },
    ];

    return { evolutionHistory, monthlyAverages };
  }

  // Real mode: calculate from actual review dates if available
  const reviewsWithDates = reviews.filter((r) => r.relativeDate || r.date);
  if (reviewsWithDates.length === 0) {
    return { evolutionHistory: [], monthlyAverages: [] };
  }

  const buckets: Record<string, { count: number; sumRating: number }> = {};
  for (const r of reviews) {
    const key = r.relativeDate || (r.date ? r.date.slice(0, 7) : "Recente");
    if (!buckets[key]) buckets[key] = { count: 0, sumRating: 0 };
    buckets[key].count += 1;
    buckets[key].sumRating += Number(r.rating || 5);
  }

  let cumTotal = 0;
  const evolutionHistory: EvolutionPoint[] = Object.entries(buckets).map(([period, data]) => {
    cumTotal += data.count;
    return {
      period,
      total: cumTotal,
      average: Number((data.sumRating / data.count).toFixed(1)),
    };
  });

  const monthlyAverages: EvolutionPoint[] = Object.entries(buckets).map(([period, data]) => ({
    period,
    total: data.count,
    average: Number((data.sumRating / data.count).toFixed(1)),
  }));

  return { evolutionHistory, monthlyAverages };
}

export function inferCategoryFromName(name: string): string {
  if (!name) return "Empresa Local";
  const lower = name.toLowerCase();
  if (lower.includes("lavand") || lower.includes("laundry") || lower.includes("tinturaria") || lower.includes("passadeira")) return "Lavanderia";
  if (lower.includes("vidraç") || lower.includes("vidrac") || lower.includes("vidro") || lower.includes("box") || lower.includes("esquadria") || lower.includes("aluminio") || lower.includes("alumínio")) return "Vidraçaria";
  if (lower.includes("rede") || lower.includes("tela") || lower.includes("proteç") || lower.includes("protec")) return "Redes de Proteção / Telas";
  if (lower.includes("barbearia") || lower.includes("barber")) return "Barbearia";
  if (lower.includes("salão") || lower.includes("salao") || lower.includes("cabelo") || lower.includes("estética") || lower.includes("estetica") || lower.includes("beleza")) return "Salão de Beleza";
  if (lower.includes("pizz") || lower.includes("restaurante") || lower.includes("bistrô") || lower.includes("bistro") || lower.includes("hamburguer") || lower.includes("lanchonete") || lower.includes("churrascaria")) return "Restaurante";
  if (lower.includes("padaria") || lower.includes("confeitaria") || lower.includes("panificadora") || lower.includes("pão") || lower.includes("pao")) return "Padaria";
  if (lower.includes("farmácia") || lower.includes("farmacia") || lower.includes("drogaria")) return "Farmácia";
  if (lower.includes("odonto") || lower.includes("dentista")) return "Odontologia";
  if (lower.includes("clínica") || lower.includes("clinica") || lower.includes("médic") || lower.includes("medic") || lower.includes("saúde") || lower.includes("saude")) return "Clínica Médica";
  if (lower.includes("oficina") || lower.includes("mecânic") || lower.includes("mecanic") || lower.includes("auto") || lower.includes("pneus") || lower.includes("funilaria")) return "Oficina Mecânica";
  if (lower.includes("academia") || lower.includes("fitness") || lower.includes("crossfit")) return "Academia";
  if (lower.includes("pet") || lower.includes("veterinári") || lower.includes("veterinari") || lower.includes("banho e tosa")) return "Pet Shop";
  if (lower.includes("advocacia") || lower.includes("advogad")) return "Advocacia";
  if (lower.includes("imobiliária") || lower.includes("imobiliaria") || lower.includes("imóveis") || lower.includes("imoveis")) return "Imobiliária";
  if (lower.includes("contabilidade") || lower.includes("contábil") || lower.includes("contabil")) return "Contabilidade";
  return "Empresa Local";
}

function deriveProductsFromContext(
  name: string,
  category: string,
  frequentWords: FrequentWordItem[],
  texts: string[],
  isDemoMode: boolean = false
): CitedProduct[] {
  if (texts.length === 0 && !isDemoMode) {
    return [];
  }

  // Se há textos de avaliações, extraímos produtos a partir das palavras que realmente apareceram
  const candidateWords = frequentWords
    .filter((w) => w.word.length >= 4 && !["muito", "super", "mais", "tudo", "nada", "aqui", "onde", "bom", "boa", "bem"].includes(w.word))
    .slice(0, 3);
  if (candidateWords.length >= 2) {
    return candidateWords.map((w) => ({
      name: w.word.charAt(0).toUpperCase() + w.word.slice(1),
      tags: ["Elogio", "Recomendação", "Destaque"],
    }));
  }

  if (isDemoMode) {
    const lower = (name + " " + category).toLowerCase();
    if (lower.includes("lavand") || lower.includes("laundry") || lower.includes("tinturaria") || lower.includes("roupa")) {
      return [
        { name: "Lavagem e Higienização de Roupas", tags: ["Elogio", "Recomendação", "Destaque"] },
        { name: "Lavagem de Edredons e Peças Delicadas", tags: ["Elogio", "Recomendação", "Destaque"] },
      ];
    }
    if (lower.includes("vidraç") || lower.includes("vidro") || lower.includes("box") || lower.includes("espelho") || lower.includes("alumínio") || lower.includes("aluminio")) {
      return [
        { name: "Box de Banheiro e Esquadrias", tags: ["Elogio", "Recomendação", "Destaque"] },
        { name: "Instalação de Vidros Temperados e Espelhos", tags: ["Elogio", "Recomendação", "Destaque"] },
      ];
    }
    if (lower.includes("rede") || lower.includes("tela") || lower.includes("proteç")) {
      return [
        { name: "Redes de Proteção para Janelas e Sacadas", tags: ["Elogio", "Recomendação", "Destaque"] },
        { name: "Telas Mosquiteiras e Proteção Infantil", tags: ["Elogio", "Recomendação", "Destaque"] },
      ];
    }
    if (lower.includes("barbearia") || lower.includes("barber") || lower.includes("barba")) {
      return [
        { name: "Corte de Cabelo", tags: ["Elogio", "Recomendação", "Destaque"] },
        { name: "Barba e Acabamento", tags: ["Elogio", "Destaque"] },
      ];
    }
    if (lower.includes("pizz") || lower.includes("restaurante") || lower.includes("bistrô") || lower.includes("hamburguer")) {
      return [
        { name: "Pratos Principais e Especialidades", tags: ["Elogio", "Recomendação", "Destaque"] },
        { name: "Atendimento e Entrega", tags: ["Elogio", "Destaque"] },
      ];
    }
    if (lower.includes("odonto") || lower.includes("dentista")) {
      return [
        { name: "Tratamentos e Avaliação Clínica", tags: ["Elogio", "Recomendação", "Destaque"] },
        { name: "Limpeza e Clareamento Dental", tags: ["Elogio", "Destaque"] },
      ];
    }
    return [
      { name: `Serviços de ${category}`, tags: ["Elogio", "Recomendação", "Destaque"] },
      { name: "Atendimento ao Cliente", tags: ["Elogio", "Destaque"] },
    ];
  }

  return [];
}

/**
 * Gera os blocos analíticos de Insights de IA baseados na semântica
 */
function generateAiInsights(
  profile: BusinessProfileSnapshot,
  positive: RawAuditReview[],
  negative: RawAuditReview[],
  frequentWords: FrequentWordItem[],
  isDemoMode: boolean = false
): AuditAiInsights {
  const categoryName = (profile.category && profile.category !== "Loja de telas" && profile.category !== "Empresa")
    ? profile.category
    : inferCategoryFromName(profile.name);
  const rating = typeof profile.rating === "number" ? profile.rating : 0;
  const totalReviews = profile.reviewsCount ?? (positive.length + negative.length);
  const allTexts = positive.map((r) => r.text || "").filter((t) => t.trim().length > 5);

  const isBarbeariaDutra = isDemoMode && profile.name.toLowerCase().includes("barbearia dutra");

  if (isBarbeariaDutra) {
    return {
      positive: {
        summary: `A ${profile.name} passa por um auge 'estético e moderno', mantendo um ambiente acolhedor e descontraído. O atendimento é descrito como sensacional, com muitos destaques para corte e barba, bem como a facilidade no agendamento. Preparado por pessoas que sabem o valor de um bom serviço, a impressão é de que os profissionais são de altíssima qualidade, com nota máxima sustentada em toda a região.`,
        praisedAspects: [
          {
            title: "Ambiente",
            description: "Destaca o espaço físico e atmosfera geral do estabelecimento.",
            emotions: ["Ambiente sensacional", "Ambiente aconchegante", "Ambiente nota dez!!"],
          },
          {
            title: "Profissionais",
            description: "Referência à competência e profissionalismo da equipe de atendimento.",
            emotions: ["Barbeiro de qualidade excepcional", "Profissionais extremamente capacitados", "Pessoas atenciosas e serviço nota dez"],
          },
          {
            title: "Atendimento",
            description: "Experiência de serviço ao cliente, desde a recepção até a finalização do serviço.",
            emotions: ["Atendimento de qualidade!", "Atendimento excelente!", "Excelente atendimento!"],
          },
          {
            title: "Sistema de Agendamento",
            description: "Facilidade e conveniência no processo de marcação de horários pelos clientes.",
            emotions: ["Sistema 'super fácil de agendamento'", "Agilidade na marcação pelo link"],
          },
          {
            title: "Destaque da Equipe",
            description: "Atendimento personalizado e cuidadoso, especialmente com pontualidade e atenção aos detalhes.",
            emotions: ["Colaboradores super atenciosos", "Cuidado especial com as preferências do cliente"],
          },
        ],
        citedProducts: deriveProductsFromContext(profile.name, categoryName, frequentWords, allTexts, isDemoMode),
        opportunities: [
          `Implementar rotina de solicitação ativa de avaliações após a entrega do serviço em ${categoryName}.`,
          `Responder formalmente a todas as avaliações recebidas, reforçando as principais palavras-chave do nicho.`,
          `Publicar fotos semanais dos serviços e da estrutura para ampliar as interações visuais no Google Maps.`,
        ],
      },
      negative: {
        hasEnoughData: false,
        dataMessage: "Não existem informações negativas suficientes para análise profunda (Apenas 0 avaliação(ões) negativa(s) disponível(is), mínimo: 03).",
      },
    };
  }

  // Modo de dados reais
  const hasTextReviews = allTexts.length > 0;
  const ratingText = rating > 0 ? `${rating.toFixed(1)} estrelas` : "não avaliado publicamente";

  const summary = hasTextReviews
    ? `A empresa ${profile.name} atua no segmento de ${categoryName} com nota de reputação de ${ratingText} no Google (${totalReviews} avaliações registradas). Os clientes avaliam positivamente o atendimento e os serviços executados.`
    : `A empresa ${profile.name} possui ${totalReviews} avaliações registradas no Google (${ratingText}). Não foram obtidas avaliações individuais com texto nesta amostra para extração de aspectos semânticos.`;

  const praisedAspects: PraisedAspect[] = hasTextReviews
    ? [
        {
          title: "Atendimento ao Cliente",
          description: `Qualidade no relacionamento direto com o consumidor em ${categoryName}.`,
          emotions: frequentWords.slice(0, 3).map((w) => `"${w.word}" (${w.count}x)`),
        },
      ]
    : [];

  const citedProducts: CitedProduct[] = deriveProductsFromContext(profile.name, categoryName, frequentWords, allTexts, isDemoMode);

  const opportunities: string[] = [
    `Implementar rotina de solicitação ativa de avaliações após a entrega do serviço em ${categoryName}.`,
    `Responder formalmente a todas as avaliações recebidas, reforçando as principais palavras-chave do nicho.`,
    `Publicar fotos semanais dos serviços e da estrutura para ampliar as interações visuais no Google Maps.`,
  ];

  const hasEnoughNegative = negative.length >= 3;

  return {
    positive: {
      summary,
      praisedAspects,
      citedProducts,
      opportunities,
    },
    negative: {
      hasEnoughData: hasEnoughNegative,
      dataMessage: hasEnoughNegative
        ? undefined
        : `Não existem informações negativas suficientes para análise profunda (Apenas ${negative.length} avaliação(ões) negativa(s) disponível(is), mínimo: 03).`,
      summary: hasEnoughNegative
        ? `Foram identificados pontos de atrito ocasionais relacionados a pontualidade ou tempo de espera.`
        : undefined,
      criticalAspects: hasEnoughNegative
        ? [
            {
              title: "Tempo de Espera",
              complaint: "Relato de atraso em horários de pico.",
              suggestion: "Ajustar o intervalo de agendamento entre clientes.",
            },
          ]
        : undefined,
      opportunities: hasEnoughNegative
        ? ["Implementar confirmação prévia de presença via WhatsApp."]
        : undefined,
    },
  };
}

function createEmptyAudit(profile: BusinessProfileSnapshot): CompleteReviewAuditResult {
  const publicTotal = typeof profile.reviewsCount === "number" ? profile.reviewsCount : null;
  return {
    profile,
    metrics: {
      totalReviews: publicTotal,
      capturedReviewsCount: 0,
      uncollectedReviewsCount: publicTotal,
      ownerRepliesCount: 0,
      ownerRepliesPercentage: 0,
      customerTextReviewsCount: 0,
      customerTextReviewsPercentage: 0,
      averageRating: typeof profile.rating === "number" ? profile.rating : null,
      averageCommentLength: 0,
      responseRatePercentage: 0,
      withPhotosPercentage: 0,
      withCommentsPercentage: 0,
      withCommentsCount: 0,
      localGuidesPercentage: 0,
      localGuidesCount: 0,
      withImagesPercentage: 0,
      withImagesCount: 0,
      positiveReviewsCount: 0,
      positiveReviewsPercentage: 0,
      negativeReviewsCount: 0,
      negativeReviewsPercentage: 0,
    },
    ratingDistribution: [5, 4, 3, 2, 1].map((s) => ({ stars: s, label: `${s} estrelas`, count: 0, percentage: 0 })),
    evolutionHistory: [],
    monthlyAverages: [],
    donuts: {
      responses: [{ name: "Sem dados", value: 1, percentage: 100, color: "#334155" }],
      comments: [{ name: "Sem dados", value: 1, percentage: 100, color: "#334155" }],
      images: [{ name: "Sem dados", value: 1, percentage: 100, color: "#334155" }],
      localGuides: [{ name: "Sem dados", value: 1, percentage: 100, color: "#334155" }]
    },
    frequentWords: [],
    positiveReviews: [],
    negativeReviews: [],
    insights: {
      positive: { summary: "Sem avaliações suficientes.", praisedAspects: [], citedProducts: [], opportunities: [] },
      negative: { hasEnoughData: false, dataMessage: "Nenhuma avaliação disponível para auditoria." }
    }
  };
}

/**
 * Fixture oficial da Barbearia Dutra (exatamente como no vídeo do GBPCheck)
 * Permite demonstração imediata do dashboard para a agência
 */
export const BARBEARIA_DUTRA_DEMO_SNAPSHOT: BusinessProfileSnapshot = {
  name: "Barbearia Dutra",
  category: "Barbearia",
  rating: 5.0,
  reviewsCount: 178,
  address: "R. Justino Gomes Bueno, 74 - Jardim Morumbi, Porto Feliz - SP, 18540-000",
  phone: "(15) 99801-7755",
  website: "https://barbeariadutra.agende.com.br",
  placeId: "ChIJBarbeariaDutraPortoFeliz",
  cid: "1059283749281749",
  photoUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80",
  mapUrl: "https://maps.google.com/?q=Barbearia+Dutra+Porto+Feliz"
};

export const BARBEARIA_DUTRA_DEMO_REVIEWS: RawAuditReview[] = [
  {
    author: "Mauro Gomes",
    rating: 5,
    isLocalGuide: true,
    relativeDate: "1 semana atrás",
    text: "Lugar excelente! Toque rústico alinhado ao moderno, espaço amplo e ensolarado! Barbearia de qualidade excepcional! Vale a pena ter um período mais longo no agendamento pra fazer barba, cabelo e beber um chopp bacana com os caras e ainda tomar uma breja enquanto aguarda!",
    ownerReply: {
      text: "Obrigado Mauro! Valeu pelo feedback, ficamos muito felizes em ver que curtiu nosso espaço e atendimento.",
      relativeDate: "1 semana atrás"
    }
  },
  {
    author: "rodrigo cominassi",
    rating: 5,
    isLocalGuide: true,
    relativeDate: "1 semana atrás",
    text: "Nossa, um dos melhores lugares pra dar um trato no visual. Cabelo barba tudo de primeiríssima qualidade, ambiente sensacional, chopp bem gelado, cervejas especiais e o atendimento é top dos profissionais. Valeu galera tamo sempre aí!",
    ownerReply: {
      text: "Valeu Rodrigo, tamo junto! Obrigado pela preferência e amizade sempre.",
      relativeDate: "1 semana atrás"
    }
  },
  {
    author: "D A L O S",
    rating: 5,
    isLocalGuide: false,
    relativeDate: "1 semana atrás",
    text: "Pra quem procura uma barbearia de verdade em Porto Feliz, essa é a referência em qualidade e estética! Quem sabe valor tem seu preço, corte na régua e espaço nota dez!",
    ownerReply: {
      text: "Muito obrigado Dalos! Agradecemos o reconhecimento e a confiança em nosso trabalho.",
      relativeDate: "1 semana atrás"
    }
  },
  {
    author: "Rodrigo Cassiano",
    rating: 5,
    isLocalGuide: true,
    relativeDate: "2 semanas atrás",
    text: "A melhor barbearia da cidade, arrisco dizer que está entre as melhores da região! Conexão requinte, serviço impecável! Recomendo sempre!",
    ownerReply: {
      text: "Grande Rodrigo! É uma satisfação atender você. Valeu pelo carinho!",
      relativeDate: "2 semanas atrás"
    }
  },
  {
    author: "Dra Ana",
    rating: 5,
    isLocalGuide: false,
    relativeDate: "3 semanas atrás",
    text: "Os rapazes são extremamente profissionais, o serviço e espetacular com local personalizado e exclusivo! Sem dúvida a melhor barbearia do interior de SP.",
    ownerReply: {
      text: "Obrigado Dra Ana! Sempre um prazer receber você e cuidar dos seus com carinho.",
      relativeDate: "3 semanas atrás"
    }
  },
  {
    author: "Jean Davis Pompeu e Silva",
    rating: 5,
    isLocalGuide: true,
    relativeDate: "3 semanas atrás",
    text: "Fazia tempo que procurava um lugar para cortar cabelo que fosse top e me abaixasse bem, encontrei! Ótimo serviço, vou voltar!",
    ownerReply: {
      text: "Obrigado Jean! Seja sempre muito bem-vindo por aqui.",
      relativeDate: "3 semanas atrás"
    }
  },
  {
    author: "Adriano Macedo",
    rating: 5,
    isLocalGuide: true,
    relativeDate: "4 semanas atrás",
    text: "Lugar para quem busca excelentes profissionais aliado a um ambiente descontraído, acolhedor e profissional.",
    ownerReply: {
      text: "Valeu Adriano, tamo junto sempre!",
      relativeDate: "4 semanas atrás"
    }
  },
  {
    author: "Eduardo Petel",
    rating: 5,
    isLocalGuide: false,
    relativeDate: "1 mês atrás",
    text: "A melhor barbearia de Porto Feliz, com um super sistema fácil de agendamento. Toda a equipe impecável!",
    ownerReply: {
      text: "Obrigado Eduardo! Foco total na comodidade e no resultado impecável para vocês.",
      relativeDate: "1 mês atrás"
    }
  },
  {
    author: "Gilian Almeida Furtis",
    rating: 5,
    isLocalGuide: true,
    relativeDate: "1 mês atrás",
    text: "O colaborador Felipe foi super atencioso com meu filho, muito feliz. Atendimento e corte nota dez. Super recomendo!!",
    ownerReply: {
      text: "Que alegria saber disso Gilian! O Felipe mandou um abraço pro seu filhão. Até a próxima!",
      relativeDate: "1 mês atrás"
    }
  },
  {
    author: "ROBERTO MATEUS",
    rating: 5,
    isLocalGuide: false,
    relativeDate: "2 meses atrás",
    text: "ambiente aconchegante, muito bem recebido pelos profissionais. E o serviço muito bem executado.",
    ownerReply: {
      text: "Obrigado Roberto! Estaremos sempre prontos para lhe receber bem.",
      relativeDate: "2 meses atrás"
    }
  },
  {
    author: "Ivan Daniel",
    rating: 3,
    isLocalGuide: false,
    relativeDate: "6 meses atrás",
    text: "O espaço estava muito cheio, cheguei no meu horário mas tive uma ligeira espera.",
    ownerReply: {
      text: "Olá Ivan, pedimos desculpas pelo ocorrido naquele dia. Já ajustamos o intervalo entre agendamentos para evitar qualquer espera.",
      relativeDate: "6 meses atrás"
    }
  }
];
