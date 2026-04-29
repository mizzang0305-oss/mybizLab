-- MyBiz order/customer canonical alignment runbook
-- Date: 2026-04-29
-- Purpose: Make orders.customer_id canonical without breaking the existing compat read path.
-- Status: MANUAL RUNBOOK ONLY. Do not apply automatically during app deploy.

-- 0) Pre-check live customer schema before running the migration body.
-- Live customers may not have columns such as name/customer_name/display_name.
-- The preview query below uses to_jsonb(c) so missing label columns do not break verification.
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customers'
order by ordinal_position;

begin;

-- 1) Add nullable canonical link. This is non-destructive and keeps legacy orders valid.
alter table public.orders
  add column if not exists customer_id uuid;

-- 2) Add FK only if customers.customer_id exists. If your live schema differs, stop and adapt.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'customer_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key (customer_id)
      references public.customers(customer_id)
      on delete set null;
  end if;
end $$;

-- 3) Candidate source rules used by count, preview, and final UPDATE.
--
-- Why this normalizes IDs as text:
-- - Live legacy orders.order_id is uuid.
-- - Live legacy payment_events.order_id can be text, while raw.order_id is also text.
-- - Direct uuid = text comparisons fail in Postgres.
-- - We therefore compare order IDs as text (o.order_id::text = order_id_text).
-- - We only cast customer_id_text::uuid after validating it with a UUID regex.
--
-- Why the CTE is repeated below:
-- - Supabase SQL Editor often runs selected statements independently.
-- - Session-scoped temp tables can disappear or never be created for a selected query.
-- - Each count/preview/update statement below is therefore self-contained.
--
-- To dry-run only, execute through the count/preview queries and rollback instead of commit.

-- 4) Dry-run candidate count. Inspect before running the final UPDATE.
with payment_order_links as (
  select distinct on (order_id_text)
    order_id_text,
    customer_id_text,
    observed_at
  from (
    select
      coalesce(
        nullif(to_jsonb(pe) ->> 'order_id', ''),
        nullif(to_jsonb(pe) -> 'raw' ->> 'order_id', ''),
        nullif(to_jsonb(pe) -> 'raw' ->> 'orderId', '')
      ) as order_id_text,
      nullif(
        coalesce(
          to_jsonb(pe) -> 'raw' ->> 'customer_id',
          to_jsonb(pe) -> 'raw' ->> 'customerId'
        ),
        ''
      ) as customer_id_text,
      pe.created_at as observed_at
    from public.payment_events pe
  ) pe
  where order_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and customer_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by order_id_text, observed_at desc
),
timeline_order_links as (
  select distinct on (store_id, order_id_text)
    store_id,
    order_id_text,
    customer_id,
    customer_id::text as customer_id_text,
    observed_at
  from (
    select
      store_id,
      coalesce(
        nullif(to_jsonb(timeline) -> 'payload' ->> 'order_id', ''),
        nullif(to_jsonb(timeline) -> 'payload' ->> 'orderId', '')
      ) as order_id_text,
      customer_id,
      created_at as observed_at
    from public.customer_timeline_events timeline
    where event_type = 'order_linked'
  ) t
  where order_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and customer_id is not null
  order by store_id, order_id_text, observed_at desc
),
candidate_links as (
  select
    o.order_id,
    o.store_id,
    c.customer_id,
    coalesce(
      nullif(to_jsonb(c) ->> 'name', ''),
      nullif(to_jsonb(c) ->> 'customer_name', ''),
      nullif(to_jsonb(c) ->> 'display_name', ''),
      nullif(to_jsonb(c) ->> 'full_name', ''),
      nullif(to_jsonb(c) ->> 'phone', ''),
      nullif(to_jsonb(c) ->> 'email', ''),
      '고객 정보 없음'
    ) as customer_label,
    p.order_id_text,
    p.customer_id_text,
    'payment_events.raw.customer_id'::text as source,
    1 as source_rank,
    p.observed_at
  from public.orders o
  join payment_order_links p
    on o.order_id::text = p.order_id_text
  join public.customers c
    on c.customer_id = p.customer_id_text::uuid
   and c.store_id::text = o.store_id::text
  where o.customer_id is null

  union all

  select
    o.order_id,
    o.store_id,
    c.customer_id,
    coalesce(
      nullif(to_jsonb(c) ->> 'name', ''),
      nullif(to_jsonb(c) ->> 'customer_name', ''),
      nullif(to_jsonb(c) ->> 'display_name', ''),
      nullif(to_jsonb(c) ->> 'full_name', ''),
      nullif(to_jsonb(c) ->> 'phone', ''),
      nullif(to_jsonb(c) ->> 'email', ''),
      '고객 정보 없음'
    ) as customer_label,
    t.order_id_text,
    t.customer_id_text,
    'customer_timeline_events.order_linked'::text as source,
    2 as source_rank,
    t.observed_at
  from public.orders o
  join timeline_order_links t
    on o.order_id::text = t.order_id_text
   and o.store_id::text = t.store_id::text
  join public.customers c
    on c.customer_id = t.customer_id
   and c.store_id::text = o.store_id::text
  where o.customer_id is null
),
ranked_candidates as (
  select
    *,
    row_number() over (
      partition by order_id
      order by source_rank asc, observed_at desc nulls last
    ) as candidate_rank
  from candidate_links
),
candidate_backfill as (
  select
    order_id,
    store_id,
    customer_id,
    customer_label,
    order_id_text,
    customer_id_text,
    source,
    observed_at
  from ranked_candidates
  where candidate_rank = 1
)
select
  source,
  count(*) as candidate_count
