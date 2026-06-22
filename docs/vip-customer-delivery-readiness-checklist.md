# VIP Customer Delivery Readiness Checklist

## Purpose

This checklist defines what the owner and operator must verify before any future VIP customer delivery implementation can be considered.

The current scope is `readiness_only`. It is a planning and test contract, not a delivery implementation.

## Current Scope

This plan adds:

- owner approval checklist
- marketing consent checklist
- recipient count review checklist
- message body review checklist
- cost approval checklist
- duplicate prevention checklist
- opt-out and withdrawal exclusion checklist
- failure and cancellation policy checklist
- provider integration is future-only

This plan does not add:

- send buttons
- scheduled send buttons
- execute campaign buttons
- SMS, Kakao, or email provider integration
- provider SDKs
- API keys
- environment variables
- delivery APIs
- webhook changes
- payment or billing changes
- migration files
- seed data
- production DB writes
- delivery log tables
- raw recipient resolution
- real customer data reads
- real customer PII fixtures
- customer grade, note, create, delete, or merge behavior

## Checklist Contract

The current code-level checklist is:

- `readinessCheckEnabled: true`
- `deliveryExecutionEnabled: false`
- `providerIntegrationEnabled: false`
- `checklistMode: "readiness_only"`
- `requiresOwnerApproval: true`
- `requiresMarketingConsent: true`
- `requiresRecipientCountReview: true`
- `requiresMessageBodyReview: true`
- `requiresCostApproval: true`
- `requiresDuplicatePrevention: true`
- `requiresOptOutExclusion: true`
- `requiresFailurePolicy: true`
- `requiresCancellationPolicy: true`
- `blockedActions: ["send_sms", "send_kakao", "send_email", "schedule_send", "execute_campaign", "resolve_raw_recipient", "write_delivery_log", "create_campaign_execution"]`

## Owner Approval Checklist

Before any future provider integration starts, the owner must approve the exact store scope, campaign purpose, channel family, operator role, cost boundary, rollback path, and stop criteria.

Approval phrases documented in this file are not executable approval. Future delivery work requires a separate owner approval message.

## Marketing Consent Checklist

Future delivery must exclude customers without current marketing consent, customers with unknown consent status, customers who opted out, and customers who withdrew consent.

The checklist does not query real customer consent records. It only documents the future readiness condition.

The consent model contract is documented in `docs/customer-marketing-consent-model.md`. It keeps `customer_marketing_consents` as a future schema proposal only and does not add a migration, seed, consent write UI, real customer consent read, or production DB write.

## Recipient Count Review Checklist

Future delivery must start from masked preview data and aggregate counts. The owner must review the final recipient count before any cost-bearing or provider-facing action exists.

Raw names, phone numbers, email addresses, private notes, raw rows, and full UUIDs remain out of scope.

## Message Body Review Checklist

Future delivery requires owner review of the exact message body. The review must cover offer wording, date limits, price or discount terms, opt-out copy, channel constraints, and misleading-advertising risk.

This checklist may document draft-message review requirements, but it must not send or schedule a message.

## Cost Approval Checklist

Future delivery must identify the channel, provider, estimated recipient count, estimated charge, retry cost, cancellation limit, and owner-visible stop procedure before any provider integration can be considered.

## Duplicate Prevention Checklist

Future delivery must prevent duplicate sends to the same customer for the same campaign, stale-preview sends, retries that repeat successful delivery, cross-store recipient mixing, and sends beyond approved recipient count or approved cost.

## Opt-Out And Withdrawal Exclusion Checklist

Future delivery must exclude opt-out and withdrawal records before recipient resolution. Withdrawal evidence and exclusion status must be auditable without exposing raw PII in reports, tests, or review output.

## Failure And Cancellation Policy Checklist

Future delivery must define failure states, cancellation before execution, partial-failure review, incorrect-target stop criteria, owner-visible status, and rollback communication. The current plan does not create delivery log tables or execution records.

## Provider Scope

SMS, Kakao, and email providers are future-only. This checklist does not install provider SDKs, add provider imports, configure API keys, add environment variables, call external APIs, or create webhook handlers.

## Store Tenancy And Privacy

Every future readiness review must remain scoped to the active `store_id`. Planning docs, fixtures, tests, and screenshots must use masked or aggregate evidence only.

Customer VIP signals and subscription VIP plan status remain separate. Subscription VIP is not a customer VIP scoring signal and is not a delivery readiness shortcut.
