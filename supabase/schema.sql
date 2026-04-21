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
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.store_members sm
    where sm.store_id = target_store_id
      and sm.profile_id = auth.uid()
  );
$$;

create or replace function public.slugify_store_value(input text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  normalized text;
begin
  normalized := lower(coalesce(input, ''));
  normalized := regexp_replace(normalized, '[^a-z0-9]+', '-', 'g');
  normalized := regexp_replace(normalized, '(^-+|-+$)', '', 'g');
  normalized := regexp_replace(normalized, '-{2,}', '-', 'g');
  return normalized;
end;
$$;

drop function if exists public.create_store_with_owner(text, text, text, text, text, text, text, text);

create or replace function public.create_store_with_owner(
  p_store_name text,
  p_owner_name text,
  p_business_number text,
  p_phone text,
  p_email text,
  p_address text,
  p_business_type text,
  p_requested_slug text default null,
  p_owner_profile_id uuid default null
)
returns public.stores
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_profile_email text;
  v_profile_name text;
  v_region text;
  v_customer_focus text;
  v_analytics_preset text;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_created_store public.stores;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    if auth.role() = 'service_role' and p_owner_profile_id is not null then
      v_actor_id := p_owner_profile_id;
    else
      raise exception 'AUTHENTICATION_REQUIRED'
        using errcode = '42501', hint = 'create_store_with_owner requires an authenticated owner or a service-role call with p_owner_profile_id.';
    end if;
  end if;

  if nullif(trim(coalesce(p_store_name, '')), '') is null then
    raise exception 'STORE_NAME_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_owner_name, '')), '') is null then
    raise exception 'OWNER_NAME_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_business_number, '')), '') is null then
    raise exception 'BUSINESS_NUMBER_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'PHONE_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'EMAIL_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_address, '')), '') is null then
    raise exception 'ADDRESS_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_business_type, '')), '') is null then
    raise exception 'BUSINESS_TYPE_REQUIRED' using errcode = '22023';
  end if;

  v_profile_email := lower(trim(coalesce(nullif(auth.jwt() ->> 'email', ''), p_email)));
  v_profile_name := trim(coalesce(nullif(p_owner_name, ''), split_part(v_profile_email, '@', 1)));

  insert into public.profiles (id, full_name, email, phone)
  values (v_actor_id, v_profile_name, v_profile_email, nullif(trim(p_phone), ''))
  on conflict (id) do update
  set
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = timezone('utc', now());

  v_base_slug := public.slugify_store_value(coalesce(nullif(trim(p_requested_slug), ''), p_store_name));
  if v_base_slug = '' then
    v_base_slug := 'store-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  v_slug := v_base_slug;
  while exists (
    select 1
    from public.stores s
    where s.slug = v_slug
  ) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  v_region := split_part(trim(coalesce(p_address, '')), ' ', 1);
  if v_region = '' then
    v_region := '미설정';
  end if;

  if p_business_type ilike '%카페%' or p_business_type ilike '%브런치%' or p_business_type ilike '%coffee%' then
    v_analytics_preset := 'seongsu_brunch_cafe';
    v_customer_focus := '직장인 점심·주말 방문';
  elsif p_business_type ilike '%고기%' or p_business_type ilike '%식당%' or p_business_type ilike '%외식%' or p_business_type ilike '%bbq%' then
    v_analytics_preset := 'mapo_evening_restaurant';
    v_customer_focus := '저녁 회식·예약 고객';
  else
    v_analytics_preset := 'consultation_service';
    v_customer_focus := '상담 전환 중심 고객';
  end if;

  insert into public.stores (
    name,
    slug,
    owner_name,
    business_number,
    phone,
    email,
    address,
    business_type
  )
  values (
    trim(p_store_name),
    v_slug,
    trim(p_owner_name),
    trim(p_business_number),
    trim(p_phone),
    trim(lower(p_email)),
    trim(p_address),
    trim(p_business_type)
  )
  returning * into v_created_store;

  insert into public.store_members (store_id, profile_id, role)
  values (v_created_store.id, v_actor_id, 'owner')
  on conflict (store_id, profile_id) do update
  set role = 'owner';

  insert into public.store_analytics_profiles (
    store_id,
    industry,
    region,
    customer_focus,
    analytics_preset,
    version
  )
  values (
    v_created_store.id,
    trim(p_business_type),
    v_region,
    v_customer_focus,
    v_analytics_preset,
    1
  )
  on conflict (store_id) do nothing;

  insert into public.store_priority_settings (
    store_id,
    weights,
    version
  )
  values (
    v_created_store.id,
    jsonb_build_object(
      'revenue', 28,
      'repeatCustomers', 18,
      'reservations', 16,
      'consultationConversion', 14,
      'branding', 12,
      'orderEfficiency', 12
    ),
    1
  )
  on conflict (store_id) do nothing;

  insert into public.store_home_content (
    store_id,
    hero_title,
    hero_subtitle,
    hero_description,
    cta_config,
    content_blocks,
    seo_metadata,
    version
  )
  values (
    v_created_store.id,
    trim(p_store_name),
    trim(p_business_type) || ' 운영을 한눈에 보여주는 스토어',
    '주문, 예약, 고객 데이터를 기반으로 운영 현황과 브랜드 정보를 함께 제공합니다.',
    jsonb_build_object(
      'primary', jsonb_build_object('label', '예약하기', 'enabled', true),
      'secondary', jsonb_build_object('label', '상담 요청', 'enabled', true)
    ),
    jsonb_build_array(
      jsonb_build_object(
        'type', 'hero-summary',
        'title', '운영 시작 준비 완료',
        'body', '기본 홈 콘텐츠와 운영 분석 설정이 자동으로 준비되었습니다.'
      )
    ),
    jsonb_build_object(
      'title', trim(p_store_name),
      'description', trim(p_store_name) || '의 공식 스토어 페이지입니다.'
    ),
    1
  )
  on conflict (store_id) do nothing;

  return v_created_store;
end;
$$;

revoke all on function public.create_store_with_owner(text, text, text, text, text, text, text, text, uuid) from public;
grant execute on function public.create_store_with_owner(text, text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.create_store_with_owner(text, text, text, text, text, text, text, text, uuid) to service_role;

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
  requested_plan text not null default 'free' check (requested_plan in ('free', 'pro', 'vip')),
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

create table if not exists public.store_home_content (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_description text not null default '',
  cta_config jsonb not null default '{}'::jsonb,
  content_blocks jsonb not null default '[]'::jsonb,
  seo_metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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

drop trigger if exists trg_store_home_content_set_updated_at on public.store_home_content;
create trigger trg_store_home_content_set_updated_at
before update on public.store_home_content
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
alter table public.store_home_content enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "setup_requests_manage_own" on public.store_setup_requests;
create policy "setup_requests_select_own"
on public.store_setup_requests
for select
using (auth.uid() = created_by);

create policy "setup_requests_update_own"
on public.store_setup_requests
for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy "stores_select_member"
on public.stores
for select
using (public.is_store_member(id));

drop policy if exists "stores_insert_authenticated" on public.stores;
drop policy if exists "stores_insert_via_rpc_only" on public.stores;
create policy "stores_insert_via_rpc_only"
on public.stores
for insert
with check (false);

create policy "stores_update_member"
on public.stores
for update
using (public.is_store_member(id))
with check (public.is_store_member(id));

create policy "store_members_select_member"
on public.store_members
for select
using (public.is_store_member(store_id));

drop policy if exists "store_members_insert_member" on public.store_members;
drop policy if exists "store_members_insert_existing_member" on public.store_members;
create policy "store_members_insert_existing_member"
on public.store_members
for insert
with check (public.is_store_member(store_id));

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

create policy "store_home_content_member_access"
on public.store_home_content
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

create index if not exists store_setup_requests_created_by_idx on public.store_setup_requests (created_by);
create index if not exists store_setup_requests_requested_slug_idx on public.store_setup_requests (requested_slug);
create index if not exists store_setup_requests_email_idx on public.store_setup_requests (email);
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
create index if not exists store_home_content_updated_idx on public.store_home_content (updated_at desc);

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
