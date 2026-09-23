import type { View } from "@/app/app-shell";

export type JourneyTrack = "gmn" | "gtp" | "both";

export type JourneyStatus = "pending" | "in_progress" | "completed" | "blocked";

export type KanbanColumn = "entrada" | "organizando" | "executando" | "entregue";

export type JourneyStageId =
  | "onboarding"
  | "briefing"
  | "setup"
  | "management"
  | "delivery"
  | "gtp_tech"
  | "gtp_campaigns"
  | "gtp_monitor";

export type JourneyStage = {
  id: JourneyStageId;
  title: string;
  order: number;
  description: string;
  badgeColor: "orange" | "yellow" | "blue" | "green" | "red" | "purple";
  emoji: string;
  track: JourneyTrack;
};

export type JourneyTask = {
  id: string;
  stageId: JourneyStageId;
  track: JourneyTrack;
  title: string;
  description: string;
  targetView?: View;
  targetViewLabel?: string;
  kanbanColumn: KanbanColumn;
  actionHint?: string;
  whatsappTemplate?: string;
  defaultResponsible?: string;
};

export type ClientTaskState = {
  status: JourneyStatus;
  assignee?: string;
  executionDate?: string;
  notes?: string;
  updatedAt?: string;
};

export type ClientJourneyDates = {
  startDate?: string;
  endDate?: string;
};

export type ClientJourneyState = {
  clientId: string;
  tasks: Record<string, ClientTaskState>;
  dates?: ClientJourneyDates;
  lastUpdated: string;
};

export const JOURNEY_STAGES: JourneyStage[] = [
  // Fases Oficiais do GMN (Planilha Alastre Digital)
  {
    id: "onboarding",
    title: "1. ONBOARDING",
    order: 1,
    description: "Ações de entrada, grupo no WhatsApp, contrato, pagamento e agendamento de briefing.",
    badgeColor: "orange",
    emoji: "🟠",
    track: "gmn",
  },
  {
    id: "briefing",
    title: "2. BRIEFING",
    order: 2,
    description: "Reunião de alinhamento, confirmação de produtos/horários, solicitação de mídias e acesso de gerente GMN.",
    badgeColor: "yellow",
    emoji: "🟡",
    track: "gmn",
  },
  {
    id: "setup",
    title: "3. PREPARAÇÃO E CONFIGURAÇÃO INICIAL",
    order: 3,
    description: "Presença local, auditoria GBP, cliente na IA, estudo de palavras-chave, GeoSetter/Geotag e FAQ.",
    badgeColor: "blue",
    emoji: "🔵",
    track: "gmn",
  },
  {
    id: "management",
    title: "4. GESTÃO CONTÍNUA",
    order: 4,
    description: "Preenchimento total do perfil, resposta de avaliações, postagens semanais, relatórios e guias locais.",
    badgeColor: "green",
    emoji: "🟢",
    track: "gmn",
  },
  {
    id: "delivery",
    title: "5. ENTREGA E ENCERRAMENTO",
    order: 5,
    description: "Oferta de plano mensal, entrega da pasta do Drive com materiais, consultoria e UpSell.",
    badgeColor: "red",
    emoji: "🔴",
    track: "gmn",
  },

  // Fases Complementares do GTP (Tráfego Pago & Performance)
  {
    id: "gtp_tech",
    title: "6. CONFIGURAÇÕES TÉCNICAS (GTP)",
    order: 6,
    description: "Contas de anúncios Google/Meta, instalação de GTM, GA4, Meta Pixel e eventos de conversão.",
    badgeColor: "purple",
    emoji: "🟣",
    track: "gtp",
  },
  {
    id: "gtp_campaigns",
    title: "7. CAMPANHAS DE ANÚNCIOS (GTP)",
    order: 7,
    description: "Criação de grupos de anúncios, segmentação local, criativos e aprovação humana de publicação.",
    badgeColor: "purple",
    emoji: "🟣",
    track: "gtp",
  },
  {
    id: "gtp_monitor",
    title: "8. MONITORAMENTO GTP (48H)",
    order: 8,
    description: "Acompanhamento inicial de tráfego, integridade de disparos de conversão e custo por lead.",
    badgeColor: "purple",
    emoji: "🟣",
    track: "gtp",
  },
];

