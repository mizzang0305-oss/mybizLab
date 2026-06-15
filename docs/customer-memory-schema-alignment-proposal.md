# Customer Memory Schema Alignment Proposal

## Intent

This proposal turns the PR #108 production evidence into an approval-gated design and adapter-first implementation for PRO/VIP customer memory persistence.

It is approval-gated implementation work. It does not approve or execute production DB writes, Supabase `db push`, migration repair, migration apply, SQL replay, RLS policy apply, GRANT/REVOKE, live customer memory write enablement, live lead write enablement, env/auth/payment/webhook changes, customer or lead production row creation, raw PII output, sales Excel import work, PR #106 merge, manual deploy, or stash cleanup.

Current recommendation: `SCHEMA_ALIGNMENT_RECOMMENDED_BEFORE_LIVE_WRITE`. The follow-up implementation adds an adapter-first compatibility layer and a draft migration file, but it does not enable live production customer-memory writes. Live writes remain blocked until the schema, dedupe, RLS, grant, baseline adoption, and canary launch gates below are separately approved.

## 1. Current Production Evidence Summary

PR #108 collected read-only production catalog/count evidence only. It used metadata sources such as `information_schema`, `pg_class`, `pg_constraint`, `pg_indexes`, `pg_policies`, `information_schema.role_table_grants`, and `count(*)` row counts.

Evidence collection did not use `SELECT *`, row samples, raw customer data, raw lead data, raw PII, secrets, tokens, DB passwords, or connection strings.

Observed readiness:

| Area | Evidence summary | Current decision |
| --- | --- | --- |
| Target tables | `stores`, `store_members`, `store_subscriptions`, `customers`, `customer_contacts`, `inquiries`, `customer_timeline_events`, and `profiles` exist | table existence ready |
| RLS | RLS is enabled on all target tables | `BLOCKED_RLS_OR_GRANT_RISK` until predicate and role-exposure review is approved |
| Grants | broad table-level privileges were observed for public roles and service role | `BLOCKED_RLS_OR_GRANT_RISK` |
| Customers | production model differs from the PR #107 app model | `BLOCKED_MISSING_COLUMN` |
| Contacts | `customer_contacts` has `normalized_value`, but lacks contact-level `store_id` and store-scoped normalized contact uniqueness | `BLOCKED_DEDUPE_INDEX_MISSING` |
| Inquiries | `inquiries.store_id` and `inquiries.customer_id` exist, but direct PR #107 field persistence needs mapping or alignment | `BLOCKED_MISSING_COLUMN` |
| Timeline | `customer_timeline_events.store_id`, `customer_id`, `event_type`, `payload`, and `created_at` exist, but PR #107 uses `source`, `summary`, `metadata`, and `occurred_at` | `BLOCKED_TIMELINE_LINKAGE` |
| Entitlement | `store_members` and `store_subscriptions` can support store membership and FREE/PRO/VIP gating | ready subject to RLS/grant review |

Overall readiness remains `BLOCKED_MISSING_COLUMN`.

## 2. Required Production Model For PRO/VIP Customer Memory

The production model must support a merchant-safe CRM spine:

- one customer memory root per store-local person or household decision
- phone-first and email-secondary dedupe without cross-store collapse
- multiple contacts per customer with normalized contact values
- inquiry capture linked to the customer root
- timeline events that explain how the customer memory changed
- store-member authorization for dashboard reads and owner/staff operations
- subscription gating for PRO/VIP CRM persistence and retention features
- sanitized logs and API responses that never expose raw PII by accident

Minimum persistence contract:

| Table | Required role in CRM persistence |
| --- | --- |
| `customers` | store-scoped customer memory root; owns consent, regularity, visit summary, and display fields |
| `customer_contacts` | phone/email contact registry; stores normalized contact values and enforces store-scoped uniqueness |
| `inquiries` | demand event from public inquiry or owner manual input, linked to store and customer |
| `customer_timeline_events` | append-only memory ledger for customer create/update, contact capture, inquiry linkage, and future reservation/waiting/order links |
| `store_members` | authorization source for dashboard access and store-scoped writes |
| `store_subscriptions` | plan source for FREE/PRO/VIP gating |

## 3. Store Isolation Strategy

Store isolation must be enforced in every layer:

- API input requires `store_id` or a store slug that resolves to a single store.
- Repository calls require `store_id` for list, upsert, inquiry, and timeline operations.
- `customers.store_id` remains required.
- `customer_contacts.store_id` should be added as nullable first, backfilled from `customers`, and later enforced after evidence proves no nulls or mismatches.
- `inquiries.store_id` and `customer_timeline_events.store_id` must stay aligned with their linked `customer_id`.
- RLS predicates must resolve membership through `store_members`, not through mutable user metadata.
- Cross-store same phone/email is allowed and must create or select separate store-scoped customers.

