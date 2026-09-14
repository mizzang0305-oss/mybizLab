-- CI-ONLY Production-shaped dependency fixture for Service OS foundation.
-- Synthetic rows only. Never apply or seed this file on a linked database.

begin;

create extension if not exists pgcrypto;

create table public.profiles (
  -- Production has no profiles.id -> auth.users.id FK.
  id uuid primary key,
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.stores (
  store_id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'FREE',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff',
  unique (store_id, profile_id)
);

create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(store_id) on delete cascade,
  plan text not null default 'FREE',
  status text not null default 'active'
);

create table public.customers (
  customer_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_key text not null,
  unique (store_id, customer_key)
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id) on delete cascade,
  contact_type text not null check (contact_type in ('phone', 'email', 'other')),
  raw_value text,
  normalized_value text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, contact_type, normalized_value)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid references public.customers(customer_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid not null references public.customers(customer_id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.platform_admin_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  role text not null default 'platform_admin'
);

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members sm
    where sm.store_id = target_store_id
      and sm.profile_id = auth.uid()
  );
$$;

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.inquiries enable row level security;
alter table public.customer_timeline_events enable row level security;

commit;
