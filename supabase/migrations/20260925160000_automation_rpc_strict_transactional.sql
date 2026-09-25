-- Módulo 09: Hardening Estrito de RPCs Transacionais de Automação
-- Elimina caminhos de escrita direta no serviço e padroniza identificação de ator via p_actor_id.

-- Drop prévio necessário para trocar o nome de parâmetro p_email -> p_actor_id no Postgres
drop function if exists public.automation_create_write_plan(text, uuid, uuid, uuid, text, text, text, jsonb, boolean, jsonb);
drop function if exists public.automation_approve_write_plan(text, uuid, text, text);
drop function if exists public.automation_execute_write_plan(text, uuid, text);

-- 1. RPC Transacional: Criação Atômica de Plano de Escrita e Item de Aprovação
create or replace function public.automation_create_write_plan(
  p_actor_id text,
  p_client_id uuid default null,
  p_connection_id uuid default null,
  p_work_item_id uuid default null,
  p_capability text default 'google_business_profile',
  p_action_type text default 'create_local_post',
  p_plan_hash text default null,
  p_sanitized_plan jsonb default '{}',
  p_supports_rollback boolean default false,
  p_compensation_plan jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record;
  v_plan_id uuid := gen_random_uuid();
  v_appr_id uuid := gen_random_uuid();
  v_plan record;
begin
  select id as actor_id, agency_id, role into v_actor
  from public.agency_actors
  where (id::text = p_actor_id or lower(email) = lower(trim(p_actor_id))) and active
  limit 1;

  if v_actor.actor_id is null or v_actor.agency_id is null then
    raise exception 'actor_forbidden';
  end if;

  if p_plan_hash is null or char_length(p_plan_hash) != 64 then
    raise exception 'invalid_plan_hash';
  end if;

  insert into public.approval_items (
    id,
    agency_id,
    client_id,
    source_type,
    source_id,
    status,
    title,
    summary,
    proposed_payload,
    created_by_actor_id,
    created_at,
    updated_at
  ) values (
    v_appr_id,
    v_actor.agency_id,
    p_client_id,
    'automation_write',
    v_plan_id::text,
    'pending',
    'Escrita Externa: ' || p_action_type || ' (' || p_capability || ')',
    'Plano imutável registrado com hash SHA-256 ' || substring(p_plan_hash from 1 for 12) || '...',
    jsonb_build_object('plan_hash', p_plan_hash, 'plan', p_sanitized_plan),
    v_actor.actor_id::text,
    now(),
    now()
  );

  insert into public.automation_write_plans (
    id,
    agency_id,
    client_id,
    connection_id,
    approval_item_id,
    work_item_id,
    capability,
    action_type,
    plan_hash,
    sanitized_plan,
    status,
    supports_rollback,
    compensation_plan,
    created_by_actor_id,
    created_at,
    updated_at
  ) values (
    v_plan_id,
    v_actor.agency_id,
    p_client_id,
    p_connection_id,
    v_appr_id,
    p_work_item_id,
    p_capability,
    p_action_type,
    p_plan_hash,
    p_sanitized_plan,
    'pending_approval',
    p_supports_rollback,
    p_compensation_plan,
    v_actor.actor_id::text,
    now(),
    now()
  ) returning * into v_plan;

  insert into public.audit_events (
    agency_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    payload,
    created_at
  ) values (
    v_actor.agency_id,
    null,
    'automation.write_plan_created',
    'automation_write_plan',
    v_plan_id::text,
    jsonb_build_object(
      'actor_id', v_actor.actor_id::text,
      'plan_hash', p_plan_hash,
      'approval_item_id', v_appr_id,
      'capability', p_capability,
      'action_type', p_action_type
    ),
    now()
  );

  return to_jsonb(v_plan);
end;
$$;

-- 2. RPC Transacional: Aprovação Humana de Plano de Escrita (Exclusiva para Liderança)
create or replace function public.automation_approve_write_plan(
  p_actor_id text,
  p_plan_id uuid,
  p_plan_hash text,
  p_decision_notes text default 'Aprovado via Central de Aprovações'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record;
  v_plan record;
  v_appr record;
begin
  select id as actor_id, agency_id, role into v_actor
  from public.agency_actors
  where (id::text = p_actor_id or lower(email) = lower(trim(p_actor_id))) and active
  limit 1;

  if v_actor.actor_id is null or v_actor.agency_id is null then
    raise exception 'actor_forbidden';
  end if;

  if v_actor.role not in ('owner', 'admin', 'operations_lead') then
    raise exception 'actor_forbidden';
  end if;

  select * into v_plan
  from public.automation_write_plans
  where agency_id = v_actor.agency_id and id = p_plan_id;

  if v_plan.id is null then
    raise exception 'write_plan_not_found';
  end if;

  if v_plan.plan_hash != p_plan_hash then
    raise exception 'plan_hash_mismatch';
  end if;

  if v_plan.status != 'pending_approval' then
    raise exception 'write_plan_not_pending';
  end if;

  select * into v_appr
  from public.approval_items
  where agency_id = v_actor.agency_id
    and id = v_plan.approval_item_id
    and source_type = 'automation_write'
    and source_id = v_plan.id::text;

  if v_appr.id is null then
    raise exception 'approval_item_not_found';
  end if;

  if v_appr.status != 'pending' then
    raise exception 'approval_item_not_pending';
  end if;

  if (v_appr.proposed_payload->>'plan_hash') != p_plan_hash then
    raise exception 'plan_hash_mismatch';
  end if;

  update public.approval_items
  set status = 'approved',
      decided_by_actor_id = v_actor.actor_id::text,
      decided_at = now(),
      decision_notes = p_decision_notes,
      updated_at = now()
  where agency_id = v_actor.agency_id and id = v_appr.id;

  update public.automation_write_plans
  set status = 'approved',
      approved_by_actor_id = v_actor.actor_id::text,
      approved_at = now(),
      updated_at = now()
  where agency_id = v_actor.agency_id and id = v_plan.id
  returning * into v_plan;

  insert into public.audit_events (
    agency_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    payload,
    created_at
  ) values (
    v_actor.agency_id,
    null,
    'automation.write_plan_approved',
    'automation_write_plan',
    v_plan.id::text,
    jsonb_build_object(
      'actor_id', v_actor.actor_id::text,
      'plan_hash', p_plan_hash,
      'approval_item_id', v_appr.id
    ),
    now()
  );

  return to_jsonb(v_plan);
end;
$$;

-- 3. RPC Transacional: Execução Controlada de Plano de Escrita
create or replace function public.automation_execute_write_plan(
  p_actor_id text,
  p_plan_id uuid,
  p_plan_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record;
  v_plan record;
  v_appr record;
begin
  select id as actor_id, agency_id, role into v_actor
  from public.agency_actors
  where (id::text = p_actor_id or lower(email) = lower(trim(p_actor_id))) and active
  limit 1;

  if v_actor.actor_id is null or v_actor.agency_id is null then
    raise exception 'actor_forbidden';
  end if;

  if v_actor.role not in ('owner', 'admin', 'operations_lead') then
    raise exception 'actor_forbidden';
  end if;

  select * into v_plan
  from public.automation_write_plans
  where agency_id = v_actor.agency_id and id = p_plan_id;

  if v_plan.id is null then
    raise exception 'write_plan_not_found';
  end if;

  if v_plan.plan_hash != p_plan_hash then
    raise exception 'plan_hash_mismatch';
  end if;

  if v_plan.status in ('executed', 'blocked_write_mode', 'rejected', 'cancelled') then
    raise exception 'plan_already_processed';
  end if;

  if v_plan.status != 'approved' then
    raise exception 'write_plan_not_approved';
  end if;

  select * into v_appr
  from public.approval_items
  where agency_id = v_actor.agency_id
    and id = v_plan.approval_item_id
    and source_type = 'automation_write'
    and source_id = v_plan.id::text;

  if v_appr.id is null or v_appr.status != 'approved' then
    raise exception 'approval_item_not_approved';
  end if;

  if (v_appr.proposed_payload->>'plan_hash') != p_plan_hash then
    raise exception 'plan_hash_mismatch';
  end if;

  update public.automation_write_plans
  set status = 'blocked_write_mode',
      updated_at = now()
  where agency_id = v_actor.agency_id and id = v_plan.id
  returning * into v_plan;

  insert into public.audit_events (
    agency_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    payload,
    created_at
  ) values (
    v_actor.agency_id,
    null,
    'automation.write_plan_blocked_write_mode',
    'automation_write_plan',
    v_plan.id::text,
    jsonb_build_object(
      'actor_id', v_actor.actor_id::text,
      'plan_hash', p_plan_hash,
      'reason', 'ALASTRE_WRITE_MODE está configurado como ''disabled''. A execução externa foi bloqueada em segurança.'
    ),
    now()
  );

  return jsonb_build_object(
    'plan', to_jsonb(v_plan),
    'executed', false,
    'reason', 'ALASTRE_WRITE_MODE está configurado como ''disabled''. A execução externa foi bloqueada em segurança.'
  );
end;
$$;

-- Permissões exclusivas para service_role
revoke all on function public.automation_create_write_plan(text, uuid, uuid, uuid, text, text, text, jsonb, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.automation_approve_write_plan(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.automation_execute_write_plan(text, uuid, text) from public, anon, authenticated;

grant execute on function public.automation_create_write_plan(text, uuid, uuid, uuid, text, text, text, jsonb, boolean, jsonb) to service_role;
grant execute on function public.automation_approve_write_plan(text, uuid, text, text) to service_role;
grant execute on function public.automation_execute_write_plan(text, uuid, text) to service_role;