from candidate_backfill
group by source
order by source;

-- 5) Dry-run sample preview. Verify order/customer/store linkage before UPDATE.
with payment_order_links as (
  select distinct on (order_id_text)
    order_id_text,
    customer_id_text,
    observed_at
  from (
    select
      coalesce(
        nullif(to_jsonb(pe) ->> 'order_id', ''),
        nullif(to_jsonb(pe) -> 'raw' ->> 'order_id', ''),
        nullif(to_jsonb(pe) -> 'raw' ->> 'orderId', '')
      ) as order_id_text,
      nullif(
        coalesce(
          to_jsonb(pe) -> 'raw' ->> 'customer_id',
          to_jsonb(pe) -> 'raw' ->> 'customerId'
        ),
        ''
      ) as customer_id_text,
      pe.created_at as observed_at
    from public.payment_events pe
  ) pe
  where order_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and customer_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by order_id_text, observed_at desc
),
timeline_order_links as (
  select distinct on (store_id, order_id_text)
    store_id,
    order_id_text,
    customer_id,
    customer_id::text as customer_id_text,
    observed_at
  from (
    select
      store_id,
      coalesce(
        nullif(to_jsonb(timeline) -> 'payload' ->> 'order_id', ''),
        nullif(to_jsonb(timeline) -> 'payload' ->> 'orderId', '')
      ) as order_id_text,
      customer_id,
      created_at as observed_at
    from public.customer_timeline_events timeline
    where event_type = 'order_linked'
  ) t
  where order_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and customer_id is not null
  order by store_id, order_id_text, observed_at desc
),
candidate_links as (
  select
    o.order_id,
    o.store_id,
    c.customer_id,
    coalesce(
      nullif(to_jsonb(c) ->> 'name', ''),
      nullif(to_jsonb(c) ->> 'customer_name', ''),
      nullif(to_jsonb(c) ->> 'display_name', ''),
      nullif(to_jsonb(c) ->> 'full_name', ''),
      nullif(to_jsonb(c) ->> 'phone', ''),
      nullif(to_jsonb(c) ->> 'email', ''),
      '고객 정보 없음'
    ) as customer_label,
    p.order_id_text,
    p.customer_id_text,
    'payment_events.raw.customer_id'::text as source,
    1 as source_rank,
    p.observed_at
  from public.orders o
  join payment_order_links p
    on o.order_id::text = p.order_id_text
  join public.customers c
    on c.customer_id = p.customer_id_text::uuid
   and c.store_id::text = o.store_id::text
  where o.customer_id is null

  union all

  select
    o.order_id,
    o.store_id,
    c.customer_id,
    coalesce(
      nullif(to_jsonb(c) ->> 'name', ''),
      nullif(to_jsonb(c) ->> 'customer_name', ''),
      nullif(to_jsonb(c) ->> 'display_name', ''),
      nullif(to_jsonb(c) ->> 'full_name', ''),
      nullif(to_jsonb(c) ->> 'phone', ''),
      nullif(to_jsonb(c) ->> 'email', ''),
      '고객 정보 없음'
    ) as customer_label,
    t.order_id_text,
    t.customer_id_text,
    'customer_timeline_events.order_linked'::text as source,
    2 as source_rank,
    t.observed_at
  from public.orders o
  join timeline_order_links t
    on o.order_id::text = t.order_id_text
   and o.store_id::text = t.store_id::text
  join public.customers c
    on c.customer_id = t.customer_id
   and c.store_id::text = o.store_id::text
  where o.customer_id is null
),
ranked_candidates as (
  select
    *,
    row_number() over (
      partition by order_id
      order by source_rank asc, observed_at desc nulls last
    ) as candidate_rank
  from candidate_links
),
candidate_backfill as (
  select
    order_id,
    store_id,
    customer_id,
    customer_label,
    order_id_text,
    customer_id_text,
    source,
    observed_at
  from ranked_candidates
  where candidate_rank = 1
)
select
  order_id,
  store_id,
  customer_id,
  customer_label,
  source,
  order_id_text,
  customer_id_text,
  observed_at
