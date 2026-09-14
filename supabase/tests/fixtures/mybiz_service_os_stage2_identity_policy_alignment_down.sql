-- CI-ONLY rollback rehearsal for Stage 2 Identity Policy Alignment.
-- Restores exactly nine SELECT predicates to the global helper and nothing else.

begin;

do $$
declare
  v_target_policy_count integer;
  v_old_policy_count integer;
  v_new_policy_count integer;
begin
  with expected(policyname, tablename) as (
    values
      ('service_jobs_member_select', 'service_jobs'),
      ('evidence_assets_member_select', 'job_evidence_assets'),
      ('evidence_revisions_member_select', 'job_evidence_revisions'),
      ('confirmations_member_select', 'job_confirmations'),
      ('consent_records_member_select', 'consent_records'),
      ('payment_requests_member_select', 'job_payment_requests'),
      ('content_candidates_member_select', 'content_candidates'),
      ('brand_sites_member_select', 'brand_sites'),
      ('portfolio_items_member_select', 'brand_site_portfolio_items')
  ), target_policies as (
    select
      p.policyname,
      regexp_replace(coalesce(p.qual, ''), '[[:space:]()]', '', 'g') as normalized_qual
    from pg_catalog.pg_policies p
    join expected e on e.policyname = p.policyname and e.tablename = p.tablename
    where p.schemaname = 'public'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
  )
  select
    count(*),
    count(*) filter (where normalized_qual = any(array[
      'is_store_memberstore_id',
      'public.is_store_memberstore_id'
    ])),
    count(*) filter (where normalized_qual = any(array[
      'is_service_os_store_memberstore_id',
      'private.is_service_os_store_memberstore_id'
    ]))
  into v_target_policy_count, v_old_policy_count, v_new_policy_count
  from target_policies;

  if v_target_policy_count <> 9
     or v_old_policy_count <> 0
     or v_new_policy_count <> 9 then
    raise exception
      'STAGE2_IDENTITY_POLICY_ALIGNMENT_EXACT_NEW_STATE_REQUIRED: targets=% old=% new=%',
      v_target_policy_count, v_old_policy_count, v_new_policy_count
      using errcode = '55000';
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

commit;
