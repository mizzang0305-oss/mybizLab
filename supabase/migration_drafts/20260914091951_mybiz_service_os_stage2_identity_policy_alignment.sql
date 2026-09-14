-- DRAFT ONLY: Stage 2 read-policy alignment after Auth Identity Foundation apply.
-- This switches exactly nine Service OS SELECT policies and nothing else.
-- It is rehearsed in isolation and is not part of live-write activation.

begin;

do $$
declare
  v_policy_count integer;
begin
  if to_regprocedure('private.is_service_os_store_member(uuid)') is null then
    raise exception 'AUTH_IDENTITY_FOUNDATION_REQUIRED' using errcode = '42883';
  end if;

  select count(*) into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and policyname = any(array[
      'service_jobs_member_select', 'evidence_assets_member_select',
      'evidence_revisions_member_select', 'confirmations_member_select',
      'consent_records_member_select', 'payment_requests_member_select',
      'content_candidates_member_select', 'brand_sites_member_select',
      'portfolio_items_member_select'
    ])
    and coalesce(qual, '') like '%is_store_member%';

  if v_policy_count <> 9 then
    raise exception 'SERVICE_OS_FOUNDATION_POLICY_SHAPE_MISMATCH: %', v_policy_count using errcode = '55000';
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

create policy service_jobs_member_select on public.service_jobs for select to authenticated using (private.is_service_os_store_member(store_id));
create policy evidence_assets_member_select on public.job_evidence_assets for select to authenticated using (private.is_service_os_store_member(store_id));
create policy evidence_revisions_member_select on public.job_evidence_revisions for select to authenticated using (private.is_service_os_store_member(store_id));
create policy confirmations_member_select on public.job_confirmations for select to authenticated using (private.is_service_os_store_member(store_id));
create policy consent_records_member_select on public.consent_records for select to authenticated using (private.is_service_os_store_member(store_id));
create policy payment_requests_member_select on public.job_payment_requests for select to authenticated using (private.is_service_os_store_member(store_id));
create policy content_candidates_member_select on public.content_candidates for select to authenticated using (private.is_service_os_store_member(store_id));
create policy brand_sites_member_select on public.brand_sites for select to authenticated using (private.is_service_os_store_member(store_id));
create policy portfolio_items_member_select on public.brand_site_portfolio_items for select to authenticated using (private.is_service_os_store_member(store_id));

commit;
