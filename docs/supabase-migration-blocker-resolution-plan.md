# Supabase Migration Blocker Resolution Plan

Status: docs/tests-only Draft PR plan for PR #104. This document resolves the decision path for the remaining migration-history blockers from PR #103. It does not approve or execute `npx supabase migration repair`, `npx supabase db push`, `npx supabase migration up`, SQL migration body replay, RLS policy apply, GRANT/REVOKE, live lead write enablement, live customer memory write enablement, env/auth/payment/webhook changes, customer or lead data creation, business table row writes, manual deploys, or stash cleanup.

Baseline:
- Repository: `mizzang0305-oss/mybizLab`
- Origin main HEAD: `ff4aca2076250f545082351586ee77af07334212`
- PR #103: `MERGED`
- Production deploy/smoke: `PASS`
- Supabase login/link: completed in prior preflight
- Migration list source: `npx supabase migration list --linked`
- Parsed migration-list rows: `15`
- Remote applied rows: `0`
- Local-only rows: `15`
- Target `20260609_lead_capture_requests.sql`: `SAFE_TO_REPAIR_APPLIED`, but single-version repair remains blocked
- Evidence method: local SQL file review plus production read-only catalog/count metadata
- PII posture: no `SELECT *`, no row samples, no customer name/phone/email/message/memo output

Official references reviewed:
- https://supabase.com/docs/reference/cli/introduction
- https://supabase.com/changelog

## Decision

Overall strategy recommendation: `PRODUCTION_BASELINE_ADOPTION_RECOMMENDED`.

Reason:
- The blocker migrations do not describe the current production schema as a clean replayable sequence.
- Two early migrations are partially reflected in production, but the current schema is divergent enough that replaying their bodies would risk failure or unintended data writes.
- One blocker is a data-only backfill that cannot be proven through catalog-only evidence and should not remain an active schema-history blocker.
- One blocker is additive and may be worth applying later, but only through a separate controlled migration after baseline adoption.
- One blocker targets legacy table names that are absent from production.
- Two local files share the same `20260424` version prefix, while Supabase migration history compares migration timestamps. That duplicate must be resolved before any repair sequence can be unambiguous.

Rejected strategies:
- `FULL_SEQUENCE_REPAIR_AFTER_BLOCKERS_FIXED`: blocked because several migrations are not safe to repair as already applied.
- `MIXED_REPAIR_AND_CONTROLLED_APPLY_REQUIRED`: premature because the active migration directory still contains duplicate and obsolete local history.

## Blocker SQL Analysis Summary

### `20260405_mybiz_v2_phase1_phase2.sql`

Line-by-line surface:
- Lines 1-10: creates `pgcrypto` if missing and creates/replaces `public.normalize_customer_phone(input text)`.
- Lines 12-42: alters `stores`, backfills `store_id`, adds a `plan` column, drops/recreates `stores_plan_check`.
- Lines 44-84: creates `store_subscriptions` and inserts subscription rows from `stores`/`billing_records`.
- Lines 86-159: adds `customers.updated_at`, creates customer contact/preference/timeline tables and indexes.
- Lines 161-252: DML backfills customer contacts, preferences, and timeline events from existing customer rows.
- Lines 254-272: drops/recreates updated-at triggers.
- Lines 274-305: enables RLS and drops/recreates member policies.

Risk surface:
- DDL: yes.
- DML/backfill: yes.
- RLS/policy: yes.
- GRANT/REVOKE: no.
- Trigger/function: yes.
- Destructive SQL: no table/column drops, no delete/truncate; replacement drops for constraints, triggers, and policies only.
- Idempotency: partial. Many statements are guarded, but the body references legacy/currently absent columns such as `stores.id`, `customers.email`, `customers.phone`, `customers.marketing_opt_in`, and `customers.updated_at`.

