import {NextRequest,NextResponse} from "next/server";
import {connectionHubRequest,providers,statusCopy} from "@/lib/connection-hub-domain";
import {checkGoogleConnectionHealth,createHubRuntime,googleConfigurationStatus,sanitizeError} from "@/lib/connection-hub/service";
const friendlyConnectionError=(code:string)=>code==="actor_forbidden"?"Você não possui acesso a esta organização.":code==="client_not_found"?"Cliente não encontrado nesta organização.":code==="resource_not_available"?"Este Perfil da Empresa não está disponível para vinculação.":"O Connection Hub está temporariamente indisponível.";
export async function POST(request:NextRequest){
 try{
  const email=request.headers.get("oai-authenticated-user-email")??(process.env.NODE_ENV==="development"?"ag.alastredigital@gmail.com":null);
  if(!email)return NextResponse.json({error:{code:"unauthenticated",message:"Acesso não identificado."}},{status:401});
  const parsed=connectionHubRequest.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:{code:"invalid_request",message:"Não foi possível entender esta solicitação."}},{status:400});
  if(parsed.data.action==="providers")return NextResponse.json({providers,status_labels:statusCopy,google:googleConfigurationStatus()});
  if(parsed.data.action==="prepare_authorization"){const configuration=googleConfigurationStatus();return parsed.data.provider==="google"?configuration.providerAvailability!=="ready_for_oauth"?NextResponse.json({error:{code:"provider_pending",message:"A integração com o Google está sendo preparada pela Alastre. Nenhuma ação é necessária agora."},configuration},{status:503}):NextResponse.json({next:"/api/connections/google/authorize",configured:configuration.configured}):NextResponse.json({error:{code:"authorization_not_enabled",message:"A conexão Meta será habilitada futuramente."}},{status:501});}
  const configuration=googleConfigurationStatus();
  if(parsed.data.action==="health"&&configuration.providerAvailability!=="ready_for_oauth")return NextResponse.json({health:{status:configuration.health}});
  if(parsed.data.action==="client_connection"&&configuration.providerAvailability!=="ready_for_oauth")return NextResponse.json({connected:false,binding:null,provider_availability:configuration.providerAvailability,health:configuration.health});
  const runtime=createHubRuntime();
  if(!runtime)return NextResponse.json({available:false,items:[],configuration:googleConfigurationStatus(),error:{code:"connection_hub_not_configured",message:"Google precisa ser configurado pelo administrador da plataforma."}},{status:503});
  const actor=await runtime.repository.resolveActor(email);
  if(parsed.data.action==="health")return NextResponse.json({health:await checkGoogleConnectionHealth(runtime,actor,parsed.data.connection_id)});
  if(parsed.data.action==="bind_resource"){const binding=await runtime.repository.bindResource(actor,{clientId:parsed.data.client_id,resourceId:parsed.data.resource_id,capability:parsed.data.capability});await runtime.repository.audit(actor,"google.resource_bound","client_resource_binding",binding.id,{client_id:parsed.data.client_id,resource_id:parsed.data.resource_id,capability:parsed.data.capability});return NextResponse.json({binding});}
  if(parsed.data.action==="client_connection"){const binding=await runtime.repository.clientConnection(actor,parsed.data.client_id,parsed.data.capability);return NextResponse.json({connected:Boolean(binding),binding});}
  const snapshot=await runtime.repository.snapshot(actor);
  if(parsed.data.action==="connections")return NextResponse.json({items:snapshot.connections,resources:snapshot.resources,bindings:snapshot.bindings});
  if(parsed.data.action==="resources"){const {connection_id,capability}=parsed.data;return NextResponse.json({items:snapshot.resources.filter(item=>item.connection_id===connection_id&&(!capability||item.capability===capability))});}
  if(parsed.data.action==="bindings"){const {client_id}=parsed.data;return NextResponse.json({items:snapshot.bindings.filter(item=>!client_id||item.client_id===client_id)});}
  if(parsed.data.action==="connection_status"){const {connection_id}=parsed.data;return NextResponse.json({connection:snapshot.connections.find(item=>item.id===connection_id)??null});}
  if(parsed.data.action==="capabilities"){const {connection_id}=parsed.data;return NextResponse.json({items:providers.flatMap(provider=>provider.capabilities).filter(capability=>snapshot.resources.some(resource=>resource.connection_id===connection_id&&resource.capability===capability.key))});}
  return NextResponse.json({items:[]});
 }catch(error){const code=sanitizeError(error);const status=code==="actor_forbidden"?403:code.endsWith("not_found")?404:503;return NextResponse.json({error:{code,message:friendlyConnectionError(code)}},{status});}
}
