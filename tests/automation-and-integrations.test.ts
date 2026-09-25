(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeWritePlanHash,
  sanitizeSensitiveData,
  validateExternalEndpointUrl,
  AutomationActionSchema,
} from "../lib/automation-domain.ts";
import {
  AutomationService,
  automationMemoryStore,
} from "../lib/automation-service.ts";
import type { ActorContext } from "../lib/connection-hub/repository.ts";
import { POST as automationRouteHandler } from "../app/api/automation/route.ts";

test("Módulo 09 — Integrações e Automação: Suíte de Validação Operacional e Segurança", async (t) => {
  const service = new AutomationService();

  const actorAgencyA: ActorContext = {
    actorId: "actor-11111111-1111-1111-1111-111111111111",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "admin",
  };

  const actorAgencyB: ActorContext = {
    actorId: "actor-22222222-2222-2222-2222-222222222222",
    agencyId: "agency-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    role: "admin",
  };

  const viewerAgencyA: ActorContext = {
    actorId: "actor-33333333-3333-3333-3333-333333333333",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "viewer",
  };

  automationMemoryStore.clear();

  await t.test("1. Isolamento Multi-Tenant e Rejeição Cross-Tenant", async () => {
    automationMemoryStore.clear();

    await service.enqueueJob(actorAgencyA, {
      idempotency_key: "idemp-agency-a-001",
      capability: "google_business_profile",
      action_name: "sync_locations",
      payload: { account: "account_a" },
    });

    await service.createWritePlan(actorAgencyA, {
      capability: "google_business_profile",
      action_type: "update_business_hours",
      plan_payload: { hours: "08:00-18:00" },
    });

    const overviewA = await service.getOverview(actorAgencyA);
    assert.equal(overviewA.jobs.length, 1);
    assert.equal(overviewA.write_plans.length, 1);

    const overviewB = await service.getOverview(actorAgencyB);
    assert.equal(overviewB.jobs.length, 0);
    assert.equal(overviewB.write_plans.length, 0);
  });

  await t.test("2. Bloqueio de Acesso Cross-Tenant a Jobs de Outra Agência", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(actorAgencyA, {
      idempotency_key: "idemp-cross-tenant-test",
      capability: "google_business_profile",
      action_name: "sync_reviews",
      payload: {},
    });

    await assert.rejects(
      async () => {
        await service.processJob(actorAgencyB, {
          job_id: job.id,
          simulate_outcome: "success",
        });
      },
      (err: unknown) => err instanceof Error && err.message === "job_not_found",
    );
  });

  await t.test("3. Idempotência e Deduplicação da Fila de Jobs", async () => {
    automationMemoryStore.clear();
    const key = "idemp-unique-key-999";

    const res1 = await service.enqueueJob(actorAgencyA, {
      idempotency_key: key,
      capability: "google_business_profile",
      action_name: "sync_location",
      payload: { version: 1 },
    });

    const res2 = await service.enqueueJob(actorAgencyA, {
      idempotency_key: key,
      capability: "google_business_profile",
      action_name: "sync_location",
      payload: { version: 2 },
    });

    assert.equal(res1.deduplicated, false);
    assert.equal(res2.deduplicated, true);
    assert.equal(res1.job.id, res2.job.id);

    const overview = await service.getOverview(actorAgencyA);
    assert.equal(overview.jobs.length, 1);
  });

  await t.test("4. Retentativas, Timeout e Redirecionamento para Dead-Letter", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(actorAgencyA, {
      idempotency_key: "idemp-retry-test",
      capability: "google_ads",
      action_name: "sync_campaigns",
      payload: {},
      max_attempts: 2,
    });

    const step1 = await service.processJob(actorAgencyA, {
      job_id: job.id,
      simulate_outcome: "fail_retryable",
      simulated_error_code: "network_timeout",
    });
    assert.equal(step1.status, "failed");
    assert.equal(step1.attempts, 1);

    const step2 = await service.processJob(actorAgencyA, {
      job_id: job.id,
      simulate_outcome: "fail_retryable",
      simulated_error_code: "network_timeout",
    });
    assert.equal(step2.status, "dead_letter");
    assert.equal(step2.attempts, 2);

    const overview = await service.getOverview(actorAgencyA);
    assert.equal(overview.summary.dead_letter_jobs, 1);
  });

  await t.test("5. Redirecionamento Direto para Dead-Letter em Falha Fatal", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(actorAgencyA, {
      idempotency_key: "idemp-fatal-test",
      capability: "meta_ads",
      action_name: "fetch_insights",
      payload: {},
      max_attempts: 5,
    });

    const res = await service.processJob(actorAgencyA, {
      job_id: job.id,
      simulate_outcome: "fail_fatal",
      simulated_error_code: "account_revoked",
    });

    assert.equal(res.status, "dead_letter");
    assert.equal(res.last_error_sanitized, "account_revoked");
  });

  await t.test("6. Ausência de Segredos e Sanitização de Payload", () => {
    const sensitiveInput = {
      user_name: "Operador Alastre",
      access_token: "ya29.a0AfH6SM...",
      refresh_token: "1//04...",
      authorization: "Bearer secret_token_xyz",
      nested: {
        client_secret: "super_secret_key",
        public_info: "perfil_empresa_123",
      },
    };

    const sanitized = sanitizeSensitiveData(sensitiveInput);

    assert.equal(sanitized.access_token, "[REDACTED_SENSITIVE_VALUE]");
    assert.equal(sanitized.refresh_token, "[REDACTED_SENSITIVE_VALUE]");
    assert.equal(sanitized.authorization, "[REDACTED_SENSITIVE_VALUE]");
    assert.equal(sanitized.nested.client_secret, "[REDACTED_SENSITIVE_VALUE]");
    assert.equal(sanitized.nested.public_info, "perfil_empresa_123");
  });

  await t.test("7. Trava de Escrita Externa com ALASTRE_WRITE_MODE=disabled", async () => {
    automationMemoryStore.clear();

    const plan = await service.createWritePlan(actorAgencyA, {
      capability: "google_business_profile",
      action_type: "create_local_post",
      plan_payload: { content: "Nova oferta de primavera!" },
    });

    assert.equal(plan.status, "pending_approval");
    assert.equal(plan.plan_hash.length, 64);

    const res = await service.executeWritePlan(actorAgencyA, {
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
    });

    assert.equal(res.executed, false);
    assert.equal(res.plan.status, "blocked_write_mode");
    assert.ok(res.reason?.includes("ALASTRE_WRITE_MODE está configurado como 'disabled'"));
  });

  await t.test("8. Rejeição de Execução com Hash Divergente (Plan Hash Tampering)", async () => {
    automationMemoryStore.clear();

    const plan = await service.createWritePlan(actorAgencyA, {
      capability: "google_business_profile",
      action_type: "update_address",
      plan_payload: { address: "Rua A, 123" },
    });

    const fakeHash = "a".repeat(64);

    await assert.rejects(
      async () => {
        await service.executeWritePlan(actorAgencyA, {
          plan_id: plan.id,
          plan_hash: fakeHash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "plan_hash_mismatch",
    );
  });

  await t.test("9. Restrição RBAC para Ações Administrativas", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(actorAgencyA, {
      idempotency_key: "idemp-rbac-test",
      capability: "google_business_profile",
      action_name: "sync_metrics",
      payload: {},
    });

    const plan = await service.createWritePlan(actorAgencyA, {
      capability: "google_business_profile",
      action_type: "reply_review",
      plan_payload: { response: "Obrigado!" },
    });

    await assert.rejects(
      async () => {
        await service.cancelJob(viewerAgencyA, { job_id: job.id });
      },
      (err: unknown) => err instanceof Error && err.message === "actor_forbidden",
    );

    await assert.rejects(
      async () => {
        await service.executeWritePlan(viewerAgencyA, {
          plan_id: plan.id,
          plan_hash: plan.plan_hash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "actor_forbidden",
    );
  });

  await t.test("10. Salvaguarda Anti-SSRF (Server-Side Request Forgery)", () => {
    assert.equal(validateExternalEndpointUrl("google", "https://mybusiness.googleapis.com/v4/accounts").valid, true);
    assert.equal(validateExternalEndpointUrl("meta", "https://graph.facebook.com/v19.0/me").valid, true);

    const httpCheck = validateExternalEndpointUrl("google", "http://mybusiness.googleapis.com/v4/accounts");
    assert.equal(httpCheck.valid, false);

    const ssrfCheck = validateExternalEndpointUrl("google", "https://169.254.169.254/latest/meta-data");
    assert.equal(ssrfCheck.valid, false);

    const arbitraryCheck = validateExternalEndpointUrl("google", "https://malicious-site.com/callback");
    assert.equal(arbitraryCheck.valid, false);
  });

  await t.test("11. Registro de Custos e Cotas de IA", async () => {
    automationMemoryStore.clear();

    const res = await service.recordAiUsage(actorAgencyA, {
      capability: "ai_generation",
      model_name: "gemini-3.6-flash",
      tokens_input: 1000,
      tokens_output: 500,
      estimated_cost_usd: 0.003,
      sanitized_summary: "Diagnóstico explicável de Perfil da Empresa",
    });

    assert.equal(res.log.tokens_input, 1000);
    assert.equal(res.log.tokens_output, 500);
    assert.equal(res.limits.current_monthly_tokens, 1500);
    assert.equal(res.limits.current_monthly_cost_usd, 0.003);
  });

  await t.test("12. Endpoint Route Handler POST /api/automation", async () => {
    const request = new Request("http://localhost:3000/api/automation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-alastre-bridge-secret": "91221baeea876d7c95a885fa0cf6621aac40867915ac8291149339321d874b31",
        "x-alastre-user-email": "ag.alastredigital@gmail.com",
      },
      body: JSON.stringify({ action: "overview" }),
    });

    const response = await automationRouteHandler(request);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.ok(body.write_mode);
    assert.ok(body.summary);
  });
});
