# MyBiz DB/RLS/store membership baseline

Date: 2026-06-08

This audit prepares MyBiz for real pilot-store data without applying production migrations, RLS policies, DB writes, deployment, payment behavior, webhook behavior, auth/env changes, customer notifications, or external API mutations.

## Launch boundary

Current pilot launch gates stay unchanged:

- ON: `launchBetaEnabled`, `publicPricingEnabled`, `onboardingDiagnosisEnabled`, `ownerReviewedLeadCaptureEnabled`
- OFF / approval-gated: self-serve paid launch, billing checkout/webhook, customer notification, e-sign, POS payment, OAuth/SNS publish, upload/delete mutation, external AI/STT, broad DB write

`broadDbWriteEnabled` remains OFF. No migration or RLS policy was applied.

## Canonical entity audit

| Entity | Canonical role | Current implementation | Current file | Mock/demo boundary | Production readiness | RLS needed | `store_id` status | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `profiles` | Auth-linked user profile | Supabase read path through access/session resolution | `src/shared/lib/repositories/supabaseRepository.ts`, `supabase/schema.sql` | Demo profile fallback exists only in explicit demo runtime | Needs live auth evidence before broad dashboard launch | Yes, profile-owned read/update | Profile-scoped, not store-scoped | Verify auth user mapping and no local/demo session as production truth |
| `stores` | Merchant business root | Canonical read/upsert repository exists | `src/shared/lib/repositories/supabaseRepository.ts`, `supabase/schema.sql` | Demo stores are isolated in demo repository | Pilot-ready only for owner-assisted setup | Yes, member-scoped | Primary `store_id`/`id` compatibility exists | Confirm canonical `store_id` migration state before writes |
| `store_members` | Dashboard access truth | Supabase access resolution requires membership rows | `src/shared/lib/adminSession.ts`, `src/shared/lib/repositories/supabaseRepository.ts`, `supabase/schema.sql` | Demo memberships only for demo runtime | Required before any live dashboard access | Yes, member-scoped | Present | Add approval checklist evidence before pilot merchant access |
| `store_subscriptions` | Paid entitlement truth | Canonical read with legacy fallback | `src/shared/lib/repositories/supabaseRepository.ts`, `supabase/migrations/20260424_store_subscriptions_canonical_alignment.sql` | Demo subscription behavior exists for demo data | Not enough for self-serve paid launch | Yes, member-scoped | Present | Remove fallback dependence before paid launch |
| `store_public_pages` | Public page config | Canonical read/save path exists with legacy fallback | `src/shared/lib/repositories/supabaseRepository.ts`, `supabase/migrations/20260405_mybiz_v2_phase1_phase2.sql` | Demo public pages are isolated | Pilot-ready with owner review | Public read plus member write | Present | Verify visibility rules and store ownership |
| `visitor_sessions` | Anonymous public journey state | Public page repository has save/read path | `src/shared/lib/repositories/supabaseRepository.ts`, migration docs | Demo data supports preview | Approval-gated because it creates customer-adjacent state | Public insert/read scope needed | Present | Decide retention, consent, and public write policy |
| `customers` | Store-local customer memory root | Canonical save/list path exists with legacy compatibility | `src/shared/lib/repositories/supabaseRepository.ts`, `src/shared/lib/domain/customerMemory.ts` | Demo CRM paths exist | Pilot-only after RLS and consent approval | Yes, store-member scoped plus approved public insert path | Present | Use store-local normalized contact dedupe |
| `customer_contacts` | Normalized contact identity | Canonical save/list path exists | `src/shared/lib/repositories/supabaseRepository.ts`, migration docs | Demo data exists | Not broad-launch ready | Yes, store-member scoped; public insert must be narrow | Present | Enforce normalized phone/email dedupe per store |
| `customer_preferences` | Consent/preferences memory | Canonical save/list path exists | `src/shared/lib/repositories/supabaseRepository.ts`, migration docs | Demo data exists | Not broad-launch ready | Yes | Present | Separate marketing consent from operational memory |
| `inquiries` | Lead/customer demand event | Public and repository write paths exist | `src/server/publicApi.ts`, `src/shared/lib/repositories/supabaseRepository.ts` | Demo/in-memory paths exist | Approval-gated for live pilot forms | Yes, public insert plus member read | Present | Connect to customer memory only after store-local dedupe approval |
| `reservations` | Booking demand event | Public and repository write paths exist | `src/server/publicApi.ts`, `src/shared/lib/repositories/supabaseRepository.ts` | Demo paths exist | PRO/VIP pilot only | Yes | Present | Gate by subscription and consent |
| `waiting_entries` | Queue demand event | Public and repository write paths exist | `src/server/publicApi.ts`, `src/shared/lib/repositories/supabaseRepository.ts` | Demo paths exist | PRO/VIP pilot only | Yes | Present | Gate by subscription and store membership |
| `customer_timeline_events` | Customer memory ledger | Canonical append/list path exists; new boundary guards require store/customer scope | `src/shared/lib/repositories/supabaseRepository.ts`, `src/domain/mybiz/customerMemory.ts` | Demo memory events exist | Pilot-only after approval | Yes | Present | Treat as append-only memory spine |

## Baseline decisions

- Every merchant-facing entity must be store-scoped through `store_id`.
- Customer identity is store-local. The same normalized phone in two stores must produce two separate memory keys.
- `customer_timeline_events` is the customer memory ledger and must include both `store_id` and `customer_id`.
- Dashboard access must not rely on localStorage/sessionStorage/demo state in production. Production truth is Supabase auth plus `store_members`.
- Paid entitlement must not rely on plan copy or browser state. Production truth is `store_subscriptions`.
- Public lead capture can remain owner-reviewed, but broad customer DB write remains OFF until RLS and consent are approved.

## Implementation added in this branch

- `src/domain/mybiz/storeMembership.ts` captures dashboard access and paid entitlement guard rules.
- `src/domain/mybiz/customerMemory.ts` captures store-local customer memory normalization and required scope checks.
- `src/server/mybiz/repositories/*` creates a repository boundary where customer memory writes require both `broadDbWriteEnabled` and explicit write approval.
- `src/tests/store-membership-policy.test.ts`, `src/tests/customer-memory-spine.test.ts`, and `src/tests/repository-boundary.test.ts` lock the current safety rules without touching live DB state.

## Blocked until separate approval

1. Applying migrations or RLS policy changes to production.
2. Enabling live customer writes through the new Supabase customer memory repository.
3. Enabling public inquiry/reservation/waiting customer memory writes.
4. Removing legacy subscription fallback from paid entitlement decisions.
5. Any payment/webhook/auth/env/customer notification/external API mutation.

## Sanitized side effects

```json
{
  "db_write": false,
  "migration_apply": false,
  "rls_policy_apply": false,
  "payment_provider_call": false,
  "webhook_change": false,
  "auth_or_env_change": false,
  "customer_notification": false,
  "external_api_mutation": false,
  "docs_created_or_updated": true
}
```
