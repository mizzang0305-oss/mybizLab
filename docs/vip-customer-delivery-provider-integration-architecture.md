# VIP Customer Delivery Provider Integration Architecture

## Purpose

VIP customer delivery can support repeat visits and higher average order value, but provider integration introduces privacy, secret, cost, duplicate-send, callback, and operational rollback risk.

This document defines the provider integration architecture boundary before any future SMS, Kakao, or email provider is connected.

## Current Scope

The current scope is provider integration architecture plan only.

This plan does not add:

- provider SDKs
- provider imports
- provider API calls
- API keys
- environment variables
- SMS, Kakao, or email delivery
- send, scheduled send, or execute campaign buttons
- webhook or callback endpoints
- production DB writes
- migration files
- seed data
- raw recipient resolution
- delivery log tables
- real customer data reads
- real customer PII fixtures

Any future integration requires a separate owner approval message after legal, cost, consent, readiness, execution-contract, provider-selection, and rollback checks are complete.

## Future Architecture Flow

Future delivery must proceed in this order:

1. customer VIP candidate read-only view
2. marketing consent model
3. delivery readiness checklist
4. owner approval gate
5. delivery execution contract
6. provider selection
7. secure recipient resolution
8. provider adapter
9. delivery audit log
10. webhook or callback status update
11. failure, retry, and fallback handling

This PR documents steps 7 through 11 only. It does not implement them.

## Future Components

The future architecture can use these component names as contract labels only:

- `DeliveryProviderAdapter`
- `SmsProviderAdapter`
- `KakaoProviderAdapter`
- `EmailProviderAdapter`
- `SecureSecretProvider`
- `RecipientResolver`
- `ConsentVerifier`
- `ReadinessVerifier`
- `ApprovalVerifier`
- `DeliveryAuditLogger`
- `RateLimitGuard`
- `RetryPolicy`
- `FallbackPolicy`
- `WebhookStatusReceiver`

These names are not provider imports, SDK wrappers, API clients, webhook handlers, or database writers in this plan.

## Secret And Env Architecture

Future provider integration must define secure secret storage before any provider code is added.

The detailed Secret/Env Architecture is documented in `docs/vip-customer-delivery-secret-env-architecture.md`.

Required future decisions:

- separation of local, preview, and production secrets
- owner-approved API key storage path
- secret rotation process
- emergency key revocation process
- least-privilege provider account permissions
- redacted logging rules
- no API key exposure in source, docs, tests, build output, or PR comments

This plan adds no API key, token, account ID, env file, environment-variable name required for execution, or provider credential.

## Provider Adapter Architecture

Future provider adapters must share a common interface for channel, capability, rate limit, retry eligibility, cost estimate, and failure classification.

The future adapter boundary must keep provider-specific concerns behind adapter implementations. The product layer should only receive sanitized status and owner-visible summaries.

This plan does not add:

- provider imports
- provider clients
- SDK installation
- provider network calls
- send functions
- provider configuration files

## Recipient Resolution Boundary

Masked preview and raw recipient resolution must stay separate.

Current read-only views may show masked candidates and aggregate reasons only. Future raw recipient resolution must:

- run only after consent, readiness, owner approval, execution contract, and provider selection are complete
- resolve only customers scoped to the active `store_id`
- include only eligible `opted_in` marketing consent
- exclude `unknown`, `opted_out`, `withdrawn`, `expired`, and `invalid` consent states
- avoid raw phone or email output in logs, tests, docs, UI, or PR evidence
- stop before provider send if the final count differs from owner-approved count

This plan does not implement `RecipientResolver` or any raw recipient access path.

## Audit Log And Delivery Log Boundary

Future delivery needs an immutable audit trail, but this plan does not create any table or write path.

Future audit design must define:

- campaign identifier
- store identifier
- approval actor and approval time
- masked preview snapshot reference
- final recipient count
- message version
- provider and channel
- execution status
- failure reason
- cancellation reason
- rollback or stop marker

Delivery log schema and migrations are future-only and require separate owner approval.

## Webhook And Callback Boundary

Provider callbacks are future-only.

Future callback design must define:

- callback authentication
- replay protection
- event signature verification
- status mapping
- opt-out handling
- redacted logging
- failure review workflow
- idempotency and duplicate-event handling

This plan registers no webhook URL, callback route, payment route, billing route, notification path, or provider receiver.

## Failure, Retry, And Fallback Architecture

Future delivery must classify provider failures before any retry or fallback is allowed.

Future retry design must define:

- retryable and non-retryable failure categories
- maximum retry count
- backoff policy
- stale-preview prevention
- duplicate-send prevention
- owner-visible failure summary
- cancellation and stop criteria

Future fallback, such as Kakao failure to SMS, requires separate owner approval because it can increase cost and change the delivery channel. Fallback must also pass consent rules and duplicate-send prevention.

## Architecture Contract

The current code-level contract is:

- `architectureOnly: true`
- `providerIntegrationEnabled: false`
- `deliveryExecutionEnabled: false`
- `apiKeyRequiredNow: false`
- `envChangeRequiredNow: false`
- `providerSdkRequiredNow: false`
- `webhookEnabledNow: false`
- `rawRecipientResolutionEnabled: false`
- `deliveryLogTableEnabled: false`
- `allowedRuntimeProviders: []`
- `futureProviderChannels: ["sms", "kakao", "email"]`
- `requiredPreconditions: ["marketing_consent_model", "delivery_readiness_checklist", "owner_approval_gate", "delivery_execution_contract", "provider_selection_plan"]`
- `blockedActions: ["install_provider_sdk", "add_api_key", "add_env", "import_provider_client", "call_provider_api", "send_sms", "send_kakao", "send_email", "schedule_send", "execute_campaign", "resolve_raw_recipient", "write_delivery_log", "create_delivery_log_table", "register_webhook", "handle_provider_callback"]`

This contract is pure and in-memory. It must not call a database, provider API, webhook, payment API, notification API, or network endpoint.

## Related Documents

- `docs/customer-marketing-consent-model.md`
- `docs/vip-customer-delivery-readiness-checklist.md`
- `docs/vip-customer-delivery-execution-contract.md`
- `docs/vip-customer-delivery-provider-selection.md`
- `docs/vip-customer-delivery-secret-env-architecture.md`
