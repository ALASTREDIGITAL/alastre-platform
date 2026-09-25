import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const foundationPath = `${root}/supabase/migrations/20260924150000_operations_engine_foundation.sql`;
const hardeningPath = `${root}/supabase/migrations/20260925030000_operations_engine_hardening.sql`;

const foundationSql = await readFile(foundationPath, "utf8");
const hardeningSql = await readFile(hardeningPath, "utf8");

test("Módulo 04 Operations Engine: Migration e Hardening de Segurança no Banco de Dados", () => {
  const tables = [
    "workflow_templates",
    "workflows",
    "work_items",
    "work_item_time_logs",
    "operational_exceptions",
  ];

  for (const table of tables) {
    // 1. Criação de tabela aditiva
    assert.match(
      foundationSql,
      new RegExp(`create table if not exists public\\.${table}`),
      `Tabela ${table} deve ser criada com if not exists`
    );

    // 2. Isolamento por agency_id (tenant boundary)
    assert.match(
      foundationSql,
      new RegExp(`agency_id uuid not null references public\\.agencies\\(id\\)`),
      `Tabela ${table} deve possuir agency_id com FK restritiva`
    );

    // 3. Row Level Security habilitado
    assert.match(
      foundationSql,
      new RegExp(`alter table public\\.${table} enable row level security;`),
      `RLS deve estar ativo na tabela ${table}`
    );

    // 4. Revogação de acessos públicos e anon/authenticated
    assert.match(
      foundationSql,
      new RegExp(`revoke all on public\\.${table} from public, anon, authenticated;`),
      `Permissões públicas devem ser revogadas na tabela ${table}`
    );

    // 5. Concessão restrita a service_role
    assert.match(
      foundationSql,
      new RegExp(`grant select, insert, update, delete on public\\.${table} to service_role;`),
      `Acesso direto deve ser concedido exclusivamente ao service_role na tabela ${table}`
    );
  }

  // 6. Extensão segura do approval_items_source_type_check
  assert.match(
    foundationSql,
    /'operation_work_item'/,
    "A constraint de approval_items deve incluir o tipo de fonte 'operation_work_item'"
  );

  // 7. Unique Constraints em (agency_id, id) nas tabelas pai na migration de hardening
  const parentTables = ["clients", "client_units", "client_services", "workflows", "work_items"];
  for (const parent of parentTables) {
    assert.match(
      hardeningSql,
      new RegExp(`alter table public\\.${parent} add constraint ${parent}_agency_id_id_key unique \\(agency_id, id\\);`),
      `Tabela pai ${parent} deve possuir unique constraint em (agency_id, id)`
    );
  }

  // 8. Foreign Keys Compostas com agency_id para isolamento físico multi-tenant
  const compositeFks = [
    // Workflows
    "foreign key \\(agency_id, client_id\\) references public\\.clients\\(agency_id, id\\)",
    "foreign key \\(agency_id, unit_id\\) references public\\.client_units\\(agency_id, id\\)",
    "foreign key \\(agency_id, service_id\\) references public\\.client_services\\(agency_id, id\\)",
    // Work Items
    "foreign key \\(agency_id, workflow_id\\) references public\\.workflows\\(agency_id, id\\)",
    "foreign key \\(agency_id, client_id\\) references public\\.clients\\(agency_id, id\\)",
    "foreign key \\(agency_id, unit_id\\) references public\\.client_units\\(agency_id, id\\)",
    // Time Logs
    "foreign key \\(agency_id, work_item_id\\) references public\\.work_items\\(agency_id, id\\)",
    "foreign key \\(agency_id, client_id\\) references public\\.clients\\(agency_id, id\\)",
    // Operational Exceptions
    "foreign key \\(agency_id, workflow_id\\) references public\\.workflows\\(agency_id, id\\)",
    "foreign key \\(agency_id, work_item_id\\) references public\\.work_items\\(agency_id, id\\)",
    "foreign key \\(agency_id, client_id\\) references public\\.clients\\(agency_id, id\\)",
  ];

  for (const fkPattern of compositeFks) {
    assert.match(
      hardeningSql,
      new RegExp(fkPattern),
      `Foreign key composta correspondente ao padrão ${fkPattern} deve existir na migration de hardening`
    );
  }

  // 9. RPCs transacionais PostgreSQL com search_path vazio (SET search_path = '') e SECURITY DEFINER
  const rpcs = ["operation_start_task", "operation_complete_task", "operation_log_time"];
  for (const rpc of rpcs) {
    assert.match(
      hardeningSql,
      new RegExp(`create or replace function public\\.${rpc}`),
      `RPC ${rpc} deve ser criada/atualizada na migration de hardening`
    );
    assert.match(
      hardeningSql,
      /security definer/,
      `RPC ${rpc} deve possuir SECURITY DEFINER`
    );
    assert.match(
      hardeningSql,
      /set search_path = ''/,
      `RPC ${rpc} deve fixar search_path vazio contra sequestro de schema`
    );
    assert.match(
      hardeningSql,
      new RegExp(`revoke execute on function public\\.${rpc}.*from public, anon, authenticated;`),
      `Execução de ${rpc} deve ser revogada de papéis não privilegiados`
    );
    assert.match(
      hardeningSql,
      new RegExp(`grant execute on function public\\.${rpc}.*to service_role;`),
      `Execução de ${rpc} deve ser restrita exclusivamente ao service_role`
    );
  }
});
