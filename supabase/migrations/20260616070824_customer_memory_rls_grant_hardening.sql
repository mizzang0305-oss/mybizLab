-- DRAFT ONLY: customer memory RLS/grant hardening proposal.
--
-- This file has NOT been applied to production.
--
-- This migration file is intentionally added for review only. It has NOT been
-- applied to production, has NOT been pushed with `supabase db push`, has NOT
-- been run through `supabase migration up`, and has NOT been repaired into
-- remote migration history.
--
-- Do not run this file without a separate owner approval that explicitly
-- permits RLS policy apply plus GRANT/REVOKE execution.
--
-- Preconditions before any future execution:
-- - `20260614_production_baseline_adoption.sql` is remote applied.
-- - `20260615075421_customer_memory_schema_alignment.sql` is remote applied.
-- - Fresh read-only catalog evidence still matches PR #118.
-- - Pre-state grants, policies, function privileges, and row counts are
--   captured for rollback.
-- - `broadDbWriteEnabled=false` and `liveCustomerMemoryWriteEnabled=false`.
-- - Owner/admin dashboard read smoke is ready before and after the apply.
--
-- Forbidden in this draft PR:
-- - production execution of this SQL
-- - `npx supabase db push`
-- - `npx supabase migration up`
-- - `npx supabase migration repair`
-- - production business-row writes
-- - live customer-memory write enablement

begin;

-- 1. Remove broad direct privileges from customer-memory tables.
-- Public/anon must not talk directly to these tables for the live-write MVP.
revoke all privileges on table public.customers from public, anon;
revoke all privileges on table public.customer_contacts from public, anon;
revoke all privileges on table public.inquiries from public, anon;
revoke all privileges on table public.customer_timeline_events from public, anon;

-- Authenticated store members only need SELECT/INSERT/UPDATE. DELETE,
-- TRUNCATE, REFERENCES, and TRIGGER remain unavailable by default.
revoke all privileges on table public.customers from authenticated;
revoke all privileges on table public.customer_contacts from authenticated;
revoke all privileges on table public.inquiries from authenticated;
revoke all privileges on table public.customer_timeline_events from authenticated;

grant select, insert, update on table public.customers to authenticated;
grant select, insert, update on table public.customer_contacts to authenticated;
grant select, insert, update on table public.inquiries to authenticated;
grant select, insert, update on table public.customer_timeline_events to authenticated;

-- Service role remains server-only. This draft does not grant service_role to
-- browser clients and does not rely on service_role for merchant-facing access.

-- 2. Restrict helper function exposure.
-- Keep authenticated access for store-member predicates. Remove PUBLIC/anon
-- execute exposure unless a separate public RPC path is approved.
revoke execute on function public.is_store_member(uuid) from public, anon;
grant execute on function public.is_store_member(uuid) to authenticated, service_role;

-- 3. Replace broad public/ALL policies with command-specific policies.
drop policy if exists customers_member_access on public.customers;
drop policy if exists customer_contacts_member_access on public.customer_contacts;
drop policy if exists inquiries_member_access on public.inquiries;
drop policy if exists customer_timeline_events_member_access on public.customer_timeline_events;

create policy customers_select_store_member
  on public.customers
  for select
  to authenticated
  using (public.is_store_member(store_id));

create policy customers_insert_store_member
  on public.customers
  for insert
  to authenticated
  with check (public.is_store_member(store_id));

create policy customers_update_store_member
  on public.customers
  for update
  to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy customer_contacts_select_store_member
  on public.customer_contacts
  for select
  to authenticated
  using (
    store_id is not null
    and exists (
      select 1
      from public.customers c
      where c.customer_id = customer_contacts.customer_id
        and c.store_id = customer_contacts.store_id
        and public.is_store_member(c.store_id)
    )
  );

create policy customer_contacts_insert_store_member
  on public.customer_contacts
  for insert
  to authenticated
  with check (
    store_id is not null
    and exists (
      select 1
      from public.customers c
      where c.customer_id = customer_contacts.customer_id
        and c.store_id = customer_contacts.store_id
        and public.is_store_member(c.store_id)
    )
  );

