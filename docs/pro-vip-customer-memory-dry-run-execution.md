# PRO/VIP Customer-Memory Dry-Run Execution PR

Status: `PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR_DRAFT`

This PR creates dry-run execution artifacts only.

## A. Current Status

PR #147 merged.

Main HEAD after PR #147:

```text
ff57446850579f843306e94e03acc84a7b01e495
```

Current deployment and smoke baseline:

- production auto deploy is `READY`.
- production GET smoke passed.
- this PR creates dry-run execution artifacts only.
- no real-data write is performed.
- no production DB write is performed.
- no live gate is enabled.
- dry-run is not executed by this PR.

## B. Approval Basis

Consumed owner approval phrase:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_REAL_DATA_TEST_PLAN_APPROVED
```

This phrase authorizes creation of the dry-run execution PR only.

It does not authorize:

- real-data write.
- production DB write.
- live gate enablement.
- cleanup.
- billing exposure.
- automation/reporting exposure.
- external notification.
- final execute.

## C. Dry-Run Execution Objective

The dry-run execution objective is to validate one-store PRO/VIP customer-memory readiness without mutating production data.

Required readiness objectives:

- validate one-store PRO/VIP customer-memory readiness.
- validate access truth from `store_members`.
- validate entitlement truth from `store_subscriptions`.
- validate customer-memory adapter readiness.
- validate dashboard route readiness.
- validate report route readiness.
- validate sanitized evidence output.
- validate rollback readiness.
- validate kill-switch readiness.
- prepare for a later small real-data execute approval.

Authority boundaries:

- `store_members` is the access truth.
- `store_subscriptions` is the entitlement truth.
- browser local state must not be used as authority.
- mock state must not be used as authority.
- client-only flags must not be used as authority.

The dry-run must remain read-only/simulation-only.

The dry-run must not:

- create customers.
- create customer_contacts.
- create customer_preferences.
- create inquiries.
- create reservations.
- create waiting_entries.
- create customer_timeline_events.
- enable customer-memory gate.
- expose billing.
- trigger automation/reporting delivery.
- send notifications.
- run cleanup.
- output raw PII.
- output full UUIDs.
- output raw row samples.

For implementation-facing wording, this means:

- no customer creation.
- no customer_contacts creation.
- no customer_preferences creation.
- no inquiries creation.
- no reservations creation.
- no waiting_entries creation.
- no customer_timeline_events creation.

## D. Environment Classification

The dry-run must classify the environment as exactly one of:

- local.
- staging/dev Supabase.
- production Supabase.

Rules:

- dry-run must remain read-only/simulation-only.
- if staging/dev exists, prefer it.
- if production is used for dry-run, all operations must be GET/read-only/simulation-only.
- no secrets or raw connection strings may be printed.
- project IDs must be masked.
- store IDs must be masked.

## E. Pilot Store Eligibility

A pilot store is eligible only if:

- owner approval is documented.
- store identifier is masked.
- `store_members` check is available.
- `store_subscriptions` check is available.
- customer-memory gate remains disabled.
- billing exposure remains disabled.
- automation/reporting delivery remains disabled.
- notification remains disabled.
- rollback path exists.
- kill-switch conditions are accepted.

## F. Dry-Run Expected Checks

The dry-run must check:

- route availability.
- dashboard visibility.
- customer-memory adapter availability.
- store_members readiness.
- store_subscriptions readiness.
- customer card readiness.
- timeline readiness.
- report/dashboard readiness.
- masked evidence output.
- duplicate-risk guard readiness.
- rollback readiness.

The checks may validate:

- environment classification.
- selected pilot store eligibility.
- masked store identifier handling.
- store_members access-readiness.
- store_subscriptions entitlement-readiness.
- customer-memory adapter readiness.
- dashboard route readiness.
- report route readiness.
- sanitized evidence generation.
- kill-switch readiness.
- rollback readiness.

## G. Dry-Run Output Format

Dry-run output must be sanitized and include only:

- `PASS`, `BLOCKED`, or `SKIPPED` status.
- masked store reference.
- boolean readiness flags.
- aggregate counts only.
- no raw customer name.
- no raw phone.
- no raw email.
- no raw row sample.
- no full UUID.
- no secret.
- no token.

## H. Kill-Switch Conditions

Stop immediately if:

- raw PII appears.
- full UUID appears.
- raw row sample appears.
- store_members check is ambiguous.
- store_subscriptions check is ambiguous.
- store tenancy boundary is unclear.
- DB write risk appears.
- live gate risk appears.
- billing exposure appears.
- automation/reporting delivery appears.
- notification risk appears.
- cleanup is attempted.
- PR #106 or PR #125 is merged as a side effect.

## I. Rollback Plan

Rollback plan:

- no DB write means no data rollback should be required for this dry-run PR.
- if any future write occurs unexpectedly, status must become `ROLLBACK_REQUIRED`.
- cleanup requires separate approval.
- rollback evidence must be sanitized.

## J. KPI Readiness

Dry-run should prepare future KPI measurement for:

| KPI | Evidence rule |
| --- | --- |
| identified customer count | aggregate-only |
| customer card creation rate | aggregate-only |
| timeline event creation count | aggregate-only |
| duplicate customer rate | aggregate-only |
| store_members validation result | boolean-only |
| store_subscriptions validation result | boolean-only |
| dashboard visibility | boolean-only |
| owner feedback signal | aggregate-only |
| PRO conversion signal | aggregate-only |
| VIP conversion signal | aggregate-only |
| support issue count | aggregate-only |
| rollback_required count | aggregate-only |

## K. Required Next Owner Approval Phrase

After this PR is merged, the next required owner approval phrase is:

```text
MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_APPROVED
```

This next phrase authorizes running the dry-run only.

It does not authorize real-data write, production DB write, live gate enablement, cleanup, billing exposure, automation/reporting exposure, or external notification.

## L. Next Required Step

After this PR is created:

```text
OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR_REVIEW
```

After this PR is merged:

```text
WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION
```

## M. Explicit Non-Actions

This PR confirms:

- no production DB write.
- no real-data write.
- no live gate enablement.
- no cleanup.
- no retry execute.
- no billing exposure.
- no automation/reporting exposure.
- no notification.
- no manual deploy.
- no Vercel retry.
- no SQL/RLS/grant execution.
- no migration apply.
- no db push.
- no SQL replay.
- no env/auth/payment/webhook change.
- no sales Excel touch.
- no PR #106 merge.
- no PR #125 merge.
- no raw PII.
- no raw row sample.
- no full UUID output.

## N. side_effects JSON

```json
{
  "draft_pr_only": true,
  "dry_run_execution_pr_created": true,
  "dry_run_executed": false,
  "real_data_write": false,
  "production_db_write": false,
  "customer_memory_gate_enabled": false,
  "cleanup_executed": false,
  "billing_exposure_enabled": false,
  "automation_reporting_exposure_enabled": false,
  "external_notification_sent": false,
  "manual_deploy": false,
  "vercel_retry": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "pr_125_merged": false,
  "raw_pii_output": false,
  "raw_row_sample_output": false,
  "full_uuid_output": false,
  "owner_approval_phrase_consumed_for_dry_run_execution_pr": true,
  "required_next_owner_approval_phrase": "MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_APPROVED",
  "next_required_step": "OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR_REVIEW"
}
```
