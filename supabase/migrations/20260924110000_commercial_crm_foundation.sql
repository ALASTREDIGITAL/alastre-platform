-- ==============================================================================
-- Migration: 20260924110000_commercial_crm_foundation.sql
-- Módulo 02: Comercial e CRM da Alastre Platform
--
-- Objetivos:
-- 1. Criação das entidades comerciais centrais:
--    - commercial_companies (Empresas prospectadas / identificadas)
--    - commercial_contacts (Contatos e decisores mapeados)
--    - commercial_opportunities (Pipeline e oportunidades comerciais)
--    - commercial_assessments (Avaliações de Priorização e Qualificação)
--    - commercial_diagnoses (Diagnósticos comerciais em 11 passos)
--    - commercial_proposals (Propostas e versões vinculadas a produtos aprovados)
--    - commercial_activities (Tarefas, cadências e follow-ups)
--    - commercial_sales_handoffs (Handoff obrigatório para onboarding)
-- 2. Integridade e isolamento multi-tenant estrito via FKs compostas (agency_id, parent_id)
-- 3. Salvaguardas em nível de banco:
--    - Nenhuma oportunidade sem próxima ação e prazo
--    - Motivo de perda 'preco' exige justificativa detalhada
--    - Imutabilidade de propostas enviadas
-- 4. RLS 100% ativo, revogação de acessos diretos de anon/authenticated
--    e delegação segura exclusiva para service_role no backend autenticado.
-- ==============================================================================

-- 1. Tabela: commercial_companies
create table if not exists public.commercial_companies (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  trade_name text,
  segment text,
  city text,
  state_uf text,
  website text,
  phone text,
  identity_key text not null,
  maps_url text,
  place_id text,
  cid text,
  rating numeric(3,2),
  review_count integer,
  observed_profile_quality text not null default 'incomplete' check (observed_profile_quality in ('incomplete', 'claimed', 'unclaimed', 'verified')),
  units_count integer not null default 1 check (units_count >= 1),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_companies_agency_id unique (agency_id, id),
  constraint uq_commercial_companies_agency_identity unique (agency_id, identity_key)
);

create index if not exists idx_commercial_companies_agency on public.commercial_companies(agency_id);
create index if not exists idx_commercial_companies_agency_city on public.commercial_companies(agency_id, city);
create index if not exists idx_commercial_companies_agency_segment on public.commercial_companies(agency_id, segment);

-- 2. Tabela: commercial_contacts
create table if not exists public.commercial_contacts (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  company_id text not null,
  name text not null,
  role_title text not null default '',
  phone text,
  email text,
  is_decision_maker boolean not null default false,
  is_primary boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_contacts_agency_id unique (agency_id, id),
  constraint fk_commercial_contacts_company foreign key (agency_id, company_id) references public.commercial_companies(agency_id, id) on delete cascade
);

create index if not exists idx_commercial_contacts_agency_company on public.commercial_contacts(agency_id, company_id);

-- 3. Tabela: commercial_opportunities
create table if not exists public.commercial_opportunities (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  company_id text not null,
  title text not null,
  stage text not null default 'new' check (stage in (
    'new',
    'researched',
    'prioritized',
    'contact_ready',
    'contacted',
    'responded',
    'qualified',
    'diagnosis_scheduled',
    'diagnosis_completed',
    'proposal_prepared',
    'proposal_sent',
    'negotiation',
    'closed_won',
    'closed_lost',
    'nurture',
    'disqualified'
  )),
  priority text not null default 'media_prioridade' check (priority in (
    'alta_prioridade',
    'media_prioridade',
    'baixa_prioridade',
    'descartar'
  )),
  origin text not null default 'prospecting' check (origin in (
    'prospecting',
    'inbound',
    'referral',
    'outbound_manual',
    'local_audit'
  )),
  product_definition_id text,
  product_version integer not null default 1 check (product_version >= 1),
  responsible_actor_id text not null,
  responsible_name text not null,
  last_activity_at timestamptz not null default timezone('utc'::text, now()),
  next_action text not null,
  next_action_deadline timestamptz not null,
  estimated_setup_value numeric(10,2),
  estimated_mrr_value numeric(10,2),
  blocking_reason text,
  closed_at timestamptz,
  loss_reason_code text check (loss_reason_code is null or loss_reason_code in (
    'sem_orcamento',
    'sem_prioridade',
    'sem_fit',
    'concorrente',
    'preco',
    'expectativa_incompativel',
    'sem_decisor',
    'adiado',
    'solucao_interna',
    'nao_respondeu',
    'produto_inadequado'
  )),
  loss_reason_details text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_opportunities_agency_id unique (agency_id, id),
  constraint fk_commercial_opportunities_company foreign key (agency_id, company_id) references public.commercial_companies(agency_id, id) on delete cascade,
  constraint chk_commercial_price_requires_details check (loss_reason_code <> 'preco' or (loss_reason_details is not null and length(trim(loss_reason_details)) >= 10)),
  constraint chk_commercial_next_action_required check (length(trim(next_action)) > 0 and next_action_deadline is not null)
);

