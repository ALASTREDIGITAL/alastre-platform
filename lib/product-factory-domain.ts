/**
 * Alastre Platform - Módulo 01: Fábrica de Produtos
 * Domínio, Regras de Negócio e Contratos
 *
 * Princípios inegociáveis:
 * 1. Produto, oferta e operação são domínios distintos.
 * 2. Preço, plano e promessa dependem de escopo, capacidade e custo demonstráveis.
 * 3. Fato, evidência, inferência, hipótese e lacuna são estados explícitos de dados.
 * 4. Máximo de 7 perguntas por rodada de entrevista.
 * 5. Versão aprovada é imutável; edições geram nova versão.
 * 6. Nunca aprovar preço ou promessa comercial com dados insuficientes ou lacunas impeditivas.
 */

export const MAX_QUESTIONS_PER_ROUND = 7;

export type InformationClassification =
  | "fact"        // Fato comprovado por registro objetivo
  | "evidence"    // Evidência verificada documentalmente
  | "inference"   // Dedução lógica a partir de evidências
  | "hypothesis"  // Suposição ainda não verificada
  | "gap";        // Lacuna de informação crítica ausente

export type ProductStatus =
  | "draft"        // Em estruturação inicial
  | "in_review"    // Submetido para revisão humana / aprovação
  | "approved"     // Aprovado e imutável
  | "superseded"   // Substituído por versão mais recente
  | "archived";    // Arquivado / Descontinuado

export type DeliveryType = "setup" | "recurring";

export type ScopeClassification =
  | "included"     // Incluído no escopo padrão
  | "not_included" // Explicitamente fora do escopo
  | "optional"     // Opcional selecionável
  | "upsell";      // Oportunidade de expansão comercial futura

export type ActivityFrequency =
  | "once"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "on_demand";

export type RaciRole =
  | "client"         // Cliente contratante
  | "client_service"  // Atendimento / CS
  | "analyst"        // Analista de Operações
  | "specialist"     // Especialista técnico
  | "manager"        // Gestor da Agência
  | "automation_ai"; // Automação / Inteligência Artificial

export type RaciType = "R" | "A" | "C" | "I"; // Responsible, Accountable, Consulted, Informed

export type ViabilityResult =
  | "blocked"                // Bloqueado por lacunas impeditivas ou escopo insuficiente
  | "ready_for_estimation"   // Pronto para estimativa de capacidade e custos (sem preço)
  | "ready_for_human_review";// Pronto para revisão e aprovação humana

export interface DiscoveryQuestion {
  id: string;
  category: "operations" | "objective" | "market" | "icp" | "anti_icp" | "capacity" | "constraints";
  question_text: string;
  explanation: string;
  is_required: boolean;
  expected_type: "text" | "number" | "boolean" | "list";
}

export interface DiscoveryAnswer {
  question_id: string;
  answer_text: string;
  classification: InformationClassification;
  confidence: "high" | "medium" | "low" | "none";
  is_blocking_gap: boolean;
  gap_notes?: string;
  answered_at: string;
}

export interface DiscoverySession {
  id: string;
  agency_id: string;
  product_definition_id: string;
  round_number: number;
  status: "in_progress" | "completed" | "abandoned";
  questions: DiscoveryQuestion[];
  answers: DiscoveryAnswer[];
  started_at: string;
  completed_at?: string | null;
}

export interface ProductScopeItem {
  id: string;
  agency_id: string;
  product_definition_id: string;
  activity_name: string;
  description: string;
  delivery_type: DeliveryType;
  frequency: ActivityFrequency;
  default_role: RaciRole;
  estimated_minutes: number;
  is_automatable: boolean;
  client_participation_required: boolean;
  dependencies: string[];
  acceptance_criteria: string;
  required_evidence: string;
  scope_classification: ScopeClassification;
  sort_order: number;
}

export interface OperationalSopStep {
  order: number;
  title: string;
  instruction: string;
}

