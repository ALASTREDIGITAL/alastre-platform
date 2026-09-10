-- TPS-3/TPS-5: deterministic tracking change plans and Human-in-the-Loop approval.
-- Approval advances internal state only. This migration cannot call or mutate Google APIs.

alter table public.approval_items drop constraint if exists approval_items_source_type_check;
alter table public.approval_items add constraint approval_items_source_type_check
  check (source_type in ('google_ads_campaign','tracking_deployment'));

create or replace function public.platform_build_tracking_change_plan(
  p_actor_id uuid, p_client_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.agency_actors%rowtype;
  v_profile public.tracking_profiles%rowtype;
  v_template public.tracking_templates%rowtype;
  v_deployment public.tracking_deployments%rowtype;
  v_existing jsonb;
  v_events jsonb;
  v_actions jsonb;
  v_has_gtm boolean;
  v_has_ga4 boolean;
  v_duplicate_count integer;
  v_plan jsonb;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived') then raise exception 'client_not_found' using errcode='P0002'; end if;
  select result into v_existing from public.platform_command_receipts where agency_id=v_actor.agency_id and idempotency_key=p_idempotency_key and command_type='tracking_change_plan';
  if v_existing is not null then return v_existing; end if;

  select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id for update;
  if not found or v_profile.template_key is null then raise exception 'tracking_profile_required' using errcode='P0002'; end if;
  select * into v_template from public.tracking_templates where agency_id=v_actor.agency_id and template_key=v_profile.template_key and version=v_profile.template_version and active;
  if not found then raise exception 'tracking_template_required' using errcode='P0002'; end if;

  v_events:=coalesce(v_template.manifest->'events','[]'::jsonb);
  if jsonb_typeof(v_events)<>'array' or jsonb_array_length(v_events)=0 then raise exception 'template_events_required' using errcode='22023'; end if;
  select count(*)-count(distinct value) into v_duplicate_count from jsonb_array_elements_text(v_events);
  v_has_gtm:=exists(select 1 from public.tracking_resources where agency_id=v_actor.agency_id and client_id=p_client_id and resource_type='gtm_container' and status<>'error');
  v_has_ga4:=exists(select 1 from public.tracking_resources where agency_id=v_actor.agency_id and client_id=p_client_id and resource_type in ('ga4_property','ga4_web_stream','ga4_measurement') and status<>'error');

  v_actions:=jsonb_build_array(
    jsonb_build_object('target','gtm_container','operation',case when v_has_gtm then 'reuse' else 'create_candidate' end,'external_write',false),
    jsonb_build_object('target','ga4_property','operation',case when v_has_ga4 then 'reuse' else 'create_candidate' end,'external_write',false),
    jsonb_build_object('target','events','operation','prepare_candidate','count',jsonb_array_length(v_events),'external_write',false),
    jsonb_build_object('target','legacy_resources','operation','observe_only','count',(select count(*) from public.tracking_resources where agency_id=v_actor.agency_id and client_id=p_client_id and resource_type='legacy_external_resource'),'external_write',false)
  );
  v_plan:=jsonb_build_object(
    'mode','approval_planning','template',jsonb_build_object('key',v_template.template_key,'version',v_template.version,'transport',v_template.transport),
    'desired_events',v_events,'actions',v_actions,
    'safety',jsonb_build_object('recursion_guard',coalesce((v_template.manifest->>'recursion_guard')::boolean,false),'duplicate_events',v_duplicate_count,'external_writes',false,'publish',false),
    'next_stage','human_approval'
  );
  insert into public.tracking_deployments (agency_id,client_id,profile_id,idempotency_key,status,decision,plan,config_hash,created_by_actor_id)
  values (v_actor.agency_id,p_client_id,v_profile.id,p_idempotency_key,'validating_preview',case when v_has_gtm and v_has_ga4 then 'reuse_existing_stack' else 'complete_missing_stack' end,v_plan,encode(sha256(convert_to(v_plan::text,'UTF8')),'hex'),v_actor.id)
  returning * into v_deployment;
  insert into public.tracking_validations (agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence)
  values (v_actor.agency_id,p_client_id,v_profile.id,v_deployment.id,'preview','deterministic_plan_validator',case when v_duplicate_count=0 and coalesce((v_template.manifest->>'recursion_guard')::boolean,false) then 'passed' else 'failed' end,jsonb_build_object('duplicate_events',v_duplicate_count,'recursion_guard',coalesce((v_template.manifest->>'recursion_guard')::boolean,false),'trigger_valid',coalesce(v_template.manifest->>'all_pages_trigger','native') in ('2147479553','native'),'external_writes',false));
  update public.tracking_deployments set status=case when v_duplicate_count=0 and coalesce((v_template.manifest->>'recursion_guard')::boolean,false) then 'planned' else 'failed' end,updated_at=now() where id=v_deployment.id returning * into v_deployment;
  update public.tracking_profiles set status=case when v_deployment.status='planned' then 'ready_to_apply' else 'failed' end,health=case when v_deployment.status='planned' then 'warning' else 'critical' end,updated_at=now() where id=v_profile.id;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload) values (v_actor.agency_id,p_client_id,'tracking_change_plan_built','tracking_deployment',v_deployment.id::text,jsonb_build_object('actor_id',v_actor.id,'status',v_deployment.status,'external_writes',false));
  v_result:=jsonb_build_object('deployment_id',v_deployment.id,'status',v_deployment.status,'decision',v_deployment.decision,'plan',v_plan);
  insert into public.platform_command_receipts values (v_actor.agency_id,p_idempotency_key,'tracking_change_plan',v_actor.id,v_result,now());
  return v_result;
