-- Sales Excel import sync schema.
-- This migration is authored after the production baseline adoption marker.
-- It is not applied by this PR. Production execution requires separate approval.
-- RLS policies below are draft store-membership policies for review.
-- Do not replay archived pre-baseline migrations on production.

create table if not exists public.sales_import_batches (
  batch_id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  source_type text not null default 'excel_sales_import',
  file_name text not null,
  checksum text not null,
  date_range_start date not null,
  date_range_end date not null,
  org_unit text,
  part_no text,
  status text not null default 'preview_only'
    check (status in ('preview_only', 'applied', 'failed', 'superseded')),
  preview_summary jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  applied_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (store_id, checksum)
);

create index if not exists sales_import_batches_store_created_idx
on public.sales_import_batches (store_id, created_at desc);

create table if not exists public.sales_import_rows (
  row_id text primary key,
  batch_id text not null references public.sales_import_batches(batch_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  source_row_number integer not null,
  sheet_name text not null,
  row_hash text not null,
  row_metadata jsonb not null default '{}'::jsonb,
  rejected_reason text,
  created_at timestamptz not null default now(),
  unique (batch_id, sheet_name, source_row_number)
);

create index if not exists sales_import_rows_store_batch_idx
on public.sales_import_rows (store_id, batch_id);

create table if not exists public.sales_daily_import_records (
  record_id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  sales_date date not null,
  org_unit text,
  part_no text,
  source_type text not null default 'excel_sales_import',
  sync_key text not null,
  business_key_hash text not null,
  item_key_hash text not null,
  revenue_amount numeric(14, 2) not null default 0,
  received_amount numeric(14, 2) not null default 0,
  outstanding_amount numeric(14, 2) not null default 0,
  quantity numeric(14, 3) not null default 0,
  row_hash text not null,
  source_checksum text not null,
  sheet_name text not null,
  source_row_number integer not null,
  metadata jsonb not null default '{}'::jsonb,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by_batch_id text references public.sales_import_batches(batch_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (store_id, source_type, sync_key)
);

create index if not exists sales_daily_import_records_scope_idx
on public.sales_daily_import_records (store_id, source_type, sales_date, org_unit, part_no)
where is_deleted = false;

create index if not exists sales_daily_import_records_checksum_idx
on public.sales_daily_import_records (store_id, source_checksum);

create table if not exists public.sales_import_sync_results (
  result_id text primary key,
  batch_id text not null references public.sales_import_batches(batch_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  action text not null check (action in ('insert', 'update', 'soft_delete', 'unchanged', 'rejected')),
  sync_key text,
  record_id text,
  changed_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists sales_import_sync_results_batch_idx
on public.sales_import_sync_results (store_id, batch_id, action);

alter table public.sales_import_batches enable row level security;
alter table public.sales_import_rows enable row level security;
alter table public.sales_daily_import_records enable row level security;
alter table public.sales_import_sync_results enable row level security;

-- RLS draft, not executed separately from this migration:
-- create policy "sales_import_batches_member_select"
-- on public.sales_import_batches for select
-- using (public.is_store_member(store_id));
--
-- create policy "sales_import_batches_member_insert"
-- on public.sales_import_batches for insert
-- with check (public.is_store_member(store_id));
--
-- create policy "sales_import_records_member_select"
-- on public.sales_daily_import_records for select
-- using (public.is_store_member(store_id));
--
-- create policy "sales_import_records_member_write"
-- on public.sales_daily_import_records for all
-- using (public.is_store_member(store_id))
-- with check (public.is_store_member(store_id));
--
-- No GRANT or REVOKE statements are included in this PR.
