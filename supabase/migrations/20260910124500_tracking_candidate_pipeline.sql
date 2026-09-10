-- TPS-4/TPS-6: candidate manifests, preview validation and execution gate.
-- No external API is called from the database.

create table public.tracking_candidate_artifacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  profile_id uuid not null references public.tracking_profiles(id) on delete cascade,
  deployment_id uuid not null references public.tracking_deployments(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('gtm_workspace_manifest','ga4_configuration_manifest','validation_report')),
  status text not null default 'draft' check (status in ('draft','ready','blocked','applied','superseded')),
  config_hash text not null,
  manifest jsonb not null check (jsonb_typeof(manifest)='object'),
  created_by_actor_id uuid not null references public.agency_actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_id,artifact_type,config_hash)
);
create index tracking_candidate_client_created_idx on public.tracking_candidate_artifacts(client_id,created_at desc);
alter table public.tracking_candidate_artifacts enable row level security;
revoke all on public.tracking_candidate_artifacts from anon,authenticated;
create policy tracking_candidate_service_only on public.tracking_candidate_artifacts for all to anon,authenticated using(false) with check(false);

create or replace function public.platform_prepare_tracking_candidate(p_actor_id uuid,p_deployment_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_d public.tracking_deployments%rowtype;v_p public.tracking_profiles%rowtype;v_t public.tracking_templates%rowtype;v_existing jsonb;v_events jsonb;v_gtm jsonb;v_ga4 jsonb;v_report jsonb;v_hash text;v_ready boolean;v_result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
 select * into v_actor from public.agency_actors where id=p_actor_id and active;
 if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select result into v_existing from public.platform_command_receipts where agency_id=v_actor.agency_id and idempotency_key=p_idempotency_key and command_type='tracking_candidate';if v_existing is not null then return v_existing;end if;
 select * into v_d from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id for update;
 if not found or v_d.status not in('planned','waiting_approval','approved') then raise exception 'deployment_not_eligible' using errcode='40001';end if;
 select * into v_p from public.tracking_profiles where id=v_d.profile_id and agency_id=v_actor.agency_id;
 select * into v_t from public.tracking_templates where agency_id=v_actor.agency_id and template_key=v_p.template_key and version=v_p.template_version and active;
 v_events:=coalesce(v_t.manifest->'events','[]'::jsonb);
 v_ready:=exists(select 1 from public.tracking_resources where profile_id=v_p.id and resource_type='gtm_container' and status<>'error') and exists(select 1 from public.tracking_resources where profile_id=v_p.id and resource_type in('ga4_property','ga4_web_stream','ga4_measurement') and status<>'error');
 v_gtm:=jsonb_build_object('name','ALASTRE · '||v_p.domain,'description','Workspace candidato gerenciado pela Plataforma Alastre','container_path',(select resource_path from public.tracking_resources where profile_id=v_p.id and resource_type='gtm_container' and status<>'error' order by updated_at desc limit 1),'variables',jsonb_build_array(jsonb_build_object('name','ALASTRE - GA4 Measurement ID','type','constant','value',coalesce((select external_id from public.tracking_resources where profile_id=v_p.id and resource_type='ga4_measurement' order by updated_at desc limit 1),'{{REQUIRED_MEASUREMENT_ID}}'))),'triggers',jsonb_build_array(jsonb_build_object('name','ALASTRE - All Pages','type','pageview'),jsonb_build_object('name','ALASTRE - Custom Events','type','custom_event','filter','^(generate_lead|whatsapp_click|phone_click|form_submit|page_view)$')),'tags',jsonb_build_array(jsonb_build_object('name','ALASTRE - Google Tag','type','googtag','trigger','ALASTRE - All Pages'),jsonb_build_object('name','ALASTRE - GA4 Event Router','type','gaawe','trigger','ALASTRE - Custom Events','events',v_events)),'publish',false,'external_writes',false);
 v_ga4:=jsonb_build_object('property_path',(select resource_path from public.tracking_resources where profile_id=v_p.id and resource_type='ga4_property' order by updated_at desc limit 1),'stream_path',(select resource_path from public.tracking_resources where profile_id=v_p.id and resource_type='ga4_web_stream' order by updated_at desc limit 1),'default_uri','https://'||v_p.domain,'key_events',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements_text(v_events) value where value in('generate_lead','schedule_visit','whatsapp_click','phone_click','form_submit','property_owner_lead')),'publish',false,'external_writes',false);
 v_report:=jsonb_build_object('container_selected',(v_gtm->>'container_path') is not null,'ga4_selected',(v_ga4->>'property_path') is not null,'event_count',jsonb_array_length(v_events),'duplicate_names',(select count(*)-count(distinct value) from jsonb_array_elements_text(v_events)),'invalid_event_names',(select count(*) from jsonb_array_elements_text(v_events) where value!~'^[a-z][a-z0-9_]{1,39}$'),'recursion_guard',coalesce((v_t.manifest->>'recursion_guard')::boolean,false),'hardcoded_credentials',false,'compiler_error',false,'ready_to_apply',v_ready,'publish',false);
 v_hash:=encode(sha256(convert_to((v_gtm||v_ga4||v_report)::text,'UTF8')),'hex');
 insert into public.tracking_candidate_artifacts(agency_id,client_id,profile_id,deployment_id,artifact_type,status,config_hash,manifest,created_by_actor_id) values
 (v_actor.agency_id,v_d.client_id,v_p.id,v_d.id,'gtm_workspace_manifest',case when v_ready then'ready'else'blocked'end,v_hash,v_gtm,v_actor.id),
 (v_actor.agency_id,v_d.client_id,v_p.id,v_d.id,'ga4_configuration_manifest',case when v_ready then'ready'else'blocked'end,v_hash,v_ga4,v_actor.id),
 (v_actor.agency_id,v_d.client_id,v_p.id,v_d.id,'validation_report',case when v_ready then'ready'else'blocked'end,v_hash,v_report,v_actor.id)
 on conflict(deployment_id,artifact_type,config_hash) do update set manifest=excluded.manifest,status=excluded.status,updated_at=now();
 insert into public.tracking_validations(agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence) values(v_actor.agency_id,v_d.client_id,v_p.id,v_d.id,'preview','candidate_manifest_validator',case when v_ready then'passed'else'manual_required'end,v_report);
 update public.approval_items set snapshot=snapshot||jsonb_build_object('candidate',jsonb_build_object('config_hash',v_hash,'gtm',v_gtm,'ga4',v_ga4,'validation',v_report)) where id=v_d.approval_id and agency_id=v_actor.agency_id;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_actor.agency_id,v_d.client_id,'tracking_candidate_prepared','tracking_deployment',v_d.id::text,jsonb_build_object('actor_id',v_actor.id,'config_hash',v_hash,'ready_to_apply',v_ready,'external_writes',false));
 v_result:=jsonb_build_object('deployment_id',v_d.id,'config_hash',v_hash,'status',case when v_ready then'ready'else'blocked'end,'validation',v_report,'gtm',v_gtm,'ga4',v_ga4,'external_writes',false);
 insert into public.platform_command_receipts values(v_actor.agency_id,p_idempotency_key,'tracking_candidate',v_actor.id,v_result,now());return v_result;
