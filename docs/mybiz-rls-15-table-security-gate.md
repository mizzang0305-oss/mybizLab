# MyBiz 15-table RLS security gate (draft, 2026-09-26)

**Decision:** `MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY=false`. This is a source and read-only catalog inventory, not a Production migration authorization. The existing draft `supabase/migration_drafts/20260926_mybiz_legacy_public_rls_hardening.sql` is **not promotable** until the blockers below are closed.

## Source and catalog boundary

- Source: `main` at `41ae32991412d720683ffc1ac0a82f474a2c47ac`, existing security candidate at `60dd7ce517ee68f73b0f5ff2d1693dc8ebd73e13` plus local review edits.
- Target: `plnuyudyogbzwpmdulnw`, catalog read only. All 15 tables below currently have RLS **off** and `anon`/`authenticated` `SELECT, INSERT, UPDATE, DELETE` grants. Existing `store_setup_requests` own-row policies are inert while RLS is off. Catalog privileges alone do not prove row exposure through every API route, and no customer rows were inspected.
- Repo `supabase/migrations/` has three tracked migrations; the Production migration list has six, including three September service-OS migrations. The CI fixture reconstructs simplified tables, not the exact live schema. It cannot certify Production compatibility by itself.
- `src/integrations/supabase/client.ts` is a browser anon-key client; `src/server/supabaseAdmin.ts` is the service-role server client. A browser bundle endpoint is not evidence of the server runtime DB target.

Legend: `R/I/U/D` = select/insert/update/delete; `B-A` = browser anon; `B-M` = authenticated merchant browser; `S` = server service role. `none found` means no exact active code call was found in the inspected source, not proof that an external caller does not exist. Each row's current privilege state is `anon=RIUD, authenticated=RIUD, RLS=off`.

| Table | Read callers | Write callers | B-A / B-M / S observed | Public / merchant / fallback | Current required | Classification | Proposed target: anon; auth; service role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `store_tables` | `mvpService` live table read; public API snapshot | `mvpService` merchant insert; server public order path may read table | B-A unproven / B-M R,I / S R | public table view; merchant table setup | merchant R,I; public server R | `AUTH_MEMBER_REQUIRED` + `UNKNOWN_BLOCKER` | none; member R,I; RIUD only where server path proves it |
| `sessions` | public server order/session path | `publicApi` session insert | B-A none found / B-M none found / S I | public ordering through API | server I | `SERVER_ONLY` | none; none; required server operations |
| `orders` | `mvpService` live merchant read; `publicApi` order lookup | `mvpService` customer-link update; `publicApi` create/update | B-A none found / B-M R,U / S R,I,U | public order API; merchant orders | member R,U; server R,I,U | `AUTH_MEMBER_REQUIRED` + `SERVER_ONLY` | none; member R,U; server R,I,U |
| `events` | no exact active table call established | no exact active table call established | B-A none / B-M none / S unproven | mock/local references only in reviewed paths | unknown | `UNKNOWN_BLOCKER` | none; none; server only if caller confirmed |
| `menu_categories` | `mvpService` live menu read; public server snapshot | `mvpService` merchant insert | B-A unproven / B-M R,I / S R | public menu; merchant setup | member R,I; public server R | `AUTH_MEMBER_REQUIRED` + `UNKNOWN_BLOCKER` | none pending public flow proof; member R,I; server R |
| `menu_items` | `mvpService` live menu read; public server snapshot | `mvpService` merchant insert | B-A unproven / B-M R,I / S R | public menu; merchant setup | member R,I; public server R | `AUTH_MEMBER_REQUIRED` + `UNKNOWN_BLOCKER` | none pending public flow proof; member R,I; server R |
| `store_staff` | no exact active table call established | no exact active table call established | B-A none / B-M none / S unproven | no demonstrated live route | unknown | `UNKNOWN_BLOCKER` | none; none; server only if caller confirmed |
| `store_modules` | no exact active table call established | no exact active table call established | B-A none / B-M none / S unproven | no demonstrated live route | unknown | `UNKNOWN_BLOCKER` | none; none; server only if caller confirmed |
| `ai_briefing_logs` | no exact active table call established | no exact active table call established | B-A none / B-M none / S unproven | no demonstrated live route | unknown | `UNKNOWN_BLOCKER` | none; none; server only if caller confirmed |
| `store_analytics_profile` (singular) | no exact active call; plural `store_analytics_profiles` is used | no exact active call | B-A none / B-M none / S unproven | probable legacy, origin unconfirmed | unknown | `UNKNOWN_BLOCKER` | none; none; quarantine, do not drop |
| `store_priority_settings` | `mvpService` live read | `mvpService` upsert; old provisioning RPC writes | B-A none / B-M R,I,U / S I | merchant settings | member R,I,U; provisioning server I | `AUTH_MEMBER_REQUIRED` | none; member R,I,U; server required writes |
| `store_daily_metrics` | mock/local references; no exact active DB call | no exact active DB call | B-A none / B-M none / S unproven | no demonstrated live route | unknown | `UNKNOWN_BLOCKER` | none; none; server only if caller confirmed |
| `ai_reports` | mock/local references; no exact active DB call | no exact active DB call | B-A none / B-M none / S unproven | no demonstrated live route | unknown | `UNKNOWN_BLOCKER` | none; none; server only if caller confirmed |
| `store_home_content` | `supabaseRepository.loadLegacyStorePublicPage()` | old provisioning RPC writes | B-A possible fallback / B-M no direct call proven / S R,I | public page legacy fallback | fallback need unproven | `LEGACY_FALLBACK` + `UNKNOWN_BLOCKER` | undecided until fallback test; no merchant write proven; server R,I |
| `store_setup_requests` | server onboarding/provisioning lookup | server onboarding insert; `mvpService` browser insert branch unreachable in normal non-demo browser by `shouldUseServerBackedSetupRequestSave()` | B-A no normal browser write / B-M no normal browser write / S R,I,U | onboarding API | server R,I,U | `SERVER_ONLY` + `UNKNOWN_BLOCKER` | none; own R,U only if authenticated path is proven; server R,I,U |