export const JOURNEY_TASKS: JourneyTask[] = [
  // 🟠 1. ONBOARDING (GMN)
  {
    id: "gmn-onb-whatsapp-group",
    stageId: "onboarding",
    track: "gmn",
    title: "Criar grupo no WhatsApp",
    description: "Criar o grupo exclusivo com o cliente e equipe da agência para comunicação ágil.",
    kanbanColumn: "entrada",
    actionHint: "whatsapp_copy",
    whatsappTemplate: "Olá! Seja muito bem-vindo(a) à Alastre Digital! Criamos este grupo exclusivo para alinharmos os passos da gestão do seu Google Perfil e posicionamento local. Vamos iniciar nosso onboarding!",
  },
  {
    id: "gmn-onb-payment-link",
    stageId: "onboarding",
    track: "gmn",
    title: "Enviar link de pagamento (Programar Recorrência)",
    description: "Enviar fatura e programar a cobrança recorrente da gestão de SEO Local.",
    targetView: "finance",
    targetViewLabel: "Abrir Financeiro",
    kanbanColumn: "entrada",
  },
  {
    id: "gmn-onb-drive-folder",
    stageId: "onboarding",
    track: "gmn",
    title: "Criar pasta do cliente no Google Drive (usar template)",
    description: "Criar a estrutura padrão de pastas para armazenar fotos originais, relatórios e artes.",
    targetView: "dna",
    targetViewLabel: "Abrir DNA / Arquivos",
    kanbanColumn: "entrada",
  },
  {
    id: "gmn-onb-data-form",
    stageId: "onboarding",
    track: "gmn",
    title: "Enviar formulário de dados",
    description: "Disponibilizar o formulário de coleta estruturada do negócio para preenchimento.",
    targetView: "dna",
    targetViewLabel: "Abrir DNA do Cliente",
    kanbanColumn: "entrada",
  },
  {
    id: "gmn-onb-contract-sign",
    stageId: "onboarding",
    track: "gmn",
    title: "Elaborar e coletar assinaturas do contrato",
    description: "Formalizar o contrato de prestação de serviços de otimização de perfil e posicionamento local.",
    targetView: "commercial",
    targetViewLabel: "Abrir Comercial",
    kanbanColumn: "entrada",
  },
  {
    id: "gmn-onb-welcome-message",
    stageId: "onboarding",
    track: "gmn",
    title: "Enviar mensagem de boas-vindas (onboarding) no WhatsApp",
    description: "Apresentar a metodologia da agência e explicar os próximos passos do projeto.",
    kanbanColumn: "entrada",
    actionHint: "whatsapp_copy",
    whatsappTemplate: "Tudo pronto para iniciarmos! Nossa equipe já está preparando o briefing e a auditoria inicial do seu Perfil Google para alavancarmos sua visibilidade local.",
  },
  {
    id: "gmn-onb-schedule-briefing",
    stageId: "onboarding",
    track: "gmn",
    title: "Agendar reunião de briefing",
    description: "Marcar o encontro inicial de alinhamento com os tomadores de decisão da empresa.",
    kanbanColumn: "entrada",
  },

  // 🟡 2. BRIEFING (GMN)
  {
    id: "gmn-brf-conduct-meeting",
    stageId: "briefing",
    track: "gmn",
    title: "Realizar reunião de briefing",
    description: "Mapear dores, diferenciais competitivos, raio de atendimento e metas de clientes.",
    targetView: "dna",
    targetViewLabel: "Registrar no DNA",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-confirm-products",
    stageId: "briefing",
    track: "gmn",
    title: "Confirmar serviços e produtos oferecidos",
    description: "Listar detalhadamente os principais serviços/produtos comercializados pelo cliente.",
    targetView: "dna",
    targetViewLabel: "Cadastrar Serviços no DNA",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-business-hours",
    stageId: "briefing",
    track: "gmn",
    title: "Definir horário de funcionamento",
    description: "Confirmar horários de abertura, fechamento, feriados e pausas de almoço.",
    targetView: "local-seo",
    targetViewLabel: "Perfil Google / Horários",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-request-media",
    stageId: "briefing",
    track: "gmn",
    title: "Solicitar logo, fotos e vídeos da empresa",
    description: "Receber imagens em alta resolução do espaço físico, equipe, fachada e produtos.",
    targetView: "dna",
    targetViewLabel: "Anexar Mídias no DNA",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-request-gmn-manager",
    stageId: "briefing",
    track: "gmn",
    title: "Solicitar acesso como gerente no perfil GMN",
    description: "Enviar solicitação de gerenciamento do Google Business Profile sem posse de senha.",
    targetView: "connections",
    targetViewLabel: "Conexões e Acessos",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-confirm-whatsapp",
    stageId: "briefing",
    track: "gmn",
    title: "Confirmar número de WhatsApp comercial",
    description: "Garantir que o número cadastrado é o canal oficial de atendimento da empresa.",
    targetView: "dna",
    targetViewLabel: "Conferir no DNA",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-verify-form-data",
    stageId: "briefing",
    track: "gmn",
    title: "Verificar e complementar informações do formulário",
    description: "Checar dados fiscais, endereço com precisão (NAP) e categorias de atuação.",
    targetView: "dna",
    targetViewLabel: "Revisar DNA",
    kanbanColumn: "organizando",
  },
  {
    id: "gmn-brf-explain-reviews",
    stageId: "briefing",
    track: "gmn",
    title: "Explicar a importância de avaliações e perguntas no perfil",
    description: "Alinhar rotina ativa de coleta de avaliações reais com o cliente.",
    targetView: "local-seo",
    targetViewLabel: "Módulo de Avaliações",
    kanbanColumn: "organizando",
  },

  // 🔵 3. PREPARAÇÃO E CONFIGURAÇÃO INICIAL (GMN)
  {
    id: "gmn-set-test-create-profile",
    stageId: "setup",
    track: "gmn",
    title: "Testar acesso ou criar ficha no Google (aguardar 24h após criação)",
    description: "Validar se o acesso de gerente foi aceito ou se uma nova ficha precisa de verificação.",
    targetView: "connections",
    targetViewLabel: "Verificar Google",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-search-presence",
    stageId: "setup",
    track: "gmn",
    title: "Pesquisar presença local no Google e GBP-Check (registrar posição atual)",
    description: "Mapear a visibilidade no Local Pack e registrar o ponto de partida do cliente.",
    targetView: "local-seo",
    targetViewLabel: "Ver Local Score",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-audit-unanswered",
    stageId: "setup",
    track: "gmn",
    title: "Levantar e registrar avaliações/perguntas sem resposta",
    description: "Identificar avaliações antigas não respondidas que prejudicam o Local Score.",
    targetView: "local-seo",
    targetViewLabel: "Moderar Avaliações",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-activate-gbp-check",
    stageId: "setup",
    track: "gmn",
    title: "Ativar gerenciamento do perfil no GBP-Check (Auditoria 18 Itens)",
    description: "Rodar o checklist completo de 18 pontos de conformidade e atributos no Perfil Google.",
    targetView: "local-seo",
    targetViewLabel: "Auditoria Perfil Google",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-foundation-date",
    stageId: "setup",
    track: "gmn",
    title: "Cadastrar data de fundação da empresa",
    description: "Informar o ano/mês de abertura para acionar autoridade temporal no Google.",
    targetView: "dna",
    targetViewLabel: "Salvar no DNA",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-create-client-ai",
    stageId: "setup",
    track: "gmn",
    title: "Criar cliente na IA e carregar memória operacional",
    description: "Sincronizar a base de conhecimento do cliente para que os agentes gerem respostas e posts.",
    targetView: "agents",
    targetViewLabel: "Abrir Agente do Cliente",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-register-social-media",
    stageId: "setup",
    track: "gmn",
    title: "Cadastrar canais de mídias sociais",
    description: "Vincular perfis do Instagram, Facebook, LinkedIn e TikTok ao DNA do cliente.",
    targetView: "dna",
    targetViewLabel: "Cadastrar Redes no DNA",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-register-website",
    stageId: "setup",
    track: "gmn",
    title: "Cadastrar o site da empresa",
    description: "Registrar URL oficial e links de agendamento/contato.",
    targetView: "dna",
    targetViewLabel: "Registrar Site no DNA",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-prompt-keywords",
    stageId: "setup",
    track: "gmn",
    title: "Executar prompt 'Estudo de Palavras-chave' e salvar no Drive",
    description: "Descobrir buscas de cauda longa e intenções de compra no raio de atuação.",
    targetView: "local-seo",
    targetViewLabel: "Gerar Palavras-chave",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-keywords-google-ads",
    stageId: "setup",
    track: "gmn",
    title: "Realizar Estudo de palavras-chave via Google Ads",
    description: "Validar volume mensal de pesquisas e intenção de busca comercial na região.",
    targetView: "google-ads",
    targetViewLabel: "Palavras Google Ads",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-metadata-txt",
    stageId: "setup",
    track: "gmn",
    title: "Preencher arquivo .TXT de metadados",
    description: "Estruturar os termos, coordenadas e tags padronizadas para aplicação em lote.",
    targetView: "image-geotag",
    targetViewLabel: "Metadados de Geotag",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-geosetter-setup",
    stageId: "setup",
    track: "gmn",
    title: "Configurar GeoSetter com geolocalização e palavras-chave",
    description: "Usar a ferramenta nativa de Geotag de Imagens para embutir EXIF/GPS nas fotos.",
    targetView: "image-geotag",
    targetViewLabel: "Abrir Geotag Nativo",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-create-faq",
    stageId: "setup",
    track: "gmn",
    title: "Criar e publicar FAQ no perfil",
    description: "Inserir as principais dúvidas frequentes com respostas claras diretamente na ficha.",
    targetView: "local-seo",
    targetViewLabel: "Oportunidades & FAQ",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-qr-review-art",
    stageId: "setup",
    track: "gmn",
    title: "Criar e entregar arte de avaliação com QR Code",
    description: "Gerar o link direto e arte para balcão/displays incentivando avaliações 5 estrelas.",
    targetView: "local-seo",
    targetViewLabel: "Gerar Link Avaliação",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-set-initial-report",
    stageId: "setup",
    track: "gmn",
    title: "Entregar relatório inicial ao cliente",
    description: "Apresentar o diagnóstico de partida com as melhorias que serão implementadas.",
    targetView: "reports",
    targetViewLabel: "Abrir Relatórios",
    kanbanColumn: "executando",
  },

  // 🟢 4. GESTÃO CONTÍNUA (GMN)
  {
    id: "gmn-gst-fill-all-fields",
    stageId: "management",
    track: "gmn",
    title: "Preencher todos os campos do perfil (aguardar 24h após atualizações sensíveis)",
    description: "Completar 100% da ficha Google: descrição rica, formas de pagamento, acessibilidade, etc.",
    targetView: "local-seo",
    targetViewLabel: "Auditoria 18 Itens",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-whatsapp-shortlink",
    stageId: "management",
    track: "gmn",
    title: "Criar link encurtado do WhatsApp (botão 'Saiba Mais')",
    description: "Direcionar usuários para atendimento rápido com mensagem pré-definida.",
    targetView: "dna",
    targetViewLabel: "Link WhatsApp no DNA",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-reply-reviews",
    stageId: "management",
    track: "gmn",
    title: "Responder avaliações e perguntas pendentes",
    description: "Usar o assistente de IA para responder em tom estratégico e empático.",
    targetView: "local-seo",
    targetViewLabel: "Responder Avaliações",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-standard-designs",
    stageId: "management",
    track: "gmn",
    title: "Criar designs padronizados (720x720 ou 1200x900)",
    description: "Padronizar imagens de postagens e catálogo de produtos no formato aceito pelo Google.",
    targetView: "image-geotag",
    targetViewLabel: "Processar Imagens",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-edit-media",
    stageId: "management",
    track: "gmn",
    title: "Editar imagens e vídeos enviados",
    description: "Aplicar tratamento de cor, enquadramento e injeção de geotagueamento.",
    targetView: "image-geotag",
    targetViewLabel: "Geotag e Fotos",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-configure-products-services",
    stageId: "management",
    track: "gmn",
    title: "Configurar serviços e produtos",
    description: "Cadastrar tabela de serviços com descrições detalhadas e preços quando aplicável.",
    targetView: "local-seo",
    targetViewLabel: "Cadastrar Serviços",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-program-posts",
    stageId: "management",
    track: "gmn",
    title: "Programar postagens semanais no GBP-Check: (1ª e 2ª Sem: 3 posts/sem | 3ª Sem+: 2 posts/sem)",
    description: "Publicar Novidades, Ofertas e Eventos com CTAs oficiais mantendo o perfil ativo.",
    targetView: "local-seo",
    targetViewLabel: "Planejador de Posts",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-biweekly-report",
    stageId: "management",
    track: "gmn",
    title: "Programar Relatório Quinzenal (ações e status)",
    description: "Emitir resumo das ações de otimização realizadas no período para acompanhamento.",
    targetView: "reports",
    targetViewLabel: "Relatório Quinzenal",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-monthly-report",
    stageId: "management",
    track: "gmn",
    title: "Criar lembrete: Relatório Mensal (métricas, números e comparativos)",
    description: "Consolidar chamadas, rotas, visualizações e crescimento de notas/avaliações.",
    targetView: "reports",
    targetViewLabel: "Relatório Mensal",
    kanbanColumn: "executando",
  },
  {
    id: "gmn-gst-local-directories",
    stageId: "management",
    track: "gmn",
    title: "Cadastro nos Guias Locais (Somente para clientes RECORRENTES)",
    description: "Construir citações consistentes (NAP) em diretórios como Telelistas, Apontador, etc.",
    targetView: "local-seo",
    targetViewLabel: "Ver Oportunidades",
    kanbanColumn: "executando",
  },

  // 🔴 5. ENTREGA E ENCERRAMENTO (GMN)
  {
    id: "gmn-ent-monthly-plan",
    stageId: "delivery",
    track: "gmn",
    title: "Oferecer plano de gestão mensal (crescimento do perfil)",
    description: "Apresentar a proposta de continuidade com gestão contínua de avaliações, posts e ranking.",
    targetView: "commercial",
    targetViewLabel: "Proposta Comercial",
    kanbanColumn: "entregue",
  },
  {
    id: "gmn-ent-drive-materials",
    stageId: "delivery",
    track: "gmn",
    title: "Entregar link da pasta no Drive com todo o material produzido",
    description: "Disponibilizar fotos tratadas, arquivos EXIF, relatórios e artes para o cliente.",
    targetView: "dna",
    targetViewLabel: "Entregáveis no DNA",
    kanbanColumn: "entregue",
  },
  {
    id: "gmn-ent-best-practices",
    stageId: "delivery",
    track: "gmn",
    title: "Consultoria de boas práticas (Google Perfil da Empresa)",
    description: "Orientar a equipe do cliente a coletar avaliações no balcão e manter dados alinhados.",
    targetView: "reports",
    targetViewLabel: "Relatório Final",
    kanbanColumn: "entregue",
  },
  {
    id: "gmn-ent-upsell",
    stageId: "delivery",
    track: "gmn",
    title: "UpSell: oferecer serviços adicionais (tráfego, site, identidade visual etc.)",
    description: "Expandir o contrato oferecendo campanhas de Google Ads, Meta Ads ou Landing Page.",
    targetView: "commercial",
    targetViewLabel: "UpSell Comercial",
    kanbanColumn: "entregue",
  },

  // 🟣 FASES COMPLEMENTARES GTP (TRÁFEGO & PERFORMANCE)
  {
    id: "gtp-ad-accounts",
    stageId: "gtp_tech",
    track: "gtp",
    title: "Configurar ou validar contas de anúncios (Google Ads / Meta Ads)",
    description: "Garantir vínculo correto com a MCC / Gerenciador de Negócios da agência.",
    targetView: "google-ads",
    targetViewLabel: "Abrir Google Ads",
    kanbanColumn: "executando",
  },
  {
    id: "gtp-gtm-ga4",
    stageId: "gtp_tech",
    track: "gtp",
    title: "Configurar pixel de rastreamento (Meta Pixel, GTM e GA4)",
    description: "Instalar contêiner do GTM no site do cliente e conectar propriedade GA4.",
    targetView: "tracking",
    targetViewLabel: "Abrir GTM e GA4",
    kanbanColumn: "executando",
  },
  {
    id: "gtp-conversion-events",
    stageId: "gtp_tech",
    track: "gtp",
    title: "Definir e homologar eventos de conversão no site",
    description: "Criar acionadores para cliques de WhatsApp, chamadas telefônicas e envios de formulário.",
    targetView: "tracking",
    targetViewLabel: "Configurar Conversões",
    kanbanColumn: "executando",
  },
  {
    id: "gtp-campaigns-build",
    stageId: "gtp_campaigns",
    track: "gtp",
    title: "Estruturar campanhas de Google Ads e Meta Ads",
    description: "Configurar grupos de anúncios, palavras-chave de alta intenção e criativos.",
    targetView: "google-ads",
    targetViewLabel: "Abrir Google Ads",
    kanbanColumn: "executando",
  },
  {
    id: "gtp-campaigns-approval",
    stageId: "gtp_campaigns",
    track: "gtp",
    title: "Submeter campanhas para aprovação humana antes de publicar",
    description: "Revisar verbas, links de destino e conformidade antes de ativar no canal.",
    targetView: "approvals",
    targetViewLabel: "Central de Aprovações",
    kanbanColumn: "entregue",
  },
  {
    id: "gtp-monitor-first-48h",
    stageId: "gtp_monitor",
    track: "gtp",
    title: "Acompanhar desempenho e conversões nas primeiras 48 horas",
    description: "Garantir que os leads gerados estão computando com custo por conversão saudável.",
    targetView: "tracking",
    targetViewLabel: "Verificar Disparos",
    kanbanColumn: "entregue",
  },
];

