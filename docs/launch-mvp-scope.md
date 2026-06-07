# MyBiz launch MVP scope

Date: 2026-06-07

This MVP scope defines what can be used to start real business activity while protecting payment, customer data, DB, auth, and external API boundaries.

## Product principle

MyBiz is a customer-memory revenue engine for merchants.

The MVP should optimize for:

- FREE acquisition through a clear CTA and onboarding flow.
- Customer memory seed data from merchant diagnosis and early customer interactions.
- PRO/VIP conversion through visible upgrade value, not forced checkout.
- Owner-assisted setup while production mutation surfaces are still being gated.
- Data asset growth without raw PII, secrets, session data, or payment credentials in logs/docs.

## Launch ON

These can be shown in production for a controlled beta:

| Feature | Why ON | Required guard |
| --- | --- | --- |
| Landing page | Brings free merchants into the funnel | FREE CTA must keep routing to onboarding |
| Pricing page | Explains FREE/PRO/VIP and upgrade path | Public pricing must not expose TEST/test_sub |
| FREE CTA | Primary acquisition path | Paid checkout must not be the default path |
| Onboarding diagnosis | Captures merchant problem, business type, desired outcome | No raw browser storage logging |
| Store creation request / lead capture | Lets owner qualify merchants before live setup | Live submit must be consented and reviewed |
| Public value proposition | Communicates customer-memory revenue engine | Avoid promising automated features not live |
| Error boundary | Prevents raw application crash page | Keep route-level boundaries |
| Mobile view | Required for owner and merchant preview | Re-smoke after production deploy |
| Legal/contact pages | Baseline trust for acquisition | Review consent text for forms |

## Launch Hidden / Disabled

These must stay hidden, disabled, or approval-gated:

| Feature | Reason | Required gate |
| --- | --- | --- |
| Real PRO/VIP checkout | Direct payment provider side effect | Explicit payment approval PR |
| Billing webhook mutation | Can update billing and subscription records | Webhook secret and rollback runbook |
| Automatic customer notifications | Customer message compliance risk | Consent, templates, owner approval |
| Contract/e-sign flows | Legal commitment risk | Contract product scope and legal review |
| POS/table-order live payment | Order/payment mutation risk | Store policy, payment policy, RLS |
| Social publishing/OAuth | External mutation and token risk | Provider readiness and manual approval |
| Upload/gallery management | Storage, moderation, and RLS risk | Storage policy and moderation checks |
| Real AI paid API calls | Cost and data exposure risk | Budget cap, kill switch, server-side proxy |
| DB mutations outside onboarding lead capture | RLS and data-boundary risk | DB/RLS launch gate |

## Internal / Demo Only

These can support demos, sales, and internal review, but should not be marketed as fully live:

| Feature | Current use | Why not launch-wide |
| --- | --- | --- |
| Demo dashboard | Sales proof and product walkthrough | Read-only/demo semantics |
| Merchant dashboard modules | Internal/pilot operations | Auth, DB, plan gates need live evidence |
| Customer CRM mock paths | Demonstrate memory engine | Live PII masking and duplicate policy need validation |
| AI report mock/fallback | Show expected insight direction | External AI cost and privacy gating not complete |
| Reservation/waiting/order demos | Show paid value | Live DB/RLS and consent not complete |
| Contracts module | Internal prototype | Real contract workflow not implemented |

## Current FREE / PRO / VIP entitlement reality

Code-level entitlements currently map as:

| Entitlement | FREE | PRO | VIP |
| --- | --- | --- | --- |
| `public_store_page` | yes | yes | yes |
| `public_inquiry` | no | yes | yes |
| `customer_memory` | no | yes | yes |
| `reservations` | no | yes | yes |
| `waiting_board` | no | yes | yes |

Business copy may want FREE to include basic inquiry or limited waiting. That is not the current entitlement behavior. If FREE should collect basic inquiries, add a separate PR that defines the limit, consent copy, customer memory write policy, and owner notification behavior.

## Customer memory data flow for MVP

The MVP should accumulate memory through safe, staged events:

1. FREE onboarding collects merchant-side setup seed:
   - business type
   - address or service area
   - operation pain
   - expected outcome
   - preferred plan intent
   - owner contact for follow-up
2. Owner reviews setup request before creating a live store.
3. Pilot store gets a public page.
4. PRO/VIP pilot enables inquiry, reservation, or waiting.
5. Customer contact creates a normalized customer/memory event.
6. Dashboard summarizes customer history without exposing raw private evidence.
7. AI/report features can use aggregated or sanitized memory only after cost/privacy gates.

## FREE -> PRO/VIP conversion path

| Step | User problem solved | Revenue path | Data collected |
| --- | --- | --- | --- |
| Landing/pricing | Merchant understands the offer | FREE acquisition | interest source and plan intent |
| FREE onboarding | Merchant gets a diagnosis path | lead qualification | business profile and pain points |
| Owner-assisted setup | Merchant gets a working public page | trust and onboarding completion | store profile |
| PRO inquiry/reservation/waiting | Merchant captures real customer demand | paid upgrade | customer contact and demand signals |
| VIP memory/reporting | Merchant gets repeat-sale insights | expansion/lock-in | preferences, timeline, report signals |

## MVP operating boundary

The first launch should be:

- public beta, not fully self-serve production SaaS
- 3-5 pilot merchants
- owner-assisted onboarding
- manual approval before paid checkout
- manual approval before customer notification
- no automatic external publishing
- no unreviewed production DB mutation beyond approved lead capture
- no raw secrets, browser storage, payment payloads, or customer PII in docs or logs

## Minimum launch blockers before wider release

1. PR #92 must be merged with explicit approval and production smoke must pass.
2. Payment checkout and webhook behavior need an explicit approval PR.
3. Store membership and RLS must be verified for live merchant data.
4. FREE inquiry policy must be decided and implemented if business wants it.
5. Form-level privacy/consent copy must be reviewed.
6. AI/external provider cost controls must be implemented.
7. Upload/storage policies must be approved.
8. Customer notification automation must stay owner-approved.
