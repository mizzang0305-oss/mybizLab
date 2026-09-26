# MyBiz RLS compatibility gate

Date: 2026-09-26
Status: disposable CI passed for the server provisioning and Auth binding candidate; Production security gate remains open
Branch: security/mybiz-rls-compat-v1
Production target: Mybiz Project (plnuyudyogbzwpmdulnw)

## Purpose

Biz2Lab Commercial Production is on hold because the shared MyBiz database has 15 public-schema tables with RLS disabled. This branch exists to design and validate a compatibility-safe hardening change without touching Production.

## Verified affected tables

- store_tables
- sessions
- orders
- events
- menu_categories
- menu_items
- store_staff
- store_modules
- ai_briefing_logs
- store_analytics_profile
- store_priority_settings
- store_daily_metrics
- ai_reports
- store_home_content
- store_setup_requests

## Initial compatibility notes

- orders: active server APIs plus legacy browser compatibility path; migration required before hardening.
- sessions: active server path; broad public table access is not justified by current code evidence.
- store_tables, menu_categories, menu_items: browser provisioning compatibility exists; trace before changing DB permissions.
- store_priority_settings: browser authenticated use exists; target should be store-member scoped.
- store_home_content: legacy fallback behind canonical public-page storage; keep table but quarantine if fallback is no longer needed.
- store_setup_requests: browser submission and server administration both exist; move submission to a safe server boundary or add narrow policy before enabling RLS.
- several AI/analytics/staff/module tables have no direct current table call in the initial search and require legacy/dependency verification.

## Safety boundary

This branch must not:
- change the Production database
- blanket-enable RLS without compatible policies
- break public ordering, onboarding, or merchant dashboard flows
- expose privileged server credentials to the browser
- modify Biz2Lab PR #130
- start AgentOps work

## Required gate

Before Production approval:
1. classify all 15 tables by real runtime access;
2. remove unnecessary anonymous writes;
3. define store-member policies for merchant-private data;
4. move public mutations behind server APIs where practical;
5. validate on disposable Supabase;
6. verify public, onboarding, merchant, and cross-store regression;
7. prepare exact migration and rollback evidence.

Target certification: MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY.

## Current implementation evidence

- Live merchant order reads now use a Bearer-authenticated, store-scoped server API; the existing browser read-model mapper is reused.
- The live onboarding setup-request path now has no browser table-insert fallback. Demo storage remains available only in demo runtime.
- Live order-event writes fail closed without a merchant token; the direct browser payment-event fallback is removed.
- Live public table and menu reads now use the existing `/api/public/store` server snapshot.
- Server merchant, admin-session, social OAuth, and six merchant service paths now resolve RLS-visible memberships through an anon-key plus verified user-JWT client. A bound public business profile can differ from the Auth ID; service-role membership enumeration and email fallback are not used for authorization.
- A read-only Production aggregate found two distinct member profiles: one directly linked to an Auth ID and active binding, one without a direct ID/binding/email match. No customer rows or secret values were exported.
- The draft migration in `supabase/migration_drafts/20260926_mybiz_public_rls_compat.sql` is **not** a Production migration. Disposable DB role/cross-store tests and public/merchant end-to-end regression passed in the scoped CI run below.

## Production operation boundary and known differences