Production evidence:
- `normalize_customer_phone`: missing.
- `customers.updated_at`: missing.
- `customer_contacts_store_type_normalized_idx`, `customer_contacts_store_customer_idx`, `customer_preferences_store_customer_idx`, `customer_timeline_events_store_customer_occurred_idx`: missing.
- `trg_customer_contacts_set_updated_at`, `trg_customer_preferences_set_updated_at`, `trg_customers_set_updated_at`: missing.
- Member policies for customer contact/preference/timeline tables: present.
- `stores.store_id`: present and not nullable.
- `stores.id`: missing.

Final recommendation: `REPLACE_WITH_NEW_BASELINE`.

Rationale: production has some target tables/policies but not the full migration contract, and replaying this migration body would be a mixed schema/data write against a divergent schema. Do not repair this version as applied and do not apply it as-is.

### `20260406_mybiz_v2_phase3.sql`

Line-by-line surface:
- Lines 1-106: creates public page, visitor session, conversation, and inquiry tables.
- Lines 108-152: conditionally adds inquiry/conversation foreign keys and operation columns to inquiry/reservation/waiting tables.
- Lines 154-216: drops/recreates timeline event check constraints.
- Lines 218-243: creates public-page, visitor, conversation, inquiry, reservation, and waiting indexes.
- Lines 245-273: drops/recreates updated-at triggers.
- Lines 275-378: inserts and updates `store_public_pages` from `stores` and `store_home_content`.
- Lines 380-425: enables RLS and drops/recreates public/member policies.

Risk surface:
- DDL: yes.
- DML/backfill: yes.
- RLS/policy: yes.
- GRANT/REVOKE: no.
- Trigger/function: yes.
- Destructive SQL: no table/column drops, no delete/truncate; replacement drops for constraints, triggers, and policies only.
- Idempotency: partial. `CREATE TABLE IF NOT EXISTS` does not add missing columns to existing tables, and later DML assumes columns that are absent in the current production shape.

Production evidence:
- Main target tables exist with RLS enabled.
- `store_public_pages.slug`, `store_public_pages.tagline`, `store_public_pages.description`, and `store_public_pages.theme_preset`: missing.
- `visitor_sessions.visitor_token` and `visitor_sessions.updated_at`: missing.
- `conversation_sessions.updated_at`: missing.
- `waiting_entries.updated_at`: missing.
- Early indexes and updated-at triggers from this migration: missing.
- `store_public_pages_member_access`, `conversation_sessions_member_access`, `conversation_messages_member_access`, and `inquiries_member_access`: present.
- `store_public_pages_public_select` and `visitor_sessions_member_access`: missing.

Final recommendation: `REPLACE_WITH_NEW_BASELINE`.

Rationale: this migration is not purely pending and not safely replayable. Production already has a newer/divergent public-store and CRM schema, so the active history should be replaced by a current production baseline instead of applying this older body.

### `20260424_public_store_text_backfill.sql`

Line-by-line surface:
- Lines 1-523: one `DO` block that builds dynamic update assignments based on available columns.
- Lines 18-34: locates a specific public store target by slug or identifier and exits if it is absent.
- Lines 47-97: conditionally prepares `stores` text assignments.
- Lines 100-114: dynamically updates `public.stores`.
- Lines 117-435: conditionally prepares and applies `store_public_pages` text/media/notice updates.
- Lines 438-521: conditionally prepares and applies `store_brand_profiles` updates.

Risk surface:
- DDL: no.
- DML/backfill: yes.
- RLS/policy: no.
- GRANT/REVOKE: no.
- Trigger/function: no persistent object; uses a transient `DO` block.
- Destructive SQL: no delete/truncate/drop.
- Idempotency: conditional and mostly repeat-safe, but it is still a targeted production data rewrite.

Production evidence:
- `stores` total count: `6`.
- Target store slug count for the backfill key: `1`.
- `store_public_pages` total count: `6`.
- Target `store_public_pages` slug count through metadata-safe key lookup: `0`.
- `store_brand_profiles`: absent.
- Catalog/count evidence cannot prove whether intended text corrections are already present because row samples are intentionally forbidden.

