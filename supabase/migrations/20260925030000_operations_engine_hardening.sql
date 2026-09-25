-- Migration: 20260925030000_operations_engine_hardening.sql
-- Módulo 04: Motor de Operações (Hardening de Isolamento Multi-Tenant e RPCs com search_path seguro)
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)
-- Forward-only migration: adiciona Unique Constraints, Foreign Keys Compostas e endurecimento de RPCs.

-- 1. Unique Constraints em (agency_id, id) nas Tabelas Pai para suportar Foreign Keys Compostas
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.clients'::regclass and conname = 'clients_agency_id_id_key'
  ) then
    alter table public.clients add constraint clients_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.client_units'::regclass and conname = 'client_units_agency_id_id_key'
  ) then
    alter table public.client_units add constraint client_units_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.client_services'::regclass and conname = 'client_services_agency_id_id_key'
  ) then
    alter table public.client_services add constraint client_services_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_agency_id_id_key'
  ) then
    alter table public.workflows add constraint workflows_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_agency_id_id_key'
  ) then
    alter table public.work_items add constraint work_items_agency_id_id_key unique (agency_id, id);
  end if;
end;
$$;

-- 2. Foreign Keys Compostas para Garantia de Isolamento Físico Multi-Tenant

-- 2.1 Workflows → clients, client_units, client_services
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_client_id_fkey') then
    alter table public.workflows drop constraint workflows_client_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_unit_id_fkey') then
    alter table public.workflows drop constraint workflows_unit_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_service_id_fkey') then
    alter table public.workflows drop constraint workflows_service_id_fkey;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_agency_client_fk') then
    alter table public.workflows add constraint workflows_agency_client_fk
      foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_agency_unit_fk') then
    alter table public.workflows add constraint workflows_agency_unit_fk
      foreign key (agency_id, unit_id) references public.client_units(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'workflows_agency_service_fk') then
    alter table public.workflows add constraint workflows_agency_service_fk
      foreign key (agency_id, service_id) references public.client_services(agency_id, id) on delete set null;
  end if;
end;
$$;

-- 2.2 Work Items → workflows, clients, client_units
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_workflow_id_fkey') then
    alter table public.work_items drop constraint work_items_workflow_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_client_id_fkey') then
    alter table public.work_items drop constraint work_items_client_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_unit_id_fkey') then
    alter table public.work_items drop constraint work_items_unit_id_fkey;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_agency_workflow_fk') then
    alter table public.work_items add constraint work_items_agency_workflow_fk
      foreign key (agency_id, workflow_id) references public.workflows(agency_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_agency_client_fk') then
    alter table public.work_items add constraint work_items_agency_client_fk
      foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'work_items_agency_unit_fk') then
    alter table public.work_items add constraint work_items_agency_unit_fk
      foreign key (agency_id, unit_id) references public.client_units(agency_id, id) on delete set null;
  end if;
end;
$$;

-- 2.3 Work Item Time Logs → work_items, clients
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.work_item_time_logs'::regclass and conname = 'work_item_time_logs_work_item_id_fkey') then
    alter table public.work_item_time_logs drop constraint work_item_time_logs_work_item_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.work_item_time_logs'::regclass and conname = 'work_item_time_logs_client_id_fkey') then
    alter table public.work_item_time_logs drop constraint work_item_time_logs_client_id_fkey;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.work_item_time_logs'::regclass and conname = 'work_item_time_logs_agency_item_fk') then
    alter table public.work_item_time_logs add constraint work_item_time_logs_agency_item_fk
      foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.work_item_time_logs'::regclass and conname = 'work_item_time_logs_agency_client_fk') then
    alter table public.work_item_time_logs add constraint work_item_time_logs_agency_client_fk
      foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete restrict;
  end if;
end;
$$;