The table above is a **target design**, not a tested GRANT/RLS matrix. In particular, `anon UPDATE/DELETE=false` for all 15 and `anon /orders SELECT=false` are required. A public page requiring direct `store_home_content` read would require a narrowly tested read policy or a server boundary, not blanket anon CRUD.

## Function and compatibility review

| Function | Current security and execution | Finding / next proof |
| --- | --- | --- |
| `public.is_store_member(uuid)` | SECURITY DEFINER, `search_path=public`, authenticated EXECUTE | Current Production body compares `store_members.profile_id=auth.uid()` only. The existing R1 design permits a unique active `private.profile_auth_bindings` mapping where Auth ID differs from profile ID. Using this function in the eight draft policies can reject a legitimate member. Review all existing policies calling it, then test a binding-aware replacement against exact Production-like schema and negative matrix. Do not open private schema to browser. |
| `public.create_store_with_owner(...)` | SECURITY DEFINER, `search_path=public,pg_temp`, authenticated EXECUTE | Checks signed-in user, but accepts caller plan; it can write despite table RLS. Current server `api/stores/provision.ts` calls it with service role. Direct authenticated EXECUTE remains in the existing draft. Revoke only after proving the deployed provisioning path and R1 compatibility, including rollback. |
| `public.generate_unique_store_slug(text)` | SECURITY DEFINER, `search_path=public`, anon/authenticated EXECUTE | No direct client RPC call found. Existing draft revokes client EXECUTE, but helper is still invoked by provisioning. Test server RPC and search-path behavior in the ephemeral stack. |

`store_analytics_profile` (singular) and `store_analytics_profiles` (plural) are separate tables. No exact runtime reference, FK dependency or migration origin was established for the singular table. Approximate catalog row counts are not proof of disuse.

## Required proof before an approval package

1. Reconstruct exact Production column types, constraints, grants, policies, function bodies and the three September migrations in a disposable database. Compare schema manifests before applying the draft. The current handwritten CI fixture is insufficient.
2. Replace the draft's blanket authenticated CRUD grants with the per-operation matrix above. Prove `public.is_store_member` accepts **unique active non-identical binding + active membership**, rejects unbound/revoked/duplicate/inactive/cross-store/role escalation, and preserves every existing caller.
3. Exercise real PostgREST and server HTTP paths for public page/menu/table/order/inquiry, merchant dashboard/settings/orders, and onboarding after RLS. Include both success and denial paths. SQL predicate-only pgTAP checks do not establish these flows.
4. Check all 15 tables with anon, authenticated nonmember/member/owner and service role for R/I/U/D as applicable, including cross-store SELECT/UPDATE/DELETE. Record any intentionally unsupported operation separately. Verify service-role material never enters Vite output.
5. Re-run advisor in the disposable database, full application tests, lint, typecheck and build. Pin candidate SHA and migration SHA. Design application rollback separately from DB policy rollback; restoring blanket anon CRUD is not an acceptable safe rollback.

