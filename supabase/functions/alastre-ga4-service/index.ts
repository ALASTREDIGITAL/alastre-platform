import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const J={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const EXPECTED_HASH="38b3cf4d6cf5f4b702d8f86bc998a7c7f61215c01a9a873a7cbb81e20c1900ce";
const WRITE_ACTIONS=new Set(["create_property","create_web_stream","create_key_event","ensure_key_events"]);
function env(n:string){const v=Deno.env.get(n);if(!v)throw new Error(`Missing ${n}`);return v}
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:J})}
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("")}
async function authorized(req:Request){const value=req.headers.get("x-alastre-internal-secret")??"";return Boolean(value)&&await sha256(value)===(Deno.env.get("ALASTRE_INTERNAL_SECRET_HASH")??EXPECTED_HASH)}
async function keyBytes(){const raw=env("GTM_TOKEN_KEY");try{const d=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));if(d.length===32)return d}catch{}return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)))}
async function decrypt(c:string){const k=await crypto.subtle.importKey("raw",await keyBytes(),"AES-GCM",false,["decrypt"]);const a=Uint8Array.from(atob(c),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:a.slice(0,12)},k,a.slice(12)))}
async function accessToken(){const sql=postgres(env("SUPABASE_DB_URL"),{prepare:false,max:1});try{const rows=await sql`select refresh_token_ciphertext from gtm_private.oauth_connections where status='active' order by connected_at desc limit 1`;if(!rows[0])throw new Error("oauth_not_connected");const rt=await decrypt(rows[0].refresh_token_ciphertext);const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env("GTM_CLIENT_ID"),client_secret:env("GTM_CLIENT_SECRET"),refresh_token:rt,grant_type:"refresh_token"})});const body=await response.json();if(!response.ok||!body.access_token)throw new Error("oauth_refresh_failed");return String(body.access_token)}finally{await sql.end()}}
async function google(token:string,path:string,init:RequestInit={}){const response=await fetch(`https://analyticsadmin.googleapis.com/v1beta${path}`,{...init,headers:{authorization:`Bearer ${token}`,"content-type":"application/json",...(init.headers??{})}});const text=await response.text();let body:unknown;try{body=JSON.parse(text)}catch{body=text}if(!response.ok)throw new Error(`google_ga4_${response.status}`);return body as Record<string,unknown>}
function valid(value:unknown,pattern:RegExp){return typeof value==="string"&&pattern.test(value)}

Deno.serve(async req=>{try{
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
  if(!(await authorized(req)))return reply({error:"forbidden"},403);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;if(!body||typeof body.action!=="string")return reply({error:"invalid_body"},400);
  if(WRITE_ACTIONS.has(body.action)&&(req.headers.get("x-alastre-write-mode")!=="approved_execution"||body.approved!==true||!valid(body.approval_id,/^[0-9a-f-]{36}$/i)))return reply({error:"external_write_locked"},423);
  if(body.action==="status")return reply({service:"alastre-ga4-service",status:"ready",security:"jwt_and_internal_secret",external_writes:"approval_required"});
  const token=await accessToken();
  if(body.action==="discover"){const summaries=await google(token,"/accountSummaries?pageSize=200");const accounts=Array.isArray(summaries.accountSummaries)?summaries.accountSummaries as Record<string,unknown>[]:[];const properties=accounts.flatMap(account=>Array.isArray(account.propertySummaries)?account.propertySummaries as Record<string,unknown>[]:[]).slice(0,100);const groups=await Promise.all(properties.map(async property=>{const name=String(property.property??"");if(!valid(name,/^properties\/\d+$/))return[];const result=await google(token,`/${name}/dataStreams?pageSize=200`);return Array.isArray(result.dataStreams)?result.dataStreams:[]}));return reply({accounts,properties,data_streams:groups.flat(),read_only:true})}
  if(body.action==="list_account_summaries")return reply(await google(token,"/accountSummaries?pageSize=200"));
  if(body.action==="list_data_streams"){if(!valid(body.property,/^properties\/\d+$/))return reply({error:"invalid_property"},400);return reply(await google(token,`/${body.property}/dataStreams?pageSize=200`))}
  if(body.action==="list_key_events"){if(!valid(body.property,/^properties\/\d+$/))return reply({error:"invalid_property"},400);return reply(await google(token,`/${body.property}/keyEvents?pageSize=200`))}
  if(body.action==="create_property"){if(!valid(body.account,/^accounts\/\d+$/))return reply({error:"invalid_account"},400);return reply(await google(token,"/properties",{method:"POST",body:JSON.stringify({parent:body.account,displayName:String(body.display_name??""),timeZone:"America/Sao_Paulo",currencyCode:"BRL",industryCategory:String(body.industry_category??"INDUSTRY_CATEGORY_UNSPECIFIED")})}),201)}
  if(body.action==="create_web_stream"){if(!valid(body.property,/^properties\/\d+$/))return reply({error:"invalid_property"},400);return reply(await google(token,`/${body.property}/dataStreams`,{method:"POST",body:JSON.stringify({type:"WEB_DATA_STREAM",displayName:String(body.display_name??"Web"),webStreamData:{defaultUri:String(body.default_uri??"")}})}),201)}
  if(body.action==="create_key_event"){if(!valid(body.property,/^properties\/\d+$/)||typeof body.event_name!=="string"||!body.event_name)return reply({error:"invalid_input"},400);return reply(await google(token,`/${body.property}/keyEvents`,{method:"POST",body:JSON.stringify({eventName:body.event_name,countingMethod:"ONCE_PER_EVENT"})}),201)}
  if(body.action==="ensure_key_events"){
    if(!valid(body.property,/^properties\/\d+$/)||!Array.isArray(body.event_names))return reply({error:"invalid_input"},400);
    const requested=[...new Set(body.event_names.map(value=>String(value)).filter(value=>/^[a-z][a-z0-9_]{1,39}$/.test(value)))].slice(0,30);
    const listed=await google(token,`/${body.property}/keyEvents?pageSize=200`);const existingItems=Array.isArray(listed.keyEvents)?listed.keyEvents as Record<string,unknown>[]:[];const existing=new Set(existingItems.map(item=>String(item.eventName??"")));
    const created:Record<string,unknown>[]=[];const reused:string[]=[];
    for(const eventName of requested){if(existing.has(eventName)){reused.push(eventName);continue}const item=await google(token,`/${body.property}/keyEvents`,{method:"POST",body:JSON.stringify({eventName,countingMethod:"ONCE_PER_EVENT"})});created.push(item)}
    return reply({property:body.property,requested,created,reused,published:false,idempotent:true},201);
  }
  return reply({error:"invalid_action"},400);
}catch(error){console.error(error);return reply({error:"service_unavailable"},503)}});
