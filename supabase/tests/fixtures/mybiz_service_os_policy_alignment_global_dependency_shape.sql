-- CI-ONLY sanitized global membership policy-count mirror.
-- Production currently has 42 public.is_store_member() policy dependencies:
-- 9 authorized Stage 2 SELECT policies, 12 customer-memory policies from the
-- active migration chain, and the 21 non-Stage-2 policies mirrored below.
-- This fixture supplies only the missing non-Stage-2 catalog shape so the
-- alignment rehearsal can verify the exact 42 -> 33 dependency movement.
-- It is never copied to, linked to, or applied against Production.

begin;

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.customer_preferences (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.lead_capture_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.review_request_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.store_analytics_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.store_blog_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.store_media_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.store_public_pages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);
create table if not exists public.waiting_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id)
);

alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.lead_capture_requests enable row level security;
alter table public.order_items enable row level security;
alter table public.reservations enable row level security;
alter table public.review_request_links enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_publish_jobs enable row level security;
alter table public.store_analytics_profiles enable row level security;
alter table public.store_blog_posts enable row level security;
alter table public.store_media_assets enable row level security;
alter table public.store_public_pages enable row level security;
alter table public.store_reviews enable row level security;
alter table public.store_subscriptions enable row level security;
alter table public.store_members enable row level security;
alter table public.stores enable row level security;
alter table public.waiting_entries enable row level security;

create policy conversation_sessions_member_access on public.conversation_sessions for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy conversation_messages_member_access on public.conversation_messages for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy customer_preferences_member_access on public.customer_preferences for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy lead_capture_requests_store_member_select on public.lead_capture_requests for select to authenticated using (public.is_store_member(store_id));
create policy lead_capture_requests_store_member_update on public.lead_capture_requests for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy order_items_member_access on public.order_items for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy reservations_member_access on public.reservations for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy review_request_links_member_access on public.review_request_links for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy social_accounts_member_access on public.social_accounts for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy social_publish_jobs_member_access on public.social_publish_jobs for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_analytics_profiles_member_access on public.store_analytics_profiles for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_blog_posts_member_access on public.store_blog_posts for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_media_assets_member_access on public.store_media_assets for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_members_insert_member on public.store_members for insert to authenticated with check (public.is_store_member(store_id));
create policy store_members_select_member on public.store_members for select to authenticated using (public.is_store_member(store_id));
create policy store_members_update_member on public.store_members for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_public_pages_member_access on public.store_public_pages for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_reviews_member_access on public.store_reviews for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy store_subscriptions_member_access on public.store_subscriptions for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy stores_member_access on public.stores for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy waiting_entries_member_access on public.waiting_entries for all to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

commit;
