import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  createOAuthProof,
  hashOAuthState,
  isAuthorizationSessionValid,
  safeReturnPath,
} from "../lib/connection-hub/oauth-security.ts";
import {
  GoogleProviderAdapter,
  GOOGLE_BUSINESS_SCOPE,
} from "../lib/connection-hub/google-adapter.ts";

const config = {
  clientId: "client.test",
  clientSecret: "server-only",
  redirectUri: "http://localhost:5173/api/connections/google/callback",
};

describe("Google provider OAuth", () => {
  test("gera state e PKCE sem expor o secret", () => {
    const proof = createOAuthProof();
    const url = new GoogleProviderAdapter(
      config,
      async () => new Response(),
    ).createAuthorizationUrl({
      state: proof.state,
      codeChallenge: proof.challenge,
    });
    assert.equal(hashOAuthState(proof.state), proof.stateHash);
    assert.ok(url.includes(encodeURIComponent(GOOGLE_BUSINESS_SCOPE)));
    assert.ok(url.includes("code_challenge_method=S256"));
    assert.ok(!url.includes(config.clientSecret));
  });

  test("rejeita sessão expirada, usada ou de outro ator", () => {
    const base = {
      status: "pending",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      initiated_by_actor_id: "actor-a",
    };
    assert.equal(isAuthorizationSessionValid(base, "actor-a"), true);
    assert.equal(
      isAuthorizationSessionValid(
        { ...base, expires_at: new Date(0).toISOString() },
        "actor-a",
      ),
      false,
    );
    assert.equal(
      isAuthorizationSessionValid(
        { ...base, status: "completed" },
        "actor-a",
      ),
      false,
    );
    assert.equal(isAuthorizationSessionValid(base, "actor-b"), false);
  });

  test("bloqueia return path externo", () => {
    assert.equal(safeReturnPath("https://evil.example"), "/?view=connections");
    assert.equal(safeReturnPath("//evil.example"), "/?view=connections");
  });

  test("descobre accounts e locations com fixture read-only", async () => {
    const calls: string[] = [];
    const mockFetcher = async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("accountmanagement")) {
        return Response.json({
          accounts: [
            {
              name: "accounts/123",
              accountName: "Conta Alastre",
              type: "ORGANIZATION",
            },
          ],
        });
      }
      return Response.json({
        locations: [
          {
            name: "locations/456",
            title: "Bionippon",
            storefrontAddress: {
              addressLines: ["Rua Teste, 10"],
              locality: "São Paulo",
            },
            categories: { primaryCategory: { displayName: "Loja" } },
          },
        ],
      });
    };
    const adapter = new GoogleProviderAdapter(
      config,
      mockFetcher as typeof fetch,
    );
    const accounts = await adapter.listAccounts("access-token");
    const locations = await adapter.listBusinessLocations(
      "access-token",
      accounts[0].name,
    );
    assert.equal(accounts[0].accountName, "Conta Alastre");
    assert.equal(locations[0].title, "Bionippon");
    assert.equal(locations[0].accountName, "accounts/123");
    assert.equal(locations[0].primaryCategory, "Loja");
    assert.ok(calls.every((call) => call.startsWith("https://")));
  });

  test("traduz refresh revogado para reconexão", async () => {
    const adapter = new GoogleProviderAdapter(
      config,
      async () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    );
    await assert.rejects(
      async () => adapter.refreshAuthorization("revoked"),
      (err: any) => err.code === "invalid_grant" && err.reconnect === true,
    );
  });
});
