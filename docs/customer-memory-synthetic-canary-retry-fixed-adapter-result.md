# Synthetic Customer-Memory Canary Retry With Fixed Adapter Result

Status: `BLOCKED_EXECUTE_ENV_MISMATCH`

Branch: `codex/customer-memory-synthetic-canary-retry-fixed-adapter`

This packet records the owner-approved retry request after the adapter projection fix reached `main`. The retry was not executed because the required retry approval string does not match the currently merged safe harness approval gate. The harness blocked before any production DB client was created for execute mode, so no production write occurred.

No cleanup/delete was executed. No second retry was attempted.

## Approval And Execute Env Gate

Owner approval string supplied:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
```

Required execute env requested for this retry:

- `MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER`
- `MYBIZ_CANARY_EXECUTE=true`
- `MYBIZ_CANARY_STORE_SLUG=mybizlab-test`
- `MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

Merged harness approval gate currently accepts:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY
```

Gate result:

- owner approval present: `true`
- requested execute env exactness: `true`
- merged harness approval compatibility: `false`
- execute env verified by merged harness: `false`
- decision: `BLOCKED_EXECUTE_ENV_MISMATCH`

Sanitized harness error:

```text
MYBIZ_CANARY_APPROVAL_REQUIRED
```

The older harness approval string was not substituted because that would violate the exact retry execute env requirement.

## Baseline

- PR #130 merged: synthetic canary partial result
- PR #130 target effect: `customers +1`, `customer_contacts +0`, `inquiries +0`, `customer_timeline_events +0`
- PR #130 blocker: `column customers.id does not exist`
- PR #130 retry after blocker: `false`
- PR #130 cleanup after blocker: `false`
- PR #131 merged: adapter projection fix
- PR #131 result: live customer identifier aligned to `customers.customer_id`; `customers.id` adapter projection removed
- main HEAD at retry preflight: `49559f4633a931a252d832a730b698870fcc5cb5`
- dedicated test store slug: `mybizlab-test`
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

## Execution Path

Allowed path:

- merged safe harness: `scripts/customer-memory/synthetic-canary-harness.mjs`
- fixed server adapter path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`

Actual path:

- dry-run used the merged safe harness and reported `DRY_RUN_READY_NO_WRITE`
- execute-mode approval gate used the merged safe harness and returned `BLOCKED`
- server adapter write path was not invoked
- public API write route call: `false`
- ad hoc harness creation: `false`
- SQL replay: `false`
- migration/db push/repair/apply: `false`
- RLS/GRANT/REVOKE execution: `false`
- manual deploy: `false`

## Dry-Run Result

Command: `npm run customer-memory:canary:dry-run`

Result: `DRY_RUN_READY_NO_WRITE`

