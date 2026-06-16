# Customer Memory Post-Repair RLS/Grant Evidence

Status: `DRAFT_PR_EVIDENCE_ONLY`

Decision: `POST_REPAIR_RLS_GRANT_EVIDENCE_READY`

This document refreshes production read-only evidence after the metadata-only repair for `20260616070824_customer_memory_rls_grant_hardening.sql`. It is the last security evidence pack before a separately approved test-store canary write. This PR does not execute RLS policy apply, `GRANT`, `REVOKE`, migration apply, db push, migration repair, SQL replay, production DB write, production schema change, or live-write enablement.

## Scope

Repository target:

- repo: `mizzang0305-oss/mybizLab`
- branch: `codex/customer-memory-post-repair-rls-grant-evidence`
- evidence target: post-repair RLS/grant state for customer-memory persistence
- target tables: `customers`, `customer_contacts`, `inquiries`, `customer_timeline_events`
- helper function: `is_store_member(target_store_id uuid)`

Live gates remain disabled:

- `broadDbWriteEnabled=false`
- `liveCustomerMemoryWriteEnabled=false`
- `liveLeadWriteEnabled=false`
- `liveAiTraceWriteEnabled=false`
- `liveBackgroundJobExecutionEnabled=false`
- `livePublicPageEventWriteEnabled=false`
- `liveFeedbackRecordWriteEnabled=false`

Evidence rules:

- `SELECT *` was not used.
- Row samples were not collected.
- Raw customer, contact, inquiry, timeline, or message values were not collected.
- Raw PII, secrets, tokens, DB passwords, and connection strings were not output.
- Evidence is limited to migration-list metadata, catalog metadata, policy summaries, grant summaries, helper-function metadata, and count-only aggregates.

## Migration History State

`npx supabase migration list --linked` returned:

| Version | Local | Remote | State |
| --- | --- | --- | --- |
| `20260614` | yes | yes | `20260614_production_baseline_adoption.sql` remote applied |
| `20260615075421` | yes | yes | `20260615075421_customer_memory_schema_alignment.sql` remote applied |
| `20260616070824` | yes | yes | `20260616070824_customer_memory_rls_grant_hardening.sql` remote applied |

Post-repair migration history decision:

- all active local migrations are represented remotely
- no local-only migration drift was observed
- no remote-only migration drift was observed
- no migration repair is proposed or executed in this PR

## Table RLS/Grant Matrix

Count-only row state:

| Table | Row count |
| --- | ---: |
| `customers` | 82 |
| `customer_contacts` | 89 |
| `inquiries` | 0 |
| `customer_timeline_events` | 114 |

RLS and grant state:

| Table | RLS enabled | Policy count | Legacy public/ALL policy count | `public` direct grant count | `anon` direct grant count | `authenticated` privileges | Auth destructive grant count | `service_role` expectation |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| `customers` | true | 3 | 0 | 0 | 0 | `INSERT`, `SELECT`, `UPDATE` | 0 | server-only elevated role retains full internal privileges |
| `customer_contacts` | true | 3 | 0 | 0 | 0 | `INSERT`, `SELECT`, `UPDATE` | 0 | server-only elevated role retains full internal privileges |
| `inquiries` | true | 3 | 0 | 0 | 0 | `INSERT`, `SELECT`, `UPDATE` | 0 | server-only elevated role retains full internal privileges |
| `customer_timeline_events` | true | 3 | 0 | 0 | 0 | `INSERT`, `SELECT`, `UPDATE` | 0 | server-only elevated role retains full internal privileges |

Destructive privilege summary:

- authenticated `DELETE`: absent
- authenticated `TRUNCATE`: absent
- authenticated `REFERENCES`: absent
- authenticated `TRIGGER`: absent
- tables with authenticated destructive grants: 0

## Policy Summary

Expected command-specific authenticated policy count: 12.

Observed matching command-specific authenticated policy count: 12.

| Table | SELECT policy | INSERT policy | UPDATE policy |
| --- | --- | --- | --- |
| `customers` | `customers_select_store_member` | `customers_insert_store_member` | `customers_update_store_member` |
| `customer_contacts` | `customer_contacts_select_store_member` | `customer_contacts_insert_store_member` | `customer_contacts_update_store_member` |
| `inquiries` | `inquiries_select_store_member` | `inquiries_insert_store_member` | `inquiries_update_store_member` |
| `customer_timeline_events` | `customer_timeline_events_select_store_member` | `customer_timeline_events_insert_store_member` | `customer_timeline_events_update_store_member` |

Legacy policy check:

- legacy public/ALL policy count: 0
- policy role scope: `authenticated`
- policy commands: `SELECT`, `INSERT`, `UPDATE`

## Helper Function Exposure

Function evidence:

| Function | Exists | Security definer | Search path summary | `public` execute | `anon` execute | `authenticated` execute | `service_role` execute |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `is_store_member(target_store_id uuid)` | true | true | `search_path=public` | false | false | true | true |

Helper function decision:

- execute exposure matches the hardening target
- `public` and `anon` cannot execute the helper
- `authenticated` can execute the helper for RLS membership checks
- `service_role` can execute the helper for server-only operations
- because the helper is `SECURITY DEFINER` in the exposed `public` schema, keep it on the follow-up security review list before broad live-write expansion

## Admin/Public Route Impact

Admin read model readiness:

- `api/admin.ts` continues to use the existing single dispatcher; no new serverless function file is required.
- `customer-memory-inbox`, `customers`, `customer-detail`, and `inquiries` admin resources require a `storeId` parameter before returning customer-memory data.
- admin customer-memory access resolves membership through `store_members` before using the repository.
- the post-repair RLS/grant state supports store-scoped authenticated reads and controlled inserts/updates after a separate live-write approval.

Public inquiry readiness:

- public inquiry intake remains disabled for live production persistence because write gates remain closed.
- `broadDbWriteEnabled=false` blocks broad production writes.
- `liveCustomerMemoryWriteEnabled=false` blocks customer-memory persistence.
- `liveLeadWriteEnabled=false` blocks live lead persistence.
- no public inquiry live write is enabled by this PR.

## Readiness Decision

| Decision | Result | Rationale |
| --- | --- | --- |
| `POST_REPAIR_RLS_GRANT_EVIDENCE_READY` | selected | migration history is aligned and current RLS/grant/helper evidence matches the expected post-hardening state |
| `BLOCKED_MIGRATION_HISTORY_DRIFT` | not selected | all three active migrations are local and remote applied |
| `BLOCKED_LEGACY_PUBLIC_POLICY` | not selected | legacy public/ALL policy count is 0 |
| `BLOCKED_ANON_OR_PUBLIC_GRANT` | not selected | public and anon direct table grant counts are 0 |
| `BLOCKED_AUTHENTICATED_DESTRUCTIVE_GRANT` | not selected | authenticated destructive grant count is 0 |
| `BLOCKED_HELPER_FUNCTION_EXPOSURE` | not selected for this gate | helper execute exposure matches the target; separate security-definer placement review remains advisable |
| `BLOCKED_ADMIN_READ_REGRESSION_RISK` | not selected | admin read models remain store-scoped and current RLS state supports authenticated store-member reads |

## Canary Prerequisites

Before any test-store canary write, owner approval must explicitly cover:

- production write scope, target store, and exact route
- canary row shape and expected rollback path
- `broadDbWriteEnabled` and `liveCustomerMemoryWriteEnabled` gate change plan
- confirmation that `liveLeadWriteEnabled`, `liveAiTraceWriteEnabled`, `liveBackgroundJobExecutionEnabled`, `livePublicPageEventWriteEnabled`, and `liveFeedbackRecordWriteEnabled` remain out of scope unless separately approved
- post-canary read-only evidence refresh
- no customer notification, external AI call, webhook, payment, or sales Excel import side effect

Minimum pre-canary checks:

- migration list still shows all three active migrations remote applied
- RLS remains enabled on all four target tables
- legacy public/ALL policy count remains 0
- public and anon direct table grant counts remain 0
- authenticated destructive grant count remains 0
- helper public/anon execute remains false
- admin customer-memory read smoke remains store-scoped
- public inquiry live persistence remains disabled until explicit gate approval

## Rollback And Stop Conditions

Stop before canary if any of these appear:

- migration history drift returns
- any legacy public/ALL policy appears
- any public or anon direct table grant appears
- authenticated receives `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`
- helper function execute exposure expands to public or anon
- admin read models return cross-store data
- public inquiry persistence can write without explicit live gate approval
- any raw PII, secret, token, DB password, or connection string appears in logs or diffs

Rollback posture:

- this PR performs no production mutation, so no production rollback is needed for this PR
- any future canary rollback must be explicitly approved and should target only the canary row(s)
- do not restore broad public/ALL policies or broad grants as a rollback default
- keep live gates disabled unless owner explicitly approves the canary gate change

## Forbidden Operations In This PR

- RLS policy apply
- `GRANT`
- `REVOKE`
- production DB write
- production schema change
- `npx supabase db push`
- `npx supabase migration repair`
- `npx supabase migration up`
- `npx supabase migration apply`
- SQL replay
- live customer-memory write
- live lead write
- live AI trace, background job, public-event, or feedback write
- env/auth/payment/webhook change
- customer/lead/visitor/feedback production row creation
- raw PII output
- secret/token/DB password/connection string output
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
  "post_repair_rls_grant_evidence_created": true
}
```
