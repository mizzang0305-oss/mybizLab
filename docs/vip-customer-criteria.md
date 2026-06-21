# VIP Customer Criteria

## Purpose

VIP customer criteria define how MyBiz shows a store owner which customers may deserve extra attention. This is a customer-memory planning document, not a customer grade editor.

## Customer VIP Versus Subscription VIP

- customer VIP: a store-scoped customer candidate derived from customer behavior and memory signals.
- subscription VIP: the store plan or entitlement, such as `store_subscriptions.plan` or `plan_code`.
- A subscription VIP value never makes an individual customer a VIP customer candidate.

## VIP Customer Signals

Short-term signals help decide whether a customer is worth reviewing this week:

- recent visit
- recent order
- recent customer timeline event
- recent inquiry, reservation, or waiting signal when those read models are approved for this report

Long-term signals help decide whether a customer has durable value:

- visit count threshold
- order count threshold
- lifetime value threshold from approved order/POS read models
- preference depth, such as repeated product, seat, or service preferences
- explicit customer-level VIP fields or tags when already present in the customer read model

## Inquiry, Reservation, And Waiting Signals

Inquiry, reservation, and waiting signals are supporting context. They should be grouped separately from purchases because they show intent, not confirmed spend.

- inquiry: interest or problem signal
- reservation: scheduled revisit intent
- waiting entry: high-friction demand signal

These signals can improve a future score only after the source is store-scoped and privacy-reviewed.

## Privacy And Masking

The owner-facing surface must show masked identity, masked contact, and aggregate evidence only. Raw rows, full contact values, tokens, secrets, and private notes are not report output.

## Store Tenancy

Every source row must match the active `store_id` before it contributes to a VIP customer candidate. Cross-store customers, orders, preferences, and timeline events must be excluded before scoring.

## POS LTV

POS LTV can improve the long-term value signal later. It remains future work until the POS source, reconciliation rules, and approval gate are defined.

## Launch Boundary

The current scope is a read-only planning layer. 발송/수정 기능은 별도 승인 후 확장한다. The report remains a 확인 전용 리포트 until a separate approval gate allows messaging or customer-profile changes.
