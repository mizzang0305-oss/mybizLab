# Customer Memory Schema/RLS Evidence

## Intent

This Draft PR checks whether the customer memory intake spine merged in PR #107 can be connected to production Supabase safely.

This is evidence-only work. It does not execute production writes, Supabase `db push`, migration repair, migration apply, SQL replay, RLS policy changes, GRANT/REVOKE, live customer memory write enablement, live lead write enablement, env/auth/payment/webhook changes, customer notifications, external AI calls, or sales Excel import work.

Production launch remains blocked until a separate schema/RLS approval explicitly authorizes the required changes.

## Evidence Method

Evidence was collected from the linked production Supabase project with read-only catalog/count queries only.

Allowed evidence sources:

- `pg_class`, `pg_namespace`, `pg_constraint`, `pg_indexes`, `pg_policies`
- `information_schema.columns`
- `information_schema.role_table_grants`
- `count(*)` row counts only

Disallowed evidence sources:

- `SELECT *`
- row samples
- raw customer data
- raw lead data
- raw PII
- secrets, tokens, DB passwords, or connection strings

Linked project match was checked against the previously approved production project ref, but the ref is not repeated here.

## Live Gates

Merged `origin/main` gate state:

- `broadDbWriteEnabled=false`
- `customerMemorySpineEnabled=true`
- `liveCustomerMemoryWriteEnabled=false`
- `liveLeadWriteEnabled=false`

The customer memory spine can be tested locally and through injected repositories, but production writes remain blocked.

## Table Readiness Matrix

| Table | Row count only | Exists | Key evidence | RLS | Readiness |
| --- | ---: | --- | --- | --- | --- |
| `stores` | 6 | yes | PK `store_id`; unique `slug`; has `plan` | enabled; 1 policy | `CUSTOMER_MEMORY_SCHEMA_READY` for store identity, with grant review required |
| `store_members` | 7 | yes | PK `id`; FK `store_id -> stores`; FK `profile_id -> profiles`; unique `store_id, profile_id` | enabled; 3 policies | `CUSTOMER_MEMORY_SCHEMA_READY` for membership lookup, with grant review required |
| `store_subscriptions` | 1 | yes | PK `id`; FK `store_id -> stores`; unique `store_id`; has `plan/status` | enabled; 1 policy | `CUSTOMER_MEMORY_SCHEMA_READY` for FREE/PRO/VIP gating, with grant review required |
| `customers` | 82 | yes | PK `customer_id`; FK `store_id -> stores`; unique `store_id, customer_key` | enabled; 1 policy | `BLOCKED_MISSING_COLUMN` and `BLOCKED_DEDUPE_INDEX_MISSING` |
| `customer_contacts` | 89 | yes | PK `id`; FK `customer_id -> customers`; unique `customer_id, contact_type, normalized_value` | enabled; 1 policy | `BLOCKED_MISSING_COLUMN` and `BLOCKED_DEDUPE_INDEX_MISSING` |
| `inquiries` | 0 | yes | PK `id`; FK `store_id -> stores`; FK `customer_id -> customers`; FK to visitor/conversation sessions | enabled; 1 policy | `BLOCKED_MISSING_COLUMN` for direct PR #107 model persistence |
| `customer_timeline_events` | 114 | yes | PK `id`; FK `store_id -> stores`; FK `customer_id -> customers`; has `event_type/payload/created_at` | enabled; 1 policy | `BLOCKED_TIMELINE_LINKAGE` for direct PR #107 model persistence |
| `profiles` | 3 | yes | PK `id`; has profile contact columns | enabled; 3 policies | `CUSTOMER_MEMORY_SCHEMA_READY` for membership joins, with grant review required |

## Column Contract Gaps

PR #107 uses the application model in `src/shared/types/models.ts` and the repository contract in `src/server/mybiz/repositories/customerRepository.ts`.

Production schema differences that block direct live persistence:

- `customers` does not expose the PR #107 app fields `name`, `phone`, `email`, `visit_count`, `is_regular`, `marketing_opt_in`, or `updated_at`.
- `customers` uses `customer_key` and `marketing_consent`, so a production adapter or schema migration is required before direct writes.
- `customer_contacts` uses `contact_type` and `raw_value`; the PR #107 app model uses `type` and `value`.
- `customer_contacts` has no `store_id`, while PR #107 repository filtering expects contact-level `store_id`.
- `inquiries` has `subject`, `summary`, `intent`, `contact_name`, `contact_phone`, and `contact_email`; the PR #107 app model uses `category`, `message`, `tags`, `memo`, `marketing_opt_in`, `requested_visit_date`, and `source`.
- `customer_timeline_events` has `payload` and `created_at`; the PR #107 app model uses `metadata`, `source`, `summary`, and `occurred_at`.

These are not runtime failures while live writes are disabled. They are production-connect blockers.

## RLS/Grant Readiness

RLS is enabled on all eight target tables.

Policy name/count summary:

- `stores`: 1 policy, `stores_member_access`
- `store_members`: 3 policies, `store_members_insert_member`, `store_members_select_member`, `store_members_update_member`
- `store_subscriptions`: 1 policy, `store_subscriptions_member_access`
- `customers`: 1 policy, `customers_member_access`
- `customer_contacts`: 1 policy, `customer_contacts_member_access`
- `inquiries`: 1 policy, `inquiries_member_access`
- `customer_timeline_events`: 1 policy, `customer_timeline_events_member_access`
- `profiles`: 3 policies, `profiles_insert_own`, `profiles_select_own`, `profiles_update_own`

Grant summary:

