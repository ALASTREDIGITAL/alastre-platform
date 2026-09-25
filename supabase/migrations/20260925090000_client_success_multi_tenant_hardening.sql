-- Migration: 20260925090000_client_success_multi_tenant_hardening.sql
-- Módulo 07: Sucesso do Cliente — Hardening de Relações Multi-Tenant com Foreign Keys Compostas
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)

-- 1. Assegurar Unique Constraints (agency_id, id) nas tabelas pai para suporte a FKs compostas
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.commercial_opportunities'::regclass and conname = 'commercial_opportunities_agency_id_id_key'
  ) then
    alter table public.commercial_opportunities add constraint commercial_opportunities_agency_id_id_key unique (agency_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.commercial_proposals'::regclass and conname = 'commercial_proposals_agency_id_id_key'
  ) then
    alter table public.commercial_proposals add constraint commercial_proposals_agency_id_id_key unique (agency_id, id);
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

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.client_cancellation_requests'::regclass and conname = 'client_cancellation_requests_agency_id_id_key'
  ) then
    alter table public.client_cancellation_requests add constraint client_cancellation_requests_agency_id_id_key unique (agency_id, id);
  end if;
end;
$$;

-- 2. Remoção de FKs simples e adição de Foreign Keys compostas com agency_id
do $$
begin
  -- Remoção defensiva de FKs simples pré-existentes se houver
  if exists (select 1 from pg_constraint where conname = 'client_meetings_service_id_fkey') then
    alter table public.client_meetings drop constraint client_meetings_service_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'client_meeting_decisions_work_item_id_fkey') then
    alter table public.client_meeting_decisions drop constraint client_meeting_decisions_work_item_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'client_expansion_recommendations_commercial_opportunity_id_fkey') then
    alter table public.client_expansion_recommendations drop constraint client_expansion_recommendations_commercial_opportunity_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'client_expansion_recommendations_commercial_proposal_id_fkey') then
    alter table public.client_expansion_recommendations drop constraint client_expansion_recommendations_commercial_proposal_id_fkey;
  end if;

  -- Adição de Foreign Keys Compostas garantindo isolamento por tenant (agency_id)
  if not exists (select 1 from pg_constraint where conname = 'client_meetings_agency_service_fk') then
    alter table public.client_meetings add constraint client_meetings_agency_service_fk
      foreign key (agency_id, service_id) references public.client_services(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'client_meeting_decisions_agency_work_item_fk') then
    alter table public.client_meeting_decisions add constraint client_meeting_decisions_agency_work_item_fk
      foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'client_expansion_recommendations_agency_opportunity_fk') then
    alter table public.client_expansion_recommendations add constraint client_expansion_recommendations_agency_opportunity_fk
      foreign key (agency_id, commercial_opportunity_id) references public.commercial_opportunities(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'client_expansion_recommendations_agency_proposal_fk') then
    alter table public.client_expansion_recommendations add constraint client_expansion_recommendations_agency_proposal_fk
      foreign key (agency_id, commercial_proposal_id) references public.commercial_proposals(agency_id, id) on delete set null;
  end if;
end;
$$;
