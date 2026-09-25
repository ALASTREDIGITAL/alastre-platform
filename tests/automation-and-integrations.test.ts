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

  const ownerActor: ActorContext = {
    actorId: "actor-owner-001",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "owner",
  };

  const adminActor: ActorContext = {
    actorId: "actor-admin-001",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "admin",
  };

  const opsLeadActor: ActorContext = {
    actorId: "actor-opslead-001",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "operations_lead",
  };

  const operatorActor: ActorContext = {
    actorId: "actor-operator-001",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "operator",
  };

  const viewerActor: ActorContext = {
    actorId: "actor-viewer-001",
    agencyId: "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    role: "viewer",
  };

  const actorAgencyB: ActorContext = {
    actorId: "actor-agency-b-001",
    agencyId: "agency-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    role: "admin",
  };

  automationMemoryStore.clear();

  await t.test("1. Isolamento Multi-Tenant e Rejeição Cross-Tenant", async () => {
    automationMemoryStore.clear();

    await service.enqueueJob(adminActor, {
      idempotency_key: "idemp-agency-a-001",
      capability: "google_business_profile",
      action_name: "sync_locations",
      payload: { account: "account_a" },
    });

    await service.createWritePlan(adminActor, {
      capability: "google_business_profile",
      action_type: "update_business_hours",
      plan_payload: { hours: "08:00-18:00" },
    });

    const overviewA = await service.getOverview(adminActor);
    assert.equal(overviewA.jobs.length, 1);
    assert.equal(overviewA.write_plans.length, 1);

    const overviewB = await service.getOverview(actorAgencyB);
    assert.equal(overviewB.jobs.length, 0);
    assert.equal(overviewB.write_plans.length, 0);
  });

  await t.test("2. Bloqueio de Acesso Cross-Tenant a Jobs e Planos De Outra Agência", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(adminActor, {
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

    const res1 = await service.enqueueJob(adminActor, {
      idempotency_key: key,
      capability: "google_business_profile",
      action_name: "sync_location",
      payload: { version: 1 },
    });

    const res2 = await service.enqueueJob(adminActor, {
      idempotency_key: key,
      capability: "google_business_profile",
      action_name: "sync_location",
      payload: { version: 2 },
    });

    assert.equal(res1.deduplicated, false);
    assert.equal(res2.deduplicated, true);
    assert.equal(res1.job.id, res2.job.id);

    const overview = await service.getOverview(adminActor);
    assert.equal(overview.jobs.length, 1);
  });

  await t.test("4. Retentativas, Timeout e Redirecionamento para Dead-Letter", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(adminActor, {
      idempotency_key: "idemp-retry-test",
      capability: "google_ads",
      action_name: "sync_campaigns",
      payload: {},
      max_attempts: 2,
    });

    const step1 = await service.processJob(adminActor, {
      job_id: job.id,
      simulate_outcome: "fail_retryable",
      simulated_error_code: "network_timeout",
    });
    assert.equal(step1.status, "failed");
    assert.equal(step1.attempts, 1);

    const step2 = await service.processJob(adminActor, {
      job_id: job.id,
      simulate_outcome: "fail_retryable",
      simulated_error_code: "network_timeout",
    });
    assert.equal(step2.status, "dead_letter");
    assert.equal(step2.attempts, 2);

    const overview = await service.getOverview(adminActor);
    assert.equal(overview.summary.dead_letter_jobs, 1);
  });

  await t.test("5. Redirecionamento Direto para Dead-Letter em Falha Fatal", async () => {
    automationMemoryStore.clear();

    const { job } = await service.enqueueJob(adminActor, {
      idempotency_key: "idemp-fatal-test",
      capability: "meta_ads",
      action_name: "fetch_insights",
      payload: {},
      max_attempts: 5,
    });

    const res = await service.processJob(adminActor, {
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

  await t.test("7. Segregação de Funções (SoD) para Aprovação e Execução de Escrita Externa", async () => {
    automationMemoryStore.clear();

    const plan = await service.createWritePlan(adminActor, {
      capability: "google_business_profile",
      action_type: "create_local_post",
      plan_payload: { content: "Postagem de teste RBAC" },
    });

    // 1. operator NÃO pode aprovar
    await assert.rejects(
      async () => {
        await service.approveWritePlan(operatorActor, {
          plan_id: plan.id,
          plan_hash: plan.plan_hash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "actor_forbidden",
    );

    // 2. viewer NÃO pode aprovar
    await assert.rejects(
      async () => {
        await service.approveWritePlan(viewerActor, {
          plan_id: plan.id,
          plan_hash: plan.plan_hash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "actor_forbidden",
    );

    // 3. operator e viewer NÃO podem executar
    await assert.rejects(
      async () => {
        await service.executeWritePlan(operatorActor, {
          plan_id: plan.id,
          plan_hash: plan.plan_hash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "actor_forbidden",
    );

    // 4. owner, admin, e operations_lead Podem aprovar
    const approvedPlan = await service.approveWritePlan(opsLeadActor, {
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
      decision_notes: "Aprovado pelo líder de operações",
    });

    assert.equal(approvedPlan.status, "approved");
    assert.equal(approvedPlan.approved_by_actor_id, opsLeadActor.actorId);
  });

  await t.test("8. Exigência de Aprovação Humana Prévias e Bloqueio com WRITE_MODE=disabled Preservando Aprovação", async () => {
    automationMemoryStore.clear();

    const plan = await service.createWritePlan(adminActor, {
      capability: "google_business_profile",
      action_type: "update_business_hours",
      plan_payload: { hours: "09:00-18:00" },
    });

    // Tentativa de execução DIRETA sem aprovação prévia -> REJEITADA
    await assert.rejects(
      async () => {
        await service.executeWritePlan(adminActor, {
          plan_id: plan.id,
          plan_hash: plan.plan_hash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "write_plan_not_approved",
    );

    // Aprovação VÁLIDA por admin
    await service.approveWritePlan(ownerActor, {
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
    });

    // Item de aprovação no store deve estar 'approved'
    const apprItem = automationMemoryStore.approvalItems.find((a) => a.id === plan.approval_item_id);
    assert.ok(apprItem);
    assert.equal(apprItem.status, "approved");

    // Execução com ALASTRE_WRITE_MODE=disabled -> transiciona plano para 'blocked_write_mode'
    const res = await service.executeWritePlan(adminActor, {
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
    });

    assert.equal(res.executed, false);
    assert.equal(res.plan.status, "blocked_write_mode");
    assert.ok(res.reason?.includes("ALASTRE_WRITE_MODE está configurado como 'disabled'"));

    // O item de aprovação PERMANECE 'approved' (NÃO foi alterado nem rebaixado para rejected)
    assert.equal(apprItem.status, "approved");
  });

  await t.test("9. Replay Check / Dupla Execução Bloqueada com Sucesso", async () => {
    automationMemoryStore.clear();

    const plan = await service.createWritePlan(adminActor, {
      capability: "google_business_profile",
      action_type: "update_address",
      plan_payload: { address: "Av. Paulista, 1000" },
    });

    await service.approveWritePlan(adminActor, {
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
    });

    // Primeira execução (bloqueada pelo write_mode)
    await service.executeWritePlan(adminActor, {
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
    });

    // Segunda execução (replay) -> DEVE FALHAR
    await assert.rejects(
      async () => {
        await service.executeWritePlan(adminActor, {
          plan_id: plan.id,
          plan_hash: plan.plan_hash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "plan_already_processed",
    );
  });

  await t.test("10. Rejeição de Execução e Aprovação com Hash Divergente (Tampering)", async () => {
    automationMemoryStore.clear();

    const plan = await service.createWritePlan(adminActor, {
      capability: "google_business_profile",
      action_type: "update_address",
      plan_payload: { address: "Rua A, 123" },
    });

    const fakeHash = "f".repeat(64);

    await assert.rejects(
      async () => {
        await service.approveWritePlan(adminActor, {
          plan_id: plan.id,
          plan_hash: fakeHash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "plan_hash_mismatch",
    );

    await assert.rejects(
      async () => {
        await service.executeWritePlan(adminActor, {
          plan_id: plan.id,
          plan_hash: fakeHash,
        });
      },
      (err: unknown) => err instanceof Error && err.message === "plan_hash_mismatch",
    );
  });

  await t.test("11. Salvaguarda Anti-SSRF (Server-Side Request Forgery)", () => {
    assert.equal(validateExternalEndpointUrl("google", "https://mybusiness.googleapis.com/v4/accounts").valid, true);
    assert.equal(validateExternalEndpointUrl("meta", "https://graph.facebook.com/v19.0/me").valid, true);

    const httpCheck = validateExternalEndpointUrl("google", "http://mybusiness.googleapis.com/v4/accounts");
    assert.equal(httpCheck.valid, false);

    const ssrfCheck = validateExternalEndpointUrl("google", "https://169.254.169.254/latest/meta-data");
    assert.equal(ssrfCheck.valid, false);

    const arbitraryCheck = validateExternalEndpointUrl("google", "https://malicious-site.com/callback");
    assert.equal(arbitraryCheck.valid, false);
  });

  await t.test("12. Registro de Custos e Cotas de IA", async () => {
    automationMemoryStore.clear();

    const res = await service.recordAiUsage(adminActor, {
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

  await t.test("13. API Route Handler POST /api/automation (approve_write_plan & execute_write_plan)", async () => {
    automationMemoryStore.clear();

    // 1. Criar plano via API
    const reqCreate = new Request("http://localhost:3000/api/automation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.digital",
        "x-test-role": "admin",
      },
      body: JSON.stringify({
        action: "create_write_plan",
        capability: "google_business_profile",
        action_type: "update_phone",
        plan_payload: { phone: "+5511999999999" },
      }),
    });

    const resCreate = await automationRouteHandler(reqCreate);
    assert.equal(resCreate.status, 200);
    const plan = await resCreate.json();
    assert.ok(plan.id);
    assert.equal(plan.status, "pending_approval");

    // 2. Tentar aprovar como operator (403)
    const reqApproveOperator = new Request("http://localhost:3000/api/automation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "op@alastre.digital",
        "x-test-role": "operator",
      },
      body: JSON.stringify({
        action: "approve_write_plan",
        plan_id: plan.id,
        plan_hash: plan.plan_hash,
      }),
    });
    const resApproveOperator = await automationRouteHandler(reqApproveOperator);
    assert.equal(resApproveOperator.status, 403);

    // 3. Aprovar como admin (200)
    const reqApproveAdmin = new Request("http://localhost:3000/api/automation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.digital",
        "x-test-role": "admin",
      },
      body: JSON.stringify({
        action: "approve_write_plan",
        plan_id: plan.id,
        plan_hash: plan.plan_hash,
      }),
    });
    const resApproveAdmin = await automationRouteHandler(reqApproveAdmin);
    assert.equal(resApproveAdmin.status, 200);
    const approvedPlan = await resApproveAdmin.json();
    assert.equal(approvedPlan.status, "approved");

    // 4. Executar via API como admin (200, blocked_write_mode)
    const reqExecuteAdmin = new Request("http://localhost:3000/api/automation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.digital",
        "x-test-role": "admin",
      },
      body: JSON.stringify({
        action: "execute_write_plan",
        plan_id: plan.id,
        plan_hash: plan.plan_hash,
      }),
    });
    const resExecuteAdmin = await automationRouteHandler(reqExecuteAdmin);
    assert.equal(resExecuteAdmin.status, 200);
    const execResult = await resExecuteAdmin.json();
    assert.equal(execResult.executed, false);
    assert.equal(execResult.plan.status, "blocked_write_mode");
  });

  await t.test("14. Garantia de Ausência de Fallbacks Diretos de Tabela em Modo DB", async () => {
    // Injeta mock DB client que simula erro na chamada de RPC para garantir que nenhuma escrita direta é tentada
    const fakeDbService = new AutomationService();
    (fakeDbService as any).isDbAvailable = () => true;
    (fakeDbService as any).db = {
      rpc: async (fnName: string) => {
        return { data: null, error: { message: `simulated_rpc_failure_in_${fnName}` } };
      },
    };

    await assert.rejects(
      async () => {
        await fakeDbService.createWritePlan(adminActor, {
          capability: "google_business_profile",
          action_type: "update_website",
          plan_payload: { url: "https://example.com" },
        });
      },
      (err: unknown) => err instanceof Error && err.message === "write_plan_create_failed",
    );

    await assert.rejects(
      async () => {
        await fakeDbService.approveWritePlan(adminActor, {
          plan_id: "00000000-0000-0000-0000-000000000001",
          plan_hash: "a".repeat(64),
        });
      },
      (err: unknown) => err instanceof Error && err.message === "write_plan_approve_failed",
    );

    await assert.rejects(
      async () => {
        await fakeDbService.executeWritePlan(adminActor, {
          plan_id: "00000000-0000-0000-0000-000000000001",
          plan_hash: "a".repeat(64),
        });
      },
      (err: unknown) => err instanceof Error && err.message === "write_plan_execute_failed",
    );
  });
});
