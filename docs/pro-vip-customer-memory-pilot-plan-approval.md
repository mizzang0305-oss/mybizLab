# PRO/VIP Customer-Memory Pilot Plan Approval

Status: `OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_DRAFT`

Branch: `codex/pro-vip-customer-memory-pilot-plan-approval`

This is a docs/tests-only owner approval packet for creating the PRO/VIP customer-memory pilot execution plan. It does not approve live gate enablement, production DB writes, cleanup, pilot rollout execution, billing exposure, automation/reporting exposure, external notifications, SQL/RLS/grant execution, migrations, DB push, SQL replay, env/auth/payment/webhook changes, manual deploy, sales Excel work, PR #106 merge, or PR #125 merge.

## A. Current Status

| Item | Status | Evidence |
| --- | --- | --- |
| PR #143 | `MERGED` | contact-only customer-memory proof merged |
| PR #143 decision | `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS` | sanitized aggregate/boolean proof retained |
| PR #144 | `MERGED` | PRO/VIP rollout readiness review merged |
| PR #144 decision | `PRO_VIP_CUSTOMER_MEMORY_ROLLOUT_READINESS_REVIEW_PASS_MERGED` | readiness packet reached `main` |
| main HEAD after PR #144 | `d23842531d97c0175fbacf2bbb9c8a978899cf9f` | provided merge head |
| production read-only smoke | `PASS` | GET-only smoke returned 200 for `/`, `/pricing`, `/admin/leads`, `/dashboard/customers`, and `/dashboard/ai-reports` |
| live customer-memory gate | `NOT_ENABLED` | remains separately gated |
| cleanup/delete | `NOT_EXECUTED` | remains separately gated |
| pilot rollout | `NOT_EXECUTED` | this packet requests plan approval only |
| billing exposure | `NOT_ENABLED` | remains separately gated |
| automation/reporting exposure | `NOT_ENABLED` | remains separately gated |
| PR #106 | `OPEN Draft` | not merged |
| PR #125 | `OPEN Draft` | not merged |

## B. Pilot Objective

The pilot objective is to create a bounded execution plan that can later be approved or rejected before any live rollout.

The plan must validate:

- customer-memory value for PRO/VIP conversion.
- CRM and customer timeline usefulness for owner workflows.
- diagnostics, reports, dashboard, and automation-readiness without exposing raw PII.
- `store_members` access checks before any live enablement.
- `store_subscriptions` entitlement checks before any live enablement.
- rollback and kill-switch readiness before any store is enabled.

## C. Pilot Scope

The pilot plan scope is intentionally narrow:

- owner-approved pilot stores only.
- no real customer import unless separately approved.
- no bulk rollout.
- no billing exposure in this plan.
- no automated external notification.
- no cleanup in this plan.
- no PR #106 dependency merge.
- no PR #125 dependency merge.
- no live customer-memory gate enablement in this plan.
- no production DB write in this plan.

## D. Eligible Pilot Store Criteria

| Criterion | Required proof before pilot execution | Current packet decision |
| --- | --- | --- |
| Owner approval | explicit owner approval for the selected pilot store | `REQUIRED_AFTER_THIS_PR` |
| Store access | `store_members` access can be verified for the selected store | `REQUIRED_BEFORE_ENABLEMENT` |
| Plan entitlement | `store_subscriptions` plan state can be verified for the selected store | `REQUIRED_BEFORE_ENABLEMENT` |
| Feature flags | customer-memory feature flags can be evaluated without enabling them | `REQUIRED_BEFORE_ENABLEMENT` |
| Sanitized readiness | store has sanitized smoke/readiness evidence only | `REQUIRED_BEFORE_ENABLEMENT` |
| Rollback path | rollback and kill-switch path is documented | `REQUIRED_BEFORE_ENABLEMENT` |
| Tenancy clarity | no store tenancy ambiguity or wrong-store evidence | `REQUIRED_BEFORE_ENABLEMENT` |

## E. PRO/VIP Gating Plan

| Plan tier | Candidate customer-memory surface | Gate source | Current decision |
| --- | --- | --- | --- |
| FREE | public page, basic inquiry/waiting, limited capture | public route policy plus existing unpaid access policy | `UNCHANGED_BY_THIS_PACKET` |
| PRO candidate | customer CRM, integrated customer card, timeline, basic AI inquiry summary/classification | `store_members` access plus `store_subscriptions` entitlement plus customer-memory gate | `PLAN_ONLY_NOT_ENABLED` |
| VIP candidate | customer preferences, revisit automation, AI reports, upsell recommendation, advanced segmentation | `store_members` access plus `store_subscriptions` entitlement plus customer-memory gate plus automation/reporting approval | `PLAN_ONLY_NOT_ENABLED` |

Gating rules:

- entitlement source must be canonical `store_subscriptions`.
- access source must be canonical `store_members`.
- browser local state must not be treated as truth.
- live customer-memory writes must remain disabled until explicit owner approval.
- billing exposure must remain disabled until explicit billing exposure approval.
- automation/reporting exposure must remain disabled until explicit automation/reporting approval.

## F. Data Safety Plan

The pilot execution plan must preserve the following data safety rules:

