# VIP Customer Delivery Provider Selection Plan

## Purpose

VIP customer delivery can eventually support revisit recovery and higher average order value, but the provider choice controls cost, consent risk, private data handling, delivery failure behavior, and vendor lock-in.

This document defines how MyBiz will compare SMS, Kakao, and email providers before any future provider integration is approved.

## Current Scope

The current scope is provider selection plan only.

This plan does not add:

- provider SDKs
- provider imports
- provider API calls
- API keys
- environment variables
- SMS, Kakao, or email delivery
- send, scheduled send, or execute campaign buttons
- webhook or callback handlers
- production DB writes
- migration files
- seed data
- raw recipient resolution
- real customer data reads
- real customer PII fixtures

Future provider integration requires a separate owner approval message after the consent model, readiness checklist, execution contract, cost boundary, and legal review are locked.

## Candidate Channels

Provider comparison is limited to future candidate channels:

- `sms`
- `kakao`
- `email`

Current allowed channels remain empty. No channel is enabled for delivery in this plan.

## SMS Candidate Criteria

SMS candidates must be evaluated for:

- message unit cost and retry cost
- sender number registration requirements
- marketing-message review requirements
- opt-out text support
- domestic delivery reliability
- rate limit behavior
- failure status detail
- cancellation support before execution
- personal data processing terms

## Kakao Candidate Criteria

Kakao AlertTalk or FriendTalk candidates must be evaluated for:

- business channel review requirements
- template review requirements
- template modification lead time
- per-message cost
- fallback SMS cost
- user opt-out handling
- rate limit behavior
- failure callback detail
- personal data processing terms

No Kakao provider is integrated in this plan.

## Email Candidate Criteria

Email candidates must be evaluated for:

- sender domain verification
- unsubscribe handling
- bounce and complaint visibility
- marketing consent compatibility
- template approval or policy requirements
- per-send or monthly cost
- rate limit behavior
- suppression-list behavior
- personal data processing terms

No email provider is integrated in this plan.

## Cross-Provider Evaluation Criteria

The code-level provider selection plan uses these criteria:

- `cost`
- `approval_review_required`
- `personal_data_processing`
- `api_key_management`
- `rate_limit`
- `failure_retry_policy`
- `webhook_callback_future_scope`
- `vendor_lock_in`
- `fallback_strategy`

## Cost Criteria

Provider review must compare:

- unit cost by channel
- minimum monthly fee
- retry cost
- fallback cost
- template or channel review cost
- cancellation or refund behavior
- owner-visible estimated charge before any future execution

## Approval And Review Criteria

Future provider integration cannot start until the owner approves:

- provider family
- target channel
- expected monthly volume
- cost ceiling
- approval or template review process
- sender identity requirements
- stop criteria
- rollback plan

Approval text inside this document is not executable approval.

## Personal Data Criteria

Providers must be reviewed for:

- whether phone numbers or email-like identifiers are transmitted
- data retention period
- subprocessors
- data residency and access control
- log redaction behavior
- support for masked review before raw recipient resolution
- deletion and audit support

MyBiz must keep store-scoped consent and recipient eligibility separate per `store_id`.

## API Key And Env Criteria

Future API keys must be stored only through the approved environment and secret-management process.

This plan does not add:

- `.env` files
- API keys
- provider tokens
- provider account IDs
- environment-variable names required for execution

## Failure, Retry, And Rate Limit Criteria

Provider selection must document:

- rate limit units
- retry eligibility
- retry backoff
- duplicate-send prevention
- partial failure handling
- cancellation boundary
- owner-visible failure summary

Retries must not create duplicate delivery to the same customer, stale preview, or cross-store recipient mixing.

## Webhook And Callback Scope

Webhook and callback handling is future-only.

Future design must separate callback verification, delivery status logging, opt-out handling, and failure review before any implementation. This plan registers no callback URL and creates no webhook handler.

## Lock-In And Fallback Criteria

Provider review must identify:

- lock-in risk
- exportability of templates
- fallback channel rules
- fallback cost
- provider outage behavior
- manual stop procedure

Fallback delivery remains disabled until separate owner approval.

## Consent Model Link

Provider selection depends on `docs/customer-marketing-consent-model.md`.

Future provider integration must not proceed until the marketing consent model can exclude unknown, opted-out, withdrawn, expired, and invalid consent states.

## Readiness Checklist Link

Provider selection depends on `docs/vip-customer-delivery-readiness-checklist.md`.

Future provider integration must not proceed until owner approval, message body review, recipient count review, cost approval, duplicate prevention, failure policy, cancellation policy, and opt-out exclusion are all complete.

## Blocked Actions

The provider selection plan blocks:

- `install_provider_sdk`
- `add_api_key`
- `add_env`
- `import_provider_client`
- `call_provider_api`
- `send_sms`
- `send_kakao`
- `send_email`
- `schedule_send`
- `execute_campaign`
- `register_webhook`
