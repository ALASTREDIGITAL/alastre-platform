-- Complete, approval-gated GTM/GA4 lifecycle.
-- Staging writes stay isolated in a GTM workspace. Publishing requires a second approval.

alter table public.approval_items drop constraint if exists approval_items_source_type_check;
alter table public.approval_items add constraint approval_items_source_type_check
  check (source_type in ('google_ads_campaign','tracking_deployment','tracking_publication'));

alter table public.tracking_execution_runs
  add column if not exists version_path text,
  add column if not exists publish_approval_id uuid references public.approval_items(id) on delete restrict,
  add column if not exists published_at timestamptz;

alter table public.tracking_execution_runs drop constraint if exists tracking_execution_runs_status_check;
alter table public.tracking_execution_runs add constraint tracking_execution_runs_status_check
  check(status in('authorized','creating_workspace','workspace_created','configuring','version_created','waiting_publish_approval','publish_approved','published','production_validated','failed'));

create index if not exists tracking_execution_runs_publish_approval_idx
  on public.tracking_execution_runs(publish_approval_id) where publish_approval_id is not null;

create or replace function public.platform_begin_tracking_workspace_execution(p_actor_id uuid,p_deployment_id uuid,p_config_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_gate jsonb;v_d public.tracking_deployments%rowtype;v_run public.tracking_execution_runs%rowtype;v_gtm jsonb;v_ga4 jsonb;
begin
 v_gate:=public.platform_tracking_execution_gate(p_actor_id,p_deployment_id,p_config_hash);
 select * into v_d from public.tracking_deployments where id=p_deployment_id for update;
 select manifest into v_gtm from public.tracking_candidate_artifacts where agency_id=v_d.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='gtm_workspace_manifest' and status in('ready','applied');
 select manifest into v_ga4 from public.tracking_candidate_artifacts where agency_id=v_d.agency_id and deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='ga4_configuration_manifest' and status in('ready','applied');
 if v_gtm is null or v_ga4 is null then raise exception 'candidate_manifest_missing' using errcode='P0002';end if;
 insert into public.tracking_execution_runs(agency_id,client_id,profile_id,deployment_id,approval_id,config_hash,status,steps,created_by_actor_id)
 values(v_d.agency_id,v_d.client_id,v_d.profile_id,v_d.id,(v_gate->>'approval_id')::uuid,p_config_hash,'creating_workspace',jsonb_build_array(jsonb_build_object('step','authorization','status','passed','at',now())),p_actor_id)
 on conflict(deployment_id,config_hash) do update set status=case when public.tracking_execution_runs.status='failed' and public.tracking_execution_runs.workspace_path is null then'creating_workspace'else public.tracking_execution_runs.status end,last_error=null,updated_at=now() returning * into v_run;
 return jsonb_build_object('run_id',v_run.id,'approval_id',v_run.approval_id,'deployment_id',v_d.id,'config_hash',p_config_hash,'status',v_run.status,'workspace_path',v_run.workspace_path,'version_path',v_run.version_path,'publish_approval_id',v_run.publish_approval_id,'gtm',v_gtm,'ga4',v_ga4,'publish_allowed',false);
end;$$;

create or replace function public.platform_record_tracking_staging(p_actor_id uuid,p_run_id uuid,p_workspace_path text,p_version_path text,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_run public.tracking_execution_runs%rowtype;v_d public.tracking_deployments%rowtype;v_item jsonb;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_run from public.tracking_execution_runs where id=p_run_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'execution_not_found' using errcode='P0002';end if;
 if p_workspace_path!~'^accounts/[0-9]+/containers/[0-9]+/workspaces/[0-9]+$' or p_version_path!~'^accounts/[0-9]+/containers/[0-9]+/versions/[0-9]+$' or jsonb_typeof(p_evidence)<>'object' then raise exception 'invalid_staging_evidence' using errcode='22023';end if;
 if split_part(p_workspace_path,'/',2)<>split_part(p_version_path,'/',2) or split_part(p_workspace_path,'/',4)<>split_part(p_version_path,'/',4) then raise exception 'version_container_mismatch' using errcode='22023';end if;
 update public.tracking_execution_runs set status='version_created',workspace_path=p_workspace_path,version_path=p_version_path,steps=steps||jsonb_build_array(jsonb_build_object('step','configure_components','status','completed','at',now(),'evidence',p_evidence),jsonb_build_object('step','create_version','status','completed','path',p_version_path,'at',now())),updated_at=now() where id=v_run.id returning * into v_run;
 select * into v_d from public.tracking_deployments where id=v_run.deployment_id and agency_id=v_actor.agency_id for update;
 insert into public.tracking_resources(agency_id,client_id,profile_id,resource_type,external_id,resource_path,status,ownership,metadata,last_verified_at)
 values(v_run.agency_id,v_run.client_id,v_run.profile_id,'gtm_workspace',split_part(p_workspace_path,'/',6),p_workspace_path,'configured','alastre',jsonb_build_object('execution_run_id',v_run.id,'config_hash',v_run.config_hash,'published',false),now()),
 (v_run.agency_id,v_run.client_id,v_run.profile_id,'gtm_version',split_part(p_version_path,'/',6),p_version_path,'configured','alastre',p_evidence||jsonb_build_object('execution_run_id',v_run.id,'config_hash',v_run.config_hash,'published',false),now())
 on conflict(agency_id,client_id,resource_type,external_id) do update set resource_path=excluded.resource_path,status=excluded.status,metadata=excluded.metadata,last_verified_at=now(),updated_at=now();
 update public.tracking_candidate_artifacts set status='applied',updated_at=now() where agency_id=v_run.agency_id and deployment_id=v_run.deployment_id and config_hash=v_run.config_hash;
 update public.tracking_deployments set status='applied',candidate_version=p_version_path,updated_at=now() where id=v_run.deployment_id;
 update public.tracking_profiles set status='applied',health='warning',updated_at=now() where id=v_run.profile_id;
 insert into public.tracking_validations(agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence) values(v_run.agency_id,v_run.client_id,v_run.profile_id,v_run.deployment_id,'preview','google_workspace_compiler','passed',p_evidence||jsonb_build_object('workspace_path',p_workspace_path,'version_path',p_version_path,'published',false));
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_run.agency_id,v_run.client_id,'tracking_staging_completed','tracking_execution_run',v_run.id::text,p_evidence||jsonb_build_object('actor_id',p_actor_id,'config_hash',v_run.config_hash,'version_path',p_version_path,'published',false));
 return jsonb_build_object('run_id',v_run.id,'status','version_created','workspace_path',p_workspace_path,'version_path',p_version_path,'published',false,'next_step','request_publish_approval');
end;$$;

create or replace function public.platform_request_tracking_publish_approval(p_actor_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_run public.tracking_execution_runs%rowtype;v_item public.approval_items%rowtype;v_profile public.tracking_profiles%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_run from public.tracking_execution_runs where id=p_run_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'execution_not_found' using errcode='P0002';end if;
 if v_run.status not in('version_created','waiting_publish_approval','publish_approved') or v_run.version_path is null then raise exception 'version_not_ready' using errcode='40001';end if;
 select * into v_profile from public.tracking_profiles where id=v_run.profile_id and agency_id=v_actor.agency_id;
 insert into public.approval_items(agency_id,client_id,source_type,source_id,requested_by_email,status,snapshot)
 values(v_actor.agency_id,v_run.client_id,'tracking_publication',v_run.id,v_actor.email,'pending',jsonb_build_object('name','Publicar tracking · '||v_profile.domain,'domain',v_profile.domain,'config_hash',v_run.config_hash,'workspace_path',v_run.workspace_path,'version_path',v_run.version_path,'approval_effect','publish_exact_gtm_version','external_write',true))
 on conflict(source_type,source_id) do update set snapshot=excluded.snapshot returning * into v_item;
 update public.tracking_execution_runs set status=case when v_item.status='approved' then'publish_approved'else'waiting_publish_approval'end,publish_approval_id=v_item.id,updated_at=now() where id=v_run.id;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_run.agency_id,v_run.client_id,'tracking_publish_approval_requested','approval_item',v_item.id::text,jsonb_build_object('actor_id',p_actor_id,'config_hash',v_run.config_hash,'version_path',v_run.version_path));
 return jsonb_build_object('run_id',v_run.id,'approval_id',v_item.id,'status',v_item.status,'version_path',v_run.version_path);
end;$$;

create or replace function public.platform_begin_tracking_publish(p_actor_id uuid,p_run_id uuid,p_config_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_run public.tracking_execution_runs%rowtype;v_item public.approval_items%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_run from public.tracking_execution_runs where id=p_run_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'execution_not_found' using errcode='P0002';end if;
 if v_run.config_hash<>p_config_hash or v_run.status not in('publish_approved','published','production_validated') or v_run.version_path is null then raise exception 'publication_locked' using errcode='42501';end if;
 select * into v_item from public.approval_items where id=v_run.publish_approval_id and agency_id=v_actor.agency_id and client_id=v_run.client_id and source_type='tracking_publication' and source_id=v_run.id;
 if not found or v_item.status<>'approved' or v_item.snapshot->>'config_hash'<>v_run.config_hash or v_item.snapshot->>'version_path'<>v_run.version_path then raise exception 'publish_approval_mismatch' using errcode='42501';end if;
 return jsonb_build_object('run_id',v_run.id,'approval_id',v_item.id,'config_hash',v_run.config_hash,'version_path',v_run.version_path,'already_published',v_run.status in('published','production_validated'),'publish_allowed',true);
end;$$;

create or replace function public.platform_record_tracking_publication(p_actor_id uuid,p_run_id uuid,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_run public.tracking_execution_runs%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_run from public.tracking_execution_runs where id=p_run_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'execution_not_found' using errcode='P0002';end if;
 perform public.platform_begin_tracking_publish(p_actor_id,p_run_id,v_run.config_hash);
 if jsonb_typeof(p_evidence)<>'object' or coalesce((p_evidence->>'published')::boolean,false) is not true then raise exception 'invalid_publication_evidence' using errcode='22023';end if;
 update public.tracking_execution_runs set status='published',published_at=now(),steps=steps||jsonb_build_array(jsonb_build_object('step','publish_version','status','completed','at',now(),'evidence',p_evidence)),updated_at=now() where id=v_run.id;
 update public.tracking_resources set status='published',metadata=metadata||jsonb_build_object('published',true,'publication_evidence',p_evidence),last_verified_at=now(),updated_at=now() where agency_id=v_run.agency_id and client_id=v_run.client_id and resource_type='gtm_version' and resource_path=v_run.version_path;
 update public.tracking_deployments set status='production_pending_validation',published_at=now(),updated_at=now() where id=v_run.deployment_id;
 update public.tracking_profiles set status='published',health='warning',updated_at=now() where id=v_run.profile_id;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_run.agency_id,v_run.client_id,'tracking_version_published','tracking_execution_run',v_run.id::text,p_evidence||jsonb_build_object('actor_id',p_actor_id,'config_hash',v_run.config_hash,'version_path',v_run.version_path));
 return jsonb_build_object('run_id',v_run.id,'status','published','published',true,'next_step','production_validation');
end;$$;

create or replace function public.platform_record_tracking_production_validation(p_actor_id uuid,p_run_id uuid,p_status text,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_run public.tracking_execution_runs%rowtype;v_validation_status text;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_run from public.tracking_execution_runs where id=p_run_id and agency_id=v_actor.agency_id for update;if not found or v_run.status not in('published','production_validated') then raise exception 'publication_required' using errcode='40001';end if;
 if p_status not in('passed','warning','failed','manual_required') or jsonb_typeof(p_evidence)<>'object' then raise exception 'invalid_validation' using errcode='22023';end if;
 v_validation_status:=p_status;
 insert into public.tracking_validations(agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence) values(v_run.agency_id,v_run.client_id,v_run.profile_id,v_run.deployment_id,'production','google_tracking_post_publish',v_validation_status,p_evidence);
 if p_status='passed' then
  update public.tracking_execution_runs set status='production_validated',steps=steps||jsonb_build_array(jsonb_build_object('step','production_validation','status','passed','at',now(),'evidence',p_evidence)),updated_at=now() where id=v_run.id;
  update public.tracking_deployments set status='production_validated',updated_at=now() where id=v_run.deployment_id;
  update public.tracking_profiles set status='validated',health='healthy',updated_at=now() where id=v_run.profile_id;
 end if;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_run.agency_id,v_run.client_id,'tracking_production_validation_recorded','tracking_execution_run',v_run.id::text,p_evidence||jsonb_build_object('actor_id',p_actor_id,'status',p_status));
 return jsonb_build_object('run_id',v_run.id,'status',case when p_status='passed' then'production_validated'else p_status end,'validation_status',p_status);
end;$$;

create or replace function public.platform_decide_approval(p_actor_id uuid,p_approval_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_item public.approval_items%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 if p_decision not in('approved','rejected','changes_requested') then raise exception 'invalid_decision' using errcode='22023';end if;
 select * into v_item from public.approval_items where id=p_approval_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'approval_not_found' using errcode='P0002';end if;
 if v_item.status=p_decision then return jsonb_build_object('id',v_item.id,'status',v_item.status);end if;
 if v_item.status<>'pending' then raise exception 'approval_not_pending' using errcode='40001';end if;
 update public.approval_items set status=p_decision,decision_by_email=v_actor.email,decision_note=nullif(trim(p_note),''),decided_at=now() where id=v_item.id;
 if v_item.source_type='google_ads_campaign' then
  update public.google_ads_campaign_drafts set status=case when p_decision='changes_requested' then'draft'else p_decision end,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
 elsif v_item.source_type='tracking_deployment' then
  update public.tracking_deployments set status=case when p_decision='approved' then'approved'when p_decision='changes_requested' then'planned'else'failed'end,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
  update public.tracking_profiles set status=case when p_decision='approved' then'approved'when p_decision='changes_requested' then'ready_to_apply'else'failed'end,updated_at=now() where agency_id=v_actor.agency_id and client_id=v_item.client_id;
 elsif v_item.source_type='tracking_publication' then
  update public.tracking_execution_runs set status=case when p_decision='approved' then'publish_approved'when p_decision='changes_requested' then'version_created'else'failed'end,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
 end if;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_actor.agency_id,v_item.client_id,v_item.source_type||'_'||p_decision,'approval_item',v_item.id::text,jsonb_build_object('actor_id',v_actor.id,'external_writes',v_item.source_type='tracking_publication','note',nullif(trim(p_note),'')));
 return jsonb_build_object('id',v_item.id,'status',p_decision,'source_type',v_item.source_type);
end;$$;

revoke all on function public.platform_begin_tracking_workspace_execution(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.platform_record_tracking_staging(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.platform_request_tracking_publish_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.platform_begin_tracking_publish(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.platform_record_tracking_publication(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.platform_record_tracking_production_validation(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.platform_decide_approval(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.platform_begin_tracking_workspace_execution(uuid,uuid,text) to service_role;
grant execute on function public.platform_record_tracking_staging(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.platform_request_tracking_publish_approval(uuid,uuid) to service_role;
grant execute on function public.platform_begin_tracking_publish(uuid,uuid,text) to service_role;
grant execute on function public.platform_record_tracking_publication(uuid,uuid,jsonb) to service_role;
grant execute on function public.platform_record_tracking_production_validation(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.platform_decide_approval(uuid,uuid,text,text) to service_role;
