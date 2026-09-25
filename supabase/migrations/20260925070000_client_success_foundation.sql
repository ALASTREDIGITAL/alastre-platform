-- Migration: 20260925070000_client_success_foundation.sql
-- Módulo 07: Sucesso do Cliente (Health Score, Scorecard, Reuniões/Decisões, Churn/Recuperação, Expansão, Offboarding)
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)
-- Multi-Tenant: agency_id obrigatório em todas as tabelas, foreign keys compostas e isolamento por tenant.

-- 1. Unique Constraints nas tabelas base para suporte a FKs compostas se ainda não existirem
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.clients'::regclass and conname = 'clients_agency_id_id_key'
  ) then
    alter table public.clients add constraint clients_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_agency_id_id_key'
  ) then
    alter table public.work_items add constraint work_items_agency_id_id_key unique (agency_id, id);
  end if;
end;
$$;

-- 2. Tabela de Health Score do Cliente (client_health_scores)
create table if not exists public.client_health_scores (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  overall_score numeric not null check (overall_score >= 0 and overall_score <= 100),
  status text not null check (status in ('excellent', 'good', 'attention', 'critical', 'insufficient_data')),
  coverage_pct numeric not null check (coverage_pct >= 0 and coverage_pct <= 100),
  data_status text not null check (data_status in ('complete', 'partial', 'insufficient')),
  operational_delivery_score numeric check (operational_delivery_score >= 0 and operational_delivery_score <= 100),
  quality_compliance_score numeric check (quality_compliance_score >= 0 and quality_compliance_score <= 100),
  client_cooperation_score numeric check (client_cooperation_score >= 0 and client_cooperation_score <= 100),
  perceived_value_score numeric check (perceived_value_score >= 0 and perceived_value_score <= 100),
  indicator_evolution_score numeric check (indicator_evolution_score >= 0 and indicator_evolution_score <= 100),
  churn_risk_factor_score numeric check (churn_risk_factor_score >= 0 and churn_risk_factor_score <= 100),
  active_scope_score numeric check (active_scope_score >= 0 and active_scope_score <= 100),
  primary_cause text check (primary_cause in ('alastre_delivery_failure', 'channel_limitation', 'client_dependency_failure', 'insufficient_data', 'none')),
  cause_breakdown jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint client_health_scores_agency_id_id_key unique (agency_id, id),
  constraint client_health_scores_agency_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 3. Tabela de Scorecards de Valor (client_scorecards)
create table if not exists public.client_scorecards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  period_label text not null,
  health_score_snapshot numeric not null,
  completed_deliveries_count integer not null default 0,
  verified_evidences_count integer not null default 0,
  observed_indicators jsonb not null default '{}'::jsonb,
  collection_limitations text[] not null default '{}'::text[],
  improvements_implemented text[] not null default '{}'::text[],
  client_pendencies text[] not null default '{}'::text[],
  next_steps text[] not null default '{}'::text[],
  recommendations jsonb not null default '[]'::jsonb,
  disclaimer_no_guarantee text not null default 'Resultados influenciados por múltiplos fatores externos. Não há promessa de ranking, leads, conversões ou vendas.',
  created_at timestamptz not null default now(),
  constraint client_scorecards_agency_id_id_key unique (agency_id, id),
  constraint client_scorecards_agency_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 4. Tabela de Reuniões de CS (client_meetings)
create table if not exists public.client_meetings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  service_id uuid,
  meeting_date timestamptz not null default now(),
  objective text not null,
  participants text[] not null default '{}'::text[],
  analyzed_data_summary text,
  risks_identified text[] not null default '{}'::text[],
  next_steps text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint client_meetings_agency_id_id_key unique (agency_id, id),
  constraint client_meetings_agency_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 5. Tabela de Decisões em Reuniões (client_meeting_decisions)
create table if not exists public.client_meeting_decisions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  meeting_id uuid not null,
  client_id uuid not null,
  decision text not null,
  responsible_actor_id text not null,
  deadline timestamptz,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'converted_to_task', 'completed')),
  work_item_id uuid,
  created_at timestamptz not null default now(),
  constraint client_meeting_decisions_agency_id_id_key unique (agency_id, id),
  constraint client_meeting_decisions_meeting_fk foreign key (agency_id, meeting_id) references public.client_meetings(agency_id, id) on delete cascade,
  constraint client_meeting_decisions_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 6. Tabela de Avaliação de Risco de Churn (client_churn_assessments)
