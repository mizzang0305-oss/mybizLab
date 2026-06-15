# Customer Memory Controlled Schema Apply Plan

Plan status: `APPLY_NOT_APPROVED`

This is a docs/tests-only controlled apply plan for the PR #109 customer-memory schema alignment draft. It does not approve production DB writes, migration apply, `db push`, migration repair, SQL replay, RLS policy apply, GRANT/REVOKE, live customer memory write, live lead write, env/auth/payment/webhook changes, customer/lead row creation, sales Excel import work, PR #106 merge, manual deploy, stash cleanup, or protected untracked cleanup.

Draft migration under review: `20260615075421_customer_memory_schema_alignment.sql`

No new migration file is added by this PR.

## Current Evidence

Production evidence mode: catalog metadata only

Read-only commands used:

```text
npx supabase db query --linked "information_schema.columns metadata query"
npx supabase db query --linked "pg_indexes name query"
npx supabase db query --linked "pg_policies count query"
npx supabase db query --linked "information_schema.role_table_grants summary query"
```

No `SELECT *`, row samples, normalized contact values, raw customer data, or raw PII were collected.

Catalog findings:

| Area | Evidence | Plan impact |
| --- | --- | --- |
| `customers.store_id` | present, not nullable | customer root is already store-scoped |
| `customers.name` / `normalized_phone` / `normalized_email` / `visit_count` / `is_regular` | missing from production catalog evidence | keep adapter mapping until a separate approval decides whether these become first-class columns |
| `customer_contacts.store_id` | missing | customer_contacts alignment must start nullable, backfilled from `customers`, then audited before not-null or uniqueness |
| `customer_contacts.normalized_value` | present, not nullable | can support store-scoped dedupe after `store_id` exists |
| `customer_contacts` current unique index | customer/customer_type/normalized_value scoped, not store-scoped | dedupe index must be redesigned around store isolation |
| `inquiries.store_id` / `customer_id` | present | inquiry linkage root exists |
| `inquiries.category` / `message` / `tags` / `memo` / `marketing_opt_in` / `requested_visit_date` / `source` | missing from production catalog evidence | adapter mapping remains required until schema alignment is approved |
| `customer_timeline_events.store_id` / `customer_id` / `event_type` / `payload` / `created_at` | present | append-only timeline root exists |
| `customer_timeline_events.source` / `summary` / `occurred_at` | missing from production catalog evidence | timeline payload policy must decide adapter-only versus first-class columns |
| RLS policy count | one policy observed per target table | policy bodies still require review before live writes |
| Grants | broad `anon` and `authenticated` privileges observed on target tables | grants hardening must be separated from schema alignment |

Duplicate contact audit: `NOT_RUN_REQUIRES_APPROVAL`

Key blocker shorthand:

- `customer_contacts.store_id`: missing

The duplicate audit must not print normalized values or raw contact values. A future approval should allow count-only conflict queries grouped by store/contact type, with values redacted or hashed outside logs.

## Draft Migration Analysis

The draft migration contains:

- `customers` app-model alignment columns.
- `customer_contacts.store_id` as nullable.
- an idempotent DML backfill from `customers.store_id`.
- `inquiries` app-model alignment columns.
- `customer_timeline_events` source/summary/occurred_at alignment columns.
- read path indexes for store/customer/timeline queries.
- store-scoped unique indexes for phone and email contacts after duplicate audit.

DML backfill requires an approved apply window.

Non-destructive review:

- no `DROP`
- no `TRUNCATE`
- no `DELETE FROM`
- no `GRANT`
- no `REVOKE`
- no `CREATE POLICY`
- no RLS enable/disable statement

The DML backfill is still a production write if executed. It remains blocked.

## Required Change Categories

### dedupe index

Goal:
- make same normalized phone/email in the same store resolve to one customer/contact path
- allow the same normalized phone/email across different stores
- prevent concurrent duplicate public inquiries from creating conflicting contact rows

Required guard:
- duplicate audit must pass before unique indexes are created
- index predicates must exclude empty/null normalized values
- any conflict cleanup must be a separate owner-approved data remediation plan

### customer_contacts alignment

Goal:
- add `customer_contacts.store_id` nullable first
- backfill from the owning customer
- verify null count and mismatch count are zero
- only then consider not-null enforcement or store-scoped unique indexes

Required guard:
- no raw contact value output
- no row samples
- no direct live public write while backfill is running

### timeline payload policy

Goal:
- keep `payload` as the flexible event details object
- keep raw phone, email, and name-like keys out of payload
- add `source`, `summary`, and `occurred_at` only if first-class filtering and ordering are required

Required guard:
- timeline remains append-only
- no status update or customer event write during this plan PR

### RLS hardening

Goal:
- review policy predicates for `customers`, `customer_contacts`, `inquiries`, and `customer_timeline_events`
- require store membership for merchant reads and writes
- avoid authorization through user-editable metadata
- keep public intake behind server-owned endpoints unless a separate public insert policy is approved

Required guard:
- policy SQL is not included in this PR
- RLS policy apply is not executed

### grants hardening

Goal:
- reduce broad role privileges before live customer-memory writes
- separate table reachability grants from RLS row visibility
- document exact `anon` and `authenticated` access needed for server/public/admin flows

Required guard:
- GRANT/REVOKE is not executed
- grant SQL must be reviewed in a separate migration/security PR

## Apply Phases

### Phase A: index/constraint readiness

Purpose:
- verify no duplicate store/contact conflicts exist
- verify `customer_contacts.store_id` can be backfilled without orphaned contacts
- decide whether the unique contact indexes can be created in the same migration or require a separate cleanup PR

