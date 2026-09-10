-- Marco 2: runtime provider-neutral do AI Gateway.

create or replace function public.platform_ai_budget_status(p_actor_id uuid, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_actor public.agency_actors%rowtype;
  v_policy public.ai_cost_policies%rowtype;
  v_spent numeric(12,6);
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived') then raise exception 'client_not_found' using errcode='P0002'; end if;
  select * into v_policy from public.ai_cost_policies
  where agency_id=v_actor.agency_id and client_id is null and agent_type='all' and provider='all' limit 1;
  select coalesce(sum(cost_brl),0) into v_spent from public.ai_usage_events
  where agency_id=v_actor.agency_id and created_at>=date_trunc('month',now());
  return jsonb_build_object(
    'enabled',coalesce(v_policy.enabled,false),
    'monthly_limit_brl',coalesce(v_policy.monthly_limit_brl,0),
    'per_request_limit_brl',coalesce(v_policy.per_request_limit_brl,0),
    'spent_brl',v_spent,
    'remaining_brl',greatest(coalesce(v_policy.monthly_limit_brl,0)-v_spent,0)
  );
end;
$$;

create or replace function public.platform_record_conversation_v2(
  p_actor_id uuid, p_client_id uuid, p_agent_type text, p_thread_id uuid,
  p_message text, p_input_mode text, p_reply text, p_provider text,
  p_model text, p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor public.agency_actors%rowtype; v_thread uuid:=p_thread_id;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if p_agent_type not in ('seo_local','google_ads') or p_input_mode not in ('text','voice') or length(trim(p_message)) not between 1 and 4000 or length(trim(p_reply)) not between 1 and 20000 then raise exception 'invalid_conversation' using errcode='22023'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived') then raise exception 'client_not_found' using errcode='P0002'; end if;
  if v_thread is null then
    insert into public.agent_threads (agency_id,client_id,agent_type,title,created_by_email)
    values (v_actor.agency_id,p_client_id,p_agent_type,left(trim(p_message),80),v_actor.email) returning id into v_thread;
  elsif not exists(select 1 from public.agent_threads where id=v_thread and agency_id=v_actor.agency_id and client_id=p_client_id and agent_type=p_agent_type) then
    raise exception 'thread_not_found' using errcode='P0002';
  end if;
  insert into public.agent_messages (thread_id,agency_id,client_id,role,content,input_mode,metadata) values
    (v_thread,v_actor.agency_id,p_client_id,'user',trim(p_message),p_input_mode,jsonb_build_object('channel','web','request_id',p_request_id)),
    (v_thread,v_actor.agency_id,p_client_id,'assistant',trim(p_reply),'system',jsonb_build_object('provider',left(p_provider,80),'model',left(p_model,120),'dna_used',true,'request_id',p_request_id));
  update public.agent_threads set updated_at=now() where id=v_thread;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload)
  values (v_actor.agency_id,p_client_id,'agent_response','agent_thread',v_thread::text,jsonb_build_object('actor_id',v_actor.id,'provider',left(p_provider,80),'model',left(p_model,120),'request_id',p_request_id));
  return jsonb_build_object('thread_id',v_thread,'message',trim(p_reply),'provider',left(p_provider,80),'model',left(p_model,120),'agent_type',p_agent_type,'request_id',p_request_id);
end;
$$;

revoke all on function public.platform_ai_budget_status(uuid,uuid) from public, anon, authenticated;
revoke all on function public.platform_record_conversation_v2(uuid,uuid,text,uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.platform_ai_budget_status(uuid,uuid) to service_role;
grant execute on function public.platform_record_conversation_v2(uuid,uuid,text,uuid,text,text,text,text,text,uuid) to service_role;
