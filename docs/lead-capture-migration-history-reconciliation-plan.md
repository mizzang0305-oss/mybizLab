# Lead Capture Migration History Reconciliation Plan

Status: read-only reconciliation plan for PR #102. This document does not approve or execute `supabase migration repair`, production migration apply, RLS policy apply, GRANT/REVOKE, live lead writes, live customer memory writes, manual deploys, env/auth changes, payment/webhook changes, customer notifications, or external API mutations.

Baseline:
- Repository: `mizzang0305-oss/mybizLab`
- Origin main HEAD: `ee212ff75fe6307cfc922517f9ba281179b121fc`
- PR #101: merged
- Production deploy: SUCCESS
- Production smoke: PASS
- Evidence timestamp: 2026-06-14 KST
- Evidence method: Supabase MCP migration list plus read-only catalog/count SQL
- PII posture: no row samples, no `select *`, no customer name/phone/email/message/memo output

## Current Supabase CLI / Migration Context

Local environment finding:
- `supabase` CLI is not installed or not on PATH in this Codex environment.
- Because the CLI is unavailable, `supabase migration list --linked` was not executed locally.
- Supabase MCP `_list_migrations` was used as the read-only remote migration-history evidence source.

Official CLI references reviewed:
- `supabase migration list` compares local files in `supabase/migrations` with remote rows in `supabase_migrations.schema_migrations`.
- `supabase migration repair` resolves history drift by marking a version as `applied` or `reverted`.
- Marking a migration as `applied` inserts a row in the migration history table. It does not replay the SQL migration body, but it is still a production metadata write and needs separate approval.

References:
- https://supabase.com/docs/reference/cli/supabase-migration-list
- https://supabase.com/docs/reference/cli/supabase-migration-repair
- https://supabase.com/docs/reference/cli/supabase-db-push

## Local / Remote Migration History Evidence

Local migration file under review:
- `supabase/migrations/20260609_lead_capture_requests.sql`

Local migration version candidate:
- `20260609`

Remote migration history evidence:
- Supabase MCP `_list_migrations`: `[]`
- Read-only catalog check for `supabase_migrations.schema_migrations` or `supabase_migrations.migrations`: no visible migration-history table returned in this evidence set.

Interpretation:
- The production schema appears to contain the target `lead_capture_requests` objects.
- The remote migration history visible to the available tools does not record the local `20260609` migration.
- This is a migration-tracking drift, not evidence that the schema DDL must be replayed.

## Production Schema Evidence

Current production `public.lead_capture_requests` evidence:

| Evidence | Result |
| --- | --- |
| table exists | yes |
| row_count | `0` |
| required columns missing | `0` |
| required columns nullable | `0` |
| RLS | enabled |
| forced RLS | false |
| anon grants | none returned |
| public grants | none returned |
| authenticated grants | `INSERT`, `SELECT`, `UPDATE` |
| DELETE policy | none returned |
| trigger | `trg_lead_capture_requests_set_updated_at` before update executes `set_updated_at()` |
| required functions | `is_store_member(target_store_id uuid) returns boolean`; `set_updated_at() returns trigger` |

Required canonical columns present and `NOT NULL`:
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

Foreign key evidence:
- `lead_capture_requests.store_id -> stores.store_id`
- `lead_capture_requests.owner_profile_id -> profiles.id`

Indexes present:
- `lead_capture_requests_pkey`
- `lead_capture_requests_store_idx`
- `lead_capture_requests_status_idx`
- `lead_capture_requests_owner_profile_idx`

Policies present:
- `lead_capture_requests_platform_admin_insert`
- `lead_capture_requests_platform_admin_select`
- `lead_capture_requests_platform_admin_update`
- `lead_capture_requests_store_member_select`
- `lead_capture_requests_store_member_update`

Required related tables visible:
- `lead_capture_requests`
- `platform_admin_members`
- `profiles`
- `store_members`
- `store_subscriptions`
- `stores`

## Local Migration File vs Production Schema

The local migration file defines or reconciles:
- `public.lead_capture_requests`
- required canonical columns and defaults
- existing-table additive column path
- sanitized backfill for required columns
- `ALTER COLUMN ... SET NOT NULL`
- value-range check constraints
- `store_id -> public.stores(store_id)`
- `owner_profile_id -> public.profiles(id)`
- three lead-capture indexes
- `trg_lead_capture_requests_set_updated_at`
- RLS enablement
- five authenticated policies
- intentionally absent anon policies and DELETE policy