## Current CI evidence and safe next action

The earlier GitHub run `36192879802` failed in source-isolation verification before Docker, migrations or tests. Its grep expression matched its own workflow source. The anchored guard was pushed once at `16d0b6ca564a33dcf01dfd9a5d2e8a6b8bf4b236` under the Owner's bounded approval. [Run 36196870278](https://github.com/mizzang0305-oss/mybizLab/actions/runs/36196870278) completed successfully on the exact PR head and checkout SHA: Docker, pinned Supabase CLI, disposable PostgreSQL 17.6, baseline and RLS draft apply, 25 pgTAP assertions, DB lint, seven focused app test files, and full lint/typecheck/build/896 tests. The fixture records 15 RLS-enabled tables, zero anon direct CRUD privileges, and Store A-only SELECT for eight merchant tables. This is **ephemeral fixture evidence**, not Production-equivalent certification.

### Post-CI gap analysis (local only; no second push)

- `FIXTURE_MODELS_NONIDENTICAL_AUTH_PROFILE_BINDING=false`. Its `public.is_store_member(uuid)` compares `store_members.profile_id = auth.uid()` and has no `private.profile_auth_bindings` or active core profile. The read-only Production function has the same exact-ID limitation. The eight merchant policies therefore fail legitimate non-identical bindings proven by the separate R1 Auth test; a green fixture run cannot make this compatible.
- `CROSS_STORE_SELECT=PASS` in the fixture for the eight tested member tables. Store B INSERT/UPDATE/DELETE attempts were not made: `CROSS_STORE_INSERT/UPDATE/DELETE=NOT_TESTED`. The 25 assertions are not a 15-table-by-four-operation-by-role matrix.
- Read-only `information_schema.columns` comparison found **at least 38 Production columns omitted** by the fixture across `events` (6), `ai_reports` (6), `store_daily_metrics` (15), `store_home_content` (4), and `store_setup_requests` (7). Supporting `stores`/`store_members` and function contracts were not fully compared. The fixture is not the exact Production schema; Production migration history also contains three September entries absent from active repository migrations.
- The focused application tests include Vitest mocks for repository, Supabase or fetch boundaries. Their CI step does not connect these tests to the hardened disposable DB, so they are `APPLICATION_UNIT` evidence, not `ACTUAL_EPHEMERAL_HTTP` or `ACTUAL_EPHEMERAL_POSTGREST`. Public page, menu, table/order, inquiry, onboarding, dashboard/settings, merchant orders, analytics and AI report flows all remain unproven **after** RLS in a real HTTP runtime.
- The draft grants authenticated `RIUD` on eight tables. Source inspection establishes browser `R,I` for `store_tables`, `menu_categories`, `menu_items`; `R,U` for `orders`; and `R,I,U` for `store_priority_settings`. Browser `D` for these five and any direct browser operation for `store_daily_metrics`, `ai_reports`, `store_home_content` were not established. Treat those grants as `OVERPRIVILEGED_DRAFT`, not an approved target matrix.
- The fixture contains a simplified slug helper and membership helper but no `create_store_with_owner` RPC. Thus the slug EXECUTE revocation and old authenticated provisioning RPC have not been tested through real onboarding. `SAFE_APPLICATION_ROLLBACK` and `EMERGENCY_COMPAT_ROLLBACK` remain design tasks; neither may restore blanket anon CRUD automatically.

**Next exact patch scope:** in a later separately approved revision, correct the existing fixture toward the catalog/function contract, add non-identical active binding and negative identity cases, exercise cross-store INSERT/UPDATE/DELETE and real HTTP/PostgREST flows, and narrow authenticated grants table by table. Keep SQL draft-only and use one new exact SHA for hosted CI. No additional push or Production action occurred in this post-CI analysis.

The authorized Git push automatically created Vercel Preview `dpl_6KjudEkT5kvetHc7RsJtQoxCGLTM` at the pushed SHA. It is `READY`, `target=null`; it was not manually deployed or promoted. Production remains `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5` at `41ae32991412d720683ffc1ac0a82f474a2c47ac` with the existing public aliases.

