# Customer Marketing Consent Model Plan

## Purpose

VIP customer campaigns can help a store recover revisit traffic and raise average order value, but marketing delivery without customer consent creates legal, trust, and operational risk.

This document defines the customer marketing consent model that must exist before any future SMS, Kakao, or email delivery implementation can be considered.

## Current Scope

The current scope is consent model plan only.

This plan does not add:

- migration files
- production DB writes
- seed data
- real customer data reads
- real customer PII fixtures
- real SMS, Kakao, or email delivery
- provider integration
- provider SDKs
- API keys or environment variables
- send, scheduled send, or execute campaign buttons
- campaign execution paths
- consent write UI
- delivery log tables
- raw recipient resolution

## Consent Status

Future delivery eligibility must be based on a store-scoped consent status.

- `unknown`: consent is unclear. The customer is excluded from future delivery.
- `opted_in`: explicit marketing consent exists. This is the only future delivery-allowed status.
- `opted_out`: the customer refused marketing messages and is excluded.
- `withdrawn`: the customer previously consented but later withdrew consent and is excluded.
- `expired`: consent validity or evidence has expired and the customer is excluded.
- `invalid`: the consent evidence is incomplete, unverifiable, or legally unsafe and the customer is excluded.

Allowed future delivery statuses:

- `opted_in`

Blocked future delivery statuses:

- `unknown`
- `opted_out`
- `withdrawn`
- `expired`
- `invalid`

## Consent Source

Consent source describes how consent was collected. Sources are future scope only in this plan.

- `public_page_form`
- `reservation_form`
- `waiting_entry`
- `manual_import`
- `pos_import`
- `owner_uploaded_list`
- `kakao_channel`
- `offline_paper`
- `unknown`

Important rules:

- `unknown` source is not enough to allow future delivery.
- `manual_import` and `owner_uploaded_list` require evidence review before future delivery can be considered.
- Source data must remain scoped to the active `store_id`.

## Consent Timestamp

Future consent records must distinguish these timestamps:

- `consented_at`
- `withdrawn_at`
- `updated_at`
- `evidence_recorded_at`

Timestamp precedence rule:

- `withdrawn_at` overrides older `consented_at`.
- Expired or invalid evidence blocks future delivery even if an older opt-in exists.

## Opt-Out And Withdrawal

Future delivery must exclude:

- opted-out customers
- withdrawn customers
- customers with unknown consent status
- customers with expired consent
- customers with invalid consent evidence

Withdrawal has priority over opt-in. If a customer has both older opt-in evidence and newer withdrawal evidence, the customer is excluded.

## Consent Evidence

Future implementation will need evidence fields such as:

- `evidence_type`
- `evidence_source`
- `evidence_snapshot`
- `recorded_by`
- `recorded_at`
- `store_id`
- `customer_id`

This PR does not create a database table for these fields. It documents the future contract only.

## Store Tenancy

Consent must be store-scoped.

The same phone number or email-like identifier in another store must not share consent state. One store's consent cannot be used as another store's delivery basis.

Future consent reads, evidence review, recipient filtering, and audit records must all require matching `store_id`.

## Future Schema Proposal

Future table name:

- `customer_marketing_consents`

Future fields:

- `id`
- `store_id`
- `customer_id`
- `channel`
- `status`
- `source`
- `consented_at`
- `withdrawn_at`
- `expires_at`
- `evidence_type`
- `evidence_snapshot`
- `recorded_by`
- `created_at`
- `updated_at`

This plan intentionally creates no SQL file, migration file, schema apply, seed data, or production DB write.

## Delivery Readiness Connection

The marketing consent model connects to the existing VIP delivery readiness gate with these conditions:

- `requiresMarketingConsent=true`
- `requiresOptOutExclusion=true`
- `requiresStoreScopedConsent=true`
- `requiresEvidence=true`
- customers with `unknown`, `opted_out`, `withdrawn`, `expired`, or `invalid` status are excluded from future delivery

The current code-level plan is implemented as a pure in-memory contract builder. It must not call a database, provider API, webhook, payment API, notification API, or network endpoint.

## Future Provider Scope

SMS, Kakao, and email providers remain future-only. A separate owner approval gate is required before any provider integration, raw recipient resolution, consent write UI, delivery log table, or campaign execution path can be designed.

Provider comparison is tracked separately in `docs/vip-customer-delivery-provider-selection.md`. That plan is provider selection only and does not add provider SDKs, API keys, environment variables, provider imports, API calls, webhook handlers, or send execution.

Raw recipient resolution is tracked separately in `docs/vip-customer-raw-recipient-resolution-plan.md`. That plan keeps raw phone and email access future-only and requires this consent model before any recipient resolution can be considered.
