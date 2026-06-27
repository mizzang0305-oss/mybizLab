# Post-Pilot Integration Approval Matrix

This document defines the post-pilot integration approval matrix only.

It is plan-only and read-only. It does not run migrations, create production data, import real customers, resolve raw recipients, install providers, add API keys, add environment variables, call social APIs, auto-publish blog posts, send SMS/Kakao/Email, charge payments, create subscriptions, register webhooks, or write production data.

## Purpose

After the July pilot, risky features must not open as one broad approval. Each integration needs a separate owner approval phrase, required preconditions, rollback plan, safety scan, first execution limit, and production impact review.

The goal is to keep MyBiz as a memory-based revenue engine SaaS while controlling privacy, cost, legal, and operational risk.

## Current state

- all integrations disabled now: true
- production execution enabled: false
- migration execution enabled: false
- payment execution enabled: false
- delivery execution enabled: false
- social integration enabled: false
- blog auto-publishing enabled: false
- raw recipient resolution enabled: false
- separate owner approval required: true

## Approval matrix

| Area | Approval phrase | Required preconditions | First execution limit | Production impact |
| --- | --- | --- | --- | --- |
| production DB migration | `OWNER_APPROVES_PRODUCTION_DB_MIGRATION_AFTER_PILOT` | schema design, rollback plan, backup evidence, staging validation | one reviewed migration in staging before production | high |
| real store/customer import | `OWNER_APPROVES_REAL_STORE_CUSTOMER_IMPORT_AFTER_PILOT` | store scope, consent boundary, PII minimization, import rollback | one manually selected pilot store | high |
| raw recipient resolution | `OWNER_APPROVES_RAW_RECIPIENT_RESOLUTION_AFTER_PILOT` | consent model, tenant check, access log, recipient exclusion policy | masked dry-run evidence before raw access | high |
| SMS/Kakao/Email provider | `OWNER_APPROVES_SMS_KAKAO_EMAIL_PROVIDER_AFTER_PILOT` | provider contract, API key storage, rate limit, failure retry policy | one provider sandbox or reviewed dry-run only | high |
| delivery audit log table/write | `OWNER_APPROVES_DELIVERY_AUDIT_LOG_WRITE_AFTER_PILOT` | migration approval, raw recipient policy, message hash design, retention policy | one campaign-purpose audit design review | high |
| payment/billing/subscription | `OWNER_APPROVES_PAYMENT_BILLING_SUBSCRIPTION_AFTER_PILOT` | pricing lock, refund policy, billing webhook review, subscription rollback | one test payment path before live billing | high |
| YouTube integration | `OWNER_APPROVES_YOUTUBE_INTEGRATION_AFTER_PILOT` | OAuth review, content approval, token storage plan, manual rollback | manual upload or read-only channel proof first | medium |
| Instagram integration | `OWNER_APPROVES_INSTAGRAM_INTEGRATION_AFTER_PILOT` | OAuth review, brand copy approval, token storage plan, manual rollback | manual post review before API posting | medium |
| Threads integration | `OWNER_APPROVES_THREADS_INTEGRATION_AFTER_PILOT` | OAuth review, brand copy approval, token storage plan, manual rollback | manual post review before API posting | medium |
| blog auto-publishing | `OWNER_APPROVES_BLOG_AUTO_PUBLISHING_AFTER_PILOT` | manual publish checklist, SEO metadata review, customer case exclusion, rollback URL | one owner-reviewed article only | medium |
| cross-channel analytics | `OWNER_APPROVES_CROSS_CHANNEL_ANALYTICS_AFTER_PILOT` | UTM policy, event taxonomy, no raw PII, dashboard review | read-only aggregate dashboard only | medium |

Every row requires owner review, a rollback plan, and a safety scan before first execution.

## Required safety scan before any later execution

- changed files are expected only
- no package/env/lockfile change unless explicitly approved for that integration
- no migration unless the migration approval phrase is present
- no API key or environment variable addition unless the secret/env approval phrase is present
- no real customer data read unless the real data approval phrase is present
- no raw recipient resolution unless the raw recipient approval phrase is present
- no provider import or API call unless the provider approval phrase is present
- no payment or billing webhook unless the payment approval phrase is present
- no social/blog API call unless the matching channel approval phrase is present

## Code contract

The pure contract is `buildPostPilotIntegrationApprovalMatrix()`.

Required values:

- `approvalMatrixPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `allIntegrationsDisabledNow: true`
- `requiresSeparateOwnerApproval: true`
- `productionExecutionEnabled: false`
- `migrationExecutionEnabled: false`
- `paymentExecutionEnabled: false`
- `deliveryExecutionEnabled: false`
- `socialIntegrationEnabled: false`
- `blogAutoPublishingEnabled: false`
- `rawRecipientResolutionEnabled: false`

Required approval areas:

- `production_db_migration`
- `real_store_customer_import`
- `raw_recipient_resolution`
- `sms_kakao_email_provider`
- `delivery_audit_log_table_write`
- `payment_billing_subscription`
- `youtube_integration`
- `instagram_integration`
- `threads_integration`
- `blog_auto_publishing`
- `cross_channel_analytics`

## Related Documents

- `docs/july-launch-go-no-go-gate.md`
- `docs/e2e-feature-data-flow-audit.md`
- `docs/channel-integration-readiness-audit.md`
- `docs/vip-customer-delivery-provider-integration-architecture.md`
- `docs/vip-customer-raw-recipient-resolution-plan.md`
- `docs/vip-customer-delivery-audit-log-plan.md`
- `docs/july-pricing-plan-lock.md`
