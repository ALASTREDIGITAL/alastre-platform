-- Migration: 20260925050000_quality_and_evidence_foundation.sql
-- Módulo 06: Qualidade e Evidências (Evidências Canônicas, Checklists Versionados, Segregação de Funções, Não Conformidades e Proteção contra Histórico Alterado)
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)
-- Multi-Tenant: agency_id obrigatório em todas as tabelas, foreign keys compostas e isolamento por tenant.

-- 1. Unique Constraints nas tabelas para suporte a FKs compostas
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

-- 2. Tabela Canônica de Evidências Vincular a Atividade (quality_evidences)
create table if not exists public.quality_evidences (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  work_item_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  unit_id text references public.client_units(id) on delete set null,
  service_id uuid references public.client_services(id) on delete set null,
  delivery_item_type text,
  delivery_item_id text,
  evidence_type text not null check (evidence_type in ('before_after', 'screenshot', 'url', 'external_id', 'sanitized_payload', 'manual_confirmation', 'automated_validation', 'collection_limitation')),
  origin text not null default 'manual' check (origin in ('manual', 'automated', 'provider', 'system')),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'dispensed')),
  responsible_actor_id text not null,
  verified_by_actor_id text,
  verified_at timestamptz,
  captured_at timestamptz not null default now(),
  verifiable_reference text not null,
  before_reference text,
  after_reference text,
  sanitized_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(sanitized_metadata) = 'object'),
  limitation_note text,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  constraint quality_evidences_agency_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete cascade,
  constraint quality_evidences_agency_client_fk
    foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null
);

-- 3. Templates de Checklists de Qualidade Versionados (quality_checklist_templates)
create table if not exists public.quality_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null default 'general' check (category in ('local_seo', 'google_ads', 'meta_ads', 'tracking', 'onboarding', 'general')),
  risk_level text not null default 'normal' check (risk_level in ('low', 'normal', 'high', 'critical')),
  version integer not null default 1 check (version >= 1),
  is_active boolean not null default true,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, slug, version),
  unique (agency_id, id)
);

-- 4. Execuções de Checklists por Atividade (quality_checklist_runs)
create table if not exists public.quality_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  work_item_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  template_id uuid references public.quality_checklist_templates(id) on delete set null,
  checklist_version integer not null default 1,
  risk_level text not null default 'normal' check (risk_level in ('low', 'normal', 'high', 'critical')),
  review_policy text not null default 'sampled' check (review_policy in ('mandatory', 'sampled', 'optional')),
  status text not null default 'in_progress' check (status in ('in_progress', 'pending_review', 'approved', 'rejected', 'waived')),
  criteria_results jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria_results) = 'array'),
  executed_by_actor_id text,
  reviewed_by_actor_id text,
  verified_by_actor_id text,
  verified_at timestamptz,
  waived_justification text,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  constraint quality_checklist_runs_agency_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete cascade,
  constraint quality_checklist_runs_agency_client_fk
    foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete set null
);

-- 5. Não Conformidades e Ações Corretivas (quality_non_conformities)
create table if not exists public.quality_non_conformities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  work_item_id uuid references public.work_items(id) on delete cascade,
  workflow_id uuid references public.workflows(id) on delete cascade,
  evidence_id uuid references public.quality_evidences(id) on delete set null,
  title text not null check (char_length(title) between 3 and 200),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_analysis', 'action_created', 'reopened', 'resolved', 'waived')),
  root_cause text not null default '',
  impact text not null default '',
  corrective_work_item_id uuid references public.work_items(id) on delete set null,
  opened_by_actor_id text not null,
  assigned_actor_id text,
  resolved_by_actor_id text,
  resolved_at timestamptz,
  verified_by_actor_id text,
  verified_at timestamptz,
  waive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  constraint quality_nc_agency_client_fk
    foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete restrict,
  constraint quality_nc_agency_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete cascade
);

-- 6. Histórico de Alterações de Evidências e Qualidade (quality_audit_history)
create table if not exists public.quality_audit_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  entity_type text not null check (entity_type in ('evidence', 'checklist_run', 'non_conformity')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'verified', 'rejected', 'modified', 'waived', 'locked', 'reopened')),
  actor_id text not null,
  previous_state jsonb,
  new_state jsonb,
  change_reason text not null default '',
  created_at timestamptz not null default now()
);

