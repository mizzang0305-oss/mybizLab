# July 2026 Pricing Plan Lock

## Purpose

This document locks the draft July 2026 pilot pricing structure for MyBiz as a memory-based revenue engine.

The scope is pricing plan lock only. It does not create subscriptions, charge payments, add a payment provider, register billing webhooks, enable payment automation, add API keys, add environment variables, send messages, resolve raw recipients, or write production data.

## Product Positioning

MyBiz should be sold as a memory-based revenue SaaS:

- remember store-scoped customer behavior and preferences
- show VIP customer candidates
- help owners identify revisit and average-order-value opportunities
- prepare safe campaign previews without delivery execution
- keep payment, delivery, provider, raw recipient, and production write paths behind separate approval gates

## Plan Summary

| Plan | Monthly price | Role | Launch intent |
| --- | ---: | --- | --- |
| Free | 0 KRW | lead_capture_and_demo | Let owners understand customer memory value before payment. |
| Starter | 29,000 KRW | paid_entry_memory_card | Paid entry plan for read-only customer memory cards and reports. |
| Growth | 99,000 KRW | core_memory_revenue_engine | Core plan for VIP campaign preparation and approval-gated growth workflow. |
| Pro | 199,000 KRW | advanced_operations_and_reports | Expansion plan for AI recommendations, staff briefings, and advanced reports. |
| Franchise | starts from 499,000 KRW | multi_store_and_template_package | Multi-store and franchise template package. |

Growth is the core paid plan for the July pilot because it carries the memory-based revenue workflow without enabling actual delivery.

## Free

Purpose:

- lead capture
- demo
- help owners see the value of customer memory

Included:

- basic customer-memory preview
- limited VIP candidate preview
- public pricing/domain pages
- inquiry and consultation lead capture

Excluded:

- campaign execution
- SMS/Kakao/Email delivery
- raw recipient access
- provider integration
- payment automation

## Starter

Recommended price: 29,000 KRW per month.

Purpose:

- first paid step for small stores
- read-only reports that can justify customer-memory value

Included:

- VIP Customer Memory read-only
- VIP criteria/report sample
- customer preference, visit, and order context preview
- weekly report sample
- pilot demo scenario

Excluded:

- delivery execution
- provider integration
- raw recipient resolution
- billing webhook
- subscription write

## Growth

Recommended price: 99,000 KRW per month.

Purpose:

- main paid plan for MyBiz
- core memory-based revenue engine

Included:

- all Starter scope
- VIP campaign preparation preview
- delivery approval gate
- delivery readiness checklist
- marketing consent model
- provider selection plan
- raw recipient resolution boundary
- delivery audit log plan

Notes:

- actual sending is not included
- future delivery should be separated as a later add-on or higher-tier feature after separate owner approval

## Pro

Recommended price: 199,000 KRW per month.

Purpose:

- expansion after the July pilot
- stronger AI recommendations and operations briefing

Included:

- all Growth scope
- AI today-action recommendation concept
- staff briefing concept
- upsell recommendation preview
- revisit and feedback preview
- advanced report concept

Notes:

- SMS/Kakao/Email delivery remains unopened
- payment provider integration remains unopened
- API key and environment variable work remains unopened

## Franchise

Recommended price: consultation or starts from 499,000 KRW per month.

Purpose:

- multi-store or franchise package

Included:

- all Pro scope
- multi-store reporting concept
- industry-specific templates
- pilot onboarding package
- monthly operations report concept

Notes:

- final price requires owner approval and pilot feedback
- no automated billing or subscription write is included in this plan lock

## Payment And Billing Boundary

The July pricing lock does not open payment execution.

Current status:

- payment automation: disabled
- billing webhook: disabled
- subscription write: disabled
- payment provider integration: not added
- API key creation: not allowed
- environment variable addition: not allowed

Any future payment implementation requires a separate owner approval, payment provider decision, legal review, rollback plan, and production safety gate.

## Delivery Boundary

The July pricing lock also does not open delivery execution.

Current status:

- actual SMS/Kakao/Email send: disabled
- raw recipient resolution: disabled
- recipient export: disabled
- provider integration: disabled
- delivery log write: disabled

Delivery remains separate from pricing lock.

## Owner Approval And Pilot Feedback

Before publishing pricing externally, the owner must approve:

- plan names
- monthly prices
- trial or paid pilot policy
- Growth as the core revenue plan
- included read-only scope
- excluded payment and delivery scope
- upgrade path after pilot feedback
- support and refund policy

Pilot feedback must confirm that owners understand the current product as a customer-memory revenue engine, not as an actual sending or payment automation product.

## Code Contract

The pure contract is `buildJulyPricingPlanLock()`.

Required values:

- `pricingPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `paymentAutomationEnabled: false`
- `billingWebhookEnabled: false`
- `subscriptionWriteEnabled: false`
- `productionSideEffectsEnabled: false`
- `requiresOwnerApprovalBeforePublishing: true`
- `requiresPilotFeedbackBeforeFinalPrice: true`
- `recommendedPlans: free, starter, growth, pro, franchise`
- `blockedActions: ["create_subscription", "write_subscription", "charge_payment", "enable_payment_automation", "register_billing_webhook", "add_pg_provider", "add_api_key", "add_env", "send_sms", "send_kakao", "send_email", "resolve_raw_recipient"]`

This contract is pure and in-memory. It must not create subscriptions, write subscriptions, charge payments, register billing webhooks, add payment providers, add keys, add environment variables, send messages, resolve raw recipients, or query/write production data.

## Related Documents

- `docs/july-launch-checklist.md`
- `docs/vip-customer-memory-launch-scope.md`
