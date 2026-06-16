# Customer Memory Test-Store Canary Plan

Status: `DRAFT_PR_PLAN_ONLY`

Branch: `codex/customer-memory-test-store-canary-plan`

origin/main expected HEAD: `042f34c01e127a1ea26a4d4cfda331fda0d8c214`

Merged prerequisite: PR #122 post-repair RLS/grant evidence

This plan defines the owner-approval checklist for one bounded customer-memory persistence canary. This PR does not execute a production DB write, API write call, live gate enablement, test inquiry save, or environment change.

## Current Baseline

Applied local/remote migrations:

| Version | Migration | State |
| --- | --- | --- |
| `20260614` | `20260614_production_baseline_adoption.sql` | local and remote applied |
| `20260615075421` | `20260615075421_customer_memory_schema_alignment.sql` | local and remote applied |
| `20260616070824` | `20260616070824_customer_memory_rls_grant_hardening.sql` | local and remote applied |

PR #122 evidence baseline:

- target tables with RLS enabled: `customers`, `customer_contacts`, `inquiries`, `customer_timeline_events`
- expected authenticated command-specific policies: 12/12
- legacy public/ALL policies: 0
- public/anon direct grants: 0
- authenticated privileges: `INSERT`, `SELECT`, `UPDATE`
- authenticated destructive grants: 0

Live gates remain disabled:

- `broadDbWriteEnabled=false`
- `liveCustomerMemoryWriteEnabled=false`
- `liveLeadWriteEnabled=false`
- `liveAiTraceWriteEnabled=false`
- `liveBackgroundJobExecutionEnabled=false`
- `livePublicPageEventWriteEnabled=false`
- `liveFeedbackRecordWriteEnabled=false`

## Test Store Candidate Decision

Test store decision: `OWNER_TEST_STORE_REQUIRED`

Production DB lookup mode: `NOT_RUN_NO_OWNER_APPROVAL`

Repo-local demo seed candidates exist, but no production test store alias or `store_id` is selected by this PR. The repo-local evidence is enough to prove that MyBiz has demo-store concepts for local scenarios; it is not enough to authorize a production canary target. Do not create a new store from this PR.

Allowed future lookup mode after owner approval:

- count-only or catalog-only lookup scoped to candidate test/demo/internal stores
- explicit column allowlist such as store id, store alias, non-customer test marker, and count aggregates
- no customer, contact, inquiry, timeline, visitor, feedback, payment, or lead row samples

Forbidden lookup behavior:

- `SELECT *`: forbidden
- raw customer/PII output: forbidden
- actual customer row samples: forbidden
- creating a new test store: forbidden

## Canary Scope

The canary scope is intentionally narrow:

- test store count: exactly 1 owner-approved store
- synthetic customer/inquiry count: exactly 1
- real customer name, phone, or email: forbidden
- external message, notification, payment, or webhook: forbidden
- sales Excel import and PR #106: forbidden
- production write window: one owner-approved run only
- stop condition: any unexpected row count delta, raw PII exposure, cross-store read, gate mismatch, or Vercel protection block

## Synthetic Payload

The payload must use only non-PII synthetic markers:

- marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`
- store id: owner-approved test `store_id` only
- customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`
- phone: `OMITTED_NOT_REAL_NUMBER`
- email: `OMITTED_NOT_REAL_EMAIL`
- inquiry source: `customer_memory_canary`
- message: `Non-PII customer-memory canary inquiry for approved test store only.`
- summary: `Synthetic canary summary; no real customer data.`
- timeline summary: `Synthetic canary write verified for approved test store.`
- raw PII values: forbidden

The approved payload must be copied into the execution issue or runbook before any write is attempted. If any field needs a real customer identifier, stop; the canary is not approved.

## Planned Write Path

Selected planned write path: server customer-memory adapter path

Planned implementation surface for the future owner-approved run:

- `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`
- `saveCustomer`
- `saveCustomerContact`
- `saveInquiry`
- `appendTimelineEvent`

The public inquiry intake route is not selected for this canary plan because its normal workflow can append more timeline events than this canary allows. The server adapter path can run the explicit one-shot sequence with the requested row limits.

Gate plan for the future approved run:

- `customerMemorySpineEnabled` remains true
- `broadDbWriteEnabled` requires owner-approved scoped enablement for the canary run
- `liveCustomerMemoryWriteEnabled` requires owner-approved scoped enablement for the canary run
- `liveLeadWriteEnabled` remains false unless separately approved
- `liveAiTraceWriteEnabled`, `liveBackgroundJobExecutionEnabled`, `livePublicPageEventWriteEnabled`, and `liveFeedbackRecordWriteEnabled` remain false

