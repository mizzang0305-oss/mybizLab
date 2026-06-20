# PRO/VIP Customer-Memory Dry-Run and Real-Data-Test Plan

Status: `OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN_DRAFT`

Branch: `codex/pro-vip-customer-memory-dry-run-real-data-test-plan`

This docs/tests-only PR creates the PRO/VIP customer-memory dry-run and real-data-test plan only. It does not execute a dry-run, execute a real-data pilot, write to production DB, enable the live customer-memory gate, expose billing, expose automation/reporting, execute cleanup, execute retry, send external notifications, apply SQL/RLS/grant/migration/db push changes, replay SQL, change env/auth/payment/webhook settings, touch sales Excel, merge PR #106, or merge PR #125.

## A. Current Status

| Item | Status | Evidence |
| --- | --- | --- |
| PR #143 | `MERGED` | contact-only customer-memory proof merged |
| PR #144 | `MERGED` | PRO/VIP customer-memory rollout readiness review merged |
| PR #145 | `MERGED` | PRO/VIP customer-memory pilot plan approval packet merged |
| PR #146 | `MERGED` | PRO/VIP customer-memory pilot execution plan merged |
| main HEAD after PR #146 | `c52656f4aa1dd7327b9579e4e7c9e3bef022d250` | post-merge baseline used for this branch |
| PR #146 production auto deploy | `BLOCKED` | Vercel rate limit blocked deploy confirmation for the PR #146 merge commit |
| PR #146 production smoke interpretation | `CURRENT_PRODUCTION_ONLY` | current production GET smoke passed but does not prove the PR #146 merge commit is deployed |
| owner approval phrase | `PROVIDED` | `MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED` |
| this PR scope | `DRY_RUN_AND_REAL_DATA_TEST_PLAN_ONLY` | creates documentation and tests only |
| live customer-memory gate | `NOT_ENABLED` | remains separately gated |
| dry-run execution | `NOT_EXECUTED` | not authorized by this PR |
| small real-data execute | `NOT_EXECUTED` | requires later separate approval |
| production DB write | `NOT_PERFORMED` | not authorized by this PR |
| billing exposure | `NOT_ENABLED` | remains separately gated |
| automation/reporting exposure | `NOT_ENABLED` | remains separately gated |
| PR #106 | `NOT_MERGED_BY_THIS_PR` | not touched |
| PR #125 | `NOT_MERGED_BY_THIS_PR` | not touched |

## A1. PR #146 Deployment Blocker Context

PR #146 was merged.

Main HEAD after PR #146:

```text
c52656f4aa1dd7327b9579e4e7c9e3bef022d250
```

Deployment blocker facts:

- Vercel production auto deploy for `c52656f4aa1dd7327b9579e4e7c9e3bef022d250` was `BLOCKED`.
- GitHub/Vercel status reported: `Deployment rate limited ??retry in 24 hours`.
- no manual deploy was run.
- no Vercel deploy retry was run.
- current production GET smoke passed, but it is current-production smoke only.
- current production GET smoke does not prove `c52656f4aa1dd7327b9579e4e7c9e3bef022d250` is deployed.
- production auto deploy success must not be claimed for `c52656f4aa1dd7327b9579e4e7c9e3bef022d250` until Vercel is rechecked and confirmed `READY`.
- any production-dependent dry-run or real-data write must wait until deploy status is confirmed `READY` or use a clearly classified staging/dev environment.
- do not manually deploy.
- do not retry Vercel deploy.

## B. Approval Basis

