# VIP Customer Delivery Execution Contract

## Purpose

VIP campaign delivery can support store revenue recovery, revisit prompts, and higher average order value, but delivery is also a privacy, marketing-consent, cost, abuse, and rollback risk surface.

This document defines the execution contract that must be satisfied before any future delivery implementation can be designed. It is not a delivery implementation.

## Current Scope

The current scope is execution contract only.

This plan does not add:

- real SMS, Kakao, or email delivery
- provider integration
- customer data writes
- delivery log database tables
- send, scheduled send, or execute campaign buttons
- raw recipient resolution
- migration files
- seed data
- production DB writes

## Required Conditions Before Future Execution

Future delivery implementation can only be considered when every condition below is true and recorded:

- `ownerApprovalRequired`
- `marketingConsentRequired`
- `maskedPreviewReviewRequired`
- `finalRecipientCountReviewRequired`
- `messageBodyReviewRequired`
- `duplicateSendPreventionRequired`
- `costApprovalRequired`
- `cancellationPolicyRequired`
- `failureHandlingRequired`
- `auditLogRequired`
- `rollbackPolicyRequired`

## Marketing Consent Standard

Future delivery must exclude:

- customers without marketing consent
- customers with unknown consent status
- customers who opted out or withdrew consent
- customers whose consent evidence cannot be verified

Subscription VIP status is not a customer VIP signal and is not a delivery execution signal.

The future consent status, source, evidence, withdrawal, and store tenancy model is defined in `docs/customer-marketing-consent-model.md`. That model is a planning contract only; it does not create the `customer_marketing_consents` table or any consent write path.

## Recipient Review Standard

Before any future delivery attempt, the owner must review the final recipient count. Masked preview review and raw recipient resolution are separate steps.

The current product can show masked candidates and aggregate reasons only. Raw names, phone numbers, email addresses, private notes, raw rows, and full UUIDs are out of scope.

Secure raw recipient resolution is future-only and must remain scoped to the active `store_id`.

## Message Review Standard

Future delivery requires owner review of the exact message body before provider integration or execution is considered.

Message review must verify:

- discount, coupon, period, amount, and condition text
- no misleading or exaggerated advertising
- no raw personal information in the message body
- channel-specific compliance requirements

## Duplicate Send Prevention

Future delivery must prevent:

- duplicate sends to the same customer for the same campaign
- repeated sends inside an approved cool-down window
- retries that duplicate successful delivery
- sends from stale preview data
- sends that exceed the approved recipient count or approved cost

## Failure, Cancellation, And Withdrawal

Future delivery must define:

- cancellation before execution
- failure logging without raw PII leakage
- recipient opt-out and withdrawal handling
- immediate stop criteria for incorrect target selection
- partial-failure review and owner-visible status

## Audit Log Requirements

Future implementation will need an audit trail that can support operations review without leaking raw customer data.

Required log fields for future design:

- `campaign_id`
- `store_id`
- `approved_by`
- `approved_at`
- `recipient_count`
- masked preview snapshot reference
- message template version
- provider
- execution status
- failure reason
- cancellation reason

This PR does not create any database table for these fields. It documents the future contract only.

## Cost Approval

Future delivery must require owner approval for any cost-bearing provider action. The approval must include channel, provider, estimated recipient count, estimated charge, cancellation limits, and stop procedure.

## Future Only Scope

The following remain future-only:

- SMS provider
- Kakao provider
- email provider
- delivery logs
- secure recipient resolution
- campaign execution table
- provider webhook handling
- billing impact review

## Execution Contract

The current code-level contract is:

- `deliveryExecutionEnabled: false`
- `providerIntegrationEnabled: false`
- `allowedChannels: []`
- `futureChannels: ["sms", "kakao", "email"]`
- `requiresOwnerApproval: true`
- `requiresMarketingConsent: true`
- `requiresMaskedPreviewReview: true`
- `requiresFinalRecipientCountReview: true`
- `requiresMessageBodyReview: true`
- `requiresDuplicateSendPrevention: true`
- `requiresCostApproval: true`
- `requiresAuditLog: true`
- `requiresCancellationPolicy: true`
- `requiresFailureHandling: true`
- `requiresRollbackPolicy: true`
- `blockedActions: ["send_sms", "send_kakao", "send_email", "schedule_send", "execute_campaign", "resolve_raw_recipient", "write_delivery_log", "create_campaign_execution"]`

This contract is read-only and in-memory. It must not call a database, provider API, webhook, payment API, notification API, or network endpoint.

The operator-facing readiness checklist that precedes any future execution design is documented in `docs/vip-customer-delivery-readiness-checklist.md`.