export function filterTasks(
  tasks: JourneyTask[],
  options: {
    track?: JourneyTrack | "all";
    stageId?: JourneyStageId;
    statusFilter?: "all" | "pending" | "completed" | "in_progress";
    clientState?: ClientJourneyState;
  },
): JourneyTask[] {
  return tasks.filter((task) => {
    if (options.track && options.track !== "all") {
      if (task.track !== "both" && task.track !== options.track) return false;
    }
    if (options.stageId && task.stageId !== options.stageId) return false;
    if (options.statusFilter && options.statusFilter !== "all" && options.clientState) {
      const currentStatus = options.clientState.tasks[task.id]?.status ?? "pending";
      if (options.statusFilter === "pending") {
        if (currentStatus === "completed") return false;
      } else if (currentStatus !== options.statusFilter) {
        return false;
      }
    }
    return true;
  });
}

export function calculateJourneyProgress(
  clientState: ClientJourneyState | undefined,
  filteredTasks: JourneyTask[] = JOURNEY_TASKS,
): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  percentage: number;
  currentStage: JourneyStage;
} {
  const total = filteredTasks.length;
  if (!total) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      percentage: 0,
      currentStage: JOURNEY_STAGES[0],
    };
  }

  let completed = 0;
  let inProgress = 0;
  let blocked = 0;

  for (const task of filteredTasks) {
    const status = clientState?.tasks[task.id]?.status ?? "pending";
    if (status === "completed") completed++;
    else if (status === "in_progress") inProgress++;
    else if (status === "blocked") blocked++;
  }

  const pending = total - (completed + inProgress + blocked);
  const percentage = Math.round((completed / total) * 100);

  // Determina a fase ativa atual (primeira fase que tiver tarefas incompletas)
  let currentStage = JOURNEY_STAGES[0];
  for (const stage of JOURNEY_STAGES) {
    const stageTasks = filteredTasks.filter((t) => t.stageId === stage.id);
    if (!stageTasks.length) continue;
    const hasUnfinished = stageTasks.some(
      (t) => (clientState?.tasks[t.id]?.status ?? "pending") !== "completed",
    );
    if (hasUnfinished) {
      currentStage = stage;
      break;
    }
  }

  return {
    total,
    completed,
    inProgress,
    pending,
    blocked,
    percentage,
    currentStage,
  };
}

