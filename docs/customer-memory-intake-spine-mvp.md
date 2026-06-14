# Customer Memory Intake Spine MVP

## Purpose

This PR implements the first executable MyBiz customer memory intake spine. It is not a sales Excel import, CN_SALES import, CNFOOD import, POS ingest, payment, contract, or kitchen-board change.

The goal is to turn a public inquiry into a store-scoped customer memory record through local/mock repository tests while keeping production writes closed.

## Data Flow

1. Public inquiry input arrives with `store_id`, customer name, phone and/or email, source, message, optional intent, summary, and tags.
2. The intake service normalizes phone and email.
3. Customer dedupe runs inside the same `store_id` only.
4. Phone contact is the primary dedupe key. Email is the secondary dedupe key.
5. The service creates or updates a customer profile.
6. Phone/email contacts are created or updated in `customer_contacts`.
7. A new inquiry is created with status `new`.
8. Timeline events are appended for `customer_created` or `customer_updated`, `contact_added`, `inquiry_created`, and `inquiry_linked_to_customer`.
9. Admin read models expose masked contact values and sanitized previews.

## FREE / PRO / VIP Connection

- FREE: public page and basic inquiry acquisition can collect demand signals after an approved write path exists.
- PRO: customer CRM and inquiry timeline make merchant follow-up and customer context useful.
- VIP: preference memory, revisit automation, and reservation/waiting connections can build on this spine later.

This PR prepares the spine without opening live production writes.

## Store Tenancy

Every customer, contact, inquiry, and timeline event is scoped by `store_id`.

The same phone or email in another store creates a separate customer. Browser local state is not treated as permission truth. Server-side merchant reads must use Supabase auth and `store_members` access checks.

## Dedupe Rule

Within one store:

- `store_id + normalized_phone` updates an existing customer when present.
- `store_id + normalized_email` updates an existing customer only when phone is absent or no phone match exists.
- New customers are created only when neither scoped phone nor scoped email matches.

No raw PII is logged by the intake service.

## Timeline Event Rule

Every intake write creates store/customer-scoped timeline evidence:

- `customer_created`
- `customer_updated`
- `contact_added`
- `inquiry_created`
- `inquiry_linked_to_customer`

Timeline metadata excludes raw phone, email, and name values. It records only non-sensitive linkage metadata such as event source, inquiry id, category, and contact channel type.

## Feature Gates

- `customerMemorySpineEnabled`: `true` for local/mock and read-only planning flows.
- `liveCustomerMemoryWriteEnabled`: `false` by default.
- `broadDbWriteEnabled`: remains `false` by default.

Production writes require both `broadDbWriteEnabled` and `liveCustomerMemoryWriteEnabled` to be explicitly enabled in a later approved change.

## Production Write Ban

No migration is applied by this PR.

Forbidden in this PR:

- Supabase `db push`
- Supabase `migration repair`
- Supabase `migration up` or migration apply
- SQL body replay
- RLS policy execution
- GRANT/REVOKE execution is out of scope
- live lead write enablement
- live customer memory write enablement
- env/auth/payment/webhook change
- customer notification
- external AI API call
- production customer or lead row creation
- manual deploy

## Migration Decision

No new migration is added. The repository already has canonical customer memory tables documented in `supabase/schema.sql` and existing planning docs:

- `customers`
- `customer_contacts`
- `inquiries`
- `customer_timeline_events`

This PR only adds code, tests, and docs for the application spine. Any future DB change must be a separate reviewed migration/RLS/grant PR.

## Admin Read Model

Admin customer read APIs return customer cards, recent inquiry previews, and timeline summaries with masked phone/email/name values.

The existing merchant customer screen remains `/dashboard/customers`. The API surface added here supports:

- `GET /api/admin/customers?storeId=...`
- `GET /api/admin/customers/:customerId?storeId=...`
- `GET /api/admin/inquiries?storeId=...`

Public intake API:

- `POST /api/public/stores/:storeSlug/inquiries`

With default production gates, public intake blocks before any production write. Tests inject the in-memory repository to prove the full write spine locally.

## Next Step

After this PR:

1. Review the Draft PR and test the mock/local spine.
2. Add reservation and waiting intake connection to the same customer spine.
3. Prepare a separate migration/RLS/grant approval if production customer memory writes need to go live.
4. Enable live customer memory writes only through a separate owner-approved release.
