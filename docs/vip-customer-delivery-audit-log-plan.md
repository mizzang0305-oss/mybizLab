# VIP Customer Delivery Audit Log Plan

## Purpose

Future VIP delivery will need an owner-reviewable audit trail before any SMS, Kakao, or email execution can be considered.

This document defines the audit log boundary while keeping the current product plan-only, preview-only, and write-free.

## Current Scope

The current scope is audit log plan only.

This plan does not add:

- delivery log database tables
- migration files
- SQL files
- production DB writes
- raw recipient storage
- raw phone or email reads
- recipient list export
- provider SDKs
- provider imports
- provider API calls
- SMS, Kakao, or email delivery
- send, scheduled-send, or execute-campaign buttons
- webhook endpoints
- payment or notification execution

It does not create the `vip_delivery_audit_logs` table.

## Explicit Prohibitions

migration remains prohibited.

production write remains prohibited.

raw recipient storage remains prohibited.

The audit log design must not store raw phone numbers, raw email addresses, raw customer names, private notes, raw rows, full UUIDs, provider secrets, API keys, or message-provider payloads in customer-visible evidence.

## Future Audit Log Fields

If a later owner-approved phase creates a delivery audit table, the future fields must be reviewed before any migration:

- `delivery_audit_id`
- `store_id`
- `campaign_id`
- `approved_by`
- `approved_at`
- `approval_snapshot`
- `recipient_count`
- `masked_recipient_snapshot`
- `message_template_id`
- `message_body_hash`
- `provider`
- `channel`
- `execution_status`
- `failure_reason`
- `cancellation_reason`
- `created_at`

These names are planning fields only. They are not a schema migration and are not a table creation.

## Masked Snapshot Policy

Future audit evidence must use `masked_recipient_snapshot` instead of storing raw recipient fields.

The snapshot should preserve:

- campaign purpose
- masked candidate references
- approved recipient count
- excluded recipient count
- exclusion reason summary
- owner approval snapshot reference

The snapshot must not include raw phone, raw email, raw customer name, raw row samples, or full UUIDs.

## Message Hash Policy

Future audit evidence must use `message_body_hash` to connect an approval to the exact reviewed message body without exposing message text in logs that do not need it.

The hash policy must be paired with the message-template review and approval flow before any delivery implementation.

## Failure And Cancellation Policy

Future delivery audit design must include:

- `execution_status` for pending, cancelled, failed, partially failed, and completed states
- `failure_reason` for sanitized provider, readiness, consent, rate-limit, or validation failures
- `cancellation_reason` for owner cancellation, stale preview, opt-out, cost stop, or emergency stop cases

Failure and cancellation evidence must be sanitized and store-scoped.

## Contract

The current code-level contract is:

- `auditLogPlanOnly: true`
- `deliveryLogTableEnabled: false`
- `migrationRequiredBeforeExecution: true`
- `productionWriteEnabled: false`
- `rawRecipientStorageEnabled: false`
- `requiresOwnerApproval: true`
- `requiresMaskedRecipientSnapshot: true`
- `requiresMessageBodyHash: true`
- `requiresRecipientCount: true`
- `requiresExecutionStatus: true`
- `requiresFailureReason: true`
- `requiresCancellationReason: true`
- `futureTable: "vip_delivery_audit_logs"`
- `blockedActions: ["create_delivery_log_table", "write_delivery_log", "store_raw_recipient", "store_raw_phone", "store_raw_email", "execute_campaign", "send_sms", "send_kakao", "send_email", "register_webhook"]`

This contract is pure and in-memory. It must not call a database, create a table, run SQL, store raw recipients, call a provider API, register a webhook, send a message, schedule delivery, execute a campaign, or write delivery logs.

## Related Documents

- `docs/vip-customer-raw-recipient-resolution-plan.md`
- `docs/vip-customer-delivery-execution-contract.md`
- `docs/vip-customer-delivery-secret-env-architecture.md`
- `docs/customer-marketing-consent-model.md`
