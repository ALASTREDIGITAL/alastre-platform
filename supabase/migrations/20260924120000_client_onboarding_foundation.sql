-- ==============================================================================
-- Migration: 20260924120000_client_onboarding_foundation.sql
-- Módulo 03: Onboarding de Clientes da Alastre Platform
--
-- Objetivos:
-- 1. Criação das entidades centrais de Onboarding:
--    - client_onboardings (Processo de onboarding de cliente com 12 estágios)
--    - client_units (Unidades operacionais: sede, filiais, áreas de atendimento, vínculo GBP)
--    - client_onboarding_requirements (Coleta de dados, fotos, contatos, horários, acessos)
--    - client_onboarding_baselines (Diagnóstico de partida versionado e sem dados sintéticos)
--    - client_onboarding_plans (Plano de implantação derivado de escopo e SOPs)
--    - client_onboarding_decisions (Registro auditável de decisões, divergências e aprovações)
-- 2. Atualização de approval_items para suportar 'client_onboarding_activation'
-- 3. Hardening multi-tenant via FKs compostas (agency_id, parent_id)
-- 4. RLS 100% ativo, revogação de acessos diretos de anon/authenticated
--    e delegação segura exclusiva para service_role no backend autenticado.
-- ==============================================================================

-- 1. Tabela: client_onboardings
create table if not exists public.client_onboardings (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid,
  opportunity_id text,
  sales_handoff_id text,
  proposal_id text,
  product_definition_id text,
  product_version integer not null default 1 check (product_version >= 1),
  status text not null default 'draft' check (status in (
    'draft',
    'awaiting_commercial_review',
    'awaiting_operations_review',
    'awaiting_client_information',
    'collecting_access',
    'building_dna',
    'establishing_baseline',
    'planning_implementation',
    'ready_for_activation',
    'active',
    'blocked',
    'cancelled'
  )),
  current_stage text not null default 'draft',
  divergence_reason text,
  blocking_reason text,
  commercial_scope_snapshot jsonb not null default '{}'::jsonb,
  created_by_actor_id text not null,
  assigned_operator_actor_id text,
  idempotency_key text,
  activated_at timestamptz,
  activated_by_actor_id text,
  activation_approval_id uuid references public.approval_items(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_client_onboardings_agency_id unique (agency_id, id),
  constraint uq_client_onboardings_agency_handoff unique (agency_id, sales_handoff_id),
  constraint uq_client_onboardings_idempotency unique nulls distinct (agency_id, idempotency_key),
  constraint fk_client_onboardings_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null,
  constraint fk_client_onboardings_opp foreign key (agency_id, opportunity_id) references public.commercial_opportunities(agency_id, id) on delete cascade,
  constraint fk_client_onboardings_handoff foreign key (agency_id, sales_handoff_id) references public.commercial_sales_handoffs(agency_id, id) on delete cascade,
  constraint fk_client_onboardings_proposal foreign key (agency_id, proposal_id) references public.commercial_proposals(agency_id, id) on delete cascade,
  constraint fk_client_onboardings_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade
);

create index if not exists idx_client_onboardings_agency on public.client_onboardings(agency_id);
create index if not exists idx_client_onboardings_agency_client on public.client_onboardings(agency_id, client_id);
create index if not exists idx_client_onboardings_agency_status on public.client_onboardings(agency_id, status);
create index if not exists idx_client_onboardings_agency_handoff on public.client_onboardings(agency_id, sales_handoff_id);

-- 2. Tabela: client_units
create table if not exists public.client_units (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  onboarding_id text,
  name text not null,
  unit_type text not null default 'headquarters' check (unit_type in ('headquarters', 'branch', 'service_area_hub')),
  is_physical_store boolean not null default true,
  has_service_area boolean not null default false,
  service_radius_km numeric(6,2),
  status text not null default 'active' check (status in ('active', 'pending_verification', 'suspended', 'inactive')),
  phone text,
  email text,
  address_street text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text not null,
  state_uf text not null,
  postal_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  business_hours jsonb not null default '{}'::jsonb,
  gbp_place_id text,
  gbp_location_id text,
  gbp_cid text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_client_units_agency_id unique (agency_id, id),
  constraint fk_client_units_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  constraint fk_client_units_onboarding foreign key (agency_id, onboarding_id) references public.client_onboardings(agency_id, id) on delete set null
);

create index if not exists idx_client_units_agency on public.client_units(agency_id);
create index if not exists idx_client_units_agency_client on public.client_units(agency_id, client_id);
create index if not exists idx_client_units_agency_onboarding on public.client_units(agency_id, onboarding_id);

-- 3. Tabela: client_onboarding_requirements
create table if not exists public.client_onboarding_requirements (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  onboarding_id text not null,
  client_id uuid,
  unit_id text,
  category text not null check (category in (
    'business_data',
    'key_contacts',
    'brand_identity',
    'products_services',
    'locations_and_hours',
    'photos_media',
    'access_credentials',
    'consents_agreements',
    'goals_and_expectations',
    'restrictions_rules',
    'historical_background',
    'known_competitors'
  )),
  title text not null,
  description text not null default '',
  responsible text not null default 'client' check (responsible in ('client', 'agency')),
  is_required boolean not null default true,
  blocks_activation boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'verified', 'waived')),
  deadline timestamptz,
  evidence_text text,
  evidence_url text,
  notes text not null default '',
  waived_reason text,
  verified_by_actor_id text,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_onb_reqs_agency_id unique (agency_id, id),
  constraint fk_onb_reqs_onboarding foreign key (agency_id, onboarding_id) references public.client_onboardings(agency_id, id) on delete cascade,
  constraint fk_onb_reqs_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null,
  constraint fk_onb_reqs_unit foreign key (agency_id, unit_id) references public.client_units(agency_id, id) on delete set null
);

