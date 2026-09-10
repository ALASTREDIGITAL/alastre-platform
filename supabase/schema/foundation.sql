-- Marco 1: fundação multiempresa, RLS e auditoria.
-- Aplicado no projeto isolado Alastre Platform Homologação.

create extension if not exists pgcrypto;

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'paused', 'archived')),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, slug)
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  platform text not null check (platform in ('google_ads', 'gtm', 'meta_ads', 'ga4', 'google_business_profile')),
  external_account_id text,
  secret_name text,
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected', 'error', 'revoked')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (agency_id, client_id, platform, external_account_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  correlation_id uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now()
);

create index agency_members_user_active_idx on public.agency_members (user_id, agency_id) where active;
create index clients_agency_status_idx on public.clients (agency_id, status);
create index integrations_agency_client_idx on public.integrations (agency_id, client_id);
create index integrations_status_idx on public.integrations (agency_id, status);
create index audit_events_agency_occurred_idx on public.audit_events (agency_id, occurred_at desc);
create index audit_events_client_occurred_idx on public.audit_events (client_id, occurred_at desc) where client_id is not null;
create index audit_events_actor_idx on public.audit_events (actor_user_id) where actor_user_id is not null;

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.integrations enable row level security;
alter table public.audit_events enable row level security;

create policy agency_members_read_own on public.agency_members for select to authenticated
  using ((select auth.uid()) = user_id and active);

create policy agencies_read_membership on public.agencies for select to authenticated
  using (exists (select 1 from public.agency_members member where member.agency_id = agencies.id
    and member.user_id = (select auth.uid()) and member.active));

create policy clients_read_membership on public.clients for select to authenticated
  using (exists (select 1 from public.agency_members member where member.agency_id = clients.agency_id
    and member.user_id = (select auth.uid()) and member.active));

create policy clients_insert_admin on public.clients for insert to authenticated
  with check (exists (select 1 from public.agency_members member where member.agency_id = clients.agency_id
    and member.user_id = (select auth.uid()) and member.active and member.role in ('owner', 'admin')));

create policy clients_update_admin on public.clients for update to authenticated
  using (exists (select 1 from public.agency_members member where member.agency_id = clients.agency_id
    and member.user_id = (select auth.uid()) and member.active and member.role in ('owner', 'admin')))
  with check (exists (select 1 from public.agency_members member where member.agency_id = clients.agency_id
    and member.user_id = (select auth.uid()) and member.active and member.role in ('owner', 'admin')));

create policy integrations_read_membership on public.integrations for select to authenticated
  using (exists (select 1 from public.agency_members member where member.agency_id = integrations.agency_id
    and member.user_id = (select auth.uid()) and member.active));

create policy integrations_write_admin on public.integrations for all to authenticated
  using (exists (select 1 from public.agency_members member where member.agency_id = integrations.agency_id
    and member.user_id = (select auth.uid()) and member.active and member.role in ('owner', 'admin')))
  with check (exists (select 1 from public.agency_members member where member.agency_id = integrations.agency_id
    and member.user_id = (select auth.uid()) and member.active and member.role in ('owner', 'admin')));

create policy audit_events_read_membership on public.audit_events for select to authenticated
  using (exists (select 1 from public.agency_members member where member.agency_id = audit_events.agency_id
    and member.user_id = (select auth.uid()) and member.active));

create policy audit_events_insert_actor on public.audit_events for insert to authenticated
  with check (actor_user_id = (select auth.uid()) and exists (
    select 1 from public.agency_members member where member.agency_id = audit_events.agency_id
      and member.user_id = (select auth.uid()) and member.active));

revoke all on public.agencies, public.agency_members, public.clients, public.integrations, public.audit_events from anon;
grant select on public.agencies, public.agency_members to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select, insert, update, delete on public.integrations to authenticated;
grant select, insert on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;