No Production DB write, Auth change, deployment, Biz2Lab change or AgentOps work is authorized by this document.

## V2 local-only checkpoint (2026-09-26)

The V2 draft now adds `public.is_bound_store_member(uuid)` for **these target
policies only**. It resolves `auth.uid()` through one active, unrevoked
`private.profile_auth_bindings` row, active `core.profiles`, an existing
`auth.users` and `public.profiles` row, and a `store_members` row for the
requested store. `store_members` has no active/status flag in the read-only
Production catalog; removal of the membership is the revocation mechanism.
The pre-existing `is_store_member` remains unchanged because its callers
extend beyond the 15-table gate. The helper is SECURITY DEFINER with an empty
search path, qualified references, and authenticated-only EXECUTE.

The following is the **draft target**, not a verified Production grant state.
The fixture's service role retains RIUD on all 15 for existing server paths.

| Table | Classification | anon R/I/U/D | auth R/I/U/D | Policy / caller rationale |
| --- | --- | --- | --- | --- |
| `store_tables` | merchant + public server | ---- | RI-- | bound membership; `mvpService` reads/inserts; public API reads |
| `sessions` | server only | ---- | ---- | public order legacy session |
| `orders` | merchant + public server | ---- | R-U- | bound membership; merchant read/customer-link update; public API writes |
| `events` | quarantined legacy | ---- | ---- | no active target-table caller established |
| `menu_categories` | merchant + public server | ---- | RI-- | bound membership; menu read/insert; public API reads |
| `menu_items` | merchant + public server | ---- | RI-- | bound membership; menu read/insert; public API reads |
| `store_staff` | quarantined legacy | ---- | ---- | no active target-table caller established |
| `store_modules` | quarantined legacy | ---- | ---- | no active target-table caller established |
| `ai_briefing_logs` | quarantined legacy | ---- | ---- | no active target-table caller established |
| `store_analytics_profile` | quarantined legacy | ---- | ---- | singular legacy table; plural table is separate |
| `store_priority_settings` | merchant + server | ---- | RIU- | bound membership; `mvpService` read/upsert |
| `store_daily_metrics` | server only | ---- | ---- | no direct browser DB caller established |
| `ai_reports` | server only | ---- | ---- | no direct browser DB caller established |
| `store_home_content` | legacy server fallback | ---- | ---- | `loadLegacyStorePublicPage` via server admin path; canonical page path preferred |
| `store_setup_requests` | onboarding server | ---- | ---- | server endpoint inserts; own-row policy retained without client grant |

The fixture now carries the 38 previously omitted target columns in
`events` (6), `ai_reports` (6), `store_daily_metrics` (15),
`store_home_content` (4), and `store_setup_requests` (7). The latter's
`requested_slug` and `email` also have local indexes for the real onboarding
lookup. `stores` has the canonical repository select columns; the fixture
adds the existing core/private binding shape and unique active indexes.
These changes are source alignment only. `FIXTURE_MISSING_REQUIRED_COLUMNS`
remains `UNKNOWN` until the hardened HTTP paths run.

The revised pgTAP draft uses nonidentical synthetic Auth/profile IDs, own-store
positive operations, cross-store SELECT/INSERT/UPDATE/DELETE boundaries
(ungranted operations are asserted by privilege), and revoked/inactive/missing/
conflicting/unbound/other-store identities. It has **not** run in a disposable
Supabase stack in this checkpoint: local Docker, psql and Supabase CLI are
unavailable. The inert fixture body of `create_store_with_owner` tests its
EXECUTE ACL only; it is not provisioning compatibility evidence.

After the narrow R1 server-path port, local lint/typecheck/build and all
903 Vitest tests in 155 files passed; the three focused Auth tests passed
15/15. Those tests use mocks and do not replace real JWT/HTTP proof. A source
scan of the current Vite output found no `SUPABASE_SERVICE_ROLE_KEY` or
`service_role` marker, but no key value was inspected. `git diff --check`
passed. The V2 SQL, pgTAP, PostgREST, onboarding/inquiry/order HTTP, DB lint
and rollback rehearsal remain `NOT_RUN`.

