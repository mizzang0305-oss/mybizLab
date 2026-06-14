create extension if not exists pgcrypto;

do $$
declare
  stores_pk_column text;
begin
  if to_regclass('public.stores') is null then
    raise exception 'public.stores does not exist. Cannot align canonical store_subscriptions.';
  end if;

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'stores'
        and column_name = 'store_id'
    ) then 'store_id'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'stores'
        and column_name = 'id'
    ) then 'id'
    else null
  end
  into stores_pk_column;

  if stores_pk_column is null then
    raise exception 'public.stores must expose either store_id or id to align canonical store_subscriptions.';
  end if;

  if to_regclass('public.store_subscriptions') is null then
    execute format(
      $sql$
      create table public.store_subscriptions (
        id uuid primary key default gen_random_uuid(),
        store_id uuid not null references public.stores(%I) on delete cascade,
        plan text not null check (plan in ('free', 'pro', 'vip')),
        status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled')),
        billing_provider text,
        trial_ends_at timestamptz,
        current_period_starts_at timestamptz,
        current_period_ends_at timestamptz,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now()),
        unique (store_id)
      )
      $sql$,
      stores_pk_column
    );
  end if;
end;
$$;

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
  else
    raise notice 'Skipping store_subscriptions updated_at trigger because public.set_updated_at() is not available.';
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
  else
    raise notice 'Skipping store_subscriptions RLS policy because public.is_store_member(uuid) is not available.';
  end if;
end;
$$;

do $$
declare
  subscriptions_table_exists boolean := to_regclass('public.subscriptions') is not null;
  store_members_table_exists boolean := to_regclass('public.store_members') is not null;
begin
  if not subscriptions_table_exists then
    raise notice 'Skipping legacy subscription backfill because public.subscriptions does not exist.';
    return;
  end if;

  if not store_members_table_exists then
    raise notice 'Skipping legacy subscription backfill because public.store_members does not exist.';
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
      nullif(coalesce(to_jsonb(sm) ->> 'store_id', to_jsonb(sm) ->> 'id'), '')::uuid as store_id,
      case
        when coalesce(nullif(to_jsonb(s) ->> 'tier', ''), nullif(to_jsonb(s) ->> 'plan', ''), '') in ('free', 'pro', 'vip') then coalesce(nullif(to_jsonb(s) ->> 'tier', ''), nullif(to_jsonb(s) ->> 'plan', ''))
        when coalesce(nullif(to_jsonb(s) ->> 'tier', ''), nullif(to_jsonb(s) ->> 'plan', ''), '') = 'starter' then 'free'
        when coalesce(nullif(to_jsonb(s) ->> 'tier', ''), nullif(to_jsonb(s) ->> 'plan', ''), '') in ('business', 'enterprise') then 'vip'
        else 'free'
      end as canonical_plan,
      case
        when coalesce(to_jsonb(s) ->> 'status', '') in ('trialing', 'active', 'past_due', 'cancelled') then to_jsonb(s) ->> 'status'
        when coalesce(to_jsonb(s) ->> 'status', '') in ('canceled', 'cancelled') then 'cancelled'
        when coalesce(to_jsonb(s) ->> 'last_payment_status', '') = 'paid' then 'active'
        when coalesce(to_jsonb(s) ->> 'last_payment_status', '') in ('failed', 'past_due') then 'past_due'
        when nullif(to_jsonb(s) ->> 'expires_at', '') is not null
          and (to_jsonb(s) ->> 'expires_at')::timestamptz > timezone('utc', now()) then 'trialing'
        else 'trialing'
      end as canonical_status,
      case
        when nullif(coalesce(to_jsonb(s) ->> 'billing_provider', to_jsonb(s) ->> 'provider'), '') is not null then coalesce(to_jsonb(s) ->> 'billing_provider', to_jsonb(s) ->> 'provider')
        when nullif(to_jsonb(s) ->> 'billing_key', '') is not null then 'portone'
        else 'manual'
      end as billing_provider,
      case
        when nullif(to_jsonb(s) ->> 'expires_at', '') is not null then (to_jsonb(s) ->> 'expires_at')::timestamptz
        else null
      end as trial_ends_at,
      coalesce(
        case when nullif(to_jsonb(s) ->> 'started_at', '') is not null then (to_jsonb(s) ->> 'started_at')::timestamptz else null end,
        case when nullif(to_jsonb(s) ->> 'current_period_starts_at', '') is not null then (to_jsonb(s) ->> 'current_period_starts_at')::timestamptz else null end,
        case when nullif(to_jsonb(s) ->> 'created_at', '') is not null then (to_jsonb(s) ->> 'created_at')::timestamptz else null end,
        timezone('utc', now())
      ) as current_period_starts_at,
      coalesce(
        case when nullif(to_jsonb(s) ->> 'expires_at', '') is not null then (to_jsonb(s) ->> 'expires_at')::timestamptz else null end,
        case when nullif(to_jsonb(s) ->> 'current_period_ends_at', '') is not null then (to_jsonb(s) ->> 'current_period_ends_at')::timestamptz else null end
      ) as current_period_ends_at,
      coalesce(
        case when nullif(to_jsonb(s) ->> 'created_at', '') is not null then (to_jsonb(s) ->> 'created_at')::timestamptz else null end,
        case when nullif(to_jsonb(s) ->> 'started_at', '') is not null then (to_jsonb(s) ->> 'started_at')::timestamptz else null end,
        timezone('utc', now())
      ) as created_at,
      coalesce(
        case when nullif(to_jsonb(s) ->> 'updated_at', '') is not null then (to_jsonb(s) ->> 'updated_at')::timestamptz else null end,
        case when nullif(to_jsonb(s) ->> 'started_at', '') is not null then (to_jsonb(s) ->> 'started_at')::timestamptz else null end,
        case when nullif(to_jsonb(s) ->> 'created_at', '') is not null then (to_jsonb(s) ->> 'created_at')::timestamptz else null end,
        timezone('utc', now())
      ) as updated_at,
      row_number() over (
        partition by nullif(coalesce(to_jsonb(sm) ->> 'store_id', to_jsonb(sm) ->> 'id'), '')::uuid
        order by
          case coalesce(to_jsonb(sm) ->> 'role', '') when 'owner' then 3 when 'manager' then 2 else 1 end desc,
          coalesce(
            case when nullif(to_jsonb(s) ->> 'updated_at', '') is not null then (to_jsonb(s) ->> 'updated_at')::timestamptz else null end,
            case when nullif(to_jsonb(s) ->> 'started_at', '') is not null then (to_jsonb(s) ->> 'started_at')::timestamptz else null end,
            case when nullif(to_jsonb(s) ->> 'created_at', '') is not null then (to_jsonb(s) ->> 'created_at')::timestamptz else null end,
            timezone('utc', now())
          ) desc
      ) as row_rank
    from public.store_members sm
    join public.subscriptions s
      on coalesce(to_jsonb(s) ->> 'user_id', to_jsonb(s) ->> 'profile_id', to_jsonb(s) ->> 'owner_id', '') =
         coalesce(to_jsonb(sm) ->> 'profile_id', to_jsonb(sm) ->> 'user_id', '')
    where nullif(coalesce(to_jsonb(sm) ->> 'store_id', to_jsonb(sm) ->> 'id'), '') is not null
  )
  select
    gen_random_uuid(),
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
  where store_id is not null
    and row_rank = 1
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