create index if not exists idx_onb_reqs_agency on public.client_onboarding_requirements(agency_id);
create index if not exists idx_onb_reqs_agency_onboarding on public.client_onboarding_requirements(agency_id, onboarding_id);
create index if not exists idx_onb_reqs_agency_status on public.client_onboarding_requirements(agency_id, status);

-- 4. Tabela: client_onboarding_baselines
create table if not exists public.client_onboarding_baselines (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  onboarding_id text not null,
  client_id uuid not null,
  unit_id text,
  version integer not null default 1 check (version >= 1),
  source text not null default 'manual_audit' check (source in ('manual_audit', 'dna_inferred', 'connection_discovered', 'partial_telemetry')),
  profile_completeness_score integer check (profile_completeness_score is null or (profile_completeness_score between 0 and 100)),
  current_rating numeric(3,2),
  current_review_count integer check (current_review_count is null or current_review_count >= 0),
  unanswered_reviews_count integer check (unanswered_reviews_count is null or unanswered_reviews_count >= 0),
  ranking_visibility_notes text not null default '',
  content_audit jsonb not null default '{}'::jsonb,
  tracked_keywords jsonb not null default '[]'::jsonb,
  known_competitors jsonb not null default '[]'::jsonb,
  available_conversions jsonb not null default '{}'::jsonb,
  collection_limitations jsonb not null default '[]'::jsonb,
  unavailable_data_points jsonb not null default '[]'::jsonb,
  established_by_actor_id text not null,
  established_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_onb_baselines_agency_id unique (agency_id, id),
  constraint fk_onb_baselines_onboarding foreign key (agency_id, onboarding_id) references public.client_onboardings(agency_id, id) on delete cascade,
  constraint fk_onb_baselines_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  constraint fk_onb_baselines_unit foreign key (agency_id, unit_id) references public.client_units(agency_id, id) on delete set null
);

create index if not exists idx_onb_baselines_agency on public.client_onboarding_baselines(agency_id);
create index if not exists idx_onb_baselines_agency_onboarding on public.client_onboarding_baselines(agency_id, onboarding_id);

-- 5. Tabela: client_onboarding_plans
create table if not exists public.client_onboarding_plans (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  onboarding_id text not null,
  client_id uuid not null,
  product_definition_id text not null,
  product_version integer not null default 1 check (product_version >= 1),
  status text not null default 'draft' check (status in ('draft', 'ready', 'in_execution', 'completed')),
  items jsonb not null default '[]'::jsonb,
  total_setup_minutes integer not null default 0 check (total_setup_minutes >= 0),
  total_recurring_monthly_minutes integer not null default 0 check (total_recurring_monthly_minutes >= 0),
  target_start_date date,
  target_activation_date date,
  planned_by_actor_id text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_onb_plans_agency_id unique (agency_id, id),
  constraint fk_onb_plans_onboarding foreign key (agency_id, onboarding_id) references public.client_onboardings(agency_id, id) on delete cascade,
  constraint fk_onb_plans_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  constraint fk_onb_plans_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete cascade
);

