// @ts-expect-error Bun's test types are runtime-provided and not part of the app tsconfig.
import {describe,expect,test} from "bun:test";
import {canTransition,localSeoRequest} from "../lib/local-seo-domain";
describe("SEO Local domain",()=>{
 test("permite somente transições explícitas",()=>{expect(canTransition("post","draft","waiting_approval")).toBe(true);expect(canTransition("post","draft","published")).toBe(false);expect(canTransition("reply","ready_to_respond","responded")).toBe(false)});
 test("rejeita identificadores e payloads inválidos",()=>{expect(localSeoRequest.safeParse({action:"local_seo_workspace",client_id:"qualquer"}).success).toBe(false);expect(localSeoRequest.safeParse({action:"local_seo_review_register",client_id:"00000000-0000-4000-8000-000000000000",payload:{rating:7,review_text:"x"}}).success).toBe(false)});
});