- production DB write: `false`
- public API write call: `false`
- adapter path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`
- selected store id: masked `960b40b6...a0ed`; hash `5f84c707e917f845`
- raw full `store_id`: not output

Read-only pre-counts:

| Table | Pre-count |
| --- | ---: |
| `customers` | `1` |
| `customer_contacts` | `0` |
| `inquiries` | `0` |
| `customer_timeline_events` | `0` |

Read-only non-target counts:

| Table | Count |
| --- | ---: |
| `stores` for approved slug | `1` |
| `store_members` for approved store | `0` |
| `store_subscriptions` for approved store | `0` |
| `store_public_pages` for approved store | `0` |

The `customers` pre-count of `1` matches the retained PR #130 partial synthetic customer baseline.

## Retry Execute Result

Execute attempt count: `0`

Second retry attempt: `false`

Cleanup/delete execution: `false`

Command path checked in execute mode:

```text
node scripts/customer-memory/synthetic-canary-harness.mjs
```

Harness terminal status: `BLOCKED`

Sanitized error:

```text
MYBIZ_CANARY_APPROVAL_REQUIRED
```

No write attempt was made because the approval gate failed before the execute path could create the Supabase client or load the server adapter.

## Expected vs Actual DB Effect

| Table | Approved maximum | Actual effect |
| --- | --- | ---: |
| `customers` | `+0 or +1, max 1` | `0` |
| `customer_contacts` | `upsert max 1` | `0` |
| `inquiries` | `insert max 1` | `0` |
| `customer_timeline_events` | `insert max 1~2` | `0` |
| `stores` | `insert 0` | `0` |
| `store_members` | `insert 0` | `0` |
| `store_subscriptions` | `insert 0` | `0` |
| `store_public_pages` | `insert 0` | `0` |
| `leads` | `insert 0` | `0` |
| `visitor_sessions` | `insert 0` | `0` |
| `feedback records` | `insert 0` | `0` |
| `payments/webhooks` | `insert 0` | `0` |
| non-target tables | insert/update/delete `0` | `0` |

Target row cap exceeded: `false`

Non-target table changed: `false`

## Sanitized Read-Back Result

- customer card sanitized result: `not_rechecked_after_blocked_execute`
- inquiry inbox redacted result: `not_created`
- timeline non-PII result: `not_created`
- wrong-store/non-test-store exposure: `not_checked_after_no_write`
- raw customer row sample output: `false`
- raw phone/email/name output: `false`
- raw full store id output: `false`
- Vercel protection bypass: not attempted

## Stop Conditions Checked

- owner approval missing: `false`
- execute env mismatch: `true`
- slug mismatch: `false`
- marker mismatch: `false`
- exact-one-store mismatch: `false`
- pre-existing partial customer baseline: `true`
- target row cap exceeded: `false`
- fixed adapter unavailable: `false`
- public API write route required: `false`
- raw PII output required: `false`
- second retry required: `false`
- cleanup/delete required in this PR: `false`

## Cleanup Posture

- cleanup in this PR: `false`
- cleanup/delete execution: forbidden
- the partial synthetic `customers` row from PR #130 remains in production
- cleanup requires separate owner approval and a separate sanitized evidence record

## Decision

Canary retry decision: `BLOCKED_EXECUTE_ENV_MISMATCH`

The retry approval was present, the fixed adapter was merged, and the dry-run was ready. The actual retry write stayed blocked because the merged safe harness has not yet been updated to accept the fresh retry approval string.

Next gate:

- review this blocked retry evidence
- update and merge the safe harness approval gate for the retry approval string, or explicitly approve use of the existing merged harness approval string
- do not retry until the approval gate is aligned
- cleanup of the retained partial synthetic customer remains separately approval-gated
- broader PRO/VIP customer-memory rollout remains blocked

## Validation Result

- `git diff --check`: PASS
- `git diff --cached --check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS (`132` files, `680` tests)
- `npm test -- src/tests/customer-memory-synthetic-canary-retry-fixed-adapter-result.test.ts`: PASS (`1` file, `8` tests)
- staged secret/PII/full-UUID scan: PASS
- Vercel preview checks: PASS on Draft PR #132

## Business Output

- User problem solved: prevents the retry approval from being executed through a mismatched harness gate.
- Revenue path supported: keeps PRO/VIP customer-memory, CRM, reports, diagnostics, dashboard, and automation proof honest before broader rollout.
- Data that can be collected later: after harness approval alignment and fresh approval, one bounded synthetic customer-memory contact, inquiry, and timeline evidence set.
- Remaining before production launch: align the retry approval gate, rerun only with fresh authorization, review canary evidence, decide cleanup separately, then plan broader rollout.

## side_effects JSON

```json
{
  "owner_approval": true,
  "execute_env_verified": false,
  "production_db_write": false,
  "safe_harness_used": true,
  "fixed_adapter_used": false,
  "public_api_write_call": false,
  "test_store_slug": "mybizlab-test",
  "synthetic_marker": "MYBIZ_CANARY_CUSTOMER_MEMORY_20260618",
  "customers_upsert_delta": 0,
  "customer_contacts_upsert_count": 0,
  "inquiries_insert_count": 0,
  "customer_timeline_events_insert_count": 0,
  "target_row_cap_exceeded": false,
  "non_target_table_changed": false,
  "stores_insert_count": 0,
  "store_members_insert_count": 0,
  "store_subscriptions_insert_count": 0,
  "store_public_pages_insert_count": 0,
  "live_customer_memory_gate_enabled_persistently": false,
  "test_inquiry_created_with_real_data": false,
  "real_customer_name_used": false,
  "real_phone_used": false,
  "real_email_used": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "external_notification_sent": false,
  "payment_or_webhook_touched": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "cleanup_executed": false,
  "second_retry_attempt": false
}
```