- sanitized aggregate/boolean proof only.
- masked contact evidence only.
- no raw PII in docs, tests, logs, or PR text.
- no raw customer/contact/inquiry/timeline row samples.
- no full UUID output.
- no production data export.
- no cleanup until separately approved.
- no real customer import until separately approved.
- no customer-memory path may print raw customer name, raw contact value, raw store identifier, secret, token, cookie, payment payload, or webhook payload.

Customer-memory paths that remain sanitized and aggregate-only until approval:

- contact linkage proof summaries.
- customer card readiness summaries.
- customer timeline readiness summaries.
- inquiry and waiting aggregates.
- diagnostics and report aggregates.
- dashboard customer-memory metrics.
- automation-readiness summaries.
- rollback and kill-switch evidence.

## G. Approval Phrase

Required owner approval phrase for the next step:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED
```

Important: this phrase approves creation of the pilot execution plan only.

It does not approve:

- live customer-memory gate enablement.
- production DB write.
- cleanup/delete.
- pilot rollout execution.
- PRO/VIP billing exposure.
- automation/reporting exposure.
- external notification.
- real customer import.
- PR #106 merge.
- PR #125 merge.

## H. Next Step After This PR

```text
OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN
```

The next step may begin only after the approval phrase in section G is provided by the owner.

## I. Rollout Phases

| Phase | Name | Scope | Approval boundary |
| --- | --- | --- | --- |
| 1 | Plan approval packet | this docs/tests-only packet | Draft PR only |
| 2 | Pilot execution plan | create the exact pilot runbook, targets, gates, rollback, and validation checklist | requires `MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED` |
| 3 | One owner-approved pilot store dry-run | read-only/dry-run validation for one selected store | requires pilot execution plan approval |
| 4 | One owner-approved pilot store execute | one bounded execution against the approved store | requires separate execute approval |
| 5 | Read-only validation | GET/read-only validation and sanitized aggregate proof | no additional write approval |
| 6 | KPI review | compare pilot KPIs against stop/expand criteria | no live expansion |
| 7 | PRO/VIP expansion decision | decide pause, rollback, or expanded rollout | requires separate expansion approval |

## J. Kill-Switch / Rollback Conditions

The pilot execution plan must define kill-switch and rollback behavior before rollout.

Stop or rollback conditions:

- any raw PII leak.
- any store tenancy ambiguity.
- any `store_members` mismatch.
- any `store_subscriptions` mismatch.
- any unexpected DB write.
- any customer duplicate spike.
- any route access issue.
- any billing exposure before approval.
- any notification before approval.
- any wrong-store read or write evidence.
- any row cap breach.
- any webhook/payment side effect.
- any missing rollback evidence.

Rollback requirements:

- kill switch must disable customer-memory writes without broad deploy guesswork.
- rollback evidence must stay sanitized and aggregate-only.
- cleanup/delete must not be automatic and requires separate approval.
- billing exposure rollback must not mutate customer-memory data.
- automation/reporting rollback must not send external notifications.

## K. KPI Plan

| KPI | Measurement mode | Purpose |
| --- | --- | --- |
| identified customer count | aggregate-only | measure whether customer-memory creates useful customer identity coverage |
| customer card creation rate | aggregate-only | measure CRM activation and owner workflow value |
| timeline event creation rate | aggregate-only | measure customer history usefulness |
| inquiry to reservation conversion | aggregate-only | measure revenue conversion from inquiry flow |
| waiting to customer conversion | aggregate-only | measure customer capture from waiting flow |
| customer profile completion rate | aggregate-only | measure quality of customer-memory records |
| PRO conversion signal | aggregate-only | measure paid upgrade intent for PRO features |
| VIP conversion signal | aggregate-only | measure paid upgrade intent for VIP features |
| AI report usefulness signal | aggregate-only | measure reporting value without raw customer data |
| owner weekly active usage | aggregate-only | measure sustained owner engagement |
| churn risk signal | aggregate-only | detect whether customer-memory reduces or increases operational friction |

## L. Explicit Non-Actions

This PR does not:

- write to production DB.
- enable the live customer-memory gate.
- execute cleanup/delete.
- execute retry.
- execute a pilot rollout.
- enable billing exposure.
- enable automation/reporting exposure.
- apply migrations.
- push DB changes.
- replay SQL.
- execute RLS/GRANT/REVOKE.
- change env/auth/payment/webhook behavior.
- send external notifications.
- touch sales Excel.
- merge PR #106.
- merge PR #125.
- run a manual deploy.
- print raw PII.
- print raw row samples.
- print full UUIDs.

## M. side_effects JSON

```json
{
  "docs_only": true,
  "tests_only": true,
  "draft_pr_only": true,
  "ready_transition": false,
  "squash_merge": false,
  "production_db_write": false,
  "retry_execute": false,
  "cleanup_executed": false,
  "customer_memory_gate_enabled": false,
  "pilot_rollout_executed": false,
  "billing_exposure_enabled": false,
  "automation_reporting_exposure_enabled": false,
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
  "required_owner_approval_phrase": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED",
  "next_required_step": "OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN"
}
```