create policy customer_contacts_update_store_member
  on public.customer_contacts
  for update
  to authenticated
  using (
    store_id is not null
    and exists (
      select 1
      from public.customers c
      where c.customer_id = customer_contacts.customer_id
        and c.store_id = customer_contacts.store_id
        and public.is_store_member(c.store_id)
    )
  )
  with check (
    store_id is not null
    and exists (
      select 1
      from public.customers c
      where c.customer_id = customer_contacts.customer_id
        and c.store_id = customer_contacts.store_id
        and public.is_store_member(c.store_id)
    )
  );

create policy inquiries_select_store_member
  on public.inquiries
  for select
  to authenticated
  using (public.is_store_member(store_id));

create policy inquiries_insert_store_member
  on public.inquiries
  for insert
  to authenticated
  with check (
    public.is_store_member(store_id)
    and (
      customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.customer_id = inquiries.customer_id
          and c.store_id = inquiries.store_id
      )
    )
  );

create policy inquiries_update_store_member
  on public.inquiries
  for update
  to authenticated
  using (public.is_store_member(store_id))
  with check (
    public.is_store_member(store_id)
    and (
      customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.customer_id = inquiries.customer_id
          and c.store_id = inquiries.store_id
      )
    )
  );

create policy customer_timeline_events_select_store_member
  on public.customer_timeline_events
  for select
  to authenticated
  using (public.is_store_member(store_id));

create policy customer_timeline_events_insert_store_member
  on public.customer_timeline_events
  for insert
  to authenticated
  with check (
    public.is_store_member(store_id)
    and exists (
      select 1
      from public.customers c
      where c.customer_id = customer_timeline_events.customer_id
        and c.store_id = customer_timeline_events.store_id
    )
  );

create policy customer_timeline_events_update_store_member
  on public.customer_timeline_events
  for update
  to authenticated
  using (public.is_store_member(store_id))
  with check (
    public.is_store_member(store_id)
    and exists (
      select 1
      from public.customers c
      where c.customer_id = customer_timeline_events.customer_id
        and c.store_id = customer_timeline_events.store_id
    )
  );

commit;

-- Rollback SQL draft, also approval-gated and not executed by this PR:
--
-- begin;
-- drop policy if exists customers_select_store_member on public.customers;
-- drop policy if exists customers_insert_store_member on public.customers;
-- drop policy if exists customers_update_store_member on public.customers;
-- drop policy if exists customer_contacts_select_store_member on public.customer_contacts;
-- drop policy if exists customer_contacts_insert_store_member on public.customer_contacts;
-- drop policy if exists customer_contacts_update_store_member on public.customer_contacts;
-- drop policy if exists inquiries_select_store_member on public.inquiries;
-- drop policy if exists inquiries_insert_store_member on public.inquiries;
-- drop policy if exists inquiries_update_store_member on public.inquiries;
-- drop policy if exists customer_timeline_events_select_store_member on public.customer_timeline_events;
-- drop policy if exists customer_timeline_events_insert_store_member on public.customer_timeline_events;
-- drop policy if exists customer_timeline_events_update_store_member on public.customer_timeline_events;
--
-- create policy customers_member_access on public.customers
--   for all to public using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
-- create policy customer_contacts_member_access on public.customer_contacts
--   for all to public using (
--     exists (
--       select 1 from public.customers c
--       where c.customer_id = customer_contacts.customer_id
--         and public.is_store_member(c.store_id)
--     )
--   ) with check (
--     exists (
--       select 1 from public.customers c
--       where c.customer_id = customer_contacts.customer_id
--         and public.is_store_member(c.store_id)
--     )
--   );
-- create policy inquiries_member_access on public.inquiries
--   for all to public using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
-- create policy customer_timeline_events_member_access on public.customer_timeline_events
--   for all to public using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
--
-- grant execute on function public.is_store_member(uuid) to public, anon, authenticated, service_role;
-- grant select, insert, update, delete, truncate, references, trigger on table public.customers to public, anon, authenticated;
-- grant select, insert, update, delete, truncate, references, trigger on table public.customer_contacts to public, anon, authenticated;
-- grant select, insert, update, delete, truncate, references, trigger on table public.inquiries to public, anon, authenticated;
-- grant select, insert, update, delete, truncate, references, trigger on table public.customer_timeline_events to public, anon, authenticated;
-- commit;
