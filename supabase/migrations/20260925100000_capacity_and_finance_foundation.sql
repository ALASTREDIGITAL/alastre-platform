-- ==============================================================================
-- Migration: 20260925100000_capacity_and_finance_foundation.sql
-- Módulo 08: Capacidade e Financeiro da Alastre Platform
--
-- Objetivos:
-- 1. Premissas econômicas versionadas com rastreabilidade de origem (observado, informado, estimativa, hipótese, indisponível)
-- 2. Registro e consolidação de custos operacionais (mão de obra, software, IA, atendimento, venda, implantação, retrabalho)
-- 3. Simulações de capacidade operacional por função e cenários (10, 25, 50, 100 clientes)
-- 4. Análises de margem e resultado com segregação mandatória de valor contratado, faturado e recebido
-- 5. Decisões de precificação e descontos protegidos com exigência de custo estimado, contrapartida documentada e aprovação humana
-- 6. Isolamento multi-tenant estrito via agency_id e FKs compostas (agency_id, parent_id)
-- 7. RLS 100% ativado, revogação de acessos diretos anon/authenticated e acesso restrito ao service_role
-- ==============================================================================

-- 1. Tabela: financial_economic_assumptions (Premissas econômicas versionadas)
create table if not exists public.financial_economic_assumptions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  cost_type text not null check (cost_type in (
    'labor',
    'software',
    'ai',
    'customer_service',
    'sales',
    'implementation',
    'rework',
    'other_operational'
  )),
  value numeric(12,2) not null check (value >= 0),
  currency text not null default 'BRL',
  period text not null default 'monthly' check (period in ('hourly', 'daily', 'monthly', 'yearly', 'per_unit', 'per_ticket')),
  origin text not null default 'hypothesis' check (origin in ('real_observed', 'reported_value', 'estimate', 'hypothesis', 'unavailable')),
  evidence_reference text,
  hypothesis_description text,
  responsible_name text not null default '',
  effective_date date not null default current_date,
  version integer not null default 1 check (version >= 1),
  approval_status text not null default 'approved' check (approval_status in ('draft', 'in_review', 'approved', 'rejected', 'superseded')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_financial_assumptions_agency_id unique (agency_id, id),
  constraint chk_financial_assumption_evidence check (
    origin not in ('real_observed', 'reported_value') or (evidence_reference is not null and length(trim(evidence_reference)) > 0)
  )
);

create index if not exists idx_financial_assumptions_agency on public.financial_economic_assumptions(agency_id);
create index if not exists idx_financial_assumptions_agency_type on public.financial_economic_assumptions(agency_id, cost_type);
create index if not exists idx_financial_assumptions_agency_status on public.financial_economic_assumptions(agency_id, approval_status);

-- 2. Tabela: financial_cost_records (Consolidação de custos e tempo)
create table if not exists public.financial_cost_records (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid,
  unit_id text,
  service_id uuid,
  product_definition_id text,
  scope_item_id text,
  workflow_id uuid,
  work_item_id uuid,
  cost_category text not null check (cost_category in (
    'labor',
    'software',
    'ai',
    'customer_service',
    'sales',
    'implementation',
    'rework',
    'other_operational'
  )),
  operational_role text check (operational_role in ('client', 'client_service', 'analyst', 'specialist', 'manager', 'automation_ai')),
  delivery_mode text check (delivery_mode in ('implementation', 'recurring')),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  estimated_cost numeric(12,2) not null default 0.00 check (estimated_cost >= 0),
  actual_cost numeric(12,2) not null default 0.00 check (actual_cost >= 0),
  currency text not null default 'BRL',
  origin text not null default 'hypothesis' check (origin in ('real_observed', 'reported_value', 'estimate', 'hypothesis', 'unavailable')),
  assumption_id text,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_financial_cost_records_agency_id unique (agency_id, id),
  constraint fk_financial_costs_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null,
  constraint fk_financial_costs_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete set null,
  constraint fk_financial_costs_assumption foreign key (agency_id, assumption_id) references public.financial_economic_assumptions(agency_id, id) on delete set null
);