export interface OperationalSop {
  id: string;
  agency_id: string;
  product_definition_id: string;
  scope_item_id?: string | null;
  name: string;
  objective: string;
  trigger: string;
  responsible_role: RaciRole;
  prerequisites: string[];
  tools_required: string[];
  steps: OperationalSopStep[];
  quality_checklist: string[];
  completion_criteria: string;
  required_evidence: string;
  estimated_minutes: number;
  errors_and_exceptions: string[];
}

export interface RaciAssignment {
  id: string;
  agency_id: string;
  product_definition_id: string;
  scope_item_id?: string | null;
  activity_name: string;
  role: RaciRole;
  is_future_role: boolean; // Permite marcar papéis futuros sem inventar cargos atuais
  raci_type: RaciType;
}

export interface ViabilityCheckpoint {
  id: string;
  agency_id: string;
  product_definition_id: string;
  discovery_completeness_percentage: number;
  blocking_gaps: string[];
  total_setup_hours: number;
  total_recurring_monthly_hours: number;
  critical_dependencies: string[];
  unvalidated_capacity_flags: string[];
  result: ViabilityResult;
  viability_score: number; // 0 a 100
  explanation: string;
  calculated_at: string;
}

export interface ProductDefinition {
  id: string;
  agency_id: string;
  client_id?: string | null; // Opcional: produto geral da agência ou customizado por cliente
  name: string;
  slug: string;
  summary: string;
  version: number;
  status: ProductStatus;
  target_objective: string;
  target_market: string;
  icp_description: string;
  anti_icp_description: string;
  transformational_promise: string;
  controllable_deliverables: string[];
  influenciable_indicators: string[];
  external_results: string[];
  is_immutable: boolean;
  created_by_actor_id?: string | null;
  approved_by_actor_id?: string | null;
  approved_at?: string | null;
  superseded_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Catálogo Base Oficial de Descoberta Operacional para SEO Local e Google Business Profile
 * Dividido em rodadas estritamente limitadas a no máximo 7 perguntas por rodada.
 */
export const STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS: Array<{
  round: number;
  title: string;
  category: DiscoveryQuestion["category"];
  questions: DiscoveryQuestion[];
}> = [
  {
    round: 1,
    title: "Rodada 1: Operação e Limites de Capacidade",
    category: "operations",
    questions: [
      {
        id: "q_op_01",
        category: "operations",
        question_text: "Quais ferramentas e acessos são obrigatoriamente necessários para iniciar a auditoria e gestão da ficha?",
        explanation: "Mapeia pré-requisitos técnicos reais para evitar bloqueio no onboarding.",
        is_required: true,
        expected_type: "list",
      },
      {
        id: "q_op_02",
        category: "operations",
        question_text: "Quem é o responsável operacional atual pela publicação e resposta de avaliações?",
        explanation: "Identifica se há operador dedicado ou se a responsabilidade está difusa.",
        is_required: true,
        expected_type: "text",
      },
      {
        id: "q_op_03",
        category: "operations",
        question_text: "Qual é o tempo médio real dedicado hoje na gestão de cada perfil por mês (em horas)?",
        explanation: "Base essencial para dimensionar capacidade e viabilidade operacional.",
        is_required: true,
        expected_type: "number",
      },
      {
        id: "q_op_04",
        category: "capacity",
        question_text: "Quantos perfis ou clientes uma única pessoa consegue operar com o padrão de qualidade Alastre hoje?",
        explanation: "Impede sobrecarga e perda de padrão na promessa de entrega.",
        is_required: true,
        expected_type: "number",
      },
      {
        id: "q_op_05",
        category: "operations",
        question_text: "Existe procedimento documentado (SOP) para lidar com avaliações negativas ou suspensões de ficha?",
        explanation: "Verifica prontidão para gestão de crises e exceções.",
        is_required: true,
        expected_type: "boolean",
      },
      {
        id: "q_op_06",
        category: "constraints",
        question_text: "Quais restrições jurídicas, regulatórias ou de categoria o negócio possui (ex: CFM, OAB, etc.)?",
        explanation: "Evita promessas que violem diretrizes legais ou diretrizes de conteúdo do Google.",
        is_required: true,
        expected_type: "text",
      },
      {
        id: "q_op_07",
        category: "constraints",
        question_text: "O cliente possui fotos reais do local, fachada e equipe, ou depende de banco de imagens?",
        explanation: "O Google rejeita ou desvaloriza imagens sintéticas ou de banco de dados em fichas locais.",
        is_required: true,
        expected_type: "text",
      },
    ],
  },
  {
    round: 2,
    title: "Rodada 2: Mercado, ICP, Anti-ICP e Promessa",
    category: "market",
    questions: [
      {
        id: "q_mkt_01",
        category: "objective",
        question_text: "Qual é o objetivo primário que o cliente espera alcançar com o posicionamento local?",
        explanation: "Alinha expectativas entre visibilidade, ligações, rotas ou visitas na loja física.",
        is_required: true,
        expected_type: "text",
      },
      {
        id: "q_mkt_02",
        category: "market",
        question_text: "Qual é o raio geográfico prioritário de atendimento ou atuação do negócio?",
        explanation: "SEO Local é altamente dependente de proximidade física e densidade urbana.",
        is_required: true,
        expected_type: "text",
      },
      {
        id: "q_mkt_03",
        category: "icp",
        question_text: "Qual é o Perfil de Cliente Ideal (ICP) que gera maior margem e menor atrito para a operação?",
        explanation: "Orienta as palavras-chave prioritárias e atributos de conversão.",
        is_required: true,
        expected_type: "text",
      },
      {
        id: "q_mkt_04",
        category: "anti_icp",
        question_text: "Quais clientes ou demandas NÃO devem ser atendidos pelo produto (Anti-ICP)?",
        explanation: "Evita atrair leads desalinhados que oneram o atendimento e geram insatisfação.",
        is_required: true,
        expected_type: "text",
      },
      {
        id: "q_mkt_05",
        category: "objective",
        question_text: "Quais são os entregáveis 100% controláveis pela agência (ex: ficha otimizada, postagens semanais)?",
        explanation: "Separa rigorosamente o que a equipe controla do que depende de algoritmos externos.",
        is_required: true,
        expected_type: "list",
      },
      {
        id: "q_mkt_06",
        category: "objective",
        question_text: "Quais são os indicadores influenciáveis (ex: impressões na busca, cliques para ligação)?",
        explanation: "Métricas que a agência pode otimizar, mas que sofrem interferência de sazonalidade e concorrência.",
        is_required: true,
        expected_type: "list",
      },
      {
        id: "q_mkt_07",
        category: "objective",
        question_text: "Quais resultados externos NÃO podem ser prometidos em contrato (ex: vendas no balcão, faturamento)?",
        explanation: "Salvaguarda jurídica e ética fundamental: nunca prometer faturamento ou vendas diretas.",
        is_required: true,
        expected_type: "list",
      },
    ],
  },
];

/**
 * Validador estrito: nenhuma rodada pode conter mais de 7 perguntas.
 */
export function validateSevenQuestionLimit(questions: unknown[]): boolean {
  if (!Array.isArray(questions)) return false;
  return questions.length <= MAX_QUESTIONS_PER_ROUND;
}

/**
 * Classifica a informação informada pelo operador conforme o padrão Alastre
 */
export function classifyInformation(
  text: string,
  hasEvidence = false,
  isExplicitAssumption = false,
): InformationClassification {
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase().includes("não sei") || trimmed.toLowerCase().includes("a definir") || trimmed.toLowerCase().includes("pendente")) {
    return "gap";
  }
  if (hasEvidence) {
    return "evidence";
  }
  if (isExplicitAssumption) {
    return "hypothesis";
  }
  // Se for uma afirmação sem prova documental anexada, classifica como fato declarado ou inferência
  if (trimmed.length > 50 && (trimmed.includes("porque") || trimmed.includes("portanto") || trimmed.includes("estimamos"))) {
    return "inference";
  }
  return "fact";
}

