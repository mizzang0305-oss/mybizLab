# PRO/VIP Customer-Memory Rollout Readiness Review

Status: `PRO_VIP_CUSTOMER_MEMORY_ROLLOUT_READINESS_REVIEW_DRAFT`

Branch: `codex/pro-vip-customer-memory-rollout-readiness-review`

This is a docs/tests-only readiness review after PR #143 reached `main`.
It does not enable the live customer-memory gate, execute a retry, clean up synthetic data, write to production DB, change env/auth/payment/webhook behavior, call external notifications, apply RLS/GRANT/REVOKE, run migrations, replay SQL, touch sales Excel, merge PR #106, or merge PR #125.

## A. Current Status

| Item | Status | Evidence |
| --- | --- | --- |
| PR #143 | `MERGED` | contact-only proof packet reached `main` |
| main HEAD after PR #143 | `850c2da3d05b50f3ffd452f0f7e3bac93b2291ac` | verified after squash merge |
| PR #143 decision | `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS` | sanitized proof retained |
| production auto deploy | `SUCCESS` | Vercel production auto deploy reached `READY` |
| production read-only smoke | `PASS` | GET-only smoke returned 200 for the listed routes |
| live customer-memory gate | `NOT_ENABLED` | remains separately gated |
| cleanup/delete | `NOT_EXECUTED` | remains separately gated |
| PR #106 | `OPEN Draft` | not merged |
| PR #125 | `OPEN Draft` | not merged |

## B. Proof Retained From PR #143

PR #143 proves only the non-PII contact path for the dedicated synthetic test-store scope.

Retained proof:

- contact-only retry executed exactly once before PR #143 was opened.
- decision: `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS`.
- `customers` delta: `+0`.
- `customer_contacts` delta: `+1`.
- `inquiries` delta: `+0`.
- `customer_timeline_events` delta: `+0`.
- non-target tables delta: `+0`.
- read-back contact count: `1`.
- contact type: `other`.
- marker match: `true`.
- contact/customer linkage: `true`.
- store scope: `true`.
- wrong-store count: `0`.
- raw PII output: `false`.
- raw row sample output: `false`.
- raw full store identifier output: `false`.

Not proven by PR #143:

- live customer-memory gate enablement.
- broad PRO/VIP rollout.
- cleanup/delete safety.
- public inquiry, reservation, waiting, automation, reporting, or billing exposure.
- RLS/grant hardening readiness for live broad writes.
- production customer-memory behavior for real customer PII.

## C. Product Interpretation

The customer-memory contact proof is now strong enough to move from proof collection to rollout readiness review.
The product interpretation is:

- customer memory has a proven synthetic contact link for a dedicated non-PII test-store scope.
- CRM confidence improved because the contact path can link back to the retained synthetic customer without creating inquiry or timeline rows.
- PRO/VIP value remains credible for customer memory, diagnostics, reports, dashboard, and automation, but not yet launch-enabled.
- live customer data must remain protected behind store membership, canonical subscription, launch gates, RLS/grant hardening, and owner approval.

## D. PRO/VIP Gating Matrix

| Route or feature candidate | Candidate plan | Gate source | Rollout decision |
| --- | --- | --- | --- |
| `/dashboard/customers` customer list and detail | `PRO` and `VIP` | `store_members` plus `store_subscriptions` plus customer-memory gate | `REVIEW_READY_NOT_ENABLED` |
| Customer timeline and contact history | `PRO` and `VIP` | `store_members` plus customer-memory gate | `REVIEW_READY_NOT_ENABLED` |
| Public inquiry capture into customer memory | `PRO` and `VIP` | `store_subscriptions` plus public write approval plus customer-memory gate | `BLOCKED_PENDING_APPROVAL` |
| Public reservation and waiting memory | `PRO` and `VIP` | `store_subscriptions` plus public write approval plus customer-memory gate | `BLOCKED_PENDING_APPROVAL` |
| `/dashboard/ai-reports` customer-memory reporting | `PRO` and `VIP` | `store_members` plus `store_subscriptions` plus aggregate-only reporting policy | `REVIEW_READY_NOT_ENABLED` |
| CRM diagnostics and customer segmentation | `PRO` and `VIP` | `store_members` plus sanitized aggregate policy | `REVIEW_READY_NOT_ENABLED` |
| Automation and daily summary jobs | `VIP` first, then `PRO` if stable | background job gate plus customer-memory gate plus notification policy | `BLOCKED_PENDING_APPROVAL` |
| PRO/VIP billing exposure | `PRO` and `VIP` | canonical `store_subscriptions` plus billing approval | `BLOCKED_PENDING_BILLING_APPROVAL` |

