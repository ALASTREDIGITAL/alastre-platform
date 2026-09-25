-- Migration: 20260924150000_operations_engine_foundation.sql
-- Módulo 04: Motor de Operações (Templates de Workflow, Instâncias, Tarefas/Work Items, Apontamento de Tempo e Exceções Operacionais)
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)
-- Multi-Tenant: agency_id obrigatório em todas as tabelas, foreign keys compostas e isolamento por tenant.

-- 1. Templates de Workflow Versionados
create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  product_definition_id text,
  name text not null check (char_length(name) between 3 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  version integer not null default 1 check (version >= 1),
  category text not null default 'general' check (category in ('local_seo', 'google_ads', 'meta_ads', 'tracking', 'onboarding', 'general')),
  description text not null default '',
  trigger_type text not null default 'manual' check (trigger_type in ('manual', 'onboarding_activated', 'recurring_schedule', 'event_triggered')),
  target_service text,
  is_active boolean not null default true,
  estimated_total_minutes integer not null default 0 check (estimated_total_minutes >= 0),
  definition jsonb not null default '[]'::jsonb check (jsonb_typeof(definition) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, slug, version)
);

-- 2. Workflows (Instâncias Operacionais por Cliente, Unidade e Serviço)
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  unit_id text references public.client_units(id) on delete set null,
  service_id uuid references public.client_services(id) on delete set null,
  template_id uuid references public.workflow_templates(id) on delete set null,
  title text not null check (char_length(title) between 3 and 180),
  workflow_type text not null default 'implementation' check (workflow_type in ('implementation', 'recurring_monthly', 'recurring_weekly', 'one_off', 'exception')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'blocked', 'in_review', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  total_estimated_minutes integer not null default 0 check (total_estimated_minutes >= 0),
  total_actual_minutes integer not null default 0 check (total_actual_minutes >= 0),
  blocked_reason text,
  target_start_date date,
  target_due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  assigned_actor_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garantia aditiva defensiva para workflows caso tabela pré-exista
alter table public.workflows add column if not exists agency_id uuid references public.agencies(id) on delete restrict;
alter table public.workflows add column if not exists client_id uuid references public.clients(id) on delete restrict;
alter table public.workflows add column if not exists unit_id text references public.client_units(id) on delete set null;
alter table public.workflows add column if not exists service_id uuid references public.client_services(id) on delete set null;
alter table public.workflows add column if not exists template_id uuid references public.workflow_templates(id) on delete set null;
alter table public.workflows add column if not exists title text;
alter table public.workflows add column if not exists workflow_type text not null default 'implementation';
alter table public.workflows add column if not exists status text not null default 'pending';
alter table public.workflows add column if not exists priority text not null default 'medium';
alter table public.workflows add column if not exists progress_percentage integer not null default 0;
alter table public.workflows add column if not exists total_estimated_minutes integer not null default 0;
alter table public.workflows add column if not exists total_actual_minutes integer not null default 0;
alter table public.workflows add column if not exists blocked_reason text;
alter table public.workflows add column if not exists target_start_date date;
alter table public.workflows add column if not exists target_due_date date;
alter table public.workflows add column if not exists started_at timestamptz;
alter table public.workflows add column if not exists completed_at timestamptz;
alter table public.workflows add column if not exists assigned_actor_id text;
alter table public.workflows add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.workflows add column if not exists created_at timestamptz not null default now();
alter table public.workflows add column if not exists updated_at timestamptz not null default now();

-- 3. Work Items (Tarefas Atômicas e Recorrentes)
create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  unit_id text references public.client_units(id) on delete set null,
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '',
  task_type text not null default 'manual' check (task_type in ('manual', 'automated', 'hybrid', 'approval')),
  frequency text not null default 'one_off' check (frequency in ('one_off', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'blocked_by_dependency', 'blocked_by_client', 'in_review', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  due_date date,
  sla_hours integer default 24 check (sla_hours >= 1),
  sla_status text not null default 'on_track' check (sla_status in ('on_track', 'warning', 'breached')),
  depends_on_item_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(depends_on_item_ids) = 'array'),
  assigned_actor_id text,
  assigned_actor_name text,
  requires_approval boolean not null default false,
  approval_item_id uuid references public.approval_items(id) on delete set null,
  evidence_required boolean not null default false,
  evidence_text text,
  evidence_url text,
  acceptance_criteria text not null default '',
  sop_reference text,
  blocked_reason text,
  client_action_required text,
  completed_at timestamptz,
  completed_by_actor_id text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garantia aditiva defensiva para work_items caso tabela pré-exista
alter table public.work_items add column if not exists agency_id uuid references public.agencies(id) on delete restrict;
alter table public.work_items add column if not exists client_id uuid references public.clients(id) on delete restrict;
alter table public.work_items add column if not exists workflow_id uuid references public.workflows(id) on delete cascade;
alter table public.work_items add column if not exists unit_id text references public.client_units(id) on delete set null;
alter table public.work_items add column if not exists title text;
alter table public.work_items add column if not exists description text not null default '';
alter table public.work_items add column if not exists task_type text not null default 'manual';
alter table public.work_items add column if not exists frequency text not null default 'one_off';
alter table public.work_items add column if not exists status text not null default 'todo';
alter table public.work_items add column if not exists priority text not null default 'medium';
alter table public.work_items add column if not exists estimated_minutes integer not null default 0;
alter table public.work_items add column if not exists actual_minutes integer not null default 0;
alter table public.work_items add column if not exists due_date date;
alter table public.work_items add column if not exists sla_hours integer default 24;
alter table public.work_items add column if not exists sla_status text not null default 'on_track';
alter table public.work_items add column if not exists depends_on_item_ids jsonb not null default '[]'::jsonb;
alter table public.work_items add column if not exists assigned_actor_id text;
alter table public.work_items add column if not exists assigned_actor_name text;
alter table public.work_items add column if not exists requires_approval boolean not null default false;
alter table public.work_items add column if not exists approval_item_id uuid references public.approval_items(id) on delete set null;
alter table public.work_items add column if not exists evidence_required boolean not null default false;
alter table public.work_items add column if not exists evidence_text text;
alter table public.work_items add column if not exists evidence_url text;
alter table public.work_items add column if not exists acceptance_criteria text not null default '';
alter table public.work_items add column if not exists sop_reference text;
alter table public.work_items add column if not exists blocked_reason text;
alter table public.work_items add column if not exists client_action_required text;
alter table public.work_items add column if not exists completed_at timestamptz;
alter table public.work_items add column if not exists completed_by_actor_id text;
alter table public.work_items add column if not exists order_index integer not null default 0;
alter table public.work_items add column if not exists created_at timestamptz not null default now();
alter table public.work_items add column if not exists updated_at timestamptz not null default now();

-- 4. Apontamentos de Tempo (Time Tracking / Capacity)
create table if not exists public.work_item_time_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  actor_id text not null,
  actor_name text not null,
  minutes_spent integer not null check (minutes_spent > 0),
  notes text not null default '',
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 5. Exceções Operacionais e Escalonamentos
create table if not exists public.operational_exceptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  workflow_id uuid references public.workflows(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete cascade,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'ignored')),
  category text not null check (category in ('sla_breach', 'client_block', 'dependency_cycle', 'quality_failure', 'system_error')),
  description text not null,
  resolution_notes text,
  reported_by_actor_id text not null,
  resolved_by_actor_id text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Atualização de Constraint de approval_items.source_type para suportar operation_work_item
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
      'operation_work_item'
    ));
