begin;

create extension if not exists pgcrypto;

create table public.stores (
  store_id uuid primary key,
  slug text unique,
  name text not null default 'Synthetic Store'
);

create table public.store_members (
  store_id uuid not null,
  profile_id uuid not null,
  role text not null default 'owner',
  primary key (store_id, profile_id)
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

create or replace function public.generate_unique_store_slug(base_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  suffix_num int := 1;
begin
  base_slug := lower(coalesce(base_name, 'store'));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-{2,}', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'store'; end if;
  candidate := base_slug;
  while exists (select 1 from public.stores s where s.slug = candidate) loop
    suffix_num := suffix_num + 1;
    candidate := base_slug || '-' || suffix_num::text;
  end loop;
  return candidate;
end;
$$;

create table public.store_tables (
  table_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  table_no integer not null,
  status text not null default 'available',
  status_updated_at timestamptz not null default now()
);

create table public.sessions (
  session_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  table_id uuid,
  customer_id uuid,
  channel text not null default 'qr_web',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  user_agent text,
  ip_hash text
);

create table public.orders (
  order_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  table_id uuid,
  session_id uuid,
  status text not null default 'draft',
  total_amount integer not null default 0,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  payment_status text not null default 'pending',
  payment_source text,
  payment_method text,
  payment_recorded_at timestamptz,
  customer_id uuid
);

create table public.events (
  event_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  actor text not null default 'system',
  type text not null default 'synthetic',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.menu_categories (
  category_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  name text not null
);

create table public.menu_items (
  menu_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  category_id uuid,
  name text not null,
  price integer not null default 0,
  is_active boolean not null default true
);

create table public.store_staff (
  store_id uuid not null,
  user_id uuid not null,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table public.store_modules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  module_key text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_briefing_logs (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  snapshot_id text,
  action_title text,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table public.store_analytics_profile (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  industry text,
  region text,
  customer_focus text,
  analytics_preset text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer default 1
);

create table public.store_priority_settings (
  id uuid primary key default gen_random_uuid(),
  store_id text not null unique,
  revenue_weight numeric,
  repeat_customer_weight numeric,
  reservation_weight numeric,
  consultation_weight numeric,
  branding_weight numeric,
  order_efficiency_weight numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer default 1
);

create table public.store_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  metric_date date not null default current_date,
  revenue_total numeric,
  created_at timestamptz default now(),
  version integer default 1
);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  period_type text,
  summary text,
  created_at timestamptz default now(),
  version integer default 1
);

create table public.store_home_content (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  hero_title text,
  hero_subtitle text,
  notice_text text,
  updated_at timestamptz default now(),
  version integer default 1
);

create table public.store_setup_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  business_name text not null,
  owner_name text not null,
  selected_features jsonb not null default '[]'::jsonb,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requested_plan text not null default 'free'
);

-- Reproduce the Production vulnerability: broad CRUD grants with RLS disabled.
grant select, insert, update, delete on public.store_tables to anon, authenticated, service_role;
grant select, insert, update, delete on public.sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.orders to anon, authenticated, service_role;
grant select, insert, update, delete on public.events to anon, authenticated, service_role;
grant select, insert, update, delete on public.menu_categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.menu_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_staff to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_modules to anon, authenticated, service_role;
grant select, insert, update, delete on public.ai_briefing_logs to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_analytics_profile to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_priority_settings to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_daily_metrics to anon, authenticated, service_role;
grant select, insert, update, delete on public.ai_reports to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_home_content to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_setup_requests to anon, authenticated, service_role;

-- Production has these policies but RLS is currently disabled.
create policy "setup_requests_select_own"
on public.store_setup_requests
for select
using (auth.uid() = created_by);

create policy "setup_requests_update_own"
on public.store_setup_requests
for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

commit;