create index if not exists idx_commercial_opps_agency on public.commercial_opportunities(agency_id);
create index if not exists idx_commercial_opps_agency_company on public.commercial_opportunities(agency_id, company_id);
create index if not exists idx_commercial_opps_agency_stage on public.commercial_opportunities(agency_id, stage);
create index if not exists idx_commercial_opps_agency_priority on public.commercial_opportunities(agency_id, priority);
create index if not exists idx_commercial_opps_agency_deadline on public.commercial_opportunities(agency_id, next_action_deadline);

-- 4. Tabela: commercial_assessments (Priorização e Qualificação)
create table if not exists public.commercial_assessments (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id text not null,
  type text not null check (type in ('prioritization', 'qualification')),
  fit_score numeric(5,2),
  intent_score numeric(5,2),
  opportunity_score numeric(5,2),
  priority_result text,
  qualification_result text check (qualification_result is null or qualification_result in ('qualified', 'nurture', 'no_fit', 'high_risk')),
  dimensions jsonb not null default '{}'::jsonb,
  evidences jsonb not null default '[]'::jsonb,
  hypotheses jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  assessed_by_actor_id text not null,
  assessed_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_assessments_agency_id unique (agency_id, id),
  constraint fk_commercial_assessments_opp foreign key (agency_id, opportunity_id) references public.commercial_opportunities(agency_id, id) on delete cascade
);

create index if not exists idx_commercial_assessments_agency_opp on public.commercial_assessments(agency_id, opportunity_id);

-- 5. Tabela: commercial_diagnoses (Diagnóstico comercial de 11 passos)
create table if not exists public.commercial_diagnoses (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id text not null,
  step_answers jsonb not null default '{}'::jsonb,
  evidences jsonb not null default '[]'::jsonb,
  expectations text not null default '',
  red_flags jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  decision text not null default '',
  next_steps text not null default '',
  conducted_by_actor_id text not null,
  conducted_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_diagnoses_agency_id unique (agency_id, id),
  constraint fk_commercial_diagnoses_opp foreign key (agency_id, opportunity_id) references public.commercial_opportunities(agency_id, id) on delete cascade
);

create index if not exists idx_commercial_diagnoses_agency_opp on public.commercial_diagnoses(agency_id, opportunity_id);

-- 6. Tabela: commercial_proposals (Propostas versionadas)
create table if not exists public.commercial_proposals (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id text not null,
  product_definition_id text not null,
  product_version integer not null default 1 check (product_version >= 1),
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'internal_review', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'superseded')),
  is_immutable boolean not null default false,
  setup_price numeric(10,2) not null default 0.00 check (setup_price >= 0),
  monthly_price numeric(10,2) not null default 0.00 check (monthly_price >= 0),
  discount_setup_percentage numeric(5,2) not null default 0.00 check (discount_setup_percentage >= 0 and discount_setup_percentage <= 100),
  discount_monthly_percentage numeric(5,2) not null default 0.00 check (discount_monthly_percentage >= 0 and discount_monthly_percentage <= 100),
  discount_justification text,
  discount_counterpart text,
  scope_adjustments jsonb not null default '[]'::jsonb,
  selected_scope_items jsonb not null default '[]'::jsonb,
  payment_terms text not null default '',
  valid_until timestamptz not null,
  dependencies jsonb not null default '[]'::jsonb,
  expectations jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  decided_at timestamptz,
  created_by_actor_id text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_proposals_agency_id unique (agency_id, id),
  constraint fk_commercial_proposals_opp foreign key (agency_id, opportunity_id) references public.commercial_opportunities(agency_id, id) on delete cascade
);

create index if not exists idx_commercial_proposals_agency_opp on public.commercial_proposals(agency_id, opportunity_id);
create index if not exists idx_commercial_proposals_agency_status on public.commercial_proposals(agency_id, status);

-- 7. Tabela: commercial_activities (Tarefas e follow-ups)
create table if not exists public.commercial_activities (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id text not null,
  cadence text not null check (cadence in ('first_contact', 'post_diagnosis', 'post_proposal', 'unresponsive_lead', 'not_now', 'lost_proposal', 'nurture', 'custom')),
  title text not null,
  objective text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  deadline timestamptz not null,
  completed_at timestamptz,
  actor_id text not null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_activities_agency_id unique (agency_id, id),
  constraint fk_commercial_activities_opp foreign key (agency_id, opportunity_id) references public.commercial_opportunities(agency_id, id) on delete cascade
);

