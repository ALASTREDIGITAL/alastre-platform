// @ts-expect-error Bun's test types are runtime-provided and not part of the app tsconfig.
import {describe,expect,test} from "bun:test";
import {keywordIntents,localScoreWeights,profileAuditCatalog,unconfiguredLocalRankProvider} from "../lib/local-seo-v2-domain";
import {calculatePartialScore,deterministicOpportunityRules,localSeoV2Request} from "../lib/local-seo-v2-api";

describe("SEO Local V2 domain",()=>{
 test("mantém sete pilares com pesos explícitos",()=>{expect(Object.keys(localScoreWeights)).toHaveLength(7);expect(Object.values(localScoreWeights).reduce((total,value)=>total+value,0)).toBe(100)});
 test("prepara auditoria completa sem inventar estado",()=>{expect(profileAuditCatalog.map(([,label])=>label)).toContain("Completude geral");expect(profileAuditCatalog).toHaveLength(18)});
 test("separa ranking do Google Business Profile",()=>{expect(unconfiguredLocalRankProvider.status).toBe("not_configured");expect(unconfiguredLocalRankProvider.name).toBeNull()});
 test("define intenções operacionais",()=>{expect(keywordIntents).toEqual(["Transacional","Comercial","Local","Informacional","Marca"])});
 test("calcula score somente com evidência verificada",()=>{expect(calculatePartialScore([])).toBeNull();expect(calculatePartialScore([{check_key:"name",status:"ok"},{check_key:"hours",status:"critical"}])?.overall_score).toBe(60)});
 test("gera oportunidades determinísticas e deduplicáveis por origem",()=>{const rules=deterministicOpportunityRules({checks:[],approvedKeywords:0,competitors:0});expect(rules.map(rule=>rule.origin)).toEqual(["rule:no_approved_keywords","rule:no_competitors"]);expect(new Set(rules.map(rule=>rule.origin)).size).toBe(rules.length)});
 test("valida ações e escopo de cliente",()=>{expect(localSeoV2Request.safeParse({action:"clients"}).success).toBe(true);expect(localSeoV2Request.safeParse({action:"workspace",client_id:"inválido"}).success).toBe(false)});
});
