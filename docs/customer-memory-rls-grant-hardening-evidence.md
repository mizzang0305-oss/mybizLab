# Customer Memory RLS/Grant Hardening Evidence

Status: `PLAN_ONLY_DRAFT_PR`

Readiness decision: `BLOCKED_BROAD_ANON_GRANT`

Secondary blockers:

- `BLOCKED_BROAD_AUTHENTICATED_GRANT`
- `BLOCKED_UNEXPECTED_PRIVILEGE`

This evidence pack follows the migration-history repairs for:

- `20260614_production_baseline_adoption.sql`: remote applied
- `20260615075421_customer_memory_schema_alignment.sql`: remote applied

This PR does not execute RLS policy apply, `GRANT`, `REVOKE`, migration apply, db push, SQL replay, or live write enablement. It only records catalog/count/aggregate evidence and proposes an approval-gated hardening plan.

## Scope

Required customer-memory tables:

- `customers`
- `customer_contacts`
- `inquiries`
- `customer_timeline_events`

Related tables:

- `stores`
- `store_members`
- `store_subscriptions`
- `profiles`
- `lead_capture_requests`

Evidence mode:

- `SELECT *` was not used.
- Row samples were not collected.
- Raw customer/contact/message values were not collected.
- Raw PII output, secrets, tokens, DB passwords, and connection strings were not collected.
- Evidence is limited to catalog metadata, policy summaries, grant summaries, and count-only aggregates.

Supabase CLI evidence:

- CLI available: `npx supabase --version` returned `2.106.0`.
- `npx supabase db query --help` confirmed `--linked`, `--file`, and `--output json` query support.
- Supabase changelog was fetched on 2026-06-16; no CLI/catalog evidence blocker was identified for this plan-only check.

## Migration History State

| Version | Local | Remote | Decision |
| --- | --- | --- | --- |
| `20260614` | present | applied | baseline marker history aligned |
| `20260615075421` | present | applied | customer-memory schema alignment history aligned |

No unexpected migration drift was observed in `npx supabase migration list --linked`.

## Table RLS Matrix

| Table | Scope | Exists | Row count | RLS enabled | Policy count | Policy command summary | Policy role summary |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `customer_contacts` | required | yes | 89 | yes | 1 | `ALL: 1` | `public` |
| `customer_timeline_events` | required | yes | 114 | yes | 1 | `ALL: 1` | `public` |
| `customers` | required | yes | 82 | yes | 1 | `ALL: 1` | `public` |
| `inquiries` | required | yes | 0 | yes | 1 | `ALL: 1` | `public` |
| `lead_capture_requests` | related | yes | 0 | yes | 5 | `INSERT: 1`, `SELECT: 2`, `UPDATE: 2` | `authenticated` |
| `profiles` | related | yes | 3 | yes | 3 | `INSERT: 1`, `SELECT: 1`, `UPDATE: 1` | `public` |
| `store_members` | related | yes | 7 | yes | 3 | `INSERT: 1`, `SELECT: 1`, `UPDATE: 1` | `public` |
| `store_subscriptions` | related | yes | 1 | yes | 1 | `ALL: 1` | `public` |
| `stores` | related | yes | 6 | yes | 1 | `ALL: 1` | `public` |

RLS is enabled on every required customer-memory table, but current customer-memory policies use role `public` and command `ALL`. Because table grants are broad, RLS alone is not sufficient for live-write approval.

## Policy Name Summary

Required tables:

- `customer_contacts`: `customer_contacts_member_access`
- `customer_timeline_events`: `customer_timeline_events_member_access`
- `customers`: `customers_member_access`
- `inquiries`: `inquiries_member_access`

Related tables:

- `stores`: `stores_member_access`
- `store_members`: `store_members_select_member`, `store_members_insert_member`, `store_members_update_member`
- `store_subscriptions`: `store_subscriptions_member_access`
- `profiles`: `profiles_select_own`, `profiles_insert_own`, `profiles_update_own`
- `lead_capture_requests`: platform-admin and store-member select/insert/update policies

## Grant Risk Matrix

| Table | Anon/public grants | Authenticated grants | Service role grants | Risk |
| --- | --- | --- | --- | --- |
| `customer_contacts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` | same broad set | same broad set | `BLOCKED_BROAD_ANON_GRANT`, `BLOCKED_BROAD_AUTHENTICATED_GRANT` |
| `customer_timeline_events` | broad full table privileges | broad full table privileges | broad full table privileges | `BLOCKED_BROAD_ANON_GRANT`, `BLOCKED_BROAD_AUTHENTICATED_GRANT` |
| `customers` | broad full table privileges | broad full table privileges | broad full table privileges | `BLOCKED_BROAD_ANON_GRANT`, `BLOCKED_BROAD_AUTHENTICATED_GRANT` |
| `inquiries` | broad full table privileges | broad full table privileges | broad full table privileges | `BLOCKED_BROAD_ANON_GRANT`, `BLOCKED_BROAD_AUTHENTICATED_GRANT` |
| `lead_capture_requests` | none observed | `SELECT`, `INSERT`, `UPDATE` | broad full table privileges | acceptable as a separate lead-capture gate; not part of this live customer-memory write approval |
| `profiles` | broad full table privileges | broad full table privileges | broad full table privileges | related-table broad grant risk |
| `store_members` | broad full table privileges | broad full table privileges | broad full table privileges | related-table broad grant risk |
| `store_subscriptions` | broad full table privileges | broad full table privileges | broad full table privileges | related-table broad grant risk |
| `stores` | broad full table privileges | broad full table privileges | broad full table privileges | related-table broad grant risk |

