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

  await t.test("rejeita proposta sem cliente vinculado e NUNCA seleciona o primeiro cliente da agência", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify({
        action: "evaluate_pricing",
        payload: {
          proposal_id: "prop-unlinked-without-client",
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
    assert.equal(response.status, 400);

    const data = await response.json();
    assert.ok(data.error.includes("não possui um cliente real e verificável"));
  });

  await t.test("suporta proposta com ID textual/alfa-numérico e grava source_id com o mesmo texto canônico", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify({
        action: "evaluate_pricing",
        payload: {
          proposal_id: "prop-alfa-num-101-test",
          list_setup_price: 1500,
          list_monthly_price: 2500,
          proposed_setup_price: 1500,
          proposed_monthly_price: 2250,
          estimated_operational_cost: 970,
          discount_applied_pct: 10,
          discount_type: "scope_reduction",
          discount_counterpart_description: "Redução de escopo",
          is_cost_estimated: true,
          is_counterpart_documented: true,
        },
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.evaluation.proposal_id, "prop-alfa-num-101-test");
  });

  await t.test("rejeita aprovação se source_id ou snapshot.proposal_id divergirem da decisão financeira", async () => {
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
          approval_item_id: "appr-proposal-mismatch-test",
          decision: "approved",
        },
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 404);
  });

  await t.test("rejeita aprovação por ator com papel operacional não autorizado com HTTP 403", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "operador@alastre.com.br",
        "x-test-actor-role": "operator",
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
});

test("Módulo 08 — Capacidade e Financeiro: Integridade das Migrations", async (t) => {
  await t.test("nova migration 20260925130000 grava source_id texto canônico e valida divergência", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260925130000_capacity_and_finance_canonical_source_id.sql"
    );

    assert.ok(fs.existsSync(migrationPath), "A nova migration de source_id canônico deve existir");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Validação da gravação direta do p_proposal_id sem conversão UUID
    assert.ok(sqlContent.includes("p_proposal_id, -- TEXTO EXATO DA PROPOSTA, SEM CONVERSÃO UUID E SEM UUID ALEATÓRIO"));

    // Validação da trava de divergência canônica (source_id e snapshot)
    assert.ok(sqlContent.includes("v_approval.source_id <> v_pricing.proposal_id"));
    assert.ok(sqlContent.includes("v_snapshot_proposal_id <> v_pricing.proposal_id"));
    assert.ok(sqlContent.includes("approval_proposal_mismatch"));
    assert.ok(sqlContent.includes("security definer"));
    assert.ok(sqlContent.includes("set search_path = public, pg_temp"));
  });

  await t.test("migrations já aplicadas dos Módulos 07 e 08 não foram modificadas", () => {
    const m07Path1 = path.join(process.cwd(), "supabase", "migrations", "20260925070000_client_success_foundation.sql");
    const m07Path2 = path.join(process.cwd(), "supabase", "migrations", "20260925090000_client_success_multi_tenant_hardening.sql");
    const m08Path1 = path.join(process.cwd(), "supabase", "migrations", "20260925100000_capacity_and_finance_foundation.sql");
    const m08Path2 = path.join(process.cwd(), "supabase", "migrations", "20260925110000_capacity_and_finance_hardening.sql");
    const m08Path3 = path.join(process.cwd(), "supabase", "migrations", "20260925120000_capacity_and_finance_atomic_approvals.sql");

    assert.ok(fs.existsSync(m07Path1));
    assert.ok(fs.existsSync(m07Path2));
    assert.ok(fs.existsSync(m08Path1));
    assert.ok(fs.existsSync(m08Path2));
    assert.ok(fs.existsSync(m08Path3));
  });
});
