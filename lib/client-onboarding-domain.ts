/**
 * Módulo 03: Onboarding de Clientes - Domínio e Contratos
 *
 * Converte uma venda aprovada em cliente operacional com escopo, acessos,
 * contexto, baseline, responsabilidades, dependências e critérios claros de ativação.
 *
 * Princípios:
 * 1. Oportunidade ganha NÃO cria cliente automaticamente.
 * 2. Apenas handoff 'approved_for_onboarding' pode iniciar onboarding.
 * 3. Processo idempotente e retomável.
 * 4. Nenhuma operação pode deixar agência, cliente ou ator órfão.
 * 5. Escopo vendido deve corresponder a produto e versão aprovados.
 * 6. Promessa fora de escopo bloqueia a ativação.
 * 7. Acesso ausente, provider pendente e dado parcial são normais e explícitos.
 * 8. Sucesso visual exige persistência confirmada.
 * 9. Não criar integrações, credenciais ou conexões falsas.
 * 10. Não habilitar escrita externa.
 */

// ==============================================================================
// 1. Estados e Estágios do Onboarding
// ==============================================================================

export type OnboardingStage =
  | "draft"
  | "awaiting_commercial_review"
  | "awaiting_operations_review"
  | "awaiting_client_information"
  | "collecting_access"
  | "building_dna"
  | "establishing_baseline"
  | "planning_implementation"
  | "ready_for_activation"
  | "active"
  | "blocked"
  | "cancelled";

export type OnboardingStageMeta = {
  id: OnboardingStage;
  label: string;
  order: number;
  description: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  responsibleParty: "commercial" | "operations" | "client" | "system";
};

export const ONBOARDING_STAGES_META: Record<OnboardingStage, OnboardingStageMeta> = {
  draft: {
    id: "draft",
    label: "Rascunho",
    order: 1,
    description: "Início do processo a partir de um handoff comercial aprovado.",
    badgeVariant: "secondary",
    responsibleParty: "commercial",
  },
  awaiting_commercial_review: {
    id: "awaiting_commercial_review",
    label: "Revisão Comercial",
    order: 2,
    description: "Conferência inicial da venda, promessas, preços e escopo contratado.",
    badgeVariant: "outline",
    responsibleParty: "commercial",
  },
  awaiting_operations_review: {
    id: "awaiting_operations_review",
    label: "Conferência Operacional",
    order: 3,
    description: "Validação da viabilidade técnica e conferência de aderência com a Fábrica de Produtos.",
    badgeVariant: "outline",
    responsibleParty: "operations",
  },
  awaiting_client_information: {
    id: "awaiting_client_information",
    label: "Coleta de Informações",
    order: 4,
    description: "Preenchimento de dados empresariais, fotos, horários e responsáveis pelo cliente.",
    badgeVariant: "warning",
    responsibleParty: "client",
  },
  collecting_access: {
    id: "collecting_access",
    label: "Coleta de Acessos",
    order: 5,
    description: "Vinculação segura de recursos do Google Business Profile e canais via Connection Hub.",
    badgeVariant: "warning",
    responsibleParty: "client",
  },
  building_dna: {
    id: "building_dna",
    label: "Construção do DNA",
    order: 6,
    description: "Confirmação de fatos, fontes e dados essenciais do negócio na memória central.",
    badgeVariant: "outline",
    responsibleParty: "operations",
  },
  establishing_baseline: {
    id: "establishing_baseline",
    label: "Estabelecimento de Baseline",
    order: 7,
    description: "Diagnóstico inicial sem dados sintéticos, registrando a situação de partida do cliente.",
    badgeVariant: "outline",
    responsibleParty: "operations",
  },
  planning_implementation: {
    id: "planning_implementation",
    label: "Plano de Implantação",
    order: 8,
    description: "Estruturação das atividades de setup e recorrência com base nos SOPs aprovados.",
    badgeVariant: "outline",
    responsibleParty: "operations",
  },
  ready_for_activation: {
    id: "ready_for_activation",
    label: "Pronto para Ativação",
    order: 9,
    description: "Todos os requisitos obrigatórios cumpridos aguardando aprovação humana final.",
    badgeVariant: "success",
    responsibleParty: "operations",
  },
  active: {
    id: "active",
    label: "Ativo / Operacional",
    order: 10,
    description: "Cliente ativo em produção com serviços habilitados e entrada em recorrência.",
    badgeVariant: "success",
    responsibleParty: "system",
  },
  blocked: {
    id: "blocked",
    label: "Bloqueado",
    order: 99,
    description: "Processo pausado devido a divergência comercial, promessa fora de escopo ou falta de acesso.",
    badgeVariant: "destructive",
    responsibleParty: "operations",
  },
  cancelled: {
    id: "cancelled",
    label: "Cancelado",
    order: 100,
    description: "Onboarding cancelado formalmente antes da ativação operacional.",
    badgeVariant: "destructive",
    responsibleParty: "operations",
  },
};

