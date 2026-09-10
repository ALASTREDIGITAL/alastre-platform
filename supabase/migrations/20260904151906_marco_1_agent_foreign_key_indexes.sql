create index if not exists agent_messages_agency_id_idx on public.agent_messages (agency_id);
create index if not exists agent_messages_client_id_idx on public.agent_messages (client_id);
create index if not exists agent_threads_agency_id_idx on public.agent_threads (agency_id);
create index if not exists client_intelligence_sources_agency_id_idx on public.client_intelligence_sources (agency_id);
