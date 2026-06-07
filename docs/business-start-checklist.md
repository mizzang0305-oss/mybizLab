# MyBiz business start checklist

Date: 2026-06-07

This checklist is for starting MyBiz as a controlled public beta or merchant pilot. It assumes PR #92 is ready but not merged unless explicit approval is given.

## Pre-merge gate for PR #92

Do not merge until all are true:

- PR #92 is `isDraft=false`.
- PR #92 head matches the latest reviewed commit from `gh pr view 92`.
- If PR #92 is newer than `217831d10b518c499006baa523ded6c5aa4373f2`, confirm the newer commit includes only approved launch-audit files and checks are successful.
- PR #92 is `MERGEABLE`.
- Vercel checks are successful.
- PR files do not include Obsidian vault files.
- Stash entries remain preserved.
- Untracked `.claude/worktrees/` and `AGENTS.md` remain untracked and untouched.
- User gives explicit merge approval, preferably: `PR #92 merge approval`.

## If merge is approved

1. Squash merge PR #92.
2. Confirm `origin/main` head.
3. Watch for Vercel auto production deploy.
4. If auto deploy starts, observe status only.
5. Do not run manual production deploy unless separately approved.
6. If deploy fails, report status. Do not roll back unless approved.

## Production smoke after deploy

Run only after PR #92 is merged and production deploy is complete.

### Desktop

- Open `/`.
- Landing is visible.
- FREE CTA is visible.
- Click FREE CTA.
- Confirm `/onboarding?plan=free` or equivalent onboarding route.
- No `Unexpected Application Error`.
- No `Cannot read properties of undefined`.
- No `reading 'trim'`.

### Mobile

Viewports:

- `375x667`
- `390x844`
- `412x915`

Checks:

- Landing visible.
- CTA visible/clickable.
- FREE onboarding route loads.
- No trim crash.
- No router error screen.

### Pricing

- Open `/pricing`.
- FREE visible.
- PRO visible.
- VIP visible.
- TEST not visible.
- `test_sub` not visible.
- Do not click paid checkout buttons unless payment approval is explicit.

## Business launch ON checklist

These should be ON for beta:

- Landing page.
- Pricing page with FREE/PRO/VIP only.
- FREE CTA.
- Onboarding diagnosis.
- Store creation request or lead capture.
- Public value proposition.
- Error boundary.
- Mobile landing/onboarding path.
- Legal/contact pages.
- Owner-reviewed intake process.

## Business launch hidden checklist

These must stay hidden, disabled, or approval-gated:

- Real payment checkout.
- Billing webhook mutation.
- Automatic customer notification.
- Contract/e-sign automation.
- POS/table-order live payment.
- Real campaign automation.
- Social publishing/OAuth mutations.
- Upload/delete media flows.
- Real AI/STT provider calls.
- Broad live DB write surfaces.

## First 7 days operating checklist

Daily:

- Review new onboarding leads.
- Record which merchant problem was solved.
- Tag lead as FREE, PRO-fit, or VIP-fit.
- Confirm no public TEST/test_sub pricing leak.
- Confirm no customer notification was sent automatically.
- Confirm no payment provider call happened without approval.
- Confirm no raw customer PII, payment payload, browser storage, token, cookie, or session value was recorded in docs.
- Review blocked features requested by merchants and map them to next PR priorities.

After each pilot merchant:

- Confirm whether the public page solved initial trust/presence.
- Confirm whether inquiry/reservation/waiting is needed before paid conversion.
- Record what customer memory data would improve repeat sales.
- Decide whether PRO or VIP value is visible enough.
- Record production blockers before enabling live payment.

## Next PR priorities

### PR-1: launch gate / feature flag hardening

- Purpose: make production launch surfaces explicit and prevent accidental payment/AI/social/upload execution.
- Files: router, pricing, feature flags, public route guards, platform config.
- Risk: can hide too much if defaults are wrong.
- Verification: typecheck, build, marketing routes, pricing route, onboarding route, feature-flag tests.

### PR-2: lead capture / store creation request

- Purpose: make FREE onboarding a clean owner-reviewed lead intake path.
- Files: onboarding, setup request API, consent copy, validation tests.
- Risk: live DB write surface.
- Verification: onboarding tests, API tests, no raw browser storage logs, RLS evidence.

### PR-3: customer memory spine MVP

- Purpose: define the minimal customer-memory event model used by inquiry, reservation, waiting, and reporting.
- Files: customer memory service, timeline service, repository contract, tests.
- Risk: PII and duplicate customer handling.
- Verification: masking tests, duplicate tests, store-boundary tests.

### PR-4: inquiry/reservation/waiting MVP

- Purpose: enable merchant-visible paid value for PRO/VIP pilots.
- Files: public inquiry/reservation/waiting routes, entitlement service, consent copy, dashboard views.
- Risk: customer data writes and plan-gate errors.
- Verification: entitlement tests, public API route tests, live RLS review.

### PR-5: billing checkout approval gate

- Purpose: allow payment only when owner explicitly enables production checkout.
- Files: pricing checkout buttons, billing checkout API, webhook runbook, payment event tests.
- Risk: payment provider calls and subscription mutation.
- Verification: payment tests in sandbox only, webhook tests, no automatic entitlement grant from test products.

## Approval needed next

Choose the next approval explicitly:

- `PR #92 merge approval`
- production deploy approval
- feature flag hardening PR approval
- DB/RLS work approval
- payment gate work approval
- sales pilot start approval
