import {NextResponse} from "next/server";
import {localSeoRequest} from "@/lib/local-seo-domain";
import {serverEnv} from "@/lib/server-env";
import {extractAuthenticatedEmail} from "@/lib/server-auth";
export const dynamic="force-dynamic";
export async function POST(request:Request){const email=await extractAuthenticatedEmail(request);if(!email)return NextResponse.json({error:"Não autenticado."},{status:401});const parsed=localSeoRequest.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Payload inválido.",details:parsed.error.flatten().fieldErrors},{status:400});const url=serverEnv("SUPABASE_GOOGLE_ADS_BRIDGE_URL"),secret=serverEnv("ALASTRE_BRIDGE_SECRET");if(!url||!secret)return NextResponse.json({error:"Integração indisponível."},{status:503});try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-alastre-user-email":email,"x-alastre-bridge-secret":secret,"x-alastre-write-mode":"disabled"},body:JSON.stringify(parsed.data)});return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":response.headers.get("Content-Type")??"application/json"}})}catch{return NextResponse.json({error:"Integração indisponível."},{status:503})}}

