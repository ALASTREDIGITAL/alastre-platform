-- Tenant-scoped resource candidates discovered from Alastre's own Google connections.
-- Selection only links existing resources to a client; it never writes to Google.

create table public.tracking_resource_candidates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete cascade,
  profile_id uuid not null references public.tracking_profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('gtm_container','ga4_web_stream')),
  external_id text not null,
  resource_path text not null,
  display_name text not null,
  match_reason text not null,
  confidence smallint not null check (confidence between 0 and 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  selected boolean not null default false,
  selected_at timestamptz,
  selected_by_actor_id uuid references public.agency_actors(id) on delete restrict,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id,client_id,resource_type,external_id)
);

create index tracking_resource_candidates_client_idx on public.tracking_resource_candidates(client_id,resource_type,confidence desc);
create index tracking_resource_candidates_profile_idx on public.tracking_resource_candidates(profile_id);
create index tracking_resource_candidates_actor_idx on public.tracking_resource_candidates(selected_by_actor_id) where selected_by_actor_id is not null;
alter table public.tracking_resource_candidates enable row level security;
revoke all on public.tracking_resource_candidates from anon,authenticated;
create policy tracking_resource_candidates_service_only on public.tracking_resource_candidates for all to anon,authenticated using(false) with check(false);

create or replace function public.platform_record_tracking_resource_candidates(p_actor_id uuid,p_client_id uuid,p_candidates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_profile public.tracking_profiles%rowtype;v_item jsonb;v_count integer:=0;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;
 if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id for update;
 if not found then raise exception 'tracking_profile_not_found' using errcode='P0002';end if;
 if jsonb_typeof(p_candidates)<>'array' then raise exception 'invalid_candidates' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_candidates) loop
  if (v_item->>'resource_type') not in('gtm_container','ga4_web_stream') or length(trim(v_item->>'external_id')) not between 1 and 240 or length(trim(v_item->>'resource_path')) not between 3 and 500 or coalesce((v_item->>'confidence')::integer,-1) not between 0 and 100 then raise exception 'invalid_candidate' using errcode='22023';end if;
  if jsonb_typeof(v_item->'metadata')<>'object' or ((v_item->>'resource_type')='gtm_container' and (coalesce(v_item#>>'{metadata,account_id}','')='' or coalesce(v_item#>>'{metadata,account_path}','')='')) or ((v_item->>'resource_type')='ga4_web_stream' and (coalesce(v_item#>>'{metadata,property_id}','')='' or coalesce(v_item#>>'{metadata,property_path}','')='' or coalesce(v_item#>>'{metadata,measurement_id}','')='')) then raise exception 'invalid_candidate_metadata' using errcode='22023';end if;
  insert into public.tracking_resource_candidates(agency_id,client_id,profile_id,resource_type,external_id,resource_path,display_name,match_reason,confidence,metadata,last_seen_at)
  values(v_actor.agency_id,p_client_id,v_profile.id,v_item->>'resource_type',trim(v_item->>'external_id'),trim(v_item->>'resource_path'),left(coalesce(nullif(trim(v_item->>'display_name'),''),v_item->>'external_id'),180),left(coalesce(nullif(trim(v_item->>'match_reason'),''),'Disponível na conexão da agência'),180),(v_item->>'confidence')::smallint,coalesce(v_item->'metadata','{}'::jsonb),now())
  on conflict(agency_id,client_id,resource_type,external_id) do update set resource_path=excluded.resource_path,display_name=excluded.display_name,match_reason=excluded.match_reason,confidence=excluded.confidence,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();
  v_count:=v_count+1;
 end loop;
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_actor.agency_id,p_client_id,'tracking_resource_candidates_recorded','tracking_profile',v_profile.id::text,jsonb_build_object('actor_id',v_actor.id,'candidate_count',v_count,'external_writes',false));
 return jsonb_build_object('candidate_count',v_count,'external_writes',false);
end;$$;

create or replace function public.platform_select_tracking_resources(p_actor_id uuid,p_client_id uuid,p_idempotency_key uuid,p_gtm_candidate_id uuid,p_ga4_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_profile public.tracking_profiles%rowtype;v_gtm public.tracking_resource_candidates%rowtype;v_ga4 public.tracking_resource_candidates%rowtype;v_existing jsonb;v_result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
 select * into v_actor from public.agency_actors where id=p_actor_id and active;
 if not found or v_actor.role not in('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select result into v_existing from public.platform_command_receipts where agency_id=v_actor.agency_id and idempotency_key=p_idempotency_key and command_type='tracking_resource_selection';if v_existing is not null then return v_existing;end if;
 select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id for update;if not found then raise exception 'tracking_profile_not_found' using errcode='P0002';end if;
 select * into v_gtm from public.tracking_resource_candidates where id=p_gtm_candidate_id and agency_id=v_actor.agency_id and client_id=p_client_id and profile_id=v_profile.id and resource_type='gtm_container' for update;
 if not found then raise exception 'gtm_candidate_not_found' using errcode='P0002';end if;
 select * into v_ga4 from public.tracking_resource_candidates where id=p_ga4_candidate_id and agency_id=v_actor.agency_id and client_id=p_client_id and profile_id=v_profile.id and resource_type='ga4_web_stream' for update;
 if not found then raise exception 'ga4_candidate_not_found' using errcode='P0002';end if;
 update public.tracking_resource_candidates set selected=false,selected_at=null,selected_by_actor_id=null,updated_at=now() where agency_id=v_actor.agency_id and client_id=p_client_id and resource_type in('gtm_container','ga4_web_stream');
 update public.tracking_resource_candidates set selected=true,selected_at=now(),selected_by_actor_id=v_actor.id,updated_at=now() where id in(v_gtm.id,v_ga4.id);
 delete from public.tracking_resources where agency_id=v_actor.agency_id and client_id=p_client_id and resource_type in('gtm_account','gtm_container','ga4_property','ga4_web_stream','ga4_measurement') and status in('discovered','planned');
 insert into public.tracking_resources(agency_id,client_id,profile_id,resource_type,external_id,resource_path,status,ownership,metadata,last_verified_at) values
 (v_actor.agency_id,p_client_id,v_profile.id,'gtm_account',v_gtm.metadata->>'account_id',v_gtm.metadata->>'account_path','discovered','alastre',jsonb_build_object('selected_from_candidate',v_gtm.id),now()),
 (v_actor.agency_id,p_client_id,v_profile.id,'gtm_container',v_gtm.external_id,v_gtm.resource_path,'discovered','alastre',v_gtm.metadata||jsonb_build_object('selected_from_candidate',v_gtm.id),now()),
 (v_actor.agency_id,p_client_id,v_profile.id,'ga4_property',v_ga4.metadata->>'property_id',v_ga4.metadata->>'property_path','discovered','alastre',jsonb_build_object('selected_from_candidate',v_ga4.id),now()),
 (v_actor.agency_id,p_client_id,v_profile.id,'ga4_web_stream',v_ga4.external_id,v_ga4.resource_path,'discovered','alastre',v_ga4.metadata||jsonb_build_object('selected_from_candidate',v_ga4.id),now()),
 (v_actor.agency_id,p_client_id,v_profile.id,'ga4_measurement',v_ga4.metadata->>'measurement_id',v_ga4.resource_path,'discovered','alastre',jsonb_build_object('selected_from_candidate',v_ga4.id),now())
 on conflict(agency_id,client_id,resource_type,external_id) do update set resource_path=excluded.resource_path,status=excluded.status,ownership=excluded.ownership,metadata=excluded.metadata,last_verified_at=now(),updated_at=now();
 update public.tracking_profiles set status='ready_to_apply',health='healthy',configuration=configuration||jsonb_build_object('resource_selection','confirmed','selected_at',now()),updated_at=now() where id=v_profile.id;
 v_result:=jsonb_build_object('client_id',p_client_id,'gtm_container',v_gtm.external_id,'ga4_stream',v_ga4.external_id,'measurement_id',v_ga4.metadata->>'measurement_id','status','selected','external_writes',false);
 insert into public.audit_events(agency_id,client_id,action,target_type,target_id,payload) values(v_actor.agency_id,p_client_id,'tracking_resources_selected','tracking_profile',v_profile.id::text,v_result||jsonb_build_object('actor_id',v_actor.id));
 insert into public.platform_command_receipts values(v_actor.agency_id,p_idempotency_key,'tracking_resource_selection',v_actor.id,v_result,now());return v_result;
end;$$;

create or replace function public.platform_tracking_workspace(p_actor_id uuid,p_client_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_actor public.agency_actors%rowtype;v_client public.clients%rowtype;v_profile public.tracking_profiles%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;if not found then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_client from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived';if not found then raise exception 'client_not_found' using errcode='P0002';end if;
 select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id;
 return jsonb_build_object('client',jsonb_build_object('id',v_client.id,'name',v_client.name,'status',v_client.status),'profile',case when v_profile.id is null then null else to_jsonb(v_profile) end,'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.resource_type,r.created_at) from public.tracking_resources r where r.agency_id=v_actor.agency_id and r.client_id=p_client_id),'[]'::jsonb),'resource_candidates',coalesce((select jsonb_agg(to_jsonb(c) order by c.resource_type,c.selected desc,c.confidence desc,c.display_name) from public.tracking_resource_candidates c where c.agency_id=v_actor.agency_id and c.client_id=p_client_id and c.last_seen_at>now()-interval '30 days'),'[]'::jsonb),'deployments',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from(select * from public.tracking_deployments where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 10)d),'[]'::jsonb),'validations',coalesce((select jsonb_agg(to_jsonb(v) order by v.validated_at desc) from(select * from public.tracking_validations where agency_id=v_actor.agency_id and client_id=p_client_id order by validated_at desc limit 20)v),'[]'::jsonb),'candidates',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from(select * from public.tracking_candidate_artifacts where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 12)a),'[]'::jsonb),'external_write_mode','disabled');
end;$$;

revoke all on function public.platform_record_tracking_resource_candidates(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.platform_select_tracking_resources(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.platform_tracking_workspace(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_record_tracking_resource_candidates(uuid,uuid,jsonb) to service_role;
grant execute on function public.platform_select_tracking_resources(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.platform_tracking_workspace(uuid,uuid) to service_role;