## E. Data Safety Matrix

| Data path | Required validation | Current decision |
| --- | --- | --- |
| Dashboard customer-memory reads | matching `store_members` row for the requested store | `REQUIRED_BEFORE_PILOT` |
| Paid feature eligibility | active canonical `store_subscriptions` row with `pro` or `vip` plan | `REQUIRED_BEFORE_PILOT` |
| Customer contact read-back | explicit projections, marker-scoped proof, no raw row sample | `PROVEN_FOR_SYNTHETIC_CONTACT_ONLY` |
| Customer/contact/inquiry/timeline writes | exact owner approval plus launch gate plus RLS/grant hardening | `BLOCKED_UNTIL_APPROVED` |
| Public inquiry or reservation intake | plan gate plus consent and write-route approval | `BLOCKED_UNTIL_APPROVED` |
| AI reports and diagnostics | aggregate-only read model until approval | `READINESS_REVIEW_ONLY` |
| Automation/reporting jobs | aggregate-only planning until job and notification approvals | `READINESS_REVIEW_ONLY` |
| Cleanup/delete | separate cleanup approval and rollback record | `BLOCKED_UNTIL_APPROVED` |

Customer-memory paths that must remain sanitized and aggregate-only until approval:

- contact proof summaries.
- customer timeline proof summaries.
- inquiry and reservation aggregates.
- dashboard customer counts and segment counts.
- AI report trend metrics.
- automation job summaries.
- rollback and kill-switch evidence.

These paths must not print raw customer names, raw phone numbers, raw emails, raw contact values, raw row samples, raw full store identifiers, secrets, tokens, or payment payloads.

## F. Route/Read-Only Smoke Matrix

The following smoke evidence was retained after PR #143 was merged and production auto-deployed.
All checks were GET-only and did not call write APIs.

| Route | Method | Result | Write/API call |
| --- | --- | ---: | --- |
| `/` | `GET` | `200` | `false` |
| `/pricing` | `GET` | `200` | `false` |
| `/admin/leads` | `GET` | `200` | `false` |
| `/dashboard/customers` | `GET` | `200` | `false` |
| `/dashboard/ai-reports` | `GET` | `200` | `false` |

## G. Required Approvals

| Approval area | Required approval | Must remain blocked until approval |
| --- | --- | --- |
| Live customer-memory gate enablement | `APPROVE_LIVE_CUSTOMER_MEMORY_GATE_ENABLEMENT_FOR_PRO_VIP_PILOT` | `liveCustomerMemoryWriteEnabled` and any related write gate |
| Cleanup/delete | `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CLEANUP_DELETE` | synthetic customer/contact/inquiry/timeline cleanup |
| Pilot store rollout | `APPROVE_PRO_VIP_CUSTOMER_MEMORY_PILOT_STORE_ROLLOUT` | store-scoped rollout beyond the dedicated test store |
| PRO/VIP billing exposure | `APPROVE_PRO_VIP_BILLING_EXPOSURE_FOR_CUSTOMER_MEMORY` | paid checkout, billing webhook, entitlement write, public billing copy changes |
| Automation/reporting exposure | `APPROVE_PRO_VIP_CUSTOMER_MEMORY_AUTOMATION_REPORTING_EXPOSURE` | live automation jobs, notification actions, external provider calls, report publication |

