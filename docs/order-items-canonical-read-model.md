# Order Items Canonical Read Model

MyBiz treats order items as customer memory evidence: they show what a customer actually bought, which supports reorder prompts, upsell hints, and better average order value analysis. Order headers remain important for status and payment, but item-level data is the preference signal.

## Current Compatibility Mode

Some live environments may still be order-header first. In those environments, item lines can exist in `orders` raw payloads, payment compatibility payloads, or customer timeline metadata instead of a canonical `order_items` table.

The app must therefore keep working before and after the migration:

1. Use canonical `order_items` rows when available.
2. Fall back to safe raw payload item arrays.
3. Fall back to an empty item state: `주문 품목 정보가 아직 연결되지 않았습니다.`

Raw payloads are read only for display and memory summaries. They are not mutated by the read model.

## Canonical Table

`supabase/migrations/20260511_order_items_canonical.sql` prepares `public.order_items` with:

- store-scoped identity (`store_id`)
- order linkage (`order_id`, `order_id_text`, `source_order_key`)
- optional `customer_id`
- item identity and display fields (`item_name`, `menu_name`, `option_summary`)
- quantity and price fields
- raw source payload for compatibility traceability
- RLS via `public.is_store_member(store_id)`

The migration is additive. It does not run production backfills automatically and does not overwrite existing order rows or raw payloads.

## Read Model Priority

`src/shared/lib/orderItemsReadModel.ts` normalizes item lines for dashboard and customer memory views:

1. Canonical `order_items`
2. Raw payload compatibility items
3. Empty state

The normalizer rejects obviously corrupted item names such as `????`, clamps quantity and price values to safe non-negative display values, and computes line totals when raw payloads omit them.

## QR/Table Order Write Path

Public QR/table order submission keeps raw item payloads in the compatibility payment event first. If `order_items` exists and accepts the insert, canonical rows are returned. If the canonical insert fails or the table is not present, the order still succeeds and the UI uses raw compatibility items.

This preserves customer/order linkage and prevents a partial item-write failure from corrupting an otherwise valid order.

## Backfill Runbook

Use `supabase/runbooks/20260511_order_items_backfill.sql` manually after reviewing live schema:

1. Run the schema inspection section.
2. Review the dry-run insertable count.
3. Review the preview sample.
4. Execute the reviewed insert block with `ROLLBACK`.
5. Change to `COMMIT` only after validating the exact store/order scope.

The runbook inserts only missing rows, requires `store_id`, avoids invalid UUID casts, filters corrupted item names, and never overwrites existing `order_items`.

## Customer Memory And Timeline

When item lines are available, customer timeline metadata can include an item summary such as `아메리카노 x2, 치즈케이크 x1`. If no item data is available, customer/order linkage still remains valid and the UI shows the empty item state.

## Follow-Up

PR #85 prepares the canonical structure and safe read/write compatibility. A follow-up can add reorder and upsell analysis from item frequency, category affinity, and recent purchase patterns once the backfill has been reviewed in production.