Observed broad privilege set includes:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`
- `REFERENCES`
- `TRIGGER`

`DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` are not required for customer-memory live write MVP. Their presence for `anon` and `authenticated` is an explicit blocker.

## Policy Predicate Risk Summary

Store isolation is structurally possible:

- `customers` has `store_id`.
- `customer_contacts` has `store_id`, `customer_id`, `contact_type`, and `normalized_value`.
- `inquiries` has `store_id` and `customer_id`.
- `customer_timeline_events` has `store_id` and `customer_id`.
- `store_members` has `store_id` and `profile_id`.
- `lead_capture_requests` has `store_id`.

Current predicate shape:

- Required customer-memory tables use `is_store_member(store_id)` or, for `customer_contacts`, a `customer_id -> customers.store_id` membership path.
- This gives a plausible store-scoped predicate path for reads and writes.
- The policy role is still `public`, and required-table command is still `ALL`.
- The helper function `is_store_member(target_store_id uuid)` is `SECURITY DEFINER`, `STABLE`, in schema `public`, with `search_path` set to `public`.
- Function `EXECUTE` is granted to `PUBLIC`, `anon`, `authenticated`, and `service_role`.

Risk interpretation:

- `BLOCKED_POLICY_STORE_SCOPE_GAP` is not the primary blocker because predicates do reference store-scoped membership.
- `BLOCKED_CONTACT_SCOPE_GAP` is not the primary blocker because `customer_contacts` has both direct `store_id` and a customer join path.
- `BLOCKED_UNEXPECTED_PRIVILEGE` remains because broad grants and `PUBLIC` function execute privileges are too permissive for launch.
- Security-definer function placement in exposed `public` schema should be hardened before live write.

## Hardening Recommendation

Keep this sequence separate:

1. Schema alignment: already reflected in production and migration history.
2. RLS/grant hardening: next owner-approved apply window.
3. Live customer-memory write enablement: separate canary approval after hardening evidence passes.

Recommended least-privilege model:

- `anon`: no direct table grants for customer-memory tables. Public intake should go through the existing server route or an explicitly approved RPC/edge route only.
- `authenticated`: store-member scoped `SELECT`, `INSERT`, and limited `UPDATE` only where the application needs it.
- `DELETE`: disabled by default for customer-memory MVP.
- `TRUNCATE`, `REFERENCES`, `TRIGGER`: no direct `anon` or `authenticated` grants.
- `service_role`: server-only. Do not expose in clients. Treat high privileges as expected only for trusted server/admin operations.
- Policy roles: replace broad `public`/`ALL` policies with command-specific `authenticated` policies.
- Predicate helper: move membership helper to a private schema or otherwise restrict function `EXECUTE` from `PUBLIC`/`anon`; keep explicit `search_path`.
- `customer_contacts`: use direct `store_id` for policy checks after backfill, with customer join as a defensive consistency path.
- `lead_capture_requests`: keep separated from customer-memory live-write launch; do not mix lead-capture grants into this approval.

## Proposed SQL Outline

Status: `PROPOSAL_ONLY_NOT_EXECUTED`

The following outline is not a migration file and must not be run from this PR:

```sql
-- Proposal only. Do not execute without explicit owner approval.
-- 1. Revoke broad direct privileges from anon/public/authenticated on customer-memory tables.
-- 2. Recreate command-specific authenticated policies scoped by store membership.
-- 3. Keep DELETE/TRUNCATE/REFERENCES/TRIGGER unavailable to anon/authenticated.
-- 4. Move or restrict the is_store_member helper before live write.
-- 5. Re-run read-only grant/policy evidence, then run a test-store-only canary.
```

Explicitly forbidden in this PR:

- `RLS policy apply`
- `GRANT/REVOKE`
- `npx supabase db push`
- `npx supabase migration up`
- `npx supabase migration apply`
- `npx supabase migration repair`
- `SQL replay`
- production DB write
- production schema change
- live customer memory write

## Rollback Plan

Because this PR is evidence-only, source rollback is a normal revert of this docs/tests PR.

For a future approved hardening apply:

1. Keep `broadDbWriteEnabled=false` and `liveCustomerMemoryWriteEnabled=false` during the apply.
2. Capture pre-apply grants, policies, function privileges, and row counts.
3. Apply only the approved RLS/grant hardening migration.
4. Re-run catalog/count-only evidence.
5. If owner/admin access fails, revert the hardening migration or restore the captured grant/policy set in a separate approved rollback window.
6. Do not enable live write until hardening smoke and canary approval pass.

## Owner Approval Checklist

- [ ] Confirm this PR remains docs/tests-only.
- [ ] Confirm broad grants are accepted as blockers, not launch-ready state.
- [ ] Approve exact hardening SQL in a separate PR/migration.
- [ ] Confirm no direct `anon` grants remain for customer-memory tables after hardening.
- [ ] Confirm authenticated policies are command-specific and store-member scoped.
- [ ] Confirm `is_store_member` function exposure is hardened.
- [ ] Confirm `service_role` remains server-only and is not exposed to browser code.
- [ ] Confirm `broadDbWriteEnabled=false` and `liveCustomerMemoryWriteEnabled=false` during hardening.
- [ ] Confirm live write canary is a separate test-store-only approval.

## Live Write Canary Preconditions

Live customer-memory write remains blocked until all are true:

- RLS/grant hardening PR is merged.
- Fresh read-only evidence shows no broad anon/public grants on customer-memory tables.
- Fresh read-only evidence shows no authenticated `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` grants.
- Store isolation policy checks pass for read, insert, and update.
- Raw PII logging scan passes.
- `broadDbWriteEnabled` and `liveCustomerMemoryWriteEnabled` are changed only in a separately approved canary.
- Canary uses a test store and does not create real customer/lead/visitor/feedback production rows outside the approved test scope.

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
  "rls_grant_hardening_evidence_created": true
}
```
