import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationPath = `${root}/supabase/migrations/20260924150000_operations_engine_foundation.sql`;
const migrationSql = await readFile(migrationPath, "utf8");

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
      migrationSql,
      new RegExp(`create table if not exists public\\.${table}`),
      `Tabela ${table} deve ser criada com if not exists`
    );

    // 2. Isolamento por agency_id (tenant boundary)
    assert.match(
      migrationSql,
      new RegExp(`agency_id uuid not null references public\\.agencies\\(id\\)`),
      `Tabela ${table} deve possuir agency_id com FK restritiva`
    );

    // 3. Row Level Security habilitado
    assert.match(
      migrationSql,
      new RegExp(`alter table public\\.${table} enable row level security;`),
      `RLS deve estar ativo na tabela ${table}`
    );

    // 4. Revogação de acessos públicos e anon/authenticated
    assert.match(
      migrationSql,
      new RegExp(`revoke all on public\\.${table} from public, anon, authenticated;`),
      `Permissões públicas devem ser revogadas na tabela ${table}`
    );

    // 5. Concessão restrita a service_role
    assert.match(
      migrationSql,
      new RegExp(`grant select, insert, update, delete on public\\.${table} to service_role;`),
      `Acesso direto deve ser concedido exclusivamente ao service_role na tabela ${table}`
    );
  }

  // 6. Extensão segura do approval_items_source_type_check
  assert.match(
    migrationSql,
    /'operation_work_item'/,
    "A constraint de approval_items deve incluir o tipo de fonte 'operation_work_item'"
  );

  // 7. RPCs transacionais PostgreSQL com search_path seguro e SECURITY DEFINER
  const rpcs = ["operation_start_task", "operation_complete_task", "operation_log_time"];
  for (const rpc of rpcs) {
    assert.match(
      migrationSql,
      new RegExp(`create or replace function public\\.${rpc}`),
      `RPC ${rpc} deve ser criada na migration`
    );
    assert.match(
      migrationSql,
      /security definer/,
      `RPC ${rpc} deve possuir SECURITY DEFINER`
    );
    assert.match(
      migrationSql,
      /set search_path = public, pg_temp/,
      `RPC ${rpc} deve fixar search_path contra ataques de sequestro de schema`
    );
    assert.match(
      migrationSql,
      new RegExp(`revoke execute on function public\\.${rpc}.*from public, anon, authenticated;`),
      `Execução de ${rpc} deve ser revogada de papéis não privilegiados`
    );
    assert.match(
      migrationSql,
      new RegExp(`grant execute on function public\\.${rpc}.*to service_role;`),
      `Execução de ${rpc} deve ser restrita exclusivamente ao service_role`
    );
  }
});
