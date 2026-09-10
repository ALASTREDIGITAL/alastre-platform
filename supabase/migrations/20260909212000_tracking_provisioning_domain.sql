-- Tracking Provisioning Service V1: domain model and safe internal planning.
-- This migration does not call Google APIs and cannot publish external changes.

create table public.tracking_templates (
  agency_id uuid not null references public.agencies(id) on delete restrict,
  template_key text not null check (template_key ~ '^[a-z0-9_]+$'),
  version integer not null check (version > 0),
  platform text not null,
  industry text not null,
  transport text not null check (transport in ('native_google_tag','custom_html_gtag','platform_native')),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (agency_id, template_key, version)
);

create table public.tracking_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  platform text not null,
  industry text not null,
  template_key text,
  template_version integer,
  google_account_strategy text not null default 'alastre_central' check (google_account_strategy in ('alastre_central','client_owned')),
  status text not null default 'draft' check (status in ('draft','analyzing','ready_to_apply','waiting_approval','approved','applied','validated','published','failed','rollback_required')),
  health text not null default 'not_checked' check (health in ('not_checked','healthy','warning','critical')),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, client_id),
  foreign key (agency_id, template_key, template_version) references public.tracking_templates(agency_id, template_key, version) on delete restrict
);

create table public.tracking_resources (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  profile_id uuid not null references public.tracking_profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('gtm_account','gtm_container','gtm_workspace','gtm_version','ga4_property','ga4_web_stream','ga4_measurement','ga4_key_event','legacy_external_resource')),
  external_id text not null,
  resource_path text,
  status text not null default 'discovered' check (status in ('discovered','planned','configured','validated','published','legacy','error')),
  ownership text not null default 'unknown' check (ownership in ('alastre','client','external','unknown')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, client_id, resource_type, external_id)
);

create table public.tracking_deployments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  profile_id uuid not null references public.tracking_profiles(id) on delete restrict,
  idempotency_key uuid not null,
  status text not null default 'draft' check (status in ('draft','discovering','planned','provisioning','validating_preview','waiting_approval','approved','applied','production_pending_validation','production_validated','failed','rollback_required')),
  decision text,
  plan jsonb not null default '{}'::jsonb check (jsonb_typeof(plan) = 'object'),
  config_hash text,
  approval_id uuid references public.approval_items(id) on delete restrict,
  candidate_version text,
  previous_live_version text,
  published_at timestamptz,
  created_by_actor_id uuid not null references public.agency_actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, idempotency_key)
);

create table public.tracking_validations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  profile_id uuid not null references public.tracking_profiles(id) on delete cascade,
  deployment_id uuid references public.tracking_deployments(id) on delete cascade,
  phase text not null check (phase in ('discovery','preview','production')),
  validator text not null,
  status text not null check (status in ('pending','passed','warning','failed','manual_required')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  validated_at timestamptz not null default now()
);

create index tracking_profiles_agency_status_idx on public.tracking_profiles (agency_id, status);
create index tracking_resources_profile_type_idx on public.tracking_resources (profile_id, resource_type);
create index tracking_deployments_client_created_idx on public.tracking_deployments (client_id, created_at desc);
create index tracking_deployments_approval_idx on public.tracking_deployments (approval_id) where approval_id is not null;
create index tracking_validations_profile_created_idx on public.tracking_validations (profile_id, validated_at desc);
create index tracking_validations_deployment_idx on public.tracking_validations (deployment_id) where deployment_id is not null;

alter table public.tracking_templates enable row level security;
alter table public.tracking_profiles enable row level security;
alter table public.tracking_resources enable row level security;
alter table public.tracking_deployments enable row level security;
alter table public.tracking_validations enable row level security;

revoke all on public.tracking_templates, public.tracking_profiles, public.tracking_resources, public.tracking_deployments, public.tracking_validations from anon, authenticated;
create policy tracking_templates_service_only on public.tracking_templates for all to anon, authenticated using (false) with check (false);
create policy tracking_profiles_service_only on public.tracking_profiles for all to anon, authenticated using (false) with check (false);
create policy tracking_resources_service_only on public.tracking_resources for all to anon, authenticated using (false) with check (false);
create policy tracking_deployments_service_only on public.tracking_deployments for all to anon, authenticated using (false) with check (false);
create policy tracking_validations_service_only on public.tracking_validations for all to anon, authenticated using (false) with check (false);

