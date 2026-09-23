import type { PlaceholderConfig } from "./module-placeholder";

export const placeholderConfigs: Record<
  "meta-ads" | "sites-seo" | "reports" | "commercial" | "finance",
  PlaceholderConfig
> = {
  "meta-ads": {
    key: "meta-ads",
    eyebrow: "AQUISIÇÃO",
    title: "Meta Ads (Facebook & Instagram)",
    description:
      "Criação, otimização e governança de campanhas de tráfego pago na Meta com base no DNA do Cliente.",
    badge: "Planejado no Connection Hub",
    expectedFeatures: [
      {
        title: "Contas de Anúncios e Páginas",
        detail:
          "Conexão de contas de anúncios, páginas do Facebook e perfis comerciais do Instagram via Connection Hub.",
      },
      {
        title: "Criação de Anúncios com DNA",
        detail:
          "Geração de rascunhos de criativos e copys alinhados às regras comerciais e posicionamento do cliente.",
      },
      {
        title: "Aprovação Humana Obrigatória",
        detail:
          "Nenhum criativo ou campanha será ativado sem aprovação prévia e explícita na Central de Aprovações.",
      },
      {
        title: "Controle de Orçamento",
        detail:
          "Monitoramento de verba diária e proteção contra alterações acidentais ou não autorizadas de orçamento.",
      },
    ],
    actionHint:
      "Você pode conferir a disponibilidade do conector Meta e recursos nas Conexões.",
    ctaLabel: "Ver Conexões",
    ctaView: "connections",
  },
  "sites-seo": {
    key: "sites-seo",
    eyebrow: "CONTEÚDO E PERFORMANCE",
    title: "Sites & SEO Técnico",
    description:
      "Monitoramento de estrutura de site, páginas de conversão local, velocidade e dados estruturados Schema.org.",
    badge: "Em Roadmap",
    expectedFeatures: [
      {
        title: "Auditoria On-Page",
        detail:
          "Verificação de tags de título, meta descrições, hierarquia H1-H3 e links internos para localidades.",
      },
      {
        title: "Dados Estruturados LocalBusiness",
        detail:
          "Validação de marcação JSON-LD para Perfil da Empresa, serviços e áreas de atendimento.",
      },
      {
        title: "Core Web Vitals",
        detail:
          "Acompanhamento de velocidade, LCP, INP e estabilidade visual com foco em conversão mobile.",
      },
      {
        title: "Páginas de Destino (LPs)",
        detail:
          "Planejamento de páginas segmentadas por cidade e bairro com CTAs diretos para WhatsApp e chamada.",
      },
    ],
    actionHint:
      "Otimize fotos para páginas locais no módulo de Geotag de Imagens.",
    ctaLabel: "Abrir Geotag de Imagens",
    ctaView: "image-geotag",
  },
  reports: {
    key: "reports",
    eyebrow: "GESTÃO E RESULTADOS",
    title: "Relatórios Executivos",
    description:
      "Relatórios claros e objetivos para enviar aos clientes, destacando evolução de SEO Local, tráfego e conversões.",
    badge: "Em Estruturação",
    expectedFeatures: [
      {
        title: "Consolidação Multi-Canal",
        detail:
          "Unificação de métricas do Perfil Google, Google Ads, Meta Ads e GA4 em um único panorama.",
      },
      {
        title: "Evolução do Local Score",
        detail:
          "Comparativo visual do crescimento da autoridade e proeminência local do cliente ao longo do tempo.",
      },
      {
        title: "Linguagem Não Técnica (Modo Simples)",
        detail:
          "Explicações diretas e compreensíveis para empresários e tomadores de decisão, sem jargões confusos.",
      },
      {
        title: "Exportação em PDF e Link Seguro",
        detail:
          "Geração de relatórios com a identidade visual da agência e link com prazo de expiração configurável.",
      },
    ],
    actionHint:
      "Acompanhe as métricas e decisões em tempo real na Visão Geral da agência.",
    ctaLabel: "Ir para Visão Geral",
    ctaView: "overview",
  },
  commercial: {
    key: "commercial",
    eyebrow: "CRESCIMENTO DA AGÊNCIA",
    title: "Comercial & Prospecção",
    description:
      "Esteira de captação de clientes, diagnóstico preliminar de SEO Local e geração de propostas comerciais.",
    badge: "Planejado",
    expectedFeatures: [
      {
        title: "Diagnóstico Rápido de Prospecção",
        detail:
          "Varredura do Perfil Google de empresas da região para identificar falhas graves de SEO Local antes da abordagem.",
      },
      {
        title: "Gerador de Propostas",
        detail:
          "Elaboração de escopo personalizado de serviços com base nas lacunas detectadas no prospect.",
      },
      {
        title: "Pipeline de Vendas",
        detail:
          "Controle visual das etapas de prospecção, apresentação de diagnóstico, negociação e fechamento.",
      },
      {
        title: "Transição Direta para DNA",
        detail:
          "Transformação imediata dos dados coletados na proposta comercial no DNA do novo cliente no onboarding.",
      },
    ],
    actionHint:
      "Cadastre novos clientes fechados diretamente no módulo de Clientes.",
    ctaLabel: "Abrir Clientes",
    ctaView: "clients",
  },
  finance: {
    key: "finance",
    eyebrow: "CONTROLADORIA",
    title: "Gestão Financeira & Rentabilidade",
    description:
      "Controle de contratos, mensalidades, custos de ferramentas/IA por cliente e margem operacional da agência.",
    badge: "Planejado",
    expectedFeatures: [
      {
        title: "Mensalidades e Recorrência (MRR)",
        detail:
          "Visão consolidada de contratos ativos, renovações e faturamento recorrente da agência.",
      },
      {
        title: "Custo por Cliente (CAC e LTV)",
        detail:
          "Acompanhamento preciso de horas, consumo de IA e ferramentas alocadas para cada conta atendida.",
      },
      {
        title: "Rentabilidade por Serviço",
        detail:
          "Comparativo de margem de lucro entre SEO Local, Gestão de Anúncios e Criação de Sites.",
      },
      {
        title: "Integração com Cobrança",
        detail:
          "Emissão de boletos, PIX e notas fiscais automatizadas para os clientes da agência.",
      },
    ],
    actionHint:
      "Monitore os custos de IA já registrados no módulo de Custos e Auditoria.",
    ctaLabel: "Ver Custos de IA",
    ctaView: "costs",
  },
};
