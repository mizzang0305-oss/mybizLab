# Customer-Memory Adapter Projection Fix

Status: `ADAPTER_PROJECTION_FIX_DRAFT`

Branch: `codex/customer-memory-adapter-projection-fix`

This packet fixes the server customer-memory production adapter projection that blocked the owner-approved synthetic canary in PR #130. It is code/docs/tests only. It does not approve or execute a retry, cleanup, production DB write, schema change, migration apply, RLS/GRANT/REVOKE, public API write route call, live customer-memory gate enablement, manual deploy, or PR #106 merge.

## PR #130 Baseline

- PR #130 decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT`
- one execute attempt only: `true`
- safe merged harness used: `true`
- production DB write in PR #130: `true`
- `customers` delta in PR #130: `+1`
- `customer_contacts` delta in PR #130: `+0`
- `inquiries` delta in PR #130: `+0`
- `customer_timeline_events` delta in PR #130: `+0`
- blocker: `column customers.id does not exist`
- retry after blocker: `false`
- cleanup/delete after blocker: `false`
- raw PII output: `false`
- customer row sample output: `false`
- public API write route call: `false`

The partial synthetic `customers` row remains in production. This PR intentionally does not inspect or output that row.

## Read-Only Live Schema Evidence

Evidence command class: production `information_schema.columns` metadata query through the linked Supabase project.

Evidence limits:

- target tables only: `customers`, `customer_contacts`, `inquiries`, `customer_timeline_events`
- metadata columns only: table name, ordinal position, column name, data type, nullability
- no `SELECT *`
- no business rows
- no raw PII
- no raw full `store_id`
- no schema/write/RLS/grant/migration operation

Live identifier and reference mapping:

| Table | Store column | Customer identifier/reference column | Notes |
| --- | --- | --- | --- |
| `customers` | `store_id` | `customer_id` | `customers.id` is absent; `customer_id` is the live customer identifier. |
| `customer_contacts` | `store_id` | `customer_id` | `customer_contacts.id` exists as the contact row id; `customer_id` references `customers.customer_id`. |
| `inquiries` | `store_id` | `customer_id` | `inquiries.id` exists as the inquiry row id; `customer_id` references `customers.customer_id`. |
| `customer_timeline_events` | `store_id` | `customer_id` | `customer_timeline_events.id` exists as the event row id; `customer_id` references `customers.customer_id`. |

Live `customers` projection fields used by the adapter after this fix:

```text
customer_id,store_id,customer_key,name,normalized_phone,normalized_email,visit_count,is_regular,marketing_consent,first_seen_at,last_seen_at,updated_at
```

Live `customer_contacts` projection fields used by the adapter after this fix:

```text
id,store_id,customer_id,contact_type,raw_value,normalized_value,is_primary,is_verified,created_at
```

Live `inquiries` projection fields used by the adapter after this fix:

```text
id,store_id,customer_id,conversation_session_id,visitor_session_id,contact_name,contact_phone,contact_email,category,intent,status,message,summary,subject,tags,memo,marketing_opt_in,requested_visit_date,source,channel,created_at,updated_at
```

Live `customer_timeline_events` projection fields are already aligned:

```text
id,store_id,customer_id,event_type,payload,created_at,source,summary,occurred_at
```

## Root Cause

The production adapter selected `customer_id,id,store_id` from `customers` when checking store isolation before contact, inquiry, and timeline writes.

Production `customers.id` is absent. The live schema uses `customers.customer_id` as the customer identifier. After the PR #130 harness completed the first `customers` upsert, the next adapter store-isolation read failed on the missing `customers.id` projection and stopped before `customer_contacts`, `inquiries`, or `customer_timeline_events` writes.

The broader read projections also included legacy customer/contact/inquiry aliases that are not present in the live target table schemas. This PR narrows those projections to the live columns while preserving mapper fallbacks for existing in-memory and legacy-shaped rows.

## Adapter Fix Summary

- `customerIdSetForStore` now selects only `customer_id,store_id` from `customers`.
- `listCustomers` now selects the live `customers` columns and maps `normalized_phone` / `normalized_email` through the existing customer model contract.
- `listCustomerContacts` now selects the live `customer_contacts` columns and keeps the existing contact mapper fallback behavior.
- `listInquiries` now selects the live `inquiries` columns and keeps the existing inquiry mapper fallback behavior.
- `customer_timeline_events` projection remains unchanged because the live columns are already aligned.
- No schema migration, RLS/grant change, public API write route, harness execute, retry, or cleanup is included.

## Partial Row Retention

Decision: retain the partial synthetic `customers` row from PR #130 for now.

Reason:

- cleanup/delete is explicitly out of scope for this PR
- the partial row is the known PR #130 baseline
- deleting it would require a separate owner approval and a separate sanitized evidence record
- retaining it avoids compounding a partial-write incident with an unapproved production delete

Expected retry baseline impact:

- `customers` marker-scoped pre-count may be `1`
- next approved retry may produce `customers +0` if the existing synthetic row is updated, or `customers +1` at maximum if the marker baseline differs
- `customer_contacts` expected retry delta: `+1` max
- `inquiries` expected retry delta: `+1` max
- `customer_timeline_events` expected retry delta: `+1~2` max

## Retry Gate

Retry status in this PR: `BLOCKED_PENDING_FRESH_OWNER_APPROVAL`

Required next owner approval string:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
```

This PR does not run the harness. It only prepares the adapter for a separately approved one-run retry.

## Validation Result

- `git diff --check`: `PASS`
- `git diff --cached --check`: `PASS` before staging
- `npm run lint`: `PASS`
- `npm run typecheck`: `PASS`
- `npm run build`: `PASS` with existing Vite dynamic-import/chunk-size warnings only
- `npm test`: `PASS` with 131 test files and 672 tests
- `npm test -- src/tests/customer-memory-adapter-projection-fix.test.ts`: `PASS` with 9 tests
- staged secret/PII/full-UUID scan: `PASS`
- Vercel preview checks: `PASS` on Draft PR #131

## Business Output

- User problem solved: removes the live-schema adapter projection blocker that stopped the synthetic customer-memory canary after a partial customer upsert.
- Revenue path supported: unblocks the next owner-approved PRO/VIP customer-memory canary path for CRM, reports, diagnostics, dashboard, and automation readiness.
- Data that can be collected later: one bounded synthetic customer-memory card, contact, inquiry, and timeline evidence set after fresh approval.
- Remaining before production launch: review this fix, keep the partial row retained or approve separate cleanup, run exactly one retry only after the explicit approval string, then evaluate broader rollout separately.

## side_effects JSON

```json
{
  "production_db_write": false,
  "canary_retry_executed": false,
  "cleanup_executed": false,
  "partial_synthetic_customer_retained": true,
  "adapter_projection_fixed": true,
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
