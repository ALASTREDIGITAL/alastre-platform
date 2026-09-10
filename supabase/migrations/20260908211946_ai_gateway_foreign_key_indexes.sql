create index if not exists ai_cost_policies_client_id_idx
  on public.ai_cost_policies (client_id)
  where client_id is not null;

create index if not exists ai_usage_events_actor_id_idx
  on public.ai_usage_events (actor_id);
