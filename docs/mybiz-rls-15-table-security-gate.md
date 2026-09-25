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

The existing GitHub run `36192879802` failed in source-isolation verification before Docker, migrations or tests. Its grep expression matched its own workflow source. A local workflow edit anchors detection to actual `supabase` command lines. **No new hosted run has occurred**, so ephemeral apply and RLS enforcement remain `NOT_RUN`. The workflow summary currently describes a 15-table fixture; it must not be read as Production-equivalent certification.

No Production DB write, Auth change, deployment, Biz2Lab change or AgentOps work is authorized by this document.
