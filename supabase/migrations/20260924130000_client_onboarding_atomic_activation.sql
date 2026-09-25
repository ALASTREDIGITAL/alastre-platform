-- ==============================================================================
-- Migration: 20260924130000_client_onboarding_atomic_activation.sql
-- Módulo 03: Onboarding de Clientes - Hardening e Ativação Atômica
--
-- Objetivos:
-- 1. Ampliação do check de papéis em agency_actors para incluir:
--    'owner', 'admin', 'operations_lead', 'commercial_lead', 'operator', 'sales_rep', 'viewer'
-- 2. Compatibilidade de source_id em approval_items para tipo text,
--    garantindo suporte a identificadores alfanuméricos de onboarding ('onb-...')
-- 3. Constraint única (agency_id, id) em approval_items para isolamento estrito
-- 4. Função transacional atômica onboarding_activate_client com bloqueio por linha,
--    reversão completa (rollback) em caso de falha e prevenção de concorrência.
-- 5. Revogação de acesso público e concessão exclusiva a service_role.
-- ==============================================================================

-- 1. Atualização dos papéis permitidos em agency_actors
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'agency_actors_role_check'
      and conrelid = 'public.agency_actors'::regclass
  ) then
    alter table public.agency_actors drop constraint agency_actors_role_check;
  end if;

  alter table public.agency_actors
    add constraint agency_actors_role_check
    check (role in ('owner', 'admin', 'operations_lead', 'commercial_lead', 'operator', 'sales_rep', 'viewer'));
end;
$$;

-- 2. Ajuste de approval_items: source_id como text e unicidade multi-tenant
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'approval_items'
      and column_name = 'source_id'
      and data_type = 'uuid'
  ) then
    alter table public.approval_items alter column source_id type text using source_id::text;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_approval_items_agency_id'
      and conrelid = 'public.approval_items'::regclass
  ) then
    alter table public.approval_items add constraint uq_approval_items_agency_id unique (agency_id, id);
  end if;
end;
$$;

-- 3. Índice para consultas rápidas e bloqueios de aprovação
create index if not exists idx_approval_items_lookup_activation
  on public.approval_items (agency_id, source_type, source_id, status);

-- 4. RPC Transacional: onboarding_activate_client
create or replace function public.onboarding_activate_client(
  p_agency_id uuid,
  p_onboarding_id text,
  p_actor_id text,
  p_approval_id uuid,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_onboarding public.client_onboardings%rowtype;
  v_approval public.approval_items%rowtype;
  v_client public.clients%rowtype;
  v_now timestamptz := timezone('utc'::text, now());
  v_decision_id text;
begin
  -- 1. Bloqueia a linha de onboarding para evitar concorrência ou alterações paralelas
  select * into v_onboarding
  from public.client_onboardings
  where agency_id = p_agency_id and id = p_onboarding_id
  for update;

  if not found then
    raise exception 'onboarding_not_found' using errcode = 'P0002';
  end if;

  -- 2. Prevenção estrita de dupla ativação (idempotência defensiva)
  if v_onboarding.status = 'active' then
    raise exception 'onboarding_already_active' using errcode = '23505';
  end if;

  if v_onboarding.status in ('blocked', 'cancelled') then
    raise exception 'onboarding_status_blocked_or_cancelled' using errcode = '22023';
  end if;

  if v_onboarding.client_id is null then
    raise exception 'onboarding_missing_client' using errcode = '22023';
  end if;

  -- 3. Bloqueia e valida o item de aprovação estritamente por tenant, tipo, id e status
  select * into v_approval
  from public.approval_items
  where id = p_approval_id
    and agency_id = p_agency_id
    and source_type = 'client_onboarding_activation'
    and source_id = p_onboarding_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'approval_item_not_found_or_not_pending' using errcode = 'P0002';
  end if;

  -- 4. Atualiza o status do cliente para 'active'
  update public.clients
  set status = 'active',
      updated_at = v_now
  where id = v_onboarding.client_id
    and agency_id = p_agency_id
  returning * into v_client;

  if not found then
    raise exception 'client_not_found_in_agency' using errcode = 'P0002';
  end if;

  -- 5. Atualiza serviços contratados para 'active' (ou cria local_seo padrão se ausente)
  update public.client_services
  set status = 'active',
      updated_at = v_now
  where agency_id = p_agency_id
    and client_id = v_onboarding.client_id;

  if not exists (
    select 1 from public.client_services
    where agency_id = p_agency_id and client_id = v_onboarding.client_id
  ) then
    insert into public.client_services (
      agency_id, client_id, service_key, status, created_at, updated_at
    ) values (
      p_agency_id, v_onboarding.client_id, 'local_seo', 'active', v_now, v_now
    );
  end if;

  -- 6. Atualiza item de aprovação para 'approved'
  update public.approval_items
  set status = 'approved',
      decided_at = v_now,
      decision_by_email = p_actor_id,
      decision_note = coalesce(p_notes, 'Ativação formal aprovada pela liderança operacional.')
  where id = v_approval.id
    and agency_id = p_agency_id
    and source_type = 'client_onboarding_activation'
    and source_id = p_onboarding_id
    and status = 'pending';

  if not found then
    raise exception 'approval_update_failed' using errcode = 'P0002';
  end if;

  -- 7. Atualiza onboarding para 'active'
  update public.client_onboardings
  set status = 'active',
      current_stage = 'active',
      activated_at = v_now,
      activated_by_actor_id = p_actor_id,
      activation_approval_id = v_approval.id,
      updated_at = v_now
  where id = p_onboarding_id
    and agency_id = p_agency_id;

  if not found then
    raise exception 'onboarding_update_failed' using errcode = 'P0002';
  end if;

  -- 8. Registra decisão auditável de ativação
  v_decision_id := 'dec-' || to_char(v_now, 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 6);
  insert into public.client_onboarding_decisions (
    id,
    agency_id,
    onboarding_id,
    decision_type,
    actor_id,
    actor_name,
    actor_role,
    reason,
    metadata,
    created_at
  ) values (
    v_decision_id,
    p_agency_id,
    p_onboarding_id,
    'activation_approved',
    p_actor_id,
    p_actor_id,
    'operations_lead',
    'Checklist de prontidão validado no servidor e ativação executada de forma atômica.',
    jsonb_build_object(
      'approval_id', v_approval.id,
      'notes', p_notes,
      'activated_at', v_now
    ),
    v_now
  );

  -- 9. Registra evento de auditoria
  insert into public.audit_events (
    agency_id,
    client_id,
    action,
    target_type,
    target_id,
    payload,
    created_at
  ) values (
    p_agency_id,
    v_onboarding.client_id,
    'client_onboarding_activated',
    'client',
    v_onboarding.client_id::text,
    jsonb_build_object(
      'onboarding_id', p_onboarding_id,
      'approval_id', v_approval.id,
      'activated_by_actor_id', p_actor_id,
      'activated_at', v_now,
      'notes', p_notes
    ),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'onboarding_id', p_onboarding_id,
    'client_id', v_onboarding.client_id,
    'approval_id', v_approval.id,
    'status', 'active',
    'activated_at', v_now
  );
end;
$$;

-- 5. Revogação de acesso público e concessão exclusiva para service_role
revoke all on function public.onboarding_activate_client(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.onboarding_activate_client(uuid, text, text, uuid, text) to service_role;
