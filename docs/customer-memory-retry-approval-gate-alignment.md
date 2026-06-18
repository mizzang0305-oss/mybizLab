# Customer-Memory Retry Approval Gate Alignment

Status: `DRAFT_RETRY_APPROVAL_GATE_ALIGNED_NO_EXECUTION`

Branch: `codex/customer-memory-retry-approval-gate-alignment`

This PR aligns the safe synthetic customer-memory canary harness with the fixed-adapter retry approval flow. It does not execute the canary, does not write to production, does not clean up retained synthetic rows, and does not enable a live customer-memory gate.

## Baseline

- PR #130 merged: synthetic canary partial write evidence.
- PR #130 result: `customers +1`, `customer_contacts +0`, `inquiries +0`, `customer_timeline_events +0`.
- PR #130 blocker: `column customers.id does not exist`.
- PR #130 cleanup: `false`.
- PR #130 retry: `false`.
- PR #131 merged: adapter projection fix.
- PR #131 result: live customer identifier aligned to `customers.customer_id`; `customers.id` projection removed.
- PR #132 merged: retry blocked by execute env mismatch.
- PR #132 decision: `BLOCKED_EXECUTE_ENV_MISMATCH`.
- PR #132 execute attempt count: `0`.
- PR #132 production DB write: `false`.
- main HEAD baseline: `c428533596ee41a534825aa70e622681e3e077d8`.
- dedicated test store slug: `mybizlab-test`.
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`.
- PR #125 must remain OPEN Draft and must not be readied or merged by this PR.

## Root Cause

The retry approval packet used:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
```

The merged harness accepted only:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY
```

Because the retry approval string was not accepted by the merged harness, execute mode stopped with `MYBIZ_CANARY_APPROVAL_REQUIRED` before any production DB write path was invoked.

## Fix Summary

The harness now supports two explicit approval gates:

| Mode | Approval string | Partial customer baseline |
| --- | --- | --- |
| initial canary | `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY` | not allowed |
| retry with fixed adapter | `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER` | `customers` pre-count `0` or `1` allowed |

The initial approval gate is preserved. The retry approval gate is added without creating a broad bypass.

`MYBIZ_CANARY_EXECUTE=true` alone is not enough to execute. Execute mode still requires all of the following exact values:

```text
MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
MYBIZ_CANARY_EXECUTE=true
MYBIZ_CANARY_STORE_SLUG=mybizlab-test
MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618
```

Slug mismatch remains blocked by `MYBIZ_CANARY_STORE_SLUG_MISMATCH`.

Marker mismatch remains blocked by `MYBIZ_CANARY_MARKER_MISMATCH`.

Unknown or missing approval remains blocked by `MYBIZ_CANARY_APPROVAL_REQUIRED`.

## Dry-Run Behavior

Dry-run remains the default. If `MYBIZ_CANARY_EXECUTE` is absent or not exactly `true`, the harness:

- resolves exactly one store for slug `mybizlab-test`
- validates the fixed marker `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- reads marker-scoped pre-counts
- builds a synthetic-only payload
- returns sanitized output
- does not call the server adapter write methods
- does not perform a production DB write

Dry-run output must not include a raw full `store_id`, raw PII, or customer row samples.

## Retry-Specific Requirements

Retry mode requires the fixed adapter and the exact retry approval string.

Retry mode accepts the retained PR #130 partial customer baseline:

| Table | Retry pre-count requirement |
| --- | --- |
| `customers` | `0` or `1` allowed |
| `customer_contacts` | `0` expected |
| `inquiries` | `0` expected |
| `customer_timeline_events` | `0` expected |

Retry row caps remain:

| Table | Retry cap |
| --- | --- |
| `customers` | delta `+0` or `+1`, max `1` |
| `customer_contacts` | upsert max `1` |
| `inquiries` | insert max `1` |
| `customer_timeline_events` | insert max `1~2` |

The retry approval string is available after this PR, but this PR does not execute the retry.

## Execution Path

Approved future write path:

- `scripts/customer-memory/synthetic-canary-harness.mjs`
- server adapter path only: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`

The harness does not use `/api/*` public write routes and does not create an ad hoc execution harness.

`SELECT *` is forbidden. The harness uses explicit allowlisted projections.

## Expected DB Effect In This PR

| Table | Effect |
| --- | ---: |
| `customers` | `0` |
| `customer_contacts` | `0` |
| `inquiries` | `0` |
| `customer_timeline_events` | `0` |
| `stores` | `0` |
| `store_members` | `0` |
| `store_subscriptions` | `0` |
| `store_public_pages` | `0` |

Production DB write in this PR: `false`.

Canary retry executed in this PR: `false`.

Cleanup/delete executed in this PR: `false`.

## Forbidden Operations

This PR forbids:

- production DB write
- canary retry execution
- cleanup/delete
- live customer-memory gate enablement
- public API write route call
- customer/contact/inquiry/timeline row creation
- RLS/GRANT/REVOKE execution
- migration apply, db push, repair, or SQL replay
- env/auth/payment/webhook changes
- external notification, SMS, email, or webhook calls
- sales Excel import
- PR #106 merge
- manual deploy
- raw PII output
- customer row sample output
- raw full `store_id` output
- Ready transition
- merge

## Next Gate

Next required gate:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
```

After this PR is reviewed and merged separately, a future retry still requires fresh owner approval and exact execute env. Cleanup remains separately approval-gated.

## Validation Plan

- `git diff --check`
- `git diff --cached --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm test -- src/tests/customer-memory-retry-approval-gate-alignment.test.ts`
- `npm test -- src/tests/customer-memory-synthetic-canary-harness.test.ts`
- staged secret/PII/full-UUID scan
- Vercel preview checks

## Business Output

- User problem solved: the fixed-adapter retry approval can no longer be blocked by a stale harness approval string.
- Revenue path supported: keeps PRO/VIP customer-memory, CRM, diagnostics, reports, dashboard, and automation rollout evidence-backed.
- Data that can be collected later: one bounded synthetic customer-memory retry result after fresh approval.
- Remaining before production launch: review this Draft PR, merge separately if safe, obtain fresh retry approval, execute exactly once in a separate phase, then review canary evidence and cleanup policy separately.

## side_effects JSON

```json
{
  "production_db_write": false,
  "canary_retry_executed": false,
  "cleanup_executed": false,
  "retry_approval_gate_aligned": true,
  "initial_approval_gate_preserved": true,
  "dry_run_default": true,
  "execute_requires_owner_approval": true,
  "approved_store_slug": "mybizlab-test",
  "synthetic_marker": "MYBIZ_CANARY_CUSTOMER_MEMORY_20260618",
  "partial_synthetic_customer_retained": true,
  "schema_changed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "live_customer_memory_gate_enabled": false,
  "public_api_write_call": false,
  "customer_row_created": false,
  "customer_contact_row_created": false,
  "inquiry_row_created": false,
  "timeline_row_created": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "env_auth_payment_webhook_changed": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "retry_requires_fresh_owner_approval": true
}
```