- `anon`, `authenticated`, and `service_role` currently show table-level privileges including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` on the target tables.
- Because RLS is enabled, policy predicates are still expected to constrain row access.
- This PR did not inspect policy predicate bodies, did not execute RLS tests, and did not run GRANT/REVOKE.

Readiness decision for this area: `BLOCKED_RLS_OR_GRANT_RISK`.

The blocker is not that RLS is absent. The blocker is that broad table grants plus public-role policy names require a separate RLS predicate and role-exposure review before live customer memory writes are approved.

## Dedupe And Store Isolation Readiness

PR #107 dedupe behavior:

- phone is primary
- email is secondary
- same phone in the same store updates the same customer
- same phone in another store creates a separate customer

Production evidence:

- `customers` has unique `store_id, customer_key`.
- `customers` does not have `normalized_phone` or `normalized_email`.
- `customer_contacts` has `normalized_value`.
- `customer_contacts` unique constraint is `customer_id, contact_type, normalized_value`.
- `customer_contacts` does not have `store_id`.

Conclusion:

- Cross-store same phone can be represented because contacts attach to different customers and customers are store-scoped.
- Same-store duplicate prevention is not DB-enforced by a store-scoped normalized contact unique constraint.
- Application code could query contacts through a join to `customers.store_id`, but DB-level dedupe safety needs a new constraint strategy.

Readiness decision: `BLOCKED_DEDUPE_INDEX_MISSING`.

## Inquiry Linkage Readiness

Production `inquiries` evidence:

- `inquiries.store_id` exists and FK targets `stores.store_id`.
- `inquiries.customer_id` exists and FK targets `customers.customer_id`.
- `inquiries` row count is 0.

This is enough for customer/inquiry linkage, but not enough for direct PR #107 object persistence without a mapping layer or schema alignment.

`lead_capture_requests` evidence:

- table exists
- row count is 0
- RLS enabled
- columns include `store_id`, `owner_profile_id`, status/source fields, masked/encrypted contact fields, `memory_seed_summary`, and consent flags
- FKs: `store_id -> stores`, `owner_profile_id -> profiles`
- no `customer_id` or `inquiry_id` linkage column was observed

Conclusion:

- Inquiry linkage to customers is structurally present.
- Lead capture to customer memory is not automatically linked.
- A separate conversion strategy is required if lead capture requests should create or attach to inquiries/customer memory.

Readiness decision: `BLOCKED_MISSING_COLUMN` for direct PR #107 inquiry persistence, and conversion strategy required for lead capture linkage.

## Timeline Readiness

Production `customer_timeline_events` evidence:

- `store_id` exists and FK targets `stores.store_id`.
- `customer_id` exists and FK targets `customers.customer_id`.
- `event_type`, `payload`, and `created_at` exist.
- row count is 114.

Conclusion:

- The table can represent customer-scoped timeline facts.
- Direct PR #107 writes need either an adapter mapping `metadata -> payload`, `occurred_at -> created_at`, and `source/summary -> payload`, or a schema migration that adds compatible columns.

Readiness decision: `BLOCKED_TIMELINE_LINKAGE`.

## Entitlement Readiness

Membership and plan gating evidence:

- `store_members` supports store/profile authorization through `store_id`, `profile_id`, and `role`.
- `store_subscriptions` supports one subscription row per store through unique `store_id`.
- `store_subscriptions.plan` and `store_subscriptions.status` are present.
- `stores.plan` also exists as a legacy or mirrored plan field.

Conclusion:

- FREE/PRO/VIP gating can be based on `store_subscriptions`.
- Server-side authorization should continue to use `store_members`.

Readiness decision: `CUSTOMER_MEMORY_SCHEMA_READY` for entitlement lookup, subject to the RLS/grant review blocker.

## Overall Readiness Decision

Final decision:

`BLOCKED_MISSING_COLUMN`

Additional active blockers:

- `BLOCKED_DEDUPE_INDEX_MISSING`
- `BLOCKED_TIMELINE_LINKAGE`
- `BLOCKED_RLS_OR_GRANT_RISK`

The schema is not ready for direct production customer memory writes from the PR #107 model. Live customer memory write remains disabled.

## Draft-Only Migration Proposal

No migration file is added by this PR. No migration command was executed.

If a later owner-approved migration PR is opened, the proposal should decide between two paths:

1. Adapter-first path:
   - keep the existing production schema
   - implement a production repository that maps PR #107 app fields to existing columns
   - query contacts through `customer_contacts -> customers` to enforce store scope
   - map timeline `metadata/source/summary/occurred_at` into `payload/created_at`
   - keep live writes disabled until RLS predicate tests pass

2. Schema-alignment path:
   - add or align missing customer fields needed by the PR #107 model
   - add contact-level `store_id` or an equivalent store-scoped dedupe enforcement strategy
   - add a unique constraint or index for store-scoped normalized phone/email dedupe
   - align inquiry fields or add a stable mapping layer
   - align timeline fields or document payload-only semantics
   - review RLS policy predicates and reduce broad role exposure if required

Recommended next step: adapter-first design review plus RLS predicate evidence before any migration/apply/write approval.

## Forbidden Commands For This PR

The following remain forbidden and were not executed:

- `npx supabase db push`
- `npx supabase migration repair`
- `npx supabase migration up`
- migration apply
- SQL replay
- RLS policy apply
- GRANT/REVOKE
- production DB write
- live customer memory write enablement
- live lead write enablement
- env/auth/payment/webhook change
- customer or lead production row creation
- external AI API call
- customer notification send
- sales Excel import work
- PR #106 merge
- manual deploy
