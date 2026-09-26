# MyBiz RLS compatibility gate

Date: 2026-09-26
Status: code boundary implemented; disposable RLS validation pending
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
- Server authorization resolves `profiles.id` by the verified Auth user ID, never by an email fallback on the service-role client.
- A read-only Production aggregate found two distinct member profiles: one directly linked to an Auth ID and active binding, one without a direct ID/binding/email match. No customer rows or secret values were exported.
- The draft migration in `supabase/migration_drafts/20260926_mybiz_public_rls_compat.sql` is **not** a Production migration. It requires disposable DB role/cross-store tests and public/merchant end-to-end regression before approval.

## Hard compatibility blockers still open

1. Production has three September migration ledger entries absent from this repository. The synthetic fixture covers the 15 target table shapes and helper, but does not prove parity for every Production dependency.
2. The current Production `create_store_with_owner` RPC requires `auth.uid()` and has nine text arguments. The server provisioning API calls it through service role without a user JWT and can send `p_owner_profile_id`, which the Production signature does not accept. Provisioning must be reconciled before narrowing its authenticated EXECUTE grant or declaring public onboarding regression PASS.
3. Existing Production `is_store_member(uuid)` matches `store_members.profile_id = auth.uid()` and cannot authorize a nonidentical Auth/profile binding. The draft permits direct-ID members only. A binding-aware authorization path needs separately reviewed semantics; a new SECURITY DEFINER helper is not introduced as a shortcut.
4. Local Windows has no Docker/Supabase CLI. The scoped GitHub Actions workflow is prepared for disposable Supabase validation, but no CI result is claimed here until the actual run completes.

Production SQL, deployment, and Biz2Lab PR #130 remain on hold.
