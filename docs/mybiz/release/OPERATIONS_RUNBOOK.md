# MyBiz release operations runbook

This runbook is an approval-gated procedure. It is not authority to run SQL, deploy, create users, copy customer data, or send messages.

## Stop conditions

- Stop on a mismatch among domain, Vercel Production deployment/source, frontend/server Supabase target, approved project ref, and current schema/permission fingerprint.
- Stop on unknown MyBiz object ownership, concurrent schema drift, missing safe backup/restore evidence, missing exact approval, or any real PII appearing in a test artifact.
- Stop on an RLS-disabled or over-granted exposed table, failed A/B tenancy check, or a successful UI response without a committed/reread row.
- Do not compensate by weakening RLS, using a browser service-role key, broadening a write gate, or bypassing a security denial.

## Read-only re-anchor

1. Record git worktree/branch/HEAD, remote PR states and approved heads, Production domain alias/deployment/source, and protected untracked paths. Preserve other worktrees and PR #148.
2. Inspect project metadata and deployed-time config through approved read-only interfaces. Never print env values or the protected password. Confirm both client and server DB refs from sanitized runtime/config evidence.
3. Query catalog metadata only with a read-only transaction and timeout where supported. Capture MyBiz-owned schema shape, roles, grants, policies, functions, migration history, and a secret-free fingerprint. Do not query customer rows to prove identity.
4. Compare code-referenced objects with live catalog and classify each as DOCUMENTED, CODE_REFERENCED, LIVE_PRESENT, or RUNTIME_VERIFIED.

## Controlled remediation sequence

1. Reproduce each defect, add a failing regression test, make the smallest correction, and rerun targeted plus integrated lint/typecheck/test/build. The current local candidate is not a substitute for a reviewed PR.
2. Determine an actual backup path and isolated restore destination before any Production schema/security change. Record backup age, retention, roles/Auth/Storage/external-setting exclusions, and measured restore result. A schema+synthetic fixture rehearsal must be labeled as such.
3. In isolation, verify two-store owner/staff/nonmember fixtures, anonymous access denial, profile binding, child/parent tenancy, and both old/new rows on updates. Review exact migration and rollback with an independent reviewer.
4. Obtain separate Owner approval for the exact push/PR, merge/deploy, Production DDL/DML/GRANT, Auth/fixture, backup/export/restore, and any bounded Production write/cleanup. Existing approval of a different head or action does not transfer.
5. Immediately before approved application, recheck Production identity, source and schema fingerprint, backup/restore evidence, and the approved diff. Use a single executor, transaction/lock-timeout where safe, and stop on drift or partial failure.
6. After approved deployment, verify domain -> deployment -> source SHA -> runtime DB ref and repeat affected gate tests. A Preview or synthetic pass cannot certify Production.
7. A Production canary, if separately approved, uses only the approved account/store/marker/row limit. Compare request receipt, commit, fresh-session privileged reread, customer memory link, duplicate retry, and support/log trace without emitting raw PII. Cleanup is a separate approved action.

## Rollback and containment

- Local code candidate: revert only the named local commit or worktree files after checking for later work; do not reset, clean, delete branches, or touch another checkout.
- App deploy: use a previously approved known-good source/deployment only after checking DB compatibility. Pause the affected write entry point if the new app cannot safely operate.
- DB permissions: restore the previously reviewed safe policy/grant set or block the affected route. Never restore RLS OFF or anonymous CRUD as a rollback shortcut.
- Incident: stop new writes/sends, record non-PII event and deployment IDs, preserve evidence, assess affected tenants and legal/privacy notification duties with Owner. Do not export customer rows without separate approval.

## Current checkpoint

The isolated branch resumed at `45068b141a63f91ae298d420a70c5cce16cc8e3d`; this run's health fix and evidence edits are local only. Production remains `41ae32991412d720683ffc1ac0a82f474a2c47ac` on `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5`. `www.mybiz.ai.kr` still resolves to that deployment. The deployed browser's lazy chunk embeds candidate Supabase ref `plnuyudyogbzwpmdulnw`; an embedded endpoint is not proof of an actual browser request or server DB target. The supplied credential file contains `SUPABASE_DB_PASSWORD` only and cannot independently identify a host. G01 remains blocked until a sanitized deployment-time **server** DB ref/provider record or authorized runtime read proves it. Do not infer it from current Vercel settings or force the candidate ref into an environment variable.

