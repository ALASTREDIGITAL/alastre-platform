// @ts-expect-error Bun's test types are runtime-provided and not part of the app tsconfig.
import {describe,expect,test} from "bun:test";
import {resolveLocalSeoDataProvider} from "../lib/local-seo-data-provider";

const client={id:"11111111-1111-4111-8111-111111111111",name:"Cliente real",slug:"cliente-real",status:"active",dna:{status:"confirmed",business_data:{city:"Campinas",services:["SEO Local"]},source_summary:{}}};

describe("LocalSeoDataProvider",()=>{
 test("identifica DNA como dado interno real e parcial",()=>{const workspace=resolveLocalSeoDataProvider({googleConnected:false}).load(client);expect(workspace.provenance.source).toBe("internal");expect(workspace.provenance.isReal).toBe(true);expect(workspace.provenance.state).toBe("partial")});
 test("não inventa dados Google durante a primeira sincronização",()=>{const workspace=resolveLocalSeoDataProvider({googleConnected:true}).load(client);expect(workspace.provenance.source).toBe("google_business_profile");expect(workspace.provenance.state).toBe("syncing");expect(workspace.score.value).toBeNull()});
});
