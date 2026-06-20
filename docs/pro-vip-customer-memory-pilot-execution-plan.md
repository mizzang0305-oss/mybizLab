# PRO/VIP Customer-Memory Pilot Execution Plan

Status: `OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_DRAFT`

Branch: `codex/pro-vip-customer-memory-pilot-execution-plan`

This docs/tests-only PR creates the PRO/VIP customer-memory pilot execution plan only. It does not execute a dry-run, execute a real-data pilot, write to production DB, enable the live customer-memory gate, expose billing, expose automation/reporting, execute cleanup, execute retry, send external notifications, apply SQL/RLS/grant/migration/db push changes, replay SQL, change env/auth/payment/webhook settings, touch sales Excel, merge PR #106, or merge PR #125.

## A. Current Status

| Item | Status | Evidence |
| --- | --- | --- |
| PR #143 | `MERGED` | contact-only customer-memory proof merged |
| PR #144 | `MERGED` | PRO/VIP customer-memory rollout readiness review merged |
| PR #145 | `MERGED` | PRO/VIP customer-memory pilot plan approval packet merged |
| main HEAD after PR #145 | `5e903a0667f6f4634bf5d0e1d00f029a643cac79` | post-merge baseline |
| owner approval phrase | `PROVIDED` | `MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED` |
| this PR scope | `EXECUTION_PLAN_ONLY` | creates documentation and tests only |
| live customer-memory gate | `NOT_ENABLED` | remains separately gated |
| dry-run execution | `NOT_EXECUTED` | not authorized by this PR |
| pilot execution | `NOT_EXECUTED` | not authorized by this PR |
| production DB write | `NOT_PERFORMED` | not authorized by this PR |
| billing exposure | `NOT_ENABLED` | remains separately gated |
| automation/reporting exposure | `NOT_ENABLED` | remains separately gated |
| PR #106 | `OPEN Draft` | not merged |
| PR #125 | `OPEN Draft` | not merged |

## B. Approval Basis

