# Supabase Production Baseline Adoption Cleanup

Status: source cleanup Draft PR plan for PR #105. This cleanup implements the PR #104 recommendation `PRODUCTION_BASELINE_ADOPTION_RECOMMENDED` at repository-file level only.

It does not approve or execute `npx supabase migration repair ...`, `npx supabase db push`, `npx supabase migration up`, SQL migration body replay, RLS policy apply, GRANT/REVOKE, live lead write enablement, live customer memory write enablement, env/auth/payment/webhook changes, customer or lead data creation, business table row writes, manual deploys, or stash cleanup.

Baseline:
- Repository: `mizzang0305-oss/mybizLab`
- Origin main HEAD before branch: `2ed7f628f4a4526c989a609df0a618c8fc28937c`
- PR #104: `MERGED`
- Production deploy/smoke after PR #104: `PASS`
- Supabase remote migration history before cleanup: `0` applied rows
- Legacy active migrations before cleanup: `15` local-only files
- Strategy source: PR #104 `PRODUCTION_BASELINE_ADOPTION_RECOMMENDED`
- PII posture: no row samples, no `SELECT *`, no customer/lead raw data

## Decision

The 15 legacy migration files are archived as pre-baseline history and removed from the active Supabase migration replay path. Active `supabase/migrations/` now contains one no-op/comment-only marker:

- `supabase/migrations/20260614_production_baseline_adoption.sql`

This marker documents that production schema already exists, legacy remote migration history was empty, archived migrations must not be replayed on production, metadata adoption/repair still requires separate approval, and future migrations start after this baseline.

## Active Migration Layout After Cleanup

Active migration files:

| Version | Filename | Type | Executes SQL? |
| --- | --- | --- | --- |
| `20260614` | `20260614_production_baseline_adoption.sql` | production baseline marker | no; comments only |

Duplicate active version prefixes: none.

Legacy migration files remaining in `supabase/migrations/`: none.

Archive location:

- `supabase/migrations_archive/pre_baseline_20260614/`

This archive path is intentionally outside `supabase/migrations/`, so it is not part of the active Supabase CLI migration scan path.

## Archived Migration List

The archive manifest is `supabase/migrations_archive/pre_baseline_20260614/MANIFEST.md`.

| Filename | Classification | Cleanup action | Future action |
| --- | --- | --- | --- |
| `20260405_mybiz_v2_phase1_phase2.sql` | `NEEDS_SCHEMA_APPLY` | archive as divergent pre-baseline legacy | replace with current baseline or new current-schema migration if needed |
| `20260406_mybiz_v2_phase3.sql` | `NEEDS_SCHEMA_APPLY` | archive as divergent pre-baseline legacy | replace with current baseline or new current-schema migration if needed |
| `20260422_orders_payment_fields.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | do not replay; future changes start post-baseline |
| `20260424_public_store_text_backfill.sql` | `UNKNOWN_NEEDS_EVIDENCE` | archive as DML-only historical remediation | separate owner-approved data remediation only if still needed |
| `20260424_store_subscriptions_canonical_alignment.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | do not replay; future changes start post-baseline |
| `20260501_platform_admin_console.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future admin changes need post-baseline migrations |
| `20260503_public_site_operating_system.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future public-site changes need post-baseline migrations |
| `20260509_store_content_engine_mvp.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future content changes need post-baseline migrations |
| `20260510_review_request_links.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future review-link changes need post-baseline migrations |
| `20260511_order_items_canonical.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future order-item changes need post-baseline migrations |
| `20260511_review_abuse_guard.sql` | `NEEDS_SCHEMA_APPLY` | archive as absent-but-additive pre-baseline blocker | separate controlled idempotent post-baseline migration if required |
| `20260511_review_public_safety_hardening.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future review hardening needs post-baseline migrations |
| `20260523_store_brand_theme_v2.sql` | `OBSOLETE_OR_DRAFT` | archive as legacy/draft schema target | design a new current-schema brand-theme migration if required |
| `20260603_store_oauth_credentials.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | future OAuth changes need post-baseline migrations |
| `20260609_lead_capture_requests.sql` | `SAFE_TO_REPAIR_APPLIED` | archive as pre-baseline legacy | do not single-repair `20260609`; handle only through baseline adoption approval |

Archive count: `15` SQL files.

## Baseline Marker Rationale

The marker is intentionally no-op/comment-only because this PR is source cleanup, not production database mutation.

Required marker statements:
- Production schema already exists.
- Legacy migration history was empty while the repository had 15 local-only migrations.
- Archived migrations must not be replayed on production.
- The marker requires separate metadata adoption/repair approval before any remote migration-history row is changed.
- Future migrations start after this baseline.

The marker contains no DDL, no DML, no RLS policy SQL, no GRANT/REVOKE, no trigger definition, and no function definition.

## Next Approval Step

After this PR is reviewed and merged, a separate owner approval is still required for any remote Supabase migration-history metadata adoption. The next approval request should include:

- Fresh `npx supabase migration list --linked` output summary.
- Fresh project-ref match confirmation without printing secrets.
- Fresh active migration list showing only `20260614_production_baseline_adoption.sql`.
- Fresh production read-only smoke and schema evidence only if the owner requests it.
- A precise statement of whether the next action is metadata repair, controlled apply, or no DB action.

No metadata command is proposed or executed by this PR.

## Forbidden Commands And Operations

Forbidden in this PR and still requiring separate explicit approval:
- `npx supabase migration repair ...`
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
- committing `supabase/.temp/*`
- deleting stashes

## `.gitignore` And Local Temp Handling

This PR adds `supabase/.temp/` to `.gitignore` so local Supabase link metadata remains untracked. The existing protected local `supabase/.temp/*` files are not staged and must not be committed.

## Rollback Plan

Source rollback:
- Revert the PR commit to restore the previous active migration layout and remove the no-op marker.
- Because the archived SQL files are preserved byte-identically, a normal git revert restores source state without relying on local temp files.

Production rollback:
- No production DB mutation is performed by this PR, so no production DB rollback is needed.
- Do not replay archived migration SQL as rollback.
- Do not run metadata repair as rollback unless separately approved.

## Production Launch Impact

User problem solved:
- Maintainers get a clean active migration baseline after PR #104 showed the old 15-file active history could not be safely repaired or replayed as-is.

Revenue path supported:
- Safer migration hygiene protects future lead capture, customer memory, review trust, content automation, and paid operations persistence work from replaying stale history.

Data that can be collected after separate approved work:
- Migration-list evidence, metadata adoption proof, and future post-baseline migration evidence. This PR collects no customer, lead, payment, message, or business row data.

Remaining before production launch:
- Request separate approval before any Supabase metadata repair.
- Keep `review_submit_attempts` or any other missing feature delta as a new controlled post-baseline migration if still required.
- Keep live lead writes and live customer memory writes disabled until their own launch checklists are approved.