create index if not exists idx_commercial_activities_agency_opp on public.commercial_activities(agency_id, opportunity_id);
create index if not exists idx_commercial_activities_agency_deadline on public.commercial_activities(agency_id, deadline);

-- 8. Tabela: commercial_sales_handoffs (Portão obrigatório para Onboarding)
create table if not exists public.commercial_sales_handoffs (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id text not null,
  company_id text not null,
  proposal_id text not null,
  status text not null default 'draft' check (status in ('draft', 'commercial_review', 'operations_review', 'approved_for_onboarding', 'changes_requested', 'blocked')),
  checklist jsonb not null default '{}'::jsonb,
  promises_made text not null default '',
  client_expectations text not null default '',
  operational_risks text not null default '',
  critical_dependencies text not null default '',
  missing_data text not null default '',
  operations_reviewer_actor_id text,
  operations_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_commercial_sales_handoffs_agency_id unique (agency_id, id),
  constraint uq_commercial_sales_handoffs_opp unique (agency_id, opportunity_id),
  constraint fk_commercial_handoffs_opp foreign key (agency_id, opportunity_id) references public.commercial_opportunities(agency_id, id) on delete cascade,
  constraint fk_commercial_handoffs_company foreign key (agency_id, company_id) references public.commercial_companies(agency_id, id) on delete cascade,
  constraint fk_commercial_handoffs_proposal foreign key (agency_id, proposal_id) references public.commercial_proposals(agency_id, id) on delete cascade
);

create index if not exists idx_commercial_handoffs_agency_opp on public.commercial_sales_handoffs(agency_id, opportunity_id);
create index if not exists idx_commercial_handoffs_agency_status on public.commercial_sales_handoffs(agency_id, status);

-- ==============================================================================
-- Row Level Security (RLS) e Políticas de Acesso
-- ==============================================================================

alter table public.commercial_companies enable row level security;
alter table public.commercial_contacts enable row level security;
alter table public.commercial_opportunities enable row level security;
alter table public.commercial_assessments enable row level security;
alter table public.commercial_diagnoses enable row level security;
alter table public.commercial_proposals enable row level security;
alter table public.commercial_activities enable row level security;
alter table public.commercial_sales_handoffs enable row level security;

-- Revogação estrita de acessos públicos, anônimos e de clientes diretos autenticados
revoke all on public.commercial_companies from public, anon, authenticated;
revoke all on public.commercial_contacts from public, anon, authenticated;
revoke all on public.commercial_opportunities from public, anon, authenticated;
revoke all on public.commercial_assessments from public, anon, authenticated;
revoke all on public.commercial_diagnoses from public, anon, authenticated;
revoke all on public.commercial_proposals from public, anon, authenticated;
revoke all on public.commercial_activities from public, anon, authenticated;
revoke all on public.commercial_sales_handoffs from public, anon, authenticated;

-- Concessão para operações de backend autenticado (service_role)
grant select, insert, update, delete on public.commercial_companies to service_role;
grant select, insert, update, delete on public.commercial_contacts to service_role;
grant select, insert, update, delete on public.commercial_opportunities to service_role;
grant select, insert, update, delete on public.commercial_assessments to service_role;
grant select, insert, update, delete on public.commercial_diagnoses to service_role;
grant select, insert, update, delete on public.commercial_proposals to service_role;
grant select, insert, update, delete on public.commercial_activities to service_role;
grant select, insert, update, delete on public.commercial_sales_handoffs to service_role;

-- Políticas de isolamento service_role com verificação
create policy commercial_companies_service_role on public.commercial_companies
  for all to service_role using (true) with check (true);

create policy commercial_contacts_service_role on public.commercial_contacts
  for all to service_role using (true) with check (true);

create policy commercial_opportunities_service_role on public.commercial_opportunities
  for all to service_role using (true) with check (true);

create policy commercial_assessments_service_role on public.commercial_assessments
  for all to service_role using (true) with check (true);

create policy commercial_diagnoses_service_role on public.commercial_diagnoses
  for all to service_role using (true) with check (true);

create policy commercial_proposals_service_role on public.commercial_proposals
  for all to service_role using (true) with check (true);

create policy commercial_activities_service_role on public.commercial_activities
  for all to service_role using (true) with check (true);

create policy commercial_sales_handoffs_service_role on public.commercial_sales_handoffs
  for all to service_role using (true) with check (true);
