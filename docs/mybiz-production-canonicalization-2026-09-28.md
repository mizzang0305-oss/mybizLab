# MyBiz Production canonicalization — 2026-09-28

Status: partial, read-only Production reconciliation. No Production SQL, migration repair, Auth/config change, or deployment is authorized by this document.

## Identity and preserved source

- Production project: `plnuyudyogbzwpmdulnw`.
- Owner-reported Production deployment: `dpl_3LDmVdf98HLyyBr4QacHamNiKZdT`, source `a784513df3f5266664b060472931e4b8568f29b0`.
- GitHub branch `release/mybiz-production-security-20260928` points to that exact source SHA. The commit's only changes from security SHA `6608c19982e5854a2d6bdcb578f3a5bcc91fa1c0` are `api/health.ts` and `src/tests/api-health.test.ts`.
- PR #182 is the earlier Draft health patch; PR #189 is the earlier Draft security rollout package. Neither is merged or superseded by a Production mutation here.

## Production ledger and SQL identity

Read-only `supabase_migrations.schema_migrations` has nine versions. The repository before this change had three files under `supabase/migrations`; six remote versions were absent locally. This change retains the two security versions already recorded remotely and archives the historical provisioning HOLD outside the active migration scan. Four remote versions remain absent locally: `20260914041214`, `20260914112340`, `20260914131226`, and `20260925121544`. The last version belongs to Biz2Lab commercial submissions and is not copied into this MyBiz scope without separate review.

**Ownership boundary:** `supabase_migrations.schema_migrations` is the ledger for the shared Supabase project `plnuyudyogbzwpmdulnw`, not a ledger owned by the MyBiz Git repository. A version absent from this repository may have been applied from another branch or repository. Do not copy another product's migration into MyBiz or run `db push` from either repository until the project-wide sequence and ownership are reconciled.

