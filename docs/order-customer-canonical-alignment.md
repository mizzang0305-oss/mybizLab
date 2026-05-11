# Order/Customer Canonical Alignment

## Intent

MyBiz treats inquiries, reservations, waiting entries, orders, reviews, and content as customer-memory channels. Orders are not isolated POS rows; they are evidence that strengthens the same customer spine used by CRM, dashboard, and revenue workflows.

## Live Schema Assumptions

- `customers` is the identity spine.
- Live `customers` rows may not expose `name`, `phone`, `email`, or `display_name`.
- Display labels are read-model concerns, derived from contacts, public input, order raw data, timeline metadata, or safe id fallback.
- `orders.store_id` is the store boundary for order/payment reads.
- `payment_events` may not have `store_id`; payment events are scoped through `orders.order_id::text` or `orders.id::text`.
- `order_items` may be absent in legacy live schemas; compatibility item reads can come from order/payment raw payloads.

## Customer Display Policy

Use `getCustomerDisplayLabel` for merchant-facing order/customer display.

Priority:

1. Healthy customer/contact name from canonical record or source input.
2. Masked phone, for example `고객 010-****-1234`.
3. Masked email, for example `고객 m***@example.com`.
4. `customer_key` suffix fallback, for example `고객 #abcdef`.
5. `customer_id` suffix fallback, for example `고객 #223333`.
6. Only when no customer link exists: `미등록 고객`.

Rules:

- If `customer_id` exists, never display `미등록 고객`.
- Do not expose corrupted mojibake or placeholder-heavy names.
- Do not expose raw phone or email in compact merchant UI.
- Preserve healthy Korean names.

## Orders Canonical Read Path

- `orders.customer_id` remains canonical when present.
- If a customer record cannot be enriched from `customers` or `customer_contacts`, keep `orders.customer_id` and use the safe label fallback.
- Legacy order rows without canonical `order_items` continue to render from payment/timeline raw payload compatibility.
- Timeline `order_linked` events may fill a missing order customer link for read display, but unrelated order ids must not attach customers.

## Timeline Link Policy

Order customer linkage writes an `order_linked` event with:

- `store_id`
- `customer_id`
- `metadata.order_id`
- payment status/source/method where available
- table id/number where available
- item count/summary where available

For the same `store_id + customer_id + order_id + order_linked`, MyBiz reuses the existing event instead of creating duplicates.

## Payment Events

- Do not rely on `payment_events.store_id`.
- Always load/validate the order first by `orders.store_id`.
- Then read payment events by order id text.
- `payment_test_100` remains a payment safety product and is not part of customer/order entitlement mutation.

## Order Items Status

Current app code supports both:

- Canonical `order_items` when the table exists.
- Compatibility read model from order/payment raw payloads when `order_items` is absent.

A full canonical `order_items` production migration should be handled as a separate PR after live schema inspection and data sampling.

## Manual SQL Runbook

Runbook: `supabase/runbooks/20260511_order_customer_canonical_alignment.sql`

Use it manually:

1. Run schema inspection queries.
2. Run the dry-run transaction and keep `ROLLBACK`.
3. Review count and preview sample.
4. Inspect manual review rows separately.
5. Only after approval, create a persistent snapshot table and run the reviewed update in a controlled transaction.

The runbook:

- Updates only `orders.customer_id is null`.
- Never overwrites an existing `orders.customer_id`.
- Joins customers by same `store_id`.
- Avoids `customers.name`, `customers.phone`, `customers.email` assumptions.
- Avoids `payment_events.store_id`.
- Guards UUID casts with a UUID regex.

## Operations Checklist

- Confirm linked orders never render `미등록 고객`.
- Confirm raw phone/email do not appear in order cards.
- Confirm public order submit still works without customer information.
- Confirm QR/table order with customer information links to customer memory.
- Confirm payment events do not cross store boundaries.
- Confirm FREE/PRO/VIP, `payment_test_100`, MYBI, review safe DTO, SEO, and content readiness gates are unchanged.