create index if not exists idx_financial_costs_agency on public.financial_cost_records(agency_id);
create index if not exists idx_financial_costs_agency_client on public.financial_cost_records(agency_id, client_id);
create index if not exists idx_financial_costs_agency_product on public.financial_cost_records(agency_id, product_definition_id);
create index if not exists idx_financial_costs_agency_category on public.financial_cost_records(agency_id, cost_category);

-- 3. Tabela: financial_capacity_simulations (Capacidade e Gargalos por Função)
create table if not exists public.financial_capacity_simulations (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  scenario_clients_count integer not null check (scenario_clients_count > 0),
  operational_role text not null check (operational_role in ('client_service', 'analyst', 'specialist', 'manager', 'automation_ai')),
  available_monthly_hours numeric(8,2) not null default 0 check (available_monthly_hours >= 0),
  planned_monthly_hours numeric(8,2) not null default 0 check (planned_monthly_hours >= 0),
  actual_monthly_hours numeric(8,2) not null default 0 check (actual_monthly_hours >= 0),
  rework_monthly_hours numeric(8,2) not null default 0 check (rework_monthly_hours >= 0),
  sla_fulfillment_pct numeric(5,2) not null default 100.00 check (sla_fulfillment_pct between 0 and 100),
  occupancy_rate_pct numeric(5,2) not null default 0.00 check (occupancy_rate_pct >= 0),
  is_dominant_bottleneck boolean not null default false,
  quality_risk_level text not null default 'low' check (quality_risk_level in ('low', 'medium', 'high', 'critical')),
  hiring_trigger_clients integer,
  data_coverage_status text not null default 'insufficient_data' check (data_coverage_status in ('complete', 'partial', 'insufficient_data')),
  missing_data_fields jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_financial_capacity_simulations_agency_id unique (agency_id, id)
);

create index if not exists idx_financial_capacity_agency on public.financial_capacity_simulations(agency_id);
create index if not exists idx_financial_capacity_agency_scenario on public.financial_capacity_simulations(agency_id, scenario_clients_count);
create index if not exists idx_financial_capacity_agency_role on public.financial_capacity_simulations(agency_id, operational_role);

-- 4. Tabela: financial_margin_analyses (Margem, Resultado e Viabilidade Segregada)
create table if not exists public.financial_margin_analyses (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid,
  product_definition_id text,
  proposal_id text,
  contracted_value numeric(12,2) not null default 0.00 check (contracted_value >= 0),
  invoiced_value numeric(12,2) not null default 0.00 check (invoiced_value >= 0),
  received_value numeric(12,2) not null default 0.00 check (received_value >= 0),
  estimated_cost numeric(12,2) not null default 0.00 check (estimated_cost >= 0),
  actual_cost numeric(12,2) not null default 0.00 check (actual_cost >= 0),
  estimated_margin_value numeric(12,2) not null default 0.00,
  actual_margin_value numeric(12,2) not null default 0.00,
  estimated_margin_pct numeric(5,2) not null default 0.00,
  actual_margin_pct numeric(5,2) not null default 0.00,
  hiring_break_even_clients integer,
  quality_degradation_risk text not null default 'low' check (quality_degradation_risk in ('low', 'medium', 'high', 'critical')),
  data_coverage_status text not null default 'insufficient_data' check (data_coverage_status in ('complete', 'partial', 'insufficient_data')),
  missing_data_fields jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_financial_margin_analyses_agency_id unique (agency_id, id),
  constraint fk_financial_margin_client foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null,
  constraint fk_financial_margin_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete set null,
  constraint fk_financial_margin_proposal foreign key (agency_id, proposal_id) references public.commercial_proposals(agency_id, id) on delete set null
);

create index if not exists idx_financial_margin_agency on public.financial_margin_analyses(agency_id);
create index if not exists idx_financial_margin_agency_client on public.financial_margin_analyses(agency_id, client_id);
create index if not exists idx_financial_margin_agency_product on public.financial_margin_analyses(agency_id, product_definition_id);

