# Synthetic Customer-Memory Canary Retry Final Execute Result

Status: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`

Branch: `codex/customer-memory-synthetic-canary-retry-final-execute`

This packet records the owner-approved final retry after the fixed adapter and aligned retry approval gate reached `main`. The safe harness executed exactly one retry with the approved slug and marker. The retry wrote through the server customer-memory adapter path only.

The retry did not fully pass because the marker-scoped `customer_contacts` count remained `0`. No second retry was attempted. No cleanup/delete was executed.

## Approval And Execute Env Gate

Owner approval string supplied:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
```

Required execute env verified for the one retry:

- `MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER`
- `MYBIZ_CANARY_EXECUTE=true`
- `MYBIZ_CANARY_STORE_SLUG=mybizlab-test`
- `MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

Gate result:

- owner approval present: `true`
- execute env exactness: `true`
- retry approval gate aligned: `true`
- initial approval gate preserved: `true`
- dry-run default preserved: `true`
- execute mode: `retry_with_fixed_adapter`
- decision after execute: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`

## Baseline

- PR #130 merged: partial canary result retained one marker-scoped `customers` row.
- PR #131 merged: adapter projection fix aligned the live customer identifier to `customers.customer_id` and removed hardcoded `customers.id` projection.
- PR #132 merged: retry was blocked by execute env mismatch with execute attempt count `0`.
- PR #133 merged: retry approval gate alignment accepted the fresh retry approval string while preserving the initial gate.
- main HEAD at retry branch start: `f15b1893e1ef61c75a2eb803f60584a2b1242a66`
- dedicated test store slug: `mybizlab-test`
- dedicated test store exact-one-store: `PASS`
- selected store id: masked `960b40b6...a0ed`; hash `5f84c707e917f845`
- raw full `store_id`: not output
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

## Execution Path

Allowed path:

- safe merged harness: `scripts/customer-memory/synthetic-canary-harness.mjs`
- fixed server adapter path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`
- package entrypoint: `npm run customer-memory:canary:dry-run`

Actual path:

- dry-run used the merged safe harness and returned `DRY_RUN_READY_NO_WRITE`
- execute used the merged safe harness and returned `EXECUTED_WITH_APPROVAL`
- server adapter write path was invoked for the approved test store only
- public API write route call: `false`
- ad hoc harness creation: `false`
- SQL replay: `false`
- migration/db push/repair/apply: `false`
- RLS/GRANT/REVOKE execution: `false`
- manual deploy: `false`
- external notification/payment/webhook call: `false`

The harness enabled adapter write flags in-process for this one local run only. No persistent live customer-memory gate, environment file, auth, payment, webhook, or deployment setting was changed.

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
| --- | ---: |
| `customers` | `1` |
| `customer_contacts` | `0` |
| `inquiries` | `0` |
| `customer_timeline_events` | `0` |

Store-scoped non-target guard counts before execute:

| Table | Count |
| --- | ---: |
| `stores` for approved slug | `1` |
| `store_members` for approved store | `0` |
| `store_subscriptions` for approved store | `0` |
| `store_public_pages` for approved store | `0` |

The `customers` pre-count of `1` matches the retained PR #130 partial synthetic customer baseline and was allowed only because the retry approval gate uses `retry_with_fixed_adapter`.

## Retry Execute Result

Execute attempt count: `1`

Second retry attempt: `false`

Command path:

```text
node scripts/customer-memory/synthetic-canary-harness.mjs
```

Harness terminal status: `EXECUTED_WITH_APPROVAL`

The process returned the sanitized JSON result before non-fatal Vite dependency-scan shutdown warnings appeared. The command exit code was `0`, and the JSON post-counts are the source of truth for this evidence packet.

## Post-Write Read-Only Confirmation

Read-only checks used explicit allowlisted projections and count-only queries. `SELECT *` was not used for target evidence. Raw rows and raw PII were not output.

Marker-scoped target post-counts:

| Table | Pre-count | Post-count | Delta | Approved cap | Result |
| --- | ---: | ---: | ---: | --- | --- |
| `customers` | `1` | `1` | `+0` | `+0 or +1, max 1` | `PASS_RETAINED_PARTIAL_CUSTOMER` |
| `customer_contacts` | `0` | `0` | `+0` | `upsert max 1` | `PARTIAL_NOT_CREATED` |
| `inquiries` | `0` | `1` | `+1` | `insert max 1` | `PASS_CREATED` |
| `customer_timeline_events` | `0` | `1` | `+1` | `insert max 1~2` | `PASS_CREATED` |

Additional contact read-back check:

| Check | Count |
| --- | ---: |
| `customer_contacts` by fixed synthetic contact id | `0` |
| `customer_contacts` by synthetic customer id | `0` |

Non-target guard counts after execute:

| Table | Result |
| --- | --- |
| `stores` for approved slug | unchanged at `1` |
| `store_members` for approved store | unchanged at `0` |
| `store_subscriptions` for approved store | unchanged at `0` |
| `store_public_pages` for approved store | unchanged at `0` |
| non-target tables | insert/update/delete `0` |

Target row cap exceeded: `false`

Non-target table changed: `false`

## Sanitized Read-Back Result

- customer card sanitized result: `retained_partial_customer_count_1`
- customer card synthetic-name check: `false`
- customer card synthetic-email-domain check: `other_or_empty`
- customer card phone empty: `true`
- customer contact sanitized result: `not_created`
- inquiry inbox redacted result: `created_marker_present`
- inquiry inbox status: `new`
- inquiry inbox channel: `public_page`
- inquiry inbox synthetic-name check: `true`
- inquiry inbox synthetic-email-domain check: `example.invalid`
- inquiry inbox phone empty: `true`
- timeline non-PII result: `created`
- timeline event type: `inquiry_created`
- timeline marker read-back check: `false`
- wrong-store/non-test-store exposure: `not_expanded_after_partial_result`
- raw customer row sample output: `false`
- raw phone/email/name output: `false`
- raw full store id output: `false`
- Vercel protection bypass: not attempted

The retained customer card did not become the exact synthetic display card expected by the payload. The inquiry and timeline rows were created, but the contact row was not created. Because a second retry is forbidden, this packet records the partial result without further mutation.

## Expected vs Actual DB Effect

| Table | Approved maximum | Actual effect |
| --- | --- | ---: |
| `customers` | `+0 or +1, max 1` | `+0` |
| `customer_contacts` | `upsert max 1` | `0` |
| `inquiries` | `insert max 1` | `+1` |
| `customer_timeline_events` | `insert max 1~2` | `+1` |
| `stores` | `insert 0` | `0` |
| `store_members` | `insert 0` | `0` |
| `store_subscriptions` | `insert 0` | `0` |
| `store_public_pages` | `insert 0` | `0` |
| `leads` | `insert 0` | `0` |
| `visitor_sessions` | `insert 0` | `0` |
| `feedback records` | `insert 0` | `0` |
| `payments/webhooks` | `insert 0` | `0` |
| non-target tables | insert/update/delete `0` | `0` |

## Stop Conditions Checked

- owner approval missing: `false`
- execute env mismatch: `false`
- slug mismatch: `false`
- marker mismatch: `false`
- exact-one-store mismatch: `false`
- pre-existing partial customer baseline allowed for retry: `true`
- target row cap exceeded: `false`
- contact row missing after execute: `true`
- public API write route required: `false`
- raw PII output required: `false`
- second retry required: `false`
- cleanup/delete required in this PR: `false`

## Cleanup Posture

- cleanup in this PR: `false`
- cleanup/delete execution: forbidden
- the retained partial synthetic customer remains in production
- the created synthetic inquiry and timeline rows remain in production
- cleanup requires separate owner approval and a separate sanitized evidence record

## Decision

Canary result decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`

