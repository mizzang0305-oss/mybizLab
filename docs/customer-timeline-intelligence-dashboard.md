# Customer Timeline Intelligence Dashboard

## Purpose

The customer timeline intelligence dashboard helps merchants understand customer memory at a glance. It turns inquiries, reservations, waiting entries, orders, order items, reviews, blog drafts, and social jobs into customer cards with safe next-action suggestions.

This is not an external publishing or messaging automation. It is an internal operating view that helps a merchant decide what to do next.

## Customer Memory Cards

Each customer card uses the existing customer display fallback policy. The UI must not assume `customers.name`, `customers.phone`, or `customers.email` exist in live schemas. If a customer is linked by `customer_id`, the card must never show the customer as unregistered.

Cards show:
- customer display label
- last activity
- order count
- review count through the read model
- average order value
- recent order item summary
- frequent item signal
- status badges such as new, regular candidate, revisit needed, quiet customer, review customer, and VIP candidate

## Timeline Events

The read model renders safe timeline entries for:
- inquiry created
- AI consultation / conversation events
- reservation created or updated
- waiting created or updated
- order created and order paid
- review submitted or published
- blog created from review
- social job created
- existing customer timeline events

Raw payloads, tokens, internal request links, and provider secrets are not exposed in the timeline DTO.

## Order Item Summary

Order items use the PR #88 read model:
1. canonical `order_items`
2. raw payload compatibility
3. empty state: `주문 품목 정보가 아직 연결되지 않았습니다.`

The dashboard uses item summaries such as `아메리카노 x2, 치즈케이크 x1` and frequent item counts as customer preference evidence. It continues to work before the production `order_items` migration/backfill is applied.

## Deterministic Recommendation Rules

Recommendations are rule-based foundation only. No AI provider, SMS, Kakao, email, or external publish adapter is called.

Current rules:
- no recent order for 30 days and historical order exists: revisit suggestion
- frequent ordered item exists: reorder suggestion
- published review with `content_usage_consent=true`: blog draft suggestion
- waiting exists after the latest order: waiting follow-up suggestion
- average order value is high: VIP candidate suggestion

All action buttons are disabled with the copy `이 기능은 다음 배포에서 제공됩니다.`

## Quiet Mode And Consent

If customer preferences include `quiet_mode`, outreach-style recommendations are suppressed. Content recommendations require review consent. Reviews without `content_usage_consent` do not create external content recommendations.

The dashboard can mention consent state internally, but it must not imply external reuse is allowed without customer consent and merchant approval.

## Privacy And Store Scope

Customer display continues to use masking and fallback utilities. Phone/email values should not be expanded in the intelligence DTO beyond existing safe merchant display behavior.

The dashboard does not add a public API. It combines existing store-scoped dashboard services. Cross-store records are filtered by `store_id` and `customer_id` in the read model.

## Follow-Up AI Plan

A later PR can add AI-generated recommendation explanations after:
- store scope and consent checks are enforced server-side
- quiet mode is respected
- generated copy is reviewed by the merchant
- no external messaging or publishing happens without explicit approval
