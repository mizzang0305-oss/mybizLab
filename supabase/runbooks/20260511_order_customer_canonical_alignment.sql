-- MyBiz PR #84: manual order/customer canonical alignment runbook.
-- Do not run this automatically. Execute section-by-section in Supabase SQL editor.
-- Keep the first pass inside BEGIN/ROLLBACK until the dry-run count and preview are reviewed.

-- ---------------------------------------------------------------------------
-- 1) Manual schema inspection
-- ---------------------------------------------------------------------------

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customers'
order by ordinal_position;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
order by ordinal_position;

select
  to_regclass('public.order_items') as order_items_table;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payment_events'
order by ordinal_position;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customer_timeline_events'
order by ordinal_position;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'contacts',
    'inquiries',
    'reservations',
    'waiting_entries'
  )
order by table_name, ordinal_position;

-- ---------------------------------------------------------------------------
-- 2) Dry-run candidate build
-- ---------------------------------------------------------------------------

BEGIN;

create temp table order_customer_backfill_snapshot as
select
  o.order_id::text as order_id_text,
  o.store_id,
  o.customer_id as previous_customer_id,
  timezone('utc', now()) as snapshotted_at
from public.orders o
where o.customer_id is null
  and o.order_id is not null;

with
order_scope as (
  select
    o.order_id::text as order_id_text,
    o.store_id
  from public.orders o
  where o.customer_id is null
    and o.order_id is not null
),
payment_raw_candidates as (
  select
    o.order_id_text,
    o.store_id,
    pe_payload.candidate_customer_id,
    'payment_events.raw_or_payload.customer_id' as candidate_source
  from order_scope o
  join public.payment_events pe
    on pe.order_id = o.order_id_text
  cross join lateral (
    select nullif(coalesce(to_jsonb(pe) #>> '{raw,customer_id}', to_jsonb(pe) #>> '{payload,customer_id}'), '') as candidate_customer_id
  ) pe_payload
  where pe_payload.candidate_customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
timeline_candidates as (
  select
    o.order_id_text,
    o.store_id,
    cte.customer_id::text as candidate_customer_id,
    'customer_timeline_events.order_linked' as candidate_source
  from order_scope o
  join public.customer_timeline_events cte
    on cte.store_id = o.store_id
   and cte.event_type = 'order_linked'
  cross join lateral (
    select coalesce(to_jsonb(cte) #>> '{metadata,order_id}', to_jsonb(cte) #>> '{payload,order_id}') as event_order_id
  ) cte_payload
  where cte.customer_id is not null
    and cte_payload.event_order_id = o.order_id_text
),
all_candidates as (
  select * from payment_raw_candidates
  union all
  select * from timeline_candidates
),
safe_candidates as (
  select
    ac.order_id_text,
    ac.store_id,
    min(cx_identity.customer_id_text)::uuid as customer_id,
    string_agg(distinct ac.candidate_source, ', ' order by ac.candidate_source) as candidate_sources
  from all_candidates ac
  join public.customers cx
    on cx.store_id = ac.store_id
  cross join lateral (
    select coalesce(to_jsonb(cx) #>> '{id}', to_jsonb(cx) #>> '{customer_id}') as customer_id_text
  ) cx_identity
  where cx_identity.customer_id_text = ac.candidate_customer_id
  group by ac.order_id_text, ac.store_id
  having count(distinct ac.candidate_customer_id) = 1
),
manual_review as (
  select
    ac.order_id_text,
    ac.store_id,
    array_agg(distinct ac.candidate_customer_id order by ac.candidate_customer_id) as candidate_customer_ids,
    array_agg(distinct ac.candidate_source order by ac.candidate_source) as candidate_sources
  from all_candidates ac
  group by ac.order_id_text, ac.store_id
  having count(distinct ac.candidate_customer_id) <> 1
)
select
  'dry-run count' as check_name,
  count(*) as update_candidate_count
from safe_candidates;

with
order_scope as (
  select
    o.order_id::text as order_id_text,
    o.store_id
  from public.orders o
  where o.customer_id is null
    and o.order_id is not null
),
payment_raw_candidates as (
  select
    o.order_id_text,
    o.store_id,
    pe_payload.candidate_customer_id,
    'payment_events.raw_or_payload.customer_id' as candidate_source
  from order_scope o
  join public.payment_events pe
    on pe.order_id = o.order_id_text
  cross join lateral (
    select nullif(coalesce(to_jsonb(pe) #>> '{raw,customer_id}', to_jsonb(pe) #>> '{payload,customer_id}'), '') as candidate_customer_id
  ) pe_payload
  where pe_payload.candidate_customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
timeline_candidates as (
  select
    o.order_id_text,
    o.store_id,
    cte.customer_id::text as candidate_customer_id,
    'customer_timeline_events.order_linked' as candidate_source
  from order_scope o
  join public.customer_timeline_events cte
    on cte.store_id = o.store_id
   and cte.event_type = 'order_linked'
  cross join lateral (
    select coalesce(to_jsonb(cte) #>> '{metadata,order_id}', to_jsonb(cte) #>> '{payload,order_id}') as event_order_id
  ) cte_payload
  where cte.customer_id is not null
    and cte_payload.event_order_id = o.order_id_text
),
all_candidates as (
  select * from payment_raw_candidates
  union all
  select * from timeline_candidates
),
safe_candidates as (
  select
    ac.order_id_text,
    ac.store_id,
    min(cx_identity.customer_id_text)::uuid as customer_id,
    string_agg(distinct ac.candidate_source, ', ' order by ac.candidate_source) as candidate_sources
  from all_candidates ac
  join public.customers cx
    on cx.store_id = ac.store_id
  cross join lateral (
    select coalesce(to_jsonb(cx) #>> '{id}', to_jsonb(cx) #>> '{customer_id}') as customer_id_text
  ) cx_identity
  where cx_identity.customer_id_text = ac.candidate_customer_id
  group by ac.order_id_text, ac.store_id
  having count(distinct ac.candidate_customer_id) = 1
)
select
  order_id_text,
  store_id,
  customer_id,
  candidate_sources
from safe_candidates
order by order_id_text
limit 50;

-- ---------------------------------------------------------------------------
-- 3) Optional reviewed update
-- ---------------------------------------------------------------------------
-- Keep this in the transaction for the first execution. It updates only
-- orders whose customer_id is still null and whose candidate customer belongs
-- to the same store.

with
order_scope as (
  select
    o.order_id::text as order_id_text,
    o.store_id
  from public.orders o
  where o.customer_id is null
    and o.order_id is not null
),
payment_raw_candidates as (
  select
    o.order_id_text,
    o.store_id,
    pe_payload.candidate_customer_id
  from order_scope o
  join public.payment_events pe
    on pe.order_id = o.order_id_text
  cross join lateral (
    select nullif(coalesce(to_jsonb(pe) #>> '{raw,customer_id}', to_jsonb(pe) #>> '{payload,customer_id}'), '') as candidate_customer_id
  ) pe_payload
  where pe_payload.candidate_customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
timeline_candidates as (
  select
    o.order_id_text,
    o.store_id,
    cte.customer_id::text as candidate_customer_id
  from order_scope o
  join public.customer_timeline_events cte
    on cte.store_id = o.store_id
   and cte.event_type = 'order_linked'
  cross join lateral (
    select coalesce(to_jsonb(cte) #>> '{metadata,order_id}', to_jsonb(cte) #>> '{payload,order_id}') as event_order_id
  ) cte_payload
  where cte.customer_id is not null
    and cte_payload.event_order_id = o.order_id_text
),
all_candidates as (
  select * from payment_raw_candidates
  union all
  select * from timeline_candidates
),
safe_candidates as (
  select
    ac.order_id_text,
    ac.store_id,
    min(cx_identity.customer_id_text)::uuid as customer_id
  from all_candidates ac
  join public.customers cx
    on cx.store_id = ac.store_id
  cross join lateral (
    select coalesce(to_jsonb(cx) #>> '{id}', to_jsonb(cx) #>> '{customer_id}') as customer_id_text
  ) cx_identity
  where cx_identity.customer_id_text = ac.candidate_customer_id
  group by ac.order_id_text, ac.store_id
  having count(distinct ac.candidate_customer_id) = 1
)
update public.orders o
set customer_id = sc.customer_id
from safe_candidates sc
where o.order_id::text = sc.order_id_text
  and o.store_id = sc.store_id
  and o.customer_id is null;

select
  'post-update verification' as check_name,
  count(*) as newly_linked_count
from public.orders o
join order_customer_backfill_snapshot s
  on s.order_id_text = o.order_id::text
 and s.store_id = o.store_id
where s.previous_customer_id is null
  and o.customer_id is not null;

-- Review broadness before committing. Use COMMIT only after the dry-run count,
-- preview sample, and manual review rows are acceptable.
ROLLBACK;

-- Rollback note:
-- If a reviewed COMMIT was already executed, use the temp snapshot pattern in
-- this runbook as a permanent audit table before running the update, then
-- restore only rows captured in that snapshot. Never issue a broad delete or
-- broad customer_id reset.
