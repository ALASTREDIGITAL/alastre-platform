-- Cover every Tracking Provisioning foreign key used for joins and lifecycle checks.
create index tracking_profiles_client_idx on public.tracking_profiles (client_id);
create index tracking_profiles_template_idx on public.tracking_profiles (agency_id, template_key, template_version) where template_key is not null;
create index tracking_resources_client_idx on public.tracking_resources (client_id);
create index tracking_deployments_profile_idx on public.tracking_deployments (profile_id);
create index tracking_deployments_actor_idx on public.tracking_deployments (created_by_actor_id);
create index tracking_validations_agency_idx on public.tracking_validations (agency_id);
create index tracking_validations_client_idx on public.tracking_validations (client_id);