**Independent runtime blocker:** the remote PR HEAD still uses an exact
Auth/profile lookup. This local-only draft carries the narrow R1 verified
binding resolver path in `adminAuth`, `merchantApi`,
`supabaseRepository`, its contract and focused unit tests. The SQL draft
also carries the server-only resolver function. The Production catalog does
not contain that function. R1 at
`d92b3e4a1ae3c60fa19425d770f7d78058e55847` supplied the already
verified design, but no V2 real JWT/HTTP test has run. This introduces a
cross-branch Auth rollout dependency and an exact Production SQL apply order;
the R1 resolver draft must not be applied a second time after this draft.
Do not deploy the local runtime patch against a DB without the resolver, and
do not use a mocked or all-403 route to claim V2 closure.

**Gate:** `MYBIZ_RLS_COMPATIBILITY_V2_VERIFIED=false`,
`MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY=false`. No V2 push or hosted CI
has occurred at this checkpoint. A single push remains authorized only after
the full PostgREST, hardened HTTP, function, rollback and local validation
package is ready. Production SQL/credential changes remain prohibited.

## V2 full-stack harness candidate (local; Hosted CI result pending)

The earlier local-only checkpoint above remains historical evidence. This
candidate keeps the R1 resolver in its own exact draft file,
`20260925115116_mybiz_auth_binding_server_resolver.sql`, and the V2 RLS draft
depends on it. The new `is_bound_store_member(uuid)` calls that one canonical
resolver using `auth.uid()` and then checks `store_members.profile_id` for the
target store. It does not duplicate the private binding query. The existing
`is_store_member(uuid)` is not replaced: a read-only Production catalog query
found **32 policies outside this 15-table target** that still refer to it.
Those other policies need a separately bounded compatibility decision before
any claim of platform-wide non-identical identity support. This is a known
approval blocker, not an assumed PASS.

### Exact disposable SQL order

1. `mybiz_rls_security_compat_ci_baseline.sql`: synthetic target tables,
   binding foundation and support relations; no remote data.
2. Existing `20260318_fix_create_store_with_owner_live.sql` **only inside the
   disposable CI root** so the provisioning function has its real source body,
   rather than an inert fixture placeholder. It is not a new Production apply
   proposal.
3. R1 verified resolver draft. It guards the identity foundation and refuses
   to replace an existing resolver.
4. V2 legacy public RLS hardening draft. It refuses to run before the resolver.
5. Supabase Local/PostgREST schema reload through `supabase db reset`, 49 pgTAP
   assertions, real JWT/PostgREST matrix, actual Node HTTP handlers, DB lint,
   application quality gates, then safe rollback rehearsal.

The actual HTTP harness imports the existing `/api/auth/session`,
`/api/public`, `/api/onboarding/setup-request` and `/api/merchant` handlers.
Its `LOCAL_SUPABASE_STATUS_FILE` is generated by `supabase status -o env` in
the hosted ephemeral runner and validated to contain only `127.0.0.1` API/DB
targets before use. No Production credential is injected. Five roles are
exercised: anon, authenticated non-member, non-identical Store A member,
non-identical Store B member, and service role. It requests SELECT, INSERT,
UPDATE and DELETE for all 15 target tables; required own-store writes and
cross-store denies are separate assertions. The HTTP paths include a
pre-payment public order only, with no payment provider request.

The read-only Production catalog also confirms UUID identifiers on
`visitor_sessions`, `customers`, `customer_contacts`, `customer_preferences`,
`customer_timeline_events`, `conversation_sessions`, `conversation_messages`
and `inquiries`. Prefix-based `createId()` values in the public inquiry
write chain could not persist into those UUID columns; the candidate changes
only those persisted IDs to `createUuid()`. This is a runtime compatibility
patch, not a new data model. The disposable support fixture follows the
existing legacy repository fallback shape. The HTTP run must still prove the
full path; local unit tests cannot do so.

A read-only `information_schema.columns` comparison of the 15 target tables
found **147 Production columns, zero missing fixture columns and zero basic
type mismatches** (UUID/text/integer/boolean/jsonb/array/numeric/date/
timestamptz). This establishes column-shape alignment for the target set,
not constraint, data, PostgREST or HTTP compatibility. Those remain the
Hosted CI gates.

### Safe rollback and Production execution draft

**Application rollback:** HOLD the affected public/merchant routes or return a
temporary unavailable response, then restore a previously safe compatible
application SHA while retaining the resolver and hardened DB permissions.
Never deploy a server build that invokes the resolver before the resolver is
present. Observe the route error rate and synthetic smoke before reopening.