export const ONBOARDING_STAGES = Object.keys(ONBOARDING_STAGES_META) as OnboardingStage[];
export const STAGE_DESCRIPTIONS = ONBOARDING_STAGES_META;

/**
 * Tabela explícita de transições permitidas para Onboarding de Clientes
 */
export const ALLOWED_ONBOARDING_TRANSITIONS: Record<OnboardingStage, readonly OnboardingStage[]> = {
  draft: ["awaiting_commercial_review", "blocked", "cancelled"],
  awaiting_commercial_review: ["awaiting_operations_review", "blocked", "cancelled"],
  awaiting_operations_review: ["awaiting_client_information", "blocked", "cancelled"],
  awaiting_client_information: ["collecting_access", "building_dna", "blocked", "cancelled"],
  collecting_access: ["building_dna", "establishing_baseline", "blocked", "cancelled"],
  building_dna: ["establishing_baseline", "planning_implementation", "blocked", "cancelled"],
  establishing_baseline: ["planning_implementation", "ready_for_activation", "blocked", "cancelled"],
  planning_implementation: ["ready_for_activation", "blocked", "cancelled"],
  ready_for_activation: ["active", "blocked", "cancelled"],
  active: ["cancelled"], // Uma vez ativo, só transiciona via encerramento formal
  blocked: [
    "awaiting_commercial_review",
    "awaiting_operations_review",
    "awaiting_client_information",
    "collecting_access",
    "building_dna",
    "establishing_baseline",
    "planning_implementation",
    "ready_for_activation",
    "cancelled",
  ],
  cancelled: [], // Estado terminal
};

export function canTransitionOnboarding(from: OnboardingStage, to: OnboardingStage): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_ONBOARDING_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

// ==============================================================================
// 2. Entidades Principais
// ==============================================================================

export type ClientUnitType = "headquarters" | "branch" | "service_area_hub";
export type ClientUnitStatus = "active" | "pending_verification" | "suspended" | "inactive";

export type ClientUnit = {
  id: string;
  agencyId: string;
  clientId: string;
  onboardingId?: string;
  name: string;
  unitType: ClientUnitType;
  isPhysicalStore: boolean;
  hasServiceArea: boolean;
  serviceRadiusKm?: number;
  status: ClientUnitStatus;
  phone?: string;
  email?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city: string;
  stateUf: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  businessHours: Record<string, { open: string; close: string; closed?: boolean }>;
  gbpPlaceId?: string;
  gbpLocationId?: string;
  gbpCid?: string;
  createdAt: string;
  updatedAt: string;
};

