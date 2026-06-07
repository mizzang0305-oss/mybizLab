# test_sub plan contract audit

Date: 2026-06-07

Scope: contract cleanup. This note records the PR #92 decision and keeps payment, subscription, checkout, webhook, provider, environment, database, and deployment behavior boundaries explicit.

## Resolved blocker

The previous blocker mixed `test_sub` into official plan contracts:

- `src/modules/onboarding/page.tsx`: onboarding state exposes `selectedPlan` as `BillingPlanCode`, which includes `test_sub`.
- `src/shared/types/models.ts`: `SubscriptionPlan` is only `free | pro | vip`.
- `src/server/billingCheckout.ts`: `COMPACT_PLAN_CODE` is typed as `Record<BillingPlanCode, string>` but has no `test_sub` entry.
- `src/pages/PricingPage.tsx` plus `src/shared/lib/platformAdminConfig.ts`: public fallback pricing can render the `TEST` subscription plan, so `src/tests/marketing-pages.test.ts` still catches test-only public copy on `/pricing`.

PR #92 resolves this by removing `test_sub` from official plan unions and public fallback pricing.

## Contract interpretation

- `free`, `pro`, and `vip` are customer subscription plans.
- `PAYMENT_TEST_100_PRODUCT` is already modeled as a non-entitlement payment test product and is hidden from normal public pricing.
- `test_sub` is not an official subscription plan and should not be used as a public pricing plan, store subscription plan, or production checkout plan.

## Final decision

- `PLATFORM_PLAN_CODES` is limited to `free | pro | vip`.
- `BillingPlanCode` is limited to `free | pro | vip`.
- Public pricing fallback renders only FREE, PRO, and VIP.
- The hard-coded `test_sub` subscription catalog path was removed from server catalog resolution.
- The 100 KRW payment test remains available only through `PAYMENT_TEST_100_PRODUCT` / `payment_test_100`, which is a non-entitlement test product.
- Checkout and webhook runtime behavior were not changed beyond excluding `test_sub` from the official plan contract.

## Revenue and customer memory impact

- The intended FREE -> PRO/VIP funnel should stay focused on customer memory, operational diagnosis, reports, CRM, and automation value.
- Removing public `TEST` subscription copy reduces merchant confusion and keeps pricing focused on FREE, PRO, and VIP.
- Excluding `test_sub` from official plans prevents accidental entitlement or checkout assumptions.

## Changed files

- `src/shared/lib/platformAdminConfig.ts`
- `src/shared/lib/billingPlans.ts`
- `src/server/platformCatalog.ts`
- `docs/test-sub-plan-contract-audit.md`

## Verification

Expected after this cleanup:

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `marketing-pages.test.ts`: 16/16 PASS
- public `/pricing`: FREE, PRO, and VIP only
- `payment_test_100`: remains non-entitlement and hidden from normal public pricing

## Safety boundary

This cleanup intentionally avoids:

- adding `test_sub` to `SubscriptionPlan`
- mapping `test_sub` to a production entitlement
- adding `test_sub` to production checkout compact maps
- changing webhook behavior
- changing environment variables or deployment settings
- writing to production or local databases
- recording secrets, tokens, cookies, sessions, payment credentials, or customer personal data

## Remaining risk

- If old data rows contain `plan_code = test_sub`, public pricing filters now reject them. That is intentional for public safety.
- Admin-only payment test UX should continue to use `payment_test_100`, not `test_sub`.
