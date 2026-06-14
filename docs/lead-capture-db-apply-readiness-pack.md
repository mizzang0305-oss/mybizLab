# Lead Capture DB Apply Readiness Pack

Status: read-only evidence pack for PR #101. This document does not approve or execute production migration apply, RLS policy apply, GRANT/REVOKE, live lead writes, live customer memory writes, deploys, env/auth changes, payment/webhook changes, customer notifications, or external API mutations.

Baseline:
- Repository: `mizzang0305-oss/mybizLab`
- Main HEAD: `43cb2d7170e9eee2c6b56e4c5af90c4778892768`
- PR #100: merged
- Production auto deploy: READY
- Evidence timestamp: 2026-06-14 KST
- Evidence method: Supabase read-only catalog/count queries only
- PII posture: no row samples, no `select *`, no customer name/phone/email/message/memo output

## Supabase Safety Model

Supabase Data API access is controlled by both table grants and RLS policies. Grants determine whether roles such as `anon` and `authenticated` can reach the table, and RLS determines which rows those roles can see or mutate. The current readiness gate therefore checks both grants and RLS before any write path can be approved.

Reference:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security

Relevant changelog:
- Supabase is changing default Data API exposure behavior for new public tables, but existing tables retain current grants until changed. This increases the need to record explicit grants before applying or enabling writes.
- https://supabase.com/changelog?tags=breaking-change

## Read-Only Evidence Summary

Current production DB evidence shows that `public.lead_capture_requests` already exists and already has the intended canonical table posture. This means the next approval should not be framed as a blind first-time migration apply.

| Evidence | Result |
| --- | --- |
| table exists | `public.lead_capture_requests` exists |
| row_count | `0` |
| RLS | enabled |
| delete policy count | `0` |
| migration history table | `supabase_migrations.schema_migrations` not visible via read-only evidence |
| Supabase MCP migration list | empty |
| anon grants | none returned |
| public grants | none returned |
| authenticated grants | `SELECT`, `INSERT`, `UPDATE` only |
| required related tables | `profiles`, `stores`, `store_members`, `store_subscriptions`, `platform_admin_members` all exist |
| required functions | `public.is_store_member(target_store_id uuid) returns boolean`, `public.set_updated_at() returns trigger` |

## Existing Table Shape

The table currently contains the canonical lead capture columns, including encrypted/masked contact fields. The required canonical columns are all `NOT NULL`:

- `source`
- `status`
- `store_name`
- `business_type`
- `main_concern`
- `desired_outcome`
- `data_readiness`
- `consent_marketing`
- `consent_contact`
- `created_at`
- `updated_at`

The null-count check for those required columns returned `0`.

Foreign key target evidence:
- `lead_capture_requests.store_id -> stores.store_id`
- `lead_capture_requests.owner_profile_id -> profiles.id`
- `stores.store_id` is the primary key.
- `profiles.id` is the primary key.
- `platform_admin_members.profile_id` is unique and references `profiles.id`.
- `store_members.store_id` references `stores.store_id`.
- `store_members.profile_id` references `profiles.id`.

Indexes present:
- `lead_capture_requests_pkey`
- `lead_capture_requests_store_idx`
- `lead_capture_requests_status_idx`
- `lead_capture_requests_owner_profile_idx`

Trigger present:
- `trg_lead_capture_requests_set_updated_at` before update, executes `set_updated_at()`

Policies present:
- `lead_capture_requests_platform_admin_select`
- `lead_capture_requests_platform_admin_insert`
- `lead_capture_requests_platform_admin_update`
- `lead_capture_requests_store_member_select`
- `lead_capture_requests_store_member_update`

No DELETE policy is present.

## Migration Apply Readiness Decision

Current decision: `BLOCKED_STANDARD_MIGRATION_APPLY`.

Reason:
- The production table already exists with the intended canonical shape.
- The production migration history exposed to the read-only checks is empty.
- Running `supabase/migrations/20260609_lead_capture_requests.sql` as a normal migration would not be a pure read-only or no-op action. Even though much of the SQL is idempotent, it still contains DDL and policy/trigger replay operations:
  - `alter table`
  - `update public.lead_capture_requests`
  - `drop trigger if exists`
  - `create trigger`
  - `alter table ... enable row level security`
  - `drop policy if exists`
  - `create policy`
- With `row_count = 0`, the data mutation branch would affect no lead rows, but the command is still a production DB write operation and requires separate approval.