export const REQUIREMENT_CATEGORIES = [
  "business_data",
  "key_contacts",
  "brand_identity",
  "products_services",
  "locations_and_hours",
  "photos_media",
  "access_credentials",
  "consents_agreements",
  "goals_and_expectations",
  "restrictions_rules",
  "historical_background",
  "known_competitors",
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export type RequirementStatus = "pending" | "submitted" | "verified" | "waived";

export type OnboardingRequirement = {
  id: string;
  agencyId: string;
  onboardingId: string;
  clientId?: string;
  unitId?: string;
  category: RequirementCategory;
  title: string;
  description: string;
  responsible: "client" | "agency";
  isRequired: boolean;
  blocksActivation: boolean;
  status: RequirementStatus;
  deadline?: string;
  evidenceText?: string;
  evidenceUrl?: string;
  notes: string;
  waivedReason?: string;
  verifiedByActorId?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingBaseline = {
  id: string;
  agencyId: string;
  onboardingId: string;
  clientId: string;
  unitId?: string;
  version: number;
  source: "manual_audit" | "dna_inferred" | "connection_discovered" | "partial_telemetry";
  profileCompletenessScore: number | null;
  currentRating: number | null;
  currentReviewCount: number | null;
  unansweredReviewsCount: number | null;
  rankingVisibilityNotes: string;
  contentAudit: {
    hasCoverPhoto: boolean;
    hasLogo: boolean;
    photosCount: number;
    lastPostDate?: string;
    hasAttributes: boolean;
  };
  trackedKeywords: Array<{ keyword: string; intent?: string }>;
  knownCompetitors: Array<{ name: string; placeId?: string; notes?: string }>;
  availableConversions: {
    callsTracked?: boolean;
    websiteClicksTracked?: boolean;
    directionRequestsTracked?: boolean;
  };
  collectionLimitations: string[];
  unavailableDataPoints: string[];
  establishedByActorId: string;
  establishedAt: string;
  createdAt: string;
};

export type ImplementationPlanItem = {
  id: string;
  scopeItemId?: string;
  sopId?: string;
  activityName: string;
  description: string;
  deliveryType: "setup" | "recurring";
  frequency?: "once" | "daily" | "weekly" | "biweekly" | "monthly";
  defaultRole: string;
  estimatedMinutes: number;
  isAutomatable: boolean;
  clientParticipationRequired: boolean;
  dependencies: string[];
  acceptanceCriteria: string;
  requiredEvidence: string;
  assignedActorId?: string;
  assignedActorName?: string;
  plannedStartDate?: string;
  plannedCompletionDate?: string;
  completedAt?: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
};

export type ImplementationPlan = {
  id: string;
  agencyId: string;
  onboardingId: string;
  clientId: string;
  productDefinitionId: string;
  productVersion: number;
  status: "draft" | "ready" | "in_execution" | "completed";
  items: ImplementationPlanItem[];
  totalSetupMinutes: number;
  totalRecurringMonthlyMinutes: number;
  targetStartDate?: string;
  targetActivationDate?: string;
  plannedByActorId: string;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingDecisionType =
  | "commercial_review_approved"
  | "commercial_review_diverged"
  | "operations_review_approved"
  | "operations_review_blocked"
  | "requirement_waived"
  | "activation_submitted"
  | "activation_approved"
  | "onboarding_blocked"
  | "onboarding_unblocked"
  | "onboarding_cancelled";

export type OnboardingDecision = {
  id: string;
  agencyId: string;
  onboardingId: string;
  decisionType: OnboardingDecisionType;
  actorId: string;
  actorName: string;
  actorRole: string;
  reason: string;
  metadata?: Record<string, unknown>;
  decidedAt: string;
};

export type ClientOnboarding = {
  id: string;
  agencyId: string;
  clientId?: string;
  opportunityId: string;
  salesHandoffId: string;
  proposalId: string;
  productDefinitionId: string;
  productVersion: number;
  status: OnboardingStage;
  currentStage: OnboardingStage;
  divergenceReason?: string;
  blockingReason?: string;
  commercialScopeSnapshot: Record<string, unknown>;
  createdByActorId: string;
  assignedOperatorActorId?: string;
  idempotencyKey?: string;
  activatedAt?: string;
  activatedByActorId?: string;
  activationApprovalId?: string;
  createdAt: string;
  updatedAt: string;
};

// ==============================================================================
// 3. Regras de Negócio e Validações
// ==============================================================================

/**
 * 03.2 Conferência da Venda
 * Valida obrigatoriamente todos os critérios do handoff comercial antes de avançar.
 */
export type SalesConferenceResult = {
  valid: boolean;
  divergenceReason?: string;
  blockingIssues: string[];
};

export function validateSalesConference(params: {
  handoffStatus: string;
  companyName?: string;
  contactsCount: number;
  primaryContactName?: string;
  productDefinitionId?: string;
  productVersion: number;
  isProductApproved: boolean;
  setupPrice: number;
  monthlyPrice: number;
  hasSelectedScope: boolean;
  clientExpectations?: string;
  promisesMade?: string;
  operationalRisks?: string;
  criticalDependencies?: string;
}): SalesConferenceResult {
  const blockingIssues: string[] = [];

  // 1. Handoff deve estar aprovado formalmente
  if (params.handoffStatus !== "approved_for_onboarding") {
    blockingIssues.push(`Handoff comercial possui status '${params.handoffStatus}' (deve ser 'approved_for_onboarding').`);
  }

  // 2. Empresa e contato principal
  if (!params.companyName || params.companyName.trim().length < 2) {
    blockingIssues.push("Nome da empresa ausente ou inválido no handoff.");
  }
  if (params.contactsCount < 1 || !params.primaryContactName) {
    blockingIssues.push("Nenhum contato principal de decisão foi mapeado na venda.");
  }

  // 3. Produto e versão aprovados
  if (!params.productDefinitionId) {
    blockingIssues.push("Produto vendido não está associado a uma definição da Fábrica de Produtos.");
  }
  if (!params.isProductApproved) {
    blockingIssues.push("A versão do produto vinculada à proposta não possui aprovação formal.");
  }

  // 4. Preços registrados
  if (params.setupPrice < 0 || params.monthlyPrice < 0) {
    blockingIssues.push("Valores financeiros de implantação ou recorrência inválidos.");
  }

  // 5. Escopo vendido
  if (!params.hasSelectedScope) {
    blockingIssues.push("Itens de escopo vendido não foram especificados na proposta.");
  }

  // 6. Promessas de resultado fora de controle
  const promisesLower = (params.promisesMade || "").toLowerCase();
  const unallowedPromises = [
    "garantia de 1º lugar",
    "garantia de primeiro lugar",
    "garantia de ranking",
    "dobrar vendas garantido",
    "leads garantidos",
    "faturamento garantido",
  ];
  for (const unallowed of unallowedPromises) {
    if (promisesLower.includes(unallowed)) {
      blockingIssues.push(`Promessa indevida detectada: '${unallowed}'. Promessas externas de ranking ou vendas são proibidas.`);
    }
  }

  if (blockingIssues.length > 0) {
    return {
      valid: false,
      divergenceReason: `Divergência na conferência da venda: ${blockingIssues.join("; ")}`,
      blockingIssues,
    };
  }

  return {
    valid: true,
    blockingIssues: [],
  };
}

/**
 * 03.10 Critérios de Ativação (Checklist)
 */
export type ActivationCriterion =
  | "sales_verified"
  | "client_created_or_linked"
  | "units_confirmed"
  | "services_enabled"
  | "dna_minimum_confirmed"
  | "access_confirmed_or_waived"
  | "baseline_established"
  | "implementation_planned"
  | "responsibles_assigned"
  | "blocking_issues_resolved"
  | "human_approval_recorded";

export type ActivationChecklistItem = {
  key: ActivationCriterion;
  label: string;
  description: string;
  fulfilled: boolean;
  details?: string;
};

export type ActivationReadiness = {
  isReady: boolean;
  score: number; // 0 a 100
  items: ActivationChecklistItem[];
  missingCriteria: string[];
};

export function calculateActivationChecklist(params: {
  isSalesVerified: boolean;
  hasValidClient: boolean;
  unitsCount: number;
  enabledServicesCount: number;
  isDnaMinimumConfirmed: boolean;
  pendingRequiredAccesses: number;
  hasBaseline: boolean;
  hasImplementationPlan: boolean;
  hasAssignedResponsible: boolean;
  hasOpenBlockers: boolean;
  isHumanApprovalRecorded: boolean;
}): ActivationReadiness {
  const items: ActivationChecklistItem[] = [
    {
      key: "sales_verified",
      label: "Venda conferida e aprovada",
      description: "Handoff comercial e proposta conferidos sem divergências de escopo.",
      fulfilled: params.isSalesVerified,
      details: params.isSalesVerified ? "Conferência concluída com sucesso." : "Pendente de validação comercial/operacional.",
    },
    {
      key: "client_created_or_linked",
      label: "Cliente criado e validado",
      description: "Entidade de cliente vinculada com isolamento multiempresa seguro.",
      fulfilled: params.hasValidClient,
      details: params.hasValidClient ? "Cliente registrado no sistema." : "Cliente ainda não cadastrado ou vinculado.",
    },
    {
      key: "units_confirmed",
      label: "Unidades operacionais cadastradas",
      description: "Pelo menos uma unidade (sede ou filial) mapeada com precisão de endereço.",
      fulfilled: params.unitsCount > 0,
      details: params.unitsCount > 0 ? `${params.unitsCount} unidade(s) confirmada(s).` : "Nenhuma unidade cadastrada.",
    },
    {
      key: "services_enabled",
      label: "Serviços contratados habilitados",
      description: "Módulos de serviço ativados para o cliente (ex: SEO Local).",
      fulfilled: params.enabledServicesCount > 0,
      details: params.enabledServicesCount > 0 ? `${params.enabledServicesCount} serviço(s) habilitado(s).` : "Nenhum serviço habilitado.",
    },
    {
      key: "dna_minimum_confirmed",
      label: "DNA mínimo confirmado",
      description: "Fatos reais da empresa (segmento, dados fiscais, contatos e diferenciais) confirmados.",
      fulfilled: params.isDnaMinimumConfirmed,
      details: params.isDnaMinimumConfirmed ? "Fatos essenciais confirmados por operador." : "DNA incompleto ou pendente de revisão.",
    },
    {
      key: "access_confirmed_or_waived",
      label: "Acessos e integrações confirmados ou dispensados",
      description: "Acessos a GBP/ferramentas concedidos ou formalmente dispensados com motivo registrado.",
      fulfilled: params.pendingRequiredAccesses === 0,
      details: params.pendingRequiredAccesses === 0 ? "Todos os acessos obrigatórios atendidos." : `${params.pendingRequiredAccesses} acesso(s) obrigatório(s) pendente(s).`,
    },
    {
      key: "baseline_established",
      label: "Baseline inicial estruturado",
      description: "Diagnóstico inicial registrado com fidelidade factual sem pontuações inventadas.",
      fulfilled: params.hasBaseline,
      details: params.hasBaseline ? "Baseline salvo e versionado." : "Baseline de partida ainda não estabelecido.",
    },
    {
      key: "implementation_planned",
      label: "Plano de implantação gerado",
      description: "Cronograma de setup e rotinas mensais estruturado a partir da Fábrica de Produtos.",
      fulfilled: params.hasImplementationPlan,
      details: params.hasImplementationPlan ? "Plano de implantação gerado e pronto." : "Plano de implantação ausente.",
    },
    {
      key: "responsibles_assigned",
      label: "Responsáveis operacionais definidos",
      description: "Operador ou equipe responsável pela entrega atribuído formalmente.",
      fulfilled: params.hasAssignedResponsible,
      details: params.hasAssignedResponsible ? "Responsável operacional atribuído." : "Nenhum responsável alocado para o onboarding.",
    },
    {
      key: "blocking_issues_resolved",
      label: "Ausência de bloqueios ativos",
      description: "Nenhuma pendência crítica ou divergência comercial em aberto.",
      fulfilled: !params.hasOpenBlockers,
      details: !params.hasOpenBlockers ? "Nenhum bloqueio registrado." : "Existem bloqueios operacionais ou comerciais não resolvidos.",
    },
    {
      key: "human_approval_recorded",
      label: "Aprovação humana registrada",
      description: "Autorização final do líder de operações registrada na Central de Aprovações.",
      fulfilled: params.isHumanApprovalRecorded,
      details: params.isHumanApprovalRecorded ? "Aprovação humana confirmada." : "Aguardando aprovação humana final para ativar.",
    },
  ];

  const fulfilledCount = items.filter((i) => i.fulfilled).length;
  const score = Math.round((fulfilledCount / items.length) * 100);
  const missingCriteria = items.filter((i) => !i.fulfilled).map((i) => i.label);
  const isReady = fulfilledCount === items.length;

  return {
    isReady,
    score,
    items,
    missingCriteria,
  };
}

/**
 * 03.5 Geração de Requisitos Padrão
 * Gera os 12 requisitos canônicos de coleta para SEO Local e Gestão de Perfil.
 */
export function generateDefaultRequirements(params: {
  agencyId: string;
  onboardingId: string;
  clientId?: string;
  unitId?: string;
}): Array<Omit<OnboardingRequirement, "id" | "createdAt" | "updatedAt">> {
  const reqs: Array<Omit<OnboardingRequirement, "id" | "createdAt" | "updatedAt">> = [
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "business_data",
      title: "Dados Fiscais e Cadastrais (NAP)",
      description: "Razão social, nome fantasia, CNPJ, endereço oficial completo e telefone comercial primário.",
      responsible: "client",
      isRequired: true,
      blocksActivation: true,
      status: "pending",
      notes: "Essencial para consistência NAP (Name, Address, Phone) em todas as citações locais.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "key_contacts",
      title: "Contatos e Tomadores de Decisão",
      description: "Nome, WhatsApp e e-mail do tomador de decisão, responsável operacional e contato de emergência.",
      responsible: "client",
      isRequired: true,
      blocksActivation: true,
      status: "pending",
      notes: "Evita dependência de intermediários informais.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "brand_identity",
      title: "Logotipo e Identidade Visual",
      description: "Logotipo em vetor ou PNG de alta resolução, manual de marca ou cores institucionais.",
      responsible: "client",
      isRequired: true,
      blocksActivation: false,
      status: "pending",
      notes: "Usado na personalização das capas e postagens locais.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "products_services",
      title: "Tabela de Serviços e Produtos Principais",
      description: "Lista dos 5 a 10 serviços mais rentáveis com descrições detalhadas e diferenciais.",
      responsible: "client",
      isRequired: true,
      blocksActivation: true,
      status: "pending",
      notes: "Base para cadastrar o catálogo de produtos e serviços no Google Perfil da Empresa.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "locations_and_hours",
      title: "Horários de Funcionamento e Feriados",
      description: "Horário de atendimento presencial, pausas de almoço, feriados e atendimento telefônico.",
      responsible: "client",
      isRequired: true,
      blocksActivation: true,
      status: "pending",
      notes: "Horários incorretos geram avaliações negativas e reclamações de clientes.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "photos_media",
      title: "Fotos Reais do Espaço Físico e Equipe",
      description: "Mínimo de 10 fotos originais: fachada visível, interior, produtos em destaque e equipe trabalhando.",
      responsible: "client",
      isRequired: true,
      blocksActivation: false,
      status: "pending",
      notes: "Fotos de banco de imagem reduzem a autoridade no Google Perfil da Empresa.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "access_credentials",
      title: "Acesso de Gerente ao Google Perfil da Empresa",
      description: "Concessão do acesso de gerenciamento (sem fornecimento de senha pessoal) via Connection Hub.",
      responsible: "client",
      isRequired: true,
      blocksActivation: true,
      status: "pending",
      notes: "Obrigatório para gestão do perfil. Caso não possua ficha, será criada nova.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "consents_agreements",
      title: "Termo de Consentimento e Gestão de Respostas",
      description: "Autorização para sugestão de respostas de avaliações e publicação de atualizações de conteúdo.",
      responsible: "client",
      isRequired: true,
      blocksActivation: true,
      status: "pending",
      notes: "Conformidade jurídica e governança operacional.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "goals_and_expectations",
      title: "Objetivos Comerciais e Raio de Atuação",
      description: "Bairros e cidades prioritários para atendimento e metas de ligações ou rotas.",
      responsible: "agency",
      isRequired: true,
      blocksActivation: false,
      status: "pending",
      notes: "Alinhado durante a reunião de briefing com a equipe da agência.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "restrictions_rules",
      title: "Restrições de Comunicação e Regras de Tom de Voz",
      description: "Palavras proibidas, tom de voz desejado (formal, acolhedor, técnico) e diretrizes da marca.",
      responsible: "agency",
      isRequired: false,
      blocksActivation: false,
      status: "pending",
      notes: "Garante conformidade nas respostas e posts gerados pelos agentes.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "historical_background",
      title: "Ano de Fundação e História da Empresa",
      description: "Tempo de mercado, marcos relevantes e premiações locais.",
      responsible: "client",
      isRequired: false,
      blocksActivation: false,
      status: "pending",
      notes: "Alimenta o atributo de data de abertura no Perfil Google para autoridade temporal.",
    },
    {
      agencyId: params.agencyId,
      onboardingId: params.onboardingId,
      clientId: params.clientId,
      unitId: params.unitId,
      category: "known_competitors",
      title: "Concorrentes Conhecidos no Raio de Atuação",
      description: "Identificação dos 2 a 5 concorrentes diretos mais fortes na mesma região.",
      responsible: "agency",
      isRequired: false,
      blocksActivation: false,
      status: "pending",
      notes: "Utilizado para benchmarking de palavras-chave e posicionamento local.",
    },
  ];

  return reqs;
}

/**
 * 03.8 Validação de Baseline: Proíbe zeros ou métricas sintéticas
 * Ausência de integração não pode produzir valores zero como se fossem medições reais.
 */
export function validateBaselineData(baseline: Partial<OnboardingBaseline>): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Se não há integração, currentRating não pode ser fixado em 5.0 ou 0.0 artificialmente
  if (baseline.source === "manual_audit" && baseline.currentRating === 0) {
    warnings.push("Nota 0.0 observada: certifique-se de que a empresa realmente possui nota 0 no Google, e não ausência de dados.");
  }

  // Se collectionLimitations estiver vazio quando houver dados nulos
  if (
    (baseline.currentRating === null || baseline.currentReviewCount === null) &&
    (!baseline.collectionLimitations || baseline.collectionLimitations.length === 0)
  ) {
    warnings.push("Dados de avaliações ausentes exigem registro explícito em 'collectionLimitations'.");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * 03.9 Geração de Plano de Implantação a partir de Itens de Escopo do Produto
 */
export function generateImplementationPlanFromProduct(params: {
  scopeItems: Array<{
    id: string;
    activityName: string;
    description: string;
    deliveryType: "setup" | "recurring";
    frequency?: "once" | "daily" | "weekly" | "biweekly" | "monthly";
    defaultRole: string;
    estimatedMinutes: number;
    isAutomatable: boolean;
    clientParticipationRequired: boolean;
    dependencies?: string[];
    acceptanceCriteria: string;
    requiredEvidence: string;
  }>;
  targetStartDate?: string;
}): {
  items: ImplementationPlanItem[];
  totalSetupMinutes: number;
  totalRecurringMonthlyMinutes: number;
} {
  let totalSetupMinutes = 0;
  let totalRecurringMonthlyMinutes = 0;

  const items: ImplementationPlanItem[] = params.scopeItems.map((item, idx) => {
    if (item.deliveryType === "setup") {
      totalSetupMinutes += item.estimatedMinutes;
    } else {
      totalRecurringMonthlyMinutes += item.estimatedMinutes;
    }

    return {
      id: `plan-item-${idx + 1}-${item.id || Math.random().toString(36).slice(2, 7)}`,
      scopeItemId: item.id,
      activityName: item.activityName,
      description: item.description || "",
      deliveryType: item.deliveryType,
      frequency: item.frequency,
      defaultRole: item.defaultRole,
      estimatedMinutes: item.estimatedMinutes,
      isAutomatable: item.isAutomatable,
      clientParticipationRequired: item.clientParticipationRequired,
      dependencies: item.dependencies || [],
      acceptanceCriteria: item.acceptanceCriteria,
      requiredEvidence: item.requiredEvidence,
      plannedStartDate: params.targetStartDate,
      status: "pending",
    };
  });

  return {
    items,
    totalSetupMinutes,
    totalRecurringMonthlyMinutes,
  };
}
