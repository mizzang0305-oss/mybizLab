# Production RPC exposure audit — R2

**P0: direct authenticated provisioning bypass was reproduced in a disposable local Supabase stack.** No direct Production RPC call, Auth mutation, or data write was made. Production catalog-only reads confirm the same exposure class, but local synthetic execution is not an exploit attempt against Production.

| RPC | Production security/ACL (read-only metadata) | intended path | direct local RPC result | classification |
|---|---|---|---|---|
| `public.create_store_with_owner(text × 9)` | `SECURITY DEFINER`; `authenticated` and `service_role` EXECUTE, `anon` denied; `auth.uid()` check; source inserts `public.stores`; no payment/billing predicate in function definition | `/api/stores/provision` validates plan and requires payment verification for paid plan, then calls RPC | authenticated local Auth JWT called `/rest/v1/rpc/create_store_with_owner` with `p_plan=vip`; synthetic store with VIP plan created twice without server route or payment proof ([run 35837477773](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35837477773)). Service-role-only call and the real free server route were denied for missing `auth.uid()` | **BLOCKER: bypass plus server-path incompatibility** |
| `public.generate_unique_store_slug(text)` | `SECURITY DEFINER`; anon/authenticated/service role EXECUTE; reads `stores` by function-body metadata | helper for provisioning | local synthetic helper callable by anon; it is **not byte-identical** to Production helper | unnecessary exposure / impact requires exact-body review; no mutation authorized |
| `public.is_store_member(uuid)` | `SECURITY DEFINER`; authenticated/service role EXECUTE; anon denied; uses `auth.uid()` and `store_members` | membership check in policies and app logic | local JWT returns true only for own synthetic store and false for wrong store | intentional required under current RLS dependency; no cross-store data from boolean test |

The local provisioning function uses repository `supabase/live_patches/20260318_fix_create_store_with_owner_live.sql`, whose signature and security shape match the read-only Production catalog. The 15 target tables retain R1 exact catalog shape; non-target provisioning dependencies and slug helper are synthetic. The finding is therefore **confirmed for the locally rehearsed path** and a fail-closed Production readiness blocker; this document does not assert that a real Production user created a store through this bypass.

The function’s `auth.uid()` check establishes identity, **not** payment verification, provisioning approval, or plan entitlement. `api/stores/provision.ts` checks paid `payment_id` before the RPC, but that application gate is not reached by a direct Data API RPC call. The 15-table GRANT/RLS candidate does not revoke the function EXECUTE privilege and cannot close this bypass by itself.

## Required separate repair gate

1. Design a reviewed RPC ACL/trusted-server boundary that denies direct authenticated invocation. Do not only revoke and assume the current service-role call works: the existing definer function also requires `auth.uid()`, so authorized server provisioning must be proven with a bound caller identity or a redesigned server-only function.
2. Rehearse anonymous/authenticated direct RPC deny, free and paid server provisioning allow with correct verification, wrong-user/plan deny, and rollback in the disposable full stack.
3. Seek separate Owner approval before any Production RPC ACL/function change. No RPC change is included in Draft PR #185.
