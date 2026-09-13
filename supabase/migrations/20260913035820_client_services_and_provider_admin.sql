create table public.client_services (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null,
  service_key text not null check (service_key in ('local_seo','google_ads','meta_ads','sites_seo','reports','commercial','finance')),
  status text not null default 'inactive' check (status in ('active','inactive','pending')),
  configured_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, service_key),
  unique (agency_id, id),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade,
  foreign key (agency_id, configured_by_user_id) references public.agency_members (agency_id, user_id) on delete restrict
);

create index client_services_agency_status_idx on public.client_services (agency_id, status);
create index client_services_client_status_idx on public.client_services (client_id, status);

alter table public.client_services enable row level security;
revoke all on public.client_services from public, anon, authenticated;
create policy client_services_service_only on public.client_services for all to anon, authenticated using (false) with check (false);
grant select, insert, update, delete on public.client_services to service_role;

comment on table public.client_services is 'Módulos contratados ou habilitados por cliente; billing não faz parte deste marco.';