-- 7. Índices de Desempenho e Isolamento por Tenant
create index if not exists quality_evidences_agency_item_idx on public.quality_evidences (agency_id, work_item_id);
create index if not exists quality_evidences_agency_client_idx on public.quality_evidences (agency_id, client_id);
create index if not exists quality_evidences_agency_status_idx on public.quality_evidences (agency_id, verification_status);

create index if not exists quality_templates_agency_slug_idx on public.quality_checklist_templates (agency_id, slug, version);

create index if not exists quality_checklist_runs_agency_item_idx on public.quality_checklist_runs (agency_id, work_item_id);
create index if not exists quality_checklist_runs_agency_status_idx on public.quality_checklist_runs (agency_id, status);

create index if not exists quality_nc_agency_status_idx on public.quality_non_conformities (agency_id, status);
create index if not exists quality_nc_agency_item_idx on public.quality_non_conformities (agency_id, work_item_id);

create index if not exists quality_audit_history_agency_entity_idx on public.quality_audit_history (agency_id, entity_type, entity_id);

-- 8. Row Level Security (RLS) e Políticas Restritas
alter table public.quality_evidences enable row level security;
alter table public.quality_checklist_templates enable row level security;
alter table public.quality_checklist_runs enable row level security;
alter table public.quality_non_conformities enable row level security;
alter table public.quality_audit_history enable row level security;

-- Revogar acessos públicos e conceder exclusivamente a service_role (backend protegido)
revoke all on public.quality_evidences from public, anon, authenticated;
revoke all on public.quality_checklist_templates from public, anon, authenticated;
revoke all on public.quality_checklist_runs from public, anon, authenticated;
revoke all on public.quality_non_conformities from public, anon, authenticated;
revoke all on public.quality_audit_history from public, anon, authenticated;

grant select, insert, update, delete on public.quality_evidences to service_role;
grant select, insert, update, delete on public.quality_checklist_templates to service_role;
grant select, insert, update, delete on public.quality_checklist_runs to service_role;
grant select, insert, update, delete on public.quality_non_conformities to service_role;
grant select, insert, update, delete on public.quality_audit_history to service_role;

-- 9. Função RPC Transacional: Verificação de Evidência com Segregação e Trava de Histórico
create or replace function public.quality_verify_evidence(
  p_agency_id uuid,
  p_evidence_id uuid,
  p_verifier_actor_id text,
  p_new_status text,
  p_reason text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence record;
  v_prev_state jsonb;
  v_new_state jsonb;
begin
  select * into v_evidence
  from public.quality_evidences
  where agency_id = p_agency_id and id = p_evidence_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Evidência não encontrada');
  end if;

  if v_evidence.is_locked and v_evidence.verification_status = 'verified' then
    return jsonb_build_object('success', false, 'error', 'Evidência aprovada já está trancada contra alterações diretas');
  end if;

  -- Validação de Segregação de Funções: responsável pela criação/execução não pode auto-aprovar se status for 'verified'
  if p_new_status = 'verified' and v_evidence.responsible_actor_id = p_verifier_actor_id then
    return jsonb_build_object('success', false, 'error', 'Segregação de funções exigida: o responsável pela evidência não pode auto-aprová-la');
  end if;

  v_prev_state := to_jsonb(v_evidence);

  update public.quality_evidences
  set verification_status = p_new_status,
      verified_by_actor_id = p_verifier_actor_id,
      verified_at = now(),
      is_locked = (p_new_status = 'verified'),
      updated_at = now()
  where agency_id = p_agency_id and id = p_evidence_id
  returning to_jsonb(public.quality_evidences.*) into v_new_state;

  insert into public.quality_audit_history (
    agency_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    previous_state,
    new_state,
    change_reason
  ) values (
    p_agency_id,
    'evidence',
    p_evidence_id,
    case when p_new_status = 'verified' then 'verified' when p_new_status = 'rejected' then 'rejected' else 'modified' end,
    p_verifier_actor_id,
    v_prev_state,
    v_new_state,
    coalesce(p_reason, 'Atualização de verificação')
  );

  return jsonb_build_object(
    'success', true,
    'evidence', v_new_state
  );
end;
$$;

revoke execute on function public.quality_verify_evidence from public, anon, authenticated;
grant execute on function public.quality_verify_evidence to service_role;
