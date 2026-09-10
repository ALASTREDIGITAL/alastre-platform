-- Approval-gated execution ledger. This stage may create an isolated GTM workspace,
-- but it can never create or publish a GTM version.

create table public.tracking_execution_runs(
 id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agencies(id) on delete restrict,client_id uuid not null references public.clients(id) on delete restrict,profile_id uuid not null references public.tracking_profiles(id) on delete cascade,deployment_id uuid not null references public.tracking_deployments(id) on delete cascade,approval_id uuid not null references public.approval_items(id) on delete restrict,config_hash text not null,status text not null default 'authorized' check(status in('authorized','creating_workspace','workspace_created','failed')),workspace_path text,steps jsonb not null default '[]'::jsonb check(jsonb_typeof(steps)='array'),last_error text,created_by_actor_id uuid not null references public.agency_actors(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(deployment_id,config_hash)
);
create index tracking_execution_runs_client_idx on public.tracking_execution_runs(client_id,created_at desc);
create index tracking_execution_runs_profile_idx on public.tracking_execution_runs(profile_id);
create index tracking_execution_runs_approval_idx on public.tracking_execution_runs(approval_id);
create index tracking_execution_runs_actor_idx on public.tracking_execution_runs(created_by_actor_id);
alter table public.tracking_execution_runs enable row level security;
revoke all on public.tracking_execution_runs from anon,authenticated;
create policy tracking_execution_runs_service_only on public.tracking_execution_runs for all to anon,authenticated using(false) with check(false);

create or replace function public.platform_begin_tracking_workspace_execution(p_actor_id uuid,p_deployment_id uuid,p_config_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_gate jsonb;v_d public.tracking_deployments%rowtype;v_run public.tracking_execution_runs%rowtype;v_gtm jsonb;
begin
 v_gate:=public.platform_tracking_execution_gate(p_actor_id,p_deployment_id,p_config_hash);
 select * into v_d from public.tracking_deployments where id=p_deployment_id for update;
 select manifest into v_gtm from public.tracking_candidate_artifacts where deployment_id=v_d.id and config_hash=p_config_hash and artifact_type='gtm_workspace_manifest' and status='ready';
 insert into public.tracking_execution_runs(agency_id,client_id,profile_id,deployment_id,approval_id,config_hash,status,steps,created_by_actor_id) values(v_d.agency_id,v_d.client_id,v_d.profile_id,v_d.id,(v_gate->>'approval_id')::uuid,p_config_hash,'creating_workspace',jsonb_build_array(jsonb_build_object('step','authorization','status','passed','at',now())),p_actor_id)
 on conflict(deployment_id,config_hash) do update set status=case when public.tracking_execution_runs.workspace_path is null then'creating_workspace'else public.tracking_execution_runs.status end,last_error=null,updated_at=now() returning * into v_run;
 return jsonb_build_object('run_id',v_run.id,'approval_id',v_run.approval_id,'deployment_id',v_d.id,'config_hash',p_config_hash,'workspace_path',v_run.workspace_path,'gtm',v_gtm,'publish_allowed',false);
end;$$;

create or replace function public.platform_record_tracking_workspace_execution(p_actor_id uuid,p_run_id uuid,p_workspace_path text,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_run public.tracking_execution_runs%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_run from public.tracking_execution_runs where id=p_run_id and agency_id=v_actor.agency_id for update;if not found then raise exception 'execution_not_found' using errcode='P0002';end if;
 if p_workspace_path!~'^accounts/[0-9]+/containers/[0-9]+/workspaces/[0-9]+$' or jsonb_typeof(p_evidence)<>'object' then raise exception 'invalid_workspace_evidence' using errcode='22023';end if;
 update public.tracking_execution_runs set status='workspace_created',workspace_path=p_workspace_path,steps=steps||jsonb_build_array(jsonb_build_object('step','create_workspace','status','completed','path',p_workspace_path,'at',now(),'evidence',p_evidence)),updated_at=now() where id=v_run.id;
 insert into public.tracking_resources(agency_id,client_id,profile_id,resource_type,external_id,resource_path,status,ownership,metadata,last_verified_at) values(v_run.agency_id,v_run.client_id,v_run.profile_id,'gtm_workspace',split_part(p_workspace_path,'/',6),p_workspace_path,'configured','alastre',p_evidence||jsonb_build_object('execution_run_id',v_run.id,'config_hash',v_run.config_hash,'published',false),now()) on conflict(agency_id,client_id,resource_type,external_id) do update set resource_path=excluded.resource_path,status='configured',metadata=excluded.metadata,last_verified_at=now(),updated_at=now();
 update public.tracking_deployments set status='provisioning',candidate_version=p_workspace_path,updated_at=now() where id=v_run.deployment_id;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_run.agency_id,v_run.client_id,'tracking_workspace_created','tracking_execution_run',v_run.id::text,jsonb_build_object('actor_id',p_actor_id,'workspace_path',p_workspace_path,'config_hash',v_run.config_hash,'published',false));
 return jsonb_build_object('run_id',v_run.id,'status','workspace_created','workspace_path',p_workspace_path,'published',false,'next_step','configure_components');
end;$$;

revoke all on function public.platform_begin_tracking_workspace_execution(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.platform_record_tracking_workspace_execution(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.platform_begin_tracking_workspace_execution(uuid,uuid,text) to service_role;
grant execute on function public.platform_record_tracking_workspace_execution(uuid,uuid,text,jsonb) to service_role;

create or replace function public.platform_tracking_workspace(p_actor_id uuid,p_client_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_actor public.agency_actors%rowtype;v_client public.clients%rowtype;v_profile public.tracking_profiles%rowtype;
begin select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found then raise exception 'actor_forbidden' using errcode='42501';end if;select * into v_client from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived';if not found then raise exception 'client_not_found' using errcode='P0002';end if;select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id;
return jsonb_build_object('client',jsonb_build_object('id',v_client.id,'name',v_client.name,'status',v_client.status),'profile',case when v_profile.id is null then null else to_jsonb(v_profile) end,'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.resource_type,r.created_at) from public.tracking_resources r where r.agency_id=v_actor.agency_id and r.client_id=p_client_id),'[]'::jsonb),'resource_candidates',coalesce((select jsonb_agg(to_jsonb(c) order by c.resource_type,c.selected desc,c.confidence desc,c.display_name) from public.tracking_resource_candidates c where c.agency_id=v_actor.agency_id and c.client_id=p_client_id and c.last_seen_at>now()-interval '30 days'),'[]'::jsonb),'deployments',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from(select * from public.tracking_deployments where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 10)d),'[]'::jsonb),'validations',coalesce((select jsonb_agg(to_jsonb(v) order by v.validated_at desc) from(select * from public.tracking_validations where agency_id=v_actor.agency_id and client_id=p_client_id order by validated_at desc limit 20)v),'[]'::jsonb),'candidates',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from(select * from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 12)a),'[]'::jsonb),'execution_runs',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from(select * from public.tracking_execution_runs where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 10)e),'[]'::jsonb),'external_write_mode','disabled');end;$$;
revoke all on function public.platform_tracking_workspace(uuid,uuid) from public,anon,authenticated;grant execute on function public.platform_tracking_workspace(uuid,uuid) to service_role;
