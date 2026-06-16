# Customer Memory RLS/Grant Hardening Preflight Evidence

Status: `PREFLIGHT_ONLY_DRAFT_PR`

Readiness decision: `BLOCKED_UNEXPECTED_MIGRATION_DRIFT`

Secondary risks:

- `BLOCKED_ADMIN_READ_REGRESSION_RISK`
- `BLOCKED_PUBLIC_INTAKE_REGRESSION_RISK`

This preflight checks whether `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql` is ready for a future approved apply window. It does not execute RLS policy apply, `GRANT`, `REVOKE`, migration apply, db push, migration repair, SQL replay, production DB write, production schema change, or live-write enablement.

## Baseline

Repository target:

- repo: `mizzang0305-oss/mybizLab`
- expected `origin/main`: `c6471ef4c92adbbd7f07f38bb8d051883dd49ea2`
- branch: `codex/customer-memory-rls-grant-hardening-preflight`
- pending migration: `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql`

Live gates remain disabled:

- `broadDbWriteEnabled=false`
- `liveCustomerMemoryWriteEnabled=false`
- `liveLeadWriteEnabled=false`
- `liveAiTraceWriteEnabled=false`
- `liveBackgroundJobExecutionEnabled=false`
- `livePublicPageEventWriteEnabled=false`
- `liveFeedbackRecordWriteEnabled=false`

Evidence mode:

- `SELECT *` was not used.
- Row samples were not collected.
- Raw customer/contact/message values were not collected.
- Raw PII, secrets, tokens, DB passwords, and connection strings were not output.
- Evidence is limited to migration-list metadata, catalog metadata, policy summaries, grant summaries, helper-function metadata, and count-only aggregates.
- Supabase changelog was checked during planning: https://supabase.com/changelog.

## Migration List State

`npx supabase migration list --linked` returned the expected history shape:

| Version | Local | Remote | Decision |
| --- | ---: | ---: | --- |
| `20260614` | yes | yes | baseline marker remote applied |
| `20260615075421` | yes | yes | customer-memory schema alignment remote applied |
| `20260616070824` | yes | no | RLS/grant hardening local-only pending |

No extra remote-only migration was reported. The blocker is not the migration list itself; the blocker is that production catalog metadata already appears to match the pending hardening effect while the migration remains local-only.

## Pending SQL Scope

Target migration:

- `supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql`

Scope confirmed:

- target tables are limited to:
  - `customers`
  - `customer_contacts`
  - `inquiries`
  - `customer_timeline_events`
- helper function touched:
  - `is_store_member(uuid)`
- rollback section exists as commented SQL.

Static SQL scope summary:

| Check | Result |
| --- | --- |
| `DROP TABLE` | absent |
| table `TRUNCATE` statement | absent |
| data `DELETE FROM` | absent |
| data `UPDATE` | absent |
| RLS policy changes | present and expected for future apply |
| `GRANT`/`REVOKE` statements | present and expected for future apply |
| rollback outline | present as comments |

Important preflight finding:

- The pending SQL uses `CREATE POLICY` without `IF NOT EXISTS`.
- Fresh production catalog evidence already shows the proposed command-specific policy names are present.
- Therefore applying the migration as-is is expected to hit duplicate-policy conflicts unless the migration is revised or a separate metadata-adoption decision is approved.

## Production Pre-State Evidence

Count-only row state:

| Table | Row count |
| --- | ---: |
| `customers` | 82 |
| `customer_contacts` | 89 |
| `inquiries` | 0 |
| `customer_timeline_events` | 114 |

RLS state:

| Table | RLS enabled | Force RLS enabled |
| --- | ---: | ---: |
| `customers` | true | false |
| `customer_contacts` | true | false |
| `inquiries` | true | false |
| `customer_timeline_events` | true | false |

Policy summary:

| Table | Policy count | Commands | Roles | Names |
| --- | ---: | --- | --- | --- |
| `customers` | 3 | `SELECT`, `INSERT`, `UPDATE` | `authenticated` | `customers_select_store_member`, `customers_insert_store_member`, `customers_update_store_member` |
| `customer_contacts` | 3 | `SELECT`, `INSERT`, `UPDATE` | `authenticated` | `customer_contacts_select_store_member`, `customer_contacts_insert_store_member`, `customer_contacts_update_store_member` |
| `inquiries` | 3 | `SELECT`, `INSERT`, `UPDATE` | `authenticated` | `inquiries_select_store_member`, `inquiries_insert_store_member`, `inquiries_update_store_member` |
| `customer_timeline_events` | 3 | `SELECT`, `INSERT`, `UPDATE` | `authenticated` | `customer_timeline_events_select_store_member`, `customer_timeline_events_insert_store_member`, `customer_timeline_events_update_store_member` |

Grant summary:

| Table | `public` grants | `anon` grants | `authenticated` grants | `service_role` grants |
| --- | --- | --- | --- | --- |
| `customers` | none observed | none observed | `SELECT`, `INSERT`, `UPDATE` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `customer_contacts` | none observed | none observed | `SELECT`, `INSERT`, `UPDATE` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `inquiries` | none observed | none observed | `SELECT`, `INSERT`, `UPDATE` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `customer_timeline_events` | none observed | none observed | `SELECT`, `INSERT`, `UPDATE` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |

