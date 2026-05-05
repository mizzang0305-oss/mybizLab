# MyBiz Order/Customer Canonical Alignment

## Current Production Truth

- Live `orders` rows use `order_id` and do not currently expose `customer_id`.
- Live legacy `payment_events.order_id` may be text even when `orders.order_id` is uuid; some environments may only carry the order id inside `payment_events.raw`.
- Public order customer attach is operationally visible through:
  - `payment_events.raw.customer_id`
  - `payment_events.order_id` or `payment_events.raw.order_id`
  - `customer_timeline_events` with `event_type = 'order_linked'`
- Merchant `orders` and `table-order` screens must keep this compat read path until canonical data is fully backfilled.

## Options Evaluated

### Option A: Add `orders.customer_id`

Recommended.

Migration:
- Add nullable `orders.customer_id`.
- Backfill from `payment_events.raw.customer_id`.
- Backfill remaining rows from `customer_timeline_events.payload.order_id`.
- Compare order IDs as text during backfill (`orders.order_id::text = order_id_text`) to avoid uuid/text operator errors.
- Validate legacy UUID strings with a regex before casting `customer_id_text::uuid`.
- Read `payment_events.order_id` through `to_jsonb(payment_events) ->> 'order_id'` so the runbook can also tolerate legacy shapes where the column is absent and only raw JSON is available.
- Preview customer labels through `to_jsonb(customers)` instead of direct columns like `customers.name`, because live customer schemas can differ.
- Keep count, preview, and update statements self-contained with repeated CTEs. Supabase SQL Editor may execute selected statements in a different session, so the runbook must not depend on a temporary table created by an earlier statement.
- Add an index on `(store_id, customer_id)`.
- Keep compat read path until production verification proves the column is populated.

Risks:
- Live schema drift uses `order_id` instead of `id`, so migration must reference `orders.order_id`.
- Live schema drift may expose `payment_events.order_id` as text, so direct `orders.order_id = payment_events.order_id` comparisons are unsafe.
- Backfill must enforce `orders.store_id = customers.store_id`.
- Invalid UUID-like strings in raw JSON must be filtered before casting, or the migration can fail before updating any rows.
- Verification queries must not assume optional label columns such as `customers.name`; inspect `information_schema.columns` and use schema-safe label fallbacks.
- Session-scoped temp tables are unsafe for this runbook because manual SQL editor runs often execute only the selected count/preview/update statement.

Rollback:
- Drop the index.
- Drop the FK.
- Drop the nullable column.
- Existing compat path remains untouched.

Tests required:
- Public order attach writes/returns customer context.
- Merchant order read prefers `orders.customer_id` when present.
- Merchant order read falls back to `payment_events.raw.customer_id`.
- Store-boundary mismatch does not link a customer.

### Option B: Add `order_customer_links`

Migration:
- Create `order_customer_links(store_id, order_id, customer_id, source, created_at)`.
- Backfill from payment events and timeline events.

Risks:
- Adds another source of truth unless every read/write path is updated.
- More joins on hot merchant screens.

Rollback:
- Drop the table.
- Existing compat path remains untouched.

### Option C: Formalize Compat Read Model Only

Migration:
- Create a view that resolves order/customer context from orders, payment events, and timeline events.

Risks:
- Keeps write truth scattered.
- Does not satisfy the canonical model that orders are evidence data tied to customers.

Rollback:
- Drop the view.

## Recommendation

Use Option A first: add nullable `orders.customer_id`, backfill it safely, and keep the current compat read path as fallback for at least one deployment cycle.

The runbook intentionally keeps the compatibility read model active during and after backfill. Merchant screens should continue resolving legacy orders from `payment_events.raw.customer_id` and `customer_timeline_events.order_linked` until a production deployment proves new and legacy orders consistently populate `orders.customer_id`.

Do not remove `payment_events.raw.customer_id` or timeline fallback until production has verified:

- New public order attach writes `orders.customer_id`.
- Legacy orders backfilled correctly.
- Merchant orders/table-order still show linked customers.
- Store boundary checks prevent cross-store linking.
