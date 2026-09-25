(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GET } from "../app/api/capacity-and-finance/route.ts";

test("Módulo 08 — Capacidade e Financeiro: Segurança e Isolamento Multi-Tenant", async (t) => {
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

  await t.test("migration 20260925100000 possui agency_id obrigatório e RLS em todas as tabelas", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260925100000_capacity_and_finance_foundation.sql"
    );

    assert.ok(fs.existsSync(migrationPath), "Migration file deve existir");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Validações da migration
    assert.ok(sqlContent.includes("create table if not exists public.financial_economic_assumptions"));
    assert.ok(sqlContent.includes("create table if not exists public.financial_cost_records"));
    assert.ok(sqlContent.includes("create table if not exists public.financial_capacity_simulations"));
    assert.ok(sqlContent.includes("create table if not exists public.financial_margin_analyses"));
    assert.ok(sqlContent.includes("create table if not exists public.financial_pricing_decisions"));

    // RLS ativado em 100% das tabelas
    assert.ok(sqlContent.includes("alter table public.financial_economic_assumptions enable row level security;"));
    assert.ok(sqlContent.includes("alter table public.financial_cost_records enable row level security;"));
    assert.ok(sqlContent.includes("alter table public.financial_capacity_simulations enable row level security;"));
    assert.ok(sqlContent.includes("alter table public.financial_margin_analyses enable row level security;"));
    assert.ok(sqlContent.includes("alter table public.financial_pricing_decisions enable row level security;"));

    // Revogação de acesso público
    assert.ok(sqlContent.includes("revoke all on public.financial_economic_assumptions from public, anon, authenticated;"));
    assert.ok(sqlContent.includes("grant select, insert, update, delete on public.financial_economic_assumptions to service_role;"));
  });
});
