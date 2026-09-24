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

    // 6. Chave única composta (agency_id, id) em todas as tabelas filhas
    assert.match(
      migrationSql,
      new RegExp(`constraint uq_${table}_agency_id unique \\(agency_id, id\\)`),
      `Tabela ${table} deve possuir chave única composta (agency_id, id) para suportar FKs multi-tenant seguras`,
    );
  }

  // 7. Validação da chave composta pré-requisito em public.clients
  assert.match(
    migrationSql,
    /alter table public\.clients\s+add constraint uq_clients_agency_id_id unique \(agency_id, id\)/,
    "Migration deve garantir constraint única segura em clients(agency_id, id)",
  );

  // 8. Foreign keys compostas obrigatórias (agency_id, ...) -> impedindo corrupção cross-tenant
  assert.match(
    migrationSql,
    /constraint fk_product_definitions_client foreign key \(agency_id, client_id\) references public\.clients\(agency_id, id\)/,
    "product_definitions deve vincular client_id com verificação da agência",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_discovery_product foreign key \(agency_id, product_definition_id\) references public\.product_definitions\(agency_id, id\)/,
    "product_discovery_sessions deve possuir FK composta para product_definitions(agency_id, id)",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_scope_items_product foreign key \(agency_id, product_definition_id\) references public\.product_definitions\(agency_id, id\)/,
    "product_scope_items deve possuir FK composta para product_definitions(agency_id, id)",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_sops_product foreign key \(agency_id, product_definition_id\) references public\.product_definitions\(agency_id, id\)/,
    "product_operational_sops deve possuir FK composta para product_definitions(agency_id, id)",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_sops_scope_item foreign key \(agency_id, scope_item_id\) references public\.product_scope_items\(agency_id, id\)/,
    "product_operational_sops deve possuir FK composta para product_scope_items(agency_id, id)",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_raci_product foreign key \(agency_id, product_definition_id\) references public\.product_definitions\(agency_id, id\)/,
    "product_raci_assignments deve possuir FK composta para product_definitions(agency_id, id)",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_raci_scope_item foreign key \(agency_id, scope_item_id\) references public\.product_scope_items\(agency_id, id\)/,
    "product_raci_assignments deve possuir FK composta para product_scope_items(agency_id, id)",
  );
  assert.match(
    migrationSql,
    /constraint fk_product_viability_product foreign key \(agency_id, product_definition_id\) references public\.product_definitions\(agency_id, id\)/,
    "product_viability_checkpoints deve possuir FK composta para product_definitions(agency_id, id)",
  );

  // 9. Índices de apoio para todas as FKs compostas
  assert.match(migrationSql, /create index if not exists idx_product_definitions_agency_client on public\.product_definitions\(agency_id, client_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_discovery_agency_product on public\.product_discovery_sessions\(agency_id, product_definition_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_scope_items_agency_product on public\.product_scope_items\(agency_id, product_definition_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_sops_agency_product on public\.product_operational_sops\(agency_id, product_definition_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_sops_agency_scope on public\.product_operational_sops\(agency_id, scope_item_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_raci_agency_product on public\.product_raci_assignments\(agency_id, product_definition_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_raci_agency_scope on public\.product_raci_assignments\(agency_id, scope_item_id\)/);
  assert.match(migrationSql, /create index if not exists idx_product_viability_agency_product on public\.product_viability_checkpoints\(agency_id, product_definition_id\)/);

  // 10. Esclarecimento documentado na migration sobre RLS e tenant isolation
  assert.match(
    migrationSql,
    /As policies 'service_role using \(true\)' abaixo NÃO oferecem isolamento por tenant por si sós/,
    "Migration deve explicitar nos comentários que policy using (true) não garante isolamento por tenant",
  );
  assert.match(
    migrationSql,
    /O isolamento estrito entre empresas \(tenant isolation\) é garantido em profundidade por:/,
    "Migration deve explicitar os mecanismos reais de isolamento",
  );

  // 11. Unicidade de versão por agência
  assert.match(
    migrationSql,
    /constraint uq_product_definitions_agency_slug_version unique \(agency_id, slug, version\)/,
    "Deve existir constraint de unicidade para agência, slug e versão",
  );

  // 12. Check constraints de domínio
  assert.match(migrationSql, /check \(status in \('draft', 'in_review', 'approved', 'superseded', 'archived'\)\)/);
  assert.match(migrationSql, /check \(delivery_type in \('setup', 'recurring'\)\)/);
  assert.match(migrationSql, /check \(scope_classification in \('included', 'not_included', 'optional', 'upsell'\)\)/);
  assert.match(migrationSql, /check \(raci_type in \('R', 'A', 'C', 'I'\)\)/);
  assert.match(migrationSql, /check \(result in \('blocked', 'ready_for_estimation', 'ready_for_human_review'\)\)/);
});