from candidate_backfill
order by observed_at desc nulls last
limit 25;

-- 6) Final backfill. This does not overwrite existing orders.customer_id.
with payment_order_links as (
  select distinct on (order_id_text)
    order_id_text,
    customer_id_text,
    observed_at
  from (
    select
      coalesce(
        nullif(to_jsonb(pe) ->> 'order_id', ''),
        nullif(to_jsonb(pe) -> 'raw' ->> 'order_id', ''),
        nullif(to_jsonb(pe) -> 'raw' ->> 'orderId', '')
      ) as order_id_text,
      nullif(
        coalesce(
          to_jsonb(pe) -> 'raw' ->> 'customer_id',
          to_jsonb(pe) -> 'raw' ->> 'customerId'
        ),
        ''
      ) as customer_id_text,
      pe.created_at as observed_at
    from public.payment_events pe
  ) pe
  where order_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and customer_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by order_id_text, observed_at desc
),
timeline_order_links as (
  select distinct on (store_id, order_id_text)
    store_id,
    order_id_text,
    customer_id,
    customer_id::text as customer_id_text,
    observed_at
  from (
    select
      store_id,
      coalesce(
        nullif(to_jsonb(timeline) -> 'payload' ->> 'order_id', ''),
        nullif(to_jsonb(timeline) -> 'payload' ->> 'orderId', '')
      ) as order_id_text,
      customer_id,
      created_at as observed_at
    from public.customer_timeline_events timeline
    where event_type = 'order_linked'
  ) t
  where order_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and customer_id is not null
  order by store_id, order_id_text, observed_at desc
),
candidate_links as (
  select
    o.order_id,
    o.store_id,
    c.customer_id,
    coalesce(
      nullif(to_jsonb(c) ->> 'name', ''),
      nullif(to_jsonb(c) ->> 'customer_name', ''),
      nullif(to_jsonb(c) ->> 'display_name', ''),
      nullif(to_jsonb(c) ->> 'full_name', ''),
      nullif(to_jsonb(c) ->> 'phone', ''),
      nullif(to_jsonb(c) ->> 'email', ''),
      '고객 정보 없음'
    ) as customer_label,
    p.order_id_text,
    p.customer_id_text,
    'payment_events.raw.customer_id'::text as source,
    1 as source_rank,
    p.observed_at
  from public.orders o
  join payment_order_links p
    on o.order_id::text = p.order_id_text
  join public.customers c
    on c.customer_id = p.customer_id_text::uuid
   and c.store_id::text = o.store_id::text
  where o.customer_id is null

  union all

  select
    o.order_id,
    o.store_id,
    c.customer_id,
    coalesce(
      nullif(to_jsonb(c) ->> 'name', ''),
      nullif(to_jsonb(c) ->> 'customer_name', ''),
      nullif(to_jsonb(c) ->> 'display_name', ''),
      nullif(to_jsonb(c) ->> 'full_name', ''),
      nullif(to_jsonb(c) ->> 'phone', ''),
      nullif(to_jsonb(c) ->> 'email', ''),
      '고객 정보 없음'
    ) as customer_label,
    t.order_id_text,
    t.customer_id_text,
    'customer_timeline_events.order_linked'::text as source,
    2 as source_rank,
    t.observed_at
  from public.orders o
  join timeline_order_links t
    on o.order_id::text = t.order_id_text
   and o.store_id::text = t.store_id::text
  join public.customers c
    on c.customer_id = t.customer_id
   and c.store_id::text = o.store_id::text
  where o.customer_id is null
),
ranked_candidates as (
  select
    *,
    row_number() over (
      partition by order_id
      order by source_rank asc, observed_at desc nulls last
    ) as candidate_rank
  from candidate_links
),
candidate_backfill as (
  select
    order_id,
    store_id,
    customer_id,
    customer_label,
    order_id_text,
    customer_id_text,
    source,
    observed_at
  from ranked_candidates
  where candidate_rank = 1
)
update public.orders o
set customer_id = candidate.customer_id
from candidate_backfill candidate
where o.order_id = candidate.order_id
  and o.store_id::text = candidate.store_id::text
  and o.customer_id is null
returning
  o.order_id,
  o.store_id,
  o.customer_id,
  candidate.customer_label,
  candidate.source;

-- 7) Index for merchant order/customer reads.
create index if not exists idx_orders_store_customer
  on public.orders(store_id, customer_id)
  where customer_id is not null;

commit;

-- Rollback:
--   drop index if exists public.idx_orders_store_customer;
--   alter table public.orders drop constraint if exists orders_customer_id_fkey;
--   alter table public.orders drop column if exists customer_id;
