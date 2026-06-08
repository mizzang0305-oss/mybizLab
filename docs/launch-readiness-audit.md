# MyBiz launch readiness audit

Date: 2026-06-08

Branch audited: `codex/launch-gate-feature-flag-hardening`

Production URL: `https://mybiz.ai.kr`

This audit treats MyBiz as a customer-memory revenue engine for merchants, not as a simple website, chatbot, or CRM. The launch decision is based on whether each feature safely supports free acquisition, customer memory accumulation, paid conversion, lock-in, and data asset growth.

## Safety boundary

No merge, deploy, DB write, payment provider call, webhook change, auth change, environment change, customer notification, or external API mutation was performed by this audit.

Existing local stash entries and untracked `.claude/worktrees/` plus `AGENTS.md` must remain untouched.

## PR #92 status

| Item | Status |
| --- | --- |
| PR | `#92` |
| Title | `Stabilize content and marketing route blockers after CTA hotfix` |
| Branch | `codex/post-deploy-typecheck-blocker-audit` |
| Reviewed PR head | `5d3f65e51bda58544f259e2ace57e16c09973200` |
| Squash merge commit | `e2b6c0027f38845104ea0f63d45b747b0b3ea8fb` |
| Draft | `false` |
| Merge | Completed before this branch |
| Vercel production deploy | Auto deploy `SUCCESS` after merge |
| Production smoke after PR #92 | PASS for landing, FREE CTA, onboarding, pricing, and mobile acquisition path |
| Files | Repo files only. No Obsidian vault files in PR. |

This branch did not merge or deploy anything. It starts from the post-PR #92 `origin/main` state and only adds local launch-gate hardening.

## Prior PR #92 safety patch

PR #92 fixed a static-render blocker in `src/modules/content/page.tsx`: deleted OAuth guide metadata referenced `window` at module import time. That patch replaced those references with the existing safe `getDashboardBaseUrl()` helper and restored the YouTube upload readiness copy/scope evidence expected by merchant UX route tests.

This patch did not change payment, webhook, auth, environment, DB, deploy, customer notification, or external API behavior.

## Status legend

- `launch_ready`: safe to show in production now.
- `preview_only`: can be shown, but must not create irreversible business effects.
- `demo_only`: can be used for sales/demo or internal evaluation only.
- `mock_only`: backed by local/mock data, not reliable for production operations.
- `blocked`: must be fixed before launch use.
- `hidden_required`: must be hidden or disabled in production until approved.
- `needs_auth`: depends on authenticated merchant or platform admin boundary.
- `needs_subscription_gate`: must enforce FREE/PRO/VIP plan access.
- `needs_db`: depends on live DB/RLS confirmation.
- `needs_payment_approval`: payment behavior must be explicitly approved.
- `needs_env`: depends on environment configuration.
- `deprecated`: should not be used for public launch.

## Overall launch judgment

Recommended launch mode: controlled public beta or pilot for 3-5 merchants.

Not recommended yet: full self-serve paid launch.

Reason: the acquisition layer is close to launchable after PR #91 and PR #92, but several revenue-critical systems still require explicit production gates: payment, webhooks, live DB/RLS, customer-message consent, external AI cost controls, upload storage policy, and plan-specific entitlement behavior.

## Route and feature inventory

