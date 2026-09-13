export const profileAuditCatalog=[
 ["name","Nome"],["primary_category","Categoria principal"],["additional_categories","Categorias adicionais"],["description","Descrição"],["phone","Telefone"],["website","Website"],["address","Endereço / área"],["hours","Horários"],["special_hours","Horários especiais"],["services","Serviços"],["products","Produtos"],["attributes","Atributos"],["photos","Fotos"],["logo","Logo"],["cover","Capa"],["links","Links"],["questions","Perguntas e respostas"],["completeness","Completude geral"],
] as const;
export const localScoreWeights={profile:20,relevance:15,reputation:20,content:15,authority:10,local_presence:10,conversion:10} as const;
export const opportunityCategories=["Perfil","Avaliações","Conteúdo","Palavras-chave","Concorrência","Conversão","Autoridade","Presença Local"] as const;
export const keywordIntents=["Transacional","Comercial","Local","Informacional","Marca"] as const;
export const dataConfidenceLabels={high:"Alta",medium:"Média",low:"Baixa",none:"Sem evidência"} as const;
export type LocalRankProviderStatus="not_configured"|"ready"|"syncing"|"healthy"|"error";
export interface LocalRankProvider{readonly status:LocalRankProviderStatus;readonly name:string|null;}
export const unconfiguredLocalRankProvider:LocalRankProvider={status:"not_configured",name:null};