Read-only production evidence shows the target table, required columns, FK targets, indexes, trigger, RLS, grants, and policies are already present. Therefore a standard migration apply would mostly replay DDL/policy/trigger statements against existing objects.

## Decision

Current classification: `MIGRATION_REPAIR_REQUIRED`.

Why not `NO_ACTION_NEEDED`:
- The runtime schema appears ready, but migration history visible to available tools is not aligned with the repository migration file.
- Leaving the mismatch unresolved can cause future `supabase db push` or migration workflows to treat `20260609_lead_capture_requests.sql` as pending.

Why not `CONTROLLED_IDEMPOTENT_APPLY_REQUIRED`:
- The table already matches the target posture.
- Row count is `0`.
- Required columns are present and non-nullable.
- RLS, policies, grants, trigger, indexes, FK targets, and functions are present.
- Replaying the migration is still a production DB write path and is higher risk than metadata-only reconciliation.

Standard migration apply decision: `BLOCKED_STANDARD_MIGRATION_APPLY`.

## Proposed Command, Not Executed

Do not run this command from PR #102.

Candidate command after separate owner approval and CLI/project-link confirmation:

```bash
supabase migration repair 20260609 --status applied --linked
```

Preconditions before running the candidate:
- Install or expose the Supabase CLI.
- Confirm CLI auth without printing tokens.
- Confirm the linked project is the MyBiz production project.
- Run `supabase migration list --linked` and verify `20260609` is local-only/pending.
- Re-run read-only schema evidence immediately before repair.
- Confirm `lead_capture_requests` row_count is still `0`.
- Confirm no anon/public grants and no DELETE policy.
- Confirm live write gates remain OFF.

Important: `migration repair --status applied` should not replay the SQL migration body. It updates migration tracking metadata, which is still a production write to Supabase migration history and requires a separate explicit approval.

## Rollback / Mitigation Plan

If a future approved repair succeeds:
- Run `supabase migration list --linked` read-only to confirm local and remote versions align.
- Re-run the read-only schema evidence pack.
- Keep `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, and `liveLeadWriteEnabled` OFF.
- Do not combine repair with migration apply, RLS/grant changes, or live-write enablement.

If a future approved repair fails:
- Stop immediately.
- Do not run migration apply as a fallback.
- Capture sanitized error class only; do not expose tokens or connection strings.
- Re-read migration list and catalog evidence.
- Prepare a separate owner-approved mitigation plan.

If fresh evidence changes before repair:
- If row_count is greater than `0`, stop and prepare retention/backfill evidence.
- If any required column is missing or nullable, stop and classify as `CONTROLLED_IDEMPOTENT_APPLY_REQUIRED`.
- If anon/public grants or DELETE policy appear, stop and classify as policy/grant blocker.
- If RLS is disabled, stop and classify as RLS blocker.

## Out-of-Scope Security Advisory

Supabase table listing returned a separate advisory that some unrelated public tables have RLS disabled. That advisory is not caused or fixed by PR #102, and no remediation SQL was run. It should be handled as a separate security-hardening review because enabling RLS without policies can block application access.

## Live Write Gate Status

Source evidence from `src/shared/lib/launchGates.ts`:
- `broadDbWriteEnabled: false`
- `leadCapturePersistenceEnabled: false`
- `liveLeadWriteEnabled: false`

Lead capture writes remain blocked by the repository gate chain until all three gates are explicitly enabled. Customer memory writes remain blocked by `broadDbWriteEnabled` plus explicit `allowCustomerMemoryWrites`.

## Final Readiness

| Gate | Decision |
| --- | --- |
| PR #102 docs/tests | READY for Draft PR |
| production schema target state | MATCHES_TARGET_EVIDENCE |
| migration history reconciliation | `MIGRATION_REPAIR_REQUIRED`, separate approval needed |
| standard migration apply | `BLOCKED_STANDARD_MIGRATION_APPLY` |
| controlled idempotent apply | NOT preferred unless fresh evidence changes |
| RLS policy apply/change | BLOCKED |
| GRANT/REVOKE | BLOCKED |
| live lead write enablement | BLOCKED |
| live customer memory write | BLOCKED |
| manual deploy | NOT INCLUDED |
