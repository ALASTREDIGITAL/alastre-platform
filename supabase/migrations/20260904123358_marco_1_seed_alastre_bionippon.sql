-- Marco 1: cadastro inicial da agência e do cliente piloto.
-- Nenhuma automação externa é ativada por esta migration.

with agency_row as (
  insert into public.agencies (id, name, slug, status)
  values ('a1a57e00-0000-4000-8000-000000000001', 'Alastre Digital', 'alastre-digital', 'active')
  on conflict (slug) do update
    set name = excluded.name,
        status = excluded.status,
        updated_at = now()
  returning id
),
client_row as (
  insert into public.clients (id, agency_id, name, slug, status, timezone)
  select
    'b10a1a00-0000-4000-8000-000000000001',
    agency_row.id,
    'Bionippon',
    'bionippon',
    'active',
    'America/Sao_Paulo'
  from agency_row
  on conflict (agency_id, slug) do update
    set name = excluded.name,
        status = excluded.status,
        timezone = excluded.timezone,
        updated_at = now()
  returning id, agency_id
)
insert into public.audit_events (
  agency_id,
  client_id,
  actor_user_id,
  action,
  target_type,
  target_id,
  payload
)
select
  client_row.agency_id,
  client_row.id,
  null,
  'pilot_initialized',
  'client',
  client_row.id::text,
  jsonb_build_object(
    'environment', 'homologation',
    'write_mode', 'disabled',
    'external_automations', 'disabled'
  )
from client_row;