| Area | Routes or modules | Status | Data/source | Side effect | Launch action |
| --- | --- | --- | --- | --- | --- |
| Landing | `/`, `src/pages/LandingPage.tsx` | `launch_ready` | public content plus static fallback | read_only | Keep ON. CTA should route to FREE onboarding. |
| Pricing | `/pricing`, `src/pages/PricingPage.tsx` | `partial`, `needs_payment_approval` | public pricing content plus fallback FREE/PRO/VIP | checkout on paid button click | Show plan copy. Disable or approval-gate paid checkout before broad launch. |
| FREE onboarding | `/onboarding`, onboarding module | `launch_ready` for acquisition, `needs_db` for live persistence | onboarding state and setup request | live setup request submit can write via server API | Keep ON for lead capture only. No raw browser storage logging. |
| Error boundary | `/onboarding` route boundary and app route boundary | `launch_ready` | app route handling | read_only | Keep ON. Prevents raw React Router crash page. |
| Public marketing pages | `/features`, `/cases`, `/faq`, `/about`, `/contact`, `/trust`, legal pages, updates | `launch_ready` | static/public content | read_only | Keep ON. |
| Demo dashboard | `/demo/dashboard` | `demo_only` | read-only demo | local_only/read_only | Keep as sales demo, not as merchant operating console. |
| Platform admin | `/admin/*` | `needs_auth`, `hidden_required` for production operators only | platform admin APIs | DB/admin mutations possible | Keep behind platform admin auth. Do not expose to merchants. |
| Merchant dashboard | `/dashboard/*` | `partial`, `needs_auth`, `needs_db` | demo or canonical repository | DB writes possible | Internal/pilot only until store membership and RLS are confirmed. |
| Public store page | `/:storeSlug`, `/store/:storeId` | `preview_only`, `needs_db`, `needs_subscription_gate` | public store API or demo fallback | read_only on view | Pilot only. Validate visibility and store ownership. |
| Public inquiry | `/s/:storeId/inquiry` | `partial`, `needs_subscription_gate`, `needs_db` | inquiry service and customer memory flow | DB write on submit | Gate by plan and consent. Current entitlements keep FREE inquiry off. |
| Public consultation | `/s/:storeId/consultation` | `partial`, `needs_db` | consultation service | DB write on submit | Pilot only with consent text and owner review. |
| Public reservation | `/s/:storeId/reservation` | `partial`, `needs_subscription_gate`, `needs_db` | reservation service | DB write on submit | PRO/VIP pilot only. |
| Public waiting | `/s/:storeId/waiting` | `partial`, `needs_subscription_gate`, `needs_db` | waiting service | DB write on submit | PRO/VIP pilot only. |
| Store menu/order | `/:storeSlug/menu`, `/:storeSlug/order`, `/store/:storeId/order` | `hidden_required`, `needs_db`, `needs_payment_approval` | menu/order services | order/payment writes possible | Hide real order/payment entry until order/payment policy is approved. |
| Customer CRM | `/dashboard/customers` | `partial`, `needs_auth`, `needs_db` | customer memory/timeline services | DB writes possible | Internal/pilot only. Validate duplicate and masking behavior. |
| AI reports | `/dashboard/ai-reports`, AI summary services | `demo_only`, `needs_env`, `hidden_required` | Gemini/OpenAI-capable service paths | external_api/cost if enabled | Keep demo or disabled until cost guardrails exist. |
| Content engine | `/dashboard/content/*` | `partial`, `needs_auth`, `needs_env` | content/readiness/social/OAuth services | DB writes, OAuth, external providers, upload | Keep internal only. |
| Gallery upload | `/dashboard/content/gallery` | `hidden_required`, `needs_auth`, `needs_db` | Supabase storage/table | upload/db_write/delete | Disable for launch unless storage/RLS and moderation are approved. |
| Contracts | `/dashboard/contracts` | `mock_only`, `hidden_required` | local/mock contracts | local_only | Keep internal/demo. No e-sign or contract automation launch. |
| Table order/kitchen | `/dashboard/table-order`, `/dashboard/kitchen` | `partial`, `needs_db`, `needs_payment_approval` | live compatibility and local fallback | order/payment events possible | Hide until table-order policy and payment behavior are approved. |
| Billing/admin payment tests | `/admin/payment-tests`, `/admin/payment-events` | `needs_auth`, `needs_payment_approval` | admin-only payment test product/events | payment/read DB | Platform admin only. Do not expose public TEST/test_sub. |

## Launch gate hardening update

This branch adds a central launch gate map in `src/shared/lib/launchGates.ts`.

Default launch ON gates:

- `launchBetaEnabled`
- `publicPricingEnabled`
- `onboardingDiagnosisEnabled`
- `ownerReviewedLeadCaptureEnabled`

Default approval-gated gates:

- `selfServePaidLaunchEnabled`
- `billingCheckoutEnabled`
- `billingWebhookEnabled`
- `customerNotificationEnabled`
- `eSignEnabled`
- `posPaymentEnabled`
- `oauthPublishEnabled`
- `uploadMutationEnabled`
- `externalAiEnabled`
- `broadDbWriteEnabled`

The public pricing page now treats PRO/VIP as pilot consultation paths. Paid checkout buttons are disabled by default, the 100 KRW payment test block is hidden unless the checkout gate is enabled, and `/api/billing/checkout` returns a sanitized `LAUNCH_GATE_DISABLED` response before loading checkout env or building a provider payment session.

Webhook, auth, env, DB/RLS, customer notification, upload/delete, OAuth/SNS publishing, and external AI/STT behavior were not modified in this branch.

## Launch Readiness Scorecard