**DB compatibility HOLD:**
`20260926_mybiz_rls_safe_server_only_rollback.sql` removes only the five
newly granted authenticated direct-operation sets. It keeps all 15 RLS flags,
all zero anon direct CRUD, policies and service-role CRUD. It is deliberately
a server-only HOLD state, not a restoration of old broad grants. CI rechecks
these invariants with five pgTAP assertions and actual server HTTP requests
after applying the rollback.
Production application of this draft requires its own exact Owner approval.

Local draft SHA256 (source bytes, LF; recheck against the final Git blob before
Production approval): resolver
`53A97109F6AA76E9DF8217C228C439C7A44FAA69AC26A57E08A552C04DE7041C`,
V2 RLS
`0C21D18B0DC7C51A7A69AF75DA21259725543C7BB99DF1FE2594F4CD4A02E305`,
safe server-only rollback
`1176EC672A2398D3430BFDE502A7C417F2AAF3929500859360E9B49CFCB04F84`.

Proposed order, **not authorized for execution**:

1. Confirm exact Production project/deployment identity and backup plus
   tested recovery point; retain the rollback window and operators.
2. Review/apply the exact resolver SQL only if absent, then verify server-role
   EXECUTE and non-identical binding semantics. Existing binding foundation
   remains untouched.
3. Deploy a resolver-compatible application SHA only after step 2, with
   affected merchant routes held until smoke. Existing browser operations
   must be checked before the privilege change.
4. Review/apply the exact V2 RLS draft and recheck 15 RLS flags, anon CRUD 0,
   authenticated target grants, service-role public/onboarding paths, and
   negative cross-store access.
5. Perform synthetic Production smoke for Auth session, public page/menu,
   inquiry, onboarding, pre-payment order, and merchant cross-store denial;
   verify no secret in browser assets and no unintended Preview promotion.
6. Observe the rollback window. On failure hold affected routes first;
   use the narrow server-only DB rollback only under a separate approval.

No exact migration SHA, code SHA, hosted CI result or full-stack PASS is
recorded in this draft section until the final candidate is committed and the
exact CI checkout is observed. `MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY=false`
while those proofs and the 32-policy identity boundary remain unresolved.

### V3 read-only Production policy manifest (2026-09-26)

The latest catalog has **33** `is_store_member(uuid)` policies on **22** RLS-enabled
tables. This supersedes the earlier 32-policy count. Roles: 19 `PUBLIC`, 14
`authenticated`; commands: 16 ALL, 6 SELECT, 5 INSERT, 6 UPDATE. None of
these tables overlaps the 15-table V2 migration. This manifest contains no
customer rows. Recheck all counts before any Production apply and stop on drift.

| Table | Policy | Command | Roles | RLS |
| --- | --- | --- | --- | --- |
| `conversation_messages` | `conversation_messages_member_access` | ALL | public | ON |
| `conversation_sessions` | `conversation_sessions_member_access` | ALL | public | ON |
| `customer_contacts` | `customer_contacts_insert_store_member` | INSERT | authenticated | ON |
| `customer_contacts` | `customer_contacts_select_store_member` | SELECT | authenticated | ON |
| `customer_contacts` | `customer_contacts_update_store_member` | UPDATE | authenticated | ON |
| `customer_preferences` | `customer_preferences_member_access` | ALL | public | ON |
| `customer_timeline_events` | `customer_timeline_events_insert_store_member` | INSERT | authenticated | ON |
| `customer_timeline_events` | `customer_timeline_events_select_store_member` | SELECT | authenticated | ON |
| `customer_timeline_events` | `customer_timeline_events_update_store_member` | UPDATE | authenticated | ON |
| `customers` | `customers_insert_store_member` | INSERT | authenticated | ON |
| `customers` | `customers_select_store_member` | SELECT | authenticated | ON |
| `customers` | `customers_update_store_member` | UPDATE | authenticated | ON |
| `inquiries` | `inquiries_insert_store_member` | INSERT | authenticated | ON |
| `inquiries` | `inquiries_select_store_member` | SELECT | authenticated | ON |
| `inquiries` | `inquiries_update_store_member` | UPDATE | authenticated | ON |
| `lead_capture_requests` | `lead_capture_requests_store_member_select` | SELECT | authenticated | ON |
| `lead_capture_requests` | `lead_capture_requests_store_member_update` | UPDATE | authenticated | ON |
| `order_items` | `order_items_member_access` | ALL | public | ON |
| `reservations` | `reservations_member_access` | ALL | public | ON |
| `review_request_links` | `review_request_links_member_access` | ALL | public | ON |
| `social_accounts` | `social_accounts_member_access` | ALL | public | ON |
| `social_publish_jobs` | `social_publish_jobs_member_access` | ALL | public | ON |
| `store_analytics_profiles` | `store_analytics_profiles_member_access` | ALL | public | ON |
| `store_blog_posts` | `store_blog_posts_member_access` | ALL | public | ON |
| `store_media_assets` | `store_media_assets_member_access` | ALL | public | ON |
| `store_members` | `store_members_insert_member` | INSERT | public | ON |
| `store_members` | `store_members_select_member` | SELECT | public | ON |
| `store_members` | `store_members_update_member` | UPDATE | public | ON |
| `store_public_pages` | `store_public_pages_member_access` | ALL | public | ON |
| `store_reviews` | `store_reviews_member_access` | ALL | public | ON |
| `store_subscriptions` | `store_subscriptions_member_access` | ALL | public | ON |
| `stores` | `stores_member_access` | ALL | public | ON |
| `waiting_entries` | `waiting_entries_member_access` | ALL | public | ON |

