import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { validateWorkerToken, getExpectedWorkerToken } from "../lib/prospecting/worker-security.ts";

describe("Prospecting Worker Security (Condição 1 e 4)", () => {
  const originalEnvToken = process.env.PROSPECTING_WORKER_SECRET_TOKEN;

  afterEach(() => {
    if (originalEnvToken !== undefined) {
      process.env.PROSPECTING_WORKER_SECRET_TOKEN = originalEnvToken;
    } else {
      delete process.env.PROSPECTING_WORKER_SECRET_TOKEN;
    }
  });

  it("fails closed when PROSPECTING_WORKER_SECRET_TOKEN is not configured", () => {
    delete process.env.PROSPECTING_WORKER_SECRET_TOKEN;
    assert.throws(() => getExpectedWorkerToken(), /PROSPECTING_WORKER_SECRET_TOKEN is not configured/);
    assert.equal(validateWorkerToken("Bearer any-secret"), false);
  });

  it("authenticates valid worker bearer token in constant time when configured", () => {
    process.env.PROSPECTING_WORKER_SECRET_TOKEN = "dynamic-test-secret-token-xyz-123";
    const validToken = getExpectedWorkerToken();
    const result = validateWorkerToken(`Bearer ${validToken}`);
    assert.equal(result, true);
  });

  it("rejects missing, malformed or invalid tokens", () => {
    process.env.PROSPECTING_WORKER_SECRET_TOKEN = "dynamic-test-secret-token-xyz-123";
    assert.equal(validateWorkerToken(null), false);
    assert.equal(validateWorkerToken(""), false);
    assert.equal(validateWorkerToken("Basic xyz"), false);
    assert.equal(validateWorkerToken("Bearer invalid-token-12345"), false);
    assert.equal(validateWorkerToken("Bearer short"), false);
  });
});