| # | Area | Status | Evidence | Risk | Next action | Launch impact |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Landing / Pricing / CTA | ready | PR #91 smoke pass, PR #92 marketing route tests pass, current local smoke pass | paid checkout now disabled by default | Keep FREE CTA ON; keep paid checkout gated | free acquisition |
| 2 | Mobile UX | ready for acquisition | PR #91 mobile smoke pass, PR #92 production smoke pass, current local mobile smoke pass | broader route coverage not complete | Re-run before any production change | free acquisition |
| 3 | Onboarding | partial | local onboarding tests pass; safe trim guards | live submit can write setup request | Treat as lead capture only | memory seed |
| 4 | Error Boundary | ready | route boundary exists for onboarding and router | broader route coverage not complete | Keep in smoke checklist | reliability |
| 5 | FREE/PRO/VIP contract | ready | PR #92 removed public TEST/test_sub plan leakage | old data may contain test-only rows | Keep official plan filter | conversion clarity |
| 6 | Public page | partial | public store routes exist | live visibility and ownership need DB/RLS validation | Pilot with selected stores | merchant proof |
| 7 | Inquiry | partial | public inquiry route/service exists | FREE entitlement currently false; DB write on submit | Decide FREE limited inquiry policy | lead capture |
| 8 | Reservation | partial | reservation route/service exists | plan gate and DB/RLS need validation | PRO/VIP pilot | paid upgrade |
| 9 | Waiting | partial | waiting route/service exists | plan gate and phone capture policy | PRO/VIP pilot | paid upgrade |
| 10 | Customer CRM | partial | customer/timeline modules exist | PII masking and duplicate policy must hold in live data | Pilot only | lock-in |
| 11 | Customer timeline | partial | timeline intelligence foundation exists; actions disabled | action automation is not launch-ready | Keep recommendations disabled | memory asset |
| 12 | Billing / checkout | blocked for self-serve | PortOne checkout/webhook code exists | payment/provider/webhook side effects | Separate payment approval PR | revenue |
| 13 | Auth / store membership | partial | admin guards exist | store_members/RLS must be proven in production | Live auth/RLS audit | data safety |
| 14 | DB / RLS | blocked for broad launch | canonical Supabase path exists | production writes need RLS evidence | DB/RLS launch gate PR | data safety |
| 15 | Admin console | partial | platform and merchant admin routes exist | powerful mutation surface | Keep internal/auth only | operations |
| 16 | AI usage / cost safety | blocked | Gemini/OpenAI-capable paths exist | cost and external API exposure | Add server-side budget/kill switch | margin safety |
| 17 | Production monitoring | partial | Vercel checks pass and post-PR #92 production smoke passed | no automated monitoring gate yet | Add launch monitoring checklist | reliability |
| 18 | Legal/privacy copy | partial | terms/privacy/refund/contact routes exist | consent copy for customer inputs needs review | Add form-level consent | compliance |
| 19 | SEO | partial | public routes and SEO tests exist | live sitemap/robots after deploy not verified | Smoke public metadata | acquisition |
| 20 | Sales operation readiness | partial | demo dashboard and docs exist | no owner runbook for first 7 days | Use business-start checklist | pilot execution |

## Verification snapshot

| Command | Result |
| --- | --- |
| `git diff --check` | PASS; Windows line-ending warnings only |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing Vite chunk/static-dynamic import warnings only |
| `npm test -- --run src/tests/launch-gates.test.ts` | PASS, 1 file / 3 tests |
| `npm test -- --run src/tests/api-billing-checkout.test.ts src/tests/launch-gates.test.ts src/tests/marketing-pages.test.ts` | PASS, 3 files / 42 tests |
| `npm test -- --run src/tests/onboarding-flow.test.ts src/tests/router.test.ts src/tests/merchant-ux-routes.test.ts src/tests/portone-checkout.test.ts` | PASS, 4 files / 46 tests |
| `npm test -- --run src/tests/api-billing-portone-routes.test.ts` | PASS, 1 file / 7 tests |
| `npm test -- --run` | PASS, 91 files / 391 tests |
| Local Playwright smoke | PASS for `/`, FREE CTA to `/onboarding?plan=free`, `/pricing`, and mobile `375x667`, `390x844`, `412x915` |
| Production smoke | PASS after PR #92 merge/deploy; not rerun in this local branch |

## Launch blockers

1. Paid checkout and webhook behavior must remain approval-gated. The checkout API now has a default OFF launch gate, but payment approval is still required before enabling it.
2. Live DB writes need RLS and store membership evidence before broad launch.
3. Customer message sending must remain disabled until consent, templates, and owner approval are defined.
4. External AI calls need cost controls, provider gating, and no-secret logging checks.
5. Upload/storage paths need policy and moderation review before public launch.
6. FREE inquiry/waiting scope is a business decision: code currently gives FREE only `public_store_page`.

## Business conclusion

MyBiz can start as a controlled pilot focused on free onboarding, merchant diagnosis, lead capture, and manually assisted store setup. It should not yet run as a fully automated paid SaaS where merchants can self-serve checkout, store creation, customer messaging, AI automation, POS/table-order, or contract workflows without owner review.

The first business goal should be to collect clean onboarding and customer-memory seed data while keeping all irreversible side effects behind explicit approval.