1. Production has three September migration ledger entries absent from this repository. The synthetic fixture covers critical Auth, binding, membership, and provisioning behavior, but is not a complete Production schema clone. The parity matrix is in `docs/mybiz-rls-runtime-access-matrix-2026-09-26.md`.
2. Production `create_store_with_owner` has nine text arguments, uses `auth.uid()`, and still lets authenticated callers supply `p_plan`. The tested `20260926_mybiz_server_provisioning_boundary.sql` draft revokes client EXECUTE and adds an idempotent service-only RPC. The matching API verifies Auth and payment before calling it. Production has not been changed.
3. The RLS draft keeps the existing `public.is_store_member(uuid)` signature and delegates to the existing Production `private.is_service_os_store_member(uuid)` identity helper. The server uses a user-context client for membership checks. Disposable tests deny revoked and cross-store access; an unbound nonidentical profile receives no automatic email match.
4. Local Windows has no Docker/Supabase CLI. GitHub Actions run [36249128365](https://github.com/mizzang0305-oss/mybizLab/actions/runs/36249128365) applied both SQL drafts to a disposable Supabase, passed RLS and anonymous Data API denial, 903 application tests, four real public/merchant/provisioning/inquiry API E2E tests, and data-preserving write lockdown. The runner destroyed the local stack.

## Read-only Production catalog recheck

- RLS disabled: 15/15 target tables.
- Full anonymous CRUD: 15/15; full authenticated CRUD: 15/15; full service-role CRUD: 15/15.
- `generate_unique_store_slug(text)` has explicit PUBLIC, anon, and authenticated EXECUTE grants; the draft revokes all three client grants.
- `create_store_with_owner(...)` still permits authenticated EXECUTE in Production and accepts caller-supplied plan. The tested draft removes this bypass only when the separately approved Production operation is performed.
- The eight legacy/unknown tables audited for indirect use have no public/private/core view references and no user triggers; `store_home_content` has one function-body reference in provisioning. No Production Edge Functions are deployed. These findings do not prove absence of external jobs or older callers.

Production SQL, deployment, and Biz2Lab PR #130 remain on hold.

## Owner-verified business profile binding

An existing Auth user whose UUID differs from its business `public.profiles.id` has no access until an Owner-approved exact binding is active. The operator must verify account ownership out of band and record the exact Auth UUID and public profile UUID. Before any future write, check that the Auth user exists, `core.profiles.is_active=true`, the public profile exists, that profile owns a `store_members` row, and neither UUID conflicts with an active or historical binding. Do not infer a match from email.

Owner decision on 2026-09-26: the one Production owner-profile without a verified Auth binding is an unused account and does not require login in this release. Access denial after hardening is explicitly accepted. No binding will be inferred or written for that profile in this phase. If use resumes later, the exact identity pair requires separate verification and approval.

The fail-closed transaction template is `supabase/migration_drafts/20260926_mybiz_owner_verified_binding_manual_template.sql`. It contains NULL UUID placeholders and ends in `ROLLBACK`; it is excluded from CI migrations. After separate Owner approval for the exact pair, a designated operator may prepare a reviewed transaction that inserts one `OWNER_VERIFIED` / `ACTIVE` binding. Read back the exact row and merchant access, then commit only in that later operation. To revoke an erroneous binding, update only its exact binding ID to `status='REVOKED', revoked_at=now()` in a separately approved transaction. Never bulk-match by email or delete binding history.

## Deployment and rollback boundary

The RLS and provisioning drafts must be applied as one reviewed security rollout before deploying the matching code SHA. Pause new provisioning during this short compatibility window. If code deployment fails, disable new provisioning calls and restore the previous approved application deployment only after confirming its authenticated legacy RPC cannot create stores; do not restore broad anonymous CRUD. The data-preserving write-lockdown draft remains an emergency option. Existing customer rows and provisioning receipts are retained; schema drops and broad grants are not automatic rollback steps.

## Review package frozen after disposable CI

- Draft PR: [#189](https://github.com/mizzang0305-oss/mybizLab/pull/189), Draft; no merge.
- Last runtime/fixture behavior change: `ca85cf6c9a7a246104b5e8e94e7873a57da8dccf`. A later SQL comment clarification changes only the draft hash; use the current PR HEAD as the final code package.
- Passing disposable run: [36249128365](https://github.com/mizzang0305-oss/mybizLab/actions/runs/36249128365). Four real handler E2E tests and 903 general tests passed; four general tests were skipped. The anonymous orders Data API returned 401 for GET, POST, PATCH, and DELETE.
- RLS draft SHA-256: `dfbf994f1b52b6a6b48fe0b1b20ca50f017ec4da7c6d37c15b4110687eb47741`.
- Server provisioning draft SHA-256: `1f02f604e32459fbc8224fb2ec9d02d14dffaaaed9eafa5ec5b405a3bdf125cd`.
- Data-preserving write-lockdown SHA-256: `05356a4261df67bb557ce21014480ff4f10eb6cb87d3b84d8eab244fe42990c0`.
- Client bundle search for service-role markers: zero matching files in the built `dist`.
- Production catalog recheck: 15/15 targets still RLS-disabled with full anon and authenticated CRUD. This package has not closed that live exposure.

The Owner's unused unbound-profile access decision closes the identity-disposition question for approval preparation. Production SQL, deployment, and the first live smoke remain separate approvals and operations. The two SQL files remain review drafts because the repository does not contain every September Production migration source.
