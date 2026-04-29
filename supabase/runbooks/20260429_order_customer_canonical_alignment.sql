-- MyBiz order/customer canonical alignment runbook
-- Date: 2026-04-29
-- Purpose: Make orders.customer_id canonical without breaking the existing compat read path.
-- Status: MANUAL RUNBOOK ONLY. Do not apply automatically during app deploy.

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

-- 3) Build backfill candidates from both legacy sources.
--
-- Why this normalizes IDs as text:
-- - Live legacy orders.order_id is uuid.
-- - Live legacy payment_events.order_id can be text, while raw.order_id is also text.
-- - Direct uuid = text comparisons fail in Postgres.
-- - We therefore compare order IDs as text (o.order_id::text = order_id_text).
-- - We only cast customer_id_text::uuid after validating it with a UUID regex.
--
-- To dry-run only, execute through the count/preview queries and rollback instead of commit.
drop table if exists pg_temp.tmp_order_customer_backfill_candidates;

create temporary table tmp_order_customer_backfill_candidates
on commit drop
as
with payment_order_links as (
  select distinct on (order_id_text)
    order_id_text,
    customer_id_text,
    observed_at
  from (
    select
      coalesce(
        nullif(to_jsonb(pe) ->> 'order_id', ''),
        nullif(pe.raw ->> 'order_id', ''),
        nullif(pe.raw ->> 'orderId', '')
      ) as order_id_text,
      nullif(
        coalesce(pe.raw ->> 'customer_id', pe.raw ->> 'customerId'),
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
        nullif(payload ->> 'order_id', ''),
        nullif(payload ->> 'orderId', '')
      ) as order_id_text,
      customer_id,
      created_at as observed_at
    from public.customer_timeline_events
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
   and c.store_id = o.store_id
  where o.customer_id is null

  union all

  select
    o.order_id,
    o.store_id,
    c.customer_id,
    t.order_id_text,
    t.customer_id_text,
    'customer_timeline_events.order_linked'::text as source,
    2 as source_rank,
    t.observed_at
  from public.orders o
  join timeline_order_links t
    on o.order_id::text = t.order_id_text
   and o.store_id = t.store_id
  join public.customers c
    on c.customer_id = t.customer_id
   and c.store_id = o.store_id
  where o.customer_id is null
),
ranked_candidates as (
  select
    *,
    row_number() over (
      partition by order_id
      order by source_rank asc, observed_at desc
    ) as candidate_rank
  from candidate_links
)
select
  order_id,
  store_id,
  customer_id,
  order_id_text,
  customer_id_text,
  source,
  observed_at
from ranked_candidates
where candidate_rank = 1;

-- 4) Dry-run candidate count. Inspect before running the final UPDATE.
select
  source,
  count(*) as candidate_count
from pg_temp.tmp_order_customer_backfill_candidates
group by source
order by source;

-- 5) Dry-run sample preview. Verify order/customer/store linkage before UPDATE.
select
  order_id,
  store_id,
  customer_id,
  source,
  order_id_text,
  customer_id_text,
  observed_at
from pg_temp.tmp_order_customer_backfill_candidates
order by observed_at desc nulls last
limit 25;

-- 6) Final backfill. This does not overwrite existing orders.customer_id.
update public.orders o
set customer_id = candidate.customer_id
from pg_temp.tmp_order_customer_backfill_candidates candidate
where o.order_id = candidate.order_id
  and o.store_id = candidate.store_id
  and o.customer_id is null
returning
  o.order_id,
  o.store_id,
  o.customer_id,
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
