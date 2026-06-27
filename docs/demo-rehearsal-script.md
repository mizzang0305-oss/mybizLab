# Demo Rehearsal Script

This document defines the July 2026 demo rehearsal package only.

It is synthetic-only and read-only. It does not read real customer data, import customer data, create stores, create customers, send SMS/Kakao/Email, charge payments, create subscriptions, resolve raw recipients, add API keys, add environment variables, register webhooks, or write production data.

## 3-minute demo flow

### 1 minute: problem framing

Small stores remember regular customers in staff memory, notes, and order app fragments. When staff changes or the store gets busy, the owner loses the context needed to bring back regular customers and increase average order value.

Use this framing:

- "MyBiz is a memory-based revenue engine SaaS."
- "The first pilot goal is not automatic sending. It is seeing who to call back and why."
- "The July pilot verifies customer-memory value before any delivery, payment, or data-import execution."

Do not say that MyBiz guarantees revenue, automatically sends messages, or already imports real customer data.

### 1 minute: MyBiz screen value explanation

Show the owner the read-only value chain:

- customer memory card
- VIP customer candidate
- read-only report sample
- campaign preparation preview
- delivery approval gate
- pilot outreach manual kit

Explain that every example in the rehearsal is synthetic. The screen should prove the workflow: remember customer context, identify a revisit or average-order-value opportunity, and prepare a safe next conversation.

### 1 minute: Growth 99,000 KRW pitch

Use Growth 99,000 KRW as the primary offer.

Suggested wording:

"For the July pilot, Growth 99,000 KRW is the recommended plan because the value is not just a static CRM list. The value is that the owner can see VIP candidates, revisit opportunities, and campaign preparation previews without opening actual sending or payment automation."

Close with a manual next step only:

- ask whether the owner wants a read-only pilot explanation
- record interest level manually outside the product
- do not create a lead or store inside production
- do not collect raw phone or email inside the product

## Synthetic customer memory example

Use only fictional, masked, non-contact examples:

- customer label: `synthetic_regular_guest_a`
- memory signal: prefers quiet weekday visits
- revisit signal: has not returned recently in the synthetic scenario
- suggested owner note: ask whether they want the usual set again

This example must not include a real name, real phone number, real email, real address, or real order receipt.

## Synthetic VIP candidate example

Use only aggregate or masked signals:

- candidate label: `masked_vip_candidate_01`
- reason: repeat visits and higher average order value in the synthetic scenario
- owner action: review manually before any outreach

## Synthetic campaign preview example

Use preview-only wording:

- campaign purpose: this week revisit candidate
- candidate count: synthetic count only
- message draft: review-only copy, not sent
- delivery status: disabled
- approval required: true

## Safety boundaries

- real customer data use is forbidden
- actual SMS/Kakao/Email delivery is forbidden
- raw phone/email lookup is forbidden
- production DB write is forbidden
- payment or subscription automation is forbidden
- provider integration is forbidden
- revenue guarantee wording is forbidden

## Code contract

The pure contract is `buildDemoRehearsalPackagePlan()`.

Required values:

- `demoRehearsalPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `primaryOfferPlan: "growth"`
- `primaryOfferMonthlyPriceKrw: 99000`
- `demoDurationMinutes: 3`
- `syntheticDataOnly: true`
- `realCustomerDataReadEnabled: false`
- `customerDataImportEnabled: false`
- `storeCreationEnabled: false`
- `actualDeliveryEnabled: false`
- `providerIntegrationEnabled: false`
- `paymentAutomationEnabled: false`
- `rawRecipientResolutionEnabled: false`
- `requiresOwnerApprovalBeforeUse: true`
- `requiresPrivacyBoundaryExplanation: true`
- `requiresReadOnlyPilotExplanation: true`

Required demo assets:

- `three_minute_script`
- `problem_framing`
- `screen_value_explanation`
- `growth_price_pitch`
- `synthetic_customer_memory_example`
- `synthetic_vip_candidate_example`
- `synthetic_campaign_preview_example`

Blocked actions:

- `read_real_customer_data`
- `import_customer_data`
- `create_store`
- `create_customer`
- `send_sms`
- `send_kakao`
- `send_email`
- `charge_payment`
- `create_subscription`
- `write_subscription`
- `resolve_raw_recipient`
- `add_api_key`
- `add_env`
- `register_webhook`

## Related Documents

- `docs/demo-synthetic-scenario.md`
- `docs/pilot-demo-scenario.md`
- `docs/pilot-sales-kit.md`
- `docs/pilot-outreach-manual-kit.md`
- `docs/pilot-follow-up-script.md`