end; $$;

create or replace function public.platform_request_tracking_approval(p_actor_id uuid,p_deployment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.agency_actors%rowtype; v_deployment public.tracking_deployments%rowtype; v_profile public.tracking_profiles%rowtype; v_item public.approval_items%rowtype;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  select * into v_deployment from public.tracking_deployments where id=p_deployment_id and agency_id=v_actor.agency_id for update;
  if not found then raise exception 'deployment_not_found' using errcode='P0002'; end if;
  if v_deployment.status not in ('planned','waiting_approval') then raise exception 'deployment_not_ready' using errcode='40001'; end if;
  if not exists(select 1 from public.tracking_validations where deployment_id=v_deployment.id and phase='preview' and status='passed') then raise exception 'preview_validation_required' using errcode='40001'; end if;
  select * into v_profile from public.tracking_profiles where id=v_deployment.profile_id and agency_id=v_actor.agency_id;
  insert into public.approval_items (agency_id,client_id,source_type,source_id,requested_by_email,status,snapshot)
  values (v_actor.agency_id,v_deployment.client_id,'tracking_deployment',v_deployment.id,v_actor.email,'pending',jsonb_build_object('name','Tracking · '||v_profile.domain,'domain',v_profile.domain,'platform',v_profile.platform,'industry',v_profile.industry,'decision',v_deployment.decision,'plan',v_deployment.plan,'external_writes',false,'approval_effect','release_apply_stage_only'))
  on conflict (source_type,source_id) do update set snapshot=excluded.snapshot
  returning * into v_item;
  update public.tracking_deployments set status='waiting_approval',approval_id=v_item.id,updated_at=now() where id=v_deployment.id;
  update public.tracking_profiles set status='waiting_approval',updated_at=now() where id=v_profile.id;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload) values (v_actor.agency_id,v_deployment.client_id,'tracking_approval_requested','approval_item',v_item.id::text,jsonb_build_object('actor_id',v_actor.id,'external_writes',false));
  return jsonb_build_object('approval_id',v_item.id,'deployment_id',v_deployment.id,'status',v_item.status,'external_writes',false);
end; $$;

create or replace function public.platform_decide_approval(p_actor_id uuid,p_approval_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.agency_actors%rowtype; v_item public.approval_items%rowtype;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected','changes_requested') then raise exception 'invalid_decision' using errcode='22023'; end if;
  select * into v_item from public.approval_items where id=p_approval_id and agency_id=v_actor.agency_id for update;
  if not found then raise exception 'approval_not_found' using errcode='P0002'; end if;
  if v_item.status=p_decision then return jsonb_build_object('id',v_item.id,'status',v_item.status); end if;
  if v_item.status<>'pending' then raise exception 'approval_not_pending' using errcode='40001'; end if;
  update public.approval_items set status=p_decision,decision_by_email=v_actor.email,decision_note=nullif(trim(p_note),''),decided_at=now() where id=v_item.id;
  if v_item.source_type='google_ads_campaign' then
    update public.google_ads_campaign_drafts set status=case when p_decision='changes_requested' then 'draft' else p_decision end,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
  elsif v_item.source_type='tracking_deployment' then
    update public.tracking_deployments set status=case when p_decision='approved' then 'approved' when p_decision='changes_requested' then 'planned' else 'failed' end,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
    update public.tracking_profiles set status=case when p_decision='approved' then 'approved' when p_decision='changes_requested' then 'ready_to_apply' else 'failed' end,updated_at=now() where agency_id=v_actor.agency_id and client_id=v_item.client_id;
  end if;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload) values (v_actor.agency_id,v_item.client_id,v_item.source_type||'_'||p_decision,'approval_item',v_item.id::text,jsonb_build_object('actor_id',v_actor.id,'mode','internal_release_only','external_writes',false,'note',nullif(trim(p_note),'')));
  return jsonb_build_object('id',v_item.id,'status',p_decision,'source_type',v_item.source_type,'external_writes',false);
end; $$;

revoke all on function public.platform_build_tracking_change_plan(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.platform_request_tracking_approval(uuid,uuid) from public, anon, authenticated;
revoke all on function public.platform_decide_approval(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.platform_build_tracking_change_plan(uuid,uuid,uuid) to service_role;
grant execute on function public.platform_request_tracking_approval(uuid,uuid) to service_role;
grant execute on function public.platform_decide_approval(uuid,uuid,text,text) to service_role;
