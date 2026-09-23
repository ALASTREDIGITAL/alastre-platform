import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { HELP_CONTENT } from "../lib/help-content.ts";

describe("contextual help registry", () => {
  test("keeps every entry actionable and understandable", () => {
    for (const entry of Object.values(HELP_CONTENT)) {
      assert.ok(entry.title.length > 2);
      assert.ok(entry.description.length > 12);
      assert.ok(entry.whyItMatters.length > 12);
      assert.ok(entry.nextStep.length > 12);
    }
  });

  test("covers primary simple-mode experiences", () => {
    assert.ok(HELP_CONTENT["operations.overview"] !== undefined);
    assert.ok(HELP_CONTENT["local_score.overview"] !== undefined);
    assert.ok(HELP_CONTENT["connections.overview"] !== undefined);
  });
});