export interface ScopeTotals {
  totalSetupMinutes: number;
  totalSetupHours: number;
  monthlyRecurringMinutes: number;
  monthlyRecurringHours: number;
  automatableCount: number;
  automatablePercentage: number;
  clientParticipationCount: number;
  itemsCount: number;
}

/**
 * Calcula totais de tempo e automação da matriz de escopo
 */
export function calculateScopeTotals(items: ProductScopeItem[]): ScopeTotals {
  let setupMinutes = 0;
  let recurringMinutesPerMonth = 0;
  let automatableCount = 0;
  let clientParticipationCount = 0;

  for (const item of items) {
    if (item.scope_classification === "not_included") continue;

    if (item.delivery_type === "setup") {
      setupMinutes += item.estimated_minutes;
    } else {
      // Converte frequência para minutos mensais estimados (base 4 semanas/mês)
      let multiplier = 1;
      switch (item.frequency) {
        case "daily":
          multiplier = 22; // dias úteis
          break;
        case "weekly":
          multiplier = 4;
          break;
        case "biweekly":
          multiplier = 2;
          break;
        case "monthly":
          multiplier = 1;
          break;
        case "quarterly":
          multiplier = 0.33;
          break;
        case "on_demand":
        case "once":
        default:
          multiplier = 1;
          break;
      }
      recurringMinutesPerMonth += Math.round(item.estimated_minutes * multiplier);
    }

    if (item.is_automatable) automatableCount++;
    if (item.client_participation_required) clientParticipationCount++;
  }

  const activeCount = items.filter((i) => i.scope_classification !== "not_included").length;

  return {
    totalSetupMinutes: setupMinutes,
    totalSetupHours: Number((setupMinutes / 60).toFixed(1)),
    monthlyRecurringMinutes: recurringMinutesPerMonth,
    monthlyRecurringHours: Number((recurringMinutesPerMonth / 60).toFixed(1)),
    automatableCount,
    automatablePercentage: activeCount > 0 ? Math.round((automatableCount / activeCount) * 100) : 0,
    clientParticipationCount,
    itemsCount: items.length,
  };
}