This PR makes no runtime change:

- Gate changes in this PR: `forbidden`
- API write call in this PR: `forbidden`
- Env changes in this PR: `forbidden`
- payment, webhook, auth, and session changes in this PR: `forbidden`

## Expected DB Effect

Approved execution must compare pre-counts and post-counts for every target table:

| Table | Maximum approved effect |
| --- | --- |
| `customers` | `customers` upsert: at most 1 row |
| `customer_contacts` | `customer_contacts` upsert: at most 1 row |
| `inquiries` | `inquiries` insert: at most 1 row |
| `customer_timeline_events` | `customer_timeline_events` insert: at most 1-2 rows |

Count rules:

- pre-count and post-count comparison is required for all four target tables
- stop if any count delta exceeds the approved maximum
- stop if any table outside the four target tables changes
- stop if any lead, visitor, feedback, payment, webhook, or notification row changes
- do not print raw row data while comparing counts

## Read-Back Verification Plan

Read-back must be sanitized and store-scoped:

- customer card: masked/sanitized customer marker only
- inquiry inbox: redacted summary only
- timeline: non-PII summary only
- raw phone/email/name output: forbidden
- store isolation: verify only the approved test store can read the canary rows
- non-member or wrong-store read path must not return the canary rows
- row identity check must use the marker plus approved test `store_id`

Allowed read-back paths after owner approval:

- admin customer list or customer-detail read model for the approved test store
- admin inquiry inbox read model for the approved test store
- admin timeline/customer detail view for the approved test store
- count-only SQL checks with explicit column allowlists

If admin read smoke returns Vercel protection 401, stop without bypass or secret and record separate access required.

## Rollback And Cleanup Plan

Canary row identity: marker plus owner-approved test `store_id`

Cleanup is not automatic. If cleanup is needed:

- cleanup requires separate owner approval
- direct DELETE execution in this PR: forbidden
- rollback/cleanup execution remains approval-gated
- cleanup must target only rows carrying the approved marker and approved test `store_id`
- cleanup must have its own pre-count, post-count, and sanitized read-back evidence

Do not restore broad grants, public policies, or live gates as a rollback shortcut. Reverting this docs/tests-only PR requires only a source revert.

## Owner Approval Checklist

Before any canary write, the owner must approve:

- approve test store alias or `store_id`
- approve synthetic payload
- approve server adapter write path
- approve live gate enable scope
- approve expected row-count limits
- approve read-back routes
- approve stop conditions
- approve cleanup posture and whether rows remain as audit evidence
- confirm no customer notification, payment, webhook, external AI call, or sales Excel work is in scope

Approval should name the exact branch/commit or deployment target used for execution. If the target is not explicit, stop.

## Validation Checklist

Required before this PR can move beyond Draft:

- `git diff --check`
- `git diff --cached --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- targeted canary-plan test
- staged secret/PII scan
- Vercel preview checks, if a preview URL is created by the platform

This PR must remain Draft. Ready conversion, merge, manual deploy, Supabase `db push`, migration repair/up/apply, SQL replay, and production writes are not part of this task.

## Business Output

User problem solved:

- gives the operator a concrete approval checklist for proving customer-memory persistence with one bounded test-store canary

Revenue path supported:

- unlocks the next PRO/VIP customer-memory readiness gate without risking real customer data or payment/webhook side effects

Data that can be collected after approval:

- count-only deltas for the four customer-memory target tables
- sanitized customer card, inquiry inbox, and timeline read-back evidence for the synthetic marker
- store-isolation pass/fail evidence

Remaining before production launch:

- owner-selected test store
- owner-approved synthetic payload
- owner-approved scoped gate enablement
- one canary execution with sanitized evidence
- cleanup decision or approved retained-audit-row decision
- final launch approval after canary evidence review

## Forbidden Operations In This PR

- production DB write
- live customer memory write enablement
- live lead write enablement
- RLS policy apply
- `GRANT`
- `REVOKE`
- `npx supabase db push`
- `npx supabase migration repair`
- `npx supabase migration up`
- `npx supabase migration apply`
- SQL replay
- actual customer, lead, visitor, or feedback row creation
- actual phone, email, or customer-name value usage
- raw PII output
- external notification, SMS, email, or webhook call
- env/auth/payment/webhook change
- sales Excel import work
- PR #106 merge
- manual deploy
- stash deletion
- protected untracked cleanup

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
  "test_store_canary_plan_created": true
}
```