end;
$$;

-- 7. Índices de Performance e Isolamento Multi-Tenant
create index if not exists workflow_templates_agency_slug_idx on public.workflow_templates (agency_id, slug);
create index if not exists workflow_templates_agency_category_idx on public.workflow_templates (agency_id, category);

create index if not exists workflows_agency_client_idx on public.workflows (agency_id, client_id, status);
create index if not exists workflows_agency_status_idx on public.workflows (agency_id, status);
create index if not exists workflows_agency_service_idx on public.workflows (agency_id, service_id);

create index if not exists work_items_agency_workflow_idx on public.work_items (agency_id, workflow_id, status);
create index if not exists work_items_agency_client_status_idx on public.work_items (agency_id, client_id, status);
create index if not exists work_items_agency_assigned_idx on public.work_items (agency_id, assigned_actor_id, status);
create index if not exists work_items_agency_due_date_idx on public.work_items (agency_id, due_date) where status not in ('completed', 'cancelled');
create index if not exists work_items_agency_sla_idx on public.work_items (agency_id, sla_status) where status not in ('completed', 'cancelled');

create index if not exists work_item_time_logs_agency_item_idx on public.work_item_time_logs (agency_id, work_item_id);
create index if not exists work_item_time_logs_agency_actor_idx on public.work_item_time_logs (agency_id, actor_id);

