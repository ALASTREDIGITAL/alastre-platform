-- Explicit deny policies document that SEO Local is bridge/service-role only.
create policy local_seo_posts_no_direct_access on public.local_seo_posts for all to anon, authenticated using (false) with check (false);
create policy local_seo_reviews_no_direct_access on public.local_seo_reviews for all to anon, authenticated using (false) with check (false);
create policy local_seo_review_replies_no_direct_access on public.local_seo_review_replies for all to anon, authenticated using (false) with check (false);
create policy local_seo_opportunities_no_direct_access on public.local_seo_opportunities for all to anon, authenticated using (false) with check (false);

create index local_seo_posts_client_idx on public.local_seo_posts(client_id);
create index local_seo_posts_approval_idx on public.local_seo_posts(approval_id) where approval_id is not null;
create index local_seo_posts_created_actor_idx on public.local_seo_posts(created_by_actor_id) where created_by_actor_id is not null;
create index local_seo_posts_updated_actor_idx on public.local_seo_posts(updated_by_actor_id) where updated_by_actor_id is not null;
create index local_seo_reviews_client_idx on public.local_seo_reviews(client_id);
create index local_seo_reviews_created_actor_idx on public.local_seo_reviews(created_by_actor_id) where created_by_actor_id is not null;
create index local_seo_reviews_updated_actor_idx on public.local_seo_reviews(updated_by_actor_id) where updated_by_actor_id is not null;
create index local_seo_review_replies_client_idx on public.local_seo_review_replies(client_id);
create index local_seo_review_replies_review_idx on public.local_seo_review_replies(review_id);
create index local_seo_review_replies_approval_idx on public.local_seo_review_replies(approval_id) where approval_id is not null;
create index local_seo_review_replies_created_actor_idx on public.local_seo_review_replies(created_by_actor_id) where created_by_actor_id is not null;
create index local_seo_review_replies_updated_actor_idx on public.local_seo_review_replies(updated_by_actor_id) where updated_by_actor_id is not null;
create index local_seo_opportunities_client_idx on public.local_seo_opportunities(client_id);
create index local_seo_opportunities_approval_idx on public.local_seo_opportunities(approval_id) where approval_id is not null;
create index local_seo_opportunities_created_actor_idx on public.local_seo_opportunities(created_by_actor_id) where created_by_actor_id is not null;
create index local_seo_opportunities_updated_actor_idx on public.local_seo_opportunities(updated_by_actor_id) where updated_by_actor_id is not null;
