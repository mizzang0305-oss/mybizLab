# Customer Memory RLS/Grant Hardening Drift Resolution

Status: `DRAFT_PR_EVIDENCE_ONLY`

Decision: `REPAIR_AS_APPLIED_RECOMMENDED`

This document resolves the drift found by PR #120 between the pending source migration and the current production RLS/grant state. It does not execute RLS policy apply, `GRANT`, `REVOKE`, migration apply, db push, migration repair, SQL replay, production DB write, production schema change, or live-write enablement.

## Scope

Repository target:

- repo: `mizzang0305-oss/mybizLab`
- branch: `codex/customer-memory-rls-hardening-drift-resolution`
- pending migration: `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql`
- source baseline: PR #120 merged on `main`

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
- Raw customer/contact/message values were not collected.
- Raw PII, secrets, tokens, DB passwords, and connection strings were not output.
- Evidence is limited to migration-list metadata, catalog metadata, policy summaries, grant summaries, helper-function metadata, and count-only aggregates.

## Migration List Summary

`npx supabase migration list --linked` returned:

| Version | Local | Remote | State |
| --- | ---: | ---: | --- |
| `20260614` | yes | yes | baseline marker remote applied |
| `20260615075421` | yes | yes | customer-memory schema alignment remote applied |
| `20260616070824` | yes | no | RLS/grant hardening local-only pending |

No remote-only migration was observed in this check.

## Pending Migration Scope

Target SQL:

- `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql`

Target objects:

- `public.customers`
- `public.customer_contacts`
- `public.inquiries`
- `public.customer_timeline_events`
- `public.is_store_member(uuid)`

Pending SQL intent:

- remove direct `public` and `anon` table privileges from the four target tables
- reduce `authenticated` table privileges to `SELECT`, `INSERT`, and `UPDATE`
- remove `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` from merchant-facing authenticated access
- keep service-role access server-only and documented
- remove `PUBLIC` and `anon` execute on `is_store_member(uuid)`
- keep `authenticated` and `service_role` execute on `is_store_member(uuid)`
- replace broad public/ALL policies with command-specific authenticated policies

Static duplicate-policy risk:

- the migration uses `CREATE POLICY` for 12 command-specific policy names
- PostgreSQL does not support `CREATE POLICY IF NOT EXISTS`
- fresh production catalog evidence shows all 12 target policy names already exist
- applying the migration body as-is is expected to fail on duplicate policy names before becoming a clean no-op

## Current Production State Evidence

Count-only row state:

| Table | Row count |
| --- | ---: |
| `customers` | 82 |
| `customer_contacts` | 89 |
| `inquiries` | 0 |
| `customer_timeline_events` | 114 |

RLS state:

| Table | RLS enabled | Force RLS |
| --- | --- | --- |
| `customers` | true | false |
| `customer_contacts` | true | false |
| `inquiries` | true | false |
| `customer_timeline_events` | true | false |

Policy state:

| Check | Result |
| --- | ---: |
| Expected command-specific policy count | 12 |
| Expected policy names already present | 12 |
| Expected command/role matches | 12 |
| Legacy public/ALL policies observed | 0 |

Existing target policy names:

| Table | Policies |
| --- | --- |
| `customers` | `customers_select_store_member`, `customers_insert_store_member`, `customers_update_store_member` |
| `customer_contacts` | `customer_contacts_select_store_member`, `customer_contacts_insert_store_member`, `customer_contacts_update_store_member` |
| `inquiries` | `inquiries_select_store_member`, `inquiries_insert_store_member`, `inquiries_update_store_member` |
| `customer_timeline_events` | `customer_timeline_events_select_store_member`, `customer_timeline_events_insert_store_member`, `customer_timeline_events_update_store_member` |

Grant state:

| Table | `public` grants | `anon` grants | `authenticated` grants | `service_role` grants |
| --- | --- | --- | --- | --- |
| `customers` | none | none | `INSERT`, `SELECT`, `UPDATE` | `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE` |
| `customer_contacts` | none | none | `INSERT`, `SELECT`, `UPDATE` | `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE` |
| `inquiries` | none | none | `INSERT`, `SELECT`, `UPDATE` | `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE` |
| `customer_timeline_events` | none | none | `INSERT`, `SELECT`, `UPDATE` | `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE` |

Grant summary:

| Check | Result |
| --- | ---: |
| Tables with `public` or `anon` direct grants | 0 |
| Tables with expected authenticated grants | 4 |
| Tables with authenticated destructive grants | 0 |

Helper function evidence:

| Function | Security definer | Search path | `public` execute | `anon` execute | `authenticated` execute | `service_role` execute |
| --- | --- | --- | --- | --- | --- | --- |
| `is_store_member(target_store_id uuid)` | true | `search_path=public` | false | false | true | true |

