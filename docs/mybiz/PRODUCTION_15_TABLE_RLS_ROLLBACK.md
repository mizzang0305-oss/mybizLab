# 15-table RLS rollback — Draft and isolated rehearsal only

Rollback candidate: `supabase/migration_drafts/20260923040858_mybiz_15_table_rls_exact_shape_rollback.sql`. It is **not** an active migration and is not approved for Production. [Two clean isolated rehearsals](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35817773591) restored the prior RLS/grant/policy shape with no row deletion or rewrite.

## Scope

- Drops only the ten new target policies and `private.is_legacy_text_store_member(text)`.
- Restores RLS disabled on the exact 15 targets and their prior effective broad anon/authenticated/service_role grants in the isolated fixture.
- Preserves the two pre-existing `store_setup_requests` policies; changes no other table, function, profile, membership, payment, Auth or Service OS policy.
- Contains no `DELETE`, `TRUNCATE`, data rewrite or `DROP TABLE`.

## Safety warning

This rollback intentionally restores the previous insecure access surface. In Production it would require a separately approved incident decision, exact post-apply state guard, operational containment and follow-up remediation. Do not automatically run it for a failed smoke or transient connectivity issue. If another migration, grant or policy changed after the candidate, the rollback's exact-state guard must fail; forward-fix or a newly rehearsed targeted rollback is required.

## Future rollback verification

Before execution: confirm exact candidate was committed once, no later target privilege/policy modification, source/hash match, only the 15 intended tables affected, and owner authorization. After execution: independently verify 15 RLS-disabled flags, seven effective privileges for all three roles, original two dormant setup-request policies only, helper absence, unchanged row counts, unchanged non-target policy/function fingerprints, and HTTP health. Capture sanitized evidence only. A migration-history correction requires its own separately approved procedure; do not manually edit history in this readiness phase.
