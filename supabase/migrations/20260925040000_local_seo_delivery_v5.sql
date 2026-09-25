-- Migration 20260925040000_local_seo_delivery_v5.sql
-- Módulo 05: Entrega de SEO Local e Google Business Profile
-- Adiciona suporte a vínculos com Motor de Operações (Module 04), Origem de Dados, Mídia em Posts, Sentimento de Avaliações e Citações em Diretórios.

-- 1. Vínculo com Motor de Operações (work_items)
alter table public.local_seo_opportunities
  add column if not exists work_item_id uuid,
  add constraint local_seo_opportunities_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null;

alter table public.local_seo_posts
  add column if not exists work_item_id uuid,
  add column if not exists media_urls text[] not null default '{}',
  add column if not exists briefing text,
  add constraint local_seo_posts_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null;

alter table public.local_seo_reviews
  add column if not exists work_item_id uuid,
  add column if not exists sentiment text check (sentiment in ('positive','neutral','negative','critical')),
  add column if not exists alert_level text check (alert_level in ('normal','warning','critical')),
  add constraint local_seo_reviews_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null;

alter table public.local_seo_review_replies
  add column if not exists work_item_id uuid,
  add constraint local_seo_review_replies_work_item_fk
    foreign key (agency_id, work_item_id) references public.work_items(agency_id, id) on delete set null;

-- 2. Origem do Dado nas verificações de perfil
alter table public.local_seo_profile_checks
  add column if not exists data_origin text check (data_origin in ('provider','manual','evidence','inference','hypothesis','unavailable'));

-- 3. Tabela de Citações e Diretórios (Autoridade Local)
create table if not exists public.local_seo_citations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null,
  directory_name text not null,
  url text,
  status text not null default 'missing' check (status in ('verified','inconsistent','missing','submitted','not_applicable')),
  nap_status text not null default 'unverified' check (nap_status in ('consistent','name_mismatch','address_mismatch','phone_mismatch','unverified')),
  evidence_note text,
  source text not null default 'manual' check (source in ('manual','provider','inference')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, directory_name),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete restrict
);

create index if not exists local_seo_citations_client_idx on public.local_seo_citations (agency_id, client_id, status);

alter table public.local_seo_citations enable row level security;
revoke all on public.local_seo_citations from public, anon, authenticated;
create policy local_seo_citations_service_only on public.local_seo_citations for all to anon, authenticated using(false) with check(false);
grant select, insert, update, delete on public.local_seo_citations to service_role;
