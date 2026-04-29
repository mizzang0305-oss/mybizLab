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

-- 3) Backfill from payment_events.raw.customer_id, guarded by store boundary.
with latest_customer_payment_event as (
  select distinct on (pe.order_id)
    pe.order_id,
    nullif(pe.raw ->> 'customer_id', '')::uuid as customer_id
  from public.payment_events pe
  where pe.raw ? 'customer_id'
    and nullif(pe.raw ->> 'customer_id', '') is not null
    and (pe.raw ->> 'customer_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by pe.order_id, pe.created_at desc
)
update public.orders o
set customer_id = c.customer_id
from latest_customer_payment_event pe
join public.customers c
  on c.customer_id = pe.customer_id
where o.order_id = pe.order_id
  and o.store_id = c.store_id
  and o.customer_id is null;

-- 4) Backfill from timeline payload.order_id where payment_events did not carry customer_id.
with latest_order_timeline as (
  select distinct on (store_id, payload ->> 'order_id')
    store_id,
    customer_id,
    (payload ->> 'order_id')::uuid as order_id
  from public.customer_timeline_events
  where event_type = 'order_linked'
    and payload ? 'order_id'
    and nullif(payload ->> 'order_id', '') is not null
    and (payload ->> 'order_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by store_id, payload ->> 'order_id', created_at desc
)
update public.orders o
set customer_id = c.customer_id
from latest_order_timeline t
join public.customers c
  on c.customer_id = t.customer_id
 and c.store_id = t.store_id
where o.order_id = t.order_id
  and o.store_id = t.store_id
  and o.customer_id is null;

-- 5) Index for merchant order/customer reads.
create index if not exists idx_orders_store_customer
  on public.orders(store_id, customer_id)
  where customer_id is not null;

commit;

-- Rollback:
--   drop index if exists public.idx_orders_store_customer;
--   alter table public.orders drop constraint if exists orders_customer_id_fkey;
--   alter table public.orders drop column if exists customer_id;
