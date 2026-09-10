-- Marco 2: observabilidade e limites do AI Gateway.
-- O gateway nasce desativado; esta migration apenas prepara controle e auditoria.

create table public.ai_cost_policies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  agent_type text not null check (agent_type in ('all','seo_local','google_ads','reviewer')),
  provider text not null default 'all',
  monthly_limit_brl numeric(12,2) not null check (monthly_limit_brl >= 0),
  per_request_limit_brl numeric(12,4) not null check (per_request_limit_brl >= 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (agency_id, client_id, agent_type, provider)
);

create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  actor_id uuid not null references public.agency_actors(id) on delete restrict,
  thread_id uuid references public.agent_threads(id) on delete restrict,
  request_id uuid not null unique,
  agent_type text not null check (agent_type in ('seo_local','google_ads','reviewer')),
  provider text not null,
  model text not null,
  status text not null check (status in ('completed','failed','blocked_budget','fallback')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_brl numeric(12,6) not null default 0 check (cost_brl >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index ai_usage_events_agency_created_idx on public.ai_usage_events (agency_id, created_at desc);
create index ai_usage_events_client_created_idx on public.ai_usage_events (client_id, created_at desc);
create index ai_usage_events_thread_idx on public.ai_usage_events (thread_id) where thread_id is not null;
create index ai_cost_policies_agency_enabled_idx on public.ai_cost_policies (agency_id, enabled);

alter table public.ai_cost_policies enable row level security;
alter table public.ai_usage_events enable row level security;
revoke all on public.ai_cost_policies, public.ai_usage_events from anon, authenticated;
create policy ai_cost_policies_service_only on public.ai_cost_policies for all to anon, authenticated using (false) with check (false);
create policy ai_usage_events_service_only on public.ai_usage_events for all to anon, authenticated using (false) with check (false);

insert into public.ai_cost_policies (agency_id, client_id, agent_type, provider, monthly_limit_brl, per_request_limit_brl, enabled)
values ('a1a57e00-0000-4000-8000-000000000001', null, 'all', 'all', 100.00, 0.50, false)
on conflict (agency_id, client_id, agent_type, provider) do nothing;

create or replace function public.platform_record_ai_usage(
  p_actor_id uuid,
  p_client_id uuid,
  p_thread_id uuid,
  p_request_id uuid,
  p_agent_type text,
  p_provider text,
  p_model text,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_brl numeric,
  p_latency_ms integer,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor public.agency_actors%rowtype; v_id bigint;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and agency_id=v_actor.agency_id) then raise exception 'client_not_found' using errcode='P0002'; end if;
  if p_thread_id is not null and not exists(select 1 from public.agent_threads where id=p_thread_id and agency_id=v_actor.agency_id and client_id=p_client_id) then raise exception 'thread_not_found' using errcode='P0002'; end if;
  if p_agent_type not in ('seo_local','google_ads','reviewer') or p_status not in ('completed','failed','blocked_budget','fallback') or p_input_tokens<0 or p_output_tokens<0 or p_cost_brl<0 then raise exception 'invalid_usage' using errcode='22023'; end if;
  insert into public.ai_usage_events (agency_id,client_id,actor_id,thread_id,request_id,agent_type,provider,model,status,input_tokens,output_tokens,cost_brl,latency_ms,metadata)
  values (v_actor.agency_id,p_client_id,v_actor.id,p_thread_id,p_request_id,left(p_agent_type,40),left(p_provider,80),left(p_model,120),p_status,p_input_tokens,p_output_tokens,p_cost_brl,p_latency_ms,coalesce(p_metadata,'{}'::jsonb))
  on conflict (request_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.ai_usage_events where request_id=p_request_id and agency_id=v_actor.agency_id and client_id=p_client_id;
    if v_id is null then raise exception 'request_id_collision' using errcode='23505'; end if;
  end if;
  return jsonb_build_object('id',v_id,'request_id',p_request_id);
end;
$$;

revoke all on function public.platform_record_ai_usage(uuid,uuid,uuid,uuid,text,text,text,text,integer,integer,numeric,integer,jsonb) from public, anon, authenticated;
grant execute on function public.platform_record_ai_usage(uuid,uuid,uuid,uuid,text,text,text,text,integer,integer,numeric,integer,jsonb) to service_role;