create table if not exists public.client_churn_assessments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  risk_severity text not null check (risk_severity in ('low', 'medium', 'high', 'critical')),
  confidence_level text not null check (confidence_level in ('low', 'medium', 'high')),
  data_coverage_pct numeric not null check (data_coverage_pct >= 0 and data_coverage_pct <= 100),
  reason_summary text not null,
  signals jsonb not null default '[]'::jsonb,
  recovery_plan_summary text,
  recovery_work_item_ids uuid[] not null default '{}'::uuid[],
  assessed_at timestamptz not null default now(),
  constraint client_churn_assessments_agency_id_id_key unique (agency_id, id),
  constraint client_churn_assessments_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 7. Tabela de Recomendações de Expansão/Renovação (client_expansion_recommendations)
create table if not exists public.client_expansion_recommendations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  type text not null check (type in ('renewal', 'scope_review', 'expansion_unit', 'expansion_service', 'upsell', 'downsell')),
  target_service_name text,
  demonstrated_fit_rationale text not null,
  evidenced_value_rationale text not null,
  operational_impact_assessment text not null,
  human_approval_status text not null default 'pending' check (human_approval_status in ('pending', 'approved', 'rejected')),
  commercial_opportunity_id uuid,
  commercial_proposal_id uuid,
  approved_by_actor_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint client_expansion_recommendations_agency_id_id_key unique (agency_id, id),
  constraint client_expansion_recommendations_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 8. Tabela de Solicitações de Cancelamento (client_cancellation_requests)
create table if not exists public.client_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null,
  request_date timestamptz not null default now(),
  primary_motive text not null,
  detailed_reason text,
  status text not null default 'requested' check (status in ('requested', 'under_review', 'approved', 'rejected', 'offboarding_in_progress', 'completed')),
  transition_plan text,
  approved_by_actor_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint client_cancellation_requests_agency_id_id_key unique (agency_id, id),
  constraint client_cancellation_requests_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 9. Tabela de Inventário de Offboarding (client_offboarding_inventories)
create table if not exists public.client_offboarding_inventories (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  cancellation_request_id uuid not null,
  client_id uuid not null,
  access_items jsonb not null default '[]'::jsonb,
  offboarding_work_item_ids uuid[] not null default '{}'::uuid[],
  data_export_status text not null default 'not_requested' check (data_export_status in ('not_requested', 'pending', 'ready', 'exported', 'failed')),
  data_export_reference text,
  retention_policy_note text not null default 'Evidências e histórico de auditoria retidos conforme política legal/contratual. Nenhum dado de auditoria foi destruído.',
  final_client_status text not null default 'offboarding_in_progress' check (final_client_status in ('offboarding_in_progress', 'archived', 'retained_history')),
  created_at timestamptz not null default now(),
  constraint client_offboarding_inventories_agency_id_id_key unique (agency_id, id),
  constraint client_offboarding_inventories_cancellation_fk foreign key (agency_id, cancellation_request_id) references public.client_cancellation_requests(agency_id, id) on delete cascade,
  constraint client_offboarding_inventories_client_fk foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 10. Habilitação de RLS e Revogação de Permissões Públicas
alter table public.client_health_scores enable row level security;
alter table public.client_scorecards enable row level security;
alter table public.client_meetings enable row level security;
alter table public.client_meeting_decisions enable row level security;
alter table public.client_churn_assessments enable row level security;
alter table public.client_expansion_recommendations enable row level security;
alter table public.client_cancellation_requests enable row level security;
alter table public.client_offboarding_inventories enable row level security;

revoke all on public.client_health_scores from public, anon, authenticated;
revoke all on public.client_scorecards from public, anon, authenticated;
revoke all on public.client_meetings from public, anon, authenticated;
revoke all on public.client_meeting_decisions from public, anon, authenticated;
revoke all on public.client_churn_assessments from public, anon, authenticated;
revoke all on public.client_expansion_recommendations from public, anon, authenticated;
revoke all on public.client_cancellation_requests from public, anon, authenticated;
revoke all on public.client_offboarding_inventories from public, anon, authenticated;

grant all on public.client_health_scores to service_role;
grant all on public.client_scorecards to service_role;
grant all on public.client_meetings to service_role;
grant all on public.client_meeting_decisions to service_role;
grant all on public.client_churn_assessments to service_role;
grant all on public.client_expansion_recommendations to service_role;
grant all on public.client_cancellation_requests to service_role;
grant all on public.client_offboarding_inventories to service_role;
