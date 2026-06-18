# Safe Local Synthetic Customer-Memory Canary Harness

Status: `DRAFT_HARNESS_ADDED_NO_EXECUTION`

Branch: `codex/customer-memory-synthetic-canary-harness`

This PR adds a safe local one-run harness for the synthetic customer-memory canary. It does not execute the canary, does not write to production, does not enable a live customer-memory gate, and does not call a public API write route.

## Baseline

- PR #123 merged: customer-memory test-store canary plan.
- PR #124 merged: owner-selected store not found evidence.
- PR #126 merged: dedicated test-store provisioning approval plan.
- PR #127 merged: dedicated test-store provisioning execute result.
- PR #128 merged: synthetic canary attempt was blocked with `BLOCKED_NO_APPROVED_EXECUTION_HARNESS`.
- required main baseline: `fa55a6390dcd0d1e4b0f6f78db827e3a749538b6` or newer.
- PR #125 must remain OPEN Draft and must not be readied or merged by this harness PR.
- dedicated production test store slug: `mybizlab-test`.
- reserved synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`.
- customer-memory canary has not run yet in this PR.

## Harness Purpose

The harness gives maintainers a reviewed local execution path before any production customer-memory write. It converts the previous blocked result into a controlled script with dry-run by default, exact-store validation, row-cap checks, sanitized output, and an explicit owner-approval gate for future execution.

Harness file:

- `scripts/customer-memory/synthetic-canary-harness.mjs`

Package entry:

- `npm run customer-memory:canary:dry-run`

There is intentionally no package-level execute shortcut. Future execution must set explicit environment variables and call the same harness directly.

## Dry-Run Default

Dry-run is the default. If `MYBIZ_CANARY_EXECUTE` is absent or not exactly `true`, the harness:

- resolves exactly one store for slug `mybizlab-test`
- uses allowlisted read projections only
- reads marker-scoped pre-counts for `customers`, `customer_contacts`, `inquiries`, and `customer_timeline_events`
- reads non-target guard counts for `stores`, `store_members`, `store_subscriptions`, and `store_public_pages`
- builds a synthetic-only payload
- returns sanitized JSON
- does not call the server adapter write methods
- does not perform a production DB write

`SELECT *` is forbidden and is not used by the harness.

## Execute Approval Requirements

Execute mode remains blocked unless all approval variables are present and exact:

```text
MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY
MYBIZ_CANARY_EXECUTE=true
MYBIZ_CANARY_STORE_SLUG=mybizlab-test
MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618
```

Missing approval fails before any database lookup or write with `MYBIZ_CANARY_APPROVAL_REQUIRED`.

Slug mismatch fails with `MYBIZ_CANARY_STORE_SLUG_MISMATCH`.

Marker mismatch fails with `MYBIZ_CANARY_MARKER_MISMATCH`.

The approval is local and one-run only. It does not change environment files, deployment settings, launch gates, auth settings, payment settings, webhook settings, RLS, grants, or migrations.

## Adapter Path Status

Approved write path:

- server adapter path only: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`

The harness loads that adapter through Vite SSR for local execution. It does not use `/api/*` public write routes, browser routes, public form routes, or ad hoc REST writes for customer-memory persistence.

The adapter approval object is in-process and one-run scoped. It is not a persistent live customer-memory gate enablement.

## Synthetic-Only Payload

The payload is synthetic-only:

- customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`
- marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- source intent: synthetic customer-memory canary
- real customer name: forbidden
- real customer phone: forbidden
- real customer email: forbidden
- raw PII output: forbidden
- customer/contact/inquiry/timeline row samples: forbidden

The harness may pass a non-deliverable synthetic contact value to the server adapter when a future approved execute occurs, but committed docs, logs, and summaries must not print raw contact values.

## Row Caps

Future owner-approved execution is capped to:

| Table | Maximum effect |
| --- | --- |
| `customers` | `customers upsert max 1` |
| `customer_contacts` | `customer_contacts upsert max 1` |
| `inquiries` | `inquiries insert max 1` |
| `customer_timeline_events` | `customer_timeline_events insert max 1~2` |

The harness verifies pre-counts before execution and post-count deltas after execution. A cap breach fails with `TARGET_ROW_CAP_EXCEEDED`.

## Non-Target Guard

The harness checks non-target guard counts for:

- `stores`
- `store_members`
- `store_subscriptions`
- `store_public_pages`

Any count drift across a future approved execute fails with `NON_TARGET_TABLE_CHANGED`.

## Expected Future DB Effect

This PR expected DB effect:

| Table | Effect in this PR |
| --- | --- |
| `customers` | `0` |
| `customer_contacts` | `0` |
| `inquiries` | `0` |
| `customer_timeline_events` | `0` |
| `stores` | `0` |
| `store_members` | `0` |
| `store_subscriptions` | `0` |
| `store_public_pages` | `0` |

Future separately approved execute maximum:

| Table | Future cap |
| --- | --- |
| `customers` | `upsert max 1` |
| `customer_contacts` | `upsert max 1` |
| `inquiries` | `insert max 1` |
| `customer_timeline_events` | `insert max 1~2` |
| non-target tables | `0` |

## Stop Conditions

The harness stops before write when:

- approval string is missing
- execute flag is not exactly `true`
- slug is not exactly `mybizlab-test`
- marker is not exactly `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- exact-one-store lookup fails
- marker-scoped pre-counts are non-zero
- row caps would be exceeded
- non-target guard counts change
- synthetic-only payload checks fail
- a public API write route would be required
- raw PII or raw row sample output would be required

## Forbidden Operations

This harness PR forbids:

- production DB write
- customer-memory canary execution
- live customer-memory gate enablement
- public API write route call
- test inquiry save
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
- cleanup/delete execution
- Ready transition
- merge

## Cleanup Posture

Cleanup is not included in this harness. Cleanup requires a separate approval, separate PR or runbook, and separate execution record. This PR creates no canary rows, so there is nothing to clean up from this PR.

## Validation Plan

- `git diff --check`
- `git diff --cached --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm test -- src/tests/customer-memory-synthetic-canary-harness.test.ts`
- staged secret/PII scan
- Vercel preview checks

## Business Output

- User problem solved: gives the owner a reviewed local harness instead of an improvised production write path.
- Revenue path supported: keeps PRO/VIP customer-memory, CRM, reports, dashboard, and automation proof moving through safety gates.
- Data that can be collected later: one synthetic customer-memory card, one synthetic contact, one redacted inquiry, and one or two non-PII timeline events after fresh approval.
- Remaining before production launch: approve one future execute, review sanitized canary evidence, approve cleanup separately, then plan broader PRO/VIP rollout.

## side_effects JSON

```json
{
  "production_db_write": false,
  "canary_executed": false,
  "live_customer_memory_gate_enabled": false,
  "public_api_write_call": false,
  "test_inquiry_created": false,
  "customer_row_created": false,
  "customer_contact_row_created": false,
  "inquiry_row_created": false,
  "timeline_row_created": false,
  "harness_added": true,
  "dry_run_default": true,
  "execute_requires_owner_approval": true,
  "approved_store_slug": "mybizlab-test",
  "synthetic_marker": "MYBIZ_CANARY_CUSTOMER_MEMORY_20260618",
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "cleanup_executed": false
}
```
