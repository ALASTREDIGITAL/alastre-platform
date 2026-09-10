-- Bloqueio explícito do Data API; acesso ocorre somente pela ponte privada.

create policy google_ads_drafts_service_only
  on public.google_ads_campaign_drafts
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy approval_items_service_only
  on public.approval_items
  for all
  to anon, authenticated
  using (false)
  with check (false);
