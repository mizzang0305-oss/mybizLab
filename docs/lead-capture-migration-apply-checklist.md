# Lead capture migration apply checklist

Date: 2026-06-13

This checklist defines the approval gate for applying the `lead_capture_requests` migration and RLS policies. It is not approval to run the migration. It is not approval to enable live writes.

## A. Preconditions before apply

All items must be confirmed before migration apply:

- Production database target is confirmed by owner.
- Fresh production backup or restore point is confirmed.
- `lead_capture_requests` does not already exist, or an owner-approved existing-table path exists.
- Existing table path is classified as `compatible_existing_table`, `idempotent_alter_required`, or `blocked_existing_data_or_policy_risk`.
- Apply is stopped if the classification is `blocked_existing_data_or_policy_risk`.
- If `lead_capture_requests` row_count is greater than `0`, retention/backfill evidence is approved before any `not null`, constraint validation, rollback, or live-write step.
- Existing migration history has no prior `lead_capture_requests` apply.
- Existing indexes do not collide with the draft index names.
- Existing `lead_capture_requests` columns, constraints, indexes, triggers, RLS, policies, grants, and row_count are captured as sanitized evidence.
- Broad role grants are absent or remediated by a separately approved grant plan. 2026-06-13 grant remediation evidence shows this blocker is resolved.
- `anon` has no table privileges on `public.lead_capture_requests`.
- `public` has no table privileges on `public.lead_capture_requests`.
- `authenticated` does not have `DELETE`, `TRUNCATE`, `TRIGGER`, or `REFERENCES` on `public.lead_capture_requests`.
- Any remaining `authenticated` `SELECT`, `INSERT`, or `UPDATE` grant is intentional, owner-approved, and constrained by RLS policies.
- FK target columns are verified against production schema evidence.
- `public.stores.store_id` exists and is compatible with `lead_capture_requests.store_id`.
- `public.profiles.id` exists and is compatible with `lead_capture_requests.owner_profile_id`.
- `public.store_members.store_id` references the same store key used by `public.is_store_member(store_id)`.
- `public.platform_admin_members.profile_id` is compatible with `auth.uid()` before using `pam.profile_id = auth.uid()` in RLS policies.
- `public.profiles.id = auth.uid()` is confirmed, or the RLS draft is revised to use the approved auth-user mapping column.
- `public.set_updated_at()` exists and is compatible.
- `public.platform_admin_members` exists and matches the platform admin policy.
- `public.is_store_member(store_id)` exists and matches store membership access.
- `public.store_members` exists as dashboard access truth.
- `public.store_subscriptions` exists as paid entitlement truth.
- `public.profiles` and `public.stores` exist.
- `broadDbWriteEnabled` remains OFF unless separately approved.
- `leadCapturePersistenceEnabled` remains OFF during migration apply.
- `liveLeadWriteEnabled` remains OFF during migration apply.
- No payment, webhook, auth/env, customer notification, deploy, or external API mutation is bundled.

## B. Apply command candidates

Do not run any command from this section without explicit owner approval in a separate task.

### Supabase CLI candidate

```powershell
supabase migration list
supabase db push
```

Use only after confirming the linked project, target environment, and rollback plan. Discover exact CLI syntax with `supabase --help` and `supabase db --help` before execution.

### Supabase Dashboard SQL Editor candidate

```text
Open Supabase Dashboard SQL Editor.
Paste the reviewed SQL from supabase/migrations/20260609_lead_capture_requests.sql.
Execute only after owner approval.
Save query result evidence without row samples or PII.
```

Choose exactly one apply path. Do not run both paths unless a recovery plan explicitly requires it.

## C. Post-apply verification

Run read-only verification after apply:

- table exists: `public.lead_capture_requests`
- RLS enabled: true
- policies exist: platform admin select/insert/update, store member select/update
- anon policies absent
- delete policy absent
- row count captured as a number only
- `leadCapturePersistenceEnabled` still OFF
- `liveLeadWriteEnabled` still OFF
- production smoke still passes:
  - `/`
  - `/pricing`
  - `/onboarding?plan=free`
  - unauthenticated `/admin/leads` safe redirect

## D. Rollback plan

Rollback requires owner approval and current row-count evidence.

If no production lead data exists:

```sql
drop policy if exists "lead_capture_requests_store_member_update" on public.lead_capture_requests;
drop policy if exists "lead_capture_requests_store_member_select" on public.lead_capture_requests;
drop policy if exists "lead_capture_requests_platform_admin_update" on public.lead_capture_requests;
drop policy if exists "lead_capture_requests_platform_admin_insert" on public.lead_capture_requests;
drop policy if exists "lead_capture_requests_platform_admin_select" on public.lead_capture_requests;
drop trigger if exists trg_lead_capture_requests_set_updated_at on public.lead_capture_requests;
drop table if exists public.lead_capture_requests;
```

If production lead data exists:

- stop destructive rollback.
- export/archive data through an approved private path.
- prefer disabling writes and policies before any table removal.
- document row count, owner approval, and retention decision.

## E. Hard stops

Stop if any item is true:

- production target is ambiguous.
- backup evidence is missing.
- collision query shows an existing incompatible table or policy.
- existing `lead_capture_requests` evidence is incomplete.
- existing table classification is `blocked_existing_data_or_policy_risk`.
- `anon` has any table grant on `public.lead_capture_requests`.
- `public` has any table grant on `public.lead_capture_requests`.
- `authenticated` has `DELETE`, `TRUNCATE`, `TRIGGER`, or `REFERENCES` on `public.lead_capture_requests`.
- grant remediation is required but no owner-approved plan exists.
- post-remediation evidence shows `anon` or `public` grants returned.
- post-remediation evidence shows `authenticated` has anything beyond `SELECT`, `INSERT`, and `UPDATE`.
- row_count is greater than `0` and no owner-approved retention/backfill plan exists.
- FK target column evidence is missing or conflicts with the draft.
- `stores.id` is required by a draft query; production uses `stores.store_id` evidence instead.
- `pam.profile_id = auth.uid()` is not proven safe by auth mapping evidence.
- migration apply would also enable live writes.
- RLS policy grants anon select, update, delete, or arbitrary insert.
- rollback plan is missing.
- env, token, cookie, session, payment, browser storage, or customer PII would be printed.
