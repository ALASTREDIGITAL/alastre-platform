import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
export type StoredGoogleCredential={refreshToken:string;accessToken:string;expiresAt:number;scope:string;tokenType:string};
export interface CredentialStore{storeSecret(value:string,description:string):Promise<string>;getSecret(reference:string):Promise<string>;rotateSecret(reference:string,value:string):Promise<void>;revokeSecret(reference:string):Promise<void>}
export class SupabaseVaultCredentialStore implements CredentialStore{
 constructor(private readonly db:SupabaseClient){}
 async storeSecret(value:string,description:string){const {data,error}=await this.db.rpc("connection_hub_store_secret",{p_secret:value,p_description:description});if(error||typeof data!=="string")throw new Error("credential_store_unavailable");return data;}
 async getSecret(reference:string){const {data,error}=await this.db.rpc("connection_hub_get_secret",{p_reference:reference});if(error||typeof data!=="string")throw new Error("credential_not_found");return data;}
 async rotateSecret(reference:string,value:string){const {error}=await this.db.rpc("connection_hub_update_secret",{p_reference:reference,p_secret:value});if(error)throw new Error("credential_rotation_failed");}
 async revokeSecret(reference:string){const {error}=await this.db.rpc("connection_hub_delete_secret",{p_reference:reference});if(error)throw new Error("credential_revocation_failed");}
}
