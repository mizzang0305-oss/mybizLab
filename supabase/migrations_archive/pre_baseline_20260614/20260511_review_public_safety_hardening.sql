-- MyBiz review request/public review safety hardening.
-- Purpose: keep public review output column-safe through server DTOs and make dashboard-generated request links token-based.
-- Safety: non-destructive. No destructive table operations or production data deletes.

alter table public.review_request_links
  add column if not exists public_token text,
  add column if not exists expires_at timestamptz null,
  add column if not exists disabled_at timestamptz null,
  add column if not exists max_uses integer null check (max_uses is null or max_uses > 0);

create unique index if not exists review_request_links_public_token_idx
on public.review_request_links (public_token)
where public_token is not null;

alter table public.store_reviews enable row level security;
alter table public.review_request_links enable row level security;

-- Public store review pages now read reviews through /api/public/review,
-- which maps rows to a safe DTO. Published-row RLS on the base table cannot
-- protect private columns such as customer_id/order_id/consent flags.
drop policy if exists "store_reviews_public_read_published" on public.store_reviews;

drop policy if exists "store_reviews_member_access" on public.store_reviews;
create policy "store_reviews_member_access"
on public.store_reviews
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "review_request_links_member_access" on public.review_request_links;
create policy "review_request_links_member_access"
on public.review_request_links
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
