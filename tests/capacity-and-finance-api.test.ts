(process.env as Record<string, string>).NODE_ENV = "development";

import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/capacity-and-finance/route.ts";

test("Módulo 08 — Capacidade e Financeiro: API Route GET", async (t) => {
  await t.test("retorna estrutura completa de premissas, custos, simulações, margens e aviso de isenção", async () => {
    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "GET",
      headers: {
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
    });

    const response = await GET(request);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(data.disclaimer.includes("Projeções econômicas"));
    assert.ok(Array.isArray(data.assumptions));
    assert.ok(Array.isArray(data.cost_records));
    assert.ok(Array.isArray(data.capacity_simulations));
    assert.ok(Array.isArray(data.margin_analyses));
    assert.ok(data.unit_economics);
  });
});

test("Módulo 08 — Capacidade e Financeiro: API Route POST", async (t) => {
  await t.test("cria premissa econômica com selo de origem correto", async () => {
    const payload = {
      action: "create_assumption",
      payload: {
        cost_type: "labor",
        value: 75.0,
        currency: "BRL",
        period: "hourly",
        origin: "real_observed",
        evidence_reference: "Contrato PJ Analista Sr 2026",
        responsible_name: "Financeiro Alastre",
      },
    };

    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.assumption.cost_type, "labor");
    assert.equal(data.assumption.origin, "real_observed");
  });

  await t.test("executa simulação de capacidade para cenário de 25 clientes", async () => {
    const payload = {
      action: "run_capacity_simulation",
      payload: {
        scenario_clients_count: 25,
        roles: [
          {
            role: "analyst",
            available_monthly_hours_per_head: 160,
            headcount: 1,
            estimated_minutes_per_client: 480,
          },
        ],
      },
    };

    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.scenario_clients_count, 25);
    assert.ok(data.simulations.length > 0);
  });

  await t.test("submete proposta comercial para avaliação de precificação protegida", async () => {
    const payload = {
      action: "evaluate_pricing",
      payload: {
        proposal_id: "prop-api-test-101",
        list_setup_price: 1500,
        list_monthly_price: 2500,
        proposed_setup_price: 1500,
        proposed_monthly_price: 2250,
        estimated_operational_cost: 970,
        discount_applied_pct: 10,
        discount_type: "scope_reduction",
        discount_counterpart_description: "Redução de 1 postagem semanal",
        is_cost_estimated: true,
        is_counterpart_documented: true,
      },
    };

    const request = new Request("http://localhost:3000/api/capacity-and-finance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-actor-email": "admin@alastre.com.br",
        "x-test-agency-id": "a1a57e00-0000-4000-8000-000000000001",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.evaluation.requires_human_approval, true);
    assert.ok(data.approval_item_id);
  });
});