create index if not exists operational_exceptions_agency_status_idx on public.operational_exceptions (agency_id, status);
create index if not exists operational_exceptions_agency_item_idx on public.operational_exceptions (agency_id, work_item_id);

-- 8. Row Level Security (RLS) e Políticas Restritas
alter table public.workflow_templates enable row level security;
alter table public.workflows enable row level security;
alter table public.work_items enable row level security;
alter table public.work_item_time_logs enable row level security;
alter table public.operational_exceptions enable row level security;

-- Revogar acessos públicos e conceder exclusivamente a service_role (backend protegido)
revoke all on public.workflow_templates from public, anon, authenticated;
revoke all on public.workflows from public, anon, authenticated;
revoke all on public.work_items from public, anon, authenticated;
revoke all on public.work_item_time_logs from public, anon, authenticated;
revoke all on public.operational_exceptions from public, anon, authenticated;

grant select, insert, update, delete on public.workflow_templates to service_role;
grant select, insert, update, delete on public.workflows to service_role;
grant select, insert, update, delete on public.work_items to service_role;
grant select, insert, update, delete on public.work_item_time_logs to service_role;
grant select, insert, update, delete on public.operational_exceptions to service_role;

-- 9. Função Transacional PostgreSQL: operation_start_task
create or replace function public.operation_start_task(
  p_agency_id uuid,
  p_work_item_id uuid,
  p_actor_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_dep_id text;
  v_dep_status text;
begin
  select * into v_item
  from public.work_items
  where id = p_work_item_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'work_item_not_found' using errcode = 'P0002';
  end if;

  if v_item.status in ('completed', 'cancelled') then
    raise exception 'work_item_in_terminal_state' using errcode = '22023';
  end if;

  -- Validação de dependências: todas as tarefas em depends_on_item_ids devem estar concluídas
  if jsonb_array_length(v_item.depends_on_item_ids) > 0 then
    for v_dep_id in select jsonb_array_elements_text(v_item.depends_on_item_ids)
    loop
      select status into v_dep_status
      from public.work_items
      where id = v_dep_id::uuid and agency_id = p_agency_id;

      if not found or v_dep_status <> 'completed' then
        -- Marca automaticamente como blocked_by_dependency
        update public.work_items
        set status = 'blocked_by_dependency',
            blocked_reason = 'Dependência pendente: ' || coalesce(v_dep_id, 'desconhecida'),
            updated_at = now()
        where id = p_work_item_id and agency_id = p_agency_id;

        raise exception 'dependencies_not_satisfied' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Se estava bloqueado por dependência, remove motivo
  update public.work_items
  set status = 'in_progress',
      blocked_reason = null,
      updated_at = now()
  where id = p_work_item_id and agency_id = p_agency_id;

  -- Atualiza o workflow pai para in_progress se estiver pending
  update public.workflows
  set status = 'in_progress',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = v_item.workflow_id
    and agency_id = p_agency_id
    and status = 'pending';

  return jsonb_build_object('success', true, 'work_item_id', p_work_item_id, 'status', 'in_progress');
end;
$$;

-- 10. Função Transacional PostgreSQL: operation_complete_task
create or replace function public.operation_complete_task(
  p_agency_id uuid,
  p_work_item_id uuid,
  p_actor_id text,
  p_evidence_text text default null,
  p_evidence_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_workflow record;
  v_total_items integer;
  v_completed_items integer;
  v_new_progress integer;
  v_approval_id uuid;
begin
  select * into v_item
  from public.work_items
  where id = p_work_item_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'work_item_not_found' using errcode = 'P0002';
  end if;

  if v_item.status in ('completed', 'cancelled') then
    raise exception 'work_item_in_terminal_state' using errcode = '22023';
  end if;

  -- Validação de evidência obrigatória
  if v_item.evidence_required then
    if (p_evidence_text is null or trim(p_evidence_text) = '') and
       (p_evidence_url is null or trim(p_evidence_url) = '') then
      raise exception 'evidence_required_for_completion' using errcode = '22023';
    end if;
  end if;

  -- Se requer aprovação humana, envia para in_review e gera item em approval_items
  if v_item.requires_approval then
    insert into public.approval_items (
      agency_id,
      client_id,
      source_type,
      source_id,
      requested_by_email,
      status,
      snapshot
    ) values (
      p_agency_id,
      v_item.client_id,
      'operation_work_item',
      v_item.id,
      p_actor_id,
      'pending',
      jsonb_build_object(
        'work_item_id', v_item.id,
        'title', v_item.title,
        'workflow_id', v_item.workflow_id,
        'evidence_text', p_evidence_text,
        'evidence_url', p_evidence_url
      )
    )
    returning id into v_approval_id;

    update public.work_items
    set status = 'in_review',
        approval_item_id = v_approval_id,
        evidence_text = coalesce(p_evidence_text, evidence_text),
        evidence_url = coalesce(p_evidence_url, evidence_url),
        updated_at = now()
    where id = p_work_item_id and agency_id = p_agency_id;

    return jsonb_build_object(
      'success', true,
      'work_item_id', p_work_item_id,
      'status', 'in_review',
      'approval_item_id', v_approval_id
    );
  end if;

  -- Se não requer aprovação, conclui diretamente
  update public.work_items
  set status = 'completed',
      completed_at = now(),
      completed_by_actor_id = p_actor_id,
      evidence_text = coalesce(p_evidence_text, evidence_text),
      evidence_url = coalesce(p_evidence_url, evidence_url),
      updated_at = now()
  where id = p_work_item_id and agency_id = p_agency_id;

  -- Recalcula progresso do workflow
  select count(*), count(*) filter (where status = 'completed')
  into v_total_items, v_completed_items
  from public.work_items
  where workflow_id = v_item.workflow_id and agency_id = p_agency_id;

  if v_total_items > 0 then
    v_new_progress := round((v_completed_items::numeric / v_total_items::numeric) * 100);
  else
    v_new_progress := 100;
  end if;

  update public.workflows
  set progress_percentage = v_new_progress,
      status = case when v_completed_items = v_total_items then 'completed' else status end,
      completed_at = case when v_completed_items = v_total_items then now() else completed_at end,
      updated_at = now()
  where id = v_item.workflow_id and agency_id = p_agency_id;

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'status', 'completed',
    'progress_percentage', v_new_progress
  );
end;
$$;

-- 11. Função Transacional PostgreSQL: operation_log_time
create or replace function public.operation_log_time(
  p_agency_id uuid,
  p_client_id uuid,
  p_work_item_id uuid,
  p_actor_id text,
  p_actor_name text,
  p_minutes integer,
  p_notes text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_log_id uuid;
begin
  if p_minutes <= 0 then
    raise exception 'invalid_minutes' using errcode = '22023';
  end if;

  select * into v_item
  from public.work_items
  where id = p_work_item_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'work_item_not_found' using errcode = 'P0002';
  end if;

  insert into public.work_item_time_logs (
    agency_id,
    client_id,
    work_item_id,
    actor_id,
    actor_name,
    minutes_spent,
    notes
  ) values (
    p_agency_id,
    p_client_id,
    p_work_item_id,
    p_actor_id,
    p_actor_name,
    p_minutes,
    coalesce(p_notes, '')
  )
  returning id into v_log_id;

  -- Atualiza o actual_minutes da tarefa
  update public.work_items
  set actual_minutes = actual_minutes + p_minutes,
      updated_at = now()
  where id = p_work_item_id and agency_id = p_agency_id;

  -- Atualiza o total_actual_minutes do workflow
  update public.workflows
  set total_actual_minutes = total_actual_minutes + p_minutes,
      updated_at = now()
  where id = v_item.workflow_id and agency_id = p_agency_id;

  return jsonb_build_object(
    'success', true,
    'time_log_id', v_log_id,
    'work_item_id', p_work_item_id,
    'minutes_added', p_minutes
  );
end;
$$;

-- Revogar execuções de RPCs de papéis não autorizados e conceder a service_role
revoke execute on function public.operation_start_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.operation_start_task(uuid, uuid, text) to service_role;

revoke execute on function public.operation_complete_task(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.operation_complete_task(uuid, uuid, text, text, text) to service_role;

revoke execute on function public.operation_log_time(uuid, uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.operation_log_time(uuid, uuid, uuid, text, text, integer, text) to service_role;
