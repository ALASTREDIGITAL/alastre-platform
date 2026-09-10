-- Read-only Google preflight bound to the exact candidate hash.

create or replace function public.platform_tracking_preflight_context(p_actor_id uuid,p_deployment_id uuid,p_config_hash text)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_actor public.agency_actors%rowtype;v_d public.tracking_deployments%rowtype;v_gtm jsonb;v_ga4 jsonb;v_report jsonb;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;
 if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_d from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id;
 if not found then raise exception 'deployment_not_found' using errcode='P0002';end if;
 select manifest into v_gtm from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='gtm_workspace_manifest' and status='ready';
 select manifest into v_ga4 from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='ga4_configuration_manifest' and status='ready';
 select manifest into v_report from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='validation_report' and status='ready';
 if v_gtm is null or v_ga4 is null or v_report is null then raise exception 'candidate_not_ready' using errcode='40001';end if;
 return jsonb_build_object('deployment_id',v_d.id,'client_id',v_d.client_id,'config_hash',p_config_hash,'gtm',v_gtm,'ga4',v_ga4,'validation',v_report,'external_writes',false);
end;$$;

create or replace function public.platform_record_tracking_preflight(p_actor_id uuid,p_deployment_id uuid,p_config_hash text,p_idempotency_key uuid,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_d public.tracking_deployments%rowtype;v_existing jsonb;v_passed boolean;v_result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
 select * into v_actor from public.agency_actors where id=p_actor_id and active;
 if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select result into v_existing from public.platform_command_receipts where agency_id=v_actor.agency_id and idempotency_key=p_idempotency_key and command_type='tracking_live_preflight';if v_existing is not null then return v_existing;end if;
 select * into v_d from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'deployment_not_found' using errcode='P0002';end if;
 if not exists(select 1 from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='validation_report' and status='ready') then raise exception 'candidate_not_ready' using errcode='40001';end if;
 if jsonb_typeof(p_evidence)<>'object' then raise exception 'invalid_preflight_evidence' using errcode='22023';end if;
 v_passed:=coalesce((p_evidence->>'passed')::boolean,false) and coalesce((p_evidence->>'external_writes')::boolean,true)=false;
 update public.tracking_candidate_artifacts set manifest=manifest||jsonb_build_object('live_preflight',p_evidence),updated_at=now() where agency_id=v_actor.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='validation_report';
 insert into public.tracking_validations(agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence) values(v_d.agency_id,v_d.client_id,v_d.profile_id,v_d.id,'preview','google_live_preflight',case when v_passed then'passed'else'warning'end,p_evidence||jsonb_build_object('config_hash',p_config_hash,'external_writes',false));
 v_result:=jsonb_build_object('deployment_id',v_d.id,'config_hash',p_config_hash,'status',case when v_passed then'passed'else'warning'end,'evidence',p_evidence,'external_writes',false);
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_d.agency_id,v_d.client_id,'tracking_live_preflight_recorded','tracking_deployment',v_d.id::text,v_result||jsonb_build_object('actor_id',v_actor.id));
 insert into public.platform_command_receipts values(v_actor.agency_id,p_idempotency_key,'tracking_live_preflight',v_actor.id,v_result,now());return v_result;
end;$$;

revoke all on function public.platform_tracking_preflight_context(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.platform_record_tracking_preflight(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.platform_tracking_preflight_context(uuid,uuid,text) to service_role;
grant execute on function public.platform_record_tracking_preflight(uuid,uuid,text,uuid,jsonb) to service_role;
