# Current Production Schema Baseline V1 candidate

This is a **current-state** application schema snapshot, not a reconstruction of
pre-history migrations. It must not be placed in `supabase/migrations`, applied
to Production, or used for `db push` or migration repair.

## Source and generation

- Project: `plnuyudyogbzwpmdulnw`
- Read-only application catalog fingerprint: `939a8dfc366499cf7478bc666a831df299e167f850b9a7667d73be027cb37e06`
- PostgreSQL replay: fresh, unlinked Supabase Local PostgreSQL 17.6
- V3 SHA-256: `402cb6a3f2ee02ed7e3afd1dfcf6ce263d1e44114fc9a20b36cc1d4a87bd7374`
- V4 SHA-256: `e5009643f4d8341687ddc18818719505fff45cfe02257f179520225dff410646`

`generate_candidate_v4.py` appends one deterministic final ACL section to V3.
`application_acl_matrix_v4.json` is read-only catalog metadata. It covers all
85 application tables, one sequence, and 26 functions across `public`, `core`,
`private`, and `biz2lab`. The section explicitly resets and regrants 85 tables,
one sequence, and the 23 functions with explicit Production ACLs. Three
functions retain matching PostgreSQL default ACLs. The generator verifies that
removing this section yields byte-identical V3.

The `platform_exclusions.json` manifest records Supabase bootstrap/default ACL
items excluded from executable SQL and strict application parity. Application
object grants to `anon`, `authenticated`, and `service_role`, plus application
RLS and policies, remain in strict parity scope.

## Verification and boundary

- Single-transaction V4 replay: PASS.
- 17 application catalog categories: 17/17 exact; zero mismatches.
- Sequence ACL and 464 effective role/object privilege comparisons: exact.
- Supabase platform roles, `auth.uid()`, and required extensions: compatible.
- The Stage 2 workflow applies this baseline to its isolated database.
  The current contract confirms `authenticated` own-store reads and direct
  write denial, plus trusted `service_role` writes. A fresh local stack passed
  Stage 2 pgTAP 48/48, revision atomicity, and security pgTAP 31/31. The old
  Stage 2 draft remains historical and is not overlaid on this baseline.
  There is no persisted runtime `service_jobs` create endpoint in this source;
  the existing `ServiceOsDemoPage` uses an in-memory domain model.
- The local DB linter reports one existing `public.create_store_with_owner`
  ambiguous-column error (`42702`). All browser and service-role EXECUTE paths
  for that legacy function remain closed. The Stage 2 workflow permits only
  this exact, unexposed finding and fails on any new lint issue.

The candidate is ready for Owner review as a current-state schema baseline.
It is not a historical migration reconstruction or a Production promotion.

## Canonical local bootstrap

Use a new, unlinked Supabase Local workdir. The active migration scan contains
the comment-only `20260614` marker and the future identity resolver migration;
the marker cannot create the application
schema on its own. The existing Stage 2 certification workflow is the tested
implementation of this order:

1. `supabase init --workdir <disposable-dir> --yes`
2. `supabase start --workdir <disposable-dir> --yes`
3. `supabase db reset --local --workdir <disposable-dir> --no-seed --yes`
4. Apply `current_schema_candidate_v4.sql` with local `psql -X -1 -v ON_ERROR_STOP=1`.
5. Apply only a later migration explicitly classified `REPLAYABLE_FUTURE_MIGRATION`.

The first migration in step 5 is the CLI-created
`20260928232001_service_os_verified_identity_resolver.sql`. It adds a
service-role-only identity lookup after the V4 application objects exist.
Only copy the comment-only marker into the disposable workdir before
`supabase start` / reset; apply V4, then this future migration. Never use `--linked`,
`db push`, or Production credentials for this bootstrap. The four archived
post-baseline SQL files and the provisioning HOLD are historical evidence;
replaying them after V4 would duplicate or conflict with current-state objects.

Local verification changed no Production SQL, Auth, RLS, environment, or
deployment. Git publication and PR review are separate from that evidence;
this baseline must not be applied through `db push` or a Production migration.