Final recommendation: `ARCHIVE_FROM_ACTIVE_MIGRATIONS`.

Rationale: this is a historical data correction, not a reusable schema migration. It should not block active schema-history adoption. If the text remediation still matters, handle it as a separate owner-approved data remediation plan, not as part of migration-history repair.

### `20260511_review_abuse_guard.sql`

Line-by-line surface:
- Lines 1-4: documents privacy-preserving review submission attempt tracking.
- Lines 6-29: creates `review_submit_attempts`.
- Lines 31-38: creates three review-attempt indexes.
- Line 40: enables RLS.
- Lines 42-47: drops/recreates member-only policy.

Risk surface:
- DDL: yes.
- DML/backfill: no.
- RLS/policy: yes.
- GRANT/REVOKE: no.
- Trigger/function: no.
- Destructive SQL: policy drop only.
- Idempotency: good for table/index creation and policy replacement.

Production evidence:
- `review_submit_attempts`: missing.
- `review_submit_attempts_store_created_idx`: missing.
- `review_submit_attempts_rate_window_idx`: missing.
- `review_submit_attempts_blocked_idx`: missing.
- `review_submit_attempts_member_access`: missing.
- `review_request_links`: present.

Final recommendation: `CONTROLLED_IDEMPOTENT_APPLY_REQUIRED`.

Rationale: the migration is additive and non-destructive, but it is not already reflected in production. It must not be marked applied. If the abuse guard is still a product requirement, apply it later through a separate owner-approved controlled migration after baseline adoption.

### `20260523_store_brand_theme_v2.sql`

Line-by-line surface:
- Lines 4-14: adds `stores.font_family`, drops/recreates `stores_theme_preset_check`.
- Lines 17-26: adds `public_pages.font_family`, drops/recreates `public_pages_theme_preset_check`.
- Lines 29-33: drops/recreates `store_requests_theme_preset_check`.

Risk surface:
- DDL: yes.
- DML/backfill: no.
- RLS/policy: no.
- GRANT/REVOKE: no.
- Trigger/function: no.
- Destructive SQL: constraint drops only.
- Idempotency: weak against current production because it references absent legacy tables/columns.

Production evidence:
- `stores.font_family`: missing.
- `stores.theme_preset`: missing.
- `stores_theme_preset_check`: missing.
- `public_pages`: absent.
- `store_requests`: absent.
- Current public page schema uses `store_public_pages`, not `public_pages`.

Final recommendation: `ARCHIVE_FROM_ACTIVE_MIGRATIONS`.

Rationale: this migration targets legacy/draft schema names and would not replay cleanly against current production. If brand theme v2 is still desired, design a new current-schema migration after baseline adoption.

## Duplicate `20260424` Version-Prefix Resolution

Current duplicate files:
- `20260424_public_store_text_backfill.sql`
- `20260424_store_subscriptions_canonical_alignment.sql`

Supabase CLI migration history compares migration timestamps/versions, not full filenames. Two active local files with the same `20260424` prefix cannot be represented as two distinct remote migration-history rows. A version-only repair command would be ambiguous because it cannot express which local file is being adopted.

Recommended resolution:
- Archive `20260424_public_store_text_backfill.sql` out of active migrations after owner approval because it is DML-only historical remediation.
- Keep `20260424_store_subscriptions_canonical_alignment.sql` as the only active `20260424` candidate if the repository chooses a repair-based path.
- If the text backfill must remain active for audit reasons, rename it to a unique timestamp in a separate docs/migration cleanup PR and still do not repair or apply it without a separate data-remediation approval.

Current PR action: documentation only. No migration file rename, archive move, or `.gitignore` change is performed here.

## Blocker Recommendation Table

