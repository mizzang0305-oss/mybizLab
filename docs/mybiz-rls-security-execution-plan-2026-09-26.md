# MyBiz RLS security execution plan

Branch: security/mybiz-rls-compat-v1
Goal: unblock Biz2Lab Commercial Production without breaking MyBiz.

## Verified code-boundary findings

### Onboarding setup requests

The production browser path already prefers:

onboarding UI -> saveSetupRequest() -> /api/onboarding/setup-request -> server admin client -> store_setup_requests

The direct browser insert into store_setup_requests remains only after the server-backed branch and should be treated as a legacy/non-production fallback candidate.

First hardening objective:
- preserve the server API path;
- prove live production mode never needs the direct browser insert;
- remove or explicitly gate the browser database fallback outside demo/test;
- then revoke public direct table mutation and enable compatible RLS.

### Orders

Current live read path is still browser direct:
- listLiveOrders() reads orders, order_items, store_tables, payment_events through the browser Supabase client.

Current live status/payment mutation path already calls authenticated merchant server API:
- /api/merchant/order-event
- server verifies merchant store access
- server uses admin client

First compatibility objective:
- add an authenticated merchant read endpoint that returns the current order read model or the required raw scoped data;
- switch listLiveOrders() from browser table reads to the merchant server endpoint in live runtime;
- retain demo/test behavior;
- after regression passes, orders and related private tables can be hardened without breaking the dashboard.

### Priority settings

store_priority_settings is read from the browser Supabase client. It should eventually be either:
- served through the authenticated server boundary, or
- protected by store-membership RLS.

Do not leave broad anonymous access.

### Legacy candidates

store_home_content is used as a legacy fallback behind canonical public-page storage.
store_analytics_profile singular appears legacy relative to current plural table naming.
Several AI/analytics/staff/module tables have no direct call in the first code search.

Do not DROP legacy tables in this phase. Prefer permission quarantine after dependency proof.

## Implementation order

1. Add merchant orders read API with existing merchant authentication/store-access helper.
2. Route live listOrders/listLiveOrders through that API.
3. Keep order-event mutation API as the canonical mutation boundary.
4. Add regression tests for merchant authentication, store isolation, list/read parity, status/payment flows.
5. Prove production onboarding uses the server setup-request API; remove unsafe browser direct persistence outside explicit demo/test.
6. Build the full 15-table target access matrix.
7. Create a compatibility security migration for disposable Supabase only.
8. Test anon, non-member, member, owner and service-role access.
9. Test cross-store denial.
10. Test public storefront, onboarding, public order, merchant orders and dashboard flows.
11. Audit relevant SECURITY DEFINER functions.
12. Produce exact Production migration SHA and rollback package.

## Production safety

No Production DDL or deploy is allowed from this branch until:
MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY=true

Biz2Lab PR #130 remains frozen during this gate.

## Implemented in this branch

1. Authenticated merchant orders GET returns only rows for a verified member store; the browser retains one existing order read-model mapper.
2. Onboarding live setup requests and merchant order events no longer fall back to direct browser DB writes.
3. Live public menu/table reads reuse `/api/public/store` instead of anonymous table SELECT.
4. Server merchant/admin/OAuth access passes the verified Auth ID to the repository to prevent service-role email fallback.
5. A 15-table RLS/least-grant SQL draft and synthetic disposable-DB pgTAP workflow are prepared. Neither has been applied to Production.

## Next gate and rollback

Run `.github/workflows/mybiz-rls-compat-certification.yml` on the exact candidate SHA, then compare the fixture to read-only Production catalog and test the public/menu/order/onboarding and merchant dashboard paths against the disposable stack. Reconcile the Production provisioning RPC mismatch and nonidentical profile binding before approving schema changes. The code rollback is the prior approved MyBiz deployment. A schema rollback must preserve RLS and avoid restoring anon full CRUD; if a compatible server path cannot be restored without weakening security, stop writes and require separate Owner approval. No automatic table DROP or customer-data deletion is authorized.

The scoped CI run [36212016533](https://github.com/mizzang0305-oss/mybizLab/actions/runs/36212016533) completed the draft migration, 21 RLS/role/cross-store assertions, anonymous Data API denial, 901 application tests, real public-store/menu/table, public order, merchant orders, onboarding request, and merchant order-event handlers against persisted synthetic rows, exact-row cleanup, and a synthetic data-preserving write lockdown. Remaining work includes provisioning semantics and Auth binding compatibility, Production-specific schema parity, and a safe application rollback sequence. The emergency SQL draft is `supabase/migration_drafts/20260926_mybiz_public_rls_write_lockdown.sql`; it is not a data-drop rollback and has not been applied to Production.

## 2026-09-26 continuation

- Server provisioning now validates the Bearer token with Auth, checks the requested email, strictly checks paid status/amount/currency/plan/request binding with PortOne, then calls the service-only `provision_store_from_verified_actor` draft. Authenticated callers lose EXECUTE on the old nine-argument RPC in that draft.
- The new RPC checks active `auth.users` and `core.profiles`, resolves an existing ACTIVE business-profile binding or exact-ID fallback, creates the membership and canonical subscription, and uses a unique payment receipt plus request hash to prevent replay and duplicate store creation.
- Merchant/admin-session/OAuth and six merchant service paths now use the verified JWT with the anon key to ask RLS for visible memberships. No application-side SELECT grant was added to `private.profile_auth_bindings`.
- The disposable fixture includes the existing Auth trigger, Production-like `stores`/`store_members` policies, and the legacy RPC body before the two security drafts. CI must prove direct paid bypass denial, bound and revoked owner behavior, server provisioning, retry, cleanup, and rollback.
- A manual binding template requires exact Owner-approved UUIDs, aborts on absent/conflicting identities, and defaults to `ROLLBACK`. No Production binding operation is authorized here.
- The onboarding flow now keeps `paymentStatus='paid'` when activation fails or the session expires and exposes login/retry without another checkout.

Do not promote either draft into canonical migrations until the latest disposable CI run and full regression pass. After PASS, freeze exact migration hashes, code SHA, draft PR, and Production smoke sequence. Production DB writes and deploy remain separate Owner decisions.
