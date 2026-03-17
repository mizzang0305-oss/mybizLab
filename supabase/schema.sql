create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members sm
    where sm.store_id = target_store_id
      and sm.profile_id = auth.uid()
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_setup_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  business_name text not null,
  owner_name text not null,
  business_number text not null,
  phone text not null,
  email text not null,
  address text not null,
  business_type text not null,
  requested_slug text not null,
  selected_features jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'converted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_name text not null,
  business_number text not null,
  phone text not null,
  email text not null,
  address text not null,
  business_type text not null,
  logo_url text,
  brand_color text not null default '#ec5b13',
  tagline text not null default '',
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists stores_slug_idx on public.stores (slug);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, profile_id)
);

create table if not exists public.store_features (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, feature_key)
);

create table if not exists public.store_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  table_no text not null,
  seats integer not null default 4,
  qr_value text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, table_no)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null default 0,
  description text not null default '',
  is_popular boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  visit_count integer not null default 0,
  last_visit_at timestamptz,
  is_regular boolean not null default false,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, phone)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  table_id uuid references public.store_tables(id) on delete set null,
  table_no text,
  channel text not null check (channel in ('table', 'walk_in', 'delivery', 'reservation')),
  status text not null check (status in ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  total_amount numeric(12, 2) not null default 0,
  placed_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  note text
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  menu_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0
);

