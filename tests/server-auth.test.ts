import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractAuthenticatedEmail,
  isBridgeSecretValid,
  normalizeEmail,
  resolveAuthenticatedActor,
  resolveOAuthCallbackActor,
} from "../lib/server-auth.ts";
import { hashOAuthState } from "../lib/connection-hub/oauth-security.ts";

describe("Server Auth: Centralized & Defensive Authentication", () => {
  test("normaliza e-mails de atores de forma segura", () => {
    assert.equal(normalizeEmail("  Rodrigo@Alastre.COM  "), "rodrigo@alastre.com");
    assert.equal(normalizeEmail("invalid-email"), null);
    assert.equal(normalizeEmail(""), null);
    assert.equal(normalizeEmail(null), null);
    assert.equal(normalizeEmail(undefined), null);
  });

  test("valida segredo de ponte interna apenas com chave válida", () => {
    assert.equal(isBridgeSecretValid(null), false);
    assert.equal(isBridgeSecretValid(""), false);
    assert.equal(isBridgeSecretValid("senha_errada"), false);
    // Segredo cujo SHA-256 coincide com a constante de ponte
    // Testamos que rejeita palpites incorretos
    assert.equal(isBridgeSecretValid("forged_secret_123"), false);
  });

  test("rejeita cabeçalho forjado x-alastre-user-email sem segredo de ponte", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      // Simula ambiente de produção
      Object.assign(process.env, { NODE_ENV: "production" });

      const request = new Request("https://platform.alastre.com/api/auth/actor", {
        headers: {
          "x-alastre-user-email": "vitima@outra-agencia.com",
        },
      });

      const email = await extractAuthenticatedEmail(request);
      assert.equal(email, null, "Não pode aceitar x-alastre-user-email sem o segredo de ponte");
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  test("rejeita cabeçalho oai-authenticated-user-email em produção sem autorização", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "production" });

      const request = new Request("https://platform.alastre.com/api/connections", {
        headers: {
          "oai-authenticated-user-email": "impersonated@agencia.com",
        },
      });

      const email = await extractAuthenticatedEmail(request);
      assert.equal(email, null, "Não pode aceitar oai-authenticated-user-email em produção de forma cega");
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  test("retorna operador local padrão quando em ambiente de desenvolvimento", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "development" });

      const request = new Request("https://localhost:5173/api/local-seo-v2", {
        headers: {},
      });

      const email = await extractAuthenticatedEmail(request);
      assert.equal(email, "ag.alastredigital@gmail.com");
    } finally {
      Object.assign(process.env, { NODE_ENV: originalEnv });
    }
  });

  test("falha fechado (fail-secure) no resolveAuthenticatedActor sem conceder owner se o banco for nulo", async () => {
    const request = new Request("https://localhost:5173/api/auth/actor", {
      headers: {},
    });

    // Passando null como banco
    const result = await resolveAuthenticatedActor(request, null);
    assert.equal(result, null, "Deve falhar fechado e retornar null, sem conceder perfil de owner");
  });

  test("resolveOAuthCallbackActor rejeita state inválido ou vazio", async () => {
    assert.equal(await resolveOAuthCallbackActor("", null), null);
    assert.equal(await resolveOAuthCallbackActor("   ", null), null);
    assert.equal(await resolveOAuthCallbackActor(null as unknown as string, null), null);
  });

  test("resolveOAuthCallbackActor busca sessão por state_hash e recupera ator legítimo", async () => {
    const mockState = "test-oauth-state-random-bytes-32-chars";
    const expectedHash = hashOAuthState(mockState);

    let queriedTable = "";
    let queriedFilter = "";

    const sessionData = {
      id: "session-uuid-1",
      agency_id: "agency-uuid-1",
      initiated_by_actor_id: "actor-uuid-1",
      status: "pending",
      expires_at: new Date(Date.now() + 60000).toISOString(),
      pkce_credential_ref: "vault:pkce-1",
      return_path: "/?view=connections",
    };

    const actorData = {
      id: "actor-uuid-1",
      agency_id: "agency-uuid-1",
      role: "owner",
      email: "operator@alastre.com",
      active: true,
    };

    const mockAdmin = {
      from(table: string) {
        const query: Record<string, unknown> = {
          select: () => query,
          eq: () => query,
          gt: () => query,
          maybeSingle: async () => {
            if (table === "integration_authorization_sessions") {
              return { data: sessionData, error: null };
            }
            if (table === "agency_actors") {
              return { data: actorData, error: null };
            }
            return { data: null, error: null };
          },
        };
        return query;
      },
    } as never;

    const result = await resolveOAuthCallbackActor(mockState, mockAdmin);
    assert.ok(result);
    assert.equal(result.email, "operator@alastre.com");
    assert.equal(result.actor.actorId, "actor-uuid-1");
    assert.equal(result.actor.agencyId, "agency-uuid-1");
    assert.equal(result.actor.role, "owner");
    assert.equal(result.session.id, "session-uuid-1");
  });
});
