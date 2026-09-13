import "server-only";
import type {ProviderAvailabilityStatus} from "../connection-hub-domain";
export type GoogleOAuthConfig={clientId:string;clientSecret:string;redirectUri:string};
export function getGoogleProviderAvailability():ProviderAvailabilityStatus{const value=process.env.GOOGLE_PROVIDER_AVAILABILITY?.trim();return value==="ready_for_oauth"||value==="not_configured"?value:"pending_provider_approval";}
export function getGoogleOAuthConfig():GoogleOAuthConfig|null{const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),redirectUri=process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();if(!clientId||!clientSecret||!redirectUri)return null;try{const url=new URL(redirectUri);if(url.protocol!=="https:"&&url.hostname!=="localhost")return null;}catch{return null}return {clientId,clientSecret,redirectUri};}
export function getSupabaseServerConfig(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),secretKey=process.env.SUPABASE_SECRET_KEY?.trim();return url&&secretKey?{url,secretKey}:null;}
