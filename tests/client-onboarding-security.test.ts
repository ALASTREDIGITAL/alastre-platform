import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationPath = `${root}/supabase/migrations/20260924120000_client_onboarding_foundation.sql`;
const migrationSql = await readFile(migrationPath, "utf8");

test("Módulo 03 Onboarding de Clientes: Migration e Segurança de Dados", () => {
  const tables = [
    "client_onboardings",
    "client_units",
    "client_onboarding_requirements",
    "client_onboarding_baselines",
    "client_onboarding_plans",
    "client_onboarding_decisions",
  ];

  for (const table of tables) {
    // 1. Criação de tabela
    assert.match(
      migrationSql,
      new RegExp(`create table if not exists public\\.${table}`),
      `Tabela ${table} deve ser criada na migration`
    );

    // 2. Isolamento por agency_id
    assert.match(
      migrationSql,
      new RegExp(`agency_id uuid not null references public\\.agencies\\(id\\)`),
      `Tabela ${table} deve conter FK restritiva para agencies(id)`
    );

    // 3. RLS Ativo
    assert.match(
      migrationSql,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `RLS deve estar habilitado para ${table}`
    );

    // 4. Revogação de acesso anônimo e autenticado direto
    assert.match(
      migrationSql,
      new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`),
      `Acesso direto deve ser revogado para ${table}`
    );

    // 5. Concessão exclusiva para service_role
    assert.match(
      migrationSql,
      new RegExp(`grant select, insert, update, delete on public\\.${table} to service_role`),
      `Operações devem ser concedidas apenas ao service_role para ${table}`
    );

    // 6. Chave única composta (agency_id, id) em todas as tabelas para suportar FKs multi-tenant seguras
    assert.match(
      migrationSql,
      new RegExp(`constraint uq_${table === "client_onboarding_requirements" ? "onb_reqs" : table === "client_onboarding_baselines" ? "onb_baselines" : table === "client_onboarding_plans" ? "onb_plans" : table === "client_onboarding_decisions" ? "onb_decisions" : table}_agency_id unique \\(agency_id, id\\)`),
      `Tabela ${table} deve possuir chave única composta (agency_id, id)`
    );

    // 7. Policy service_role explícita
    assert.match(
      migrationSql,
      new RegExp(`create policy ${table}_service_role on public\\.${table}`),
      `Policy service_role deve existir para ${table}`
    );
  }

  // 8. Chaves Estrangeiras Compostas Multi-Tenant (agency_id, parent_id)
  assert.match(
    migrationSql,
    /constraint fk_client_onboardings_client foreign key \(agency_id, client_id\) references public\.clients\(agency_id, id\)/,
    "client_onboardings deve vincular ao cliente com chave composta (agency_id, client_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_client_onboardings_opp foreign key \(agency_id, opportunity_id\) references public\.commercial_opportunities\(agency_id, id\)/,
    "client_onboardings deve vincular à oportunidade com chave composta (agency_id, opportunity_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_client_onboardings_handoff foreign key \(agency_id, sales_handoff_id\) references public\.commercial_sales_handoffs\(agency_id, id\)/,
    "client_onboardings deve vincular ao handoff com chave composta (agency_id, sales_handoff_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_client_onboardings_proposal foreign key \(agency_id, proposal_id\) references public\.commercial_proposals\(agency_id, id\)/,
    "client_onboardings deve vincular à proposta com chave composta (agency_id, proposal_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_client_onboardings_product foreign key \(agency_id, product_definition_id\) references public\.product_definitions\(agency_id, id\)/,
    "client_onboardings deve vincular ao produto com chave composta (agency_id, product_definition_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_client_units_client foreign key \(agency_id, client_id\) references public\.clients\(agency_id, id\)/,
    "client_units deve vincular ao cliente com chave composta (agency_id, client_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_onb_reqs_onboarding foreign key \(agency_id, onboarding_id\) references public\.client_onboardings\(agency_id, id\)/,
    "requisitos devem vincular ao onboarding com chave composta (agency_id, onboarding_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_onb_baselines_onboarding foreign key \(agency_id, onboarding_id\) references public\.client_onboardings\(agency_id, id\)/,
    "baseline deve vincular ao onboarding com chave composta (agency_id, onboarding_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_onb_plans_onboarding foreign key \(agency_id, onboarding_id\) references public\.client_onboardings\(agency_id, id\)/,
    "plano deve vincular ao onboarding com chave composta (agency_id, onboarding_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_onb_decisions_onboarding foreign key \(agency_id, onboarding_id\) references public\.client_onboardings\(agency_id, id\)/,
    "decisões devem vincular ao onboarding com chave composta (agency_id, onboarding_id)"
  );

  // 9. Atualização de approval_items
  assert.match(
    migrationSql,
    /'client_onboarding_activation'/,
    "approval_items deve incluir client_onboarding_activation no check de source_type"
  );

  // 10. Garantia de unicidade de handoff por agência (1 handoff = 1 onboarding)
  assert.match(
    migrationSql,
    /constraint uq_client_onboardings_agency_handoff unique \(agency_id, sales_handoff_id\)/,
    "Deve existir constraint única impedindo mais de um onboarding para o mesmo handoff"
  );
});
