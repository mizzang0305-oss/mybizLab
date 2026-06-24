# VIP Customer Delivery Secret Env Architecture

## Purpose

VIP customer delivery can eventually support repeat visits and higher average order value, but provider secrets create account takeover, billing abuse, privacy, and accidental-send risk.

This document defines the Secret/Env Architecture boundary before any SMS, Kakao, or email provider key is created or configured.

## Current Scope

The current scope is Secret/Env Architecture plan only.

This plan does not add:

- API keys
- environment variables
- `.env` files
- provider SDKs
- provider imports
- provider clients
- provider API calls
- webhook or callback endpoints
- SMS, Kakao, or email delivery
- send, scheduled-send, or execute-campaign buttons
- production DB writes
- migration files
- seed data
- real customer data reads
- real customer PII fixtures

Any future secret, provider credential, or environment change requires a separate owner approval message after legal, cost, consent, readiness, execution-contract, provider-selection, architecture, and rollback checks are complete.

## Secret Boundary

Future provider credentials must be server-only secrets.

The architecture must keep provider credentials out of:

- source files
- docs
- tests
- client bundles
- public runtime config
- build output
- screenshots
- PR comments
- console logs
- customer-facing UI

No provider secret can be represented by a public client environment variable. Any browser-visible configuration is treated as public and must not contain provider credentials, tokens, private account identifiers, or signing secrets.

## Environment Separation

Future provider integration must separate local, preview, and production secret scopes.

Before any key is created, the owner must approve:

- exact provider account ownership
- exact target environment
- key creation actor
- storage location
- access policy
- rotation plan
- emergency revocation plan
- rollback owner
- audit evidence format

This plan intentionally defines no executable environment-variable names and no required runtime env vars.

## API Key Lifecycle

Future API key lifecycle must include:

- owner approval before key creation
- least-privilege provider account permissions
- no shared personal provider accounts
- rotation schedule
- emergency revoke procedure
- key inventory owner
- redacted readiness evidence
- incident response contact

Provider keys must not be copied into local notes, tests, fixtures, issue comments, PR descriptions, screenshots, or chat messages.

## Logging And Evidence

Future secret readiness evidence must be boolean and redacted.

Allowed evidence examples:

- `provider_secret_configured=true`
- `preview_secret_configured=false`
- `rotation_plan_documented=true`

Forbidden evidence examples:

- raw secret values
- partial secret prefixes
- account tokens
- provider API responses containing credentials
- raw customer identifiers or recipients
- production customer rows

## Provider Integration Dependency

Secret/env readiness is a prerequisite for future provider integration, but it does not enable provider integration.

The future provider adapter work must not start until this architecture, provider selection, marketing consent, delivery readiness, owner approval, and execution contract gates are all locked.

Raw recipient resolution is also future-only and tracked in `docs/vip-customer-raw-recipient-resolution-plan.md`. Any future raw phone or email access must stay behind this server-only secret/env boundary and must not expose raw recipients to client bundles, public logs, PR comments, screenshots, reports, or local notes.

## Contract

The current code-level contract is:

- `secretEnvArchitectureOnly: true`
- `apiKeyAdded: false`
- `envAdded: false`
- `apiKeyRequiredNow: false`
- `envChangeRequiredNow: false`
- `providerSdkRequiredNow: false`
- `providerImportEnabled: false`
- `providerIntegrationEnabled: false`
- `deliveryExecutionEnabled: false`
- `webhookEnabledNow: false`
- `productionWriteEnabled: false`
- `realCustomerDataReadEnabled: false`
- `allowedSecretNames: []`
- `requiredRuntimeEnvVars: []`
- `publicClientEnvAllowed: []`
- `futureSecretScopes: ["local", "preview", "production"]`
- `linkedContracts: ["provider_integration_architecture", "provider_selection_plan", "delivery_execution_contract", "marketing_consent_model", "delivery_readiness_checklist"]`
- `blockedActions: ["add_api_key", "add_env", "commit_env_file", "expose_secret_in_client_bundle", "install_provider_sdk", "import_provider_client", "call_provider_api", "register_webhook", "send_sms", "send_kakao", "send_email", "schedule_send", "execute_campaign", "log_secret_value", "store_secret_value", "read_secret_value", "read_real_customer_data"]`

This contract is pure and in-memory. It must not read env values, call a database, call a provider API, register a webhook, send a message, schedule delivery, execute a campaign, create a key, write configuration, store a secret value, read a secret value, or read real customer data.

## Related Documents

- `docs/vip-customer-delivery-provider-integration-architecture.md`
- `docs/vip-customer-delivery-provider-selection.md`
- `docs/vip-customer-delivery-execution-contract.md`
- `docs/customer-marketing-consent-model.md`
- `docs/vip-customer-raw-recipient-resolution-plan.md`
- `docs/vip-customer-delivery-readiness-checklist.md`
