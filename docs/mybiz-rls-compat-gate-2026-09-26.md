# MyBiz RLS compatibility gate

Date: 2026-09-26
Status: server provisioning and Auth binding compatibility under disposable CI; Production compatibility gate open
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
- The draft migration in `supabase/migration_drafts/20260926_mybiz_public_rls_compat.sql` is **not** a Production migration. It requires disposable DB role/cross-store tests and public/merchant end-to-end regression before approval.

## Hard compatibility blockers still open

1. Production has three September migration ledger entries absent from this repository. The synthetic fixture covers the 15 target table shapes and helper, but does not prove parity for every Production dependency.
2. Production `create_store_with_owner` has nine text arguments, uses `auth.uid()`, and still lets authenticated callers supply `p_plan`. `20260926_mybiz_server_provisioning_boundary.sql` is a **draft** that revokes client EXECUTE and adds an idempotent service-only RPC. The API now verifies Auth and payment before using that RPC. It has not been applied to Production.
3. The RLS draft keeps the existing `public.is_store_member(uuid)` signature and delegates to the existing Production `private.is_service_os_store_member(uuid)` identity helper. The server uses a user-context client for membership checks. A revoked binding is denied, and an unbound nonidentical profile receives no automatic email match.
4. Local Windows has no Docker/Supabase CLI. GitHub Actions run [36247271560](https://github.com/mizzang0305-oss/mybizLab/actions/runs/36247271560) applied both SQL drafts and passed RLS assertions, anonymous Data API denial, and application regressions. Its API E2E reached cleanup and exposed a fixture-only Auth deletion FK mismatch; the fixture was aligned with the read-only Production catalog (`core.profiles.id ON DELETE CASCADE`). The latest run must pass before certification.

## Read-only Production catalog recheck

- RLS disabled: 15/15 target tables.
- Full anonymous CRUD: 15/15; full authenticated CRUD: 15/15; full service-role CRUD: 15/15.
- `generate_unique_store_slug(text)` has explicit PUBLIC, anon, and authenticated EXECUTE grants; the draft revokes all three client grants.
- `create_store_with_owner(...)` still permits authenticated EXECUTE and accepts caller-supplied plan; this remains an approval blocker until the provisioning business rule and server path are reconciled.
- The eight legacy/unknown tables audited for indirect use have no public/private/core view references and no user triggers; `store_home_content` has one function-body reference in provisioning. No Production Edge Functions are deployed. These findings do not prove absence of external jobs or older callers.

Production SQL, deployment, and Biz2Lab PR #130 remain on hold.

## Owner-verified business profile binding

An existing Auth user whose UUID differs from its business `public.profiles.id` has no access until an Owner-approved exact binding is active. The operator must verify account ownership out of band and record the exact Auth UUID and public profile UUID. Before any future write, check that the Auth user exists, `core.profiles.is_active=true`, the public profile exists, that profile owns a `store_members` row, and neither UUID conflicts with an active or historical binding. Do not infer a match from email.

The fail-closed transaction template is `supabase/migration_drafts/20260926_mybiz_owner_verified_binding_manual_template.sql`. It contains NULL UUID placeholders and ends in `ROLLBACK`; it is excluded from CI migrations. After separate Owner approval for the exact pair, a designated operator may prepare a reviewed transaction that inserts one `OWNER_VERIFIED` / `ACTIVE` binding. Read back the exact row and merchant access, then commit only in that later operation. To revoke an erroneous binding, update only its exact binding ID to `status='REVOKED', revoked_at=now()` in a separately approved transaction. Never bulk-match by email or delete binding history.

## Deployment and rollback boundary

The RLS and provisioning drafts must be applied as one reviewed security rollout before deploying the matching code SHA. Pause new provisioning during this short compatibility window. If code deployment fails, disable new provisioning calls and restore the previous approved application deployment only after confirming its authenticated legacy RPC cannot create stores; do not restore broad anonymous CRUD. The data-preserving write-lockdown draft remains an emergency option. Existing customer rows and provisioning receipts are retained; schema drops and broad grants are not automatic rollback steps.
