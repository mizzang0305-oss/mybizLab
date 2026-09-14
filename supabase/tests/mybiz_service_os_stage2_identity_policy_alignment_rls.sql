-- CI-ONLY pgTAP rehearsal for Stage 2 Identity Policy Alignment.
-- Synthetic rows and identities only. The transaction always rolls back.

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
select extensions.plan(24);

set local role postgres;

-- 1-10: exact policy catalog shape.
select extensions.results_eq(
  $$select count(*)::bigint from pg_policies where schemaname='public' and policyname=any(array['service_jobs_member_select','evidence_assets_member_select','evidence_revisions_member_select','confirmations_member_select','consent_records_member_select','payment_requests_member_select','content_candidates_member_select','brand_sites_member_select','portfolio_items_member_select'])$$,
  array[9::bigint],
  'TARGET_POLICY_COUNT_NINE'
);
select extensions.results_eq(
  $$select count(*)::bigint from pg_policies where schemaname='public' and policyname=any(array['service_jobs_member_select','evidence_assets_member_select','evidence_revisions_member_select','confirmations_member_select','consent_records_member_select','payment_requests_member_select','content_candidates_member_select','brand_sites_member_select','portfolio_items_member_select']) and cmd='SELECT' and roles=array['authenticated']::name[]$$,
  array[9::bigint],
  'TARGETS_ARE_SELECT_TO_AUTHENTICATED'
);
select extensions.results_eq(
  $$select count(*)::bigint from pg_policies where schemaname='public' and policyname=any(array['service_jobs_member_select','evidence_assets_member_select','evidence_revisions_member_select','confirmations_member_select','consent_records_member_select','payment_requests_member_select','content_candidates_member_select','brand_sites_member_select','portfolio_items_member_select']) and regexp_replace(coalesce(qual,''),'[[:space:]()]','','g') = any(array['is_store_memberstore_id','public.is_store_memberstore_id'])$$,
  array[0::bigint],
  'OLD_GLOBAL_RESOLVER_COUNT_ZERO'
);
select extensions.results_eq(
  $$select count(*)::bigint from pg_policies where schemaname='public' and policyname=any(array['service_jobs_member_select','evidence_assets_member_select','evidence_revisions_member_select','confirmations_member_select','consent_records_member_select','payment_requests_member_select','content_candidates_member_select','brand_sites_member_select','portfolio_items_member_select']) and regexp_replace(coalesce(qual,''),'[[:space:]()]','','g') = any(array['is_service_os_store_memberstore_id','private.is_service_os_store_memberstore_id'])$$,
  array[9::bigint],
  'NEW_SERVICE_OS_RESOLVER_COUNT_NINE'
);
select extensions.results_eq(
  $$select count(*)::bigint from (values
    ('service_jobs_member_select','service_jobs'),
    ('evidence_assets_member_select','job_evidence_assets'),
    ('evidence_revisions_member_select','job_evidence_revisions'),
    ('confirmations_member_select','job_confirmations'),
    ('consent_records_member_select','consent_records'),
    ('payment_requests_member_select','job_payment_requests'),
    ('content_candidates_member_select','content_candidates'),
    ('brand_sites_member_select','brand_sites'),
    ('portfolio_items_member_select','brand_site_portfolio_items')
  ) expected(policyname,tablename) join pg_policies p using(policyname,tablename) where p.schemaname='public' and p.cmd='SELECT' and p.roles=array['authenticated']::name[]$$,
  array[9::bigint],
  'TARGET_POLICY_TABLE_BINDINGS_EXACT'
);
select extensions.results_eq(
  $$select count(*)::bigint from pg_policies where schemaname='public' and policyname='vertical_templates_public_v1_select'$$,
  array[1::bigint],
  'VERTICAL_TEMPLATE_POLICY_PRESERVED'
);
select extensions.results_eq(
  $$select count(*)::bigint from pg_policies where schemaname='public' and tablename='job_confirmation_links'$$,
  array[0::bigint],
  'CONFIRMATION_LINK_BROWSER_POLICY_ZERO'
);
select extensions.results_eq(
  $$select count(*)::bigint from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (position('is_store_member' in coalesce(pg_get_expr(p.polqual,p.polrelid),''))>0 or position('is_store_member' in coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''))>0)$$,
  array[33::bigint],
  'GLOBAL_DEPENDENCY_COUNT_THIRTY_THREE'
);
select extensions.results_eq(
  $$select pg_get_functiondef('public.is_store_member(uuid)'::regprocedure) like '%sm.profile_id = auth.uid()%'$$,
  array[true],
  'GLOBAL_HELPER_SEMANTICS_UNCHANGED'
);
select extensions.results_eq(
  $$select count(*)::bigint from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and table_name=any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates']) and privilege_type in ('INSERT','UPDATE','DELETE')$$,
  array[0::bigint],
  'AUTHENTICATED_STAGE2_WRITE_GRANTS_ZERO'
);

