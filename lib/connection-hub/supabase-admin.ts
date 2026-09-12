import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseServerConfig} from "./server-config";
export function createSupabaseAdmin(){const config=getSupabaseServerConfig();if(!config)return null;return createClient(config.url,config.secretKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
