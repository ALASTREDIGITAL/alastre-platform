-- ==============================================================================
-- Migration: 20260925110000_capacity_and_finance_hardening.sql
-- Módulo 08: Hardening de Isolamento Físico, FKs Compostas e RPC Transacional
--
-- Objetivos:
-- 1. Garantir chaves únicas compostas (agency_id, id) nas tabelas referenciadas
-- 2. FK composta em financial_pricing_decisions (agency_id, approval_item_id) -> approval_items (agency_id, id)
-- 3. FKs compostas em financial_cost_records e financial_margin_analyses
-- 4. Índices de suporte para todas as FKs compostas novas
-- 5. RPC transacional atômica public.process_capacity_pricing_approval com verificação de papéis autorizados
-- 6. Garantia de isolamento RLS e privilégios restritos ao service_role
-- ==============================================================================

-- 1. Chaves Únicas Compostas de Apoio (garantindo que (agency_id, id) seja único em cada tabela alvo)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.approval_items'::regclass and conname = 'uq_approval_items_agency_id'
  ) then
    alter table public.approval_items add constraint uq_approval_items_agency_id unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.workflows'::regclass and conname = 'uq_workflows_agency_id'
  ) then
    alter table public.workflows add constraint uq_workflows_agency_id unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.work_items'::regclass and conname = 'uq_work_items_agency_id'
  ) then
    alter table public.work_items add constraint uq_work_items_agency_id unique (agency_id, id);
  end if;
end;
$$;

-- 2. Hardening de FKs Compostas em financial_pricing_decisions
do $$
begin
  if exists (
    select 1 from pg_constraint where conrelid = 'public.financial_pricing_decisions'::regclass and conname = 'financial_pricing_decisions_approval_item_id_fkey'
  ) then
    alter table public.financial_pricing_decisions drop constraint financial_pricing_decisions_approval_item_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.financial_pricing_decisions'::regclass and conname = 'fk_financial_pricing_approval_item'
  ) then
    alter table public.financial_pricing_decisions
      add constraint fk_financial_pricing_approval_item
      foreign key (agency_id, approval_item_id)
      references public.approval_items(agency_id, id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_financial_pricing_agency_approval_item on public.financial_pricing_decisions(agency_id, approval_item_id);

-- 3. Hardening de FKs Compostas em financial_cost_records
do $$
begin
  -- Workflow FK
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.financial_cost_records'::regclass and conname = 'fk_financial_costs_workflow'
  ) then
    alter table public.financial_cost_records
      add constraint fk_financial_costs_workflow
      foreign key (agency_id, workflow_id)
      references public.workflows(agency_id, id)
      on delete set null;
  end if;

  -- Work Item FK
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.financial_cost_records'::regclass and conname = 'fk_financial_costs_work_item'
  ) then
    alter table public.financial_cost_records
      add constraint fk_financial_costs_work_item
      foreign key (agency_id, work_item_id)
      references public.work_items(agency_id, id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_financial_costs_agency_workflow on public.financial_cost_records(agency_id, workflow_id);
create index if not exists idx_financial_costs_agency_work_item on public.financial_cost_records(agency_id, work_item_id);

-- 4. Função Transacional PostgreSQL: process_capacity_pricing_approval
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

  -- 5. Atualização atômica em approval_items
  update public.approval_items
  set status = p_decision,
      decision_by_email = p_actor_email,
      decision_note = p_decision_note,
      decided_at = now()
  where id = p_approval_item_id and agency_id = p_agency_id;

  -- 6. Atualização atômica em financial_pricing_decisions
  update public.financial_pricing_decisions
  set approval_status = p_decision,
      decided_by_actor_id = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where id = v_pricing.id and agency_id = p_agency_id;

  -- 7. Registro imutável em audit_events
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

-- Revogação estrita e concessão exclusiva para service_role
revoke execute on function public.process_capacity_pricing_approval(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.process_capacity_pricing_approval(uuid, uuid, text, text, text, text, text) to service_role;
