create index if not exists tracking_candidate_agency_idx
  on public.tracking_candidate_artifacts (agency_id);

create index if not exists tracking_candidate_profile_idx
  on public.tracking_candidate_artifacts (profile_id);

create index if not exists tracking_candidate_actor_idx
  on public.tracking_candidate_artifacts (created_by_actor_id);
