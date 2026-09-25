-- Migration: 20260925060000_quality_and_evidence_hardening.sql
-- Módulo 06: Hardening de Isolamento Multi-Tenant (FKs Compostas) e Transação Atômica de Ação Corretiva
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)
-- Forward-only migration: adiciona Unique Constraints (agency_id, id), Foreign Keys Compostas e RPC Atômica com search_path seguro.

-- 1. Pré-Validação de Isolamento Multi-Tenant
do $$
declare
  v_cross_count integer := 0;
begin
  -- Validação 1: quality_evidences vs client_units
  select count(*) into v_cross_count
  from public.quality_evidences e
  join public.client_units u on e.unit_id = u.id
  where e.agency_id != u.agency_id;

  if v_cross_count > 0 then
    raise exception 'INCONSISTENCIA CROSS-TENANT DETECTADA: % registros de evidência vinculados a unidades de outra agência.', v_cross_count;
  end if;

  -- Validação 2: quality_evidences vs client_services
  select count(*) into v_cross_count
  from public.quality_evidences e
  join public.client_services s on e.service_id = s.id
  where e.agency_id != s.agency_id;

  if v_cross_count > 0 then
    raise exception 'INCONSISTENCIA CROSS-TENANT DETECTADA: % registros de evidência vinculados a serviços de outra agência.', v_cross_count;
  end if;

  -- Validação 3: quality_checklist_runs vs quality_checklist_templates
  select count(*) into v_cross_count
  from public.quality_checklist_runs r
  join public.quality_checklist_templates t on r.template_id = t.id
  where r.agency_id != t.agency_id;

  if v_cross_count > 0 then
    raise exception 'INCONSISTENCIA CROSS-TENANT DETECTADA: % execuções de checklist vinculadas a templates de outra agência.', v_cross_count;
  end if;

  -- Validação 4: quality_non_conformities vs workflows
  select count(*) into v_cross_count
  from public.quality_non_conformities nc
  join public.workflows w on nc.workflow_id = w.id
  where nc.agency_id != w.agency_id;

  if v_cross_count > 0 then
    raise exception 'INCONSISTENCIA CROSS-TENANT DETECTADA: % não conformidades vinculadas a workflows de outra agência.', v_cross_count;
  end if;

  -- Validação 5: quality_non_conformities vs quality_evidences
  select count(*) into v_cross_count
  from public.quality_non_conformities nc
  join public.quality_evidences e on nc.evidence_id = e.id
  where nc.agency_id != e.agency_id;

  if v_cross_count > 0 then
    raise exception 'INCONSISTENCIA CROSS-TENANT DETECTADA: % não conformidades vinculadas a evidências de outra agência.', v_cross_count;
  end if;

  -- Validação 6: quality_non_conformities vs work_items
  select count(*) into v_cross_count
  from public.quality_non_conformities nc
  join public.work_items i on nc.corrective_work_item_id = i.id
  where nc.agency_id != i.agency_id;

  if v_cross_count > 0 then
    raise exception 'INCONSISTENCIA CROSS-TENANT DETECTADA: % não conformidades vinculadas a itens corretivos de outra agência.', v_cross_count;
  end if;
end;
$$;

-- 2. Garantia de Unique Constraints em (agency_id, id) nas Tabelas Pai
do $$
begin
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
    select 1 from pg_constraint where conrelid = 'public.quality_checklist_templates'::regclass and conname = 'quality_checklist_templates_agency_id_id_key'
  ) then
    alter table public.quality_checklist_templates add constraint quality_checklist_templates_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.quality_evidences'::regclass and conname = 'quality_evidences_agency_id_id_key'
  ) then
    alter table public.quality_evidences add constraint quality_evidences_agency_id_id_key unique (agency_id, id);
  end if;
end;
$$;

-- 3. Substituição de Foreign Keys Simples por Foreign Keys Compostas com agency_id

