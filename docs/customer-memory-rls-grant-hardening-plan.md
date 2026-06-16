# Customer Memory RLS/Grant Hardening Apply Plan

Status: `PLAN_ONLY_DRAFT_SQL_NOT_EXECUTED`

Recommended next decision: `APPROVAL_GATED_HARDENING_APPLY_BEFORE_LIVE_WRITE`

This plan converts PR #118 RLS/grant evidence into a concrete hardening SQL draft. It does not execute RLS policy apply, `GRANT`, `REVOKE`, migration apply, db push, SQL replay, production DB write, production schema change, or live-write enablement.

## Source Evidence

PR #118 found that customer-memory target tables have RLS enabled, but the launch blocker remains broad table privileges and broad public/ALL policies:

- primary blocker: `BLOCKED_BROAD_ANON_GRANT`
- secondary blocker: `BLOCKED_BROAD_AUTHENTICATED_GRANT`
- secondary blocker: `BLOCKED_UNEXPECTED_PRIVILEGE`

Migration history before this plan:

| Version | Expected remote state | Meaning |
| --- | --- | --- |
| `20260614` | applied | production baseline marker |
| `20260615075421` | applied | customer-memory schema alignment |

Live gates remain disabled:

- `broadDbWriteEnabled=false`
- `liveCustomerMemoryWriteEnabled=false`
- `liveLeadWriteEnabled=false`
- `liveAiTraceWriteEnabled=false`
- `liveBackgroundJobExecutionEnabled=false`
- `livePublicPageEventWriteEnabled=false`
- `liveFeedbackRecordWriteEnabled=false`

## Scope

Target tables:

- `customers`
- `customer_contacts`
- `inquiries`
- `customer_timeline_events`

Related objects:

- `stores`
- `store_members`
- `store_subscriptions`
- `profiles`
- `lead_capture_requests`
- helper function: `is_store_member`

Related tables are not directly rewritten by this draft except where the helper predicate depends on `store_members`. `lead_capture_requests` remains a separate lead-capture gate and is not mixed into customer-memory live-write approval.

## Current Risk Summary

| Target table | Current anon/public risk | Current authenticated risk | Service role expectation | DELETE/TRUNCATE/REFERENCES/TRIGGER exposure | Hardening decision |
| --- | --- | --- | --- | --- | --- |
| `customers` | broad direct table privileges with public/ALL policy | broad direct table privileges with public/ALL policy | server-only trusted role, not browser-exposed | remove for `anon` and `authenticated`; justify service-only if retained | grant authenticated `SELECT`, `INSERT`, `UPDATE` only; store-scoped policies |
| `customer_contacts` | broad direct table privileges with public/ALL policy | broad direct table privileges with public/ALL policy | server-only trusted role, not browser-exposed | remove for `anon` and `authenticated`; justify service-only if retained | grant authenticated `SELECT`, `INSERT`, `UPDATE` only; require customer/store consistency |
| `inquiries` | broad direct table privileges with public/ALL policy | broad direct table privileges with public/ALL policy | server-only trusted role, not browser-exposed | remove for `anon` and `authenticated`; justify service-only if retained | grant authenticated `SELECT`, `INSERT`, `UPDATE` only; store/customer predicate |
| `customer_timeline_events` | broad direct table privileges with public/ALL policy | broad direct table privileges with public/ALL policy | server-only trusted role, not browser-exposed | remove for `anon` and `authenticated`; justify service-only if retained | grant authenticated `SELECT`, `INSERT`, `UPDATE` only; append/update scoped by store/customer predicate |

## Target Security Model

Anon/public:

- no direct customer-memory table privileges
- no helper function execute path unless a separate public RPC design is approved
- public intake continues through reviewed server routes only

Authenticated:

- `SELECT`, `INSERT`, and `UPDATE` only on target tables
- no `DELETE`
- no `TRUNCATE`
- no `REFERENCES`
- no `TRIGGER`
- all policies are command-specific and scoped through store membership

Service role:

- remains server-only
- must not be used in browser/client code
- high privilege is acceptable only for trusted server/admin operations and must be covered by secret handling checks

Helper function:

- `is_store_member` exposure is reduced by revoking `EXECUTE` from `PUBLIC` and `anon`
- `authenticated` keeps execute because policy predicates depend on it
- future hardening can move the helper out of `public` if an approved function migration covers compatibility

## Policy Replacement Plan

Current broad `public`/`ALL` policies are replaced with command-specific `authenticated` policies:

- `customers_select_store_member`
- `customers_insert_store_member`
- `customers_update_store_member`
- `customer_contacts_select_store_member`
- `customer_contacts_insert_store_member`
- `customer_contacts_update_store_member`
- `inquiries_select_store_member`
- `inquiries_insert_store_member`
- `inquiries_update_store_member`
- `customer_timeline_events_select_store_member`
- `customer_timeline_events_insert_store_member`
- `customer_timeline_events_update_store_member`

No DELETE policies are proposed for the MVP.

Predicate design:

- `customers`: `store_id` must satisfy `is_store_member(store_id)`.
- `customer_contacts`: `store_id` must be present and match the linked `customers.store_id`; the linked customer store must satisfy `is_store_member`.
- `inquiries`: `store_id` must satisfy `is_store_member`; if `customer_id` exists, it must link to a customer in the same store.
- `customer_timeline_events`: `store_id` must satisfy `is_store_member`; `customer_id` must link to a customer in the same store.

## SQL Draft

Draft migration file:

- `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql`

Status: `PROPOSAL_ONLY_NOT_EXECUTED`

The SQL draft is intentionally stored as a reviewable migration draft. It must not be applied from this PR. A separate owner approval must explicitly authorize RLS policy apply and `GRANT/REVOKE` execution.

SQL draft summary:

- revokes broad privileges from `public` and `anon` on target tables
- revokes broad authenticated privileges, then grants authenticated `SELECT`, `INSERT`, and `UPDATE`
- does not grant authenticated `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`
- restricts `is_store_member(uuid)` execute from `PUBLIC` and `anon`
- drops the existing broad member-access policies
- creates command-specific `authenticated` policies
- keeps service role as server-only expectation rather than a merchant-facing access path

Explicitly forbidden in this PR:

- RLS policy apply
- `GRANT/REVOKE`
- `npx supabase db push`
- `npx supabase migration up`
- `npx supabase migration apply`
- `npx supabase migration repair`
- SQL replay
- production DB write
- production schema change
- live customer-memory write
- live lead write

## Rollback Plan

Rollback also requires separate approval. Do not auto-rollback by running SQL from this PR.

Pre-state snapshot required before any future apply:

- target table privileges for `public`, `anon`, `authenticated`, and `service_role`
- target table policy names, commands, roles, `USING`, and `WITH CHECK`
- `is_store_member(uuid)` function owner, schema, security mode, search path, and execute grants
- count-only row counts for `customers`, `customer_contacts`, `inquiries`, and `customer_timeline_events`
- admin read smoke result while all live write gates remain disabled

Rollback SQL draft is included at the bottom of `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql` as comments. The rollback draft:

- drops the proposed command-specific policies
- recreates the previous broad member-access policy shape
- restores previous helper execute exposure
- restores previous broad direct grants for `public`, `anon`, and `authenticated`

Rollback trigger criteria:

- owner/admin dashboard cannot read scoped customer-memory records after apply
- store-member predicate blocks valid owner/member access
- server-only path unexpectedly loses required service-role capability
- post-apply evidence differs from the reviewed hardening model

Rollback guardrails:

- keep `broadDbWriteEnabled=false`
- keep `liveCustomerMemoryWriteEnabled=false`
- do not create, modify, or delete business rows during rollback validation
- collect catalog/count-only evidence after rollback

## Canary Prerequisite Checklist

- [ ] Hardening SQL reviewed and approved in a separate apply window.
- [ ] Pre-state snapshot captured.
- [ ] Hardening apply completed without `db push`.
- [ ] Fresh read-only evidence confirms target grants and policies.
- [ ] No direct `anon` grants remain on target customer-memory tables.
- [ ] Authenticated has no `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` on target tables.
- [ ] Helper function `PUBLIC` and `anon` execute exposure is removed or explicitly justified.
- [ ] Admin read smoke passes for owner/member scoped views.
- [ ] Store isolation checks pass for read, insert, and update predicates.
- [ ] Raw PII logging scan passes.
- [ ] Live customer-memory write canary is separately approved.
- [ ] Test-store canary creates at most one approved test customer-memory record.

## Launch Gate Criteria

Live customer-memory write remains blocked until:

- hardening apply is complete
- post-hardening evidence passes
- owner/admin read smoke passes
- test-store canary is explicitly approved
- rollback plan remains ready
- `broadDbWriteEnabled` and `liveCustomerMemoryWriteEnabled` are changed only under separate approval

## Operator Notes

The draft follows Supabase/Postgres RLS least-privilege mechanics: table privileges and RLS policies both matter. Supabase has also been tightening exposed-schema defaults over time, so this plan avoids broad public exposure before live customer-memory persistence. Current changelog reference used during planning: https://supabase.com/changelog.

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
  "rls_grant_hardening_plan_created": true
}
```
