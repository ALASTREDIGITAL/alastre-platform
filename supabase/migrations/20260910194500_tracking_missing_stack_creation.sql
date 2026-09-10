-- Approval-gated creation of a missing GTM container and GA4 property/stream.
-- The bridge re-discovers by domain before creating, making retries safe.

create or replace function public.platform_tracking_resource_creation_gate(
  p_actor_id uuid,p_deployment_id uuid,p_gtm_account text,p_ga4_account text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_d public.tracking_deployments%rowtype;v_a public.approval_items%rowtype;v_p public.tracking_profiles%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_d from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'deployment_not_found' using errcode='P0002';end if;
 select * into v_a from public.approval_items where id=v_d.approval_id and agency_id=v_actor.agency_id and client_id=v_d.client_id and source_type='tracking_deployment' and source_id=v_d.id;
 if not found or v_a.status<>'approved' or v_d.status<>'approved' then raise exception 'tracking_creation_locked' using errcode='42501';end if;
 if p_gtm_account!~'^accounts/[0-9]+$' or p_ga4_account!~'^accounts/[0-9]+$' then raise exception 'invalid_parent_account' using errcode='22023';end if;
 select * into v_p from public.tracking_profiles where id=v_d.profile_id and agency_id=v_actor.agency_id;
 return jsonb_build_object('deployment_id',v_d.id,'approval_id',v_a.id,'agency_id',v_actor.agency_id,'client_id',v_d.client_id,'profile_id',v_p.id,'domain',v_p.domain,'gtm_account',p_gtm_account,'ga4_account',p_ga4_account,'allowed',true);
end;$$;

create or replace function public.platform_record_created_tracking_stack(
  p_actor_id uuid,p_deployment_id uuid,p_gtm_account_path text,p_gtm_container_path text,p_gtm_public_id text,
  p_ga4_account_path text,p_ga4_property_path text,p_ga4_stream_path text,p_measurement_id text,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_d public.tracking_deployments%rowtype;v_gate jsonb;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 v_gate:=public.platform_tracking_resource_creation_gate(p_actor_id,p_deployment_id,p_gtm_account_path,p_ga4_account_path);
 select * into v_d from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id for update;
 if p_gtm_container_path!~'^accounts/[0-9]+/containers/[0-9]+$' or p_gtm_public_id!~'^GTM-[A-Z0-9]+$' or p_ga4_property_path!~'^properties/[0-9]+$' or p_ga4_stream_path!~'^properties/[0-9]+/dataStreams/[0-9]+$' or p_measurement_id!~'^G-[A-Z0-9]+$' or jsonb_typeof(p_evidence)<>'object' then raise exception 'invalid_created_stack' using errcode='22023';end if;
 if split_part(p_gtm_container_path,'/',2)<>split_part(p_gtm_account_path,'/',2) then raise exception 'gtm_account_mismatch' using errcode='22023';end if;
 insert into public.tracking_resources(agency_id,client_id,profile_id,resource_type,external_id,resource_path,status,ownership,metadata,last_verified_at) values
 (v_d.agency_id,v_d.client_id,v_d.profile_id,'gtm_account',split_part(p_gtm_account_path,'/',2),p_gtm_account_path,'configured','alastre',p_evidence,now()),
 (v_d.agency_id,v_d.client_id,v_d.profile_id,'gtm_container',p_gtm_public_id,p_gtm_container_path,'configured','alastre',p_evidence,now()),
 (v_d.agency_id,v_d.client_id,v_d.profile_id,'ga4_property',split_part(p_ga4_property_path,'/',2),p_ga4_property_path,'configured','alastre',p_evidence,now()),
 (v_d.agency_id,v_d.client_id,v_d.profile_id,'ga4_web_stream',split_part(p_ga4_stream_path,'/',4),p_ga4_stream_path,'configured','alastre',p_evidence||jsonb_build_object('measurement_id',p_measurement_id),now()),
 (v_d.agency_id,v_d.client_id,v_d.profile_id,'ga4_measurement',p_measurement_id,p_ga4_stream_path,'configured','alastre',p_evidence,now())
 on conflict(agency_id,client_id,resource_type,external_id) do update set resource_path=excluded.resource_path,status='configured',ownership='alastre',metadata=excluded.metadata,last_verified_at=now(),updated_at=now();
 update public.tracking_profiles set status='ready_to_apply',health='healthy',configuration=configuration||jsonb_build_object('resource_creation','completed','created_at',now()),updated_at=now() where id=v_d.profile_id;
 insert into public.tracking_validations(agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence) values(v_d.agency_id,v_d.client_id,v_d.profile_id,v_d.id,'preview','google_stack_creation','passed',p_evidence||jsonb_build_object('gtm_container_path',p_gtm_container_path,'ga4_stream_path',p_ga4_stream_path,'measurement_id',p_measurement_id));
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_d.agency_id,v_d.client_id,'tracking_missing_stack_created','tracking_deployment',v_d.id::text,p_evidence||jsonb_build_object('actor_id',p_actor_id,'approval_id',v_d.approval_id));
 return jsonb_build_object('deployment_id',v_d.id,'status','resources_ready','gtm_public_id',p_gtm_public_id,'measurement_id',p_measurement_id,'next_step','prepare_candidate');
end;$$;

revoke all on function public.platform_tracking_resource_creation_gate(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.platform_record_created_tracking_stack(uuid,uuid,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.platform_tracking_resource_creation_gate(uuid,uuid,text,text) to service_role;
grant execute on function public.platform_record_created_tracking_stack(uuid,uuid,text,text,text,text,text,text,text,jsonb) to service_role;
