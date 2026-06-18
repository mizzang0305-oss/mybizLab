# Synthetic Customer-Memory Canary Execute-With-Harness Result

Status: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT`

Branch: `codex/customer-memory-synthetic-canary-execute-with-harness`

This packet records the owner-approved one-run synthetic customer-memory canary execution using the merged safe local harness. The harness attempted exactly one production write path execution and stopped on the server adapter schema mismatch. Post-attempt read-only evidence confirms one marker-scoped `customers` upsert occurred, while `customer_contacts`, `inquiries`, and `customer_timeline_events` remained at `0`.

No second execute attempt was made. No cleanup/delete was executed.

## Approval Gate

Required owner approval string: `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY`

Approval gate result: `PASS`

Required execute env result: `PASS`

- `MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY`
- `MYBIZ_CANARY_EXECUTE=true`
- `MYBIZ_CANARY_STORE_SLUG=mybizlab-test`
- `MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

Approved target:

- dedicated test store slug: `mybizlab-test`
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- selected store id: masked `960b40b6...a0ed`; hash `5f84c707e917f845`
- raw full `store_id`: not output

## Baseline

- PR #123 merged: customer-memory test-store canary plan
- PR #124 merged: owner-selected store not found evidence
- PR #126 merged: dedicated test-store provisioning approval plan
- PR #127 merged: dedicated test-store provisioning execute result
- PR #128 merged: blocked because no approved execution harness
- PR #129 merged: safe synthetic canary harness
- main HEAD at preflight: `7710f73ef14949c473cd8fc9d3ffab7a916eddbe`
- dedicated test store exact-one-store: `PASS`
- approved slug count: `1`
- total stores count: `7`
- PR #125: OPEN Draft; not readied or merged

## Execution Path

Approved execution path:

- safe merged harness: `scripts/customer-memory/synthetic-canary-harness.mjs`
- server customer-memory adapter path only: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`
- package dry-run entrypoint: `npm run customer-memory:canary:dry-run`

Forbidden paths remained unused:

- public API write route call: `false`
- ad hoc harness creation: `false`
- SQL replay: `false`
- migration/db push/repair/apply: `false`
- RLS/GRANT/REVOKE execution: `false`
- manual deploy: `false`

The harness uses an in-process adapter approval for the one local run only. No persistent live customer-memory gate, environment file, auth, payment, webhook, or deployment setting was changed.

## Synthetic Payload

The approved payload was synthetic-only:

- marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`
- phone: `OMITTED_NOT_REAL_NUMBER`
- email: `OMITTED_NOT_REAL_EMAIL`
- inquiry source/channel: `customer_memory_canary`
- inquiry summary: `Synthetic canary summary; no real customer data.`
- inquiry message: `Non-PII customer-memory canary inquiry for approved dedicated test store only.`
- timeline summary: `Synthetic canary write verified for approved dedicated test store.`
- real customer identifier: forbidden
- real customer name/phone/email: forbidden
- raw PII output: forbidden
- raw customer/contact/inquiry/timeline row samples: forbidden

## Dry-Run Result

Command: `npm run customer-memory:canary:dry-run`

Result before execute: `DRY_RUN_READY_NO_WRITE`