-- 3.1 quality_evidences: (agency_id, unit_id) e (agency_id, service_id)
do $$
begin
  -- Remoção de FKs simples antigas
  if exists (select 1 from pg_constraint where conrelid = 'public.quality_evidences'::regclass and conname = 'quality_evidences_unit_id_fkey') then
    alter table public.quality_evidences drop constraint quality_evidences_unit_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.quality_evidences'::regclass and conname = 'quality_evidences_service_id_fkey') then
    alter table public.quality_evidences drop constraint quality_evidences_service_id_fkey;
  end if;

  -- Adição de FKs compostas
  if not exists (select 1 from pg_constraint where conrelid = 'public.quality_evidences'::regclass and conname = 'quality_evidences_agency_unit_fk') then
    alter table public.quality_evidences add constraint quality_evidences_agency_unit_fk
      foreign key (agency_id, unit_id) references public.client_units(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.quality_evidences'::regclass and conname = 'quality_evidences_agency_service_fk') then
    alter table public.quality_evidences add constraint quality_evidences_agency_service_fk
      foreign key (agency_id, service_id) references public.client_services(agency_id, id) on delete set null;
  end if;
end;
$$;

-- 3.2 quality_checklist_runs: (agency_id, template_id)
do $$
begin
  -- Remoção de FK simples antiga
  if exists (select 1 from pg_constraint where conrelid = 'public.quality_checklist_runs'::regclass and conname = 'quality_checklist_runs_template_id_fkey') then
    alter table public.quality_checklist_runs drop constraint quality_checklist_runs_template_id_fkey;
  end if;

  -- Adição de FK composta
  if not exists (select 1 from pg_constraint where conrelid = 'public.quality_checklist_runs'::regclass and conname = 'quality_checklist_runs_agency_template_fk') then
    alter table public.quality_checklist_runs add constraint quality_checklist_runs_agency_template_fk
      foreign key (agency_id, template_id) references public.quality_checklist_templates(agency_id, id) on delete set null;
  end if;
end;
$$;

-- 3.3 quality_non_conformities: (agency_id, workflow_id), (agency_id, evidence_id), (agency_id, corrective_work_item_id)
do $$
begin
  -- Remoção de FKs simples antigas
  if exists (select 1 from pg_constraint where conrelid = 'public.quality_non_conformities'::regclass and conname = 'quality_non_conformities_workflow_id_fkey') then
    alter table public.quality_non_conformities drop constraint quality_non_conformities_workflow_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.quality_non_conformities'::regclass and conname = 'quality_non_conformities_evidence_id_fkey') then
    alter table public.quality_non_conformities drop constraint quality_non_conformities_evidence_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.quality_non_conformities'::regclass and conname = 'quality_non_conformities_corrective_work_item_id_fkey') then
    alter table public.quality_non_conformities drop constraint quality_non_conformities_corrective_work_item_id_fkey;
  end if;

  -- Adição de FKs compostas
  if not exists (select 1 from pg_constraint where conrelid = 'public.quality_non_conformities'::regclass and conname = 'quality_nc_agency_workflow_fk') then
    alter table public.quality_non_conformities add constraint quality_nc_agency_workflow_fk
      foreign key (agency_id, workflow_id) references public.workflows(agency_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.quality_non_conformities'::regclass and conname = 'quality_nc_agency_evidence_fk') then
    alter table public.quality_non_conformities add constraint quality_nc_agency_evidence_fk
      foreign key (agency_id, evidence_id) references public.quality_evidences(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.quality_non_conformities'::regclass and conname = 'quality_nc_agency_corrective_item_fk') then
    alter table public.quality_non_conformities add constraint quality_nc_agency_corrective_item_fk
      foreign key (agency_id, corrective_work_item_id) references public.work_items(agency_id, id) on delete set null;
  end if;
end;
$$;

-- 4. Função RPC Transacional Atômica: Criação de Ação Corretiva
create or replace function public.quality_create_corrective_action(
  p_agency_id uuid,
  p_non_conformity_id uuid,
  p_title text,
  p_description text default '',
  p_priority text default 'high',
  p_actor_id text default '',
  p_actor_email text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nc record;
  v_target_workflow_id uuid;
  v_corrective_work_item_id uuid;
  v_client_exists boolean;
begin
  -- 1. Buscar Não Conformidade com trava pessimista FOR UPDATE
  select * into v_nc
  from public.quality_non_conformities
  where agency_id = p_agency_id and id = p_non_conformity_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Não conformidade não encontrada ou pertence a outra agência');
  end if;

  -- 2. Validar se o cliente pertence à mesma agência
  select exists (
    select 1 from public.clients where agency_id = p_agency_id and id = v_nc.client_id
  ) into v_client_exists;

  if not v_client_exists then
    return jsonb_build_object('success', false, 'error', 'Cliente da não conformidade não pertence à agência autenticada');
  end if;

  -- 3. Resolução do Workflow (Reutilizar ou criar workflow válido da mesma agência)
  if v_nc.workflow_id is not null then
    select id into v_target_workflow_id
    from public.workflows
    where agency_id = p_agency_id and id = v_nc.workflow_id and client_id = v_nc.client_id;
  end if;

  if v_target_workflow_id is null then
    insert into public.workflows (
      id,
      agency_id,
      client_id,
      title,
      workflow_type,
      status,
      priority,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      p_agency_id,
      v_nc.client_id,
      'Workflow de Exceção: ' || substring(v_nc.title from 1 for 100),
      'exception',
      'in_progress',
      case when p_priority in ('low', 'medium', 'high', 'urgent') then p_priority else 'high' end,
      now(),
      now()
    ) returning id into v_target_workflow_id;
  end if;

  -- 4. Criar item de trabalho corretivo em work_items (Módulo 04)
  insert into public.work_items (
    id,
    agency_id,
    client_id,
    workflow_id,
    title,
    description,
    task_type,
    frequency,
    status,
    priority,
    estimated_minutes,
    actual_minutes,
    assigned_actor_id,
    assigned_actor_name,
    requires_approval,
    evidence_required,
    acceptance_criteria,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    p_agency_id,
    v_nc.client_id,
    v_target_workflow_id,
    '[Ação Corretiva] ' || p_title,
    coalesce(nullif(p_description, ''), 'Ação gerada para solução da Não Conformidade NC-' || substring(v_nc.id::text from 1 for 8) || ': ' || v_nc.title),
    'manual',
    'one_off',
    'todo',
    case when p_priority in ('low', 'medium', 'high', 'urgent') then p_priority else 'high' end,
    60,
    0,
    p_actor_id,
    p_actor_email,
    true,
    true,
    'Correção comprovada da NC-' || substring(v_nc.id::text from 1 for 8) || ' com evidências e verificação de não reincidência.',
    now(),
    now()
  ) returning id into v_corrective_work_item_id;

  -- 5. Atualizar Não Conformidade com workflow_id e corrective_work_item_id
  update public.quality_non_conformities
  set status = 'action_created',
      workflow_id = v_target_workflow_id,
      corrective_work_item_id = v_corrective_work_item_id,
      updated_at = now()
  where agency_id = p_agency_id and id = p_non_conformity_id;

  -- 6. Registrar Auditoria do evento
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
    'non_conformity',
    p_non_conformity_id,
    'modified',
    p_actor_id,
    to_jsonb(v_nc),
    jsonb_build_object(
      'status', 'action_created',
      'workflow_id', v_target_workflow_id,
      'corrective_work_item_id', v_corrective_work_item_id
    ),
    'Criação atômica de ação corretiva via RPC'
  );

  return jsonb_build_object(
    'success', true,
    'workflow_id', v_target_workflow_id,
    'corrective_work_item_id', v_corrective_work_item_id
  );
end;
$$;

-- 5. Revogação de Acesso Público e Concessão Exclusiva para service_role
revoke execute on function public.quality_create_corrective_action from public, anon, authenticated;
grant execute on function public.quality_create_corrective_action to service_role;
