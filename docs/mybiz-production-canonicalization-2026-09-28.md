# MyBiz Production canonicalization — 2026-09-28

Status: partial, read-only Production reconciliation. No Production SQL, migration repair, Auth/config change, or deployment is authorized by this document.

## Identity and preserved source

- Production project: `plnuyudyogbzwpmdulnw`.
- Owner-reported Production deployment: `dpl_3LDmVdf98HLyyBr4QacHamNiKZdT`, source `a784513df3f5266664b060472931e4b8568f29b0`.
- GitHub branch `release/mybiz-production-security-20260928` points to that exact source SHA. The commit's only changes from security SHA `6608c19982e5854a2d6bdcb578f3a5bcc91fa1c0` are `api/health.ts` and `src/tests/api-health.test.ts`.
- PR #182 is the earlier Draft health patch; PR #189 is the earlier Draft security rollout package. Neither is merged or superseded by a Production mutation here.

## Production ledger and SQL identity

Read-only `supabase_migrations.schema_migrations` has nine versions. The repository before this change had three files under `supabase/migrations`; six remote versions were absent locally. This change adds the two security versions already recorded remotely and one historical provisioning HOLD file. Four remote versions remain absent locally: `20260914041214`, `20260914112340`, `20260914131226`, and `20260925121544`. The last version belongs to Biz2Lab commercial submissions and is not copied into this MyBiz scope without separate review.

| Version | Local canonical file | Production ledger SHA-256 | Local file SHA-256 | Meaning |
| --- | --- | --- | --- | --- |
| `20260927064807` | `supabase/migrations/20260927064807_mybiz_server_provisioning_boundary_20260927.sql` | `1f02f604e32459fbc8224fb2ec9d02d14dffaaaed9eafa5ec5b405a3bdf125cd` | `81cbfb386f9d09858f3acac7e4b2f9849e41eb6712663035a0c81aa57af56c05` | Already recorded in Production |
| `20260927064932` | `supabase/migrations/20260927064932_mybiz_public_rls_compat_20260927.sql` | `dfbf994f1b52b6a6b48fe0b1b20ca50f017ec4da7c6d37c15b4110687eb47741` | `4011dad239954ec7f4e3f6c717500d54952cd6247762e53625cfefc0bb4638d3` | Already recorded in Production |
| `20260928000000` | `supabase/migrations/20260928000000_mybiz_provisioning_hold.sql` | Not present | Record after separate approval only | Exact function EXECUTE HOLD already present in Production catalog |

The first two canonical files are byte-for-byte copies of their Git-tracked draft SQL (LF line endings). Production ledger statements have mixed CRLF/LF line endings, so raw SHA-256 values differ. After replacing CRLF with LF, each Production ledger statement has the same SHA-256 and byte count as its corresponding canonical file. This establishes identical SQL text apart from line endings; it does not authorize replay.

Read-only catalog result: target RLS `15/15`, anon direct CRUD `0/15`, target policy count `11`. `public.provision_store_from_verified_actor(uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text)` exists and is not executable by PUBLIC, anon, authenticated, or service_role. The separate HOLD file records this Owner-applied ACL state; the two security files alone grant service_role EXECUTE and therefore do not reproduce the final Production state.

The Production and disposable `public.is_store_member(uuid)` definitions have the same SHA-256. The provisioning function bodies have different raw hashes because Production preserves CRLF inside the body; after CRLF-to-LF normalization, both bodies hash to `d8a1ec69b505b8fb24772d3acc8e237834da700d93eed63ccf84a960e1fdd23b`.

## Migration history plan

- `20260927064807` and `20260927064932`: no repair. Both are already in the Production ledger with exact frozen hashes.
- `20260928000000`: proposed one-row `applied` history reconciliation only after a separate Owner approval and a fresh catalog/ledger check. `migration repair` must not execute its SQL body, but it does mutate migration history. Do not run it in this task.
- Four earlier remote-only September versions require source reconciliation before claiming a complete from-scratch repository replay or using `db push`. Do not fabricate no-op files or replay their Production SQL by guessing.

## Disposable replay and rollout boundary

For an isolated replay, use the existing synthetic Production-like fixture and old RPC fixture, then apply the canonical provisioning SQL, canonical RLS SQL, and HOLD SQL in that order. Check RLS `15/15`, anon CRUD `0/15`, old RPC denial, new RPC HOLD, policy count, function definition, and bound/revoked identity behavior. The fixture replay validates this security package only; it is not a full reconstruction of the four missing September migrations or customer data.

On 2026-09-28, pinned Supabase CLI `2.117.0` started a disposable Docker stack with that exact order. The existing 31-assertion pgTAP suite initially passed 30 assertions; its sole failure expected the pre-HOLD service_role EXECUTE grant. In the disposable copy of that suite only, changing that one expectation to `service_role` denied produced **31/31 PASS**. The original regression test remains unchanged for the pre-HOLD security draft. No remote Supabase link or credential was used.

Thirteen older repository tests pinned `supabase/migrations` to exactly three filenames. This Git change updates only those expected filename lists to include the three historical canonicalization files; their other assertions remain intact.

Fresh local application checks: lint, typecheck, and build PASS. The first full test run hit one unrelated 5-second publishing-test timeout; that test passed alone (6/6), and a full rerun with two workers passed 907 tests with four existing skips.

Production schema and application code were not changed. Provisioning stays HOLD. No `db push`, `migration repair`, or Production deploy is part of canonicalization. Rollback for this Git-only change is a commit revert; do not reverse the live RLS or restore broad anon grants.

## Auth configuration read-only decision

Dashboard shows organization `FREE`; Email provider and Google OAuth are enabled. Current application code uses `signInWithPassword`; no `signInWithOtp` caller was found in this source SHA. Email minimum password length is 6 and the character requirement has no selected option. Leaked password protection is disabled; the Dashboard states that feature requires Pro or above. No Auth setting was changed.

## Remaining gate

Canonicalization is incomplete until the four remote-only migrations are reconciled, the disposable security replay passes, the canonical PR is reviewed, and the separate Owner decision on the HOLD history row is made. The already closed Production security gate is not reopened or re-applied by this Git task.
