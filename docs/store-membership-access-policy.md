# MyBiz store membership access policy

Date: 2026-06-08

This policy defines the minimum access rules before live merchant dashboards and customer memory data are used for real pilot stores.

## Production truth

Production dashboard access requires:

1. A Supabase-authenticated profile.
2. A matching `store_members` row for the requested `store_id`.
3. A supported role: `owner`, `manager`, or `staff`.

The following are not production truth:

- localStorage
- sessionStorage
- demo admin session state
- mock repository state
- visible plan copy
- URL parameters

## Store access rules

| Rule | Required source | Default decision |
| --- | --- | --- |
| Dashboard route access | `store_members` | Deny without a matching row |
| Selected store access | `store_members.store_id` | Deny stores outside the membership list |
| Staff/manager/owner display | `store_members.role` | Allow only recognized dashboard roles |
| Paid entitlement | `store_subscriptions` | Deny paid-only features without active canonical row |
| Public page read | `store_public_pages` visibility plus store status | Pilot/public visibility only |
| Customer memory read | `store_members` plus RLS | Deny without store membership |
| Customer memory write | RLS plus launch gate plus explicit approval | Deny by default |

## Paid entitlement rules

`store_subscriptions` is the canonical paid entitlement table. Legacy subscription fallback exists in repository compatibility code, but wider paid launch should not depend on fallback data.

Before self-serve paid launch:

- every live paid store needs one active canonical `store_subscriptions` row.
- `plan` must be one of `free`, `pro`, or `vip`.
- billing/webhook changes must be approved in a separate PR.
- payment provider calls must remain blocked until approval.

## Customer memory access rules

Customer memory tables are store-owned:

- `customers`
- `customer_contacts`
- `customer_preferences`
- `customer_timeline_events`
- customer-linked `inquiries`
- customer-linked `reservations`
- customer-linked `waiting_entries`

Member dashboards may read only rows for stores they belong to. Public inserts must be narrow, consent-aware, and tied to a public page or owner-reviewed lead path.

## Code references

- `src/domain/mybiz/storeMembership.ts`
- `src/domain/mybiz/customerMemory.ts`
- `src/server/mybiz/repositories/types.ts`
- `src/shared/lib/adminSession.ts`
- `src/shared/lib/repositories/supabaseRepository.ts`
- `supabase/schema.sql`
- `supabase/migrations/20260405_mybiz_v2_phase1_phase2.sql`

## Approval blockers

1. Evidence that `store_members` policies prevent cross-store dashboard reads.
2. Evidence that customer memory policies prevent cross-store reads and writes.
3. Evidence that public inserts cannot write arbitrary stores.
4. Evidence that platform/admin APIs stay admin-only.
5. Evidence that `store_subscriptions` is canonical for paid decisions.
