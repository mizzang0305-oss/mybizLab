# Customer Memory Schema Alignment Pre-Apply Evidence

Status: docs/tests-only Draft PR evidence. This document decides whether the pending customer-memory schema alignment migration is ready for a separately approved apply step. It does not execute migration apply, `db push`, migration repair, SQL replay, RLS policy SQL, GRANT/REVOKE, production business-row writes, env changes, or live-write enablement.

Repository: `mizzang0305-oss/mybizLab`

Branch: `codex/customer-memory-schema-alignment-preapply-evidence`

Evidence date: `2026-06-16`

Base main HEAD: `7d3f0f52cd2948369817bebdf2eb4afba7d9ce9f`

Pending migration under review: `supabase/migrations/20260615075421_customer_memory_schema_alignment.sql`

Evidence posture:
- `SELECT *` was not used.
- Row samples were not collected.
- Raw customer/contact/message values were not collected.
- Secret, token, DB password, and connection string values were not recorded.

## Migration List State

Read-only command:

```text
npx supabase migration list --linked
```

Observed active migration state:

| Local version | Remote version | Interpretation |
| --- | --- | --- |
| `20260614` | `20260614` | baseline marker metadata repair is complete |
| `20260615075421` | empty | customer-memory schema alignment remains local-only pending |

Readiness implication:
- No unexpected remote-only migration was observed.
- No extra active local migration was observed.
- `20260615075421` has not been marked applied in remote migration history.

## Pending Migration SQL Risk Summary

Non-comment SQL line count: `50`

| SQL category | Count | Risk note |
| --- | ---: | --- |
| transaction wrapper | `begin=1`, `commit=1` | migration is transaction-scoped |
| destructive SQL | `0` | no DROP, TRUNCATE, or DELETE in executable SQL |
| UPDATE | `1` | idempotent backfill of `customer_contacts.store_id` from `customers.store_id` where contact store_id is null |
| ALTER TABLE | `4` | additive `add column if not exists` only |
| CREATE INDEX | `7` | all use `create index if not exists`; two are unique partial indexes |
| RLS / policy SQL | `0` | no RLS enable/disable or policy statement |
| GRANT / REVOKE | `0` | no grant hardening in this migration |
| trigger / function | `0` | no trigger or function execution |
| idempotency markers | `24` | uses `if not exists` for additive columns and indexes |

SQL risk decision: `LOW_FOR_CONTROLLED_SCHEMA_APPLY`

The only data-changing statement is the store_id backfill. Current production evidence shows `customer_contacts.store_id` already exists and null count is `0`, so that UPDATE is expected to affect `0` rows if the current state remains unchanged at apply time. This must be rechecked immediately before any real apply.

## Production Read-Only Evidence Summary

Row counts:

| Table | row_count |
| --- | ---: |
| `customers` | `82` |
| `customer_contacts` | `89` |
| `inquiries` | `0` |
| `customer_timeline_events` | `114` |

Required column evidence:

| Requirement | Evidence |
| --- | --- |
| `customers.store_id` | exists, `uuid`, not nullable |
| `customers.normalized_phone` | exists, `text`, nullable |
| `customers.normalized_email` | exists, `text`, nullable |
| `customer_contacts.customer_id` | exists, `uuid`, not nullable |
| `customer_contacts.normalized_value` | exists, `text`, not nullable |
| `customer_contacts.store_id` | exists, `uuid`, nullable |
| `inquiries.store_id` | exists, `uuid`, not nullable |
| `inquiries.customer_id` | exists, `uuid`, nullable |
| `inquiries.category/message/source/requested_visit_date` | exists |
| `customer_timeline_events.store_id` | exists, `uuid`, not nullable |
| `customer_timeline_events.customer_id` | exists, `uuid`, not nullable |
| `customer_timeline_events.source/summary/occurred_at` | exists |

Index evidence:
- `customers_store_normalized_phone_idx` exists.
- `customers_store_normalized_email_idx` exists.
- `customer_contacts_store_customer_idx` exists.
- `inquiries_store_customer_created_idx` exists.
- `customer_timeline_events_store_customer_event_created_idx` exists.
- `customer_contacts_store_phone_unique` exists.
- `customer_contacts_store_email_unique` exists.

Constraint evidence:
- Primary keys exist on `customers`, `customer_contacts`, `inquiries`, and `customer_timeline_events`.
- Foreign keys exist for target customer/store linkage where expected.
- Existing `customer_contacts` uniqueness on `(customer_id, contact_type, normalized_value)` remains present.

Interpretation:
- Production schema already appears aligned with the draft migration's additive column and index targets.
- Applying the pending migration would mainly align migration history with already-present schema objects, plus an idempotent backfill that currently has no null `store_id` candidates.

## Dedupe And Backfill Risk Audit

All values below are aggregate counts only.

| Audit metric | count |
| --- | ---: |
| `customers_store_normalized_phone_duplicate_groups` | `0` |
| `customers_store_normalized_phone_duplicate_extra_rows` | `0` |
| `customer_contacts_store_phone_duplicate_groups` | `0` |
| `customer_contacts_store_phone_duplicate_extra_rows` | `0` |
| `customer_contacts_store_email_duplicate_groups` | `0` |
| `customer_contacts_store_email_duplicate_extra_rows` | `0` |
| `customer_contacts_store_id_null_count` | `0` |
| `customer_contacts_store_id_null_with_customer_match_count` | `0` |
| `customer_contacts_orphan_customer_id_count` | `0` |
| `customer_contacts_phone_normalized_null_or_blank_count` | `0` |
| `customer_contacts_email_normalized_null_or_blank_count` | `0` |

