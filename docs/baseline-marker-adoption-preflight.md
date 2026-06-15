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
| `20260614` | `20260614_production_baseline_adoption.sql` | no-op/comment-only production baseline marker | only candidate for metadata repair |
| `20260615075421` | `20260615075421_customer_memory_schema_alignment.sql` | customer-memory schema alignment draft | intentionally local-only pending; not a baseline repair target |

The active local migration directory is no longer baseline-marker-only after PR #109. That is expected source state. The correct interpretation is baseline marker metadata repair can be considered only for `20260614`, while `20260615075421` remains a separate pending schema-alignment migration that must not be repaired as applied, pushed, or applied by this PR.

## Baseline Marker Verification

`20260614_production_baseline_adoption.sql` remains comment-only/no-op:

- DDL: none
- DML: none
- RLS policy SQL: none
- GRANT/REVOKE: none
- trigger/function execution: none
- destructive SQL: none

This file is the only migration version this preflight can name as a future metadata-repair candidate.

## Pending Schema Alignment Verification

`20260615075421_customer_memory_schema_alignment.sql` is intentionally not part of baseline marker adoption:

- It is labeled `DRAFT ONLY`.
- It documents that it has not been applied to production, has not been pushed with `supabase db push`, and has not been run through `supabase migration up`.
- It contains a future controlled schema alignment proposal and must remain local-only pending until a separate schema apply approval exists.
- It is not included in the baseline marker repair command proposal.

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

Adoption readiness: `BASELINE_MARKER_REPAIR_READY_WITH_PENDING_SCHEMA_ALIGNMENT`

Reason:
- Active local migrations include exactly the expected two files after PR #109.
- `20260614` is still a comment-only/no-op baseline marker and is the only future repair candidate.
- `20260615075421` is expected to remain local-only pending and must not be repaired as applied, pushed, or applied in this PR.
- Remote applied rows remain `0`, so the baseline marker metadata repair has not already happened.

Not selected:
- `BLOCKED_UNEXPECTED_DRIFT`: not selected because the observed two local-only migrations match the expected post-PR #109 state.
- `BLOCKED_BASELINE_MARKER_NOT_NOOP`: not selected because the baseline marker is comment-only/no-op.
- `BLOCKED_SCHEMA_ALIGNMENT_UNEXPECTED_APPLIED`: not selected because the schema-alignment migration is still local-only pending.

## Proposal Template Only

This PR documents the shape of a future repair command without approving it.

```text
# PROPOSAL ONLY. DO NOT RUN FROM THIS PR.
npx supabase migration repair 20260614 --status applied --linked
```

Repair executed: `false`

The command above is intentionally limited to the baseline marker version. It does not include `20260615075421`, because the customer-memory schema alignment migration must remain local-only pending until a separate controlled schema apply approval exists.

## Decision

Do not run baseline marker repair from this PR.

Recommended next gate:
1. Owner reviews this updated preflight and decides whether PR #115 can become Ready.
2. If approved, request separate explicit owner approval for exactly one metadata repair: `20260614` only.
3. Keep `20260615075421_customer_memory_schema_alignment.sql` pending until PR #116 or a later controlled schema apply gate is approved.
4. Do not claim full migration-history adoption while the schema alignment migration is still local-only pending.

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
- Request explicit owner approval before baseline marker repair.
- Keep the schema alignment migration pending until controlled apply approval.
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