Consumed approval phrase:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED
```

This phrase authorizes creation of the dry-run and real-data-test plan PR only.

It does not authorize:

- production DB write.
- real-data write.
- live customer-memory gate enablement.
- dry-run execution.
- real-data execute.
- cleanup.
- billing exposure.
- automation/reporting exposure.
- external notification.
- bulk customer import.
- PR #106 merge.
- PR #125 merge.

## C. Plan Objective

The plan converts the merged execution-plan approval into the next safe planning artifact without opening any write lane.

Objectives:

- define exactly what a future read-only/simulation dry-run must verify.
- define exactly what a later bounded small real-data test must prove before it can execute.
- keep the next PRO/VIP customer-memory step tied to visible owner value: customer CRM, customer card, timeline, diagnostics, reports, dashboard, and conversion.
- support the paid revenue path by connecting customer-memory usefulness to PRO/VIP upgrade signals without exposing billing or automations.
- preserve plan-based gating for paid surfaces.
- keep all current evidence sanitized, aggregate-only, boolean-only, or `CONFIGURED`/`MISSING`.
- make production-readiness blockers explicit before any future write.

User problem solved by this plan:

- the owner can evaluate the next customer-memory pilot step without accepting hidden write risk, raw data exposure, or accidental paid-feature launch.

Revenue path supported by this plan:

- customer-memory CRM and diagnostics can become PRO/VIP upgrade reasons after a safe pilot proves value.

Data that can be collected later:

- aggregate customer identity coverage, customer card creation rate, timeline event creation rate, inquiry/waiting conversion signals, and PRO/VIP conversion signals.

What remains before production launch:

- owner approval for dry-run execution.
- dry-run read-only validation.
- owner approval for small real-data execute.
- bounded execute validation.
- live gate enablement approval.
- billing and automation/reporting approvals if those surfaces are included.
- cleanup approval if any test data must be removed.

## D. Dry-Run Plan

Future dry-run mode:

- mode: read-only or simulation-only.
- no production write.
- no real-data write.
- no customer row creation.
- no customer_contact row creation.
- no inquiry row creation.
- no timeline row creation.
- no cleanup.
- no live gate enablement.
- no billing exposure.
- no external notification.
- no automation/report delivery.
- evidence output: aggregate/boolean proof only.
- env readiness output: `CONFIGURED` or `MISSING` only.
- no secret values, token values, browser storage, cookies, payment payloads, webhook payloads, or raw customer evidence.

Dry-run checks:

| Check | Mode | Purpose |
| --- | --- | --- |
| environment classification | read-only | determine staging/dev/test versus production boundary |
| pilot store candidate | count-only | confirm exactly one owner-approved pilot store candidate before any later execute |
| store_members access | boolean-only | prove tenant access is unambiguous |
| store_subscriptions entitlement | boolean-only | prove PRO/VIP entitlement source is available |
| customer-memory adapter readiness | read-only/simulation | confirm the server adapter can form expected bounded effects |
| dashboard route readiness | read-only | confirm owner-facing customer-memory surfaces can be inspected without writes |
| report route readiness | read-only | confirm reporting remains aggregate-only and disabled for delivery |
| rollback readiness | docs-only | confirm cleanup and kill-switch decisions are documented before future execute |
| safety scan readiness | local-only | confirm logs/docs/tests do not contain raw PII, raw rows, full UUIDs, or secrets |

Dry-run pass criteria:

- environment boundary is classified.
- selected store count is exactly one or the run is blocked.
- `store_members` check is boolean and unambiguous.
- `store_subscriptions` entitlement check is boolean and unambiguous.
- expected future DB effects are simulated only.
- all evidence is sanitized.
- no raw row sample appears.
- no full UUID appears.
- no live gate is enabled.
- no external side effect occurs.

Dry-run block criteria:

- environment cannot be classified without exposing secrets.
- selected store count is zero or greater than one.
- access or entitlement check is ambiguous.
- production write would be required to complete the dry-run.
- any output would expose raw PII, raw rows, full UUIDs, secret values, payment payloads, or webhook payloads.

## E. Small Real-Data Test Plan

The small real-data test remains inactive in this PR.

Future execute requirements:

- requires the later real-data execute approval phrase.
- one owner-approved pilot store only.
- manually bounded sample only.
- no bulk import.
- expected DB effects must be shown before execution.
- rollback and kill-switch must be confirmed before execution.
- live customer-memory gate enablement remains separately gated.
- billing exposure remains separately gated.
- automation/reporting exposure remains separately gated.
- external notification remains disabled unless separately approved.
- no raw PII output.
- no raw row sample output.
- no full UUID output.

Recommended future cap:

| Data path | Cap | Notes |
| --- | ---: | --- |
| stores | 1 | one owner-approved pilot store only |
| customers | 1 to 3 | manually selected and masked evidence only |
| customer_contacts | 1 to 3 | masked contact evidence only |
| customer_timeline_events | 1 to 3 | sanitized event summaries only |
| inquiries/reservations/waiting_entries | optional 1 total | only if separately approved in the execute step |

Expected future execute proof must include:

- pre-execute expected row effects by table, count-only.
- post-execute read-back by table, count-only.
- masked contact evidence only.
- boolean store scope proof.
- boolean entitlement proof.
- aggregate dashboard/report signal proof.
- rollback decision: `NOT_REQUIRED`, `BLOCKED`, or `SEPARATE_CLEANUP_APPROVAL_REQUIRED`.

## F. Pilot Candidate Requirements

A store can proceed to future dry-run only if all conditions are true:

- owner approval identifies the candidate without exposing a full UUID.
- store tenancy boundary is unambiguous.
- `store_members` access can be validated.
- `store_subscriptions` plan state can be validated.
- customer-memory gate state can be evaluated without enabling it.
- no real customer bulk import is required.
- no external notification is needed.
- no billing exposure is needed.
- no automation/reporting delivery is needed.
- rollback and cleanup gates are documented.
- evidence can remain sanitized.

If any condition is false, the future run must stop as `BLOCKED`.

## G. PRO/VIP Gating Model

Rules:

- entitlement source: `store_subscriptions`.
- access source: `store_members`.
- forbidden authority: browser local state, mock state, client-only flags, and owner-facing copy alone.
- all customer-memory behavior must be store-scoped.
- plan-based gating must remain preserved for paid surfaces.
- customer-memory gate enablement remains blocked until separate owner approval.

| Tier | Candidate surfaces | Current state |
| --- | --- | --- |
| FREE | basic public page, basic inquiry, basic waiting/capture | unchanged by this PR |
| PRO candidate | customer CRM, customer card, timeline, basic AI inquiry summary/classification, diagnostics | planned only; no gate enabled |
| VIP candidate | preferences, revisit readiness, AI reports, upsell recommendation readiness, segmentation readiness | planned only; automation/reporting not enabled |

## H. Validation Checklist

Before this PR handoff:

- targeted contract test passes.
- full lint/typecheck/build/test bundle passes before PR handoff when feasible.
- value-based secret and PII scan is clean for staged files.
- git diff contains docs/tests-only changes.
- protected untracked local artifacts remain untouched.

Before future dry-run execution:

- the next dry-run approval phrase is provided.
- no production write is required.
- no real-data write is required.
- env readiness output is `CONFIGURED` or `MISSING` only.
- selected store proof is count-only or boolean-only.
- route and adapter checks are read-only/simulation-only.
- owner-facing status can report `PASS`, `BLOCKED`, or `ROLLBACK_REQUIRED`.

Before future small real-data execute:

- dry-run result is merged or documented as pass.
- later real-data execute approval phrase is provided.
- expected row effects are count-only and bounded.
- rollback and cleanup approval boundaries are documented.
- no billing, automation/reporting, or external notification path is included.

## I. Data Safety Plan

The plan must preserve:

- sanitized aggregate/boolean evidence only.
- masked contact evidence only.
- no raw PII.
- no raw row sample.
- no full UUID output.
- no customer list dump.
- no production data export.
- no cleanup until separately approved.
- no external notification.
- no billing exposure.
- no automated report delivery.
- no real customer bulk import.
- no customer/contact/inquiry/timeline raw row output.
- no secret, token, cookie, payment payload, or webhook payload output.

## J. Future Execution Gates

Future gates remain separated:

1. dry-run and real-data-test plan approval.
2. owner-approved dry-run execution.
3. dry-run read-only/simulation validation.
4. owner-approved small real-data test execute.
5. post-execute read-only validation.
6. KPI review.
7. live gate enablement approval.
8. PRO/VIP billing exposure approval if needed.
9. automation/reporting exposure approval if needed.
10. cleanup approval if needed.
11. expansion decision.

This PR creates only gate 1 documentation and tests. It does not authorize or perform gates 2 through 11.

## K. Kill-Switch Conditions

Stop immediately if any condition occurs:

- raw PII appears in logs/docs/tests.
- full UUID appears in public/report output.
- raw row sample appears.
- `store_members` check is ambiguous.
- `store_subscriptions` check is ambiguous.
- selected store count is not exactly one.
- environment classification is unclear.
- unexpected production DB write occurs.
- duplicate customer risk is detected.
- route access mismatch appears.
- billing exposure appears before approval.
- automation/reporting exposure appears before approval.
- external notification risk appears.
- cleanup is attempted without approval.
- PR #106 or PR #125 is merged as a side effect.

## L. Rollback Plan

Rollback plan:

- dry-run can stop with no data cleanup because it is read-only/simulation-only.
- real-data cleanup requires separate owner approval.
- feature gate remains off by default.
- live customer-memory gate remains disabled by this PR.
- billing exposure rollback must not mutate customer-memory data.
- automation/reporting rollback must not send external notifications.
- owner-facing status must show `PASS`, `BLOCKED`, or `ROLLBACK_REQUIRED`.
- rollback evidence must be sanitized.

## M. KPI Plan

| KPI | Measurement mode | Purpose |
| --- | --- | --- |
| identified customer count | aggregate-only | measure customer-memory identity coverage |
| customer card creation rate | aggregate-only | measure CRM/customer card value |
| customer timeline event creation rate | aggregate-only | measure timeline usefulness |
| inquiry-to-reservation conversion signal | aggregate-only | measure customer-memory revenue path |
| waiting-to-customer conversion signal | aggregate-only | measure waiting capture quality |
| customer profile completion rate | aggregate-only | measure profile readiness |
| PRO conversion signal | aggregate-only | connect customer-memory value to paid plan conversion |
| VIP conversion signal | aggregate-only | connect advanced customer-memory value to higher plan conversion |
| AI report usefulness signal | aggregate-only | measure reporting value without raw data |
| dashboard active usage | aggregate-only | measure dashboard adoption |
| owner weekly active usage | aggregate-only | measure sustained owner workflow value |
| duplicate customer rate | aggregate-only | detect identity quality risk |
| support issue count | count-only | measure rollout friction |

## N. Required Next Approval Phrases

Exact owner approval phrase required after this plan PR is merged:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_REAL_DATA_TEST_PLAN_APPROVED
```

