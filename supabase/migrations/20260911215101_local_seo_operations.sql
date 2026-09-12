-- Marco C: operational SEO Local domain. Local migration only; do not apply remotely without approval.
create table public.local_seo_posts (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  theme text, objective text, service text, locality text, primary_keyword text,
  related_keywords text[] not null default '{}', cta text, body text,
  status text not null default 'idea' check (status in ('idea','draft','review','waiting_approval','approved','ready_to_publish','published','rejected','changes_requested')),
  origin text not null default 'human' check (origin in ('human','agent','opportunity','campaign','reused')),
  author_label text, approval_id uuid references public.approval_items(id) on delete restrict,
  created_by_actor_id uuid references public.agency_actors(id) on delete restrict, updated_by_actor_id uuid references public.agency_actors(id) on delete restrict,
  scheduled_for timestamptz, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.local_seo_reviews (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict, external_id text,
  rating smallint check (rating between 1 and 5), reviewer_name text, reviewed_at timestamptz,
  review_text text not null, existing_response text, status text not null default 'new' check (status in ('new','response_drafted','waiting_approval','ready_to_respond','responded')),
  source text not null default 'internal' check (source in ('internal','google_business_profile','import')),
  source_payload jsonb not null default '{}', created_by_actor_id uuid references public.agency_actors(id) on delete restrict,
  updated_by_actor_id uuid references public.agency_actors(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (agency_id, client_id, external_id)
);
create table public.local_seo_review_replies (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict, review_id uuid not null references public.local_seo_reviews(id) on delete restrict,
  body text not null, origin text not null default 'human' check (origin in ('human','agent')),
  status text not null default 'draft' check (status in ('draft','review','waiting_approval','approved','ready_to_respond','responded','changes_requested')),
  prompt_version text, approval_id uuid references public.approval_items(id) on delete restrict,
  created_by_actor_id uuid references public.agency_actors(id) on delete restrict, updated_by_actor_id uuid references public.agency_actors(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.local_seo_opportunities (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  origin text not null, category text not null check (category in ('profile','reviews','content','ranking','competition','site','conversion')),
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  title text not null, diagnosis text, recommendation text, expected_impact text, suggested_action text,
  status text not null default 'detected' check (status in ('detected','analyzed','action_prepared','waiting_approval','in_progress','completed','dismissed')),
  assigned_agent text, approval_id uuid references public.approval_items(id) on delete restrict, evidence jsonb not null default '{}',
  created_by_actor_id uuid references public.agency_actors(id) on delete restrict, updated_by_actor_id uuid references public.agency_actors(id) on delete restrict,
  detected_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index local_seo_posts_queue_idx on public.local_seo_posts (agency_id,status,scheduled_for);
create index local_seo_reviews_queue_idx on public.local_seo_reviews (agency_id,status,reviewed_at desc);
create index local_seo_review_replies_queue_idx on public.local_seo_review_replies (agency_id,status,updated_at desc);
create index local_seo_opportunities_queue_idx on public.local_seo_opportunities (agency_id,priority,status,detected_at desc);
alter table public.local_seo_posts enable row level security;
alter table public.local_seo_reviews enable row level security;
alter table public.local_seo_review_replies enable row level security;
alter table public.local_seo_opportunities enable row level security;
revoke all on public.local_seo_posts, public.local_seo_reviews, public.local_seo_review_replies, public.local_seo_opportunities from public, anon, authenticated;
grant all on public.local_seo_posts, public.local_seo_reviews, public.local_seo_review_replies, public.local_seo_opportunities to service_role;
alter table public.approval_items drop constraint if exists approval_items_source_type_check;
alter table public.approval_items add constraint approval_items_source_type_check check (source_type in ('google_ads_campaign','tracking_deployment','tracking_publication','local_seo_post','local_seo_review_response','local_seo_opportunity_action'));

create or replace function public.platform_apply_local_seo_approval(p_actor_id uuid,p_approval_id uuid,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor public.agency_actors%rowtype;v_item public.approval_items%rowtype;
begin
 select * into v_actor from public.agency_actors where id=p_actor_id and active;
 if not found or v_actor.role not in('owner','admin') then raise exception 'actor_forbidden' using errcode='42501';end if;
 select * into v_item from public.approval_items where id=p_approval_id and agency_id=v_actor.agency_id;
 if not found then raise exception 'approval_not_found' using errcode='P0002';end if;
 if v_item.source_type='local_seo_post' then update public.local_seo_posts set status=case when p_decision='approved' then'ready_to_publish'when p_decision='changes_requested' then'changes_requested'else'rejected'end,updated_by_actor_id=v_actor.id,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
 elsif v_item.source_type='local_seo_review_response' then update public.local_seo_review_replies set status=case when p_decision='approved' then'ready_to_respond'else'changes_requested'end,updated_by_actor_id=v_actor.id,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
 elsif v_item.source_type='local_seo_opportunity_action' then update public.local_seo_opportunities set status=case when p_decision='approved' then'in_progress'else'action_prepared'end,updated_by_actor_id=v_actor.id,updated_at=now() where id=v_item.source_id and agency_id=v_actor.agency_id and client_id=v_item.client_id;
 end if;
end;$$;
revoke all on function public.platform_apply_local_seo_approval(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.platform_apply_local_seo_approval(uuid,uuid,text) to service_role;