Consumed approval phrase:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED
```

This phrase authorizes creation of the pilot execution plan PR only.

It does not authorize:

- production DB write.
- live customer-memory gate enablement.
- dry-run execution.
- pilot execute.
- cleanup.
- billing exposure.
- automation/reporting exposure.
- external notification.
- bulk customer import.
- PR #106 merge.
- PR #125 merge.

## C. Pilot Execution Objective

The execution plan prepares a controlled test-stage real-data pilot path without executing it.

Objectives:

- prepare a controlled test-stage real-data pilot path.
- validate customer-memory usefulness for PRO/VIP conversion.
- validate customer CRM, customer card, and timeline usefulness.
- validate diagnostics, report, and dashboard readiness.
- validate `store_members` access check.
- validate `store_subscriptions` entitlement check.
- validate sanitized customer-memory evidence.
- confirm rollback and kill-switch readiness before any future write.

## D. Real-Data Test-Stage Policy

Real data may be used only after environment classification.

Policy:

- preferred environment: staging/dev/test Supabase project.
- if only production DB exists, this PR must not write.
- real-data sample must be manually bounded.
- no bulk import.
- no raw PII in output.
- no customer list dump.
- no full UUID output.
- no raw row samples.
- no external notifications.
- no billing exposure.
- no automation/report delivery.
- real data must be limited to one owner-approved pilot store.
- if only production DB exists, prepare the plan and harness but do not write until the next explicit execute approval.

Recommended first test sample:

| Data path | Recommended cap | Notes |
| --- | ---: | --- |
| stores | 1 | one owner-approved pilot store only |
| customers | 1 to 3 | manually bounded real-data sample only |
| customer_contacts | 1 to 3 | masked contact evidence only |
| customer_timeline_events | 1 to 3 | sanitized event summaries only |
| inquiries/reservations/waiting_entries | optional 1 total | only if separately approved in the next execute step |

## E. Pilot Candidate Requirements

A store can be included only if all requirements are true:

- owner approval is documented.
- store identifier can be referenced without exposing full UUID.
- `store_members` access can be validated.
- `store_subscriptions` plan state can be validated.
- customer-memory candidate flags can be evaluated without enabling live gate.
- no real customer bulk import is required.
- sanitized smoke evidence exists.
- rollback path is defined.
- billing exposure is explicitly disabled.
- automation/reporting exposure is explicitly disabled.
- external notification is explicitly disabled.
- store tenancy boundary is unambiguous.
- all evidence is sanitized aggregate/boolean proof only.

## F. Execution Boundaries

Future execution must be split into the following gates:

1. execution plan approval.
2. dry-run plan.
3. owner-approved dry-run.
4. dry-run read-only validation.
5. owner-approved small real-data test execute.
6. post-execute read-only validation.
7. KPI review.
8. expansion decision.

This PR creates only step 1 documentation and tests. It does not authorize or perform steps 2 through 8.

## G. PRO/VIP Gating Model

| Tier | Candidate surfaces | Authority |
| --- | --- | --- |
| FREE | public page, basic inquiry, basic waiting, limited capture | existing public/basic access policy |
| PRO candidate | customer CRM, integrated customer card, customer timeline, basic AI inquiry summary/classification, basic customer diagnostics | `store_members` access plus `store_subscriptions` entitlement |
| VIP candidate | customer preferences, revisit automation readiness, AI reports, upsell recommendation readiness, advanced segment readiness | `store_members` access plus `store_subscriptions` entitlement plus separate automation/reporting approval |

Rules:

- entitlement source: `store_subscriptions`.
- access source: `store_members`.
- forbidden authority: browser local state, mock state, and client-only flags.
- all customer-memory behavior must be store-scoped.
- live gate enablement remains blocked until separate owner approval.

## H. Data Safety Plan

The pilot execution plan must preserve:

- sanitized aggregate/boolean evidence only.
- masked contact evidence only.
- no raw PII.
- no raw row sample.
- no full UUID output.
- no production data export.
- no cleanup until separately approved.
- no external notification.
- no billing exposure.
- no automated report delivery.
- no real customer bulk import.
- no customer list dump.
- no customer/contact/inquiry/timeline raw row output.
- no secret, token, cookie, payment payload, or webhook payload output.

## I. Future Dry-Run Plan Outline

The future dry-run is not approved by this PR.

Future dry-run definition:

- read-only or simulation-only unless separately approved.
- no production write.
- no gate enablement.
- no customer row creation.
- no customer_contact row creation.
- no inquiry row creation.
- no timeline row creation.
- no cleanup.
- no billing exposure.
- no notification.
- no raw PII output.

Future dry-run validates only:

- environment classification.
- route availability.
- entitlement-readiness.
- access-readiness.
- customer-memory adapter readiness.
- dashboard/reporting readiness.
- safety scan readiness.
- rollback readiness.

## J. Future Small Real-Data Execute Outline

The future small real-data execute is not approved by this PR.

Future execute requirements:

- requires separate owner approval phrase.
- limited to one owner-approved pilot store.
- limited to a small real-data sample.
- must show bounded expected DB effects before execution.
- must have rollback and kill-switch documented.
- must produce sanitized evidence only.
- must not include bulk rollout.
- must not include billing exposure.
- must not send notifications.
- must not enable automation/reporting delivery.
- must not expose raw PII.
- must not expose raw row samples.
- must not expose full UUIDs.

## K. Kill-Switch Conditions

Stop future rollout immediately if any condition occurs:

- raw PII appears in logs/docs/tests.
- full UUID appears in public/report output.
- raw row sample appears.
- `store_members` check is ambiguous.
- `store_subscriptions` check is ambiguous.
- store tenancy boundary is unclear.
- unexpected production DB write occurs.
- customer duplicate risk is detected.
- route access mismatch appears.
- billing exposure appears before approval.
- automation/reporting exposure appears before approval.
- external notification risk appears.
- cleanup is attempted without approval.
- PR #106 or PR #125 is merged as a side effect.

## L. Rollback Plan

Rollback plan:

- feature gate remains off by default.
- pilot can be stopped before live gate enablement.
- any future execute must have bounded row expectations.
- cleanup requires separate owner approval.
- no cleanup is included in this execution-plan PR.
- rollback evidence must be sanitized.
- owner-facing status must show `PASS`, `BLOCKED`, or `ROLLBACK_REQUIRED`.
- billing exposure rollback must not mutate customer-memory data.
- automation/reporting rollback must not send external notifications.

## M. KPI Plan

| KPI | Measurement mode | Purpose |
| --- | --- | --- |
| identified customer count | aggregate-only | measure customer-memory identity coverage |
| customer card creation rate | aggregate-only | measure CRM/customer card value |
| customer timeline event creation rate | aggregate-only | measure timeline usefulness |
| inquiry-to-reservation conversion signal | aggregate-only | measure customer-memory revenue path |
| waiting-to-customer conversion signal | aggregate-only | measure waiting capture quality |
| customer profile completion rate | aggregate-only | measure profile readiness |
| PRO conversion signal | aggregate-only | measure paid plan upgrade signal |
| VIP conversion signal | aggregate-only | measure advanced plan upgrade signal |
| AI report usefulness signal | aggregate-only | measure reporting value without raw data |
| dashboard active usage | aggregate-only | measure dashboard adoption |
| owner weekly active usage | aggregate-only | measure sustained owner workflow value |
| duplicate customer rate | aggregate-only | detect identity quality risk |
| support issue count | count-only | measure rollout friction |
| churn risk signal | aggregate-only | detect retention risk |

## N. Required Next Approval Phrase

Exact owner approval phrase required after this execution plan PR is merged:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED
```

Important: this next phrase authorizes creation of the dry-run/real-data-test plan only.

It does not authorize:

- production DB write.
- live gate enablement.
- final execute.
- cleanup.
- billing exposure.
- automation/reporting exposure.
- external notification.
- bulk real customer import.

## O. Next Required Step

After this PR is created:

```text
OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_REVIEW
```

After this PR is merged:

```text
WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN
```

## P. Explicit Non-Actions

This PR confirms:

- no production DB write.
- no retry execute.
- no cleanup execute.
- no live customer-memory gate enablement.
- no pilot rollout execution.
- no dry-run execution.
- no real-data execute.
- no billing exposure.
- no automation/reporting exposure.
- no SQL/RLS/grant execution.
- no migration apply.
- no db push.
- no SQL replay.
- no env/auth/payment/webhook change.
- no external notification.
- no manual deploy.
- no sales Excel touch.
- no PR #106 merge.
- no PR #125 merge.
- no raw PII.
- no raw row sample.
- no full UUID output.

## Q. side_effects JSON

```json
{
  "docs_only": true,
  "tests_only": true,
  "draft_pr_only": true,
  "ready_transition": false,
  "squash_merge": false,
  "owner_approval_phrase_required": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED",
  "owner_approval_phrase_consumed_for_execution_plan_pr": true,
  "pilot_execution_plan_created": true,
  "test_stage_real_data_path_documented": true,
  "production_db_write": false,
  "retry_execute": false,
  "cleanup_executed": false,
  "customer_memory_gate_enabled": false,
  "pilot_rollout_executed": false,
  "dry_run_executed": false,
  "real_data_execute": false,
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
  "required_next_owner_approval_phrase": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED",
  "next_required_step": "OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_REVIEW"
}
```
