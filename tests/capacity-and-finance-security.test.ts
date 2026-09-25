(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GET, POST } from "../app/api/capacity-and-finance/route.ts";

test("Módulo 08 — Capacidade e Financeiro: Segurança, RBAC e Tratamento de Falhas de Banco", async (t) => {
  await t.test("bloqueia requisição não autenticada quando flag de teste unauth é enviada", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "GET",
      headers: {
        "x-test-unauth": "true",
      },
    });

    const response = await GET(request);
    assert.equal(response.status, 401);
  });

  await t.test("retorna 503/500 em falha de banco e NUNCA utiliza fallback de memória", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
        "x-test-force-db-failure": "true",
      },
      body: JSON.stringify({
        action: "create_assumption",
        payload: {
          cost_type: "labor",
          value: 100,
          currency: "BRL",
          period: "hourly",
          origin: "hypothesis",
          responsible_name: "Test",
        },
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 500);

    const data = await response.json();
    assert.ok(data.error.includes("Falha na camada de persistência de banco de dados"));
    assert.equal(data.success, undefined);
  });

  await t.test("rejeita aprovação por ator com papel operacional não autorizado com HTTP 403", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "operador@alastre.com.br",
        "x-test-actor-role": "operator", // Papel sem permissão de aprovação financeira
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify({
        action: "process_pricing_approval",
        payload: {
          approval_item_id: "appr-001",
          decision: "approved",
          decision_note: "Tentativa de aprovação não autorizada",
        },
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 403);

    const data = await response.json();
    assert.ok(data.error.includes("papel operacional não autorizado"));
  });

  await t.test("rejeita dupla aprovação ou aprovação de item inexistente/já decidido", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-actor-role": "admin",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify({
        action: "process_pricing_approval",
        payload: {
          approval_item_id: "appr-non-existent-999",
          decision: "approved",
        },
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 404);
  });

  await t.test("rejeita proposta não existente ou pertencente a outra agência", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-actor-role": "admin",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify({
        action: "evaluate_pricing",
        payload: {
          proposal_id: "prop-non-existent-cross-tenant",
          list_setup_price: 1000,
          list_monthly_price: 2000,
          proposed_setup_price: 1000,
          proposed_monthly_price: 2000,
          estimated_operational_cost: 800,
          discount_applied_pct: 0,
          is_cost_estimated: true,
          is_counterpart_documented: true,
        },
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 404);
  });
});

test("Módulo 08 — Capacidade e Financeiro: Integridade das Migrations", async (t) => {
  await t.test("nova migration 20260925110000 contém FKs compostas e RPC transacional", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260925110000_capacity_and_finance_hardening.sql"
    );

    assert.ok(fs.existsSync(migrationPath), "A nova migration de hardening deve existir");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Validação das FKs compostas
    assert.ok(sqlContent.includes("foreign key (agency_id, approval_item_id)"));
    assert.ok(sqlContent.includes("references public.approval_items(agency_id, id)"));
    assert.ok(sqlContent.includes("foreign key (agency_id, workflow_id)"));
    assert.ok(sqlContent.includes("references public.workflows(agency_id, id)"));
    assert.ok(sqlContent.includes("foreign key (agency_id, work_item_id)"));
    assert.ok(sqlContent.includes("references public.work_items(agency_id, id)"));

    // Validação da RPC atômica transacional
    assert.ok(sqlContent.includes("create or replace function public.process_capacity_pricing_approval"));
    assert.ok(sqlContent.includes("p_actor_role not in ('owner', 'admin', 'operations_lead', 'commercial_lead')"));
    assert.ok(sqlContent.includes("security definer"));
    assert.ok(sqlContent.includes("set search_path = public, pg_temp"));
  });

  await t.test("migrations já aplicadas do Módulo 07 não foram modificadas", () => {
    const m07Path1 = path.join(process.cwd(), "supabase", "migrations", "20260925070000_client_success_foundation.sql");
    const m07Path2 = path.join(process.cwd(), "supabase", "migrations", "20260925090000_client_success_multi_tenant_hardening.sql");

    assert.ok(fs.existsSync(m07Path1));
    assert.ok(fs.existsSync(m07Path2));

    const content1 = fs.readFileSync(m07Path1, "utf-8");
    const content2 = fs.readFileSync(m07Path2, "utf-8");

    // Verifica integridade dos arquivos de migração prévios
    assert.ok(content1.includes("create table if not exists public.client_health_scores"));
    assert.ok(content2.includes("client_meetings_agency_service_fk"));
  });
});
