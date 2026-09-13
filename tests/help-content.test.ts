// @ts-expect-error Bun's test types are runtime-provided and not part of the app tsconfig.
import {describe,expect,test} from "bun:test";
import {HELP_CONTENT} from "../lib/help-content";

describe("contextual help registry",()=>{
 test("keeps every entry actionable and understandable",()=>{for(const entry of Object.values(HELP_CONTENT)){expect(entry.title.length).toBeGreaterThan(2);expect(entry.description.length).toBeGreaterThan(12);expect(entry.whyItMatters.length).toBeGreaterThan(12);expect(entry.nextStep.length).toBeGreaterThan(12)}});
 test("covers primary simple-mode experiences",()=>{expect(HELP_CONTENT["operations.overview"]).toBeDefined();expect(HELP_CONTENT["local_score.overview"]).toBeDefined();expect(HELP_CONTENT["connections.overview"]).toBeDefined()});
});