export interface ViabilityCalculationInput {
  product: ProductDefinition;
  sessions: DiscoverySession[];
  scopeItems: ProductScopeItem[];
  sops: OperationalSop[];
  raci: RaciAssignment[];
}

/**
 * Checkpoint de Viabilidade:
 * - Avalia completude da descoberta
 * - Identifica lacunas impeditivas
 * - Calcula tempo de implantação e recorrência
 * - Verifica dependências críticas e capacidade não validada
 * - Determina se está bloqueado, pronto para estimativa ou pronto para revisão humana
 * - NUNCA aprova preço automaticamente
 */
export function calculateViabilityCheckpoint(input: ViabilityCalculationInput): ViabilityCheckpoint {
  const { product, sessions, scopeItems, sops, raci } = input;
  const blockingGaps: string[] = [];
  const criticalDependencies: string[] = [];
  const unvalidatedCapacityFlags: string[] = [];

  // 1. Avalia perguntas obrigatórias e respostas
  let totalRequiredQuestions = 0;
  let answeredRequiredQuestions = 0;

  for (const session of sessions) {
    for (const q of session.questions) {
      if (q.is_required) totalRequiredQuestions++;
      const answer = session.answers.find((a) => a.question_id === q.id);
      if (answer && answer.answer_text.trim().length > 0) {
        if (answer.is_blocking_gap || answer.classification === "gap") {
          blockingGaps.push(`Lacuna na pergunta '${q.question_text}': ${answer.gap_notes || "Informação não fornecida"}`);
        } else {
          if (q.is_required) answeredRequiredQuestions++;
        }
      } else if (q.is_required) {
        blockingGaps.push(`Pergunta obrigatória não respondida: '${q.question_text}'`);
      }
    }
  }

  const completenessPercentage =
    totalRequiredQuestions > 0
      ? Math.round((answeredRequiredQuestions / totalRequiredQuestions) * 100)
      : 0;

  // 2. Avalia matriz de escopo
  const scopeTotals = calculateScopeTotals(scopeItems);
  const includedItems = scopeItems.filter((i) => i.scope_classification === "included");

  if (includedItems.length === 0) {
    blockingGaps.push("Matriz de escopo não possui itens classificados como incluídos.");
  }

  const hasSetup = includedItems.some((i) => i.delivery_type === "setup");
  const hasRecurring = includedItems.some((i) => i.delivery_type === "recurring");

  if (!hasSetup) {
    blockingGaps.push("Faltam atividades de Implantação (Setup) no escopo incluído.");
  }
  if (!hasRecurring) {
    blockingGaps.push("Faltam atividades de Recorrência no escopo incluído.");
  }

  // Verifica dependências críticas e critérios de aceite
  for (const item of includedItems) {
    if (!item.acceptance_criteria.trim()) {
      blockingGaps.push(`Item '${item.activity_name}' não possui critério de aceite definido.`);
    }
    if (!item.required_evidence.trim()) {
      blockingGaps.push(`Item '${item.activity_name}' não especifica evidência necessária.`);
    }
    if (item.dependencies.length > 0) {
      for (const dep of item.dependencies) {
        criticalDependencies.push(`${item.activity_name} -> ${dep}`);
      }
    }
  }

  // 3. Avalia SOPs
  if (sops.length === 0 && includedItems.length > 0) {
    unvalidatedCapacityFlags.push("Nenhum Procedimento Operacional Padrão (SOP) cadastrado para guiar a operação.");
  }

  // 4. Avalia RACI e capacidade futura
  const futureRolesAssigned = raci.filter((r) => r.is_future_role);
  if (futureRolesAssigned.length > 0) {
    const rolesList = Array.from(new Set(futureRolesAssigned.map((r) => r.role))).join(", ");
    unvalidatedCapacityFlags.push(
      `Existem papéis operacionais marcados como 'função futura' que a agência não possui contratados (${rolesList}). Exige validação prévia.`,
    );
  }

  // Verifica se itens incluídos possuem responsável
  for (const item of includedItems) {
    const hasR = raci.some(
      (r) => (r.scope_item_id === item.id || r.activity_name === item.activity_name) && r.raci_type === "R",
    );
    if (!hasR) {
      blockingGaps.push(`Atividade '${item.activity_name}' não possui responsável (R no RACI) atribuído.`);
    }
  }

  // 5. Determina pontuação e resultado
  let score = 100;
  score -= (100 - completenessPercentage) * 0.4; // Peso 40% para completude
  score -= blockingGaps.length * 15;            // Cada lacuna impeditiva subtrai 15 pontos
  score -= unvalidatedCapacityFlags.length * 10;// Cada alerta de capacidade subtrai 10 pontos
  if (score < 0) score = 0;
  score = Math.round(score);

  let result: ViabilityResult = "blocked";
  let explanation = "";

  if (blockingGaps.length > 0 || completenessPercentage < 70) {
    result = "blocked";
    explanation = `Produto bloqueado: existem ${blockingGaps.length} lacuna(s) impeditiva(s) e completude da descoberta em ${completenessPercentage}% (mínimo de 70% necessário).`;
  } else if (unvalidatedCapacityFlags.length > 0 || completenessPercentage < 90 || sops.length < 2) {
    result = "ready_for_estimation";
    explanation = `Pronto para estimativa interna de capacidade e custos. Requer validação das pendências operacionais antes de submissão para revisão humana.`;
  } else {
    result = "ready_for_human_review";
    explanation = `Produto verificado e consistente. Descoberta completa (${completenessPercentage}%), escopo e SOPs estruturados. Pronto para revisão e aprovação humana.`;
  }

  return {
    id: `chk_${product.id}_${Date.now()}`,
    agency_id: product.agency_id,
    product_definition_id: product.id,
    discovery_completeness_percentage: completenessPercentage,
    blocking_gaps: blockingGaps,
    total_setup_hours: scopeTotals.totalSetupHours,
    total_recurring_monthly_hours: scopeTotals.monthlyRecurringHours,
    critical_dependencies: Array.from(new Set(criticalDependencies)),
    unvalidated_capacity_flags: unvalidatedCapacityFlags,
    result,
    viability_score: score,
    explanation,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Salvaguarda Estrita de Precificação e Promessa Comercial:
 * Impede que qualquer preço, pacote ou promessa comercial externa seja gerada
 * sem dados suficientes ou quando o checkpoint de viabilidade estiver bloqueado.
 */
export function preventPrematurePricing(
  product: ProductDefinition,
  viability: ViabilityCheckpoint,
): {
  priceAllowed: boolean;
  commercialPromiseAllowed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (product.status === "draft" || product.status === "in_review") {
    reasons.push("Definição do produto ainda não foi aprovada por um operador humano.");
  }
  if (viability.result === "blocked") {
    reasons.push("Checkpoint de viabilidade está BLOQUEADO devido a lacunas impeditivas.");
  }
  if (viability.discovery_completeness_percentage < 80) {
    reasons.push(`Completude da descoberta (${viability.discovery_completeness_percentage}%) está abaixo do mínimo seguro de 80%.`);
  }
  if (viability.blocking_gaps.length > 0) {
    reasons.push(`Existem ${viability.blocking_gaps.length} lacuna(s) impeditiva(s) registradas.`);
  }
  if (viability.unvalidated_capacity_flags.length > 0) {
    reasons.push("Existem restrições de capacidade operacional não validadas.");
  }

  const allowed = reasons.length === 0 && product.status === "approved";

  return {
    priceAllowed: allowed,
    commercialPromiseAllowed: allowed,
    reasons,
  };
}

/**
 * Validação de Transição de Estados do Produto:
 * draft -> in_review -> approved -> superseded / archived
 * - Apenas transições válidas são aceitas.
 * - Versão aprovada é imutável.
 * - Transição para in_review exige viability !== 'blocked'.
 * - Transição para approved exige submissão humana válida.
 */
export function canTransitionProductStatus(
  current: ProductStatus,
  next: ProductStatus,
  viability?: ViabilityCheckpoint,
): { allowed: boolean; reason?: string } {
  if (current === next) return { allowed: true };

  if (current === "approved") {
    // Versão aprovada é imutável: só pode ser substituída (superseded) ou arquivada (archived)
    if (next === "superseded" || next === "archived") {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Uma versão de produto aprovada é imutável. Modificações exigem criação de uma nova versão.",
    };
  }

  if (current === "superseded" || current === "archived") {
    return {
      allowed: false,
      reason: `Produtos com status '${current}' são terminais e não podem transitar para '${next}'. Crie uma nova versão.`,
    };
  }

  if (current === "draft") {
    if (next === "in_review") {
      if (viability && viability.result === "blocked") {
        return {
          allowed: false,
          reason: "Não é possível submeter para revisão humana enquanto o produto estiver bloqueado por lacunas no checkpoint de viabilidade.",
        };
      }
      return { allowed: true };
    }
    if (next === "archived") return { allowed: true };
    return {
      allowed: false,
      reason: "Produtos em rascunho devem ser submetidos para revisão ('in_review') antes de aprovação.",
    };
  }

  if (current === "in_review") {
    if (next === "approved") return { allowed: true };
    if (next === "draft") return { allowed: true }; // Ajustes solicitados
    if (next === "archived") return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Transição inválida de '${current}' para '${next}'.`,
  };
}

/**
 * Cria nova versão incrementada a partir de uma versão aprovada
 */
export function createNextVersion(
  currentProduct: ProductDefinition,
  actorId?: string,
): { newProduct: ProductDefinition; oldStatus: ProductStatus } {
  const newProduct: ProductDefinition = {
    ...currentProduct,
    id: `prod_${Date.now()}_v${currentProduct.version + 1}`,
    version: currentProduct.version + 1,
    status: "draft",
    is_immutable: false,
    created_by_actor_id: actorId ?? currentProduct.created_by_actor_id,
    approved_by_actor_id: null,
    approved_at: null,
    superseded_by_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    newProduct,
    oldStatus: "superseded",
  };
}
