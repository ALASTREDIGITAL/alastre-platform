-- Marco 1: DNA, fontes de inteligência e memória conversacional.
-- Mantido completo para que um ambiente novo possa reconstruir o banco pelo Git.

create table public.client_dna_profiles (
  client_id uuid primary key references public.clients(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','confirmed','needs_review')),
  business_data jsonb not null default '{}'::jsonb check (jsonb_typeof(business_data) = 'object'),
  local_intelligence jsonb not null default '{}'::jsonb check (jsonb_typeof(local_intelligence) = 'object'),
  paid_media_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(paid_media_rules) = 'object'),
  source_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(source_summary) = 'object'),
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  source_type text not null check (source_type in ('google_business_profile','website','instagram','manual','market_research','google_ads')),
  label text not null,
  source_url text,
  status text not null default 'pending' check (status in ('pending','connected','imported','needs_review','error')),
  facts jsonb not null default '{}'::jsonb check (jsonb_typeof(facts) = 'object'),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  agent_type text not null check (agent_type in ('onboarding','seo_local','google_ads','reviewer')),
  title text not null,
  created_by_email text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.agent_threads(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  role text not null check (role in ('user','assistant','system')),
  content text not null check (char_length(content) between 1 and 20000),
  input_mode text not null default 'text' check (input_mode in ('text','voice','system')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index client_dna_agency_status_idx on public.client_dna_profiles (agency_id,status);
create index intelligence_sources_client_type_idx on public.client_intelligence_sources (client_id,source_type);
create index agent_threads_client_updated_idx on public.agent_threads (client_id,updated_at desc);
create index agent_messages_thread_created_idx on public.agent_messages (thread_id,created_at);

alter table public.client_dna_profiles enable row level security;
alter table public.client_intelligence_sources enable row level security;
alter table public.agent_threads enable row level security;
alter table public.agent_messages enable row level security;

revoke all on public.client_dna_profiles, public.client_intelligence_sources, public.agent_threads, public.agent_messages from anon, authenticated;

create policy client_dna_service_only on public.client_dna_profiles for all to anon, authenticated using (false) with check (false);
create policy intelligence_sources_service_only on public.client_intelligence_sources for all to anon, authenticated using (false) with check (false);
create policy agent_threads_service_only on public.agent_threads for all to anon, authenticated using (false) with check (false);
create policy agent_messages_service_only on public.agent_messages for all to anon, authenticated using (false) with check (false);