end;$$;

create or replace function public.platform_tracking_execution_gate(p_actor_id uuid,p_deployment_id uuid,p_config_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_d public.tracking_deployments%rowtype;v_a public.approval_items%rowtype;v_valid boolean;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_d from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'deployment_not_found' using errcode='P0002';end if;
 select * into v_a from public.approval_items where id=v_d.approval_id and agency_id=v_actor.agency_id and source_id=v_d.id and source_type='tracking_deployment';
 v_valid:=v_a.status='approved' and v_d.status='approved' and exists(select 1 from public.tracking_candidate_artifacts where deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='validation_report' and status='ready' and (manifest->>'ready_to_apply')::boolean);
 if not coalesce(v_valid,false) then raise exception 'tracking_execution_locked' using errcode='42501';end if;
 return jsonb_build_object('allowed',true,'approval_id',v_a.id,'deployment_id',v_d.id,'config_hash',p_config_hash,'publish_allowed',false);
end;$$;

create or replace function public.platform_record_tracking_application(p_actor_id uuid,p_deployment_id uuid,p_config_hash text,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_gate jsonb;v_d public.tracking_deployments%rowtype;
begin
 v_gate:=public.platform_tracking_execution_gate(p_actor_id,p_deployment_id,p_config_hash);select * into v_d from public.tracking_deployments where id=p_deployment_id for update;
 update public.tracking_candidate_artifacts set status='applied',updated_at=now() where deployment_id=v_d.id and config_hash=p_config_hash;
 update public.tracking_deployments set status='applied',candidate_version=p_evidence->>'candidate_version',updated_at=now() where id=v_d.id;
 update public.tracking_profiles set status='applied',health='warning',updated_at=now() where id=v_d.profile_id;
 insert into public.tracking_validations(agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence) values(v_d.agency_id,v_d.client_id,v_d.profile_id,v_d.id,'preview','google_candidate_apply','manual_required',p_evidence||jsonb_build_object('published',false));
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_d.agency_id,v_d.client_id,'tracking_candidate_applied','tracking_deployment',v_d.id::text,p_evidence||jsonb_build_object('actor_id',p_actor_id,'config_hash',p_config_hash,'published',false));
 return jsonb_build_object('deployment_id',v_d.id,'status','applied','published',false,'validation_required',true);
end;$$;

revoke all on function public.platform_prepare_tracking_candidate(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.platform_tracking_execution_gate(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.platform_record_tracking_application(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.platform_prepare_tracking_candidate(uuid,uuid,uuid) to service_role;
grant execute on function public.platform_tracking_execution_gate(uuid,uuid,text) to service_role;
grant execute on function public.platform_record_tracking_application(uuid,uuid,text,jsonb) to service_role;

create or replace function public.platform_tracking_workspace(p_actor_id uuid,p_client_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_actor public.agency_actors%rowtype;v_client public.clients%rowtype;v_profile public.tracking_profiles%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_client from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived';if not found then raise exception 'client_not_found' using errcode='P0002';end if;
 select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id;
 return jsonb_build_object('client',jsonb_build_object('id',v_client.id,'name',v_client.name,'status',v_client.status),'profile',case when v_profile.id is null then null else to_jsonb(v_profile) end,'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.resource_type,r.created_at) from public.tracking_resources r where r.agency_id=v_actor.agency_id and r.client_id=p_client_id),'[]'::jsonb),'deployments',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from(select * from public.tracking_deployments where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 10)d),'[]'::jsonb),'validations',coalesce((select jsonb_agg(to_jsonb(v) order by v.validated_at desc) from(select * from public.tracking_validations where agency_id=v_actor.agency_id and client_id=p_client_id order by validated_at desc limit 20)v),'[]'::jsonb),'candidates',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from(select * from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 12)a),'[]'::jsonb),'external_write_mode','disabled');
end;$$;
revoke all on function public.platform_tracking_workspace(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_tracking_workspace(uuid,uuid) to service_role;