Dedupe/backfill decision: `PASS`

Unique index creation failure risk from current duplicate data: `LOW`

Backfill risk from orphaned contacts: `LOW`

The final apply gate should rerun these count-only checks immediately before apply because production rows can change between this evidence PR and any future approval.

## RLS And Grant Risk Audit

RLS evidence:

| Table | RLS enabled | policy count | policy summary |
| --- | --- | ---: | --- |
| `customers` | true | `1` | member access policy present |
| `customer_contacts` | true | `1` | member access policy present |
| `inquiries` | true | `1` | member access policy present |
| `customer_timeline_events` | true | `1` | member access policy present |

Grant evidence:
- `anon` currently has broad privileges on the target tables.
- `authenticated` currently has broad privileges on the target tables.
- `service_role` has broad privileges, as expected for privileged server operations.

RLS/grant decision: `SEPARATE_HARDENING_REQUIRED_BEFORE_LIVE_WRITE`

This does not block an approval-gated schema-alignment apply because the pending migration does not change RLS or grants. It does block live customer-memory writes until RLS policy bodies and role grants are reviewed and hardened in a separate approval gate.

Do not combine schema apply with RLS/GRANT changes unless a separate owner approval explicitly expands scope.

## Readiness Decision

Readiness decision: `SCHEMA_ALIGNMENT_APPLY_READY`

Reason:
- Migration history state is expected: baseline marker applied, schema alignment still local-only pending.
- Pending migration SQL is additive/idempotent and contains no executable DROP, TRUNCATE, DELETE, RLS policy SQL, GRANT/REVOKE, trigger, or function.
- Target production columns and indexes already exist.
- Duplicate/orphan/null risk audit returns `0` for the blocking checks.
- RLS/grant risk is real but separable from this migration and remains a live-write blocker.

Not selected:
- `BLOCKED_DUPLICATE_CONTACTS`: duplicate counts are `0`.
- `BLOCKED_ORPHAN_CONTACTS`: orphan contact count is `0`.
- `BLOCKED_MIGRATION_SQL_RISK`: executable SQL has no destructive, RLS, grant, trigger, or function statements; update is idempotent and currently has no null-store candidates.
- `BLOCKED_RLS_GRANT_RISK`: not selected for schema apply, but RLS/grant hardening is still required before live write.
- `BLOCKED_UNEXPECTED_MIGRATION_DRIFT`: migration list matches expected state.

Apply status: `NOT_EXECUTED`

## Rollback Plan

This PR performs no production mutation, so no production DB rollback is needed for this PR.

For a future approved apply:
- Take a production backup or approved restore point before apply.
- Rerun migration list and count-only duplicate/orphan/null audits immediately before apply.
- If apply fails before commit, rely on transaction rollback.
- If only additive columns/indexes already exist, prefer leaving them in place rather than dropping columns.
- If a new index causes unexpected performance impact, propose a separate reviewed rollback SQL for that index only.
- Do not use migration repair as rollback unless separately approved.
- Do not enable live writes until schema apply, RLS/grant hardening, and a test-store canary pass.

## Next Owner Approval Checklist

- [ ] Approve or reject applying `20260615075421_customer_memory_schema_alignment.sql`.
- [ ] Rerun `npx supabase migration list --linked`.
- [ ] Rerun duplicate/orphan/null count-only audit.
- [ ] Confirm `20260615075421` is still local-only pending.
- [ ] Confirm backup/rollback window.
- [ ] Confirm no customer/contact raw row output is needed.
- [ ] Keep `broadDbWriteEnabled=false` and live write gates disabled during schema apply.
- [ ] Schedule a separate RLS/grant hardening approval after schema apply.
- [ ] Schedule a separate test-store canary write approval after RLS/grant hardening.

## Forbidden Operations

Still forbidden from this PR:
- `npx supabase db push`
- `npx supabase migration up`
- `npx supabase migration apply`
- `npx supabase migration repair`
- SQL replay
- RLS policy apply
- GRANT/REVOKE
- production DB schema change
- production business row write
- live customer memory write
- live lead write
- live AI trace/background/public-event/feedback write
- env/auth/payment/webhook change
- customer/lead/visitor/feedback production row creation
- raw PII output
- secret/token/DB password/connection string output
- sales Excel import work
- PR #106 merge
- manual deploy
- stash deletion
- protected untracked modification

## Business Impact

User problem solved:
- Maintainers now have fresh pre-apply evidence for the customer-memory schema alignment migration after baseline marker repair.

Revenue path supported:
- This advances PRO/VIP customer memory persistence readiness while keeping live writes blocked until schema, RLS/grant, and canary gates pass.

Data that can be collected after separate approval:
- Migration apply evidence, post-apply schema evidence, RLS/grant verification, and test-store canary result. This PR collects no raw customer/contact/message data.

Remaining before production launch:
- Owner approval for schema alignment apply.
- RLS/grant hardening approval and execution.
- Test-store canary write approval.
- Live write gate approval only after canary pass.

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
  "live_lead_write": false,
  "env_auth_payment_webhook_changed": false,
  "raw_pii_output": false,
  "sales_excel_import_touched": false,
  "schema_alignment_preapply_evidence_created": true
}
```
