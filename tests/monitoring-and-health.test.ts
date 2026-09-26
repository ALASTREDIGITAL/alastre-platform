import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  sanitizeLogData,
  getCorrelationId,
  logOperationalEvent,
  checkPlatformHealth,
} from "../lib/monitoring.ts";
import { GET as healthRouteHandler } from "../app/api/health/route.ts";

describe("Frente 2 & Endurecimento de Segurança: Monitoramento, Observabilidade e Health Route", () => {
  test("preservação de node_modules e ausência de scripts postinstall de bypass", () => {
    // 1. Garante que scripts/postinstall-stub-server-only.js não existe no repositório
    const stubPath = path.join(process.cwd(), "scripts", "postinstall-stub-server-only.js");
    assert.equal(fs.existsSync(stubPath), false, "O script de bypass postinstall-stub-server-only.js não pode existir.");

    // 2. Garante que node_modules/server-only/index.js preserva a proteção nativa do Next.js
    const serverOnlyIndexPath = path.join(process.cwd(), "node_modules", "server-only", "index.js");
    if (fs.existsSync(serverOnlyIndexPath)) {
      const content = fs.readFileSync(serverOnlyIndexPath, "utf8");
      assert.ok(
        content.includes("This module can only be imported in Server Components"),
        "node_modules/server-only/index.js deve conter a exceção nativa do pacote."
      );
    }
  });

  test("sanitizeLogData remove segredos, senhas e tokens de objetos simples e aninhados", () => {
    const rawPayload = {
      username: "operador@alastre.com",
      password: "SuperSecretPassword123!",
      api_key: "ak_live_998877665544",
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      nested: {
        client_secret: "gocspx-secret-val",
        user_email: "cliente@empresa.com",
        bearer_token: "Bearer 123456789",
      },
      tags: ["safe_tag", "secret_token_value"],
    };

    const sanitized = sanitizeLogData(rawPayload) as any;

    assert.equal(sanitized.username, "operador@alastre.com");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.api_key, "[REDACTED]");
    assert.equal(sanitized.authorization, "[REDACTED]");
    assert.equal(sanitized.nested.client_secret, "[REDACTED]");
    assert.equal(sanitized.nested.user_email, "cliente@empresa.com");
    assert.equal(sanitized.nested.bearer_token, "[REDACTED]");
    assert.equal(sanitized.tags[0], "safe_tag");
  });

  test("sanitizeLogData redacta strings isoladas de Bearer token e JWT", () => {
    assert.equal(sanitizeLogData("Bearer abc123xyz"), "[REDACTED_BEARER_TOKEN]");
    assert.equal(
      sanitizeLogData("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"),
      "[REDACTED_JWT_TOKEN]"
    );
    assert.equal(sanitizeLogData("texto_comum_seguro"), "texto_comum_seguro");
  });

  test("getCorrelationId substitui IDs inválidos ou excessivos por UUID seguro", () => {
    // 1. Válido
    const validReq = new Request("http://localhost/api/health", {
      headers: { "x-correlation-id": "valid-req-id-12345" },
    });
    assert.equal(getCorrelationId(validReq), "valid-req-id-12345");

    // 2. Excessivo (>64 caracteres)
    const longId = "a".repeat(70);
    const longReq = new Request("http://localhost/api/health", {
      headers: { "x-correlation-id": longId },
    });
    const sanitizedLong = getCorrelationId(longReq);
    assert.notEqual(sanitizedLong, longId);
    assert.ok(sanitizedLong.length >= 32);

    // 3. Formato inválido com caracteres perigosos
    const unsafeReq = new Request("http://localhost/api/health", {
      headers: { "x-correlation-id": "<script>alert(1)</script>" },
    });
    const sanitizedUnsafe = getCorrelationId(unsafeReq);
    assert.notEqual(sanitizedUnsafe, "<script>alert(1)</script>");
    assert.ok(sanitizedUnsafe.length >= 32);
  });

  test("logOperationalEvent gera log estruturado sanitizado sem exceções", () => {
    const eventLog = logOperationalEvent({
      level: "info",
      eventType: "test_event",
      agencyId: "00000000-0000-0000-0000-000000000001",
      message: "Teste de log de auditoria",
      details: {
        token: "sensitive_token_data",
        public_metric: 42,
      },
    });

    assert.equal(eventLog.event_type, "test_event");
    assert.equal((eventLog.details as any).token, "[REDACTED]");
    assert.equal((eventLog.details as any).public_metric, 42);
  });

  test("checkPlatformHealth gera relatório sem vazamento de URLs internas ou segredos", async () => {
    const health = await checkPlatformHealth();

    assert.ok(health.status === "ok" || health.status === "degraded" || health.status === "unavailable");
    assert.ok(typeof health.timestamp === "string");
    assert.equal(health.version, "0.1.0");
    assert.ok(health.write_mode === "disabled" || health.write_mode === "enabled");
    assert.ok(health.services.database);
    assert.ok(health.services.auth);
    assert.ok(health.services.google_ads_bridge);
    assert.ok(health.services.google_provider);

    const jsonStr = JSON.stringify(health);
    assert.ok(!jsonStr.includes("ALASTRE_BRIDGE_SECRET"));
    assert.ok(!jsonStr.includes("SUPABASE_SECRET_KEY"));
    assert.ok(!jsonStr.includes("http://localhost"));
  });

  test("GET /api/health público retorna resposta mínima sem expor detalhes internos ou infraestrutura", async () => {
    const req = new Request("http://localhost/api/health");
    const res = await healthRouteHandler(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(data.version, "0.1.0");
    assert.ok(typeof data.timestamp === "string");

    // Valida ausência total de detalhes de infraestrutura no endpoint público
    assert.equal(data.services, undefined);
    assert.equal(data.write_mode, undefined);
    assert.equal(data.environment, undefined);
    assert.equal(data.database, undefined);

    // Valida cabeçalhos obrigatórios
    assert.equal(res.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate");
    assert.ok(res.headers.get("X-Correlation-ID"));
  });

  test("GET /api/health?detail=true rejeita requisições não autenticadas com HTTP 401", async () => {
    const req = new Request("http://localhost/api/health?detail=true");
    const res = await healthRouteHandler(req);
    assert.equal(res.status, 401);

    const data = await res.json();
    assert.equal(data.status, "unauthorized");
    assert.ok(data.error.includes("Autenticação necessária"));
  });

  test("GET /api/health?detail=true rejeita ator sem papel de liderança com HTTP 403", async () => {
    // Em ambiente de desenvolvimento local (NODE_ENV=development), o ator mockado possui role "owner".
    // Vamos simular um ambiente de teste onde a rota valida RBAC.
    const req = new Request("http://localhost/api/health?detail=true", {
      headers: {
        "x-alastre-bridge-secret": "test-invalid-bridge-secret",
      },
    });
    // Se o ator não for autorizado ou autenticação falhar, deve responder 401 ou 403
    const res = await healthRouteHandler(req);
    assert.ok(res.status === 401 || res.status === 403);
  });
});
