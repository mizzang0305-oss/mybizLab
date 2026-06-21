# VIP Customer Delivery Approval Gate

## Purpose

This document defines the separate approval gate required before MyBiz can add any delivery integration for VIP customer campaign preparation.

The current VIP Customer Memory flow is read-only and preview-only. It can show masked candidates, candidate counts, reasons, and message drafts. It must not send messages, schedule messages, execute campaigns, update customers, edit notes, create customers, delete customers, merge customers, or write production data.

## Preview Versus Delivery Execution

The current preview is a planning surface:

- shows masked customer candidates
- shows aggregate reasons
- shows suggested message drafts
- keeps delivery execution disabled
- keeps customer records unchanged
- keeps campaign history and delivery logs out of scope

Delivery execution is a future scope that requires a separate owner approval, privacy review, consent review, cost review, and rollback plan before any provider integration is added.

## Required Approval Conditions

Delivery work cannot start until all of these conditions are approved and recorded:

- owner approval for the exact delivery channel and store scope
- marketing consent review for every recipient
- masked preview review before any final recipient list is produced
- final recipient count review before any cost-bearing action
- message draft review before any delivery-provider integration
- permission review for the operator who can approve delivery
- store_id tenancy review for all recipients
- failure, cancellation, and withdrawal handling plan
- duplicate delivery prevention plan
- cost approval for SMS, Kakao, email, or provider fees
- delivery log requirement for future auditability

## Privacy And Recipient Access

The approval gate requires masked previews first. Raw names, phone numbers, emails, private notes, raw rows, full UUIDs, or provider credentials must not be included in planning docs, fixtures, test output, or review comments.

Final recipient access is future-only and must be limited to the minimum authorized operator after approval. Recipient data must remain scoped to the active `store_id`.

## Store Tenancy

Every future delivery recipient must be derived from the same active `store_id` as the merchant session. Cross-store customer, order, preference, timeline, inquiry, reservation, waiting, or report data must be excluded before any recipient count is calculated.

## Permission Standard

Future delivery approval must distinguish these roles:

- viewer: can inspect read-only masked previews
- approver: can approve a reviewed delivery plan after consent and cost checks
- operator: can run an approved future delivery workflow only after implementation and separate approval

The current implementation only supports read-only preview behavior. It does not add approver or operator execution behavior.

## Future Channel Scope

All channels are future-only:

- SMS: future approval only
- Kakao: future approval only
- Email: future approval only

No provider SDK, webhook, API call, queue, campaign execution table, delivery log table, or billing integration is added by this plan.

## Failure, Cancellation, And Withdrawal

Future delivery design must define:

- how a delivery attempt can fail safely
- how a pending delivery can be cancelled
- how marketing consent withdrawal is handled before delivery
- how partial delivery status is reviewed
- how owner-visible logs avoid raw PII leakage

## Abuse And Duplicate Prevention

Future delivery design must prevent:

- repeated sends to the same customer for the same campaign
- sends without current marketing consent
- sends across stores
- sends from stale preview data
- sends without owner approval
- sends that exceed approved recipient count or cost

## Cost Gate

Any future delivery integration must include an explicit cost review before provider use. The cost gate must identify the channel, provider, estimated recipient count, estimated charge, cancellation limits, and rollback or stop procedure.

## Approval Contract

The current safety contract is:

- `deliveryExecutionEnabled: false`
- `requiresOwnerApproval: true`
- `requiresMarketingConsent: true`
- `requiresMaskedPreviewReview: true`
- `requiresFinalRecipientCountReview: true`
- `blockedActions: ["send_sms", "send_kakao", "send_email", "schedule_send", "execute_campaign"]`

This contract is read-only. It is not a delivery implementation.

## Explicit Non-Goals

This plan does not add:

- send buttons
- scheduled send buttons
- execute campaign buttons
- SMS, Kakao, or email provider integration
- delivery APIs
- webhook changes
- payment or billing changes
- migration files
- seed data
- production DB writes
- real customer PII fixtures
- customer grade edits
- customer note edits
- customer create, delete, or merge behavior
- campaign execution tables
