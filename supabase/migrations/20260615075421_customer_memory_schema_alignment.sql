-- DRAFT ONLY: customer memory schema alignment proposal.
--
-- This migration file is intentionally added as an approval-gated draft for
-- PR #109 follow-up review. It was created locally with:
--   npx supabase migration new customer_memory_schema_alignment
--
-- It has NOT been applied to production, has NOT been pushed with
-- `supabase db push`, and has NOT been run through `supabase migration up`.
-- Do not run `npx supabase db push`.
-- Do not run `npx supabase migration up`.
-- Do not run `npx supabase migration repair`.
-- Any future execution requires separate production approval.
--
-- Preconditions before any future execution:
-- - baseline migration-history adoption/repair is approved separately
-- - duplicate audit for store-scoped normalized contacts is clean
-- - production backup/rollback window is approved
-- - RLS predicate review passes
-- - least-privilege grant plan is approved separately
-- - `broadDbWriteEnabled` and `liveCustomerMemoryWriteEnabled` remain disabled
--
-- Forbidden in this draft:
-- - destructive SQL
-- - DROP/TRUNCATE/DELETE
-- - RLS policy apply
-- - GRANT/REVOKE
-- - production live-write enablement

begin;

-- Customer app-model alignment. Keep raw contact truth in customer_contacts;
-- these columns support dashboard/card compatibility and dedupe metadata only.
alter table public.customers
  add column if not exists name text null,
  add column if not exists normalized_phone text null,
  add column if not exists normalized_email text null,
  add column if not exists visit_count integer not null default 0,
  add column if not exists is_regular boolean not null default false,
  add column if not exists updated_at timestamptz null;

-- Contact-level store scope is nullable first so a separate approved backfill
-- and duplicate audit can run before not-null enforcement is considered.
alter table public.customer_contacts
  add column if not exists store_id uuid null;

-- DML backfill is idempotent, but still requires explicit production apply
-- approval before this migration is executed.
update public.customer_contacts cc
set store_id = c.store_id
from public.customers c
where cc.customer_id = c.customer_id
  and cc.store_id is null;

-- Inquiry app-model alignment for PR #107 public intake semantics.
alter table public.inquiries
  add column if not exists category text null,
  add column if not exists message text null,
  add column if not exists tags text[] not null default '{}',
  add column if not exists memo text null,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists requested_visit_date date null,
  add column if not exists source text null;

-- Timeline app-model alignment. `payload` remains the flexible JSON object;
-- first-class columns support filtering and timeline ordering.
alter table public.customer_timeline_events
  add column if not exists source text null,
  add column if not exists summary text null,
  add column if not exists occurred_at timestamptz null;

create index if not exists customers_store_normalized_phone_idx
  on public.customers (store_id, normalized_phone)
  where normalized_phone is not null and normalized_phone <> '';

create index if not exists customers_store_normalized_email_idx
  on public.customers (store_id, normalized_email)
  where normalized_email is not null and normalized_email <> '';

create index if not exists customer_contacts_store_customer_idx
  on public.customer_contacts (store_id, customer_id);

create index if not exists inquiries_store_customer_created_idx
  on public.inquiries (store_id, customer_id, created_at);

create index if not exists customer_timeline_events_store_customer_event_created_idx
  on public.customer_timeline_events (store_id, customer_id, event_type, created_at);

-- Store-scoped contact uniqueness. Execute only after duplicate audit proves
-- no same-store conflicts for each normalized contact type.
create unique index if not exists customer_contacts_store_phone_unique
  on public.customer_contacts (store_id, normalized_value)
  where contact_type = 'phone'
    and normalized_value is not null
    and normalized_value <> '';

create unique index if not exists customer_contacts_store_email_unique
  on public.customer_contacts (store_id, normalized_value)
  where contact_type = 'email'
    and normalized_value is not null
    and normalized_value <> '';

commit;