-- 5. Tabela: financial_pricing_decisions (Precificação e Descontos Protegidos)
create table if not exists public.financial_pricing_decisions (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  proposal_id text not null,
  product_definition_id text,
  list_setup_price numeric(12,2) not null default 0.00 check (list_setup_price >= 0),
  list_monthly_price numeric(12,2) not null default 0.00 check (list_monthly_price >= 0),
  proposed_setup_price numeric(12,2) not null default 0.00 check (proposed_setup_price >= 0),
  proposed_monthly_price numeric(12,2) not null default 0.00 check (proposed_monthly_price >= 0),
  estimated_operational_cost numeric(12,2) not null default 0.00 check (estimated_operational_cost >= 0),
  discount_applied_pct numeric(5,2) not null default 0.00 check (discount_applied_pct between 0 and 100),
  discount_type text check (discount_type is null or discount_type in (
    'scope_reduction',
    'frequency_reduction',
    'support_reduction',
    'contractual_tradeoff',
    'unjustified'
  )),
  discount_counterpart_description text,
  is_cost_estimated boolean not null default false,
  is_counterpart_documented boolean not null default false,
  approval_status text not null default 'pending_human_approval' check (approval_status in ('draft', 'pending_human_approval', 'approved', 'rejected')),
  approval_item_id uuid references public.approval_items(id) on delete set null,
  decided_by_actor_id text,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_financial_pricing_decisions_agency_id unique (agency_id, id),
  constraint fk_financial_pricing_proposal foreign key (agency_id, proposal_id) references public.commercial_proposals(agency_id, id) on delete cascade,
  constraint fk_financial_pricing_product foreign key (agency_id, product_definition_id) references public.product_definitions(agency_id, id) on delete set null,
  constraint chk_financial_pricing_requires_cost check (
    approval_status <> 'approved' or (is_cost_estimated = true and estimated_operational_cost > 0)
  ),
  constraint chk_financial_pricing_requires_counterpart check (
    discount_applied_pct = 0 or approval_status <> 'approved' or (is_counterpart_documented = true and discount_type <> 'unjustified')
  )
);

create index if not exists idx_financial_pricing_agency on public.financial_pricing_decisions(agency_id);
create index if not exists idx_financial_pricing_agency_proposal on public.financial_pricing_decisions(agency_id, proposal_id);
create index if not exists idx_financial_pricing_agency_status on public.financial_pricing_decisions(agency_id, approval_status);

-- 6. Atualização de constraint em approval_items para suportar capacity_financial_pricing
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
      'client_onboarding_activation',
      'operation_work_item',
      'capacity_financial_pricing'
    ));
end;
$$;

-- 7. Habilitação de RLS e Revogação de Acesso Público
alter table public.financial_economic_assumptions enable row level security;
alter table public.financial_cost_records enable row level security;
alter table public.financial_capacity_simulations enable row level security;
alter table public.financial_margin_analyses enable row level security;
alter table public.financial_pricing_decisions enable row level security;

revoke all on public.financial_economic_assumptions from public, anon, authenticated;
revoke all on public.financial_cost_records from public, anon, authenticated;
revoke all on public.financial_capacity_simulations from public, anon, authenticated;
revoke all on public.financial_margin_analyses from public, anon, authenticated;
revoke all on public.financial_pricing_decisions from public, anon, authenticated;

grant select, insert, update, delete on public.financial_economic_assumptions to service_role;
grant select, insert, update, delete on public.financial_cost_records to service_role;
grant select, insert, update, delete on public.financial_capacity_simulations to service_role;
grant select, insert, update, delete on public.financial_margin_analyses to service_role;
grant select, insert, update, delete on public.financial_pricing_decisions to service_role;

-- Policies restritas ao service_role
create policy financial_economic_assumptions_service_role on public.financial_economic_assumptions
  for all to service_role using (true) with check (true);

create policy financial_cost_records_service_role on public.financial_cost_records
  for all to service_role using (true) with check (true);

create policy financial_capacity_simulations_service_role on public.financial_capacity_simulations
  for all to service_role using (true) with check (true);

create policy financial_margin_analyses_service_role on public.financial_margin_analyses
  for all to service_role using (true) with check (true);

create policy financial_pricing_decisions_service_role on public.financial_pricing_decisions
  for all to service_role using (true) with check (true);
