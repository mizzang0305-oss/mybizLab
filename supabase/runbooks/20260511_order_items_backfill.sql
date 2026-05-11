-- MyBiz PR #85: manual order_items backfill runbook.
-- Do not run this automatically. Execute section-by-section in Supabase SQL editor.
-- Apply supabase/migrations/20260511_order_items_canonical.sql first.
-- The reviewed insert block includes BEGIN/ROLLBACK by default.

-- ---------------------------------------------------------------------------
-- 1) Manual schema inspection
-- ---------------------------------------------------------------------------

select
  to_regclass('public.order_items') as order_items_table;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
order by ordinal_position;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'order_items'
order by ordinal_position;

-- ---------------------------------------------------------------------------
-- 2) Dry-run count and preview
-- ---------------------------------------------------------------------------

with
order_scope as (
  select
    to_jsonb(o) as order_row,
    o.store_id,
    nullif(to_jsonb(o) ->> 'id', '') as order_pk_text,
    coalesce(nullif(to_jsonb(o) ->> 'order_id', ''), nullif(to_jsonb(o) ->> 'id', '')) as source_order_key,
    nullif(to_jsonb(o) ->> 'customer_id', '') as customer_id_text
  from public.orders o
  where o.store_id is not null
),
raw_arrays as (
  select
    os.store_id,
    os.order_pk_text,
    os.source_order_key,
    os.customer_id_text,
    candidate.item_array
  from order_scope os
  cross join lateral (
    values
      (os.order_row -> 'items'),
      (os.order_row -> 'line_items'),
      (os.order_row -> 'order_items'),
      (os.order_row #> '{raw,items}'),
      (os.order_row #> '{payload,items}'),
      (os.order_row #> '{metadata,items}')
  ) as candidate(item_array)
),
raw_items as (
  select
    ra.store_id,
    ra.order_pk_text,
    ra.source_order_key,
    ra.customer_id_text,
    item_payload,
    item_index
  from raw_arrays ra
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(ra.item_array) = 'array' then ra.item_array
      else '[]'::jsonb
    end
  ) with ordinality as item(item_payload, item_index)
),
safe_candidates as (
  select
    ri.store_id,
    ri.order_pk_text,
    ri.source_order_key,
    case
      when ri.customer_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ri.customer_id_text::uuid
      else null
    end as customer_id,
    nullif(coalesce(
      ri.item_payload ->> 'item_name',
      ri.item_payload ->> 'menu_name',
      ri.item_payload ->> 'name',
      ri.item_payload ->> 'title'
    ), '') as item_name,
    nullif(coalesce(
      ri.item_payload ->> 'option_summary',
      ri.item_payload ->> 'optionSummary',
      ri.item_payload ->> 'options'
    ), '') as option_summary,
    case
      when coalesce(ri.item_payload ->> 'quantity', ri.item_payload ->> 'qty') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, coalesce(ri.item_payload ->> 'quantity', ri.item_payload ->> 'qty')::numeric)
      else 1
    end as quantity,
    case
      when coalesce(ri.item_payload ->> 'unit_price', ri.item_payload ->> 'unitPrice', ri.item_payload ->> 'price') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, coalesce(ri.item_payload ->> 'unit_price', ri.item_payload ->> 'unitPrice', ri.item_payload ->> 'price')::numeric)::integer
      else null
    end as unit_price,
    case
      when coalesce(ri.item_payload ->> 'total_price', ri.item_payload ->> 'totalPrice', ri.item_payload ->> 'line_total', ri.item_payload ->> 'lineTotal') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, coalesce(ri.item_payload ->> 'total_price', ri.item_payload ->> 'totalPrice', ri.item_payload ->> 'line_total', ri.item_payload ->> 'lineTotal')::numeric)::integer
      else null
    end as total_price,
    ri.item_payload,
    ri.item_index
  from raw_items ri
),
insertable_candidates as (
  select *
  from safe_candidates sc
  where sc.source_order_key is not null
    and sc.item_name is not null
    and sc.item_name !~ '^\?+$'
    and sc.item_name not like '%�%'
    and sc.quantity >= 0
    and not exists (
      select 1
      from public.order_items oi
      where oi.store_id = sc.store_id
        and (
          oi.order_id::text = sc.order_pk_text
          or oi.order_id_text = sc.source_order_key
          or oi.source_order_key = sc.source_order_key
        )
        and coalesce(nullif(oi.item_name, ''), nullif(oi.menu_name, '')) = sc.item_name
        and oi.quantity = sc.quantity
    )
)
select
  count(*) as dry_run_insertable_order_item_count
from insertable_candidates;