The V3 draft replaces only the body of `public.is_store_member(uuid)` with a
call to the existing `private.is_service_os_store_member(uuid)`. Its contract,
owner and ACL remain unchanged; no policy DDL is part of that draft. The
disposable fixture exercises exact-ID fallback, active verified binding,
revocation, inactive core identity, unbound/nonmember denial, cross-store
denial and the `store_members` self-policy. These are CI requirements, not
Production PASS claims.

Provisioning is a separate blocker: current Production has the 9-argument
`create_store_with_owner` with `auth.uid()`, while the prior app used a
service-role call without a Bearer owner. V3 drafts a service-role-only
`create_store_with_verified_owner` and requires server `auth.getUser(token)`,
matching owner/setup-request email and paid verification before its call.
The existing RPC is retained as an object with client/API EXECUTE removed by
the V2 draft. Actual Production execution, backup and recovery remain gated.

### V3 preflight, rollout and newly observed privilege blocker

The exact Production preflight must compare the 33 policy identities and 22
RLS flags above with a fresh read-only catalog result. A count mismatch stops
the change. Compare the current function owner, result type and EXECUTE ACL
before replacing its body; verify the same ACL and policy definitions after.
The disposable fixture covers representative policy shapes, not all 33 live
policy bodies. `LOCAL_RLS_PHASE=provision` requires real local Auth, a verified
Bearer owner, a service-role-only RPC, synthetic paid verification and direct
RPC denial. No Production payment or customer row is used.

Production order remains **draft, not authorization**: (0) exact target and
backup/recovery evidence; (1) server resolver if absent; (2) existing policy
identity helper; (3) server-only provisioning RPC; (4) deploy the compatible
app with provisioning/merchant writes held; (5) V2 15-table RLS hardening;
(6) read-only ACL/RLS/policy check; (7) separately approved synthetic smoke;
(8) reopen routes and observe the rollback window. Code that calls the new
RPC cannot precede step 3. The old RPC remains inaccessible to browser roles.
On failure, hold the affected application routes first; never disable RLS or
restore broad anonymous grants. The existing server-only rollback draft is
limited to the V2 15-table target and does not roll back the 33-policy helper.

**Additional approval blocker found by read-only Production catalog on
2026-09-26:** `authenticated` currently has SELECT/INSERT/UPDATE/DELETE table
privileges on `store_members`, `store_subscriptions` and `stores`. The existing
`store_members_insert_member` policy checks membership in the target store,
not the inserted role or profile. An active member may therefore be able to
insert an `owner` membership. The `stores`/`store_subscriptions` policies also
use membership alone for broad operations, potentially allowing direct plan
changes. This is a catalog/policy risk, **not a tested unauthorized row write
or proof of exploitation**. The V3 helper changes identity resolution, not
these privileges or policy semantics; the representative fixture intentionally
does not claim to certify all 22 tables. `MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY`
must remain false until the exact affected table/operation grants, actual
client callers and a narrow containment patch are reviewed in an isolated
stack. No Production grant or policy was changed in this run.

The local V3 containment candidate and its still-unrun disposable database
tests are tracked in `docs/mybiz-rls-security-v3-local-candidate-2026-09-27.md`.
The Production approval blocker remains until hosted V3 CI and backup/recovery
evidence pass. This V2 catalog finding is not a Production mutation.
