# MyBiz business start checklist

Date: 2026-06-09

This checklist is for starting MyBiz as a controlled public beta or merchant pilot. PR #92 has been merged, and the next launch-hardening work should keep production deploy, merge, DB write, payment provider calls, webhook changes, auth/env changes, customer notifications, and external API mutations behind explicit approval.

## Completed PR #92 merge gate

PR #92 is already merged. Keep this as historical evidence for why the acquisition layer can be used for controlled beta:

- PR #92 is `isDraft=false`.
- PR #92 head matched the approved `5d3f65e51bda58544f259e2ace57e16c09973200`.
- PR #92 squash merge commit is `e2b6c0027f38845104ea0f63d45b747b0b3ea8fb`.
- Vercel auto production deploy completed with `SUCCESS`.
- Post-merge production smoke passed for landing, pricing, FREE CTA, onboarding, and mobile acquisition path.
- PR files do not include Obsidian vault files.
- Stash entries remain preserved.
- Untracked `.claude/worktrees/` and `AGENTS.md` remain untracked and untouched.

## Next merge/deploy gate

Use this for future launch-hardening PRs:

1. Confirm target PR files do not include Obsidian vault files.
2. Confirm no payment/webhook/auth/env/DB/customer notification/external mutation is included unless explicitly approved.
3. Re-run typecheck, build, targeted tests, and public route smoke.
4. Get explicit merge approval.
5. Watch Vercel auto production deploy read-only if merge triggers it.
6. Do not run manual production deploy, rollback, or hotfix without separate approval.

## Production smoke after deploy

Run after any future merge that triggers production deploy. For the current post-PR #92 baseline, this smoke has already passed.

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
- Current branch adds `src/shared/lib/launchGates.ts`, disables PRO/VIP checkout by default, hides public payment test UI unless checkout is explicitly enabled, and blocks `/api/billing/checkout` before env/provider preparation.

### PR-2: lead capture / store creation request

- Purpose: make FREE onboarding a clean owner-reviewed lead intake path.
- Files: `/admin/leads`, lead capture domain, mock/disabled repository boundary, consent copy, validation tests.
- Risk: live DB write surface if a future repository implementation bypasses launch gates.
- Verification: lead domain tests, repository boundary tests, console render tests, route tests, no raw browser storage logs, RLS evidence before live writes.
- Current MVP adds an internal owner-reviewed lead console with mock state transitions only. `customerNotificationEnabled`, `billingCheckoutEnabled`, and `broadDbWriteEnabled` remain OFF.

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

- production deploy approval
- feature flag hardening PR approval
- DB/RLS work approval
- payment gate work approval
- sales pilot start approval