-- 11-16: identity invariants and resolver matrix.
select extensions.results_eq($$select count(*)::bigint from private.profile_auth_bindings where binding_source='EXACT_ID' and status='ACTIVE' and revoked_at is null$$, array[2::bigint], 'EXACT_BINDINGS_TWO');
select extensions.results_eq($$select count(*)::bigint from public.profiles p where p.id='92000000-0000-0000-0000-000000000001' and not exists(select 1 from private.profile_auth_bindings b where b.public_profile_id=p.id and b.status='ACTIVE')$$, array[1::bigint], 'LEGACY_PROFILE_UNBOUND');
select extensions.results_eq($$select count(*)::bigint from public.store_members where profile_id='92000000-0000-0000-0000-000000000001'$$, array[6::bigint], 'LEGACY_MEMBERSHIPS_SIX');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000001')$$, array[true], 'EXACT_BOUND_CORRECT_STORE_ALLOW');
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000002')$$, array[false], 'EXACT_BOUND_WRONG_STORE_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000001')$$, array[false], 'NON_MEMBER_DENY');

-- 17-21: representative Stage 2 RLS, including unbound and revoked denial.
reset role;
insert into public.service_jobs(id, store_id, vertical, service_name, created_by) values
  ('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','cleaning','alignment-fixture','91000000-0000-0000-0000-000000000001'),
  ('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','cleaning','alignment-fixture','92000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='94000000-0000-0000-0000-000000000001'$$, array[1::bigint], 'STAGE2_BOUND_MEMBER_SELECT_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='94000000-0000-0000-0000-000000000002'$$, array[0::bigint], 'STAGE2_UNBOUND_LEGACY_STORE_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs$$, array[0::bigint], 'STAGE2_NON_MEMBER_SELECT_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs$$, array[0::bigint], 'STAGE2_AUTH_WITHOUT_PUBLIC_PROFILE_DENY');
reset role;
update private.profile_auth_bindings set status='REVOKED', revoked_at=timezone('utc',now()) where auth_profile_id='91000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='94000000-0000-0000-0000-000000000001'$$, array[0::bigint], 'REVOKED_BINDING_STAGE2_DENY');

-- 22-24: no write activation and no persistent fixture data.
reset role;
select extensions.results_eq($$select count(*)::bigint from pg_policies where schemaname='public' and tablename=any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates']) and cmd in ('INSERT','UPDATE','DELETE','ALL')$$, array[0::bigint], 'STAGE2_WRITE_POLICY_COUNT_ZERO');
select extensions.results_eq($$select count(*)::bigint from (values ('private.current_service_os_business_profile_id()'::regprocedure),('private.is_service_os_store_member(uuid)'::regprocedure)) f(oid) where has_function_privilege('anon',f.oid,'EXECUTE')$$, array[0::bigint], 'ANON_RESOLVER_EXECUTE_ZERO');
select extensions.results_eq($$select count(*)::bigint from public.store_members where store_id::text like '93000000-%'$$, array[7::bigint], 'STORE_MEMBERSHIP_ROWS_UNCHANGED_IN_FIXTURE');

select * from extensions.finish();
rollback;
