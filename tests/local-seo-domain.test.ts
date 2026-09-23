import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { canTransition, localSeoRequest } from "../lib/local-seo-domain.ts";

describe("SEO Local domain", () => {
  test("permite somente transições explícitas", () => {
    assert.equal(canTransition("post", "draft", "waiting_approval"), true);
    assert.equal(canTransition("post", "draft", "published"), false);
    assert.equal(canTransition("reply", "ready_to_respond", "responded"), false);
  });

  test("rejeita identificadores e payloads inválidos", () => {
    assert.equal(
      localSeoRequest.safeParse({
        action: "local_seo_workspace",
        client_id: "qualquer",
      }).success,
      false,
    );
    assert.equal(
      localSeoRequest.safeParse({
        action: "local_seo_review_register",
        client_id: "00000000-0000-4000-8000-000000000000",
        payload: { rating: 7, review_text: "x" },
      }).success,
      false,
    );
  });
});