Destructive privilege summary:

| Role | Target table destructive privileges |
| --- | --- |
| `public` | none observed |
| `anon` | none observed |
| `authenticated` | no `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` observed |
| `service_role` | `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` observed; acceptable only under server-only secret handling |

Helper function evidence:

| Function | Exists | Owner | Security definer | Function config | `public` execute | `anon` execute | `authenticated` execute | `service_role` execute |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: |
| `is_store_member(target_store_id uuid)` | true | `postgres` | true | `search_path=public` | false | false | true | true |

Helper function risk interpretation:

- `PUBLIC` and `anon` execute exposure already appears removed.
- The function remains `SECURITY DEFINER` in the exposed `public` schema with `search_path=public`.
- This is acceptable only as a pre-canary blocker to review, not as a reason to enable live writes.

## Apply Impact Matrix

| Area | Pending SQL expected action | Fresh pre-state | Impact if applied as-is |
| --- | --- | --- | --- |
| `anon`/`public` table grants | revoke broad direct target-table privileges | none observed | likely no-op |
| `authenticated` table grants | revoke all then grant `SELECT`, `INSERT`, `UPDATE` | already `SELECT`, `INSERT`, `UPDATE` only | likely no net change, but still requires approved execution |
| destructive privileges | remove from `authenticated` and `anon` | already absent for `authenticated`, `anon`, and `public` | likely no-op for merchant roles |
| broad member policies | drop old public/ALL policy names | old policy names not observed | no-op from `DROP POLICY IF EXISTS` |
| command-specific policies | create 12 authenticated policies | the same 12 policy names already exist | apply likely fails on duplicate policy names |
| helper execute grants | revoke `PUBLIC`/`anon`, grant `authenticated`/`service_role` | already matches target state | likely no net change |
| admin read model | should remain store-scoped authenticated read | not proven by authenticated owner smoke in this preflight | still requires post-apply/admin read validation |
| public inquiry route | should not depend on direct anon table grants | not proven by live write canary; live writes disabled | still requires server-adapter/canary validation |
| service-role adapter | service_role retains full table privileges | service_role still broad | acceptable only if server-only secret handling remains intact |

## Rollback Plan

Because this preflight decision is blocked, no rollback SQL is executed.

Required pre-state snapshot before any future apply:

- `npx supabase migration list --linked`
- target-table row counts, count-only
- target-table RLS enabled flags
- target-table policy names, commands, and roles
- target-table grants for `public`, `anon`, `authenticated`, and `service_role`
- destructive privilege flags for `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER`
- `is_store_member` owner, `SECURITY DEFINER`, search path, and execute grants
- owner/admin read smoke plan while live gates remain disabled

Rollback SQL outline:

- Drop any newly introduced command-specific policies that were actually created.
- Restore the exact pre-apply policy/grant state from the captured snapshot only if owner/admin access regresses.
- Keep `broadDbWriteEnabled=false` and `liveCustomerMemoryWriteEnabled=false` during rollback validation.
- Do not create, update, or delete business rows during rollback validation.
- Rollback requires separate owner approval.

Current blocker for rollback:

- The existing rollback comment in the draft migration restores broad `public`/`anon`/`authenticated` privileges and public/ALL policies.
- Because production pre-state already appears hardened, that rollback outline does not match the current safer pre-state and must not be used without revision.

## Owner Approval Checklist

- [ ] Confirm whether the hardening state was intentionally applied outside migration history.
- [ ] Decide whether `20260616070824` needs metadata adoption, SQL revision, or replacement with a no-op marker.
- [ ] Do not run the current draft SQL as-is while duplicate policy names exist.
- [ ] Confirm service-role privileges are server-only and not exposed to browser code.
- [ ] Confirm helper function placement in `public` is acceptable for canary or schedule separate helper hardening.
- [ ] Keep all live write gates disabled.
- [ ] Require fresh post-decision evidence before any canary.

## Post-Apply Evidence Checklist

Use only after a separate approved apply/adoption path:

- [ ] `20260616070824` migration history state reconciled as approved.
- [ ] Target-table grants show no `public` or `anon` direct table grants.
- [ ] `authenticated` grants show only `SELECT`, `INSERT`, and `UPDATE`.
- [ ] `authenticated` has no `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`.
- [ ] Target policies remain command-specific and `authenticated` scoped.
- [ ] `is_store_member` does not expose execute to `PUBLIC` or `anon`.
- [ ] Admin read smoke passes.
- [ ] Public inquiry path impact is reviewed with live write gates still disabled.

## Canary Prerequisites

Live customer-memory write remains blocked until:

- migration history and catalog state are reconciled
- post-decision read-only evidence passes
- owner/admin read smoke passes
- public intake route impact is reviewed
- rollback path is updated to match current pre-state
- test-store-only canary is separately approved
- `broadDbWriteEnabled` and `liveCustomerMemoryWriteEnabled` are changed only under separate approval

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
- live AI trace/background/public-event/feedback write
- env/auth/payment/webhook changes
- customer/lead/visitor/feedback row creation
- raw PII output
- secret/token/DB password/connection string output
- sales Excel import work
- PR #106 merge
- manual deploy
- stash deletion

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
  "rls_grant_hardening_preflight_created": true
}
```
