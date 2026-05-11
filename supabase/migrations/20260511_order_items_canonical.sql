-- MyBiz PR #85: order_items canonical foundation.
-- Additive only. Do not use this migration to backfill production data automatically.

create extension if not exists pgcrypto;

-- Live MyBiz schemas have used both `id` and domain-specific keys such as
-- `order_id`, `store_id`, `customer_id`, and `menu_id`. Keep this migration
-- additive and do not create direct foreign keys here; the read model joins by
-- safe text aliases until a schema-specific FK migration is reviewed.

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null default gen_random_uuid(),
  order_id uuid,
  order_id_text text,
  source_order_key text,
  store_id uuid not null,
  customer_id uuid,
  product_id uuid,
  menu_item_id uuid,
  item_name text not null,
  menu_name text not null,
  option_summary text,
  quantity numeric not null default 1,
  unit_price integer,
  line_total numeric(12, 2) not null default 0,
  total_price integer,
  currency text not null default 'KRW',
  source text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.order_items
  add column if not exists order_item_id uuid default gen_random_uuid(),
  add column if not exists order_id uuid,
  add column if not exists order_id_text text,
  add column if not exists source_order_key text,
  add column if not exists store_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists product_id uuid,
  add column if not exists menu_item_id uuid,
  add column if not exists item_name text,
  add column if not exists menu_name text,
  add column if not exists option_summary text,
  add column if not exists quantity numeric default 1,
  add column if not exists unit_price numeric,
  add column if not exists line_total numeric default 0,
  add column if not exists total_price integer,
  add column if not exists currency text default 'KRW',
  add column if not exists source text,
  add column if not exists raw jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

update public.order_items
set
  item_name = coalesce(nullif(item_name, ''), nullif(menu_name, ''), '메뉴'),
  menu_name = coalesce(nullif(menu_name, ''), nullif(item_name, ''), '메뉴'),
  quantity = coalesce(quantity, 1),
  line_total = coalesce(line_total, 0),
  currency = coalesce(nullif(currency, ''), 'KRW'),
  raw = coalesce(raw, '{}'::jsonb),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where item_name is null
   or item_name = ''
   or menu_name is null
   or menu_name = ''
   or quantity is null
   or line_total is null
   or currency is null
   or currency = ''
   or raw is null
   or created_at is null
   or updated_at is null;

alter table if exists public.order_items
  alter column order_item_id set default gen_random_uuid(),
  alter column item_name set not null,
  alter column menu_name set not null,
  alter column quantity set default 1,
  alter column line_total set default 0,
  alter column currency set not null,
  alter column currency set default 'KRW',
  alter column raw set not null,
  alter column raw set default '{}'::jsonb,
  alter column created_at set not null,
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set not null,
  alter column updated_at set default timezone('utc', now());

create unique index if not exists order_items_order_item_id_idx
  on public.order_items (order_item_id);

create index if not exists order_items_store_order_idx
  on public.order_items (store_id, order_id);

create index if not exists order_items_store_order_text_idx
  on public.order_items (store_id, order_id_text);

create index if not exists order_items_store_source_order_key_idx
  on public.order_items (store_id, source_order_key);

create index if not exists order_items_store_customer_idx
  on public.order_items (store_id, customer_id);

create index if not exists order_items_store_item_name_idx
  on public.order_items (store_id, item_name);

create index if not exists order_items_created_at_idx
  on public.order_items (created_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_quantity_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_quantity_nonnegative check (quantity >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_unit_price_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_unit_price_nonnegative check (unit_price is null or unit_price >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_total_price_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_total_price_nonnegative check (total_price is null or total_price >= 0) not valid;
  end if;
end;
$$;

alter table public.order_items enable row level security;

drop policy if exists "order_items_member_access" on public.order_items;

create policy "order_items_member_access"
on public.order_items
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
