// @ts-expect-error Bun's test types are runtime-provided and not part of the app tsconfig.
import {describe,expect,test} from "bun:test";
import {keywordIntents,localScoreWeights,profileAuditCatalog,unconfiguredLocalRankProvider} from "../lib/local-seo-v2-domain";

describe("SEO Local V2 domain",()=>{
 test("mantém sete pilares com pesos explícitos",()=>{expect(Object.keys(localScoreWeights)).toHaveLength(7);expect(Object.values(localScoreWeights).reduce((total,value)=>total+value,0)).toBe(100)});
 test("prepara auditoria completa sem inventar estado",()=>{expect(profileAuditCatalog.map(([,label])=>label)).toContain("Completude geral");expect(profileAuditCatalog).toHaveLength(18)});
 test("separa ranking do Google Business Profile",()=>{expect(unconfiguredLocalRankProvider.status).toBe("not_configured");expect(unconfiguredLocalRankProvider.name).toBeNull()});
 test("define intenções operacionais",()=>{expect(keywordIntents).toEqual(["Transacional","Comercial","Local","Informacional","Marca"])});
});
