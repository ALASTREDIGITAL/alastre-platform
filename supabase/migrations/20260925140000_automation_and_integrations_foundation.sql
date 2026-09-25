-- Módulo 09: Integrações e Automação — Fundação Forward-Only
-- Multi-tenant isolation por agency_id, idempotência, dead-letter, aprovação de escrita com hash, auditoria e custos de IA.

-- 1. Sincronização incremental e estados de saúde
create table if not exists public.automation_sync_states (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  connection_id uuid not null,
  capability text not null,
  sync_cursor text,
  status text not null default 'idle' check (status in ('idle', 'syncing', 'success', 'error', 'degraded', 'dead_letter')),
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_error_sanitized text,
  next_sync_at timestamptz,
  sync_attempts integer not null default 0,
  max_attempts integer not null default 5,
  backoff_seconds integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, connection_id, capability),
  foreign key (agency_id, connection_id) references public.integration_connections(agency_id, id) on delete cascade
);

-- 2. Fila de jobs com idempotência e vínculo a cliente/atividade/evidência
create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid,
  connection_id uuid,
  work_item_id uuid,
  evidence_id uuid,
  idempotency_key text not null,
  capability text not null,
  action_name text not null,
  sanitized_payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'queued', 'running', 'completed', 'failed', 'dead_letter', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  timeout_seconds integer not null default 30,
  backoff_seconds integer not null default 60,
  last_error_sanitized text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, idempotency_key),
  check (jsonb_typeof(sanitized_payload) = 'object'),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  foreign key (agency_id, connection_id) references public.integration_connections(agency_id, id) on delete set null,
  foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null,
  foreign key (agency_id, evidence_id) references public.quality_evidences(agency_id, id) on delete set null
);

-- 3. Escritas externas controladas: planos imutáveis com hash e aprovação humana
create table if not exists public.automation_write_plans (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid,
  connection_id uuid,
  approval_item_id uuid references public.approval_items(id) on delete set null,
  work_item_id uuid,
  capability text not null,
  action_type text not null,
  plan_hash text not null check (char_length(plan_hash) = 64),
  sanitized_plan jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'executed', 'blocked_write_mode', 'cancelled')),
  supports_rollback boolean not null default false,
  compensation_plan jsonb,
  created_by_actor_id uuid references public.agency_actors(id) on delete restrict,
  approved_by_actor_id uuid references public.agency_actors(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, plan_hash),
  check (jsonb_typeof(sanitized_plan) = 'object'),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  foreign key (agency_id, connection_id) references public.integration_connections(agency_id, id) on delete cascade,
  foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null
);

-- 4. Registro de uso de IA sem prompts sensíveis
create table if not exists public.automation_ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid,
  capability text not null,
  model_name text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0.0,
  sanitized_summary text not null,
  created_at timestamptz not null default now(),
  unique (agency_id, id),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

-- 5. Limites e cotas de IA por agência e capability
create table if not exists public.automation_ai_limits (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  capability text not null,
  monthly_token_limit integer not null default 1000000,
  monthly_cost_limit_usd numeric(12,2) not null default 100.00,
  current_monthly_tokens integer not null default 0,
  current_monthly_cost_usd numeric(12,6) not null default 0.0,
  last_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, capability)
);

-- Índices de desempenho e isolamento
create index if not exists automation_sync_states_agency_conn_idx on public.automation_sync_states(agency_id, connection_id, status);
create index if not exists automation_jobs_agency_status_sched_idx on public.automation_jobs(agency_id, status, scheduled_at);
create index if not exists automation_jobs_agency_client_idx on public.automation_jobs(agency_id, client_id);
create index if not exists automation_write_plans_agency_status_idx on public.automation_write_plans(agency_id, status);
create index if not exists automation_write_plans_agency_hash_idx on public.automation_write_plans(agency_id, plan_hash);
create index if not exists automation_ai_usage_agency_created_idx on public.automation_ai_usage_logs(agency_id, created_at);
create index if not exists automation_ai_limits_agency_cap_idx on public.automation_ai_limits(agency_id, capability);

-- RLS e Segurança Segura de Acesso Exclusivo por Service Role
alter table public.automation_sync_states enable row level security;
alter table public.automation_jobs enable row level security;
alter table public.automation_write_plans enable row level security;
alter table public.automation_ai_usage_logs enable row level security;
alter table public.automation_ai_limits enable row level security;

revoke all on public.automation_sync_states from anon, authenticated, public;
revoke all on public.automation_jobs from anon, authenticated, public;
revoke all on public.automation_write_plans from anon, authenticated, public;
revoke all on public.automation_ai_usage_logs from anon, authenticated, public;
revoke all on public.automation_ai_limits from anon, authenticated, public;

create policy automation_sync_states_service_only on public.automation_sync_states for all to anon, authenticated using (false) with check (false);
create policy automation_jobs_service_only on public.automation_jobs for all to anon, authenticated using (false) with check (false);
create policy automation_write_plans_service_only on public.automation_write_plans for all to anon, authenticated using (false) with check (false);
create policy automation_ai_usage_service_only on public.automation_ai_usage_logs for all to anon, authenticated using (false) with check (false);
create policy automation_ai_limits_service_only on public.automation_ai_limits for all to anon, authenticated using (false) with check (false);
