-- ==============================================================================
-- Migration: Hardening Final do Gate de Ativação e Defesa Transacional (TOCTOU)
-- Data: 2026-09-24
-- Descrição:
--   1. Corrige o RPC onboarding_activate_client para não inventar serviços contratados.
--   2. Implementa validação transacional estrita de todos os critérios de prontidão:
--      - Onboarding e cliente pertencentes à agência autenticada;
--      - Item de aprovação pendente e formalmente vinculado;
--      - Existência de serviço contratado válido ('pending' ou 'active');
--      - DNA confirmado ('confirmed') com campos vitais preenchidos;
--      - Baseline factual estabelecido;
--      - Plano de implantação existente;
--      - Pelo menos uma unidade ativa confirmada;
--      - Ausência de bloqueios ou cancelamentos;
--      - Cumprimento de todos os requisitos obrigatórios.
--   3. Endurece search_path para '' (qualificação estrita public/pg_catalog).
--   4. Revoga execução de public, anon e authenticated; concede apenas a service_role.
-- ==============================================================================

create or replace function public.onboarding_activate_client(
  p_agency_id uuid,
  p_onboarding_id text,
  p_actor_id text,
  p_approval_id uuid,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_onboarding public.client_onboardings%rowtype;
  v_approval public.approval_items%rowtype;
  v_client public.clients%rowtype;
  v_dna public.client_dna_profiles%rowtype;
  v_now timestamptz := pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now());
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

  if v_onboarding.status in ('blocked', 'cancelled') or v_onboarding.blocking_reason is not null then
    raise exception 'onboarding_status_blocked_or_cancelled' using errcode = '22023';
  end if;

  -- Estado compatível com ativação
  if v_onboarding.status not in ('ready_for_activation', 'planning_implementation') then
    raise exception 'onboarding_not_ready_for_activation' using errcode = '22023';
  end if;

  if v_onboarding.client_id is null then
    raise exception 'onboarding_missing_client' using errcode = '22023';
  end if;

  -- 3. Bloqueia e valida que o cliente pertence estritamente à agência autenticada
  select * into v_client
  from public.clients
  where id = v_onboarding.client_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'client_not_found_in_agency' using errcode = 'P0002';
  end if;

  -- 4. Bloqueia e valida o item de aprovação estritamente por tenant, tipo, id e status
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

  -- 5. Defesa TOCTOU: Valida que existe serviço realmente contratado/cadastrado com status válido
  -- Jamais cria serviço automaticamente se não existir.
  if not exists (
    select 1
    from public.client_services
    where agency_id = p_agency_id
      and client_id = v_onboarding.client_id
      and status in ('pending', 'active')
  ) then
    raise exception 'no_valid_contracted_services' using errcode = '22023';
  end if;

  -- 6. Defesa TOCTOU: Valida DNA confirmado com dados vitais preenchidos
  select * into v_dna
  from public.client_dna_profiles
  where agency_id = p_agency_id
    and client_id = v_onboarding.client_id;

  if not found then
    raise exception 'dna_profile_not_found' using errcode = '22023';
  end if;

  if v_dna.status <> 'confirmed' then
    raise exception 'dna_not_confirmed' using errcode = '22023';
  end if;

  if pg_catalog.coalesce(pg_catalog.trim(v_dna.business_data->>'name'), pg_catalog.trim(v_dna.business_data->>'company_name'), '') = ''
     or pg_catalog.coalesce(pg_catalog.trim(v_dna.business_data->>'segment'), '') = ''
     or (
       pg_catalog.coalesce(pg_catalog.trim(v_dna.business_data->>'city'), '') = ''
       and pg_catalog.coalesce(
         case
           when jsonb_typeof(v_dna.business_data->'cities') = 'array' then jsonb_array_length(v_dna.business_data->'cities')
           else 0
         end,
         0
       ) = 0
     )
     or (
       pg_catalog.coalesce(pg_catalog.trim(v_dna.business_data->>'phone'), '') = ''
       and pg_catalog.coalesce(pg_catalog.trim(v_dna.business_data->>'whatsapp'), '') = ''
     )
  then
    raise exception 'dna_minimum_fields_missing' using errcode = '22023';
  end if;

  -- 7. Defesa TOCTOU: Valida existência de baseline de diagnóstico inicial
  if not exists (
    select 1
    from public.client_onboarding_baselines
    where agency_id = p_agency_id
      and onboarding_id = p_onboarding_id
  ) then
    raise exception 'missing_baseline' using errcode = '22023';
  end if;

  -- 8. Defesa TOCTOU: Valida existência do plano de implantação
  if not exists (
    select 1
    from public.client_onboarding_plans
    where agency_id = p_agency_id
      and onboarding_id = p_onboarding_id
  ) then
    raise exception 'missing_implementation_plan' using errcode = '22023';
  end if;

  -- 9. Defesa TOCTOU: Valida existência de pelo menos uma unidade ativa
  if not exists (
    select 1
    from public.client_units
    where agency_id = p_agency_id
      and client_id = v_onboarding.client_id
      and status = 'active'
  ) then
    raise exception 'missing_valid_unit' using errcode = '22023';
  end if;

  -- 10. Defesa TOCTOU: Valida ausência de requisitos obrigatórios pendentes
  if exists (
    select 1
    from public.client_onboarding_requirements
    where agency_id = p_agency_id
      and onboarding_id = p_onboarding_id
      and is_required = true
      and status not in ('verified', 'waived')
  ) then
    raise exception 'pending_required_requirements' using errcode = '22023';
  end if;

  -- 11. Transição atômica: Atualiza o status do cliente para 'active'
  update public.clients
  set status = 'active',
      updated_at = v_now
  where id = v_onboarding.client_id
    and agency_id = p_agency_id;

  -- 12. Transição atômica: Ativa os serviços contratados existentes (sem criar novos)
  update public.client_services
  set status = 'active',
      updated_at = v_now
  where agency_id = p_agency_id
    and client_id = v_onboarding.client_id
    and status in ('pending', 'active');

  -- 13. Transição atômica: Atualiza item de aprovação para 'approved'
  update public.approval_items
  set status = 'approved',
      decided_at = v_now,
      decision_by_email = p_actor_id,
      decision_note = pg_catalog.coalesce(p_notes, 'Ativação formal aprovada pela liderança operacional.')
  where id = v_approval.id
    and agency_id = p_agency_id
    and source_type = 'client_onboarding_activation'
    and source_id = p_onboarding_id
    and status = 'pending';

  -- 14. Transição atômica: Atualiza onboarding para 'active'
  update public.client_onboardings
  set status = 'active',
      current_stage = 'active',
      activated_at = v_now,
      activated_by_actor_id = p_actor_id,
      activation_approval_id = v_approval.id,
      updated_at = v_now
  where id = p_onboarding_id
    and agency_id = p_agency_id;

  -- 15. Registro imutável de decisão
  v_decision_id := 'dec-' || (pg_catalog.floor(extract(epoch from v_now) * 1000))::text;
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
    'client_activated',
    p_actor_id,
    p_actor_id,
    'operations_lead',
    pg_catalog.coalesce(p_notes, 'Ativação formal autorizada com todos os critérios de prontidão atendidos.'),
    pg_catalog.jsonb_build_object('approval_id', v_approval.id, 'activated_at', v_now),
    v_now
  );

  -- 16. Registro de evento de auditoria
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
    'client_onboarding',
    p_onboarding_id,
    pg_catalog.jsonb_build_object(
      'actor_id', p_actor_id,
      'approval_id', v_approval.id,
      'notes', p_notes,
      'activated_at', v_now
    ),
    v_now
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'active',
    'activated_at', v_now,
    'onboarding_id', p_onboarding_id,
    'client_id', v_onboarding.client_id,
    'approval_id', v_approval.id
  );
end;
$$;

-- Privilégios mínimos estritos
revoke all on function public.onboarding_activate_client(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.onboarding_activate_client(uuid, text, text, uuid, text) to service_role;