Next required step:

```text
OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN
```

## H. Rollout Phases

| Phase | Scope | Entry criteria | Exit criteria |
| --- | --- | --- | --- |
| Phase 0 | docs/tests-only readiness review | PR #143 merged and smoke passed | owner reviews this Draft PR |
| Phase 1 | pilot plan approval | explicit owner approval for pilot plan | exact target store, plan, gates, KPIs, rollback, and smoke checklist approved |
| Phase 2 | read-only pilot validation | no write gate enabled | `store_members` and `store_subscriptions` validation passes for pilot store |
| Phase 3 | live gate canary | separate live gate approval | one bounded pilot-store write path succeeds with sanitized read-back |
| Phase 4 | PRO/VIP limited exposure | billing and entitlement approvals | selected PRO/VIP features visible only for approved stores |
| Phase 5 | automation/reporting exposure | automation/reporting approval | aggregate metrics stable with no privacy, notification, or cost incidents |

## I. Rollback Plan

Required rollback and kill-switch conditions before rollout:

- keep `liveCustomerMemoryWriteEnabled=false` until the exact gate approval is issued.
- keep `broadDbWriteEnabled=false` for unrelated broad writes.
- confirm a code-level or config-level kill switch can disable customer-memory writes without deploy-time guesswork.
- confirm billing exposure can be hidden without changing customer-memory data.
- confirm automation/reporting exposure can be disabled without sending notifications.
- define a stop condition for any cross-store count mismatch, wrong-store read, raw PII log, row cap breach, non-target table write, webhook/payment side effect, or external notification attempt.
- define a rollback record format that uses sanitized aggregate counts only.
- require owner approval before cleanup/delete; cleanup must not be automatic rollback.

Source rollback for this PR is a normal revert because it is docs/tests-only.
Future live rollout rollback must be handled in a separate owner-approved runbook before enabling any live gate.

## J. KPI Plan

| KPI | Measurement mode | Purpose |
| --- | --- | --- |
| customer-memory contact linkage rate | aggregate-only | confirm contact rows link to the intended store/customer path |
| customer-memory write success rate | aggregate-only | detect adapter or policy failures without raw rows |
| wrong-store access count | aggregate-only | detect store isolation regressions |
| raw PII log incidents | zero-tolerance count | prove privacy guardrails remain active |
| dashboard customer-memory engagement | aggregate-only | measure CRM value for PRO/VIP users |
| inquiry-to-customer-memory conversion | aggregate-only | measure revenue path from public inquiry to CRM |
| report generation usage | aggregate-only | measure AI reports value without raw customer data |
| automation job success and block rate | aggregate-only | measure readiness for automation/reporting exposure |
| PRO/VIP conversion lift | aggregate-only | connect customer-memory value to paid plan conversion |
| support or rollback incidents | count-only | decide whether to expand, pause, or rollback |

## K. Explicit Non-Actions

This PR does not:

- write to production DB.
- execute a customer-memory retry.
- execute cleanup/delete.
- enable the live customer-memory gate.
- call a public API write route.
- create customer, contact, inquiry, or timeline rows.
- print raw PII.
- print raw row samples.
- print full UUIDs.
- execute RLS/GRANT/REVOKE.
- apply migrations.
- push DB changes.
- replay SQL.
- change env/auth/payment/webhook behavior.
- send external notifications.
- run a manual deploy.
- touch sales Excel.
- merge PR #106.
- merge PR #125.

## L. side_effects JSON

```json
{
  "docs_only": true,
  "tests_only": true,
  "production_db_write": false,
  "retry_execute": false,
  "cleanup_executed": false,
  "customer_memory_gate_enabled": false,
  "raw_pii_output": false,
  "raw_row_sample_output": false,
  "full_uuid_output": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "external_notification_sent": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "pr_125_merged": false,
  "next_required_step": "OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN"
}
```