| Remote-only version | Owner and originating source | Schema touched | Production ledger SHA-256 | Source/replay decision |
| --- | --- | --- | --- | --- |
| `20260914041214` | **MyBiz**, `codex/mybiz-service-os-schema-promotion-preflight-r1` / `086d6f1d204aa5b49a1ba1b7e966cdf73045d774` (PR #178), `supabase/migration_drafts/20260914005630_mybiz_service_os_foundation.sql` in Git history | `public` Service OS tables, policies, triggers; `private` helper functions | `204d6cfa650e39563b1fc7f5a35795f51395349d7369c141492a9ad7eb698a4f` | Historical SQL blob exists and matches the one-statement ledger hash exactly. Restore its versioned source to MyBiz only after dependency/order review and disposable replay; never reapply to Production. |
| `20260914112340` | **MyBiz**, `codex/mybiz-service-os-auth-identity-readiness-r1` / `9b5f9fd15690bd1a1a1ad537b5927e0a637580be` (PR #179), `supabase/migration_drafts/20260914091947_mybiz_service_os_auth_identity_foundation.sql` in Git history | `private.profile_auth_bindings`, indexes, RLS, identity/membership helper functions; references existing Auth/profile data | `135be389979a38dd5340e8b94c63fb0ba707c0a0a7c7c8533f8b16f2955c93e4` | Historical SQL blob exists and matches the one-statement ledger hash exactly. Restore to MyBiz after foundation dependency review and disposable replay; never reapply to Production. |
| `20260914131226` | **MyBiz**, `codex/mybiz-service-os-stage2-identity-policy-alignment-r1` / `adb9d12ad21ac782c80c03a2a17931597e861bdd` (PR #180), `supabase/migration_drafts/20260914091951_mybiz_service_os_stage2_identity_policy_alignment.sql` in Git history | `public` Service OS policies switched to `private.is_service_os_store_member` | `a5c4480647452919cea3156d94475b941e47698b9ad4a0229122c9a1ff3909d3` | Historical SQL blob exists and matches the one-statement ledger hash exactly. Restore to MyBiz after the identity foundation, then disposable replay; never reapply to Production. |
| `20260925121544` | **Biz2Lab**, `codex/commercial-hub-preview-v1` / `4c7f301da6e65984c8b4f94cf5508bc0b27211cd` (PR #130), `Biz2Lab_Os/supabase/migrations/20260925121544_biz2lab_commercial_submissions.sql` | `biz2lab.commercial_submissions` and narrow `public.biz2lab_commercial_*` RPCs | `5ba3a2cf9a2572aea89aa38e0fe812b5df2d8dc312b78854391c87ba0f483017` for 23 joined ledger statements | Source exists in **Biz2Lab_Os**, not MyBiz. The ledger and live catalog use `biz2lab`, whereas the earlier `3a8c2cd` source used `public`; the later source is the relevant candidate. The split ledger hash is not a byte-level file match, so exact source equivalence needs a dedicated comparison before a full shared-project replay. Keep ownership and replay in Biz2Lab's lane; never copy it into MyBiz as MyBiz-owned SQL. |

| Version | Local canonical file | Production ledger SHA-256 | Local file SHA-256 | Meaning |
| --- | --- | --- | --- | --- |
| `20260927064807` | `supabase/migrations/20260927064807_mybiz_server_provisioning_boundary_20260927.sql` | `1f02f604e32459fbc8224fb2ec9d02d14dffaaaed9eafa5ec5b405a3bdf125cd` | `81cbfb386f9d09858f3acac7e4b2f9849e41eb6712663035a0c81aa57af56c05` | Already recorded in Production |
| `20260927064932` | `supabase/migrations/20260927064932_mybiz_public_rls_compat_20260927.sql` | `dfbf994f1b52b6a6b48fe0b1b20ca50f017ec4da7c6d37c15b4110687eb47741` | `4011dad239954ec7f4e3f6c717500d54952cd6247762e53625cfefc0bb4638d3` | Already recorded in Production |
| `20260928000000` | `supabase/migrations_archive/post_baseline_20260928/20260928000000_mybiz_provisioning_hold.sql` | Not present | Ledger reconciliation deferred; separate Owner decision only | Exact function EXECUTE HOLD already present in Production catalog; SQL preserved outside active scan |

The first two canonical files are byte-for-byte copies of their Git-tracked draft SQL (LF line endings). Production ledger statements have mixed CRLF/LF line endings, so raw SHA-256 values differ. After replacing CRLF with LF, each Production ledger statement has the same SHA-256 and byte count as its corresponding canonical file. This establishes identical SQL text apart from line endings; it does not authorize replay.

Read-only catalog result: target RLS `15/15`, anon direct CRUD `0/15`, target policy count `11`. `public.provision_store_from_verified_actor(uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text)` exists and is not executable by PUBLIC, anon, authenticated, or service_role. The separate HOLD file records this Owner-applied ACL state; the two security files alone grant service_role EXECUTE and therefore do not reproduce the final Production state.

The Production and disposable `public.is_store_member(uuid)` definitions have the same SHA-256. The provisioning function bodies have different raw hashes because Production preserves CRLF inside the body; after CRLF-to-LF normalization, both bodies hash to `d8a1ec69b505b8fb24772d3acc8e237834da700d93eed63ccf84a960e1fdd23b`.

## Migration history plan

- `20260927064807` and `20260927064932`: no repair. Both are already in the Production ledger with exact frozen hashes.
- `20260928000000`: the SQL is archived outside the active migration scan. Optional one-row `applied` history reconciliation requires a separate Owner approval and fresh catalog/ledger check; it is not a PR #190 merge prerequisite. `migration repair` mutates migration history and must not run in this task.
- The three MyBiz September sources were located by exact Git-blob/ledger hash, but are not active migration files in this branch. The Biz2Lab source remains in its owning repository; its split ledger statements need exact source comparison. A complete shared-project replay needs both repository lanes and a verified application order. Do not fabricate no-op files or run `db push` from this incomplete tree.

## Disposable replay and rollout boundary

For an isolated replay, use the existing synthetic Production-like fixture and old RPC fixture, then apply the canonical provisioning SQL, canonical RLS SQL, and HOLD SQL in that order. Check RLS `15/15`, anon CRUD `0/15`, old RPC denial, new RPC HOLD, policy count, function definition, and bound/revoked identity behavior. The fixture replay validates this security package only; it is not a full reconstruction of the four missing September migrations or customer data.

On 2026-09-28, pinned Supabase CLI `2.117.0` started a disposable Docker stack with that exact order. The existing 31-assertion pgTAP suite initially passed 30 assertions; its sole failure expected the pre-HOLD service_role EXECUTE grant. In the disposable copy of that suite only, changing that one expectation to `service_role` denied produced **31/31 PASS**. The original regression test remains unchanged for the pre-HOLD security draft. No remote Supabase link or credential was used.

Thirteen older repository tests pin the active `supabase/migrations` filenames. Their expected lists exclude the archived HOLD; its preserved SHA-256 is verified separately. The three historical MyBiz sources remain outside this PR and are not added to the active migration chain.

Fresh local application checks: lint, typecheck, and build PASS. The first full test run hit one unrelated 5-second publishing-test timeout; that test passed alone (6/6), and a full rerun with two workers passed 907 tests with four existing skips.

Production schema and application code were not changed. Provisioning stays HOLD. No `db push`, `migration repair`, or Production deploy is part of canonicalization. Rollback for this Git-only change is a commit revert; do not reverse the live RLS or restore broad anon grants.

## Auth configuration read-only decision

Dashboard shows organization `FREE`; Email provider and Google OAuth are enabled. Current application code uses `signInWithPassword`; no `signInWithOtp` caller was found in this source SHA. Email minimum password length is 6 and the character requirement has no selected option. Leaked password protection is disabled; the Dashboard states that feature requires Pro or above. No Auth setting was changed.

## Remaining gate

Historical full replay remains incomplete until the three historical MyBiz sources are restored and replayed in order and the Biz2Lab-owned source is compared with its split ledger without changing ownership. PR #190 still needs review. The HOLD history row is deferred to a separate Owner decision and is not a merge prerequisite. The scoped disposable security replay passed; a complete shared-project replay has not run. The already closed Production security gate is not reopened or re-applied by this Git task.

## Provisioning HOLD archive safety

`20260928000000` has a Production catalog ACL state of **PRESENT**, a Production
migration ledger row of **ABSENT**, and byte-identical SQL evidence under
`supabase/migrations_archive/post_baseline_20260928/`. Its classification is
`HISTORICAL_PRODUCTION_STATE_EVIDENCE` and its replay is **FORBIDDEN**. The
archived SQL is outside the active `supabase/migrations/` scan. Ledger-only
reconciliation is **DEFERRED_SEPARATE_OWNER_DECISION** and is **not required**
for PR #190 merge. `CURRENT_PRODUCTION_SCHEMA_BASELINE_V1` remains the current
canonical application schema starting point. No Production SQL, migration
repair, or `db push` was run to archive this evidence.