- exact-one-store: `PASS`
- dry-run production write: `false`
- public API write call: `false`
- adapter path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`
- row caps loaded: `PASS`
- selected store id output: masked/hash only

Marker-scoped target pre-counts before execute:

| Table | Pre-count |
| --- | --- |
| `customers` | `0` |
| `customer_contacts` | `0` |
| `inquiries` | `0` |
| `customer_timeline_events` | `0` |

Store-scoped non-target guard counts before execute:

| Table | Count |
| --- | --- |
| `stores` for approved slug | `1` |
| `store_members` for approved store | `0` |
| `store_subscriptions` for approved store | `0` |
| `store_public_pages` for approved store | `0` |

## Execute Result

Execute attempt count: `1`

Second execute attempt: `false`

Command path: `node scripts/customer-memory/synthetic-canary-harness.mjs`

Harness terminal status: `BLOCKED`

Sanitized error:

```text
Failed to load customer ids for customer memory store isolation: column customers.id does not exist
```

Observed adapter stop point:

- `saveCustomer` completed its `customers` upsert.
- `saveCustomerContact` then called the store-isolation helper.
- The helper selected `customer_id,id,store_id` from `customers`.
- Production `customers.id` is absent, so the adapter raised the sanitized error above before contact, inquiry, or timeline writes.

The harness catch block reported `production_db_write: false`, but read-only post-counts establish the actual production DB effect as `customers +1`. The committed decision uses the post-count result, not the caught-error summary.

## Post-Write Read-Only Confirmation

Read-only checks used explicit allowlisted projections and count-only queries. `SELECT *` was not used for target evidence. Raw rows and raw PII were not output.

Marker-scoped target post-counts:

| Table | Pre-count | Post-count | Delta | Approved cap | Result |
| --- | ---: | ---: | ---: | --- | --- |
| `customers` | `0` | `1` | `+1` | `upsert max 1` | `PASS_WITH_PARTIAL_WRITE` |
| `customer_contacts` | `0` | `0` | `+0` | `upsert max 1` | `PASS_NOT_CREATED` |
| `inquiries` | `0` | `0` | `+0` | `insert max 1` | `PASS_NOT_CREATED` |
| `customer_timeline_events` | `0` | `0` | `+0` | `insert max 1~2` | `PASS_NOT_CREATED` |

Wrong-store marker exposure counts:

| Table | Wrong-store count |
| --- | ---: |
| `customers` | `0` |
| `customer_contacts` | `0` |
| `inquiries` | `0` |
| `customer_timeline_events` | `0` |

Non-target aggregate checks:

| Table | Result |
| --- | --- |
| `stores` | unchanged at `7` |
| `store_members` | unchanged at `7` |
| `store_subscriptions` | unchanged at `1` |
| `store_public_pages` | unchanged at `6` |
| `lead_capture_requests` | unchanged at `0` |
| `visitor_sessions` | unchanged at `79` |
| `payment_events` | unchanged at `7` |
| `billing_webhook_*` | no harness path touched; direct post-count unavailable because the tables were not in the live schema cache |

## Sanitized Read-Back Result

- customer card sanitized result: `created_partial_customer_count_1`
- inquiry inbox redacted result: `not_created`
- timeline non-PII result: `not_created`
- wrong-store/non-test-store exposure: `0`
- raw customer row sample output: `false`
- raw phone/email/name output: `false`
- raw full store id output: `false`
- Vercel protection bypass: not attempted

## Expected vs Actual DB Effect

| Table | Approved maximum | Actual effect |
| --- | --- | --- |
| `customers` | `customers upsert max 1` | `+1` |
| `customer_contacts` | `customer_contacts upsert max 1` | `0` |
| `inquiries` | `inquiries insert max 1` | `0` |
| `customer_timeline_events` | `customer_timeline_events insert max 1~2` | `0` |
| `stores` | `stores insert 0` | `0` |
| `store_members` | `store_members insert 0` | `0` |
| `store_subscriptions` | `store_subscriptions insert 0` | `0` |
| `store_public_pages` | `store_public_pages insert 0` | `0` |
| `leads` | `leads insert 0` | `0` |
| `visitor_sessions` | `visitor_sessions insert 0` | `0` |
| `feedback records` | `feedback records insert 0` | `0` |
| `payments/webhooks` | `payments/webhooks insert 0` | `0` |
| non-target tables | insert/update/delete `0` | `0` |

Target row cap exceeded: `false`

Non-target table changed: `false`

## Stop Conditions Checked

- owner approval missing: `false`
- execute env mismatch: `false`
- slug mismatch: `false`
- marker mismatch: `false`
- exact-one-store mismatch: `false`
- pre-existing marker rows before execute: `false`
- cap exceeded: `false`
- adapter schema mismatch: `true`
- public API write route required: `false`
- raw PII output required: `false`
- second execute required: `false`
- cleanup/delete required in this PR: `false`

## Cleanup Posture

- cleanup in this PR: `false`
- cleanup/delete execution: forbidden
- the partial synthetic `customers` row remains in production
- cleanup requires separate owner approval and a separate evidence record
- no retry should be attempted until the adapter mismatch is fixed and cleanup/retry policy is approved

## Decision

Canary result decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT`

The bounded customer upsert stayed within the approved cap, but the end-to-end synthetic canary did not pass because the production adapter still selects a non-existent `customers.id` column during customer scope checks.

Next gate:

- review this partial-write evidence
- approve or reject a cleanup plan for the partial synthetic customer row
- fix the adapter store-isolation projection in a separate PR
- after cleanup and fix approval, decide whether to authorize a new one-run canary attempt
- broader PRO/VIP customer-memory rollout remains blocked

## Validation Result

- `git diff --check`: `PASS`
- `git diff --cached --check`: `PASS` before staging
- `npm run lint`: `PASS`
- `npm run typecheck`: `PASS`
- `npm run build`: `PASS` with existing Vite chunk-size/dynamic-import warnings only
- `npm test`: `PASS` with 130 test files and 663 tests
- `npm test -- src/tests/customer-memory-synthetic-canary-execute-with-harness-result.test.ts`: `PASS` with 10 tests
- staged secret/PII scan: `PASS`
- Vercel preview checks: `PASS`

## Business Output

- User problem solved: converts the owner-approved canary attempt into auditable evidence without hiding the partial production write.
- Revenue path supported: keeps PRO/VIP customer-memory, CRM, reports, dashboard, and automation launch gating honest before broader rollout.
- Data that can be collected later: after cleanup/fix approval, one synthetic customer-memory card, one redacted inquiry, and one or two non-PII timeline events.
- Remaining before production launch: review partial-write evidence, approve cleanup, fix the adapter projection, rerun canary only with fresh approval, then plan broader PRO/VIP rollout.

## side_effects JSON

```json
{
  "owner_approval": true,
  "execute_env_verified": true,
  "production_db_write": true,
  "safe_harness_used": true,
  "public_api_write_call": false,
  "test_store_slug": "mybizlab-test",
  "synthetic_marker": "MYBIZ_CANARY_CUSTOMER_MEMORY_20260618",
  "customers_upsert_count": 1,
  "customer_contacts_upsert_count": 0,
  "inquiries_insert_count": 0,
  "customer_timeline_events_insert_count": 0,
  "target_row_cap_exceeded": false,
  "non_target_table_changed": false,
  "stores_insert_count": 0,
  "store_members_insert_count": 0,
  "store_subscriptions_insert_count": 0,
  "store_public_pages_insert_count": 0,
  "leads_insert_count": 0,
  "visitor_sessions_insert_count": 0,
  "feedback_records_insert_count": 0,
  "payments_webhooks_insert_count": 0,
  "live_customer_memory_gate_enabled_persistently": false,
  "test_inquiry_created_with_real_data": false,
  "real_customer_name_used": false,
  "real_phone_used": false,
  "real_email_used": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "raw_full_store_id_output": false,
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
  "second_execute_attempt": false,
  "canary_decision": "SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT"
}
```
