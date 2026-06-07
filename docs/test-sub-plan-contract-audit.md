# test_sub plan contract audit

Date: 2026-06-07

Scope: audit only. This note does not change payment, subscription, checkout, webhook, provider, environment, database, or deployment behavior.

## Current blocker

`npm run typecheck` still fails on the `test_sub` contract after the unrelated content page type errors are fixed.

- `src/modules/onboarding/page.tsx`: onboarding state exposes `selectedPlan` as `BillingPlanCode`, which includes `test_sub`.
- `src/shared/types/models.ts`: `SubscriptionPlan` is only `free | pro | vip`.
- `src/server/billingCheckout.ts`: `COMPACT_PLAN_CODE` is typed as `Record<BillingPlanCode, string>` but has no `test_sub` entry.
- `src/pages/PricingPage.tsx` plus `src/shared/lib/platformAdminConfig.ts`: public fallback pricing can render the `TEST` subscription plan, so `src/tests/marketing-pages.test.ts` still catches test-only public copy on `/pricing`.

## Contract interpretation

- `free`, `pro`, and `vip` are customer subscription plans.
- `PAYMENT_TEST_100_PRODUCT` is already modeled as a non-entitlement payment test product and is hidden from normal public pricing.
- `test_sub` is currently ambiguous because it is a billing plan code but not a customer subscription plan.

## Revenue and customer memory impact

- The intended FREE -> PRO/VIP funnel should stay focused on customer memory, operational diagnosis, reports, CRM, and automation value.
- Public `TEST` subscription copy can confuse merchants and weakens the paid conversion path because it appears beside FREE, PRO, and VIP.
- Treating `test_sub` as a normal subscription plan without a product decision could incorrectly affect onboarding, entitlement, or checkout expectations.

## Recommended separate PR

Create a separate approved PR for the billing/test-plan contract decision.

Suggested branch:

```text
codex/fix-billing-test-sub-plan-contract
```

Decision options:

- Remove or hide `test_sub` from public subscription plan surfaces while keeping `PAYMENT_TEST_100_PRODUCT` as the non-entitlement payment test product.
- Or explicitly model `test_sub` as a test-only billing code with no customer entitlement and no normal public pricing exposure.

Likely files to review in that PR:

- `src/shared/lib/billingPlans.ts`
- `src/shared/types/models.ts`
- `src/modules/onboarding/page.tsx`
- `src/server/billingCheckout.ts`
- `src/shared/lib/platformAdminConfig.ts`
- `src/pages/PricingPage.tsx`
- pricing, checkout, onboarding, and platform catalog tests

## Safety boundary

This audit intentionally avoids:

- adding `test_sub` to `SubscriptionPlan`
- mapping `test_sub` to a production entitlement
- changing PortOne checkout behavior
- changing webhook behavior
- changing environment variables or deployment settings
- writing to production or local databases
- recording secrets, tokens, cookies, sessions, payment credentials, or customer personal data

