import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationPath = `${root}/supabase/migrations/20260924110000_commercial_crm_foundation.sql`;
const migrationSql = await readFile(migrationPath, "utf8");

test("Módulo 02 Comercial & CRM: Migration e Segurança de Dados", () => {
  const tables = [
    "commercial_companies",
    "commercial_contacts",
    "commercial_opportunities",
    "commercial_assessments",
    "commercial_diagnoses",
    "commercial_proposals",
    "commercial_activities",
    "commercial_sales_handoffs",
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
      new RegExp(`constraint uq_${table}_agency_id unique \\(agency_id, id\\)`),
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
    /constraint fk_commercial_contacts_company foreign key \(agency_id, company_id\) references public\.commercial_companies\(agency_id, id\)/,
    "Contatos devem vincular à empresa com chave composta (agency_id, company_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_commercial_opportunities_company foreign key \(agency_id, company_id\) references public\.commercial_companies\(agency_id, id\)/,
    "Oportunidades devem vincular à empresa com chave composta (agency_id, company_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_commercial_assessments_opp foreign key \(agency_id, opportunity_id\) references public\.commercial_opportunities\(agency_id, id\)/,
    "Avaliações devem vincular à oportunidade com chave composta (agency_id, opportunity_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_commercial_diagnoses_opp foreign key \(agency_id, opportunity_id\) references public\.commercial_opportunities\(agency_id, id\)/,
    "Diagnósticos devem vincular à oportunidade com chave composta (agency_id, opportunity_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_commercial_proposals_opp foreign key \(agency_id, opportunity_id\) references public\.commercial_opportunities\(agency_id, id\)/,
    "Propostas devem vincular à oportunidade com chave composta (agency_id, opportunity_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_commercial_activities_opp foreign key \(agency_id, opportunity_id\) references public\.commercial_opportunities\(agency_id, id\)/,
    "Atividades devem vincular à oportunidade com chave composta (agency_id, opportunity_id)"
  );

  assert.match(
    migrationSql,
    /constraint fk_commercial_handoffs_opp foreign key \(agency_id, opportunity_id\) references public\.commercial_opportunities\(agency_id, id\)/,
    "Handoff deve vincular à oportunidade com chave composta (agency_id, opportunity_id)"
  );

  // 9. Salvaguardas em nível de banco
  assert.match(
    migrationSql,
    /constraint chk_commercial_price_requires_details check \(loss_reason_code <> 'preco' or \(loss_reason_details is not null and length\(trim\(loss_reason_details\)\) >= 10\)\)/,
    "Banco deve barrar motivo 'preco' sem detalhes mínimos de 10 caracteres"
  );

  assert.match(
    migrationSql,
    /constraint chk_commercial_next_action_required check \(length\(trim\(next_action\)\) > 0 and next_action_deadline is not null\)/,
    "Banco deve barrar oportunidade sem próxima ação e prazo"
  );
});
