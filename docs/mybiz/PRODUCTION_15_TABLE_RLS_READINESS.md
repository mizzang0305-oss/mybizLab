# Legacy 15-table exact-shape RLS readiness R1

Status: **BLOCKED for Production Apply**. Draft PR #184 is stacked on preserved Draft PR #183 (`065b1b404531df8c62927a301f9f032e0ddd8ae1`). This work neither changes Production access nor activates consultation persistence or Factory.

Supabase CLI `2.117.0` generated the two draft migration filenames; the isolated workflow runs PostgreSQL `17.6` on a standard Ubuntu runner. The Production catalog snapshot is a point-in-time read and must not be used as an Apply receipt.

## Evidence classes

| evidence | result | limit |
|---|---|---|
| Production catalog read | 15 target tables, 147 columns, 41 constraints, 36 indexes; 6 TEXT `store_id`, 8 UUID `store_id`, 1 nullable `created_by` | sanitized schema/aggregate reads only; detailed current counts/grants private |
| Effective privilege read | `has_table_privilege` checked seven operations for anon/authenticated/service_role across all 15 | snapshot may drift before Apply; must refresh at Owner Gate |
| Source call-path inventory | each of 15 classified in [call-path matrix](PRODUCTION_15_TABLE_CALL_PATH_MATRIX.md) | outside-repo consumers not disproven |
| Exact-shape fixture | all 15 target columns/types/defaults/PK/UNIQUE/FK/CHECK/indexes plus relevant dependency keys | synthetic rows, not a Production dump; standalone Postgres, not full Supabase stack |
| SQL candidate | minimum grants, per-table RLS, no unsafe TEXT-to-UUID cast, no browser orders UPDATE | draft only, not active migration |
| Two clean rehearsals | [GitHub run 35819315464](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35819315464): catalog shape, red baseline, candidate, role/access matrix, old-policy drift rejection, rollback policy/grant drift rejection, guarded replay and rollback PASS twice | does not exercise actual PostgREST HTTP or all app routes |
| Browser fallback tests | live server route fails closed; browser does not query legacy home table | mocked browser boundary, not Production Preview |
| Application validation | `npm ci` PASS; lint PASS; typecheck PASS; build PASS; focused 33/33 locally; [CI run 35819315464](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35819315464) full 898/898 and `npm audit --omit=dev` 0 vulnerabilities | `npm ci` reported 2 overall advisories (1 moderate, 1 critical, including development dependencies); Vite emitted chunk-size/dynamic-import warnings; no exact-head Preview browser verification |

## Decision matrix

| condition | status | reason |
|---|---|---|
| EXACT_SCHEMA | PASS in isolated fixture | explicit catalog counts/types and executable constraints/indexes |
| GRANT_MATRIX | PASS in isolated fixture | no anon target grant; authenticated five read surfaces and only proven writes |
| RLS_MATRIX | PASS in isolated fixture | own-store allow; wrong-store and non-member deny; TEXT invalid key deny |
| ORDERS_PAYMENT_FIELD_PROTECTION | PASS for DB browser UPDATE denial | full HTTP payment/merchant route still unproven against exact DB |
| STORE_SETUP_REQUEST_OWNER_SCOPE | SERVER_ONLY selected | existing nullable owner IDs make old own-row policy unsuitable for browser launch |
| PUBLIC_ROUTE_COMPATIBILITY | BLOCKED | no exact-shape HTTP/Data API integration yet |
| MERCHANT_ROUTE_COMPATIBILITY | BLOCKED | service functions have unit tests; exact-shape route execution pending |
| ADMIN_ROUTE_COMPATIBILITY | BLOCKED | privileged provisioning and webhook path must be end-to-end checked |
| UNKNOWN_EXTERNAL_CONSUMERS | OPEN | no direct in-repo path is not proof of no background/outside client |
| SECURITY/PERFORMANCE_ADVISORS | BASELINE_ONLY / NOT_RUN_ON_CANDIDATE | read-only Production baseline reports [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) on targets and [policy with RLS disabled](https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled) on setup requests; performance INFO includes unindexed FKs and unused indexes. Plain PostgreSQL fixture lacks Supabase advisors, so none of these is attributed to the draft |
| ROLLBACK | PASS isolated | restores disabled RLS, prior broad effective grants, original two dormant policies, removes only helper/new policies |

## Safety and next proof

1. Keep candidate and rollback in `supabase/migration_drafts/`; do not link/apply SQL to Production.
2. Add disposable Supabase/PostgREST route integration for public snapshot/order/session, merchant menu/table/priority/order, admin onboarding/provisioning and webhook; test expected HTTP/application results and DB role. Do not substitute mocked API tests for this.
3. Verify out-of-repo jobs/clients and minimum service-role operations for no-path tables using sanitized operational evidence. Close all `UNKNOWN_EXTERNAL` entries.
4. Re-run current Production metadata-only precheck immediately before asking for a separate Owner Apply approval. If schema, grants, policies, row shape, or routes drift, repair and repeat rehearsals.

No Production permission change, data mutation, deployment, main merge, email, consultation save, payment, or Factory write occurred in this R1 readiness branch.