Preferred DB invariant after backfill:

- `customers` has a unique store/customer pair.
- `customer_contacts`, `inquiries`, and `customer_timeline_events` can be checked against the same store/customer pair.
- indexes exist on each table's `store_id` and `customer_id` join path.

## 4. Customer Dedupe Strategy

The CRM dedupe contract from PR #107 remains:

1. normalized phone is primary.
2. normalized email is secondary when phone is absent.
3. same normalized phone in the same store updates the same customer.
4. same normalized phone in a different store creates a separate customer.
5. missing phone and missing email is rejected before a write.

The production blocker is that this behavior is not DB-enforced today at the contact level. The alignment proposal is:

- add `customer_contacts.store_id`
- backfill `customer_contacts.store_id` from the owning customer
- add store-scoped unique indexes on active normalized phone and email contacts
- keep application-level dedupe as the first line of defense
- use the unique indexes as the race-condition and duplicate-write guard

If duplicates already exist at the same store/contact type/normalized value, do not create the unique index until a separate owner-approved dedupe cleanup plan classifies and resolves them.

## 5. Contact Normalization Strategy

Phone and email normalization should stay deterministic and server-side:

- phone normalization strips formatting and compares numeric strings
- email normalization lowercases and trims the canonical email value
- raw contact values should only be stored where the approved privacy model allows them
- logs, docs, telemetry, and error messages must use masked or structural values only
- `customer_contacts.normalized_value` is the DB uniqueness key, not the display value

Recommended contact columns:

| Column | Purpose |
| --- | --- |
| `store_id` | store isolation and unique-index scope |
| `customer_id` | owner customer root |
| `contact_type` or `type` | phone/email discriminator; keep one canonical DB name and map app aliases in the adapter |
| `normalized_value` | DB dedupe key |
| `raw_value` or `value` | optional display/contact value, subject to privacy review |
| `is_primary` | primary channel selection |
| `is_verified` | later verification state |

## 6. Inquiry-To-Customer Linkage Strategy

Production already has `inquiries.store_id` and `inquiries.customer_id`, so the linkage root exists.

Alignment options:

- adapter-first: map PR #107 `category`, `message`, `tags`, `memo`, `marketing_opt_in`, `requested_visit_date`, and `source` into existing inquiry columns and metadata fields.
- schema-alignment: add missing app-model columns where the production model needs first-class filtering, dashboard display, or future analytics.

Recommended hybrid:

- keep `store_id` and `customer_id` as required linkage columns for CRM-created inquiries
- map current production `subject`, `summary`, `intent`, and contact fields through an adapter
- add app-model columns only when they are needed for querying or owner workflows
- do not automatically convert `lead_capture_requests` into `inquiries` until a separate conversion approval defines consent and owner-review rules

## 7. Timeline Event Persistence Strategy

The timeline should be append-only. Updating or deleting events should not be part of the public intake path.

Production can already store `event_type`, `payload`, and `created_at`. PR #107 additionally expects `source`, `summary`, `metadata`, and `occurred_at`.

Recommended alignment:

- preserve `payload` as the flexible event details object
- add `source`, `summary`, and `occurred_at` if dashboard filtering and timeline ordering need first-class columns
- map `metadata` into `payload` through the adapter
- use `occurred_at` for business event time and `created_at` for insert time
- index `store_id`, `customer_id`, `event_type`, and `created_at` or `occurred_at`

Timeline writes remain blocked until the customer and inquiry write path is approved.

## 8. RLS/Grant Hardening Proposal

Supabase has two separate access layers: Postgres grants decide whether a role can reach a table through the API, while RLS policies decide which rows are visible or writable. Supabase's 2026 platform direction also makes explicit table exposure more important for new objects.

Hardening goals:

- keep RLS enabled on every exposed public table
- reduce role privileges to least privilege before live customer-memory writes
- avoid `anon` direct write access to CRM tables unless a separate public insert policy is explicitly approved
- prefer server-owned public intake endpoints over browser direct inserts
- require authenticated store membership for merchant dashboard reads and owner/staff operations
- index RLS predicate columns such as `store_id`, `profile_id`, and `customer_id`
- avoid authorization decisions based on user-editable metadata
- review policy predicate bodies, not only policy names/counts
- run RLS predicate tests before enabling `liveCustomerMemoryWriteEnabled`

This PR does not include draft GRANT/REVOKE or draft policy SQL. RLS and grant changes must be written in a separate migration PR after the predicate review is complete.

References used for design only:

- https://supabase.com/changelog
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api

## 9. Adapter-First Alternative

