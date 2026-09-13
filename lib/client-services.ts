export const clientServiceKeys=["local_seo","google_ads","meta_ads","sites_seo","reports","commercial","finance"] as const;
export type ClientServiceKey=typeof clientServiceKeys[number];
export type ClientServiceStatus="active"|"inactive"|"pending";
export const clientServiceCatalog:Record<ClientServiceKey,{name:string;description:string}>={
 local_seo:{name:"SEO Local",description:"Perfil Google, reputação, conteúdo e presença local."},
 google_ads:{name:"Google Ads",description:"Campanhas e mídia paga no Google."},
 meta_ads:{name:"Meta Ads",description:"Campanhas no Facebook e Instagram."},
 sites_seo:{name:"Sites & SEO",description:"Site, busca orgânica, performance e conversão."},
 reports:{name:"Relatórios",description:"Resultados e próximos passos consolidados."},
 commercial:{name:"Comercial",description:"Prospecção, oportunidades e pipeline."},
 finance:{name:"Financeiro",description:"Custos, recorrência e rentabilidade."},
};
