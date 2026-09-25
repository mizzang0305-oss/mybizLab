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
