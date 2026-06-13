# Lead capture existing table decision

Date: 2026-06-13

This note classifies the current `public.lead_capture_requests` production evidence and the safe migration path. It is a planning document only. It does not approve production migration apply, RLS policy apply, live lead writes, customer memory writes, deploy, payment calls, webhook changes, auth/env changes, customer notification, or external API mutation.

## Evidence received

User-provided read-only evidence shows:

- `public.stores.store_id` is `uuid`, `not null`, and the primary key.
- `public.profiles.id` is `uuid`, `not null`, and the primary key.
- `public.store_members.store_id` references `public.stores(store_id)`.
- `public.store_members.profile_id` references `public.profiles(id)`.
- `public.platform_admin_members.profile_id` references `public.profiles(id)` and is unique.
- `public.is_store_member(target_store_id uuid)` exists and returns `boolean`.
- `public.set_updated_at()` exists and returns `trigger`.
- `public.lead_capture_requests` already exists.
- Existing `lead_capture_requests` constraints include primary key, `store_id` FK, and `owner_profile_id` FK.
- SQL Editor evidence for `supabase_migrations.schema_migrations` returned no rows, so migration-history access remains a gap.

No row samples, customer contact fields, browser storage, secrets, payment data, or raw private evidence were used.

## 2026-06-13 read-only evidence update

Approved read-only Supabase metadata evidence added:

- `public.lead_capture_requests` exists.
- Row count is `0`.
- RLS is enabled.
- Delete policy was not observed in the policy list.
- FK targets are compatible with the corrected draft:
  - `lead_capture_requests.store_id` references `public.stores(store_id)`.
  - `lead_capture_requests.owner_profile_id` references `public.profiles(id)`.
- Existing indexes are compatible candidates:
  - `lead_capture_requests_store_idx`
  - `lead_capture_requests_owner_profile_idx`
  - `lead_capture_requests_status_idx`
- Required functions exist:
  - `public.is_store_member(target_store_id uuid)`
  - `public.set_updated_at()`

Grant blocker discovered and remediated:

- `anon` currently has broad table grants including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES`.
- `authenticated` currently has broad table grants including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES`.
- A separately approved grant remediation was executed on 2026-06-13.
- After remediation, `anon` has no returned table grants.
- After remediation, `public` has no returned table grants.
- After remediation, `authenticated` has `SELECT`, `INSERT`, and `UPDATE` only.
- `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES` grants were removed.
- Row count remained `0` before and after remediation.
- RLS stayed enabled and the delete policy count remained `0`.
- No row data was changed. This was a DB permission change only.
- See `docs/lead-capture-grant-remediation-plan.md` for the executed result and the remaining hard gates.

## Decision matrix

### compatible_existing_table

Status: `stronger candidate`

This path requires all of the following:

- live columns match the draft column names and compatible types.
- existing indexes match the draft names and definitions, or are safely additive.
- RLS is enabled or can be enabled without exposing public access.
- no anon/public table grants exist.
- authenticated grants are restricted to `SELECT`, `INSERT`, and `UPDATE` under RLS-governed reviewed flows.
- no delete policy exists.
- row count is `0`, or an owner-approved backfill/retention plan exists.
- platform-admin auth mapping is confirmed.

### idempotent_alter_required

Status: `likely`

The table already exists, so a pure `create table if not exists` migration is not enough. The draft now keeps the table and adds missing columns with `alter table ... add column if not exists`, applies additive indexes, and keeps constraints as non-destructive checks for the existing-table path.

### blocked_existing_data_or_policy_risk

Status: `resolved grant blocker; apply still gated`

The broad grant blocker is resolved by the approved remediation result. Migration apply remains blocked by final migration strategy and policy/auth-mapping review, not by the previous broad grant posture.

Remaining blockers and review items:

- live trigger state.
- migration history source that is accessible for this project.
- whether `profiles.id` is the same value as `auth.uid()`, or whether policies need an auth-user mapping column.
- owner decision to apply the additive/idempotent migration path.

## Migration path

Recommended path: `idempotent_alter_required`.

Do not drop or recreate `public.lead_capture_requests`. Use additive migration steps only after owner-approved evidence confirms the current table is compatible. If row_count is greater than `0`, stop and create a data retention/backfill plan before applying `not null`, constraint validation, rollback, or live-write steps.

## RLS policy basis

The current draft still uses:

```sql
pam.profile_id = auth.uid()
```

This is not fully approved yet. Evidence confirms `platform_admin_members.profile_id` references `profiles.id`, but it does not prove `profiles.id` is always the same UUID as `auth.uid()`. If `profiles` has a separate auth-user mapping column, the platform-admin policies must be changed before apply.

## Current apply readiness

- migration apply: `BLOCKED`
- RLS policy apply: `BLOCKED`
- live lead write enable: `BLOCKED`
- live customer memory write: `BLOCKED`
- PR Ready transition: `POSSIBLE AFTER DOCS/TESTS/CI REVIEW`; keep Draft until owner explicitly approves Ready conversion.

## Next evidence needed

- PR #100 docs/tests/CI review after grant remediation result.
- `lead_capture_requests` trigger state.
- `profiles` auth mapping evidence that proves whether `profiles.id = auth.uid()` is valid.
- migration history evidence from a project-approved source.
- owner decision to keep row_count `0` table through additive/idempotent path.
