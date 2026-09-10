-- Marco 1: persistência privada de rascunhos Google Ads e fila de aprovação.

create table public.google_ads_campaign_drafts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  created_by_email text not null,
  name text not null check (char_length(name) between 3 and 180),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected','executed','cancelled')),
  daily_budget numeric(12,2) not null check (daily_budget > 0),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  idempotency_key uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approval_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  source_type text not null check (source_type in ('google_ads_campaign')),
  source_id uuid not null,
  requested_by_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  decision_by_email text,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index google_ads_drafts_client_status_idx on public.google_ads_campaign_drafts (client_id, status, created_at desc);
create index google_ads_drafts_agency_created_idx on public.google_ads_campaign_drafts (agency_id, created_at desc);
create index approval_items_agency_status_idx on public.approval_items (agency_id, status, created_at desc);
create index approval_items_client_created_idx on public.approval_items (client_id, created_at desc);

alter table public.google_ads_campaign_drafts enable row level security;
alter table public.approval_items enable row level security;

revoke all on public.google_ads_campaign_drafts, public.approval_items from anon, authenticated;

insert into public.audit_events (agency_id, client_id, action, target_type, payload)
values (
  'a1a57e00-0000-4000-8000-000000000001',
  'b10a1a00-0000-4000-8000-000000000001',
  'google_ads_persistence_initialized',
  'module',
  '{"write_mode":"simulation","external_execution":"disabled"}'::jsonb
);

