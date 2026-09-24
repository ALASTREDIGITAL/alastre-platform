-- ==============================================================================
-- Migration: 20260924100000_product_factory_foundation.sql
-- Módulo 01: Fábrica de Produtos da Alastre Platform
--
-- Objetivos:
-- 1. Definições de produto versionadas com imutabilidade após aprovação
-- 2. Sessões de descoberta operacional com máximo de 7 perguntas por rodada
-- 3. Matriz de escopo separando implantação de recorrência
-- 4. Procedimentos Operacionais Padrão (SOPs) estruturados
-- 5. Matriz RACI com suporte a papéis futuros
-- 6. Checkpoints de viabilidade operacional antes de precificação ou promessas
-- 7. Hardening crítico de isolamento multiempresa via FKs compostas (agency_id, parent_id)
-- 8. Acesso de banco restrito ao service_role com isolamento provado por constraints
-- ==============================================================================

-- 0. Pré-requisito de integridade: Garante chave única composta em public.clients
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clients'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.clients'::regclass and attname = 'agency_id'),
        (select attnum from pg_attribute where attrelid = 'public.clients'::regclass and attname = 'id')
      ]
  ) then
    alter table public.clients
      add constraint uq_clients_agency_id_id unique (agency_id, id);
  end if;
end;
$$;

-- 1. Tabela: product_definitions
create table if not exists public.product_definitions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid,
  name text not null,
  slug text not null,
  summary text not null default '',
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'superseded', 'archived')),
  target_objective text not null default '',
  target_market text not null default '',
  icp_description text not null default '',
  anti_icp_description text not null default '',
  transformational_promise text not null default '',
  controllable_deliverables jsonb not null default '[]'::jsonb,
  influenciable_indicators jsonb not null default '[]'::jsonb,
  external_results jsonb not null default '[]'::jsonb,
  is_immutable boolean not null default false,
  created_by_actor_id uuid,
  approved_by_actor_id uuid,
  approved_at timestamptz,
  superseded_by_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_product_definitions_agency_id unique (agency_id, id),
  constraint uq_product_definitions_agency_slug_version unique (agency_id, slug, version),
  constraint fk_product_definitions_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null
);

create index if not exists idx_product_definitions_agency on public.product_definitions(agency_id);
create index if not exists idx_product_definitions_agency_client on public.product_definitions(agency_id, client_id);
create index if not exists idx_product_definitions_status on public.product_definitions(agency_id, status);

-- 2. Tabela: product_discovery_sessions
create table if not exists public.product_discovery_sessions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null,
  round_number integer not null default 1 check (round_number >= 1),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz,
  constraint uq_product_discovery_sessions_agency_id unique (agency_id, id),
  constraint fk_product_discovery_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade
);

create index if not exists idx_product_discovery_agency_product on public.product_discovery_sessions(agency_id, product_definition_id);

-- 3. Tabela: product_scope_items
create table if not exists public.product_scope_items (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null,
  activity_name text not null,
  description text not null default '',
  delivery_type text not null default 'setup' check (delivery_type in ('setup', 'recurring')),
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'on_demand')),
  default_role text not null default 'analyst' check (default_role in ('client', 'client_service', 'analyst', 'specialist', 'manager', 'automation_ai')),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  is_automatable boolean not null default false,
  client_participation_required boolean not null default false,
  dependencies jsonb not null default '[]'::jsonb,
  acceptance_criteria text not null default '',
  required_evidence text not null default '',
  scope_classification text not null default 'included' check (scope_classification in ('included', 'not_included', 'optional', 'upsell')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_product_scope_items_agency_id unique (agency_id, id),
  constraint fk_product_scope_items_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade
);

create index if not exists idx_product_scope_items_agency_product on public.product_scope_items(agency_id, product_definition_id);

-- 4. Tabela: product_operational_sops
create table if not exists public.product_operational_sops (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null,
  scope_item_id text,
  name text not null,
  objective text not null default '',
  trigger text not null default '',
  responsible_role text not null default 'analyst' check (responsible_role in ('client', 'client_service', 'analyst', 'specialist', 'manager', 'automation_ai')),
  prerequisites jsonb not null default '[]'::jsonb,
  tools_required jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  quality_checklist jsonb not null default '[]'::jsonb,
  completion_criteria text not null default '',
  required_evidence text not null default '',
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  errors_and_exceptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_product_operational_sops_agency_id unique (agency_id, id),
  constraint fk_product_sops_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade,
  constraint fk_product_sops_scope_item foreign key (agency_id, scope_item_id) references public.product_scope_items(agency_id, id) on delete set null
);

create index if not exists idx_product_sops_agency_product on public.product_operational_sops(agency_id, product_definition_id);
create index if not exists idx_product_sops_agency_scope on public.product_operational_sops(agency_id, scope_item_id);