The helper function still deserves a separate security review because it is a `SECURITY DEFINER` function in the exposed `public` schema. That is not a blocker for marking the already-present hardening migration as applied, but it remains a follow-up hardening topic before live customer-memory writes.

## Current-State vs Pending Migration Diff

| Pending migration item | Current production state | Diff result | Execution decision |
| --- | --- | --- | --- |
| Remove `public`/`anon` target table grants | no `public`/`anon` direct grants observed | already matches | do not apply SQL body |
| Restrict `authenticated` table grants | `INSERT`, `SELECT`, `UPDATE` only | already matches | do not apply SQL body |
| Remove authenticated `DELETE` | absent | already matches | do not apply SQL body |
| Remove authenticated `TRUNCATE` | absent | already matches | do not apply SQL body |
| Remove authenticated `REFERENCES` | absent | already matches | do not apply SQL body |
| Remove authenticated `TRIGGER` | absent | already matches | do not apply SQL body |
| Remove helper `PUBLIC`/`anon` execute | both false | already matches | do not apply SQL body |
| Keep helper `authenticated`/`service_role` execute | both true | already matches | do not apply SQL body |
| Replace broad public/ALL policies | no legacy public/ALL policies observed | already matches | do not apply SQL body |
| Create 12 command-specific authenticated policies | all 12 already exist | duplicate-policy conflict risk | do not apply SQL body |

## Decision Matrix

| Decision option | Result | Rationale |
| --- | --- | --- |
| `REPAIR_AS_APPLIED_RECOMMENDED` | selected | catalog/grant/policy/helper evidence matches the intended hardening target while migration history still shows the migration local-only pending |
| `REPLACE_WITH_IDEMPOTENT_MIGRATION_REQUIRED` | not selected | replacement is unnecessary if owner accepts that the current production state is the source of truth and approves metadata repair only |
| `KEEP_BLOCKED_POLICY_MISMATCH` | not selected | all 12 expected policies exist with matching command and role |
| `KEEP_BLOCKED_GRANT_MISMATCH` | not selected | target table grants match the hardening target for `public`, `anon`, and `authenticated` |
| `KEEP_BLOCKED_HELPER_FUNCTION_RISK` | not selected for this migration-history decision | helper execute grants match the target; broader security-definer placement review remains a separate hardening item |

## Proposed Next Action

Recommended owner decision:

1. Do not run `npx supabase db push`.
2. Do not run `npx supabase migration up` or migration apply.
3. Do not replay `20260616070824_customer_memory_rls_grant_hardening.sql`.
4. If owner accepts this evidence, approve a one-time migration-history metadata repair only:

```text
npx supabase migration repair 20260616070824 --status applied --linked
```

The command above is a proposal only. It was not executed in this PR.

Before any future metadata repair approval:

- rerun `npx supabase migration repair --help` to confirm argument order
- rerun `npx supabase migration list --linked`
- rerun fresh catalog/count-only evidence for the target tables and helper function
- confirm no new drift appeared after this PR
- keep all live write gates disabled

## Rollback Plan

This PR performs no production mutation, so no production rollback is needed for this PR.

If a future owner-approved metadata repair marks `20260616070824` applied, rollback must be metadata-only unless a separate evidence refresh proves a schema rollback is required.

Current-state rollback requirements:

- Do not use the rollback SQL comments in `20260616070824_customer_memory_rls_grant_hardening.sql` as-is.
- The existing rollback draft would restore broader `public`, `anon`, and `authenticated` privileges plus public/ALL policies that are not present in the current production pre-state.
- Any rollback must preserve the current safer state unless owner explicitly approves a different emergency posture.
- If metadata repair needs to be reverted, confirm the exact Supabase CLI repair syntax with `npx supabase migration repair --help` in that future approval window before changing migration history.

## Validation Checklist For Future Approval

- [ ] `20260614` remains remote applied.
- [ ] `20260615075421` remains remote applied.
- [ ] `20260616070824` remains local-only pending immediately before approval.
- [ ] all 12 expected policies still exist.
- [ ] no legacy public/ALL policies are present.
- [ ] no `public` or `anon` direct table grants are present on the four target tables.
- [ ] authenticated grants remain exactly `INSERT`, `SELECT`, and `UPDATE`.
- [ ] authenticated `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` remain absent.
- [ ] helper function execute exposure remains `public=false`, `anon=false`, `authenticated=true`, `service_role=true`.
- [ ] owner accepts metadata repair as the only intended mutation.
- [ ] production live-write gates remain disabled.

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
  "sales_excel_import_touched": false
}
```