with
order_scope as (
  select
    to_jsonb(o) as order_row,
    o.store_id,
    nullif(to_jsonb(o) ->> 'id', '') as order_pk_text,
    coalesce(nullif(to_jsonb(o) ->> 'order_id', ''), nullif(to_jsonb(o) ->> 'id', '')) as source_order_key,
    nullif(to_jsonb(o) ->> 'customer_id', '') as customer_id_text
  from public.orders o
  where o.store_id is not null
),
raw_arrays as (
  select os.*, candidate.item_array
  from order_scope os
  cross join lateral (
    values
      (os.order_row -> 'items'),
      (os.order_row -> 'line_items'),
      (os.order_row -> 'order_items'),
      (os.order_row #> '{raw,items}'),
      (os.order_row #> '{payload,items}'),
      (os.order_row #> '{metadata,items}')
  ) as candidate(item_array)
),
raw_items as (
  select
    ra.store_id,
    ra.order_pk_text,
    ra.source_order_key,
    item_payload,
    item_index
  from raw_arrays ra
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(ra.item_array) = 'array' then ra.item_array
      else '[]'::jsonb
    end
  ) with ordinality as item(item_payload, item_index)
)
select
  store_id,
  order_pk_text,
  source_order_key,
  item_payload,
  item_index
from raw_items
limit 25;

-- ---------------------------------------------------------------------------
-- 3) Reviewed insert block
-- ---------------------------------------------------------------------------
-- Keep ROLLBACK while reviewing. Change to COMMIT only after the dry-run count
-- and preview are reviewed. Existing order_items rows are never overwritten.

BEGIN;

with
order_scope as (
  select
    to_jsonb(o) as order_row,
    o.store_id,
    nullif(to_jsonb(o) ->> 'id', '') as order_pk_text,
    coalesce(nullif(to_jsonb(o) ->> 'order_id', ''), nullif(to_jsonb(o) ->> 'id', '')) as source_order_key,
    nullif(to_jsonb(o) ->> 'customer_id', '') as customer_id_text
  from public.orders o
  where o.store_id is not null
),
raw_arrays as (
  select
    os.store_id,
    os.order_pk_text,
    os.source_order_key,
    os.customer_id_text,
    candidate.item_array
  from order_scope os
  cross join lateral (
    values
      (os.order_row -> 'items'),
      (os.order_row -> 'line_items'),
      (os.order_row -> 'order_items'),
      (os.order_row #> '{raw,items}'),
      (os.order_row #> '{payload,items}'),
      (os.order_row #> '{metadata,items}')
  ) as candidate(item_array)
),
raw_items as (
  select
    ra.store_id,
    ra.order_pk_text,
    ra.source_order_key,
    ra.customer_id_text,
    item_payload,
    item_index
  from raw_arrays ra
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(ra.item_array) = 'array' then ra.item_array
      else '[]'::jsonb
    end
  ) with ordinality as item(item_payload, item_index)
),
safe_candidates as (
  select
    ri.store_id,
    ri.order_pk_text,
    ri.source_order_key,
    case
      when ri.customer_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ri.customer_id_text::uuid
      else null
    end as customer_id,
    nullif(coalesce(
      ri.item_payload ->> 'item_name',
      ri.item_payload ->> 'menu_name',
      ri.item_payload ->> 'name',
      ri.item_payload ->> 'title'
    ), '') as item_name,
    nullif(coalesce(
      ri.item_payload ->> 'option_summary',
      ri.item_payload ->> 'optionSummary',
      ri.item_payload ->> 'options'
    ), '') as option_summary,
    case
      when coalesce(ri.item_payload ->> 'quantity', ri.item_payload ->> 'qty') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, coalesce(ri.item_payload ->> 'quantity', ri.item_payload ->> 'qty')::numeric)
      else 1
    end as quantity,
    case
      when coalesce(ri.item_payload ->> 'unit_price', ri.item_payload ->> 'unitPrice', ri.item_payload ->> 'price') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, coalesce(ri.item_payload ->> 'unit_price', ri.item_payload ->> 'unitPrice', ri.item_payload ->> 'price')::numeric)::integer
      else null
    end as unit_price,
    case
      when coalesce(ri.item_payload ->> 'total_price', ri.item_payload ->> 'totalPrice', ri.item_payload ->> 'line_total', ri.item_payload ->> 'lineTotal') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, coalesce(ri.item_payload ->> 'total_price', ri.item_payload ->> 'totalPrice', ri.item_payload ->> 'line_total', ri.item_payload ->> 'lineTotal')::numeric)::integer
      else null
    end as total_price,
    ri.item_payload,
    ri.item_index
  from raw_items ri
),
insertable_candidates as (
  select *
  from safe_candidates sc
  where sc.source_order_key is not null
    and sc.item_name is not null
    and sc.item_name !~ '^\?+$'
    and sc.item_name not like '%�%'
    and sc.quantity >= 0
    and not exists (
      select 1
      from public.order_items oi
      where oi.store_id = sc.store_id
        and (
          oi.order_id::text = sc.order_pk_text
          or oi.order_id_text = sc.source_order_key
          or oi.source_order_key = sc.source_order_key
        )
        and coalesce(nullif(oi.item_name, ''), nullif(oi.menu_name, '')) = sc.item_name
        and oi.quantity = sc.quantity
    )
),
inserted_order_items as (
  insert into public.order_items (
    order_id,
    order_id_text,
    source_order_key,
    store_id,
    customer_id,
    item_name,
    menu_name,
    option_summary,
    quantity,
    unit_price,
    line_total,
    total_price,
    currency,
    source,
    raw
  )
  select
    case
      when ic.order_pk_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ic.order_pk_text::uuid
      else null
    end,
    ic.source_order_key,
    ic.source_order_key,
    ic.store_id,
    ic.customer_id,
    ic.item_name,
    ic.item_name,
    ic.option_summary,
    ic.quantity,
    ic.unit_price,
    coalesce(ic.total_price, coalesce(ic.unit_price, 0) * ic.quantity),
    coalesce(ic.total_price, coalesce(ic.unit_price, 0) * ic.quantity),
    'KRW',
    'orders_raw_backfill',
    ic.item_payload
  from insertable_candidates ic
  returning store_id, source_order_key, item_name, quantity
)
select
  count(*) as inserted_order_item_count
from inserted_order_items;

-- Post-insert verification query.
select
  store_id,
  count(*) as order_items_count
from public.order_items
group by store_id
order by order_items_count desc
limit 25;

-- Rollback note: this runbook inserts only rows with source='orders_raw_backfill'.
-- To revert a reviewed run, delete by that source plus the reviewed store/order
-- scope, never by a broad delete.

ROLLBACK;