The retry approval was present, the fixed adapter was merged, the aligned retry gate accepted the requested approval string, and the safe harness executed exactly once. The end-to-end synthetic canary did not fully pass because `customer_contacts` stayed at `0` and the retained customer card did not match the expected synthetic display card.

Next gate:

- review this partial retry evidence
- do not run a second retry without a fresh owner approval and a new plan
- investigate why the server adapter did not create the synthetic contact row
- decide separately whether to cleanup retained synthetic artifacts
- broader PRO/VIP customer-memory rollout remains blocked until a complete canary pass or an owner-accepted partial-risk decision

## Validation Result

- `git diff --check`: PASS
- `git diff --cached --check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS with existing chunk/dynamic import warnings
- `npm test`: PASS (`134` files, `698` tests)
- `npm test -- src/tests/customer-memory-synthetic-canary-retry-final-execute-result.test.ts`: PASS (`1` file, `9` tests)
- staged secret/PII/full-UUID scan: PASS
- Vercel preview checks: PASS on Draft PR #134

## Business Output

- User problem solved: records the exact outcome of the approved fixed-adapter retry without hiding the partial contact failure.
- Revenue path supported: keeps PRO/VIP customer-memory, CRM, reports, diagnostics, dashboard, and automation proof honest before broader rollout.
- Data collected: sanitized counts, route/path evidence, side-effect matrix, and redacted read-back status only.
- Production remaining: contact creation needs investigation, cleanup requires separate approval, and broader customer-memory rollout remains gated.

## side_effects JSON

```json
{
  "owner_approval": true,
  "execute_env_verified": true,
  "production_db_write": true,
  "safe_harness_used": true,
  "fixed_adapter_used": true,
  "aligned_retry_gate_used": true,
  "public_api_write_call": false,
  "test_store_slug": "mybizlab-test",
  "synthetic_marker": "MYBIZ_CANARY_CUSTOMER_MEMORY_20260618",
  "customers_upsert_delta": 0,
  "customer_contacts_upsert_count": 0,
  "inquiries_insert_count": 1,
  "customer_timeline_events_insert_count": 1,
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
  "second_retry_attempt": false,
  "canary_decision": "SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED"
}
```
