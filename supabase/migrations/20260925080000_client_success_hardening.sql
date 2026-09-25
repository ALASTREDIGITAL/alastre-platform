-- Migration: 20260925080000_client_success_hardening.sql
-- Módulo 07: Sucesso do Cliente — Hardening de Índices, Policies de Service Role e RPCs Transacionais
-- Projeto: Alastre Platform Homologação (fifbtwbndutbvwnbzgtz)

-- 1. Índices de Suporte Multi-Tenant e Chaves Estrangeiras
create index if not exists idx_client_health_scores_agency_client on public.client_health_scores(agency_id, client_id);
create index if not exists idx_client_scorecards_agency_client on public.client_scorecards(agency_id, client_id);
create index if not exists idx_client_meetings_agency_client on public.client_meetings(agency_id, client_id);
create index if not exists idx_client_meeting_decisions_meeting on public.client_meeting_decisions(agency_id, meeting_id);
create index if not exists idx_client_meeting_decisions_client on public.client_meeting_decisions(agency_id, client_id);
create index if not exists idx_client_churn_assessments_agency_client on public.client_churn_assessments(agency_id, client_id);
create index if not exists idx_client_expansion_agency_client on public.client_expansion_recommendations(agency_id, client_id);
create index if not exists idx_client_cancellation_agency_client on public.client_cancellation_requests(agency_id, client_id);
create index if not exists idx_client_offboarding_agency_client on public.client_offboarding_inventories(agency_id, client_id);
create index if not exists idx_client_offboarding_cancellation on public.client_offboarding_inventories(agency_id, cancellation_request_id);

-- 2. Service Role RLS Policies
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'client_health_scores' and policyname = 'service_role_all_client_health_scores') then
    create policy service_role_all_client_health_scores on public.client_health_scores for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_scorecards' and policyname = 'service_role_all_client_scorecards') then
    create policy service_role_all_client_scorecards on public.client_scorecards for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_meetings' and policyname = 'service_role_all_client_meetings') then
    create policy service_role_all_client_meetings on public.client_meetings for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_meeting_decisions' and policyname = 'service_role_all_client_meeting_decisions') then
    create policy service_role_all_client_meeting_decisions on public.client_meeting_decisions for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_churn_assessments' and policyname = 'service_role_all_client_churn_assessments') then
    create policy service_role_all_client_churn_assessments on public.client_churn_assessments for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_expansion_recommendations' and policyname = 'service_role_all_client_expansion_recommendations') then
    create policy service_role_all_client_expansion_recommendations on public.client_expansion_recommendations for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_cancellation_requests' and policyname = 'service_role_all_client_cancellation_requests') then
    create policy service_role_all_client_cancellation_requests on public.client_cancellation_requests for all to service_role using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'client_offboarding_inventories' and policyname = 'service_role_all_client_offboarding_inventories') then
    create policy service_role_all_client_offboarding_inventories on public.client_offboarding_inventories for all to service_role using (true) with check (true);
  end if;
end;
$$;
