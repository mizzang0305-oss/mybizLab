-- CI-ONLY baseline fixture for the ephemeral Stage 2 database certification.
--
-- The repository's first active migration is a comment-only Production baseline
-- adoption marker, so a fresh Supabase stack does not otherwise contain the
-- Production tables that later migrations and the Stage 2 draft reference.
-- This fixture recreates only the required shapes from supabase/schema.sql.
-- It must never be copied into the repository's active migration directory.

begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_name text not null,
  business_number text not null,
  phone text not null,
  email text not null,
  address text not null,
  business_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, profile_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default gen_random_uuid() unique,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id) on delete cascade,
  contact_type text not null check (contact_type in ('phone', 'email')),
  normalized_value text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(customer_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(customer_id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  counterparty text not null,
  status text not null check (status in ('draft', 'sent', 'signed')),
  file_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.store_members sm
    where sm.store_id = target_store_id
      and sm.profile_id = auth.uid()
  );
$$;

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.inquiries enable row level security;
alter table public.customer_timeline_events enable row level security;

commit;