The safe next approval should be a migration-history reconciliation or controlled apply decision, not an automatic apply.

## Apply SQL Artifact

The only reviewed apply SQL artifact is:

- `supabase/migrations/20260609_lead_capture_requests.sql`

Do not copy or execute this SQL from the PR #101 readiness pack. The file is retained as the canonical reviewed migration draft, but production evidence now shows the target table shape already exists while migration history is not visible. Any future apply path must start from fresh read-only evidence and separate owner approval.

## Apply Path Options

No command in this section is approved by this PR.

Option A: migration history reconciliation, preferred if supported by the approved Supabase workflow.
- Reconfirm the live schema with fresh read-only evidence.
- Confirm `supabase/migrations/20260609_lead_capture_requests.sql` exactly matches the already-present production objects.
- Discover the current Supabase CLI migration repair/mark-applied workflow with `supabase migration --help`.
- If owner-approved, record the migration as applied without replaying DDL against production.
- If the tool cannot safely record history without executing SQL, stop.

Option B: controlled idempotent apply, higher risk.
- Reconfirm fresh evidence immediately before apply:
  - row_count remains `0`
  - no `anon` or `public` grants
  - authenticated grants are only `SELECT`, `INSERT`, `UPDATE`
  - RLS enabled
  - no DELETE policy
  - related tables/functions remain present
  - required columns remain `NOT NULL`
- Obtain explicit owner approval for production migration apply.
- Apply only during a maintenance window.
- Watch for DDL errors caused by already-existing policies/triggers/constraints.
- Do not combine this with RLS policy redesign, grant changes, or live-write enablement.

Option C: defer apply and keep production posture as-is.
- Keep migration file as repo documentation and future baseline.
- Keep live lead writes disabled.
- Revisit history reconciliation before live-write approval.

## Rollback / Mitigation Plan

Do not run rollback SQL from this PR.

If an approved future apply fails before live writes are enabled:
- Stop immediately.
- Run only read-only evidence queries to determine partial state.
- Do not drop `public.lead_capture_requests` if `row_count > 0`.
- If `row_count = 0` and owner explicitly approves, repair DDL can be considered in a separate hotfix/runbook.
- Restore expected RLS/grant posture only with explicit owner approval.
- Keep `leadCapturePersistenceEnabled`, `liveLeadWriteEnabled`, and `broadDbWriteEnabled` OFF until evidence and smoke pass.

If a future apply succeeds:
- Run the read-only evidence pack again.
- Confirm table/columns/constraints/indexes/RLS/policies/grants/triggers/row_count.
- Confirm no customer/lead row data was created by the migration.
- Do not enable live writes in the same step.

## Live Write Gate Status

Source evidence from `src/shared/lib/launchGates.ts`:
- `broadDbWriteEnabled: false`
- `leadCapturePersistenceEnabled: false`
- `liveLeadWriteEnabled: false`

Lead repository evidence:
- `resolveLeadCaptureWriteGate` blocks in this order:
  1. `broadDbWriteEnabled`
  2. `leadCapturePersistenceEnabled`
  3. `liveLeadWriteEnabled`
- A Supabase insert is only reachable after all three gates are true.

Customer memory repository evidence:
- customer memory writes require `broadDbWriteEnabled` and explicit `allowCustomerMemoryWrites`.
- Those approvals are not changed by this PR.

## Read-Only Evidence Queries Used

The executed evidence set used only `select` statements against:
- `information_schema.tables`
- `information_schema.columns`
- `information_schema.table_constraints`
- `information_schema.key_column_usage`
- `information_schema.constraint_column_usage`
- `information_schema.role_table_grants`
- `information_schema.triggers`
- `pg_indexes`
- `pg_class`
- `pg_namespace`
- `pg_policies`
- `pg_proc`
- `to_regclass('supabase_migrations.schema_migrations')`
- `count(*)` on `public.lead_capture_requests`

No row samples were selected.

## Final Readiness

| Gate | Decision |
| --- | --- |
| PR #101 docs/tests | READY for Draft PR |
| production migration apply | BLOCKED until separate owner approval |
| migration history reconciliation | NEEDS separate owner approval |
| RLS policy apply/change | BLOCKED |
| GRANT/REVOKE | BLOCKED |
| live lead write enablement | BLOCKED |
| live customer memory write | BLOCKED |
| production deploy | NOT INCLUDED |
