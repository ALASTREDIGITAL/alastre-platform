-- ==============================================================================
-- Migration: 20260925130000_capacity_and_finance_canonical_source_id.sql
-- Módulo 08: Gravacao Canonica de source_id em approval_items e Validação Estrita de Proposta
--
-- Objetivos:
-- 1. Gravação direta e canônica de p_proposal_id em approval_items.source_id (texto alfanumérico exato, sem conversão UUID)
-- 2. Atualização da RPC process_capacity_pricing_approval para exigir obrigatoriamente:
--    - v_approval.source_id = v_pricing.proposal_id
--    - v_approval.snapshot->>'proposal_id' = v_pricing.proposal_id
--    - rejeição imediata com 'approval_proposal_mismatch' se source_id ou snapshot.proposal_id estiverem ausentes, vazios ou divergentes
-- 3. RLS e permissões restritas exclusivamente ao service_role
-- ==============================================================================

-- 1. Atualização da RPC submit_capacity_pricing_proposal_for_approval com source_id texto canônico
create or replace function public.submit_capacity_pricing_proposal_for_approval(
  p_agency_id uuid,
  p_client_id uuid,
  p_proposal_id text,
  p_product_definition_id text default null,
  p_list_setup_price numeric default 0.00,
  p_list_monthly_price numeric default 0.00,
  p_proposed_setup_price numeric default 0.00,
  p_proposed_monthly_price numeric default 0.00,
  p_estimated_operational_cost numeric default 0.00,
  p_discount_applied_pct numeric default 0.00,
  p_discount_type text default null,
  p_discount_counterpart text default null,
  p_is_cost_estimated boolean default false,
  p_is_counterpart_documented boolean default false,
  p_actor_id text default 'actor-system',
  p_actor_email text default 'admin@alastre.com.br',
  p_evaluated_margin_pct numeric default 0.00
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval_item_id uuid := gen_random_uuid();
  v_pricing_decision_id text := 'pricing-' || gen_random_uuid()::text;
  v_client_exists boolean;
  v_proposal_exists boolean;
begin
  -- 1. Validação de existência real do cliente na agência
  select exists (
    select 1 from public.clients
    where agency_id = p_agency_id and id = p_client_id
  ) into v_client_exists;

  if not v_client_exists then
    raise exception 'client_not_found_for_agency' using errcode = '23503';
  end if;

  -- 2. Validação de existência real da proposta comercial na agência
  select exists (
    select 1 from public.commercial_proposals
    where agency_id = p_agency_id and id = p_proposal_id
  ) into v_proposal_exists;

  if not v_proposal_exists then
    raise exception 'proposal_not_found_for_agency' using errcode = '23503';
  end if;

  -- 3. Inserção atômica em approval_items gravando p_proposal_id EXATO em source_id (campo text canônico)
  insert into public.approval_items (
    id,
    agency_id,
    client_id,
    source_type,
    source_id,
    requested_by_email,
    status,
    snapshot
  ) values (
    v_approval_item_id,
    p_agency_id,
    p_client_id,
    'capacity_financial_pricing',
    p_proposal_id, -- TEXTO EXATO DA PROPOSTA, SEM CONVERSÃO UUID E SEM UUID ALEATÓRIO
    p_actor_email,
    'pending',
    jsonb_build_object(
      'proposal_id', p_proposal_id,
      'client_id', p_client_id,
      'list_setup_price', p_list_setup_price,
      'list_monthly_price', p_list_monthly_price,
      'proposed_setup_price', p_proposed_setup_price,
      'proposed_monthly_price', p_proposed_monthly_price,
      'estimated_operational_cost', p_estimated_operational_cost,
      'discount_applied_pct', p_discount_applied_pct,
      'discount_type', p_discount_type,
      'discount_counterpart', p_discount_counterpart,
      'evaluated_margin_pct', p_evaluated_margin_pct
    )
  );

  -- 4. Inserção atômica em financial_pricing_decisions
  insert into public.financial_pricing_decisions (
    id,
    agency_id,
    proposal_id,
    product_definition_id,
    list_setup_price,
    list_monthly_price,
    proposed_setup_price,
    proposed_monthly_price,
    estimated_operational_cost,
    discount_applied_pct,
    discount_type,
    discount_counterpart_description,
    is_cost_estimated,
    is_counterpart_documented,
    approval_status,
    approval_item_id,
    created_at,
    updated_at
  ) values (
    v_pricing_decision_id,
    p_agency_id,
    p_proposal_id,
    p_product_definition_id,
    p_list_setup_price,
    p_list_monthly_price,
    p_proposed_setup_price,
    p_proposed_monthly_price,
    p_estimated_operational_cost,
    p_discount_applied_pct,
    p_discount_type,
    p_discount_counterpart,
    p_is_cost_estimated,
    p_is_counterpart_documented,
    'pending_human_approval',
    v_approval_item_id,
    now(),
    now()
  );

  -- 5. Registro imutável em audit_events na mesma transação
  insert into public.audit_events (
    agency_id,
    action,
    target_type,
    target_id,
    payload
  ) values (
    p_agency_id,
    'pricing_decision_submitted_for_approval',
    'financial_pricing_decisions',
    v_pricing_decision_id,
    jsonb_build_object(
      'requested_by_actor_id', p_actor_id,
      'requested_by_email', p_actor_email,
      'approval_item_id', v_approval_item_id,
      'proposal_id', p_proposal_id,
      'client_id', p_client_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'approval_item_id', v_approval_item_id,
    'pricing_decision_id', v_pricing_decision_id
  );
end;
$$;

-- Revogação e concessão exclusiva para service_role
revoke execute on function public.submit_capacity_pricing_proposal_for_approval(uuid, uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, text, text, boolean, boolean, text, text, numeric) from public, anon, authenticated;
grant execute on function public.submit_capacity_pricing_proposal_for_approval(uuid, uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, text, text, boolean, boolean, text, text, numeric) to service_role;

-- 2. Atualização da RPC Transacional process_capacity_pricing_approval com Validação Estrita Canônica
create or replace function public.process_capacity_pricing_approval(
  p_agency_id uuid,
  p_approval_item_id uuid,
  p_actor_id text,
  p_actor_email text,
  p_actor_role text,
  p_decision text,
  p_decision_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval record;
  v_pricing record;
  v_action text;
  v_snapshot_proposal_id text;
begin
  -- 1. Validação estrita de autorização de papel
  if p_actor_role not in ('owner', 'admin', 'operations_lead', 'commercial_lead') then
    raise exception 'actor_not_authorized' using errcode = '42501';
  end if;

  -- 2. Validação da decisão ('approved' ou 'rejected')
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision_status' using errcode = '22023';
  end if;

  -- 3. Bloqueio e consulta atômica do approval_item
  select * into v_approval
  from public.approval_items
  where id = p_approval_item_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'approval_item_not_found' using errcode = 'P0002';
  end if;

  if v_approval.source_type <> 'capacity_financial_pricing' then
    raise exception 'approval_item_invalid_source_type' using errcode = '22023';
  end if;

  if v_approval.status <> 'pending' then
    raise exception 'approval_item_already_decided' using errcode = '22023';
  end if;

  -- 4. Bloqueio e consulta da decisão de precificação correspondente
  select * into v_pricing
  from public.financial_pricing_decisions
  where agency_id = p_agency_id and approval_item_id = p_approval_item_id
  for update;

  if not found then
    raise exception 'financial_pricing_decision_not_found' using errcode = 'P0002';
  end if;

  if v_pricing.approval_status <> 'pending_human_approval' then
    raise exception 'financial_pricing_decision_already_decided' using errcode = '22023';
  end if;

  -- 5. VALIDAÇÃO CANÔNICA E ESTRITA DE DIVERGÊNCIA DE PROPOSTA
  v_snapshot_proposal_id := v_approval.snapshot->>'proposal_id';

  -- Exigência 1: source_id não pode ser ausente ou vazio
  if v_approval.source_id is null or length(trim(v_approval.source_id)) = 0 then
    raise exception 'approval_proposal_mismatch' using errcode = '22023';
  end if;

  -- Exigência 2: snapshot.proposal_id não pode ser ausente ou vazio
  if v_snapshot_proposal_id is null or length(trim(v_snapshot_proposal_id)) = 0 then
    raise exception 'approval_proposal_mismatch' using errcode = '22023';
  end if;

  -- Exigência 3: source_id DEVE corresponder exatamente ao proposal_id da decisão
  if v_approval.source_id <> v_pricing.proposal_id then
    raise exception 'approval_proposal_mismatch' using errcode = '22023';
  end if;

  -- Exigência 4: snapshot.proposal_id DEVE corresponder exatamente ao proposal_id da decisão
  if v_snapshot_proposal_id <> v_pricing.proposal_id then
    raise exception 'approval_proposal_mismatch' using errcode = '22023';
  end if;

  -- 6. Atualização atômica em approval_items
  update public.approval_items
  set status = p_decision,
      decision_by_email = p_actor_email,
      decision_note = p_decision_note,
      decided_at = now()
  where id = p_approval_item_id and agency_id = p_agency_id;

  -- 7. Atualização atômica em financial_pricing_decisions
  update public.financial_pricing_decisions
  set approval_status = p_decision,
      decided_by_actor_id = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where id = v_pricing.id and agency_id = p_agency_id;

  -- 8. Registro imutável em audit_events na mesma transação
  v_action := case when p_decision = 'approved' then 'pricing_decision_human_approved' else 'pricing_decision_human_rejected' end;
  
  insert into public.audit_events (
    agency_id,
    action,
    target_type,
    target_id,
    payload
  ) values (
    p_agency_id,
    v_action,
    'financial_pricing_decisions',
    v_pricing.id,
    jsonb_build_object(
      'approval_item_id', p_approval_item_id,
      'proposal_id', v_pricing.proposal_id,
      'decided_by_actor_id', p_actor_id,
      'decided_by_email', p_actor_email,
      'actor_role', p_actor_role,
      'decision', p_decision,
      'decision_note', p_decision_note
    )
  );

  return jsonb_build_object(
    'success', true,
    'approval_item_id', p_approval_item_id,
    'pricing_decision_id', v_pricing.id,
    'status', p_decision
  );
end;
$$;

-- Revogação e concessão exclusiva para service_role
revoke execute on function public.process_capacity_pricing_approval(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.process_capacity_pricing_approval(uuid, uuid, text, text, text, text, text) to service_role;
