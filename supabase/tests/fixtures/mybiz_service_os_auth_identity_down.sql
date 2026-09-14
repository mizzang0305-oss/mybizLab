-- CI-ONLY Window A rollback rehearsal for Auth Identity objects.
-- Preserves the Foundation private schema/functions and all 11 Stage 2 relations.

begin;

do $$
declare
  v_stage2_rows bigint;
begin
  select
    (select count(*) from public.service_jobs)
    + (select count(*) from public.job_evidence_assets)
    + (select count(*) from public.job_evidence_revisions)
    + (select count(*) from public.job_confirmations)
    + (select count(*) from public.job_confirmation_links)
    + (select count(*) from public.consent_records)
    + (select count(*) from public.job_payment_requests)
    + (select count(*) from public.content_candidates)
    + (select count(*) from public.brand_sites)
    + (select count(*) from public.brand_site_portfolio_items)
  into v_stage2_rows;

  if v_stage2_rows <> 0 then
    raise exception 'AUTH_IDENTITY_ROLLBACK_REQUIRES_ZERO_STAGE2_ROWS: %', v_stage2_rows using errcode = '55000';
  end if;

  if exists (
    select 1 from private.profile_auth_bindings b
    where b.binding_source <> 'EXACT_ID'
      or b.status <> 'ACTIVE'
      or b.revoked_at is not null
      or b.public_profile_id <> b.auth_profile_id
  ) then
    raise exception 'AUTH_IDENTITY_ROLLBACK_REQUIRES_EXACT_SEEDS_ONLY' using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_tables t
    where t.schemaname = 'public'
      and t.tablename = any(array[
        'service_jobs', 'job_evidence_assets', 'job_evidence_revisions',
        'job_confirmations', 'job_confirmation_links', 'consent_records',
        'job_payment_requests', 'content_candidates', 'brand_sites',
        'brand_site_portfolio_items'
      ])
      and pg_catalog.has_table_privilege('authenticated', format('%I.%I', t.schemaname, t.tablename), 'INSERT,UPDATE,DELETE')
  ) then
    raise exception 'AUTH_IDENTITY_ROLLBACK_BLOCKED_BY_BROWSER_WRITE_GRANT' using errcode = '55000';
  end if;
end;
$$;

drop policy service_jobs_member_select on public.service_jobs;
drop policy evidence_assets_member_select on public.job_evidence_assets;
drop policy evidence_revisions_member_select on public.job_evidence_revisions;
drop policy confirmations_member_select on public.job_confirmations;
drop policy consent_records_member_select on public.consent_records;
drop policy payment_requests_member_select on public.job_payment_requests;
drop policy content_candidates_member_select on public.content_candidates;
drop policy brand_sites_member_select on public.brand_sites;
drop policy portfolio_items_member_select on public.brand_site_portfolio_items;

create policy service_jobs_member_select on public.service_jobs for select to authenticated using (public.is_store_member(store_id));
create policy evidence_assets_member_select on public.job_evidence_assets for select to authenticated using (public.is_store_member(store_id));
create policy evidence_revisions_member_select on public.job_evidence_revisions for select to authenticated using (public.is_store_member(store_id));
create policy confirmations_member_select on public.job_confirmations for select to authenticated using (public.is_store_member(store_id));
create policy consent_records_member_select on public.consent_records for select to authenticated using (public.is_store_member(store_id));
create policy payment_requests_member_select on public.job_payment_requests for select to authenticated using (public.is_store_member(store_id));
create policy content_candidates_member_select on public.content_candidates for select to authenticated using (public.is_store_member(store_id));
create policy brand_sites_member_select on public.brand_sites for select to authenticated using (public.is_store_member(store_id));
create policy portfolio_items_member_select on public.brand_site_portfolio_items for select to authenticated using (public.is_store_member(store_id));

revoke all on function private.current_service_os_business_profile_id() from authenticated;
revoke all on function private.is_service_os_store_member(uuid) from authenticated;
drop function private.is_service_os_store_member(uuid);
drop function private.current_service_os_business_profile_id();
drop table private.profile_auth_bindings;
revoke usage on schema private from authenticated;

commit;