create or replace function public.platform_tracking_workspace(p_actor_id uuid, p_client_id uuid)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare v_actor public.agency_actors%rowtype; v_client public.clients%rowtype; v_profile public.tracking_profiles%rowtype;
begin
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found then raise exception 'actor_forbidden' using errcode='42501'; end if;
  select * into v_client from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived';
  if not found then raise exception 'client_not_found' using errcode='P0002'; end if;
  select * into v_profile from public.tracking_profiles where agency_id=v_actor.agency_id and client_id=p_client_id;
  return jsonb_build_object(
    'client',jsonb_build_object('id',v_client.id,'name',v_client.name,'status',v_client.status),
    'profile',case when v_profile.id is null then null else to_jsonb(v_profile) end,
    'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.resource_type,r.created_at) from public.tracking_resources r where r.agency_id=v_actor.agency_id and r.client_id=p_client_id),'[]'::jsonb),
    'deployments',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from (select * from public.tracking_deployments where agency_id=v_actor.agency_id and client_id=p_client_id order by created_at desc limit 10) d),'[]'::jsonb),
    'validations',coalesce((select jsonb_agg(to_jsonb(v) order by v.validated_at desc) from (select * from public.tracking_validations where agency_id=v_actor.agency_id and client_id=p_client_id order by validated_at desc limit 20) v),'[]'::jsonb),
    'external_write_mode','disabled'
  );
end; $$;

