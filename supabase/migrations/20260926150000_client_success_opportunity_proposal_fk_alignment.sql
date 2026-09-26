-- Migration: 20260926150000_client_success_opportunity_proposal_fk_alignment.sql
-- Módulo 07 & Módulo 02: Alinhamento de Tipo de Colunas (uuid -> text) e FKs Compostas em client_expansion_recommendations
-- Projeto: Alastre Platform (Homologação e Instâncias Virgens)

-- 1. Preflight defensivo de integridade
do $$
begin
  if exists (
    select 1
    from public.client_expansion_recommendations r
    where r.commercial_opportunity_id is not null
      and not exists (
        select 1
        from public.commercial_opportunities o
        where o.agency_id = r.agency_id
          and o.id::text = r.commercial_opportunity_id::text
      )
  ) then
    raise exception 'PREFLIGHT_FAIL: client_expansion_recommendations contém commercial_opportunity_id sem correspondência em commercial_opportunities';
  end if;

  if exists (
    select 1
    from public.client_expansion_recommendations r
    where r.commercial_proposal_id is not null
      and not exists (
        select 1
        from public.commercial_proposals p
        where p.agency_id = r.agency_id
          and p.id::text = r.commercial_proposal_id::text
      )
  ) then
    raise exception 'PREFLIGHT_FAIL: client_expansion_recommendations contém commercial_proposal_id sem correspondência em commercial_proposals';
  end if;
end;
$$;

-- 2. Alteração segura de tipo de coluna (uuid -> text) se necessário em bancos existentes
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_expansion_recommendations'
      and column_name = 'commercial_opportunity_id'
      and data_type = 'uuid'
  ) then
    alter table public.client_expansion_recommendations
      alter column commercial_opportunity_id type text using commercial_opportunity_id::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_expansion_recommendations'
      and column_name = 'commercial_proposal_id'
      and data_type = 'uuid'
  ) then
    alter table public.client_expansion_recommendations
      alter column commercial_proposal_id type text using commercial_proposal_id::text;
  end if;
end;
$$;

-- 3. Adição defensiva das Foreign Keys compostas
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_expansion_recommendations_agency_opportunity_fk') then
    alter table public.client_expansion_recommendations add constraint client_expansion_recommendations_agency_opportunity_fk
      foreign key (agency_id, commercial_opportunity_id) references public.commercial_opportunities(agency_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'client_expansion_recommendations_agency_proposal_fk') then
    alter table public.client_expansion_recommendations add constraint client_expansion_recommendations_agency_proposal_fk
      foreign key (agency_id, commercial_proposal_id) references public.commercial_proposals(agency_id, id) on delete set null;
  end if;
end;
$$;

-- 4. Criação de índices de suporte para Foreign Keys compostas
create index if not exists idx_client_expansion_recs_agency_opportunity
  on public.client_expansion_recommendations(agency_id, commercial_opportunity_id);

create index if not exists idx_client_expansion_recs_agency_proposal
  on public.client_expansion_recommendations(agency_id, commercial_proposal_id);
