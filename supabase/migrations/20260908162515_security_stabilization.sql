-- Marco de estabilizacao: contexto de ator, comandos atomicos e idempotencia.
-- Esta migration nao habilita nenhuma escrita em plataformas externas.

create table public.agency_actors (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  email text not null check (email = lower(trim(email)) and char_length(email) between 5 and 320),
  display_name text,
  role text not null check (role in ('owner','admin','operator','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, email)
);

create table public.platform_command_receipts (
  agency_id uuid not null references public.agencies(id) on delete restrict,
  idempotency_key uuid not null,
  command_type text not null check (char_length(command_type) between 3 and 80),
  actor_id uuid not null references public.agency_actors(id) on delete restrict,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (agency_id, idempotency_key)
);

create index agency_actors_email_active_idx on public.agency_actors (email) where active;
create index platform_command_receipts_actor_created_idx on public.platform_command_receipts (actor_id, created_at desc);

alter table public.agency_actors enable row level security;
alter table public.platform_command_receipts enable row level security;
revoke all on public.agency_actors, public.platform_command_receipts from anon, authenticated;
create policy agency_actors_service_only on public.agency_actors for all to anon, authenticated using (false) with check (false);
create policy command_receipts_service_only on public.platform_command_receipts for all to anon, authenticated using (false) with check (false);

insert into public.agency_actors (agency_id, email, display_name, role)
values ('a1a57e00-0000-4000-8000-000000000001', 'ag.alastredigital@gmail.com', 'Alastre Digital', 'owner')
on conflict (agency_id, email) do update
set display_name = excluded.display_name, role = excluded.role, active = true, updated_at = now();

create or replace function public.platform_resolve_actor(p_email text)
returns table (actor_id uuid, agency_id uuid, role text)
language sql
security definer
set search_path = ''
stable
as $$
  select actor.id, actor.agency_id, actor.role
  from public.agency_actors actor
  join public.agencies agency on agency.id = actor.agency_id and agency.status = 'active'
  where actor.email = lower(trim(p_email)) and actor.active
  limit 1;
$$;

create or replace function public.platform_onboard_client(
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_profile jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.agency_actors%rowtype;
  v_existing jsonb;
  v_client_id uuid := gen_random_uuid();
  v_name text := trim(p_profile->>'name');
  v_segment text := trim(p_profile->>'segment');
  v_city text := trim(p_profile->>'city');
  v_slug text;
  v_result jsonb;
  v_source jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_actor from public.agency_actors where id = p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode = '42501'; end if;
  select result into v_existing from public.platform_command_receipts where agency_id = v_actor.agency_id and idempotency_key = p_idempotency_key and command_type = 'onboard_client';
  if v_existing is not null then return v_existing; end if;
  if coalesce(v_name, '') = '' or coalesce(v_segment, '') = '' or coalesce(v_city, '') = '' then raise exception 'required_fields' using errcode = '22023'; end if;
  v_slug := trim(both '-' from regexp_replace(translate(lower(v_name),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')) || '-' || left(v_client_id::text, 6);

  insert into public.clients (id, agency_id, name, slug, status)
  values (v_client_id, v_actor.agency_id, left(v_name,160), left(v_slug,100), 'active');

  insert into public.client_dna_profiles (client_id, agency_id, status, business_data, local_intelligence, paid_media_rules, source_summary, updated_by_email)
  values (
    v_client_id, v_actor.agency_id, 'draft',
    coalesce(p_profile->'business_data','{}'::jsonb) || jsonb_build_object('segment',v_segment,'city',v_city,'cities',jsonb_build_array(v_city)),
    coalesce(p_profile->'local_intelligence','{}'::jsonb) || jsonb_build_object('primary_city',v_city,'status','initial_diagnosis'),
    jsonb_build_object('external_write','blocked','approval_required',true),
    coalesce(p_profile->'source_summary','{}'::jsonb), v_actor.email
  );

  for v_source in select value from jsonb_array_elements(coalesce(p_profile->'sources','[]'::jsonb)) loop
    insert into public.client_intelligence_sources (agency_id, client_id, source_type, label, source_url, status, facts)
    values (v_actor.agency_id, v_client_id, v_source->>'source_type', v_source->>'label', nullif(v_source->>'source_url',''), coalesce(v_source->>'status','pending'), coalesce(v_source->'facts','{}'::jsonb));
  end loop;

  insert into public.audit_events (agency_id, client_id, action, target_type, target_id, payload)
  values (v_actor.agency_id, v_client_id, 'client_onboarded', 'client', v_client_id::text, jsonb_build_object('actor_id',v_actor.id,'idempotency_key',p_idempotency_key));
  v_result := jsonb_build_object('id',v_client_id,'name',left(v_name,160),'slug',left(v_slug,100));
  insert into public.platform_command_receipts values (v_actor.agency_id,p_idempotency_key,'onboard_client',v_actor.id,v_result,now());
  return v_result;
end;
$$;

create or replace function public.platform_set_dna_status(p_actor_id uuid, p_client_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.agency_actors%rowtype; v_updated timestamptz;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if p_status not in ('confirmed','needs_review') then raise exception 'invalid_status' using errcode='22023'; end if;
  update public.client_dna_profiles set status=p_status, updated_by_email=v_actor.email, updated_at=now()
  where client_id=p_client_id and agency_id=v_actor.agency_id returning updated_at into v_updated;
  if v_updated is null then raise exception 'client_not_found' using errcode='P0002'; end if;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload)
  values (v_actor.agency_id,p_client_id,case when p_status='confirmed' then 'client_dna_confirmed' else 'client_dna_review_requested' end,'client_dna_profile',p_client_id::text,jsonb_build_object('actor_id',v_actor.id));
  return jsonb_build_object('client_id',p_client_id,'status',p_status,'updated_at',v_updated);
end; $$;

create or replace function public.platform_record_conversation(
  p_actor_id uuid, p_client_id uuid, p_agent_type text, p_thread_id uuid,
  p_message text, p_input_mode text, p_reply text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.agency_actors%rowtype; v_thread uuid := p_thread_id;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if p_agent_type not in ('seo_local','google_ads') or p_input_mode not in ('text','voice') or length(trim(p_message)) not between 1 and 4000 or length(trim(p_reply)) not between 1 and 20000 then raise exception 'invalid_conversation' using errcode='22023'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived') then raise exception 'client_not_found' using errcode='P0002'; end if;
  if v_thread is null then
    insert into public.agent_threads (agency_id,client_id,agent_type,title,created_by_email) values (v_actor.agency_id,p_client_id,p_agent_type,left(trim(p_message),80),v_actor.email) returning id into v_thread;
  elsif not exists(select 1 from public.agent_threads where id=v_thread and agency_id=v_actor.agency_id and client_id=p_client_id and agent_type=p_agent_type) then
    raise exception 'thread_not_found' using errcode='P0002';
  end if;
  insert into public.agent_messages (thread_id,agency_id,client_id,role,content,input_mode,metadata) values
    (v_thread,v_actor.agency_id,p_client_id,'user',trim(p_message),p_input_mode,jsonb_build_object('channel','web')),
    (v_thread,v_actor.agency_id,p_client_id,'assistant',trim(p_reply),'system',jsonb_build_object('mode','demo','provider','rules','dna_used',true));
  update public.agent_threads set updated_at=now() where id=v_thread;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload) values (v_actor.agency_id,p_client_id,'agent_demo_response','agent_thread',v_thread::text,jsonb_build_object('actor_id',v_actor.id,'provider','rules'));
  return jsonb_build_object('thread_id',v_thread,'message',trim(p_reply),'mode','demo','provider','rules','agent_type',p_agent_type);
end; $$;

create or replace function public.platform_submit_google_ads(
  p_actor_id uuid, p_client_id uuid, p_idempotency_key uuid, p_daily_budget numeric, p_configuration jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.agency_actors%rowtype; v_existing jsonb; v_client_name text; v_draft public.google_ads_campaign_drafts%rowtype; v_approval public.approval_items%rowtype; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  select result into v_existing from public.platform_command_receipts where agency_id=v_actor.agency_id and idempotency_key=p_idempotency_key and command_type='submit_google_ads';
  if v_existing is not null then return v_existing; end if;
  select name into v_client_name from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived';
  if v_client_name is null then raise exception 'client_not_found' using errcode='P0002'; end if;
  if p_daily_budget <= 0 or jsonb_typeof(p_configuration)<>'object' then raise exception 'invalid_campaign' using errcode='22023'; end if;
  insert into public.google_ads_campaign_drafts (agency_id,client_id,created_by_email,name,status,daily_budget,configuration,idempotency_key)
  values (v_actor.agency_id,p_client_id,v_actor.email,'Pesquisa · '||v_client_name,'pending_approval',p_daily_budget,p_configuration,p_idempotency_key) returning * into v_draft;
  insert into public.approval_items (agency_id,client_id,source_type,source_id,requested_by_email,status,snapshot)
  values (v_actor.agency_id,p_client_id,'google_ads_campaign',v_draft.id,v_actor.email,'pending',jsonb_build_object('name',v_draft.name,'daily_budget',v_draft.daily_budget,'configuration',p_configuration)) returning * into v_approval;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload) values (v_actor.agency_id,p_client_id,'google_ads_draft_submitted','approval_item',v_approval.id::text,jsonb_build_object('actor_id',v_actor.id,'mode','simulation','draft_id',v_draft.id));
  v_result:=jsonb_build_object('draft',to_jsonb(v_draft),'approval',to_jsonb(v_approval));
  insert into public.platform_command_receipts values (v_actor.agency_id,p_idempotency_key,'submit_google_ads',v_actor.id,v_result,now());
  return v_result;
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
  update public.google_ads_campaign_drafts set status=case when p_decision='changes_requested' then 'draft' else p_decision end,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload) values (v_actor.agency_id,v_item.client_id,'google_ads_'||p_decision,'approval_item',v_item.id::text,jsonb_build_object('actor_id',v_actor.id,'mode','simulation','note',nullif(trim(p_note),'')));
  return jsonb_build_object('id',v_item.id,'status',p_decision);
end; $$;

revoke all on function public.platform_resolve_actor(text) from public, anon, authenticated;
revoke all on function public.platform_onboard_client(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.platform_set_dna_status(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.platform_record_conversation(uuid,uuid,text,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.platform_submit_google_ads(uuid,uuid,uuid,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.platform_decide_approval(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.platform_resolve_actor(text) to service_role;
grant execute on function public.platform_onboard_client(uuid,uuid,jsonb) to service_role;
grant execute on function public.platform_set_dna_status(uuid,uuid,text) to service_role;
grant execute on function public.platform_record_conversation(uuid,uuid,text,uuid,text,text,text) to service_role;
grant execute on function public.platform_submit_google_ads(uuid,uuid,uuid,numeric,jsonb) to service_role;
grant execute on function public.platform_decide_approval(uuid,uuid,text,text) to service_role;