### Existing Auth binding and G02 stop

The candidate catalog has `private.profile_auth_bindings` with RLS ON, no client policies, active unique indexes on `auth_profile_id` and `public_profile_id`, and checked `ACTIVE`/`REVOKED` status. `public.profiles` has **no** `auth_user_id` column; `core.profiles.id` references `auth.users.id`. `private.current_service_os_business_profile_id()` accepts an active explicit binding and an active `core.profiles` identity; it also has a guarded exact-ID fallback. `public.store_members` has no `is_active` column: revoke store access by the approved membership removal path, not an invented flag. Current `src/shared/lib/repositories/supabaseRepository.ts::resolveStoreAccess` and `src/server/adminAuth.ts`/`merchantApi.ts` instead require `public.profiles.id = auth user ID`. A valid `OWNER_VERIFIED`/`MIGRATION_VERIFIED`/`ADMIN_VERIFIED` non-identical binding therefore receives 403. The private resolver is not a browser Data API endpoint. Design an approved server-side binding lookup or narrow authenticated resolver and validate it in the disposable Auth/PostgREST stack before any Auth promotion. No email fallback, new identity table, or browser grant on the private table.

Required G02 fixture matrix: exact-ID active, explicitly bound non-identical active, no binding, duplicate/ambiguous binding attempt, revoked binding, inactive `core.profiles`, removed membership, cross-store request, and role escalation. Assert both allow and deny results; all-403 fails. The existing 14 skipped full-stack cases are conditioned on local Supabase stack state. On this Windows host Docker, psql, and Supabase CLI were unavailable, so the old successful GitHub run at `8904cb1` cannot stand in for this candidate.

### G04 exact catalog triage (candidate ref only)

Read-only `pg_catalog`/`information_schema` inspection on 2026-09-25 found the same baseline for **all 15** `public` tables: owner `postgres`, RLS OFF, `anon` SELECT/INSERT/UPDATE/DELETE true, and `authenticated` SELECT true. Only `store_setup_requests` has policies (`SELECT USING auth.uid() = created_by`, `UPDATE USING/WITH CHECK auth.uid() = created_by`), but its RLS flag is OFF. This is a configuration defect; Data API reachability, unauthorized row access, and actual disclosure were **not** tested. No customer row was read. The following ownership and minimum-change assignments are provisional until the deployed server target and access paths are proven.

| Table | Purpose and current code path | Provisional class | Minimum review / regression |
| --- | --- | --- | --- |
| `ai_briefing_logs` | Briefing action history; no direct current runtime table call found | owner unresolved | Identify writer/reader before any grant change; deny anonymous fixture probe. |
| `ai_reports` | Generated report; no direct current Supabase table call found | owner unresolved | Identify report job and tenant key; test cross-store reads and writes. |
| `events` | Order/session event ledger; no direct current table call found | owner unresolved | Locate event producer and retention; test event ownership before policy. |
| `menu_categories` | Store menu; `src/server/publicApi.ts`, `mvpService.ts` | public content through controlled route | Keep public menu route behavior; deny raw unauthenticated writes; test public order compatibility. |
| `menu_items` | Store menu/prices; same paths | public content through controlled route | Keep public menu route behavior; deny raw unauthenticated writes; test public order compatibility. |
| `orders` | Checkout/merchant order; `publicApi.ts`, `merchantApi.ts`, `billingWebhook.ts` | server-controlled transactional | Separate public create, merchant read and webhook update; test duplicate/order tenant boundary. |
| `sessions` | Public ordering session; `publicApi.ts` | server-controlled transactional | Preserve session creation through API; deny raw cross-store read/update. |
| `store_analytics_profile` | Store analytics setup; no direct current table call found | owner unresolved | Confirm legacy ownership and `store_id` text mapping before policy. |
| `store_daily_metrics` | Store aggregate metrics; no direct current table call found | owner unresolved | Confirm writer/report reader; test cross-store read with synthetic rows. |
| `store_home_content` | Store homepage content; `supabaseRepository.ts` | server-only read candidate | Reuse PR #187's **two-table** draft, then test public page fallback and service read in isolation. |
| `store_modules` | Module entitlement state; no direct current table call found | owner unresolved | Identify entitlement authority; fail closed on client mutation. |
| `store_priority_settings` | Store priority weights; `mvpService.ts` | store member only candidate | Reuse PR #187's SELECT/INSERT/UPDATE policy draft; test old/new store key and non-identical binding. |
| `store_setup_requests` | Owner setup PII; `onboardingSetupRequest.ts`, `mvpService.ts` | server-controlled intake | Confirm API write path, turn on reviewed RLS with matching USING/WITH CHECK, and test creator/noncreator/anon. |
| `store_staff` | Staff/access roles; no direct current table call found | owner unresolved | Verify relationship to canonical `store_members`; prevent privilege escalation. |
| `store_tables` | Table-order layout; `publicApi.ts`, `mvpService.ts` | public display through controlled route | Preserve table display; deny raw state mutation by anon; test table-order compatibility. |