export function calculateStageProgress(
  stageId: JourneyStageId,
  clientState: ClientJourneyState | undefined,
  tasks: JourneyTask[] = JOURNEY_TASKS,
): { total: number; completed: number; percentage: number } {
  const stageTasks = tasks.filter((t) => t.stageId === stageId);
  const total = stageTasks.length;
  if (!total) return { total: 0, completed: 0, percentage: 0 };
  const completed = stageTasks.filter(
    (t) => (clientState?.tasks[t.id]?.status ?? "pending") === "completed",
  ).length;
  return {
    total,
    completed,
    percentage: Math.round((completed / total) * 100),
  };
}

export function getClientJourneyStorageKey(clientId: string): string {
  return `alastre.clientJourney.${clientId}`;
}

export function loadClientJourneyState(clientId: string): ClientJourneyState {
  if (typeof window === "undefined" || !clientId) {
    return { clientId, tasks: {}, lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(getClientJourneyStorageKey(clientId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.tasks === "object") {
        return parsed as ClientJourneyState;
      }
    }
  } catch {
    // Fallback
  }
  return { clientId, tasks: {}, lastUpdated: new Date().toISOString() };
}

export function saveClientJourneyState(state: ClientJourneyState): void {
  if (typeof window === "undefined" || !state.clientId) return;
  try {
    window.localStorage.setItem(
      getClientJourneyStorageKey(state.clientId),
      JSON.stringify({ ...state, lastUpdated: new Date().toISOString() }),
    );
  } catch {
    // Ignora quota
  }
}
