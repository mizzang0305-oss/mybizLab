# Customer Memory Bangidong Store Selection

Status: `DRAFT_PR_SELECTION_PACKET_ONLY`

Branch: `codex/customer-memory-bangidong-store-selection`

PR #123 state: `MERGED`

main HEAD: `b824ef50844f8fbe6d1751ab30a5d104a360cb16`

Owner-selected alias: `방이동`

This packet records a production read-only lookup for the owner-selected `방이동` store alias and prepares the next owner approval gate. It does not execute a production DB write, API write call, live gate enablement, test inquiry save, new store creation, migration operation, SQL replay, environment change, notification, webhook, deploy, Ready conversion, or merge.

## Baseline

Confirmed prerequisite:

- PR #123 Ready transition completed.
- PR #123 squash merge completed.
- PR #123 state: `MERGED`.
- main HEAD: `b824ef50844f8fbe6d1751ab30a5d104a360cb16`.
- Vercel production auto deploy: `SUCCESS`.
- Production read-only smoke: PASS for `/`, `/pricing`, `/admin/leads`, `/dashboard/customers`, and `/dashboard/ai-reports`.
- Production DB write, live gate enablement, RLS/GRANT/REVOKE execution, migration repair/up/apply, db push, and SQL replay were not executed.
- Tracked worktree and index were clean before this docs/tests-only branch was created.
- Protected untracked `.claude/worktrees/`, `.playwright-mcp/`, and `AGENTS.md` remain out of scope.

## Production Lookup Policy

Production lookup mode: `READ_ONLY_SANITIZED_LOOKUP`

Lookup target:

- table: `public.stores`
- selected alias: `방이동`
- query shape: count/catalog lookup only
- `SELECT *`: forbidden
- explicit column allowlist only
- allowed source columns: `store_id`, `slug`, `name`, `plan`, `created_at`
- output projection: masked `store_id`, masked slug, alias-match booleans, plan/status summary, created date
- no customer/contact/inquiry/timeline row samples
- no lead, visitor, feedback, payment, webhook, or notification rows
- raw customer/PII output: forbidden
- actual customer row sample output: forbidden

The lookup used explicit allowlisted columns only. Store name was used only to evaluate whether the owner-selected alias matched; the full store name is not recorded in this document. Store IDs are operational identifiers for future owner approval and must remain treated as internal evidence; this packet records only whether a store ID was resolved and uses no raw full ID.

## Lookup Result

Read-only lookup summary:

- total stores checked by count-only aggregate: `6`
- alias name matches: `0`
- alias slug matches: `0`
- candidate count: `0`
- Decision: `OWNER_STORE_NOT_FOUND`

Decision rules:

- `TEST_STORE_SELECTED_BANGIDONG`: exactly one sanitized candidate is found and its test/demo/internal purpose is clear.
- `OWNER_STORE_NOT_FOUND`: zero sanitized candidates are found.
- `OWNER_STORE_AMBIGUOUS`: two or more sanitized candidates are found.
- `OWNER_RECONFIRM_TEST_STORE_REQUIRED`: one candidate exists but test/demo/internal purpose is unclear.

exactly one store candidate is required before any canary write approval. Because candidate count is `0`, this packet is blocked and no write approval can proceed from this PR.

## Sanitized Selected Store Summary

Selected store summary, sanitized only:

| Field | Value |
| --- | --- |
| selected alias | `방이동` |
| candidate count | `0` |
| resolved store_id | `not resolved` |
| masked store_id | `not available` |
| masked slug | `not available` |
| plan/status | `not available` |
| created date | `not available` |
| test/demo/internal confirmation | `not confirmed` |

No raw store row, customer row, contact row, inquiry row, timeline row, lead row, visitor row, feedback row, payment row, webhook row, phone number, email address, or customer name is included.

## Canary Owner Approval Packet

Canary owner approval packet status: `BLOCKED_OWNER_STORE_NOT_FOUND`

Approval packet summary:

- selected alias: `방이동`
- resolved store_id: `not resolved`
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`
- synthetic-only payload required
- write path: server customer-memory adapter path
- expected execution mode: one separately approved owner-run only
- cleanup execution in this PR: `forbidden`
- cleanup requires separate owner approval

Blocked reason:

- no production `public.stores` candidate matched the owner-selected alias by sanitized read-only lookup
- no `store_id` can be approved from this packet
- no canary write path may run until the owner provides a resolvable production test-store alias or ID

Required owner action before canary execution:

- provide a corrected production test-store alias, slug, or internal store identifier
- confirm the store is a test/demo/internal store suitable for customer-memory canary rows
- re-run a read-only sanitized lookup
- require exactly one candidate before changing packet status

## Future Synthetic Payload

The future payload remains synthetic-only:

- marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`
- customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`
- phone: `OMITTED_NOT_REAL_NUMBER`
- email: `OMITTED_NOT_REAL_EMAIL`
- inquiry source: `customer_memory_canary`
- message: `Non-PII customer-memory canary inquiry for approved test store only.`
- raw PII values: forbidden

Any request for real customer name, phone number, email, raw customer row sample, raw contact row sample, raw inquiry row sample, or raw timeline row sample stops the canary.

## Planned Write Path

Future owner-approved execution must use the server customer-memory adapter path. The expected server operations remain:

- `saveCustomer`
- `saveCustomerContact`
- `saveInquiry`
- `appendTimelineEvent`

Forbidden in this PR:

- production DB write in this PR: `forbidden`
- live customer memory write enablement in this PR: `forbidden`
- live lead write enablement in this PR: `forbidden`
- API write call in this PR: `forbidden`
- test inquiry save in this PR: `forbidden`
- new store creation in this PR: `forbidden`
- env/auth/payment/webhook changes in this PR: `forbidden`
- RLS/GRANT/REVOKE execution in this PR: `forbidden`
- Supabase db push/migration repair/up/apply in this PR: `forbidden`
- SQL replay in this PR: `forbidden`

## Expected DB Effect After Separate Approval

No database effect is approved by this PR. If the owner later approves a corrected exact-one-store canary, expected DB effect remains capped:

| Table | Maximum future approved effect |
| --- | --- |
| `customers` | `customers` upsert max 1 |
| `customer_contacts` | `customer_contacts` upsert max 1 |
| `inquiries` | `inquiries` insert max 1 |
| `customer_timeline_events` | `customer_timeline_events` insert max 1-2 |

Future canary execution must run pre-count and post-count comparisons for all four target tables and stop if any table outside those four target tables changes.

## Read-Back Plan After Separate Approval

Read-back remains blocked until one store is selected. After a corrected exact-one-store selection:

- customer card: sanitized marker only
- inquiry inbox: redacted summary only
- timeline: non-PII summary only
- raw phone/email/name output: forbidden
- wrong-store read-back must not return canary rows
- Vercel protection blocks read-back: stop without bypass or secret

## Stop Conditions

Stop before any canary write when any condition is true:

- selected alias does not resolve to exactly one store
- multiple store candidates exist
- candidate store test/demo/internal purpose is unclear
- raw PII risk appears
- Vercel protection blocks read-back
- row count would exceed the expected cap
- any table outside `customers`, `customer_contacts`, `inquiries`, and `customer_timeline_events` would change
- live gate state does not match the separately approved execution scope
- cleanup has not been separately approved

## Cleanup Posture

- no cleanup execution in this PR
- cleanup requires separate owner approval
- direct DELETE execution in this PR: forbidden
- cleanup must target only the approved synthetic marker and approved store ID after a future canary
- if the candidate remains unresolved, there are no canary rows to clean up

## PR Publication Boundary

- Draft PR only
- Ready conversion: `forbidden`
- merge: `forbidden`
- manual deploy: `forbidden`
- PR #106 merge: `forbidden`
- protected untracked cleanup: `forbidden`
- stash deletion: `forbidden`

## Validation Checklist

Required before opening the Draft PR:

- `git diff --check`
- `git diff --cached --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm test -- src/tests/customer-memory-bangidong-store-selection.test.ts`
- staged secret/PII scan
- Vercel preview checks after Draft PR creation

## Business Output

User problem solved:

- records that the owner-selected `방이동` alias did not resolve to a production test store, preventing an unsafe canary against an unknown target

Revenue path supported:

- keeps the PRO/VIP customer-memory path moving by converting a risky ambiguous execution request into a blocked approval packet with exact next owner input

Data that can be collected after approval:

- sanitized exact-one-store selection evidence, count-only row deltas for the four approved customer-memory tables, and redacted read-back evidence for the synthetic marker

Remaining before production launch:

- corrected owner-selected production test-store alias or ID
- exact-one-store sanitized lookup
- owner-approved synthetic payload
- owner-approved scoped live gate enablement
- one bounded canary write with sanitized evidence
- cleanup or retained-audit-row decision

## Side Effects

```json
{
  "production_db_write": false,
  "production_schema_changed": false,
  "migration_apply": false,
  "db_push": false,
  "migration_repair": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "live_customer_memory_write": false,
  "live_customer_memory_gate_enabled": false,
  "live_lead_write": false,
  "live_lead_gate_enabled": false,
  "test_inquiry_created": false,
  "new_store_created": false,
  "env_auth_payment_webhook_changed": false,
  "raw_pii_output": false,
  "external_notification_sent": false,
  "sales_excel_import_touched": false,
  "manual_deploy": false,
  "pr_106_merged": false,
  "owner_selected_store_alias": "방이동",
  "test_store_selection_packet_created": true
}
```
