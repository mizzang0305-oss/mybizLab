create table if not exists public.review_request_links (
  link_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  created_by uuid null,
  source_type text not null default 'store'
    check (source_type in ('store', 'order', 'reservation', 'waiting', 'customer')),
  source_id text null,
  url text not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  submission_count integer not null default 0 check (submission_count >= 0),
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_request_links_store_created_idx
on public.review_request_links (store_id, created_at desc);

create index if not exists review_request_links_store_source_idx
on public.review_request_links (store_id, source_type, source_id);

drop trigger if exists review_request_links_set_updated_at on public.review_request_links;
create trigger review_request_links_set_updated_at
before update on public.review_request_links
for each row
execute function public.set_updated_at();

alter table public.review_request_links enable row level security;

drop policy if exists "review_request_links_member_access" on public.review_request_links;
create policy "review_request_links_member_access"
on public.review_request_links
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
