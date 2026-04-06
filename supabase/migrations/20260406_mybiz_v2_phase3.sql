create table if not exists public.store_public_pages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  slug text not null,
  brand_name text not null,
  logo_url text,
  brand_color text not null default '#ec5b13',
  tagline text not null default '',
  description text not null default '',
  business_type text,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  directions text not null default '',
  opening_hours text,
  parking_note text,
  public_status text not null default 'public' check (public_status in ('draft', 'preview', 'public')),
  homepage_visible boolean not null default true,
  consultation_enabled boolean not null default true,
  inquiry_enabled boolean not null default false,
  reservation_enabled boolean not null default false,
  order_entry_enabled boolean not null default false,
  theme_preset text check (theme_preset in ('light', 'warm', 'modern')),
  preview_target text check (preview_target in ('survey', 'order', 'inquiry')),
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_description text not null default '',
  primary_cta_label text,
  mobile_cta_label text,
  cta_config jsonb not null default '{}'::jsonb,
  content_blocks jsonb not null default '[]'::jsonb,
  seo_metadata jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  notices jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (store_id),
  unique (slug)
);

create table if not exists public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  public_page_id uuid references public.store_public_pages(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  inquiry_id uuid,
  reservation_id uuid references public.reservations(id) on delete set null,
  waiting_entry_id uuid references public.waiting_entries(id) on delete set null,
  visitor_token text not null,
  channel text not null check (channel in ('home', 'menu', 'order', 'survey', 'inquiry')),
  entry_path text not null,
  last_path text not null,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  inquiry_id uuid,
  visitor_session_id uuid references public.visitor_sessions(id) on delete set null,
  channel text not null check (channel in ('public_inquiry', 'ai_chat', 'dashboard_manual')),
  status text not null default 'open' check (status in ('open', 'closed')),
  subject text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  conversation_session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  inquiry_id uuid,
  sender text not null check (sender in ('customer', 'assistant', 'staff', 'system')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  conversation_session_id uuid references public.conversation_sessions(id) on delete set null,
  visitor_session_id uuid references public.visitor_sessions(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  category text not null check (category in ('general', 'reservation', 'group_booking', 'event', 'brand')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed')),
  message text not null,
  tags jsonb not null default '[]'::jsonb,
  memo text not null default '',
  marketing_opt_in boolean not null default false,
  requested_visit_date date,
  source text not null default 'public_form' check (source in ('public_form', 'owner_manual')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'conversation_sessions'
      and constraint_name = 'conversation_sessions_inquiry_id_fkey'
  ) then
    alter table public.conversation_sessions
      add constraint conversation_sessions_inquiry_id_fkey
      foreign key (inquiry_id) references public.inquiries(id) on delete set null;
  end if;
end;
$$;

alter table if exists public.inquiries
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table if exists public.inquiries
  add column if not exists conversation_session_id uuid references public.conversation_sessions(id) on delete set null;

alter table if exists public.inquiries
  add column if not exists visitor_session_id uuid references public.visitor_sessions(id) on delete set null;

alter table if exists public.inquiries
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.reservations
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table if exists public.reservations
  add column if not exists visitor_session_id uuid references public.visitor_sessions(id) on delete set null;

alter table if exists public.reservations
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.waiting_entries
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table if exists public.waiting_entries
  add column if not exists visitor_session_id uuid references public.visitor_sessions(id) on delete set null;

alter table if exists public.waiting_entries
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'customer_timeline_events'
      and constraint_name = 'customer_timeline_events_event_type_check'
  ) then
    alter table public.customer_timeline_events drop constraint customer_timeline_events_event_type_check;
  end if;
end;
$$;

alter table public.customer_timeline_events
  add constraint customer_timeline_events_event_type_check
  check (
    event_type in (
      'customer_created',
      'contact_captured',
      'preference_updated',
      'note_added',
      'inquiry_captured',
      'reservation_captured',
      'waitlist_captured',
      'order_linked',
      'reservation_updated',
      'waitlist_updated',
      'conversation_started',
      'conversation_message'
    )
  );

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'customer_timeline_events'
      and constraint_name = 'customer_timeline_events_source_check'
  ) then
    alter table public.customer_timeline_events drop constraint customer_timeline_events_source_check;
  end if;
end;
$$;

alter table public.customer_timeline_events
  add constraint customer_timeline_events_source_check
  check (
    source in (
      'dashboard',
      'public_store',
      'public_inquiry',
      'public_waiting',
      'public_order',
      'reservation',
      'waiting',
      'conversation',
      'system',
      'demo_seed'
    )
  );

create unique index if not exists store_public_pages_slug_idx
  on public.store_public_pages (slug);

create index if not exists visitor_sessions_store_token_idx
  on public.visitor_sessions (store_id, visitor_token);

create index if not exists visitor_sessions_store_last_seen_idx
  on public.visitor_sessions (store_id, last_seen_at desc);

create index if not exists conversation_sessions_store_updated_idx
  on public.conversation_sessions (store_id, updated_at desc);

create index if not exists conversation_messages_session_created_idx
  on public.conversation_messages (conversation_session_id, created_at asc);

create index if not exists inquiries_store_created_idx
  on public.inquiries (store_id, created_at desc);

create index if not exists inquiries_store_customer_idx
  on public.inquiries (store_id, customer_id);

create index if not exists reservations_store_customer_reserved_idx
  on public.reservations (store_id, customer_id, reserved_at);

create index if not exists waiting_entries_store_customer_created_idx
  on public.waiting_entries (store_id, customer_id, created_at desc);

drop trigger if exists trg_store_public_pages_set_updated_at on public.store_public_pages;
create trigger trg_store_public_pages_set_updated_at
before update on public.store_public_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_visitor_sessions_set_updated_at on public.visitor_sessions;
create trigger trg_visitor_sessions_set_updated_at
before update on public.visitor_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_conversation_sessions_set_updated_at on public.conversation_sessions;
create trigger trg_conversation_sessions_set_updated_at
before update on public.conversation_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_inquiries_set_updated_at on public.inquiries;
create trigger trg_inquiries_set_updated_at
before update on public.inquiries
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservations_set_updated_at on public.reservations;
create trigger trg_reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

drop trigger if exists trg_waiting_entries_set_updated_at on public.waiting_entries;
create trigger trg_waiting_entries_set_updated_at
before update on public.waiting_entries
for each row execute function public.set_updated_at();

insert into public.store_public_pages (
  store_id,
  slug,
  brand_name,
  logo_url,
  brand_color,
  tagline,
  description,
  business_type,
  phone,
  email,
  address,
  directions,
  opening_hours,
  parking_note,
  public_status,
  homepage_visible,
  consultation_enabled,
  inquiry_enabled,
  reservation_enabled,
  order_entry_enabled,
  hero_title,
  hero_subtitle,
  hero_description,
  primary_cta_label,
  mobile_cta_label,
  cta_config,
  content_blocks,
  seo_metadata,
  media,
  notices,
  created_at,
  updated_at
)
select
  s.store_id,
  s.slug,
  s.name,
  nullif(coalesce(to_jsonb(s) ->> 'logo_url', ''), ''),
  coalesce(to_jsonb(s) ->> 'brand_color', '#ec5b13'),
  coalesce(to_jsonb(s) ->> 'tagline', ''),
  coalesce(to_jsonb(s) ->> 'description', ''),
  nullif(coalesce(to_jsonb(s) ->> 'business_type', coalesce(to_jsonb(s) -> 'brand_config', '{}'::jsonb) ->> 'business_type', ''), ''),
  coalesce(to_jsonb(s) ->> 'phone', coalesce(to_jsonb(s) -> 'brand_config', '{}'::jsonb) ->> 'phone', ''),
  coalesce(to_jsonb(s) ->> 'email', coalesce(to_jsonb(s) -> 'brand_config', '{}'::jsonb) ->> 'email', ''),
  coalesce(to_jsonb(s) ->> 'address', coalesce(to_jsonb(s) -> 'brand_config', '{}'::jsonb) ->> 'address', ''),
  coalesce(shc.hero_subtitle, ''),
  nullif(coalesce(to_jsonb(s) ->> 'opening_hours', ''), ''),
  nullif(coalesce(to_jsonb(s) ->> 'parking_note', ''), ''),
  'public',
  true,
  true,
  case
    when exists (
      select 1
      from public.store_subscriptions ss
      where ss.store_id = s.store_id
        and ss.plan in ('pro', 'vip')
    ) then true
    else false
  end,
  case
    when exists (
      select 1
      from public.store_subscriptions ss
      where ss.store_id = s.store_id
        and ss.plan in ('pro', 'vip')
    ) then true
    else false
  end,
  coalesce(nullif(to_jsonb(s) ->> 'order_entry_enabled', '')::boolean, true),
  coalesce(nullif(shc.hero_title, ''), s.name),
  coalesce(nullif(shc.hero_subtitle, ''), to_jsonb(s) ->> 'tagline', ''),
  coalesce(nullif(shc.hero_description, ''), to_jsonb(s) ->> 'description', ''),
  nullif(to_jsonb(s) ->> 'primary_cta_label', ''),
  nullif(to_jsonb(s) ->> 'mobile_cta_label', ''),
  coalesce(shc.cta_config, '{}'::jsonb),
  coalesce(shc.content_blocks, '[]'::jsonb),
  coalesce(shc.seo_metadata, '{}'::jsonb),
  '[]'::jsonb,
  '[]'::jsonb,
  s.created_at,
  timezone('utc', now())
from public.stores s
left join public.store_home_content shc on shc.store_id = s.id
where s.store_id is not null
on conflict (store_id) do update
set
  slug = excluded.slug,
  brand_name = excluded.brand_name,
  brand_color = excluded.brand_color,
  tagline = excluded.tagline,
  description = excluded.description,
  business_type = excluded.business_type,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  hero_title = excluded.hero_title,
  hero_subtitle = excluded.hero_subtitle,
  hero_description = excluded.hero_description,
  cta_config = excluded.cta_config,
  content_blocks = excluded.content_blocks,
  seo_metadata = excluded.seo_metadata,
  updated_at = timezone('utc', now());

alter table public.store_public_pages enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.inquiries enable row level security;

drop policy if exists "store_public_pages_member_access" on public.store_public_pages;
create policy "store_public_pages_member_access"
on public.store_public_pages
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "store_public_pages_public_select" on public.store_public_pages;
create policy "store_public_pages_public_select"
on public.store_public_pages
for select
using (public_status = 'public' and homepage_visible = true);

drop policy if exists "visitor_sessions_member_access" on public.visitor_sessions;
create policy "visitor_sessions_member_access"
on public.visitor_sessions
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "conversation_sessions_member_access" on public.conversation_sessions;
create policy "conversation_sessions_member_access"
on public.conversation_sessions
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "conversation_messages_member_access" on public.conversation_messages;
create policy "conversation_messages_member_access"
on public.conversation_messages
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

drop policy if exists "inquiries_member_access" on public.inquiries;
create policy "inquiries_member_access"
on public.inquiries
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
