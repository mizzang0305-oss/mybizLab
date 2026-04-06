create extension if not exists pgcrypto;

create or replace function public.normalize_customer_phone(input text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(coalesce(input, ''), '\D', '', 'g');
$$;

alter table if exists public.stores
  add column if not exists store_id uuid;

update public.stores
set store_id = coalesce(store_id, id)
where store_id is null;

alter table if exists public.stores
  alter column store_id set default gen_random_uuid();

create unique index if not exists stores_store_id_idx on public.stores (store_id);

alter table if exists public.stores
  add column if not exists plan text not null default 'free';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'stores'
      and constraint_name = 'stores_plan_check'
  ) then
    alter table public.stores drop constraint stores_plan_check;
  end if;
end;
$$;

alter table if exists public.stores
  add constraint stores_plan_check check (plan in ('free', 'pro', 'vip'));

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

insert into public.store_subscriptions (
  store_id,
  plan,
  status,
  created_at,
  updated_at
)
select
  s.store_id,
  case
    when coalesce(s.plan, '') in ('free', 'pro', 'vip') then s.plan
    when coalesce(s.plan, '') = 'starter' then 'free'
    when coalesce(s.plan, '') in ('business', 'enterprise') then 'vip'
    else 'free'
  end,
  case
    when br.subscription_status = 'subscription_active' then 'active'
    when br.subscription_status = 'subscription_past_due' then 'past_due'
    when br.subscription_status = 'subscription_cancelled' then 'cancelled'
    else 'trialing'
  end,
  timezone('utc', now()),
  timezone('utc', now())
from public.stores s
left join public.billing_records br on br.store_id = s.store_id
where s.store_id is not null
on conflict (store_id) do nothing;

alter table if exists public.customers
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('phone', 'email')),
  value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists customer_contacts_store_type_normalized_idx
  on public.customer_contacts (store_id, type, normalized_value);

create index if not exists customer_contacts_store_customer_idx
  on public.customer_contacts (store_id, customer_id);

create table if not exists public.customer_preferences (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  marketing_opt_in boolean not null default false,
  preferred_contact_channel text,
  seating_notes text,
  dietary_notes text,
  preference_tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (customer_id)
);

create index if not exists customer_preferences_store_customer_idx
  on public.customer_preferences (store_id, customer_id);

create table if not exists public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'customer_created',
      'contact_captured',
      'preference_updated',
      'note_added',
      'inquiry_captured',
      'reservation_captured',
      'waitlist_captured',
      'order_linked'
    )
  ),
  source text not null check (
    source in (
      'dashboard',
      'public_store',
      'public_inquiry',
      'public_waiting',
      'public_order',
      'system',
      'demo_seed'
    )
  ),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_timeline_events_store_customer_occurred_idx
  on public.customer_timeline_events (store_id, customer_id, occurred_at desc);

insert into public.customer_contacts (
  store_id,
  customer_id,
  type,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
select
  c.store_id,
  c.id,
  'phone',
  c.phone,
  public.normalize_customer_phone(c.phone),
  true,
  c.created_at,
  coalesce(c.updated_at, c.created_at)
from public.customers c
where nullif(trim(coalesce(c.phone, '')), '') is not null
on conflict (store_id, type, normalized_value) do nothing;

insert into public.customer_contacts (
  store_id,
  customer_id,
  type,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
select
  c.store_id,
  c.id,
  'email',
  lower(trim(c.email)),
  lower(trim(c.email)),
  false,
  c.created_at,
  coalesce(c.updated_at, c.created_at)
from public.customers c
where nullif(trim(coalesce(c.email, '')), '') is not null
on conflict (store_id, type, normalized_value) do nothing;

insert into public.customer_preferences (
  store_id,
  customer_id,
  marketing_opt_in,
  created_at,
  updated_at
)
select
  c.store_id,
  c.id,
  coalesce(c.marketing_opt_in, false),
  c.created_at,
  coalesce(c.updated_at, c.created_at)
from public.customers c
on conflict (customer_id) do nothing;

insert into public.customer_timeline_events (
  store_id,
  customer_id,
  event_type,
  source,
  summary,
  metadata,
  occurred_at,
  created_at
)
select
  c.store_id,
  c.id,
  'customer_created',
  'system',
  '고객 카드가 canonical memory spine으로 마이그레이션되었습니다.',
  jsonb_build_object(
    'email', c.email,
    'phone', c.phone,
    'visit_count', c.visit_count
  ),
  c.created_at,
  timezone('utc', now())
from public.customers c
where not exists (
  select 1
  from public.customer_timeline_events e
  where e.customer_id = c.id
    and e.event_type = 'customer_created'
);

drop trigger if exists trg_store_subscriptions_set_updated_at on public.store_subscriptions;
create trigger trg_store_subscriptions_set_updated_at
before update on public.store_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_contacts_set_updated_at on public.customer_contacts;
create trigger trg_customer_contacts_set_updated_at
before update on public.customer_contacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_preferences_set_updated_at on public.customer_preferences;
create trigger trg_customer_preferences_set_updated_at
before update on public.customer_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_set_updated_at on public.customers;
create trigger trg_customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

alter table public.store_subscriptions enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.customer_timeline_events enable row level security;

drop policy if exists "store_subscriptions_member_access" on public.store_subscriptions;
create policy "store_subscriptions_member_access"
on public.store_subscriptions
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "customer_contacts_member_access" on public.customer_contacts;
create policy "customer_contacts_member_access"
on public.customer_contacts
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "customer_preferences_member_access" on public.customer_preferences;
create policy "customer_preferences_member_access"
on public.customer_preferences
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "customer_timeline_events_member_access" on public.customer_timeline_events;
create policy "customer_timeline_events_member_access"
on public.customer_timeline_events
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