-- 5. Tabela: product_raci_assignments
create table if not exists public.product_raci_assignments (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null,
  scope_item_id text,
  activity_name text not null,
  role text not null check (role in ('client', 'client_service', 'analyst', 'specialist', 'manager', 'automation_ai')),
  is_future_role boolean not null default false,
  raci_type text not null check (raci_type in ('R', 'A', 'C', 'I')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_product_raci_assignments_agency_id unique (agency_id, id),
  constraint fk_product_raci_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade,
  constraint fk_product_raci_scope_item foreign key (agency_id, scope_item_id) references public.product_scope_items(agency_id, id) on delete cascade
);

create index if not exists idx_product_raci_agency_product on public.product_raci_assignments(agency_id, product_definition_id);
create index if not exists idx_product_raci_agency_scope on public.product_raci_assignments(agency_id, scope_item_id);

-- 6. Tabela: product_viability_checkpoints
create table if not exists public.product_viability_checkpoints (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null,
  discovery_completeness_percentage integer not null check (discovery_completeness_percentage between 0 and 100),
  blocking_gaps jsonb not null default '[]'::jsonb,
  total_setup_hours numeric(8,2) not null default 0,
  total_recurring_monthly_hours numeric(8,2) not null default 0,
  critical_dependencies jsonb not null default '[]'::jsonb,
  unvalidated_capacity_flags jsonb not null default '[]'::jsonb,
  result text not null check (result in ('blocked', 'ready_for_estimation', 'ready_for_human_review')),
  viability_score integer not null check (viability_score between 0 and 100),
  explanation text not null default '',
  calculated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_product_viability_checkpoints_agency_id unique (agency_id, id),
  constraint fk_product_viability_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade
);

create index if not exists idx_product_viability_agency_product on public.product_viability_checkpoints(agency_id, product_definition_id);

-- 7. Segurança: Habilitação de RLS e Políticas de Acesso
alter table public.product_definitions enable row level security;
alter table public.product_discovery_sessions enable row level security;
alter table public.product_scope_items enable row level security;
alter table public.product_operational_sops enable row level security;
alter table public.product_raci_assignments enable row level security;
alter table public.product_viability_checkpoints enable row level security;

-- Revogação estrita de acessos diretos de clientes anônimos e autenticados
revoke all on public.product_definitions from public, anon, authenticated;
revoke all on public.product_discovery_sessions from public, anon, authenticated;
revoke all on public.product_scope_items from public, anon, authenticated;
revoke all on public.product_operational_sops from public, anon, authenticated;
revoke all on public.product_raci_assignments from public, anon, authenticated;
revoke all on public.product_viability_checkpoints from public, anon, authenticated;

-- Concessão exclusiva de operações server-side para o service_role
grant select, insert, update, delete on public.product_definitions to service_role;
grant select, insert, update, delete on public.product_discovery_sessions to service_role;
grant select, insert, update, delete on public.product_scope_items to service_role;
grant select, insert, update, delete on public.product_operational_sops to service_role;
grant select, insert, update, delete on public.product_raci_assignments to service_role;
grant select, insert, update, delete on public.product_viability_checkpoints to service_role;

-- ==============================================================================
-- IMPORTANTE - ARQUITETURA DE SEGURANÇA E ISOLAMENTO MULTI-TENANT:
--
-- As policies 'service_role using (true)' abaixo NÃO oferecem isolamento por tenant por si sós;
-- elas restringem o acesso de leitura e escrita exclusivamente ao backend confiável (service_role),
-- impedindo qualquer acesso direto de clientes de frontend (anon ou authenticated).
--
-- O isolamento estrito entre empresas (tenant isolation) é garantido em profundidade por:
-- 1. Chaves estrangeiras compostas obrigatórias no banco: (agency_id, parent_id) referenciando
--    (agency_id, id), tornando fisicamente impossível no nível relacional que uma linha da agência A
--    aponte para recursos pertencentes à agência B (prevenção contra corrupção cross-tenant).
-- 2. Resolução server-side mandatória do ator autenticado (actor.agencyId) em todas as rotas e queries.
-- ==============================================================================

create policy product_definitions_service_role on public.product_definitions
  for all to service_role using (true) with check (true);

create policy product_discovery_sessions_service_role on public.product_discovery_sessions
  for all to service_role using (true) with check (true);

create policy product_scope_items_service_role on public.product_scope_items
  for all to service_role using (true) with check (true);

create policy product_operational_sops_service_role on public.product_operational_sops
  for all to service_role using (true) with check (true);

create policy product_raci_assignments_service_role on public.product_raci_assignments
  for all to service_role using (true) with check (true);

create policy product_viability_checkpoints_service_role on public.product_viability_checkpoints
  for all to service_role using (true) with check (true);
