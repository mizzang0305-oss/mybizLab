begin;

create extension if not exists pgcrypto;

-- Synthetic Production-equivalent identity foundation. The Auth users are
-- created by the local Auth harness, never copied from Production.
create schema if not exists core;
create schema if not exists private;
create table core.profiles (
  id uuid primary key references auth.users(id),
  is_active boolean not null default true
);
create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  phone text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);
create table private.profile_auth_bindings (
  id uuid primary key default gen_random_uuid(),
  public_profile_id uuid not null references public.profiles(id),
  auth_profile_id uuid not null references core.profiles(id),
  binding_source text not null check (binding_source in ('EXACT_ID','OWNER_VERIFIED','MIGRATION_VERIFIED','ADMIN_VERIFIED')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  created_at timestamptz not null default timezone('utc', now()),
  verified_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (binding_source <> 'EXACT_ID' or public_profile_id = auth_profile_id),
  check ((status = 'ACTIVE' and revoked_at is null) or (status = 'REVOKED' and revoked_at is not null))
);
create unique index profile_auth_bindings_active_auth_uidx
  on private.profile_auth_bindings(auth_profile_id)
  where status = 'ACTIVE' and revoked_at is null;
create unique index profile_auth_bindings_active_public_uidx
  on private.profile_auth_bindings(public_profile_id)
  where status = 'ACTIVE' and revoked_at is null;
create index profile_auth_bindings_auth_lookup_idx
  on private.profile_auth_bindings(auth_profile_id, status);
alter table private.profile_auth_bindings enable row level security;
revoke all on private.profile_auth_bindings from public, anon, authenticated, service_role;

create table public.stores (
  store_id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null default 'Synthetic Store',
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  brand_config jsonb not null default '{}'::jsonb,
  trial_ends_at timestamptz,
  plan text,
  owner_name text,
  business_number text,
  phone text,
  email text,
  address text,
  business_type text
);

create table public.store_members (
  id uuid not null default gen_random_uuid(),
  store_id uuid not null,
  profile_id uuid not null,
  role text not null default 'staff' check (role in ('owner','manager','staff')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (id),
  unique (store_id, profile_id)
);
alter table public.store_members
  add constraint store_members_store_id_fkey foreign key (store_id)
  references public.stores(store_id) on delete cascade;
alter table public.store_members
  add constraint store_members_profile_id_fkey foreign key (profile_id)
  references public.profiles(id) on delete cascade;

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

-- The existing live provisioning body is installed as a separate CI-only
-- migration after all baseline tables exist. Never substitute an inert RPC.

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
  table_id uuid,
  session_id uuid,
  customer_id uuid,
  actor text not null default 'system',
  type text not null default 'synthetic',
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
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
  revenue_growth_rate numeric default 0,
  orders_count integer default 0,
  avg_order_value numeric default 0,
  new_customers integer default 0,
  repeat_customers integer default 0,
  repeat_customer_rate numeric default 0,
  reservation_count integer default 0,
  reservation_no_show_rate numeric default 0,
  consultation_count integer default 0,
  consultation_conversion_rate numeric default 0,
  review_count integer default 0,
  review_response_rate numeric default 0,
  operations_score numeric default 0,
  waiting_dropoff_rate numeric default 0,
  created_at timestamptz default now(),
  version integer default 1
);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  period_type text,
  period_start date,
  period_end date,
  operations_score numeric,
  top_bottlenecks jsonb,
  recommended_actions jsonb,
  expected_impact jsonb,
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
  contact_enabled boolean default true,
  consultation_enabled boolean default true,
  reservation_enabled boolean default true,
  layout_mode text default 'default',
  updated_at timestamptz default now(),
  version integer default 1
);

create table public.store_setup_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  business_name text not null,
  owner_name text not null,
  business_number text,
  phone text,
  email text,
  address text,
  business_type text,
  requested_slug text,
  selected_features jsonb not null default '[]'::jsonb,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requested_plan text not null default 'free',
  converted_store_id uuid
);

-- Existing live provisioning RPC writes the plural analytics table. It is
-- separate from the legacy singular target of this 15-table RLS gate.
create table public.store_analytics_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id),
  industry text,
  region text,
  customer_focus text,
  analytics_preset text,
  version integer default 1,
  updated_at timestamptz default now()
);
create index store_setup_requests_email_idx on public.store_setup_requests(email);
create index store_setup_requests_requested_slug_idx on public.store_setup_requests(requested_slug);

-- Non-target dependencies for actual server HTTP paths in the disposable
-- stack. These are synthetic route fixtures, not Production schema proof.
create table public.store_public_pages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(store_id),
  page_title text,
  hero_title text,
  hero_subtitle text,
  intro_text text,
  cta_primary_label text,
  cta_primary_target text,
  inquiry_enabled boolean not null default true,
  reservation_enabled boolean not null default false,
  waiting_enabled boolean not null default false,
  is_published boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id),
  plan text not null,
  status text not null default 'active',
  billing_provider text,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- The current public snapshot still checks this Production legacy fallback.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  tier text not null default 'free',
  status text not null default 'inactive',
  billing_key text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  last_payment_status text,
  last_order_id text,
  cancel_at timestamptz,
  updated_at timestamptz default now()
);
create table public.customers (
  customer_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id),
  customer_key text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  quiet_mode boolean not null default false,
  quiet_until timestamptz,
  marketing_consent boolean,
  tags jsonb not null default '{}'::jsonb
);
-- These legacy-shaped support relations are exercised by the current inquiry
-- repository fallback. They are outside the 15-table security target.
create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  contact_type text not null,
  normalized_value text not null,
  raw_value text,
  is_primary boolean default false,
  is_verified boolean default false,
  created_at timestamptz default now()
);
create table public.customer_preferences (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique,
  favorite_menus jsonb default '[]'::jsonb,
  disliked_items jsonb default '[]'::jsonb,
  allergy_notes text,
  seating_preferences text,
  visit_time_preferences text,
  marketing_consent boolean default false,
  memory_summary text,
  updated_at timestamptz default now()
);
create table public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  customer_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inquiry_id uuid,
  customer_id uuid,
  visitor_session_id uuid,
  channel text,
  status text,
  started_at timestamptz,
  ended_at timestamptz
);
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_session_id uuid not null,
  role text,
  content text,
  message_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id),
  customer_id uuid,
  conversation_session_id uuid,
  visitor_session_id uuid,
  customer_name text,
  phone text,
  email text,
  category text,
  status text,
  message text,
  tags jsonb not null default '[]'::jsonb,
  memo text,
  marketing_opt_in boolean default false,
  requested_visit_date text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.visitor_sessions (
  id uuid primary key,
  store_id uuid not null references public.stores(store_id),
  public_page_id uuid,
  customer_id uuid,
  inquiry_id uuid,
  reservation_id uuid,
  waiting_entry_id uuid,
  visitor_token text not null,
  channel text not null,
  entry_path text not null,
  last_path text not null,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.payment_events (
  event_id text primary key,
  order_id text not null,
  provider text not null,
  user_id uuid,
  status text not null,
  amount numeric not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.stores, public.profiles, public.store_members,
  public.store_public_pages, public.store_subscriptions, public.customers,
  public.inquiries, public.visitor_sessions, public.customer_contacts,
  public.customer_preferences, public.customer_timeline_events,
  public.conversation_sessions, public.conversation_messages,
  public.store_analytics_profiles to service_role;
grant select, insert, delete on public.payment_events to service_role;
grant select on public.subscriptions to service_role;
-- CI-only teardown permissions for synthetic Auth/store rows.
grant delete on public.profiles, public.stores, public.store_members to service_role;

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
