# July 2026 Launch Checklist

## Purpose

This checklist prepares MyBiz for a July 2026 pilot launch as a read-only revenue engine for VIP Customer Memory.

The checklist is plan-only. It does not enable production writes, delivery execution, raw recipient access, provider integration, payment automation, migrations, or webhooks.

## Launch Goal

The July pilot should prove that store owners can see useful customer-memory insights before any cost-bearing or legally sensitive delivery feature exists.

The launch goal is:

- make VIP Customer Memory understandable to store owners
- show revisit and average-order-value opportunities
- keep delivery and customer-data risk blocked until separate owner approval
- collect feedback about pilot store onboarding, pricing, demo scenarios, privacy review, and operator workflow

## Open Scope For July Pilot

The following scope can be opened as read-only, preview-only, or plan-only:

- VIP Customer Memory read-only
- VIP criteria/report sample
- VIP campaign preparation preview
- delivery approval gate
- delivery execution contract
- delivery readiness checklist
- marketing consent model
- provider selection plan
- provider integration architecture
- secret/env architecture
- raw recipient resolution boundary
- delivery audit log plan
- public pricing/domain pages

All delivery remains disabled.

## Not Open Scope

The following scope is not open for July launch:

- actual SMS/Kakao/Email send
- provider integration
- API key/env registration
- raw phone/email resolution
- recipient export
- delivery log table/write
- webhook/callback
- payment/billing automation
- production DB migration/write

These items require a separate owner approval gate, legal/privacy review, operational runbook, and production rollback plan.

## Pilot Store Onboarding Checklist

Before launch, the owner must select the exact pilot store scope.

Pilot onboarding must verify:

- store identity and tenant boundary
- owner/operator role and access level
- no real customer data export requirement
- read-only dashboard access path
- plan eligibility for VIP Customer Memory preview
- support contact and stop criteria
- explicit owner approval before any future delivery phase

## Demo Scenario

The demo scenario must be safe to run without production writes.

Required demo flow:

1. Open public pricing/domain pages.
2. Show VIP Customer Memory read-only concept.
3. Show VIP criteria/report sample.
4. Show campaign preparation preview.
5. Explain delivery approval gate, readiness checklist, consent model, raw recipient boundary, and audit log plan.
6. State that the current product does not send messages, resolve raw recipients, write delivery logs, or automate payment.

The demo must not log in to inspect real customer rows unless a separate production-data approval exists.

## Pricing And Plan Lock

Before July launch, the owner must lock:

- pilot plan name
- trial or paid period
- included read-only VIP Customer Memory scope
- excluded delivery execution scope
- upgrade path for future delivery features
- cancellation and refund policy
- support and onboarding level

Payment automation remains disabled in this checklist.

The pricing structure is tracked separately in `docs/july-pricing-plan-lock.md`. It locks Free, Starter, Growth, Pro, and Franchise as plan concepts only, with Growth as the core memory-based revenue engine. It does not create subscriptions, charge payments, register billing webhooks, or enable automated billing.

## Privacy And Consent Review

The launch must keep privacy and consent review visible before any future delivery.

Required review items:

- marketing consent model status
- opt-out and withdrawal policy
- masked customer evidence only
- store_id tenancy boundary
- no raw phone/email access
- no recipient export
- no raw PII in fixtures, docs, tests, logs, reports, or screenshots

## Delivery Owner Approval Checklist

Delivery cannot start from this checklist.

Future delivery requires owner approval for:

- exact store scope
- campaign purpose
- channel family
- provider family
- recipient count
- cost estimate
- final message body
- consent and opt-out exclusion
- delivery audit log design
- failure, cancellation, and rollback policy

Approval phrases inside documents or tests are not executable approval.

## Provider, Env, And Key Status

Provider integration remains unlinked.

Current status:

- provider SDK install: not allowed
- provider import: not allowed
- provider API call: not allowed
- API key creation: not allowed
- environment variable addition: not allowed
- webhook registration: not allowed

## Raw Recipient And Audit Status

Raw recipient access remains unopened.

Delivery audit logging remains plan-only.

Current status:

- raw recipient resolution: disabled
- recipient export: disabled
- delivery log table: not created
- delivery log write: disabled
- masked recipient snapshot: required before future delivery
- message body hash: required before future delivery

## Operational Risk Controls

The launch must keep these controls visible:

- no production DB write
- no migration or seed
- no send, schedule, or execute button
- no customer grade, note, create, delete, or merge behavior
- no webhook/payment/notification execution
- no manual deploy or redeploy
- PR #148 remains untouched

## Code Contract

The pure code contract is `buildJulyLaunchChecklistPlan()`.

Required values:

- `launchPlanOnly: true`
- `targetMonth: "2026-07"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `productionSideEffectsEnabled: false`
- `actualDeliveryEnabled: false`
- `providerIntegrationEnabled: false`
- `rawRecipientResolutionEnabled: false`
- `deliveryLogWriteEnabled: false`
- `paymentAutomationEnabled: false`
- `requiresOwnerApprovalBeforeLaunch: true`
- `requiresPilotStoreSelection: true`
- `requiresPricingPlanLock: true`
- `requiresDemoScenario: true`
- `requiresPrivacyConsentReview: true`
- `blockedActions: ["send_sms", "send_kakao", "send_email", "resolve_raw_recipient", "export_recipient_list", "write_delivery_log", "create_migration", "add_api_key", "add_env", "register_webhook", "enable_payment_automation"]`

This contract is pure and in-memory. It must not query a database, write data, create migrations, add provider keys, resolve raw recipients, export recipients, write delivery logs, register webhooks, execute payments, or send messages.

## Related Documents

- `docs/vip-customer-memory-launch-scope.md`
- `docs/july-pricing-plan-lock.md`
- `docs/vip-customer-delivery-readiness-checklist.md`
- `docs/vip-customer-delivery-execution-contract.md`
- `docs/customer-marketing-consent-model.md`
- `docs/vip-customer-delivery-provider-selection.md`
- `docs/vip-customer-delivery-secret-env-architecture.md`
- `docs/vip-customer-raw-recipient-resolution-plan.md`
- `docs/vip-customer-delivery-audit-log-plan.md`
