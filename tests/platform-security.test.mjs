import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, server: { middlewareMode: true } });
after(async () => vite.close());

test("normalizes the authenticated actor email", async () => {
  const contract = await vite.ssrLoadModule("/supabase/functions/_shared/platform-contracts.ts");
  assert.equal(contract.normalizeActorEmail("  Rodrigo@Alastre.COM  "), "rodrigo@alastre.com");
});

test("rejects malformed identifiers at the command seam", async () => {
  const contract = await vite.ssrLoadModule("/supabase/functions/_shared/platform-contracts.ts");
  assert.equal(contract.isUuid("../another-client"), false);
  assert.equal(contract.isUuid("b10a1a00-0000-4000-8000-000000000001"), true);
});

test("external effects require approved execution mode and approval", async () => {
  const contract = await vite.ssrLoadModule("/supabase/functions/_shared/platform-contracts.ts");
  assert.equal(contract.externalWriteAllowed("disabled", true), false);
  assert.equal(contract.externalWriteAllowed("draft_only", true), false);
  assert.equal(contract.externalWriteAllowed("approved_execution", false), false);
  assert.equal(contract.externalWriteAllowed("approved_execution", true), true);
});

test("tracking services require internal authentication and lock writes", async () => {
  const { readFile } = await import("node:fs/promises");
  const gtm = await readFile(`${root}/supabase/functions/alastre-gtm-service/index.ts`, "utf8");
  const ga4 = await readFile(`${root}/supabase/functions/alastre-ga4-service/index.ts`, "utf8");
  for (const source of [gtm, ga4]) {
    assert.match(source, /x-alastre-internal-secret/);
    assert.match(source, /x-alastre-write-mode/);
    assert.match(source, /external_write_locked/);
    assert.match(source, /body\.approval_id/);
  }
});
