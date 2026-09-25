(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { POST as clientSuccessRouteHandler, GET as clientSuccessGetHandler } from "../app/api/client-success/route.ts";
import { clientSuccessMemoryStore } from "../lib/client-success-api.ts";

test("Módulo 07 — Segurança: Isolamento Multi-Tenant por Agency ID", async (t) => {
  clientSuccessMemoryStore.clear();

  const agencyA = "00000000-0000-4000-a000-000000000001";
  const agencyB = "00000000-0000-4000-a000-000000000002";
  const clientA = "11111111-1111-4111-a111-111111111111";

  await t.test("garante que dados criados pela Agência A não são vazados para a Agência B", async () => {
    // 1. Agência A cria recomendação de expansão
    clientSuccessMemoryStore.expansionRecommendations.push({
      id: crypto.randomUUID(),
      agency_id: agencyA,
      client_id: clientA,
      type: "expansion_service",
      target_service_name: "SEO Local Premium",
      demonstrated_fit_rationale: "Fit demonstrado com score 95",
      evidenced_value_rationale: "Valor evidenciado por 10 postagens otimizadas",
      operational_impact_assessment: "Capacidade operacional disponível no Módulo 04",
      human_approval_status: "pending",
      created_at: new Date().toISOString(),
    });

    // 2. Agência B realiza consulta de carteira
    const reqAgencyB = new Request("http://localhost/api/client-success", {
      headers: {
        "x-test-agency-id": agencyB,
        "x-alastre-bridge-secret": "test-secret",
        "x-alastre-user-email": "operador.b@alastredigital.com",
      },
    });

    const resB = await clientSuccessGetHandler(reqAgencyB);
    assert.equal(resB.status, 200);

    const dataB = await resGetJson(resB);
    // Agência B não pode ver itens da Agência A
    const bItems = dataB.expansionRecommendations.filter((e: any) => e.agency_id === agencyA);
    assert.equal(bItems.length, 0);
  });
});

test("Módulo 07 — Segurança: Verificação de Migrations Forward-Only e Constraints RLS", async (t) => {
  await t.test("valida existência das migrations foundation e hardening do Módulo 07", () => {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs.readdirSync(migrationsDir);

    const foundation = files.find((f) => f.includes("client_success_foundation"));
    const hardening = files.find((f) => f.includes("client_success_hardening"));

    assert.ok(foundation, "Migration 20260925070000_client_success_foundation.sql deve existir");
    assert.ok(hardening, "Migration 20260925080000_client_success_hardening.sql deve existir");

    const foundationSql = fs.readFileSync(path.join(migrationsDir, foundation!), "utf8");
    const hardeningSql = fs.readFileSync(path.join(migrationsDir, hardening!), "utf8");

    // Verificar RLS e Revogação de privilégios públicos
    assert.ok(foundationSql.includes("enable row level security"), "Todas as tabelas do Módulo 07 devem habilitar RLS");
    assert.ok(foundationSql.includes("revoke all on public.client_health_scores from public, anon, authenticated"), "Permissões públicas devem ser revogadas");
    assert.ok(foundationSql.includes("grant all on public.client_health_scores to service_role"), "Acesso restrito a service_role");

    // Verificar Foreign Keys compostas
    assert.ok(foundationSql.includes("references public.clients(agency_id, id)"), "Foreign keys devem incluir agency_id composto");
    assert.ok(hardeningSql.includes("idx_client_health_scores_agency_client"), "Hardening deve conter índices compostos para isolamento por tenant");
  });
});

async function resGetJson(res: Response) {
  return await res.json();
}
