export const HELP_CONTENT = {
  "operations.overview": {
    title: "Central de Operações",
    description: "Reúne o que precisa de atenção em toda a agência.",
    whyItMatters:
      "Ajuda você a começar pelas tarefas mais importantes, sem precisar abrir cada cliente.",
    nextStep: "Abra uma prioridade ou escolha um módulo para continuar.",
  },
  "clients.overview": {
    title: "Clientes",
    description: "É a carteira de empresas atendidas pela agência.",
    whyItMatters:
      "Cada cliente mantém seu próprio DNA, serviços, conexões e histórico.",
    nextStep: "Abra um cliente existente ou inicie um novo cadastro.",
  },
  "local_seo.overview": {
    title: "SEO Local",
    description:
      "Organiza ações para melhorar a presença do cliente nas buscas locais.",
    whyItMatters:
      "Centraliza perfil, avaliações, conteúdo, palavras-chave e oportunidades.",
    nextStep: "Comece pela visão geral e avance pelos itens que pedem atenção.",
  },
  "local_score.overview": {
    title: "Local Score",
    description:
      "Mostra a qualidade observada da presença local com base nos dados disponíveis.",
    whyItMatters:
      "Ajuda a priorizar melhorias, mas não garante posição no Google.",
    nextStep: "Confira a origem dos dados e os pilares com menor resultado.",
  },
  "connections.overview": {
    title: "Conexões",
    description: "Liga as contas usadas pelo cliente à Alastre Platform.",
    whyItMatters:
      "As conexões permitem usar dados reais sem expor credenciais na interface.",
    nextStep:
      "Quando uma integração estiver disponível, escolha a conta e o recurso correto.",
  },
  "skills.overview": {
    title: "Skills",
    description: "São guias de trabalho que ajudam a inteligência a seguir o padrão correto para cada tarefa.",
    whyItMatters: "Mantêm produto, segurança, arquitetura e SEO Local consistentes sem exigir comandos especiais.",
    nextStep: "Consulte o catálogo para entender quando cada guia é usado. A seleção é automática.",
  },
  "approval.action": {
    title: "Aprovação interna",
    description: "Marca o item como revisado pela equipe.",
    whyItMatters:
      "Aprovar não publica automaticamente no Google ou em outra plataforma.",
    nextStep: "Revise o conteúdo antes de confirmar.",
  },
  "status.no_data": {
    title: "Sem dados suficientes",
    description:
      "Ainda não existem informações confiáveis para calcular este indicador.",
    whyItMatters: "A plataforma evita mostrar números inventados.",
    nextStep: "Conecte uma fonte ou registre evidências manualmente.",
  },
  "keywords.overview": {
    title: "Palavras-chave",
    description: "São buscas que clientes reais podem fazer no Google.",
    whyItMatters: "Elas orientam conteúdo e oportunidades locais.",
    nextStep: "Cadastre termos ligados aos serviços e à cidade atendida.",
  },
  "rank_tracking.overview": {
    title: "Monitoramento de posição",
    description:
      "Acompanha onde a empresa aparece para uma busca e local específicos.",
    whyItMatters: "A posição varia conforme localização, horário e contexto.",
    nextStep: "Aguarde a conexão de um provedor de ranking real.",
  },
  "client-journey": {
    title: "Esteira do Cliente",
    description: "Organiza o checklist operacional completo e o fluxo de trabalho do cliente.",
    whyItMatters: "Permite acompanhar exatamente em que fase cada cliente está e agir diretamente na ferramenta certa.",
    nextStep: "Percorra as atividades da esteira e clique no atalho para executar no sistema.",
  },
} as const;

export type HelpKey = keyof typeof HELP_CONTENT;