PR #187's SQL protects only `store_home_content` and `store_priority_settings`, and its `is_legacy_text_store_member` helper compares `store_members.profile_id` to `auth.uid()`. That excludes a valid non-identical binding and needs G02 design review before promotion. The draft's incident rollback re-enables RLS OFF and broad grants; **do not run it automatically**. Safe containment is to HOLD the affected write route or apply an exact reviewed least-privilege policy with a recovery plan. Do not change every public grant uniformly. Verify exposed schema settings separately before making a Data API or breach claim.

### Release evidence and approval boundary

- G05 local Node HTTP now has bounded fetch **and body** completion; test cases cover missing env, 200 read, fetch/body hangs, invalid body, upstream 500, and 405. Production `/api/health` still timed out after 8 seconds on the old SHA.
- The R3.2 workflow uses two disposable Auth/PostgREST stacks; run `bash scripts/security/run-mybiz-rpc-minimal.sh` only on a machine with Docker, psql, Supabase CLI and `RUNNER_TEMP`, with no remote Supabase credentials. Schema+fixture recreation is not Production backup/restore. Database backups do not include Storage objects or external provider settings; prove each separately.
- Before a Production DDL/GRANT/Auth change, obtain exact candidate DB/runtime identity, verified protected backup and isolated restore, reviewed SQL diff/hash, side-effect and safe rollback. Before a new Git push/PR or deploy, obtain the action-specific Owner authorization. PR #181's historical exact-head deploy approval does not cover this candidate. PR #148 and other projects remain untouched.

### R1 restricted continuation, 2026-09-25

The local candidate adds `supabase/migration_drafts/20260925115116_mybiz_auth_binding_server_resolver.sql` to the **disposable stack only** after the existing RPC draft. The service-role-only public RPC reads the existing private active one-to-one binding, active core identity and public profile. It grants no browser access to `private.profile_auth_bindings` or the resolver. No Production SQL was applied. Application resolution uses the server-verified Auth user ID, then selects the bound public profile and active store membership. `store_members` has no active flag; removal is the fixture's revocation case. A failing unit regression first reproduced a legitimate non-identical binding's 403; local targeted tests now pass. The actual JWT/API result remains NOT_RUN pending an isolated runner.

Original 14 full-stack skips by test ID/title (all require `LOCAL_SUPABASE_STATUS_FILE`):

| Suite | ID / title | Intended execution |
| --- | --- | --- |
| RPC | maps real local Auth token to authenticated in PostgREST | old and new |
| RPC | records old app/old DB direct RPC bypass and new app/old DB HOLD | old only |
| RPC | denies old app/new DB and direct browser access to both RPCs | new only |
| RPC | blocks service-role provisioning while DB control is HOLD | new only |
| RPC | serializes concurrent same-key FREE requests and replays a lost-response retry | new only |
| RPC | holds paid, nonexact, unbound and revoked identities without new rows | new only |
| RPC | does not issue another FREE store when a legacy subscription row is missing | new only |
| RPC | allows only the chosen actor and preserves slug uniqueness | new only |
| RPC | denies a provision waiting behind a binding revocation transaction | new only |
| RPC | denies a provision waiting behind core identity deactivation | new only |
| R5 | has exactly the two intended RLS/ACL surfaces and protected helper | R5 only |
| R5 | denies raw home content to anon and authenticated while preserving service read | R5 only |
| R5 | denies every anon priority operation and authenticated DELETE | R5 only |
| R5 | allows only own-store priority SELECT, INSERT and UPDATE | R5 only |

