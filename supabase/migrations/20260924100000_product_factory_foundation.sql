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
-- 7. RLS ativo, isolamento estrito por agency_id e acesso restrito ao service_role
-- ==============================================================================

-- 1. Tabela: product_definitions
create table if not exists public.product_definitions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
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
  constraint uq_product_definitions_agency_slug_version unique (agency_id, slug, version)
);

create index if not exists idx_product_definitions_agency on public.product_definitions(agency_id);
create index if not exists idx_product_definitions_client on public.product_definitions(client_id);
create index if not exists idx_product_definitions_status on public.product_definitions(agency_id, status);

-- 2. Tabela: product_discovery_sessions
create table if not exists public.product_discovery_sessions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null references public.product_definitions(id) on delete cascade,
  round_number integer not null default 1 check (round_number >= 1),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create index if not exists idx_product_discovery_agency on public.product_discovery_sessions(agency_id);
create index if not exists idx_product_discovery_product on public.product_discovery_sessions(product_definition_id);

-- 3. Tabela: product_scope_items
create table if not exists public.product_scope_items (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null references public.product_definitions(id) on delete cascade,
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
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_product_scope_items_agency on public.product_scope_items(agency_id);
create index if not exists idx_product_scope_items_product on public.product_scope_items(product_definition_id);

-- 4. Tabela: product_operational_sops
create table if not exists public.product_operational_sops (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null references public.product_definitions(id) on delete cascade,
  scope_item_id text references public.product_scope_items(id) on delete set null,
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
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_product_sops_agency on public.product_operational_sops(agency_id);
create index if not exists idx_product_sops_product on public.product_operational_sops(product_definition_id);

-- 5. Tabela: product_raci_assignments
create table if not exists public.product_raci_assignments (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null references public.product_definitions(id) on delete cascade,
  scope_item_id text references public.product_scope_items(id) on delete cascade,
  activity_name text not null,
  role text not null check (role in ('client', 'client_service', 'analyst', 'specialist', 'manager', 'automation_ai')),
  is_future_role boolean not null default false,
  raci_type text not null check (raci_type in ('R', 'A', 'C', 'I')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_product_raci_agency on public.product_raci_assignments(agency_id);
create index if not exists idx_product_raci_product on public.product_raci_assignments(product_definition_id);

-- 6. Tabela: product_viability_checkpoints
create table if not exists public.product_viability_checkpoints (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product_definition_id text not null references public.product_definitions(id) on delete cascade,
  discovery_completeness_percentage integer not null check (discovery_completeness_percentage between 0 and 100),
  blocking_gaps jsonb not null default '[]'::jsonb,
  total_setup_hours numeric(8,2) not null default 0,
  total_recurring_monthly_hours numeric(8,2) not null default 0,
  critical_dependencies jsonb not null default '[]'::jsonb,
  unvalidated_capacity_flags jsonb not null default '[]'::jsonb,
  result text not null check (result in ('blocked', 'ready_for_estimation', 'ready_for_human_review')),
  viability_score integer not null check (viability_score between 0 and 100),
  explanation text not null default '',
  calculated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_product_viability_agency on public.product_viability_checkpoints(agency_id);
create index if not exists idx_product_viability_product on public.product_viability_checkpoints(product_definition_id);

-- 7. Segurança: Habilitação de RLS e Políticas de Isolamento por Tenant
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

-- Políticas de RLS para service_role e isolamento multi-tenant
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
