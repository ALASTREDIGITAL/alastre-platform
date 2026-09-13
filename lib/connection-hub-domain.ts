import {z} from "zod";

export const providerAvailabilityStatuses=["not_configured","pending_provider_approval","ready_for_oauth"] as const;
export const connectionStatuses=["pending","connected","attention","expired","revoked","error","disconnected"] as const;
export const authorizationStatuses=["not_started","pending","authorized","expired","revoked","failed"] as const;
export const healthStatuses=["healthy","degraded","expired","reconnect_required","configuration_required","provider_pending","unknown"] as const;
export const syncStatuses=["idle","syncing","success","error"] as const;
export const connectionManagementModes=["platform_managed","customer_managed"] as const;
export type ProviderAvailabilityStatus=typeof providerAvailabilityStatuses[number];
export type ConnectionStatus=typeof connectionStatuses[number];
export type AuthorizationStatus=typeof authorizationStatuses[number];
export type ConnectionHealthStatus=typeof healthStatuses[number];
export type ConnectionManagementMode=typeof connectionManagementModes[number];
export type ProviderKey="google"|"meta"|"alastre_ai"|"electronic_signature"|"email";
export type CapabilityKey="google_business_profile"|"google_ads"|"google_analytics"|"google_tag_manager"|"meta_ads"|"facebook_pages"|"instagram_business"|"ai_generation";
export type ProviderDefinition={key:ProviderKey;name:string;group:"Google"|"Meta"|"IA"|"Futuro";description:string;availability:"ready"|"planned"|"included";managementMode:ConnectionManagementMode;capabilities:Array<{key:CapabilityKey;name:string;help:string}>};

export const googleCloudAdministration={projectName:"Alastre Platform",projectId:"alastre-platform",projectNumber:"286084102789",gbpAccessRequest:"4-5388000041735",redirectUri:"http://localhost:5173/api/connections/google/callback",writeMode:"disabled" as const};

export const providers:ProviderDefinition[]=[
 {key:"google",name:"Google",group:"Google",description:"Perfil da Empresa, anúncios e mensuração em uma conexão simples.",availability:"ready",managementMode:"platform_managed",capabilities:[{key:"google_business_profile",name:"Perfil da Empresa",help:"A ficha da empresa que aparece no Google e no Google Maps."},{key:"google_ads",name:"Google Ads",help:"Contas de anúncios e campanhas autorizadas."},{key:"google_analytics",name:"Google Analytics",help:"Propriedades usadas para medir visitas e resultados."},{key:"google_tag_manager",name:"Google Tag Manager",help:"Contêineres que organizam a mensuração do site."}]},
 {key:"meta",name:"Meta",group:"Meta",description:"Anúncios e presenças do Facebook e Instagram em um só lugar.",availability:"planned",managementMode:"platform_managed",capabilities:[{key:"meta_ads",name:"Meta Ads",help:"Contas de anúncios autorizadas."},{key:"facebook_pages",name:"Facebook",help:"Páginas comerciais disponíveis."},{key:"instagram_business",name:"Instagram",help:"Contas profissionais vinculadas."}]},
 {key:"alastre_ai",name:"IA Alastre",group:"IA",description:"Assistência inteligente incluída e administrada pela Alastre Platform.",availability:"included",managementMode:"platform_managed",capabilities:[{key:"ai_generation",name:"IA Alastre",help:"Geração assistida com as proteções e contexto da plataforma."}]},
 {key:"electronic_signature",name:"Assinatura eletrônica",group:"Futuro",description:"Assinaturas com provedores compatíveis, sem dependência de uma única marca.",availability:"planned",managementMode:"customer_managed",capabilities:[]},
 {key:"email",name:"E-mail",group:"Futuro",description:"Comunicação e automações de e-mail conectadas à operação.",availability:"planned",managementMode:"customer_managed",capabilities:[]},
];

export const statusCopy:Record<ConnectionStatus,{label:string;detail:string}>={pending:{label:"Preparando conexão",detail:"Falta concluir a autorização."},connected:{label:"Conectado",detail:"A conexão está funcionando normalmente."},attention:{label:"Precisa de atenção",detail:"Há uma etapa simples para corrigir."},expired:{label:"Reconexão necessária",detail:"Precisamos reconectar sua conta."},revoked:{label:"Acesso removido",detail:"A autorização não está mais ativa."},error:{label:"Problema na conexão",detail:"Encontramos um problema e preservamos seus dados."},disconnected:{label:"Não conectado",detail:"Conecte quando quiser ativar estes serviços."}};
export const healthCopy:Record<ConnectionHealthStatus,{label:string;detail:string}>={healthy:{label:"Saudável",detail:"A conexão está funcionando normalmente."},degraded:{label:"Atenção recomendada",detail:"Parte dos dados pode estar temporariamente indisponível."},expired:{label:"Autorização expirada",detail:"A conexão precisa ser renovada."},reconnect_required:{label:"Precisa reconectar",detail:"Entre novamente com a conta do provedor."},configuration_required:{label:"Configuração administrativa pendente",detail:"A Alastre ainda está preparando esta integração."},provider_pending:{label:"Aguardando liberação",detail:"Estamos aguardando a liberação do provedor."},unknown:{label:"Ainda não verificado",detail:"A saúde será verificada quando a integração estiver disponível."}};

const id=z.string().uuid();
export const connectionHubRequest=z.discriminatedUnion("action",[z.object({action:z.literal("providers")}),z.object({action:z.literal("connections")}),z.object({action:z.literal("connection_status"),connection_id:id}),z.object({action:z.literal("capabilities"),connection_id:id}),z.object({action:z.literal("resources"),connection_id:id,capability:z.string().trim().max(80).optional()}),z.object({action:z.literal("bindings"),client_id:id.optional()}),z.object({action:z.literal("client_connection"),client_id:id,capability:z.enum(["google_business_profile","google_ads","google_analytics","google_tag_manager","meta_ads","facebook_pages","instagram_business","ai_generation"])}),z.object({action:z.literal("prepare_authorization"),provider:z.enum(["google","meta"])}),z.object({action:z.literal("bind_resource"),client_id:id,resource_id:id,capability:z.string().trim().min(2).max(80)}),z.object({action:z.literal("health"),connection_id:id.optional()})]);
export function canBindResource(input:{clientAgencyId:string;resourceAgencyId:string;resourceCapability:string;requestedCapability:string;resourceActive:boolean}){return input.clientAgencyId===input.resourceAgencyId&&input.resourceCapability===input.requestedCapability&&input.resourceActive;}
export function getClientConnectionContract(clientId:string,capability:CapabilityKey){return {client_id:clientId,capability,requires_status:"connected" as const};}