Five new RPC tests run in the `new` phase only: unique active nonidentical binding through real Auth JWT/server HTTP session; exact binding and unbound denial; revoked/inactive/removed-membership denial; cross-store and role-hint denial; conflicting active binding index rejection. Expected per disposable stack: old phase 2 execute/13 intentional skip, new phase 14 execute/1 intentional skip, R5 phase 4 execute. Without a local status file all 19 are unexecuted. The R5 suite checks only `store_home_content` and `store_priority_settings`; the other 13 G04 tables remain untested by that suite.

The R1 push workflow allowlist and exact checkout assertion are local. The Vercel project's connected root is `.` and the `vercel.json` rule matches only `codex/mybiz-release-closure-r1` with `false`; no other rule can re-enable it. [Vercel documents this rule](https://vercel.com/docs/project-configuration/git-configuration), but an actual suppressed deployment cannot be observed before the first remote branch push. The Owner explicitly made pre-push block confirmation a condition. Therefore do **not** push or dispatch the RPC workflow until that condition has a sufficient independent confirmation or revised Owner direction. Main has no dispatch copy of this RPC workflow; Stage 2 success is not RPC/Auth success. If the gate clears, perform one normal push of the exact final SHA, then read back the GitHub run event, head SHA, checkout summary and Vercel deployment list. Stop on any unexpected deployment.

Deployment-time Vercel metadata for `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5` exposes **names** `SUPABASE_URL`, `VITE_SUPABASE_URL` and `VITE_DATA_PROVIDER`, but no values in the read-only API response. This proves names were associated with that deployment, not their target/provider. Request a sanitized deployment-time `SUPABASE_URL` host/project ref plus `VITE_DATA_PROVIDER`, or an authorized read-only actual server runtime target/provider diagnostic. Do not infer from the browser bundle, current project settings, or the password-only file. G01 remains BLOCKED.

Local rollback: revert the single named candidate commit after checking later work. For the unexecuted SQL draft, no DB rollback is needed. If it is separately approved and applied later, a reviewed rollback may revoke service-role EXECUTE and drop only `public.resolve_verified_merchant_profile_for_server(uuid)` after confirming no server version depends on it; keep Auth write paths on HOLD until compatible code/DB are restored. Never restore broad grants or expose `private` to browser roles.

### First authorized R1 push and isolated CI result

Owner accepted the static exact-branch Vercel rule and project root `.` as the pre-push guard. Fresh local lint/typecheck/build and 952 tests passed with 19 isolated skips. A secret/PII/diff-allowlist scan found 17 expected paths, no PEM/JWT-like additions and only synthetic fixture email additions. Exactly one normal push created remote R1 at `b20a51d920e6b6c9858d0bf4b0a557351bed4ef7`; no PR, main or Production change followed.

[GitHub run 36140852222](https://github.com/mizzang0305-oss/mybizLab/actions/runs/36140852222) has `event=push`, `head_sha=b20a51d...`. The exact checkout equality assertion and credentialless boundary passed. `CHECKOUT_HEAD_SHA=b20a51d...` is derived from that passed assertion; the rendered step-summary value was not independently retrieved. Its install/lint/typecheck/build/test/audit stage passed. The disposable Supabase stack booted on PostgreSQL 17.6; old phase had 2 PASS / 13 intentional SKIP. Before new phase, applying `20260925115116_mybiz_auth_binding_server_resolver.sql` stopped at `min(uuid)` (`function min(uuid) does not exist`, exit 3). Therefore real non-identical positive, negative Auth matrix, new RPC, browser canary and R5 two-table tests were **NOT_RUN**. This is a CI failure, not Auth recovery evidence. The SQL draft now has a local-only `uuid::text` cast before `min` and casts the single result back to uuid; [PostgreSQL 17 aggregate documentation](https://www.postgresql.org/docs/17/functions-aggregate.html) supports `min(text)` but not `min(uuid)`. This local edit has not been verified in a PostgreSQL stack.

Read-only Vercel deployment list after the push found 0 deployments for exact R1 branch/SHA among the latest 100. Production alias still targets `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5` at source `41ae32991412d720683ffc1ac0a82f474a2c47ac`. Record `DEPLOYMENT_SUPPRESSION=PASS` for this push only. No further push, CI rerun or deployment may be inferred from the consumed one-push authorization. Review the local one-line SQL diff and request a separate exact next push/CI authorization; keep SQL as a draft and G01/G02/G04/G10 blocked.
