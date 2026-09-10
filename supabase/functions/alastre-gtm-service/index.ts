import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const J={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const EXPECTED_HASH="38b3cf4d6cf5f4b702d8f86bc998a7c7f61215c01a9a873a7cbb81e20c1900ce";
const WRITE_ACTIONS=new Set(["create_container","create_workspace","configure_workspace","create_version","publish_version"]);
function env(n:string){const v=Deno.env.get(n);if(!v)throw new Error(`Missing ${n}`);return v}
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:J})}
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("")}
async function authorized(req:Request){const value=req.headers.get("x-alastre-internal-secret")??"";return Boolean(value)&&await sha256(value)===(Deno.env.get("ALASTRE_INTERNAL_SECRET_HASH")??EXPECTED_HASH)}
async function keyBytes(){const raw=env("GTM_TOKEN_KEY");try{const d=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));if(d.length===32)return d}catch{}return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)))}
async function decrypt(c:string){const k=await crypto.subtle.importKey("raw",await keyBytes(),"AES-GCM",false,["decrypt"]);const a=Uint8Array.from(atob(c),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:a.slice(0,12)},k,a.slice(12)))}
async function accessToken(){const sql=postgres(env("SUPABASE_DB_URL"),{prepare:false,max:1});try{const rows=await sql`select refresh_token_ciphertext from gtm_private.oauth_connections where status='active' order by connected_at desc limit 1`;if(!rows[0])throw new Error("oauth_not_connected");const rt=await decrypt(rows[0].refresh_token_ciphertext);const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env("GTM_CLIENT_ID"),client_secret:env("GTM_CLIENT_SECRET"),refresh_token:rt,grant_type:"refresh_token"})});const body=await response.json();if(!response.ok||!body.access_token)throw new Error("oauth_refresh_failed");return String(body.access_token)}finally{await sql.end()}}
async function google(token:string,path:string,init:RequestInit={}){const response=await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${path}`,{...init,headers:{authorization:`Bearer ${token}`,"content-type":"application/json",...(init.headers??{})}});const text=await response.text();let body:unknown;try{body=JSON.parse(text)}catch{body=text}if(!response.ok)throw new Error(`google_gtm_${response.status}`);return body as Record<string,unknown>}
function valid(value:unknown,pattern:RegExp){return typeof value==="string"&&pattern.test(value)}
function objects(value:unknown,key:string){const item=value as Record<string,unknown>|null;return item&&Array.isArray(item[key])?item[key] as Record<string,unknown>[]:[]}
function safeEvent(value:unknown){const event=String(value??"");return /^[a-z][a-z0-9_]{1,39}$/.test(event)?event:""}

Deno.serve(async req=>{try{
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
  if(!(await authorized(req)))return reply({error:"forbidden"},403);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;if(!body||typeof body.action!=="string")return reply({error:"invalid_body"},400);
  if(WRITE_ACTIONS.has(body.action)&&(req.headers.get("x-alastre-write-mode")!=="approved_execution"||body.approved!==true||!valid(body.approval_id,/^[0-9a-f-]{36}$/i)))return reply({error:"external_write_locked"},423);
  if(body.action==="status")return reply({service:"alastre-gtm-service",status:"ready",security:"jwt_and_internal_secret",external_writes:"approval_required"});
  const token=await accessToken();
  if(body.action==="discover"){const accounts=await google(token,"accounts");const list=Array.isArray(accounts.account)?accounts.account as Record<string,unknown>[]:[];const groups=await Promise.all(list.slice(0,50).map(async account=>{const path=String(account.path??"");if(!valid(path,/^accounts\/\d+$/))return[];const result=await google(token,`${path}/containers`);return Array.isArray(result.container)?result.container:[]}));return reply({accounts:list,containers:groups.flat(),read_only:true})}
  if(body.action==="list_accounts")return reply(await google(token,"accounts"));
  if(body.action==="list_containers"){if(!valid(body.account,/^accounts\/\d+$/))return reply({error:"invalid_account"},400);return reply(await google(token,`${body.account}/containers`))}
  if(body.action==="list_workspaces"){if(!valid(body.container,/^accounts\/\d+\/containers\/\d+$/))return reply({error:"invalid_container"},400);return reply(await google(token,`${body.container}/workspaces`))}
  if(body.action==="list_versions"){if(!valid(body.container,/^accounts\/\d+\/containers\/\d+$/))return reply({error:"invalid_container"},400);return reply(await google(token,`${body.container}/versions`))}
  if(body.action==="configure_workspace"){
    if(!valid(body.workspace,/^accounts\/\d+\/containers\/\d+\/workspaces\/\d+$/))return reply({error:"invalid_workspace"},400);
    const manifest=body.manifest as Record<string,unknown>|undefined;
    const variableManifest=Array.isArray(manifest?.variables)?manifest.variables as Record<string,unknown>[]:[];
    const tagManifest=Array.isArray(manifest?.tags)?manifest.tags as Record<string,unknown>[]:[];
    const measurement=String(variableManifest[0]?.value??"");
    const eventSource=tagManifest.find(item=>Array.isArray(item.events));
    const events=(Array.isArray(eventSource?.events)?eventSource.events:[]).map(safeEvent).filter(Boolean).slice(0,30);
    if(!/^G-[A-Z0-9]+$/.test(measurement)||events.length===0)return reply({error:"invalid_manifest"},400);
    const [variableResult,triggerResult,tagResult]=await Promise.all([google(token,`${body.workspace}/variables`),google(token,`${body.workspace}/triggers`),google(token,`${body.workspace}/tags`)]);
    const variables=objects(variableResult,"variable"),triggers=objects(triggerResult,"trigger"),tags=objects(tagResult,"tag");
    const created:{variables:string[];triggers:string[];tags:string[]}={variables:[],triggers:[],tags:[]};
    const reused:{variables:string[];triggers:string[];tags:string[]}={variables:[],triggers:[],tags:[]};
    const variableName="ALASTRE - GA4 Measurement ID";
    if(variables.some(item=>item.name===variableName))reused.variables.push(variableName);else{await google(token,`${body.workspace}/variables`,{method:"POST",body:JSON.stringify({name:variableName,type:"c",parameter:[{type:"template",key:"value",value:measurement}]})});created.variables.push(variableName)}
    const googleTagName="ALASTRE - Google Tag";
    if(tags.some(item=>item.name===googleTagName))reused.tags.push(googleTagName);else{await google(token,`${body.workspace}/tags`,{method:"POST",body:JSON.stringify({name:googleTagName,type:"googtag",parameter:[{type:"template",key:"tagId",value:`{{${variableName}}}`}],firingTriggerId:["2147479553"]})});created.tags.push(googleTagName)}
    for(const event of events){
      const triggerName=`ALASTRE - Evento - ${event}`;let trigger=triggers.find(item=>item.name===triggerName);
      if(trigger)reused.triggers.push(triggerName);else{trigger=await google(token,`${body.workspace}/triggers`,{method:"POST",body:JSON.stringify({name:triggerName,type:"customEvent",customEventFilter:[{type:"equals",parameter:[{type:"template",key:"arg0",value:"{{_event}}"},{type:"template",key:"arg1",value:event}]}]})});created.triggers.push(triggerName);triggers.push(trigger)}
      const triggerId=String(trigger.triggerId??"");if(!/^\d+$/.test(triggerId))throw new Error("google_gtm_invalid_trigger_id");
      const tagName=`ALASTRE - GA4 - ${event}`;
      if(tags.some(item=>item.name===tagName))reused.tags.push(tagName);else{await google(token,`${body.workspace}/tags`,{method:"POST",body:JSON.stringify({name:tagName,type:"gaawe",parameter:[{type:"template",key:"eventName",value:event},{type:"template",key:"measurementId",value:`{{${variableName}}}`}],firingTriggerId:[triggerId]})});created.tags.push(tagName)}
    }
    return reply({workspace:body.workspace,measurement_id:measurement,events,created,reused,component_count:created.variables.length+created.triggers.length+created.tags.length+reused.variables.length+reused.triggers.length+reused.tags.length,published:false,idempotent:true},201);
  }
  if(body.action==="create_container"){if(!valid(body.account,/^accounts\/\d+$/))return reply({error:"invalid_account"},400);return reply(await google(token,`${body.account}/containers`,{method:"POST",body:JSON.stringify({name:String(body.name??""),usageContext:["web"],domainName:Array.isArray(body.domain_name)?body.domain_name:[]})}),201)}
  if(body.action==="create_workspace"){if(!valid(body.container,/^accounts\/\d+\/containers\/\d+$/))return reply({error:"invalid_container"},400);return reply(await google(token,`${body.container}/workspaces`,{method:"POST",body:JSON.stringify({name:String(body.name??"Workspace"),description:String(body.description??"")})}),201)}
  if(body.action==="create_version"){if(!valid(body.workspace,/^accounts\/\d+\/containers\/\d+\/workspaces\/\d+$/))return reply({error:"invalid_workspace"},400);return reply(await google(token,`${body.workspace}:create_version`,{method:"POST",body:JSON.stringify({name:String(body.name??"Version"),notes:String(body.notes??"")})}),201)}
  if(body.action==="publish_version"){if(!valid(body.version,/^accounts\/\d+\/containers\/\d+\/versions\/\d+$/))return reply({error:"invalid_version"},400);return reply(await google(token,`${body.version}:publish`,{method:"POST"}))}
  return reply({error:"invalid_action"},400);
}catch(error){console.error(error);return reply({error:"service_unavailable"},503)}});
