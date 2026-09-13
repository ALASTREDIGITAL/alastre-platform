-- Marco D: SEO Local V2 foundation. Local only; do not apply remotely without explicit approval.
create table public.local_seo_score_snapshots (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
 client_id uuid not null, overall_score smallint check (overall_score between 0 and 100), confidence text not null check (confidence in ('high','medium','low')),
 state text not null check (state in ('calculated','partial','insufficient','unavailable')), version text not null,
 pillar_scores jsonb not null default '[]', evidence_summary jsonb not null default '{}', calculated_at timestamptz not null default now(),
 foreign key (agency_id,client_id) references public.clients(agency_id,id) on delete restrict
);
create table public.local_seo_profile_checks (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
 client_id uuid not null, check_key text not null,
 status text not null check (status in ('ok','attention','critical','not_verified','not_available')),
 current_value jsonb, evidence_note text, recommendation text, priority text check (priority in ('critical','high','medium','low')),
 responsible_actor_id uuid references public.agency_actors(id) on delete restrict,
 source text not null default 'manual' check(source in ('manual','dna_suggestion','google_future')), checked_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (client_id,check_key),
 foreign key (agency_id,client_id) references public.clients(agency_id,id) on delete restrict
);
create table public.local_seo_keywords (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
 client_id uuid not null, keyword text not null,
 intent text not null check (intent in ('transactional','commercial','local','informational','brand')),
 service text, location text, priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
 source text not null check (source in ('manual','dna','agent_suggestion','google_future','rank_provider_future')), reason text,
 status text not null default 'suggested' check (status in ('suggested','approved','monitored','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (client_id,keyword,location),unique(agency_id,client_id,id),
 foreign key (agency_id,client_id) references public.clients(agency_id,id) on delete restrict
);
create table public.local_seo_rank_snapshots (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
 client_id uuid not null, keyword_id uuid not null,
 provider text not null, position numeric check (position > 0), location text not null, grid_data jsonb,
 observed_at timestamptz not null, created_at timestamptz not null default now(), unique (keyword_id,provider,location,observed_at),
 foreign key (agency_id,client_id) references public.clients(agency_id,id) on delete restrict,
 foreign key (agency_id,client_id,keyword_id) references public.local_seo_keywords(agency_id,client_id,id) on delete cascade
);
create table public.local_seo_competitors (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
 client_id uuid not null, name text not null, category text, location text,
 rating numeric check (rating between 0 and 5), review_count integer check (review_count >= 0), website text, notes text,
 source text not null default 'manual' check (source in ('manual','provider_future')), status text not null default 'active' check (status in ('active','archived')),
 last_updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
 foreign key (agency_id,client_id) references public.clients(agency_id,id) on delete restrict
);
create index local_seo_score_snapshots_client_idx on public.local_seo_score_snapshots (agency_id,client_id,calculated_at desc);
create index local_seo_profile_checks_client_idx on public.local_seo_profile_checks (agency_id,client_id,status);
create index local_seo_keywords_client_idx on public.local_seo_keywords (agency_id,client_id,status,priority);
create index local_seo_rank_snapshots_client_idx on public.local_seo_rank_snapshots (agency_id,client_id,observed_at desc);
create index local_seo_competitors_client_idx on public.local_seo_competitors (agency_id,client_id,status);
alter table public.local_seo_score_snapshots enable row level security;
alter table public.local_seo_profile_checks enable row level security;
alter table public.local_seo_keywords enable row level security;
alter table public.local_seo_rank_snapshots enable row level security;
alter table public.local_seo_competitors enable row level security;
revoke all on public.local_seo_score_snapshots,public.local_seo_profile_checks,public.local_seo_keywords,public.local_seo_rank_snapshots,public.local_seo_competitors from public,anon,authenticated;
create policy local_seo_score_snapshots_service_only on public.local_seo_score_snapshots for all to anon,authenticated using(false) with check(false);
create policy local_seo_profile_checks_service_only on public.local_seo_profile_checks for all to anon,authenticated using(false) with check(false);
create policy local_seo_keywords_service_only on public.local_seo_keywords for all to anon,authenticated using(false) with check(false);
create policy local_seo_rank_snapshots_service_only on public.local_seo_rank_snapshots for all to anon,authenticated using(false) with check(false);
create policy local_seo_competitors_service_only on public.local_seo_competitors for all to anon,authenticated using(false) with check(false);
grant select,insert,update,delete on public.local_seo_score_snapshots,public.local_seo_profile_checks,public.local_seo_keywords,public.local_seo_rank_snapshots,public.local_seo_competitors to service_role;

alter table public.local_seo_opportunities drop constraint if exists local_seo_opportunities_category_check;
alter table public.local_seo_opportunities add constraint local_seo_opportunities_category_check check(category in ('profile','reviews','content','ranking','competition','site','conversion','authority','local_presence'));
create unique index local_seo_opportunities_open_rule_uq on public.local_seo_opportunities(agency_id,client_id,origin,category,title) where status not in ('completed','dismissed');
