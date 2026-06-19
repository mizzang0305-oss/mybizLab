# Customer-Memory Harness Dependency-Scan Fix

Status: `DEPENDENCY_SCAN_BLOCKER_FIX_READY_FOR_DRAFT_REVIEW`

Branch: `codex/customer-memory-harness-dependency-scan-fix`

This packet fixes the no-write blocker recorded by PR #139:

```text
BLOCKED_EXECUTE_HARNESS_DEPENDENCY_SCAN_FAILED
```

No contact-only retry, production DB write, cleanup/delete, public API write route call, SQL replay, migration, db push, RLS/GRANT/REVOKE, env/auth/payment/webhook change, external notification, payment/webhook path, sales Excel path, PR #106 merge, or PR #125 merge was executed by this PR.

## Baseline

- PR #139 result: `BLOCKED_EXECUTE_HARNESS_DEPENDENCY_SCAN_FAILED`
- approval phrase was present: `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT`
- execute attempt count recorded by PR #139: `1`
- PR #139 production DB write: `false`
- PR #139 target write deltas: `customers 0`, `customer_contacts 0`, `inquiries 0`, `customer_timeline_events 0`
- PR #139 cleanup/delete: `false`
- PR #139 second retry: `false`
- PR #139 raw PII output: `false`

## Root Cause

`scripts/customer-memory/synthetic-canary-harness.mjs` loaded the production server adapter with a generic Vite middleware server:

```text
createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
```

That server still loaded the repository Vite config and allowed the dev dependency optimizer to discover app entries. During the approved execute attempt, the harness was supposed to load only:

```text
src/server/mybiz/repositories/customerMemoryProductionAdapter.ts
```

Instead, the Vite dependency scanner ran before the adapter path could complete loading. The execute attempt stopped at the sanitized dependency-scan blocker and no write was completed.

## Fix Summary

The harness now uses a script-only server adapter loader policy:

- `configFile: false`
- `envFile: false`
- `optimizeDeps.noDiscovery: true`
- `optimizeDeps.entries: []`
- `optimizeDeps.include: []`
- `server.hmr: false`
- `server.middlewareMode: true`
- `root: process.cwd()`

The loader still imports only:

```text
src/server/mybiz/repositories/customerMemoryProductionAdapter.ts
```

The fix does not bypass, weaken, or remove any execution gate.

Preserved gates:

- owner approval required: `true`
- execute flag required: `true`
- approved slug required: `mybizlab-test`
- approved marker required: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- contact-only mode preserved: `true`
- public API write route forbidden: `true`
- `SELECT *` forbidden: `true`
- raw PII output forbidden: `true`
- cleanup/delete requires separate approval: `true`

## No-Write Verification

Adapter import-only probe:

- command type: Node ESM import-only
- loaded export: `createProductionCustomerMemorySchemaAdapter`
- adapter factory type: `function`
- production DB write: `false`
- public API write route call: `false`

Dry-run verification:

- command: `npm run customer-memory:canary:dry-run`
- status: `DRY_RUN_READY_NO_WRITE`
- approval mode: `dry_run`
- execute requested: `false`
- production DB write: `false`
- public API write route call: `false`
- selected store id: masked/hash only
- raw PII output: `false`
- raw row sample output: `false`

Dry-run marker-scoped counts remained:

| Table | Count |
| --- | ---: |
| `customers` | `1` |
| `customer_contacts` | `0` |
| `inquiries` | `1` |
| `customer_timeline_events` | `1` |

## What Was Not Done

- contact-only retry rerun: `false`
- second retry: `false`
- cleanup/delete: `false`
- production DB write: `false`
- customer/contact/inquiry/timeline row creation: `false`
- public API write route call: `false`
- ad hoc production write harness creation: `false`
- real customer name/phone/email/Kakao ID/address use: `false`
- raw PII or raw row sample output: `false`
- full raw store id output: `false`
- RLS/GRANT/REVOKE: `false`
- migration/db push/repair/apply: `false`
- SQL replay: `false`
- env/auth/payment/webhook change: `false`
- external notification/SMS/email/webhook: `false`
- payment/webhook path touched: `false`
- sales Excel import touched: `false`
- manual deploy: `false`
- PR #106 merge: `false`
- PR #125 merge: `false`

## Next Required Approval

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX
```

A future contact-only retry must be a separate owner-approved execution. This PR only fixes the harness adapter-loading path and verifies it without production write.

## side_effects JSON

```json
{
  "production_db_write": false,
  "contact_only_retry_executed": false,
  "execute_attempt_count": 0,
  "cleanup_executed": false,
  "dependency_scan_blocker_fixed": true,
  "safe_harness_loader_preserved": true,
  "approval_gate_preserved": true,
  "execute_requires_owner_approval": true,
  "execute_flag_required": true,
  "slug_gate_preserved": true,
  "marker_gate_preserved": true,
  "contact_only_mode_preserved": true,
  "public_api_write_call": false,
  "ad_hoc_production_write_harness_created": false,
  "real_customer_name_used": false,
  "real_phone_used": false,
  "real_email_used": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "raw_full_store_id_output": false,
  "schema_changed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "env_auth_payment_webhook_changed": false,
  "external_notification_sent": false,
  "payment_or_webhook_touched": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "pr_125_merged": false,
  "next_required_approval": "APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX"
}
```
