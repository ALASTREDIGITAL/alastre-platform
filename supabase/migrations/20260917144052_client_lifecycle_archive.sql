-- Ciclo de vida reversivel do cliente. Nao escreve em plataformas externas.

create or replace function public.platform_set_client_status(
  p_actor_id uuid,
  p_client_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.agency_actors%rowtype;
  v_client public.clients%rowtype;
begin
  select * into v_actor from public.agency_actors where id = p_actor_id and active;
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'actor_forbidden' using errcode = '42501';
  end if;
  if p_status not in ('active', 'archived') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.clients
  set status = p_status, updated_at = now()
  where id = p_client_id and agency_id = v_actor.agency_id
  returning * into v_client;
  if not found then raise exception 'client_not_found' using errcode = 'P0002'; end if;

  insert into public.audit_events (agency_id, client_id, action, target_type, target_id, payload)
  values (
    v_actor.agency_id,
    v_client.id,
    case when p_status = 'archived' then 'client_archived' else 'client_reactivated' end,
    'client',
    v_client.id::text,
    jsonb_build_object('actor_id', v_actor.id, 'status', p_status)
  );
  return jsonb_build_object('id', v_client.id, 'name', v_client.name, 'status', v_client.status);
end;
$$;

revoke all on function public.platform_set_client_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.platform_set_client_status(uuid, uuid, text) to service_role;

create or replace function public.platform_purge_client(
  p_actor_id uuid,
  p_client_id uuid,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.agency_actors%rowtype;
  v_client public.clients%rowtype;
begin
  select * into v_actor from public.agency_actors where id = p_actor_id and active;
  if not found or v_actor.role <> 'owner' then
    raise exception 'actor_forbidden' using errcode = '42501';
  end if;

  select * into v_client from public.clients
  where id = p_client_id and agency_id = v_actor.agency_id for update;
  if not found then raise exception 'client_not_found' using errcode = 'P0002'; end if;
  if v_client.status <> 'archived' then raise exception 'client_must_be_archived' using errcode = '22023'; end if;
  if trim(coalesce(p_confirmation, '')) <> v_client.name then raise exception 'confirmation_mismatch' using errcode = '22023'; end if;

  update public.audit_events
  set client_id = null,
      payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('deleted_client_id', v_client.id, 'deleted_client_name', v_client.name)
  where agency_id = v_actor.agency_id and client_id = v_client.id;

  delete from public.local_seo_review_replies where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_posts where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_opportunities where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_execution_runs where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_validations where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_resources where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_resource_candidates where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_deployments where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.ai_usage_events where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.agent_messages where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.agent_runs where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.agent_threads where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.work_items where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.workflow_runs where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.workflows where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.approval_items where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.ai_cost_policies where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.google_ads_campaign_drafts where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_rank_snapshots where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_keywords where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_competitors where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_profile_checks where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_reviews where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.local_seo_score_snapshots where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.client_resource_bindings where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.client_services where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.credential_refs where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.integrations where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.client_intelligence_sources where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.client_dna_profiles where agency_id=v_actor.agency_id and client_id=v_client.id;
  delete from public.platform_command_receipts where agency_id=v_actor.agency_id and result->>'id'=v_client.id::text;

  insert into public.audit_events (agency_id, client_id, action, target_type, target_id, payload)
  values (v_actor.agency_id, null, 'client_permanently_deleted', 'client', v_client.id::text,
    jsonb_build_object('actor_id',v_actor.id,'deleted_client_id',v_client.id,'deleted_client_name',v_client.name));
  delete from public.clients where id=v_client.id and agency_id=v_actor.agency_id;
  return jsonb_build_object('id',v_client.id,'name',v_client.name,'deleted',true);
end;
$$;

revoke all on function public.platform_purge_client(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.platform_purge_client(uuid, uuid, text) to service_role;
