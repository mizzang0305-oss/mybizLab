create extension if not exists pgcrypto;

create table if not exists public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'vip')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  billing_provider text,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (store_id)
);

alter table public.store_subscriptions
  add column if not exists billing_provider text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_starts_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists store_subscriptions_store_id_idx on public.store_subscriptions (store_id);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    drop trigger if exists trg_store_subscriptions_set_updated_at on public.store_subscriptions;
    create trigger trg_store_subscriptions_set_updated_at
    before update on public.store_subscriptions
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.store_subscriptions enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'is_store_member'
      and pg_function_is_visible(oid)
  ) then
    drop policy if exists "store_subscriptions_member_access" on public.store_subscriptions;
    create policy "store_subscriptions_member_access"
    on public.store_subscriptions
    for all
    using (public.is_store_member(store_id))
    with check (public.is_store_member(store_id));
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.subscriptions') is null then
    raise notice 'Skipping legacy subscription backfill because public.subscriptions does not exist.';
    return;
  end if;

  insert into public.store_subscriptions (
    id,
    store_id,
    plan,
    status,
    billing_provider,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    created_at,
    updated_at
  )
  with ranked_legacy as (
    select
      sm.store_id,
      s.id as legacy_subscription_id,
      case
        when coalesce(s.tier, s.plan, '') in ('free', 'pro', 'vip') then coalesce(s.tier, s.plan)
        when coalesce(s.tier, s.plan, '') = 'starter' then 'free'
        when coalesce(s.tier, s.plan, '') in ('business', 'enterprise') then 'vip'
        else 'free'
      end as canonical_plan,
      case
        when coalesce(s.status, '') in ('trialing', 'active', 'past_due', 'cancelled') then s.status
        when coalesce(s.last_payment_status, '') = 'paid' then 'active'
        when coalesce(s.last_payment_status, '') in ('failed', 'past_due') then 'past_due'
        when coalesce(s.status, '') in ('canceled', 'cancelled') then 'cancelled'
        when s.expires_at is not null and s.expires_at > timezone('utc', now()) then 'trialing'
        else 'trialing'
      end as canonical_status,
      case
        when nullif(s.billing_key, '') is not null then 'portone'
        else 'manual'
      end as billing_provider,
      s.expires_at as trial_ends_at,
      coalesce(s.started_at, s.created_at, timezone('utc', now())) as current_period_starts_at,
      s.expires_at as current_period_ends_at,
      coalesce(s.created_at, s.started_at, timezone('utc', now())) as created_at,
      coalesce(s.updated_at, s.started_at, timezone('utc', now())) as updated_at,
      row_number() over (
        partition by sm.store_id
        order by
          case sm.role when 'owner' then 3 when 'manager' then 2 else 1 end desc,
          coalesce(s.updated_at, s.started_at, timezone('utc', now())) desc,
          s.id desc
      ) as row_rank
    from public.store_members sm
    join public.subscriptions s on s.user_id = sm.profile_id
  )
  select
    coalesce(legacy_subscription_id, gen_random_uuid()),
    store_id,
    canonical_plan,
    canonical_status,
    billing_provider,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    created_at,
    updated_at
  from ranked_legacy
  where row_rank = 1
  on conflict (store_id) do update
    set
      plan = excluded.plan,
      status = excluded.status,
      billing_provider = coalesce(excluded.billing_provider, public.store_subscriptions.billing_provider),
      trial_ends_at = coalesce(excluded.trial_ends_at, public.store_subscriptions.trial_ends_at),
      current_period_starts_at = coalesce(excluded.current_period_starts_at, public.store_subscriptions.current_period_starts_at),
      current_period_ends_at = coalesce(excluded.current_period_ends_at, public.store_subscriptions.current_period_ends_at),
      updated_at = excluded.updated_at
  where coalesce(excluded.updated_at, excluded.created_at) >= coalesce(public.store_subscriptions.updated_at, public.store_subscriptions.created_at);
end;
$$;

comment on table public.store_subscriptions is 'Canonical entitlement truth for MyBiz stores. Backfilled from legacy public.subscriptions on 2026-04-24.';