Adapter-first means production writes continue to use the existing schema shape, while TypeScript repository code maps PR #107 app fields onto production columns.

Follow-up implementation status:

- `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts` implements a customer-memory-specific production schema adapter.
- Public inquiry and admin customer-memory APIs now resolve the production customer-memory path through this adapter.
- `customer_contacts.store_id` is not assumed to exist in production reads. Contacts are isolated by first resolving allowed customer IDs from `customers.store_id`, then reading contacts through `customer_id`.
- Customer writes map to the existing production-safe customer shape: `customer_id`, `store_id`, `customer_key`, first/last seen timestamps, quiet-mode fields, marketing consent, and tags.
- Contact writes map app `type/value` to production `contact_type/raw_value`.
- Inquiry writes map app `category/message/source` to production `intent/summary/channel` while preserving `store_id`, `customer_id`, and `status`.
- Timeline writes map app `metadata/source/summary/occurred_at` to production `payload/created_at`, with defensive payload sanitization for raw phone, email, and name-like keys.
- The adapter requires `broadDbWriteEnabled=true`, `customerMemorySpineEnabled=true`, and `liveCustomerMemoryWriteEnabled=true` before any write method can run.

Benefits:

- smaller DB migration surface
- faster compatibility path for read models and staging tests
- avoids duplicating raw phone/email on `customers`
- can prove RLS predicates and store membership before schema mutation

Limits:

- does not add DB-level store-scoped contact uniqueness
- does not fix contact-level `store_id` absence
- can still race under concurrent public inquiry submissions unless a DB unique index exists
- keeps timeline and inquiry semantics split between app fields and payload mapping

Decision: adapter-first is now implemented for compatibility and non-writing repository hardening. It is not sufficient by itself to launch live PRO/VIP persistence unless the DB-level dedupe and store isolation design is approved and applied.

## 10. Schema-Alignment Migration Proposal

A draft migration file was added at `supabase/migrations/20260615075421_customer_memory_schema_alignment.sql`. It was created locally for review only and was not applied, pushed to Supabase, repaired into history, or run with `migration up`.

The following SQL shape is draft design only and must not be executed from this document.

Migration approval prerequisites:

- owner approval for a dedicated migration PR
- fresh read-only duplicate audit for normalized contact values
- backup/snapshot or rollback window decision
- RLS predicate review and test plan
- Vercel preview and production smoke plan
- launch gates remain disabled during migration apply

### Draft SQL Only - Do Not Execute

```sql
-- DRAFT SQL ONLY - DO NOT EXECUTE FROM THIS DOCUMENT.
-- Requires separate approved migration PR, duplicate audit, RLS review,
-- rollback plan, and production apply approval.

-- Phase 1: add contact-level store scope as nullable.
alter table public.customer_contacts
  add column if not exists store_id uuid null;

-- Phase 2: backfill store scope from owning customer.
-- This is DML and must only run in an approved migration/apply window.
update public.customer_contacts cc
set store_id = c.store_id
from public.customers c
where cc.customer_id = c.customer_id
  and cc.store_id is null;

-- Phase 3: add or align PR #107 model columns after column-name review.
-- Customer raw contact fields should stay contact-owned unless privacy review approves duplication.
alter table public.customers
  add column if not exists name text null,
  add column if not exists visit_count integer not null default 0,
  add column if not exists is_regular boolean not null default false,
  add column if not exists updated_at timestamptz null;

alter table public.inquiries
  add column if not exists category text null,
  add column if not exists message text null,
  add column if not exists tags text[] not null default '{}',
  add column if not exists memo text null,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists requested_visit_date date null,
  add column if not exists source text null;

alter table public.customer_timeline_events
  add column if not exists source text null,
  add column if not exists summary text null,
  add column if not exists occurred_at timestamptz null;

-- Phase 4: add read/write path indexes.
create index if not exists customer_contacts_store_customer_idx
  on public.customer_contacts (store_id, customer_id);

create index if not exists inquiries_store_customer_created_idx
  on public.inquiries (store_id, customer_id, created_at);

create index if not exists customer_timeline_events_store_customer_event_created_idx
  on public.customer_timeline_events (store_id, customer_id, event_type, created_at);

-- Phase 5: add store-scoped normalized contact uniqueness only after duplicate audit is clean.
create unique index if not exists customer_contacts_store_phone_unique
  on public.customer_contacts (store_id, normalized_value)
  where contact_type = 'phone' and normalized_value is not null and normalized_value <> '';

create unique index if not exists customer_contacts_store_email_unique
  on public.customer_contacts (store_id, normalized_value)
  where contact_type = 'email' and normalized_value is not null and normalized_value <> '';
```

Notes before this draft is promoted to an executable migration:

