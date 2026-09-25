-- Módulo 09: Hardening de Planos de Escrita Externa, Aprovação Atômica e SoD
-- Garante FK composta entre (agency_id, approval_item_id) -> approval_items(agency_id, id), RPCs transacionais e restrição estrita aos papéis owner, admin, operations_lead.

-- 1. Unicidade composta em approval_items
create unique index if not exists approval_items_agency_id_id_uq on public.approval_items(agency_id, id);

-- 2. Atualização da FK em automation_write_plans para FK composta por tenant
alter table public.automation_write_plans drop constraint if exists automation_write_plans_approval_item_id_fkey;
alter table public.automation_write_plans drop constraint if exists automation_write_plans_agency_approval_item_fkey;

alter table public.automation_write_plans
  add constraint automation_write_plans_agency_approval_item_fkey
  foreign key (agency_id, approval_item_id)
  references public.approval_items(agency_id, id)
  on delete set null;

-- 3. RPC Transacional: Criação Atômica de Plano de Escrita e Item de Aprovação
create or replace function public.automation_create_write_plan(
  p_email text,
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
  -- Resolver Ator Autenticado
  select actor_id, agency_id, role into v_actor
  from public.platform_resolve_actor(p_email);

  if v_actor.actor_id is null or v_actor.agency_id is null then
    raise exception 'actor_forbidden';
  end if;

  if p_plan_hash is null or char_length(p_plan_hash) != 64 then
    raise exception 'invalid_plan_hash';
  end if;

  -- Insere o item de aprovação com source_id igual ao ID textual exato do plano
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
    v_actor.actor_id,
    now(),
    now()
  );

  -- Insere o plano de escrita de forma atômica referenciando a FK composta
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
    v_actor.actor_id,
    now(),
    now()
  ) returning * into v_plan;

  -- Auditoria imutável
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
      'actor_id', v_actor.actor_id,
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

-- 4. RPC Transacional: Aprovação Humana de Plano de Escrita (Exclusiva para Liderança)
create or replace function public.automation_approve_write_plan(
  p_email text,
  p_plan_id uuid,
  p_plan_hash text,
  p_decision_notes text default 'Aprovado via Central de Aprovações'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record;
  v_plan record;
  v_appr record;
begin
  select actor_id, agency_id, role into v_actor
  from public.platform_resolve_actor(p_email);

  if v_actor.actor_id is null or v_actor.agency_id is null then
    raise exception 'actor_forbidden';
  end if;

  -- Segregação de Funções: Apenas owner, admin e operations_lead podem aprovar
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

  -- Busca o item de aprovação vinculado e valida integridade
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

  -- Atualiza o item de aprovação para approved
  update public.approval_items
  set status = 'approved',
      decided_by_actor_id = v_actor.actor_id,
      decided_at = now(),
      decision_notes = p_decision_notes,
      updated_at = now()
  where agency_id = v_actor.agency_id and id = v_appr.id;

  -- Atualiza o plano de escrita para approved
  update public.automation_write_plans
  set status = 'approved',
      approved_by_actor_id = v_actor.actor_id,
      approved_at = now(),
      updated_at = now()
  where agency_id = v_actor.agency_id and id = v_plan.id
  returning * into v_plan;

  -- Auditoria imutável
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
      'actor_id', v_actor.actor_id,
      'plan_hash', p_plan_hash,
      'approval_item_id', v_appr.id
    ),
    now()
  );

  return to_jsonb(v_plan);
end;
$$;

-- 5. RPC Transacional: Execução Controlada de Plano de Escrita (Valida Aprovação Prévia e Trava Write Mode)
create or replace function public.automation_execute_write_plan(
  p_email text,
  p_plan_id uuid,
  p_plan_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record;
  v_plan record;
  v_appr record;
  v_write_mode text := 'disabled';
begin
  select actor_id, agency_id, role into v_actor
  from public.platform_resolve_actor(p_email);

  if v_actor.actor_id is null or v_actor.agency_id is null then
    raise exception 'actor_forbidden';
  end if;

  -- Segregação de Funções: Apenas owner, admin e operations_lead podem autorizar a execução
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

  -- Idempotência: Rejeita se já foi executado ou bloqueado previamente
  if v_plan.status in ('executed', 'blocked_write_mode', 'rejected', 'cancelled') then
    raise exception 'plan_already_processed';
  end if;

  if v_plan.status != 'approved' then
    raise exception 'write_plan_not_approved';
  end if;

  -- Valida a existência e estado do item de aprovação
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

  -- Com ALASTRE_WRITE_MODE=disabled, retém como blocked_write_mode SEM alterar o item de aprovação
  update public.automation_write_plans
  set status = 'blocked_write_mode',
      updated_at = now()
  where agency_id = v_actor.agency_id and id = v_plan.id
  returning * into v_plan;

  -- Auditoria de tentativa bloqueada
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
      'actor_id', v_actor.actor_id,
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

-- 6. Permissões exclusivas de service_role para as novas RPCs
revoke all on function public.automation_create_write_plan(text, uuid, uuid, uuid, text, text, text, jsonb, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.automation_approve_write_plan(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.automation_execute_write_plan(text, uuid, text) from public, anon, authenticated;

grant execute on function public.automation_create_write_plan(text, uuid, uuid, uuid, text, text, text, jsonb, boolean, jsonb) to service_role;
grant execute on function public.automation_approve_write_plan(text, uuid, text, text) to service_role;
grant execute on function public.automation_execute_write_plan(text, uuid, text) to service_role;
