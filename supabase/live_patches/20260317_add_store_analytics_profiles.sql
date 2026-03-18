do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'id'
  ) then
    raise exception 'public.stores.id not found. This patch expects the canonical schema that uses stores.id as the primary key.';
  end if;

  if to_regprocedure('public.is_store_member(uuid)') is null then
    raise exception 'public.is_store_member(uuid) must exist before applying this patch.';
  end if;

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() must exist before applying this patch.';
  end if;
end;
$$;

create table if not exists public.store_analytics_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  industry text not null,
  region text not null,
  customer_focus text not null,
  analytics_preset text not null,
  version integer not null default 1,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists store_analytics_profiles_store_idx
on public.store_analytics_profiles (store_id);

alter table public.store_analytics_profiles enable row level security;

drop trigger if exists trg_store_analytics_profiles_set_updated_at on public.store_analytics_profiles;
create trigger trg_store_analytics_profiles_set_updated_at
before update on public.store_analytics_profiles
for each row execute procedure public.set_updated_at();

drop policy if exists "store_analytics_profiles_member_access" on public.store_analytics_profiles;
create policy "store_analytics_profiles_member_access"
on public.store_analytics_profiles
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
