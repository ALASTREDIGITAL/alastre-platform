import type {ClientSummary} from "@/app/clients-module";
import {buildLocalSeoWorkspace} from "./local-seo-data";
import type {LocalSeoDataSource,LocalSeoWorkspace} from "./local-seo-types";

export interface LocalSeoDataProvider{
 readonly source:LocalSeoDataSource;
 load(client:ClientSummary):LocalSeoWorkspace;
}

export class InternalLocalSeoDataProvider implements LocalSeoDataProvider{
 readonly source="internal" as const;
 load(client:ClientSummary){return buildLocalSeoWorkspace(client);}
}

export class GoogleBusinessProfileDataProvider implements LocalSeoDataProvider{
 readonly source="google_business_profile" as const;
 load(client:ClientSummary){const workspace=buildLocalSeoWorkspace(client);return {...workspace,connection:"connected" as const,provenance:{source:this.source,state:"syncing" as const,label:"Aguardando sincronização",detail:"A conexão está pronta para receber dados reais do Perfil Google.",isReal:true}};}
}

export function resolveLocalSeoDataProvider(input:{googleConnected:boolean}):LocalSeoDataProvider{return input.googleConnected?new GoogleBusinessProfileDataProvider():new InternalLocalSeoDataProvider();}
