# Baseline Marker Adoption Preflight

Status: docs/tests-only Draft PR plan. This preflight checks whether the production baseline marker can be adopted into Supabase migration history after PR #109. It does not execute repair, apply migrations, replay SQL, or write production data.

It does not approve or execute `npx supabase migration repair ...`, `npx supabase db push`, `npx supabase migration up`, SQL migration body replay, RLS policy apply, GRANT/REVOKE, live customer memory write, live lead write, env/auth/payment/webhook changes, customer/lead row creation, manual deploys, stash cleanup, or protected untracked cleanup.

Baseline:
- Repository: `mizzang0305-oss/mybizLab`
- Branch: `codex/baseline-marker-adoption-preflight`
- Base main HEAD: `03e3c354d3b0a0e4cfa56d87a274866b9b00e954`
- PR #109: merged before this preflight
- Production smoke after PR #109: `PASS`
- Supabase CLI: `2.106.0`
- Evidence mode: read-only CLI metadata, local file inventory, and catalog existence checks only
- PII posture: no `SELECT *`, no row samples, no customer rows, no lead rows, no raw PII

## Current Evidence Summary

Commands executed for this preflight:

```text
npx supabase --version
npx supabase migration list --linked
npx supabase db query --linked "<catalog existence query>"
```

Forbidden commands were not executed:

```text
npx supabase migration repair ...
npx supabase db push
npx supabase migration up
```

## Active Local Migration List

Active migration count: `2`

| Version | Filename | Type | Adoption impact |
| --- | --- | --- | --- |
| `20260614` | `20260614_production_baseline_adoption.sql` | no-op/comment-only production baseline marker | candidate baseline marker |
| `20260615075421` | `20260615075421_customer_memory_schema_alignment.sql` | customer-memory schema alignment draft | intentionally not applied; blocks marker-only adoption as a clean final state |

The active local migration directory is no longer baseline-marker-only after PR #109. That is expected source state, but it means this preflight must not recommend a one-step marker repair as if there were no later active migration.

## Supabase Migration List Summary

`npx supabase migration list --linked` completed successfully.

Remote applied rows from `npx supabase migration list --linked`: `0`

Local-only rows from `npx supabase migration list --linked`: `2`

| Local | Remote | Interpretation |
| --- | --- | --- |
| `20260614` | empty | baseline marker exists only locally |
| `20260615075421` | empty | draft customer-memory alignment migration exists only locally |

## Catalog Metadata Summary

Read-only catalog existence check result:

- `supabase_migrations.schema_migrations` relation exists: `false`
- Direct count on `supabase_migrations.schema_migrations`: unavailable because the relation does not exist
- No `SELECT *`, row samples, customer rows, lead rows, or raw PII were collected.

This supports the migration-list evidence that production has no applied migration history rows yet. It does not authorize repair.

## Adoption Readiness

Adoption readiness: `BLOCKED_ACTIVE_MIGRATION_MISMATCH`

Reason:
- Baseline marker adoption is not being evaluated against a baseline-marker-only active migration directory.
- The post-PR #109 active directory includes a draft schema-alignment migration that must not be applied, pushed, or silently treated as already adopted.
- Running marker-only repair now could leave a later draft migration local-only, which is a valid development state but not a clean final adoption state.

Not selected:
- `BASELINE_MARKER_REPAIR_READY`: not selected because active local migrations include more than the marker.
- `BLOCKED_UNEXPECTED_DRIFT`: not selected because the observed drift is expected from PR #109's draft migration, not an unexplained remote/local mismatch.

## Proposal Template Only

This PR documents the shape of a future repair command without approving it.

```text
# PROPOSAL TEMPLATE ONLY. DO NOT RUN FROM THIS PR.
npx supabase migration repair <VERSION> --status applied --linked
```

Repair executed: `false`

No version-specific repair command is proposed here. A future approval should decide whether the active draft migration is archived, kept as pending, or converted into a controlled apply plan before any baseline marker metadata adoption.

## Decision

Do not run baseline marker repair from this state.

Recommended next gate:
1. Decide whether `20260615075421_customer_memory_schema_alignment.sql` should remain active as a pending draft, move out of the active scan path, or be replaced by a controlled migration after schema/RLS approval.
2. If the active directory is intentionally marker-only, rerun this preflight and request explicit owner approval for baseline marker metadata repair.
3. If the draft migration remains active, treat the migration list as intentionally pending and do not claim full migration-history adoption.

## Safety Boundaries

Still forbidden:
- production DB write
- `npx supabase migration repair ...`
- `npx supabase db push`
- `npx supabase migration up`
- SQL migration body replay
- RLS policy apply
- GRANT/REVOKE
- live customer memory write
- live lead write
- env/auth/payment/webhook changes
- customer or lead data creation
- business table row creation/update/delete
- manual deploy
- committing `supabase/.temp/*`
- deleting stashes

## Rollback Plan

Source rollback:
- Revert this docs/tests-only PR.
- No migration files, code paths, or production configuration are changed by this PR.

Production rollback:
- No production mutation is performed, so no production DB rollback is needed.
- Do not use metadata repair as rollback unless separately approved.

## Sources Checked

- Supabase CLI reference: `supabase migration list` lists local and remote migration history and compares timestamps.
- Supabase CLI reference: `supabase migration repair` repairs remote migration history by marking versions as applied or reverted.
- Supabase changelog: 2026 Data API grant behavior change reinforces why migration adoption must stay separate from RLS/GRANT work.

## Business Impact

User problem solved:
- Maintainers get a clear, current answer on whether the production baseline marker can be safely adopted after PR #109.

Revenue path supported:
- Safer migration-history governance protects customer memory, CRM, AI report, and VIP automation persistence work before live merchant writes are enabled.

Data that can be collected after separate approval:
- Migration-list evidence, post-baseline migration adoption evidence, and controlled schema alignment evidence. This PR collects no customer, lead, payment, message, or business row data.

Remaining before production launch:
- Resolve the active draft migration state.
- Request explicit owner approval before any repair or apply.
- Keep live customer memory and live lead writes disabled until schema, RLS/grant, and canary gates pass.

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
