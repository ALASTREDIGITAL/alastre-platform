import "server-only";
import type {ProviderAvailabilityStatus} from "../connection-hub-domain.ts";
import {serverEnv} from "../server-env.ts";
export type GoogleOAuthConfig={clientId:string;clientSecret:string;redirectUri:string};
export function getGoogleProviderAvailability():ProviderAvailabilityStatus{const value=serverEnv("GOOGLE_PROVIDER_AVAILABILITY");return value==="ready_for_oauth"||value==="not_configured"?value:"pending_provider_approval";}
export function getGoogleOAuthConfig():GoogleOAuthConfig|null{const clientId=serverEnv("GOOGLE_OAUTH_CLIENT_ID"),clientSecret=serverEnv("GOOGLE_OAUTH_CLIENT_SECRET"),redirectUri=serverEnv("GOOGLE_OAUTH_REDIRECT_URI");if(!clientId||!clientSecret||!redirectUri)return null;try{const url=new URL(redirectUri);if(url.protocol!=="https:"&&url.hostname!=="localhost")return null;}catch{return null}return {clientId,clientSecret,redirectUri};}
export function getSupabaseServerConfig(){const url=serverEnv("NEXT_PUBLIC_SUPABASE_URL"),secretKey=serverEnv("SUPABASE_SECRET_KEY");return url&&secretKey?{url,secretKey}:null;}
