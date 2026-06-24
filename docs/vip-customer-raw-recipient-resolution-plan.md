# VIP Customer Raw Recipient Resolution Plan

## Purpose

VIP delivery will eventually need a safe way to resolve a masked preview candidate into a real recipient only after consent, approval, provider, secret, audit, and rollback gates are complete.

This document defines that boundary before any raw phone or email access exists.

## Current Scope

The current scope is raw recipient resolution plan only.

This plan does not add:

- raw phone reads
- raw email reads
- raw recipient lookup
- recipient list export
- provider SDKs
- provider imports
- provider API calls
- SMS, Kakao, or email delivery
- send, scheduled-send, or execute-campaign buttons
- delivery log writes
- production DB writes
- migration files
- seed data
- real customer data reads
- real customer PII fixtures
- API keys or environment variables

The current UI and report flow remain masked preview only.

## Masked Preview Boundary

The owner may review masked customer candidates, aggregate reasons, and final counts in the existing read-only preview flow.

Raw phone and email access remains future-only and must not happen in the current code path. A masked preview is not permission to read raw contact fields, export a recipient list, or execute delivery.

## Consent And Opt-Out Boundary

Raw recipient resolution requires the marketing consent model in `docs/customer-marketing-consent-model.md`.

Future recipient resolution must require:

- `opted_in` consent status
- active consent evidence
- store-scoped consent
- opt-out exclusion
- withdrawal exclusion
- expired evidence exclusion
- invalid evidence exclusion
- unknown status exclusion

Current blockedStatuses:

- `unknown`
- `opted_out`
- `withdrawn`
- `expired`
- `invalid`

Contract literal:

- `blockedStatuses: ["unknown", "opted_out", "withdrawn", "expired", "invalid"]`

## Store Tenancy Boundary

Future raw recipient resolution must be scoped to the active `store_id`.

Consent, candidate selection, raw recipient lookup, delivery audit, and any future delivery log must all use the same store boundary. One store must never resolve or reuse another store's customer recipient.

## Secret/Env Boundary

Raw recipient resolution depends on the Secret/Env Architecture in `docs/vip-customer-delivery-secret-env-architecture.md`.

Future resolution must run only inside a secure server-side execution scope. It must not expose raw recipients to client bundles, public logs, PR comments, screenshots, reports, or local notes.

## Audit Boundary

Future raw recipient resolution requires an audit plan before any implementation.

The audit boundary must record redacted, store-scoped evidence such as:

- approval id
- store id
- campaign purpose
- candidate count
- resolved recipient count
- blocked recipient count
- blocked status summary
- execution actor
- execution timestamp

This plan does not create a delivery log table or write audit records.

## Contract

The current code-level contract is:

- `rawRecipientResolutionEnabled: false`
- `maskedPreviewOnly: true`
- `deliveryExecutionEnabled: false`
- `providerIntegrationEnabled: false`
- `productionWriteEnabled: false`
- `allowedNow: []`
- `futureResolutionFields: ["phone", "email"]`
- `requiresOwnerApproval: true`
- `requiresMarketingConsent: true`
- `requiresStoreScopedConsent: true`
- `requiresSecureExecutionScope: true`
- `requiresAuditLog: true`
- `requiresOptOutExclusion: true`
- `blockedStatuses: ["unknown", "opted_out", "withdrawn", "expired", "invalid"]`
- `blockedActions: ["read_raw_phone", "read_raw_email", "resolve_raw_recipient", "export_recipient_list", "send_sms", "send_kakao", "send_email", "execute_campaign", "write_delivery_log"]`

This contract is pure and in-memory. It must not call a database, read raw customer contact fields, export recipient lists, call a provider API, register a webhook, send a message, schedule delivery, execute a campaign, or write delivery logs.

## Related Documents

- `docs/customer-marketing-consent-model.md`
- `docs/vip-customer-delivery-secret-env-architecture.md`
- `docs/vip-customer-delivery-provider-integration-architecture.md`
- `docs/vip-customer-delivery-execution-contract.md`
- `docs/vip-customer-delivery-readiness-checklist.md`