create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  table_id uuid references public.store_tables(id) on delete set null,
  table_no text,
  status text not null check (status in ('pending', 'accepted', 'preparing', 'ready', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  party_size integer not null default 2,
  reserved_at timestamptz not null,
  status text not null check (status in ('booked', 'seated', 'completed', 'cancelled', 'no_show')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.waiting_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  party_size integer not null default 2,
  quoted_wait_minutes integer not null default 10,
  status text not null check (status in ('waiting', 'called', 'seated', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  customer_name text not null,
  rating integer not null default 5,
  comment text not null default '',
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_schedules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  type text not null check (type in ('shift', 'task', 'meeting')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  assignee text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  counterparty text not null,
  status text not null check (status in ('draft', 'sent', 'signed')),
  file_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  report_type text not null check (report_type in ('daily', 'weekly')),
  title text not null,
  summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'fallback' check (source in ('gemini', 'fallback')),
  generated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales_daily (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sale_date date not null,
  order_count integer not null default 0,
  total_sales numeric(12, 2) not null default 0,
  average_order_value numeric(12, 2) not null default 0,
  channel_mix jsonb not null default '{}'::jsonb,
  unique (store_id, sale_date)
);

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

create table if not exists public.store_priority_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  weights jsonb not null default '{"revenue":28,"repeatCustomers":18,"reservations":16,"consultationConversion":12,"branding":12,"orderEfficiency":14}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  metric_date date not null,
  revenue_total numeric(12, 2) not null default 0,
  orders_count integer not null default 0,
  avg_order_value numeric(12, 2) not null default 0,
  new_customers integer not null default 0,
  repeat_customers integer not null default 0,
  repeat_customer_rate numeric(5, 2) not null default 0,
  reservation_count integer not null default 0,
  no_show_rate numeric(5, 2) not null default 0,
  consultation_count integer not null default 0,
  consultation_conversion_rate numeric(5, 2) not null default 0,
  review_count integer not null default 0,
  review_response_rate numeric(5, 2) not null default 0,
  operations_score numeric(5, 2) not null default 0,
  top_signals jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  unique (store_id, metric_date)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_store_setup_requests_set_updated_at on public.store_setup_requests;
create trigger trg_store_setup_requests_set_updated_at
before update on public.store_setup_requests
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_stores_set_updated_at on public.stores;
create trigger trg_stores_set_updated_at
before update on public.stores
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_kitchen_tickets_set_updated_at on public.kitchen_tickets;
create trigger trg_kitchen_tickets_set_updated_at
before update on public.kitchen_tickets
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_store_analytics_profiles_set_updated_at on public.store_analytics_profiles;
create trigger trg_store_analytics_profiles_set_updated_at
before update on public.store_analytics_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_store_priority_settings_set_updated_at on public.store_priority_settings;
create trigger trg_store_priority_settings_set_updated_at
before update on public.store_priority_settings
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.store_setup_requests enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_features enable row level security;
alter table public.store_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.kitchen_tickets enable row level security;
alter table public.reservations enable row level security;
alter table public.waiting_entries enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
alter table public.store_schedules enable row level security;
alter table public.contracts enable row level security;
alter table public.ai_reports enable row level security;
alter table public.sales_daily enable row level security;
alter table public.store_analytics_profiles enable row level security;
alter table public.store_priority_settings enable row level security;
alter table public.store_daily_metrics enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "setup_requests_manage_own"
on public.store_setup_requests
for all
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy "stores_select_member"
on public.stores
for select
using (public.is_store_member(id));

create policy "stores_insert_authenticated"
on public.stores
for insert
with check (auth.uid() is not null);

create policy "stores_update_member"
on public.stores
for update
using (public.is_store_member(id))
with check (public.is_store_member(id));

create policy "store_members_select_member"
on public.store_members
for select
using (public.is_store_member(store_id));

create policy "store_members_insert_member"
on public.store_members
for insert
with check (public.is_store_member(store_id) or auth.uid() = profile_id);

create policy "store_members_update_member"
on public.store_members
for update
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "store_features_member_access"
on public.store_features
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "store_tables_member_access"
on public.store_tables
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "menu_categories_member_access"
on public.menu_categories
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "menu_items_member_access"
on public.menu_items
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "customers_member_access"
on public.customers
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "orders_member_access"
on public.orders
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "order_items_member_access"
on public.order_items
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "kitchen_tickets_member_access"
on public.kitchen_tickets
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "reservations_member_access"
on public.reservations
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "waiting_entries_member_access"
on public.waiting_entries
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "surveys_member_access"
on public.surveys
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "survey_responses_member_access"
on public.survey_responses
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "store_schedules_member_access"
on public.store_schedules
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "contracts_member_access"
on public.contracts
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "ai_reports_member_access"
on public.ai_reports
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "sales_daily_member_access"
on public.sales_daily
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "store_analytics_profiles_member_access"
on public.store_analytics_profiles
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "store_priority_settings_member_access"
on public.store_priority_settings
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create policy "store_daily_metrics_member_access"
on public.store_daily_metrics
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create index if not exists store_setup_requests_created_by_idx on public.store_setup_requests (created_by);
create index if not exists store_members_profile_store_idx on public.store_members (profile_id, store_id);
create index if not exists store_features_store_idx on public.store_features (store_id);
create index if not exists store_tables_store_idx on public.store_tables (store_id);
create index if not exists menu_categories_store_idx on public.menu_categories (store_id);
create index if not exists menu_items_store_idx on public.menu_items (store_id);
create index if not exists customers_store_idx on public.customers (store_id);
create index if not exists orders_store_status_idx on public.orders (store_id, status);
create index if not exists kitchen_tickets_store_status_idx on public.kitchen_tickets (store_id, status);
create index if not exists reservations_store_reserved_at_idx on public.reservations (store_id, reserved_at);
create index if not exists waiting_entries_store_status_idx on public.waiting_entries (store_id, status);
create index if not exists survey_responses_store_idx on public.survey_responses (store_id);
create index if not exists schedules_store_starts_at_idx on public.store_schedules (store_id, starts_at);
create index if not exists contracts_store_idx on public.contracts (store_id);
create index if not exists ai_reports_store_generated_idx on public.ai_reports (store_id, generated_at desc);
create index if not exists sales_daily_store_date_idx on public.sales_daily (store_id, sale_date desc);
create index if not exists store_analytics_profiles_store_idx on public.store_analytics_profiles (store_id);
create index if not exists store_priority_settings_store_idx on public.store_priority_settings (store_id);
create index if not exists store_daily_metrics_store_date_idx on public.store_daily_metrics (store_id, metric_date desc);

create table if not exists public.billing_webhook_events (
  webhook_id text primary key,
  portone_event_type text not null,
  normalized_status text not null,
  actions text[] not null default '{}',
  portone_store_id text,
  payment_id text,
  billing_key text,
  transaction_id text,
  cancellation_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_webhook_states (
  source_key text primary key,
  portone_store_id text,
  payment_id text,
  billing_key text,
  last_event_type text not null,
  normalized_status text not null,
  actions text[] not null default '{}',
  payment_status text,
  billing_key_status text,
  subscription_status text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists billing_webhook_events_store_idx on public.billing_webhook_events (portone_store_id, processed_at desc);
create index if not exists billing_webhook_events_payment_idx on public.billing_webhook_events (payment_id);
create index if not exists billing_webhook_states_store_idx on public.billing_webhook_states (portone_store_id, updated_at desc);
