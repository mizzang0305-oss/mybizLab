# VIP Customer Memory Launch Scope

## Purpose

This document defines the July 2026 pilot launch scope for VIP Customer Memory.

The scope is read-only, preview-only, and plan-only. It is intended to help owners understand customer memory value before any delivery execution, raw recipient access, provider integration, payment automation, or production write path exists.

## Product Position

MyBiz should launch as a memory-based revenue assistant:

- remember store-scoped customer behavior and preferences
- surface VIP customer candidates
- show revisit and average-order-value opportunities
- prepare campaign previews without sending messages
- keep delivery execution behind explicit approval gates

## Launchable Scope

The July pilot may include:

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

This scope is enough to sell the business value of customer memory while keeping production side effects disabled.

## Not Launchable Scope

The July pilot must not include:

- actual SMS/Kakao/Email send
- provider integration
- API key/env registration
- raw phone/email resolution
- recipient export
- delivery log table/write
- webhook/callback
- payment/billing automation
- production DB migration/write

## Pilot Store Conditions

Pilot store onboarding requires:

- exact owner-selected store scope
- store_id tenancy confirmation
- operator role confirmation
- safe demo path
- no customer data export requirement
- no live delivery requirement
- support and rollback contact
- separate owner approval before future send, provider, raw recipient, migration, or payment phases

## Demo Scenario

The safe demo scenario is:

1. Explain VIP Customer Memory as a read-only customer-memory view.
2. Show VIP criteria and sample report sections.
3. Show campaign preparation preview with masked candidate information.
4. Explain delivery approval gate and readiness checklist.
5. Explain consent, provider selection, secret/env, raw recipient, and audit log boundaries.
6. Confirm that no delivery, raw recipient resolution, delivery logging, payment automation, or production DB write is enabled.

## Pricing Lock

Before launch, pricing must clarify:

- whether the pilot is trial, paid, or owner-approved manual onboarding
- whether VIP Customer Memory read-only is included
- which campaign preview features are included
- which delivery execution features are excluded
- what future approval is required for SMS, Kakao, email, provider integration, raw recipient access, delivery audit logs, and payment automation

## Privacy And Consent

The pilot must preserve:

- masked or aggregate customer evidence only
- no raw phone/email output
- no raw row sample output
- no actual recipient export
- marketing consent model as a planning boundary
- opt-out and withdrawal exclusion as future readiness requirements
- store_id tenancy for every customer-memory surface

## Launch Readiness Decision

The July launch can proceed only when the owner approves:

- pilot store scope
- demo scenario
- pricing and plan lock
- privacy and consent review
- delivery-disabled boundary
- production rollback and support path

The checklist is documented in `docs/july-launch-checklist.md`.
