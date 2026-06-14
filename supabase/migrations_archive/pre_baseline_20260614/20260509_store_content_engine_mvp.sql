-- MyBiz store content engine MVP.
-- Purpose: store-level reviews, blog posts, media assets, and approval-first social publish jobs.
-- Safety: non-destructive. No external posting, review scraping, or third-party review writing is implemented.

create extension if not exists pgcrypto;

create table if not exists public.store_reviews (
  review_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid null,
  order_id uuid null,
  reservation_id uuid null,
  rating integer not null check (rating between 1 and 5),
  title text null,
  body text not null,
  media_urls jsonb not null default '[]'::jsonb,
  reviewer_display_name text null,
  marketing_consent boolean not null default false,
  content_usage_consent boolean not null default false,
  visibility_status text not null default 'pending' check (visibility_status in ('pending','published','hidden','reported')),
  sentiment text null,
  keywords jsonb not null default '[]'::jsonb,
  ai_summary text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_blog_posts (
  post_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  author_profile_id uuid null,
  source_type text not null default 'manual' check (source_type in ('manual','review','ai','video','campaign')),
  source_review_id uuid null references public.store_reviews(review_id) on delete set null,
  title text not null,
  slug text not null,
  excerpt text null,
  body text not null,
  cover_image_url text null,
  media_urls jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  published_at timestamptz null,
  seo_title text null,
  seo_description text null,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(store_id, slug)
);

create table if not exists public.store_media_assets (
  asset_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  uploaded_by uuid null,
  asset_type text not null check (asset_type in ('image','video')),
  url text not null,
  storage_path text null,
  thumbnail_url text null,
  alt_text text null,
  duration_seconds integer null,
  transcript text null,
  captions_vtt text null,
  captions_srt text null,
  ai_title text null,
  ai_description text null,
  ai_hashtags jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_accounts (
  account_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  provider text not null check (provider in ('youtube','tiktok','threads','naver_blog','kakao_share')),
  provider_account_id text null,
  display_name text null,
  oauth_status text not null default 'not_connected' check (oauth_status in ('not_connected','connected','expired','revoked','disabled')),
  access_token_encrypted text null,
  refresh_token_encrypted text null,
  token_expires_at timestamptz null,
  scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(store_id, provider)
);

create table if not exists public.social_publish_jobs (
  job_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  provider text not null check (provider in ('youtube','tiktok','threads','naver_blog','kakao_share','mybiz_blog')),
  source_type text not null check (source_type in ('review','blog_post','media','manual')),
  source_id uuid null,
  caption text null,
  hashtags jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','waiting_approval','queued','publishing','published','failed','canceled')),
  provider_post_id text null,
  provider_url text null,
  error_code text null,
  error_message text null,
  approved_by uuid null,
  approved_at timestamptz null,
  published_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists store_reviews_store_status_created_idx on public.store_reviews (store_id, visibility_status, created_at desc);
create index if not exists store_blog_posts_store_status_published_idx on public.store_blog_posts (store_id, status, published_at desc);
create index if not exists store_media_assets_store_status_created_idx on public.store_media_assets (store_id, status, created_at desc);
create index if not exists social_accounts_store_provider_idx on public.social_accounts (store_id, provider);
create index if not exists social_publish_jobs_store_provider_status_created_idx on public.social_publish_jobs (store_id, provider, status, created_at desc);

drop trigger if exists trg_store_reviews_set_updated_at on public.store_reviews;
create trigger trg_store_reviews_set_updated_at
before update on public.store_reviews
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_store_blog_posts_set_updated_at on public.store_blog_posts;
create trigger trg_store_blog_posts_set_updated_at
before update on public.store_blog_posts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_store_media_assets_set_updated_at on public.store_media_assets;
create trigger trg_store_media_assets_set_updated_at
before update on public.store_media_assets
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_social_accounts_set_updated_at on public.social_accounts;
create trigger trg_social_accounts_set_updated_at
before update on public.social_accounts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_social_publish_jobs_set_updated_at on public.social_publish_jobs;
create trigger trg_social_publish_jobs_set_updated_at
before update on public.social_publish_jobs
for each row execute procedure public.set_updated_at();

alter table public.store_reviews enable row level security;
alter table public.store_blog_posts enable row level security;
alter table public.store_media_assets enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_publish_jobs enable row level security;

drop policy if exists "store_reviews_public_read_published" on public.store_reviews;
create policy "store_reviews_public_read_published"
on public.store_reviews
for select
using (visibility_status = 'published');

drop policy if exists "store_reviews_member_access" on public.store_reviews;
create policy "store_reviews_member_access"
on public.store_reviews
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "store_blog_posts_public_read_published" on public.store_blog_posts;
create policy "store_blog_posts_public_read_published"
on public.store_blog_posts
for select
using (status = 'published');

drop policy if exists "store_blog_posts_member_access" on public.store_blog_posts;
create policy "store_blog_posts_member_access"
on public.store_blog_posts
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "store_media_assets_public_read_published" on public.store_media_assets;
create policy "store_media_assets_public_read_published"
on public.store_media_assets
for select
using (status = 'published');

drop policy if exists "store_media_assets_member_access" on public.store_media_assets;
create policy "store_media_assets_member_access"
on public.store_media_assets
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "social_accounts_member_access" on public.social_accounts;
create policy "social_accounts_member_access"
on public.social_accounts
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "social_publish_jobs_member_access" on public.social_publish_jobs;
create policy "social_publish_jobs_member_access"
on public.social_publish_jobs
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