-- 2.4 Operational Exceptions → workflows, work_items, clients
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.operational_exceptions'::regclass and conname = 'operational_exceptions_workflow_id_fkey') then
    alter table public.operational_exceptions drop constraint operational_exceptions_workflow_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.operational_exceptions'::regclass and conname = 'operational_exceptions_work_item_id_fkey') then
    alter table public.operational_exceptions drop constraint operational_exceptions_work_item_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.operational_exceptions'::regclass and conname = 'operational_exceptions_client_id_fkey') then
    alter table public.operational_exceptions drop constraint operational_exceptions_client_id_fkey;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_exceptions'::regclass and conname = 'operational_exceptions_agency_workflow_fk') then
    alter table public.operational_exceptions add constraint operational_exceptions_agency_workflow_fk
      foreign key (agency_id, workflow_id) references public.workflows(agency_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_exceptions'::regclass and conname = 'operational_exceptions_agency_item_fk') then
    alter table public.operational_exceptions add constraint operational_exceptions_agency_item_fk
      foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_exceptions'::regclass and conname = 'operational_exceptions_agency_client_fk') then
    alter table public.operational_exceptions add constraint operational_exceptions_agency_client_fk
      foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete restrict;
  end if;
end;
$$;

-- 3. Endurecimento de RPCs SECURITY DEFINER com search_path = '' e objetos qualificados

create or replace function public.operation_start_task(
  p_agency_id uuid,
  p_work_item_id uuid,
  p_actor_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
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
  if pg_catalog.jsonb_array_length(v_item.depends_on_item_ids) > 0 then
    for v_dep_id in select pg_catalog.jsonb_array_elements_text(v_item.depends_on_item_ids)
    loop
      select status into v_dep_status
      from public.work_items
      where id = v_dep_id::uuid and agency_id = p_agency_id;

      if not found or v_dep_status <> 'completed' then
        -- Marca automaticamente como blocked_by_dependency
        update public.work_items
        set status = 'blocked_by_dependency',
            blocked_reason = pg_catalog.concat('Dependência pendente: ', pg_catalog.coalesce(v_dep_id, 'desconhecida')),
            updated_at = pg_catalog.now()
        where id = p_work_item_id and agency_id = p_agency_id;

        raise exception 'dependencies_not_satisfied' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Se estava bloqueado por dependência, remove motivo
  update public.work_items
  set status = 'in_progress',
      blocked_reason = null,
      updated_at = pg_catalog.now()
  where id = p_work_item_id and agency_id = p_agency_id;

  -- Atualiza o workflow pai para in_progress se estiver pending
  update public.workflows
  set status = 'in_progress',
      started_at = pg_catalog.coalesce(started_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where id = v_item.workflow_id
    and agency_id = p_agency_id
    and status = 'pending';

  return pg_catalog.jsonb_build_object('success', true, 'work_item_id', p_work_item_id, 'status', 'in_progress');
end;
$$;

create or replace function public.operation_complete_task(
  p_agency_id uuid,
  p_work_item_id uuid,
  p_actor_id text,
  p_evidence_text text default null,
  p_evidence_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
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
    if (p_evidence_text is null or pg_catalog.trim(p_evidence_text) = '') and
       (p_evidence_url is null or pg_catalog.trim(p_evidence_url) = '') then
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
      pg_catalog.jsonb_build_object(
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
        evidence_text = pg_catalog.coalesce(p_evidence_text, evidence_text),
        evidence_url = pg_catalog.coalesce(p_evidence_url, evidence_url),
        updated_at = pg_catalog.now()
    where id = p_work_item_id and agency_id = p_agency_id;

    return pg_catalog.jsonb_build_object(
      'success', true,
      'work_item_id', p_work_item_id,
      'status', 'in_review',
      'approval_item_id', v_approval_id
    );
  end if;

  -- Se não requer aprovação, conclui diretamente
  update public.work_items
  set status = 'completed',
      completed_at = pg_catalog.now(),
      completed_by_actor_id = p_actor_id,
      evidence_text = pg_catalog.coalesce(p_evidence_text, evidence_text),
      evidence_url = pg_catalog.coalesce(p_evidence_url, evidence_url),
      updated_at = pg_catalog.now()
  where id = p_work_item_id and agency_id = p_agency_id;

  -- Recalcula progresso do workflow
  select pg_catalog.count(*), pg_catalog.count(*) filter (where status = 'completed')
  into v_total_items, v_completed_items
  from public.work_items
  where workflow_id = v_item.workflow_id and agency_id = p_agency_id;

  if v_total_items > 0 then
    v_new_progress := pg_catalog.round((v_completed_items::numeric / v_total_items::numeric) * 100);
  else
    v_new_progress := 100;
  end if;

  update public.workflows
  set progress_percentage = v_new_progress,
      status = case when v_completed_items = v_total_items then 'completed' else status end,
      completed_at = case when v_completed_items = v_total_items then pg_catalog.now() else completed_at end,
      updated_at = pg_catalog.now()
  where id = v_item.workflow_id and agency_id = p_agency_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'status', 'completed',
    'progress_percentage', v_new_progress
  );
end;
$$;

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
set search_path = ''
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
    pg_catalog.coalesce(p_notes, '')
  )
  returning id into v_log_id;

  -- Atualiza o actual_minutes da tarefa
  update public.work_items
  set actual_minutes = actual_minutes + p_minutes,
      updated_at = pg_catalog.now()
  where id = p_work_item_id and agency_id = p_agency_id;

  -- Atualiza o total_actual_minutes do workflow
  update public.workflows
  set total_actual_minutes = total_actual_minutes + p_minutes,
      updated_at = pg_catalog.now()
  where id = v_item.workflow_id and agency_id = p_agency_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'time_log_id', v_log_id,
    'work_item_id', p_work_item_id,
    'minutes_added', p_minutes
  );
end;
$$;

-- 4. Revogar execuções de RPCs de papéis não autorizados e conceder a service_role
revoke execute on function public.operation_start_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.operation_start_task(uuid, uuid, text) to service_role;

revoke execute on function public.operation_complete_task(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.operation_complete_task(uuid, uuid, text, text, text) to service_role;

revoke execute on function public.operation_log_time(uuid, uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.operation_log_time(uuid, uuid, uuid, text, text, integer, text) to service_role;