create index if not exists idx_onb_plans_agency on public.client_onboarding_plans(agency_id);
create index if not exists idx_onb_plans_agency_onboarding on public.client_onboarding_plans(agency_id, onboarding_id);

-- 6. Tabela: client_onboarding_decisions
create table if not exists public.client_onboarding_decisions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  onboarding_id text not null,
  decision_type text not null check (decision_type in (
    'commercial_review_approved',
    'commercial_review_diverged',
    'operations_review_approved',
    'operations_review_blocked',
    'requirement_waived',
    'activation_submitted',
    'activation_approved',
    'onboarding_blocked',
    'onboarding_unblocked',
    'onboarding_cancelled'
  )),
  actor_id text not null,
  actor_name text not null,
  actor_role text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  decided_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_onb_decisions_agency_id unique (agency_id, id),
  constraint fk_onb_decisions_onboarding foreign key (agency_id, onboarding_id) references public.client_onboardings(agency_id, id) on delete cascade
);

create index if not exists idx_onb_decisions_agency on public.client_onboarding_decisions(agency_id);
create index if not exists idx_onb_decisions_agency_onboarding on public.client_onboarding_decisions(agency_id, onboarding_id);

-- 7. Atualização do constraint de source_type em approval_items
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.approval_items'::regclass
      and conname = 'approval_items_source_type_check'
  ) then
    alter table public.approval_items drop constraint approval_items_source_type_check;
  end if;

  alter table public.approval_items
    add constraint approval_items_source_type_check check (source_type in (
      'google_ads_campaign',
      'tracking_deployment',
      'tracking_publication',
      'local_seo_post',
      'local_seo_review_response',
      'local_seo_opportunity_action',
      'client_onboarding_activation'
    ));
end;
$$;

-- ==============================================================================
-- Row Level Security (RLS) e Políticas de Acesso
-- ==============================================================================

alter table public.client_onboardings enable row level security;
alter table public.client_units enable row level security;
alter table public.client_onboarding_requirements enable row level security;
alter table public.client_onboarding_baselines enable row level security;
alter table public.client_onboarding_plans enable row level security;
alter table public.client_onboarding_decisions enable row level security;

-- Revogação estrita de acessos diretos de anon/authenticated
revoke all on public.client_onboardings from public, anon, authenticated;
revoke all on public.client_units from public, anon, authenticated;
revoke all on public.client_onboarding_requirements from public, anon, authenticated;
revoke all on public.client_onboarding_baselines from public, anon, authenticated;
revoke all on public.client_onboarding_plans from public, anon, authenticated;
revoke all on public.client_onboarding_decisions from public, anon, authenticated;

-- Concessão exclusiva para operações server-side de service_role
grant select, insert, update, delete on public.client_onboardings to service_role;
grant select, insert, update, delete on public.client_units to service_role;
grant select, insert, update, delete on public.client_onboarding_requirements to service_role;
grant select, insert, update, delete on public.client_onboarding_baselines to service_role;
grant select, insert, update, delete on public.client_onboarding_plans to service_role;
grant select, insert, update, delete on public.client_onboarding_decisions to service_role;

-- Policies de isolamento para service_role
create policy client_onboardings_service_role on public.client_onboardings
  for all to service_role using (true) with check (true);

create policy client_units_service_role on public.client_units
  for all to service_role using (true) with check (true);

create policy client_onboarding_requirements_service_role on public.client_onboarding_requirements
  for all to service_role using (true) with check (true);

create policy client_onboarding_baselines_service_role on public.client_onboarding_baselines
  for all to service_role using (true) with check (true);

create policy client_onboarding_plans_service_role on public.client_onboarding_plans
  for all to service_role using (true) with check (true);

create policy client_onboarding_decisions_service_role on public.client_onboarding_decisions
  for all to service_role using (true) with check (true);