- verify whether production's customer primary key column is `customer_id` or another canonical ID before writing executable SQL
- split concurrent index creation if required by the migration runner
- decide whether `customer_contacts.store_id` becomes `not null` after backfill evidence
- add composite store/customer FK enforcement only after column names and unique keys are verified
- RLS/grant SQL belongs in a separate reviewed block, not in this draft

## 11. Rollback Plan

Rollback for the future migration PR must be explicit before apply approval:

1. Keep `broadDbWriteEnabled=false` and `liveCustomerMemoryWriteEnabled=false` before, during, and after migration.
2. If only nullable columns and indexes are added, revert by deploying code that ignores the columns, then drop new indexes/columns in a separately approved rollback migration.
3. If a backfill misbehaves, stop before not-null or unique enforcement, review row counts and mismatch counts only, and use a targeted rollback migration.
4. If a unique index fails due to duplicates, do not force the index; keep launch blocked and create a duplicate-resolution plan.
5. If RLS predicate tests fail, do not enable live writes; revert policy/grant changes through the approved rollback migration.

No rollback step should delete customer or lead rows without a separate data-retention approval.

## 12. Approval Checklist

Before any production schema alignment can be applied:

- [ ] dedicated migration PR opened; no SQL copied from this document without review
- [ ] duplicate audit for `customer_contacts` store/contact/normalized values completed with row counts only
- [ ] column-name audit confirms production primary key and FK column names
- [ ] RLS predicate bodies reviewed for store membership isolation
- [ ] grants reviewed for least privilege
- [ ] no `anon` direct CRM write path unless separately approved
- [ ] adapter tests prove phone-first and email-secondary dedupe
- [ ] store isolation tests prove same contact in different stores remains separate
- [ ] raw PII logging scan passes
- [ ] launch gates remain disabled
- [ ] migration apply window approved
- [ ] production read-only smoke plan approved

## 13. Launch Gate Criteria

Live customer-memory persistence remains blocked until all criteria pass:

| Gate | Required state before launch |
| --- | --- |
| `broadDbWriteEnabled` | still `false` until final owner launch approval |
| `customerMemorySpineEnabled` | `true` for local/mock/readiness flows |
| `liveCustomerMemoryWriteEnabled` | still `false` until schema/RLS/grant evidence passes |
| Schema readiness | no active `BLOCKED_MISSING_COLUMN` decision |
| Dedupe readiness | store-scoped normalized phone/email uniqueness or approved equivalent exists |
| Store isolation | DB, RLS, repository, and tests all require store scope |
| Inquiry linkage | inquiry rows attach to the intended store/customer or stay blocked |
| Timeline linkage | timeline rows attach to the intended store/customer and use approved event mapping |
| RLS/grants | predicate tests and least-privilege review pass |
| PII safety | raw PII is not logged or written to docs/test artifacts |
| Production smoke | read-only smoke passes after any deploy |

Final launch decision remains `LIVE_CUSTOMER_MEMORY_WRITE_BLOCKED` for this PR.

Additional live-write unlock conditions:

- production baseline marker adoption or migration-history metadata approval
- approved schema alignment migration apply
- RLS predicate proof for store-member scoped reads/writes
- least-privilege grant review and any required GRANT/REVOKE approval
- customer-memory canary approval with production read-only smoke and rollback plan
- `liveCustomerMemoryWriteEnabled` remains `false` until the canary approval explicitly changes it

## Blocker Mapping

| Blocker | Proposed resolution | Still blocked after this PR |
| --- | --- | --- |
| `BLOCKED_RLS_OR_GRANT_RISK` | separate RLS predicate and least-privilege grant review before enablement | yes |
| `BLOCKED_DEDUPE_INDEX_MISSING` | add `customer_contacts.store_id`, backfill, then store-scoped normalized contact unique indexes | yes |
| `BLOCKED_MISSING_COLUMN` | add or adapter-map PR #107 model columns for customers, inquiries, and timeline events | yes |
| `BLOCKED_TIMELINE_LINKAGE` | add `source`, `summary`, `occurred_at` or map to `payload` with approved adapter semantics | yes |

## side_effects

```json
{
  "docs_only": false,
  "production_db_write": false,
  "migration_apply": false,
  "db_push": false,
  "migration_repair": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "live_customer_memory_write": false,
  "live_lead_write": false,
  "env_auth_payment_webhook_changed": false,
  "customer_or_lead_data_created": false,
  "raw_pii_output": false,
  "sales_excel_import_touched": false,
  "production_adapter_aligned": true,
  "draft_migration_created": true,
  "migration_file_added": true,
  "store_isolation_tested": true,
  "dedupe_strategy_tested": true,
  "approval_gated_followup_only": true
}
```
