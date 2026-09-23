import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationPath = `${root}/supabase/migrations/20260924100000_product_factory_foundation.sql`;
const migrationSql = await readFile(migrationPath, "utf8");

test("Módulo 01 Fábrica de Produtos: Migration e Segurança de Dados", () => {
  const tables = [
    "product_definitions",
    "product_discovery_sessions",
    "product_scope_items",
    "product_operational_sops",
    "product_raci_assignments",
    "product_viability_checkpoints",
  ];

  for (const table of tables) {
    // 1. Criação de tabela
    assert.match(
      migrationSql,
      new RegExp(`create table if not exists public\\.${table}`),
      `Tabela ${table} deve ser criada na migration`,
    );

    // 2. Isolamento por agency_id
    assert.match(
      migrationSql,
      new RegExp(`agency_id uuid not null references public\\.agencies\\(id\\)`),
      `Tabela ${table} deve conter FK restritiva para agencies(id)`,
    );

    // 3. RLS Ativo
    assert.match(
      migrationSql,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `RLS deve estar habilitado para ${table}`,
    );

    // 4. Revogação de acesso anônimo e autenticado direto
    assert.match(
      migrationSql,
      new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`),
      `Acesso direto deve ser revogado para ${table}`,
    );

    // 5. Concessão exclusiva para service_role
    assert.match(
      migrationSql,
      new RegExp(`grant select, insert, update, delete on public\\.${table} to service_role`),
      `Operações devem ser concedidas apenas ao service_role para ${table}`,
    );
  }

  // 6. Índices de apoio para tenant e FKs
  assert.match(migrationSql, /create index if not exists idx_product_definitions_agency/);
  assert.match(migrationSql, /create index if not exists idx_product_definitions_status/);
  assert.match(migrationSql, /create index if not exists idx_product_discovery_agency/);
  assert.match(migrationSql, /create index if not exists idx_product_scope_items_agency/);
  assert.match(migrationSql, /create index if not exists idx_product_sops_agency/);
  assert.match(migrationSql, /create index if not exists idx_product_raci_agency/);
  assert.match(migrationSql, /create index if not exists idx_product_viability_agency/);

  // 7. Unicidade de versão por agência
  assert.match(
    migrationSql,
    /constraint uq_product_definitions_agency_slug_version unique \(agency_id, slug, version\)/,
    "Deve existir constraint de unicidade para agência, slug e versão",
  );

  // 8. Check constraints de domínio
  assert.match(migrationSql, /check \(status in \('draft', 'in_review', 'approved', 'superseded', 'archived'\)\)/);
  assert.match(migrationSql, /check \(delivery_type in \('setup', 'recurring'\)\)/);
  assert.match(migrationSql, /check \(scope_classification in \('included', 'not_included', 'optional', 'upsell'\)\)/);
  assert.match(migrationSql, /check \(raci_type in \('R', 'A', 'C', 'I'\)\)/);
  assert.match(migrationSql, /check \(result in \('blocked', 'ready_for_estimation', 'ready_for_human_review'\)\)/);
});