create or replace function public.platform_prepare_tracking_plan(
  p_actor_id uuid, p_client_id uuid, p_idempotency_key uuid,
  p_domain text, p_platform text, p_industry text, p_template_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.agency_actors%rowtype; v_existing jsonb; v_profile public.tracking_profiles%rowtype; v_deployment public.tracking_deployments%rowtype; v_plan jsonb; v_template_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_actor from public.agency_actors where id=p_actor_id and active;
  if not found or v_actor.role not in ('owner','admin','operator') then raise exception 'actor_forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and agency_id=v_actor.agency_id and status<>'archived') then raise exception 'client_not_found' using errcode='P0002'; end if;
  select result into v_existing from public.platform_command_receipts where agency_id=v_actor.agency_id and idempotency_key=p_idempotency_key and command_type='tracking_plan';
  if v_existing is not null then return v_existing; end if;
  if lower(trim(p_domain)) !~ '^[a-z0-9.-]+\.[a-z]{2,}$' or length(trim(p_platform)) not between 2 and 60 or length(trim(p_industry)) not between 2 and 80 then raise exception 'invalid_tracking_input' using errcode='22023'; end if;
  select max(version) into v_template_version from public.tracking_templates where agency_id=v_actor.agency_id and template_key=p_template_key and active;
  if v_template_version is null then raise exception 'template_not_found' using errcode='P0002'; end if;
  insert into public.tracking_profiles (agency_id,client_id,domain,platform,industry,template_key,template_version,status,configuration)
  values (v_actor.agency_id,p_client_id,lower(trim(p_domain)),trim(p_platform),trim(p_industry),p_template_key,v_template_version,'analyzing',jsonb_build_object('reuse_existing',true,'create_ga4',true,'create_gtm',true,'publish_after_approval',true))
  on conflict (agency_id,client_id) do update set domain=excluded.domain,platform=excluded.platform,industry=excluded.industry,template_key=excluded.template_key,template_version=excluded.template_version,status='analyzing',updated_at=now()
  returning * into v_profile;
  v_plan=jsonb_build_object('mode','safe_read_only','decision','discovery_required','steps',jsonb_build_array('load_client_dna','inspect_core_integrations','discover_gtm','discover_ga4','detect_legacy_resources','validate_template','request_approval'),'external_writes',false);
  insert into public.tracking_deployments (agency_id,client_id,profile_id,idempotency_key,status,decision,plan,created_by_actor_id)
  values (v_actor.agency_id,p_client_id,v_profile.id,p_idempotency_key,'planned','discovery_required',v_plan,v_actor.id) returning * into v_deployment;
  insert into public.tracking_validations (agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence)
  values (v_actor.agency_id,p_client_id,v_profile.id,v_deployment.id,'discovery','alastre_core','pending',jsonb_build_object('reason','Google discovery adapter ainda não executado','external_writes',false));
  insert into public.audit_events (agency_id,client_id,action,target_type,target_id,payload)
  values (v_actor.agency_id,p_client_id,'tracking_plan_prepared','tracking_deployment',v_deployment.id::text,jsonb_build_object('actor_id',v_actor.id,'idempotency_key',p_idempotency_key,'write_mode','disabled'));
  v_existing=jsonb_build_object('deployment_id',v_deployment.id,'profile_id',v_profile.id,'status',v_deployment.status,'plan',v_plan);
  insert into public.platform_command_receipts values (v_actor.agency_id,p_idempotency_key,'tracking_plan',v_actor.id,v_existing,now());
  return v_existing;
end; $$;

revoke all on function public.platform_tracking_workspace(uuid,uuid) from public, anon, authenticated;
revoke all on function public.platform_prepare_tracking_plan(uuid,uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.platform_tracking_workspace(uuid,uuid) to service_role;
grant execute on function public.platform_prepare_tracking_plan(uuid,uuid,uuid,text,text,text,text) to service_role;

insert into public.tracking_templates (agency_id,template_key,version,platform,industry,transport,manifest)
select a.id,'real_estate_kenlo_v1',1,'kenlo','real_estate','custom_html_gtag',
  '{"events":["generate_lead","schedule_visit","whatsapp_click","phone_click","property_view","property_search","property_owner_lead"],"internal_event_namespace":"alastre_","all_pages_trigger":"2147479553","recursion_guard":true}'::jsonb
from public.agencies a where a.slug='alastre-digital'
on conflict do nothing;

insert into public.tracking_templates (agency_id,template_key,version,platform,industry,transport,manifest)
select a.id,'local_business_v1',1,'custom','local_business','native_google_tag',
  '{"events":["generate_lead","whatsapp_click","phone_click","form_submit","page_view"],"internal_event_namespace":"alastre_","recursion_guard":true}'::jsonb
from public.agencies a where a.slug='alastre-digital'
on conflict do nothing;

do $$
declare v_agency uuid; v_client uuid; v_actor uuid; v_profile uuid; v_deployment uuid;
begin
  select id into v_agency from public.agencies where slug='alastre-digital';
  select id into v_client from public.clients where agency_id=v_agency and name='Democrata Imóveis';
  select id into v_actor from public.agency_actors where agency_id=v_agency and active order by created_at limit 1;
  if v_agency is not null and v_client is not null and v_actor is not null then
    insert into public.tracking_profiles (agency_id,client_id,domain,platform,industry,template_key,template_version,status,health,configuration)
    values (v_agency,v_client,'democrataimoveis.com.br','kenlo','real_estate','real_estate_kenlo_v1',1,'published','healthy','{"transport":"custom_html_gtag","architecture":"direct_gtag_no_recursive_gtm_events"}'::jsonb)
    on conflict (agency_id,client_id) do update set status='published',health='healthy',updated_at=now() returning id into v_profile;
    if v_profile is null then select id into v_profile from public.tracking_profiles where agency_id=v_agency and client_id=v_client; end if;
    insert into public.tracking_resources (agency_id,client_id,profile_id,resource_type,external_id,resource_path,status,ownership,last_verified_at,metadata) values
      (v_agency,v_client,v_profile,'gtm_container','GTM-W79MCTKH','accounts/6087202560/containers/263676140','published','alastre',now(),'{}'),
      (v_agency,v_client,v_profile,'gtm_version','8','accounts/6087202560/containers/263676140/versions/8','validated','alastre',now(),'{"name":"ALASTRE - Tracking Kenlo v8"}'),
      (v_agency,v_client,v_profile,'ga4_property','553385936','properties/553385936','validated','alastre',now(),'{}'),
      (v_agency,v_client,v_profile,'ga4_web_stream','15749099256','properties/553385936/dataStreams/15749099256','validated','alastre',now(),'{"measurement_id":"G-V43QESLV0Q"}'),
      (v_agency,v_client,v_profile,'legacy_external_resource','GTM-MFNFXWV',null,'legacy','external',now(),'{"action":"observe_only"}'),
      (v_agency,v_client,v_profile,'legacy_external_resource','UA-30724194-1',null,'legacy','external',now(),'{"action":"observe_only"}'),
      (v_agency,v_client,v_profile,'legacy_external_resource','G-70W8CLL8QL',null,'legacy','external',now(),'{"action":"observe_only"}'),
      (v_agency,v_client,v_profile,'legacy_external_resource','G-H8WZ2JSBF6',null,'legacy','external',now(),'{"action":"observe_only"}')
    on conflict do nothing;
    insert into public.tracking_deployments (agency_id,client_id,profile_id,idempotency_key,status,decision,plan,config_hash,candidate_version,published_at,created_by_actor_id)
    values (v_agency,v_client,v_profile,gen_random_uuid(),'production_validated','reuse_validated_stack','{"source":"Democrata reference implementation","external_writes":false}','democrata-kenlo-v8','8',now(),v_actor)
    returning id into v_deployment;
    insert into public.tracking_validations (agency_id,client_id,profile_id,deployment_id,phase,validator,status,evidence)
    values (v_agency,v_client,v_profile,v_deployment,'production','manual_and_preview','passed','{"gtm_present":true,"measurement_id":"G-V43QESLV0Q","recursion_detected":false,"duplicate_events":false}'::jsonb);
  end if;
end $$;