The next dry-run approval phrase authorizes read-only/simulation dry-run execution only.

It does not authorize:

- production DB write.
- real-data write.
- live customer-memory gate enablement.
- real-data execute.
- cleanup.
- billing exposure.
- automation/reporting exposure.
- external notification.
- bulk customer import.

Later real-data execute approval phrase, documented only:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_SMALL_REAL_DATA_TEST_EXECUTE_APPROVED
```

The later real-data execute phrase remains separate and inactive in this PR.

## O. Next Required Step

After this PR is created:

```text
OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN_REVIEW
```

After this PR is merged:

```text
WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR
```

## P. Explicit Non-Actions

This PR confirms:

- no production DB write.
- no real-data write.
- no live customer-memory gate enablement.
- no dry-run execution.
- no real-data execute.
- no cleanup execute.
- no retry execute.
- no pilot rollout execution.
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
  "automation_reporting_exposure_enabled": false,
  "billing_exposure_enabled": false,
  "cleanup_executed": false,
  "customer_memory_gate_enabled": false,
  "db_push": false,
  "docs_only": true,
  "draft_pr_only": true,
  "dry_run_real_data_test_plan_created": true,
  "dry_run_executed": false,
  "env_auth_payment_webhook_changed": false,
  "external_notification_sent": false,
  "full_uuid_output": false,
  "manual_deploy": false,
  "migration_apply": false,
  "next_required_step": "WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR",
  "owner_approval_phrase_consumed_for_dry_run_real_data_test_plan_pr": true,
  "owner_approval_phrase_required": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED",
  "pilot_rollout_executed": false,
  "pr_106_merged": false,
  "pr_125_merged": false,
  "production_auto_deploy_success_for_c52656f": false,
  "production_db_write": false,
  "production_deploy_blocker_documented": true,
  "production_read_only_smoke_current_only": true,
  "raw_pii_output": false,
  "raw_row_sample_output": false,
  "ready_transition": false,
  "real_data_write": false,
  "real_data_execute": false,
  "required_later_real_data_execute_approval_phrase": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_SMALL_REAL_DATA_TEST_EXECUTE_APPROVED",
  "required_next_owner_approval_phrase": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_REAL_DATA_TEST_PLAN_APPROVED",
  "retry_execute": false,
  "rls_or_grant_executed": false,
  "sales_excel_import_touched": false,
  "small_real_data_test_plan_documented": true,
  "sql_replay": false,
  "squash_merge": false,
  "tests_only": true,
  "vercel_retry": false
}
```
