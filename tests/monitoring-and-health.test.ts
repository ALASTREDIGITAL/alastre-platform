import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeLogData,
  getCorrelationId,
  logOperationalEvent,
  checkPlatformHealth,
} from "../lib/monitoring.ts";

describe("Frente 2: Monitoramento, Observabilidade e Operação Segura", () => {
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

  test("getCorrelationId reaproveita cabeçalho HTTP existente ou gera novo UUID", () => {
    const customHeaderReq = new Request("http://localhost/api/health", {
      headers: { "x-correlation-id": "test-corr-id-12345" },
    });
    assert.equal(getCorrelationId(customHeaderReq), "test-corr-id-12345");

    const noHeaderReq = new Request("http://localhost/api/health");
    const generatedId = getCorrelationId(noHeaderReq);
    assert.ok(typeof generatedId === "string" && generatedId.length >= 32);
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

    // Garante ausência de URLs sensíveis ou tokens no payload de saúde
    const jsonStr = JSON.stringify(health);
    assert.ok(!jsonStr.includes("ALASTRE_BRIDGE_SECRET"));
    assert.ok(!jsonStr.includes("SUPABASE_SECRET_KEY"));
    assert.ok(!jsonStr.includes("http://localhost"));
  });
});