Exit criteria:
- duplicate audit count-only evidence passes
- null/mismatch contact scope evidence passes
- rollback window approved
- live customer memory gates remain disabled

### Phase B: adapter compatibility

Purpose:
- confirm the production adapter can read and write through both pre-alignment and post-alignment schema shapes
- preserve masking/redaction behavior
- keep app-level dedupe aligned with DB uniqueness

Exit criteria:
- customer memory adapter tests pass
- public intake tests pass
- inquiry inbox read-model tests pass
- no raw PII appears in logs or payloads

### Phase C: RLS/grant hardening

Purpose:
- align target-table policies and grants with store membership and least privilege
- keep public intake write path server-owned unless explicitly approved otherwise

Exit criteria:
- policy body review complete
- grant matrix approved
- RLS tests pass for owner/staff/non-member/public cases
- no GRANT/REVOKE is executed without a dedicated approval

### Phase D: canary write

Purpose:
- run one owner-approved test-store customer-memory canary after schema/RLS/grant apply is complete

Canary write status: `BLOCKED_PENDING_OWNER_APPROVAL`

Required gates:
- `broadDbWriteEnabled=false` remains false until owner approval
- `liveCustomerMemoryWriteEnabled=false` remains false until owner approval
- `liveLeadWriteEnabled=false` remains false
- no customer notification is sent
- no real customer/lead production row is created by this PR

## Risk Table

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Duplicate normalized contacts | unique index creation can fail or collapse the wrong customer if duplicate evidence is unresolved | run count-only duplicate audit before apply; resolve conflicts in a separate data remediation approval |
| Backfill write risk | `customer_contacts.store_id` backfill is DML and touches production rows | run only in an approved apply window with backup/rollback plan |
| Broad role grants | table reachability may exceed intended CRM access even with RLS enabled | separate grant hardening phase; verify Data API exposure and least privilege |
| RLS predicate gap | live writes may silently fail or expose cross-store rows if predicates are wrong | review policy bodies and run store isolation tests before live write |
| Adapter/schema drift | adapter may map fields differently before and after schema alignment | require adapter compatibility tests across both shapes |
| Timeline payload leakage | payload can accidentally store raw PII | keep redaction tests and safe payload allowlist before any live write |

## Rollback Plan

Source rollback:
- revert the plan PR if the proposed sequencing is rejected.
- revert the future migration PR if it is not yet applied.

Pre-apply rollback:
- no production DB rollback is needed because this plan PR performs no DB mutation.

Post-apply rollback for a future approved migration:
- stop live customer-memory gates first.
- if only indexes were added, drop the new indexes in a separately reviewed rollback SQL.
- if nullable columns were added, leave them in place unless they break production paths; dropping columns is higher risk and should be avoided unless explicitly approved.
- if backfill caused incorrect scope data, restore from approved backup or run a reviewed corrective DML script that does not output raw contact values.
- do not use migration repair as rollback unless separately approved.

## Approval Checklist

Before any controlled apply:

- [ ] Owner approves moving from plan-only to apply.
- [ ] Baseline marker adoption decision is resolved.
- [ ] Active migration state is intentional and documented.
- [ ] Duplicate contact audit is complete without raw value output.
- [ ] Backfill null/mismatch risk is quantified.
- [ ] RLS predicate review is complete.
- [ ] Grant matrix is approved.
- [ ] Rollback window and backup posture are approved.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, and targeted customer-memory tests pass.
- [ ] Vercel preview is green.
- [ ] live write gates remain disabled during migration apply.
- [ ] Canary write is separately approved after schema/RLS/grant apply.

## Forbidden Operations

Forbidden in this PR:

- production DB write
- `npx supabase migration repair`
- `npx supabase db push`
- `npx supabase migration up`
- SQL replay
- RLS policy apply
- GRANT/REVOKE
- live customer memory write
- live lead write
- env/auth/payment/webhook changes
- customer or lead production row creation
- raw PII output
- sales Excel import work
- PR #106 merge
- manual deploy
- stash deletion
- protected untracked cleanup

## Decision

Recommended strategy: `MIXED_REPAIR_AND_CONTROLLED_APPLY_REQUIRED`

Reason:
- baseline marker metadata adoption is blocked while the draft migration remains active as a later local-only migration
- adapter-first compatibility is useful but not enough for live PRO/VIP persistence
- the schema alignment draft contains one DML backfill and DB-level uniqueness work that require controlled apply approval
- RLS/grant hardening must be separated from schema alignment and explicitly approved

## Business Impact

User problem solved:
- Maintainers get a concrete, phase-gated path from customer-memory prototype to safe PRO/VIP CRM persistence.

Revenue path supported:
- The plan protects customer memory, inquiry follow-up, AI reports, and VIP automation from launching before store isolation and privacy controls are ready.

Data that can be collected after separate approval:
- duplicate counts, null/mismatch counts, schema apply evidence, RLS/grant verification, and a test-store canary result. This PR collects no customer, lead, contact, message, or payment row data.

Remaining before production launch:
- approve or defer baseline marker adoption
- approve or revise the draft schema migration
- approve RLS/grant hardening
- approve test-store customer memory canary write

## Side Effects

```json
{
  "production_db_write": false,
  "migration_apply": false,
  "db_push": false,
  "migration_repair": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "live_customer_memory_write": false,
  "live_lead_write": false,
  "live_ai_trace_write": false,
  "live_background_job_execution": false,
  "live_public_page_event_write": false,
  "live_feedback_record_write": false,
  "env_auth_payment_webhook_changed": false,
  "external_api_called": false,
  "customer_notification_sent": false,
  "raw_pii_output": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "manual_deploy": false,
  "stash_deleted": false,
  "protected_untracked_touched": false
}
```
