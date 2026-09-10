-- Reconcile read-only GTM/GA4 discovery evidence into the tenant-scoped Core.
-- No external resource is created, changed or published by this command.

create or replace function public.platform_record_tracking_discovery(
  p_actor_id uuid,
  p_client_id uuid,
  p_resources jsonb,
  p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.agency_actors%rowtype;
  v_profile public.tracking_profiles%rowtype;
  v_deployment_id uuid;
  v_resource jsonb;
  v_count integer := 0;
  v_legacy integer := 0;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id for update;
  if not found then raise exception 'tracking_profile_not_found' using errcode='P0002'; end if;
  if jsonb_typeof(p_resources)<>'array' or jsonb_typeof(p_evidence)<>'object' then raise exception 'invalid_discovery' using errcode='22023'; end if;

  select id into v_deployment_id from public.tracking_deployments where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 1;
  for v_resource in select value from jsonb_array_elements(p_resources) loop
    if (v_resource->>'resource_type') not in ('gtm_account','gtm_container','gtm_workspace','gtm_version','ga4_property','ga4_web_stream','ga4_measurement','ga4_key_event','legacy_external_resource')
      or length(trim(v_resource->>'external_id')) not between 1 and 240 then
      raise exception 'invalid_tracking_resource' using errcode='22023';
    end if;
    insert into public.tracking_resources (agency_id,client_id,profile_id,resource_type,external_id,resource_path,status,ownership,metadata,last_verified_at)
    values (v_actor.agency_id,p_client_id,v_profile.id,v_resource->>'resource_type',trim(v_resource->>'external_id'),nullif(trim(v_resource->>'resource_path'),''),
      case when v_resource->>'resource_type'='legacy_external_resource' then 'legacy' else 'discovered' end,
      case when v_resource->>'ownership' in ('alastre','client','external','unknown') then v_resource->>'ownership' else 'unknown' end,
      coalesce(v_resource->'metadata','{}'::jsonb),now())
    on conflict (agency_id,client_id,resource_type,external_id) do update set resource_path=excluded.resource_path,status=excluded.status,ownership=excluded.ownership,metadata=excluded.metadata,last_verified_at=now(),updated_at=now();
    v_count:=v_count+1;
    if v_resource->>'resource_type'='legacy_external_resource' then v_legacy:=v_legacy+1; end if;
  end loop;

  update public.tracking_profiles set status='ready_to_apply',health=case when v_count=0 then 'warning' when v_legacy>0 then 'warning' else 'healthy' end,updated_at=now() where id=v_profile.id;
  if v_deployment_id is not null then update public.tracking_deployments set status='planned',decision=case when v_count-v_legacy>0 then 'reuse_compatible_resources' else 'create_clean_stack' end,updated_at=now() where id=v_deployment_id; end if;
  insert into public.tracking_validations (agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence)
  values (v_actor.agency_id,p_client_id,v_profile.id,v_deployment_id,'discovery','alastre_tracking_discovery',case when v_count=0 then 'warning' else 'passed' end,p_evidence||jsonb_build_object('resource_count',v_count,'legacy_count',v_legacy,'external_writes',false));
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload)
  values (v_actor.agency_id,p_client_id,'tracking_discovery_completed','tracking_profile',v_profile.id::text,jsonb_build_object('actor_id',v_actor.id,'resource_count',v_count,'legacy_count',v_legacy,'write_mode','disabled'));
  return jsonb_build_object('profile_id',v_profile.id,'status','ready_to_apply','resource_count',v_count,'legacy_count',v_legacy,'external_writes',false);
end; $$;

revoke all on function public.platform_record_tracking_discovery(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.platform_record_tracking_discovery(uuid,uuid,jsonb,jsonb) to service_role;