| Blocker | Prior classification | Final recommendation | Why |
| --- | --- | --- | --- |
| `20260405_mybiz_v2_phase1_phase2.sql` | `NEEDS_SCHEMA_APPLY` | `REPLACE_WITH_NEW_BASELINE` | Partially reflected but divergent; as-is replay mixes schema and data writes and references absent columns. |
| `20260406_mybiz_v2_phase3.sql` | `NEEDS_SCHEMA_APPLY` | `REPLACE_WITH_NEW_BASELINE` | Production has newer/divergent table shapes; as-is replay would not be a safe idempotent apply. |
| `20260424_public_store_text_backfill.sql` | `UNKNOWN_NEEDS_EVIDENCE` | `ARCHIVE_FROM_ACTIVE_MIGRATIONS` | DML-only historical text remediation cannot be proven by catalog evidence and should not block schema history. |
| `20260511_review_abuse_guard.sql` | `NEEDS_SCHEMA_APPLY` | `CONTROLLED_IDEMPOTENT_APPLY_REQUIRED` | Additive table/index/RLS migration is absent and must not be repaired as applied. |
| `20260523_store_brand_theme_v2.sql` | `OBSOLETE_OR_DRAFT` | `ARCHIVE_FROM_ACTIVE_MIGRATIONS` | Targets absent legacy tables/columns; replace with new current-schema design if still needed. |
| duplicate `20260424` prefix | blocker | `ARCHIVE_OR_RENAME_BEFORE_REPAIR` | Version-only history cannot distinguish two active local files with the same timestamp. |

## Overall Strategy Recommendation

Recommended strategy: `PRODUCTION_BASELINE_ADOPTION_RECOMMENDED`.

Proposed future sequence, not executed:
1. Owner approves a separate migration-cleanup PR.
2. Archive or otherwise remove obsolete/data-only blocker migrations from the active `supabase/migrations` replay path.
3. Create a schema-only production baseline migration that reflects the current production schema.
4. Keep any real new feature deltas, such as `review_submit_attempts`, as separate controlled migrations after the baseline.
5. Re-run `npx supabase migration list --linked` and fresh read-only schema evidence.
6. Only then request separate explicit approval for any metadata repair or controlled apply.

This PR intentionally does not include a concrete repair command, a concrete apply command, or a concrete file move.

## Remaining Blocked Items

Still blocked:
- Active migration directory still contains both `20260424` files.
- No archive/rename/baseline migration has been created.
- `review_submit_attempts` remains absent from production.
- Old early migration bodies still reference divergent production schema.
- Text backfill state remains unknown because row samples are out of scope.

Still forbidden in this PR:
- `npx supabase migration repair`
- `npx supabase db push`
- `npx supabase migration up`
- SQL migration body replay
- RLS policy apply
- GRANT/REVOKE
- live lead write enablement
- live customer memory write enablement
- env/auth/payment/webhook changes
- customer or lead data creation
- business table row creation/update/delete
- manual deploy
- staging or committing `supabase/.temp/*`

Live-write gate evidence from `src/shared/lib/launchGates.ts`:
- `broadDbWriteEnabled: false`
- `leadCapturePersistenceEnabled: false`
- `liveLeadWriteEnabled: false`

## Production Launch Impact

User problem solved:
- Maintainers get a concrete resolution path for the blocker migrations instead of treating every local-only migration as repairable.

Revenue path supported:
- Safer migration history protects lead capture, customer memory, review trust, content automation, and paid operational workflows from future migration drift.

Data that can be collected later:
- Fresh migration-list evidence, schema baseline evidence, and controlled apply/repair evidence. This PR collects no customer, lead, payment, or message row data.

Remaining before production launch:
- Approve and implement the migration cleanup/baseline adoption PR.
- Decide whether review abuse guard is still required and, if so, apply it in a separately approved controlled migration.
- Keep live lead writes and live customer memory writes disabled until their own approval gates are satisfied.
