-- Local-only pgTAP for Auth Identity Foundation R1.
-- Synthetic identifiers only. Never run against a linked database.

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
select extensions.plan(52);

set local role postgres;

-- 1-14: protected catalog and function boundary.
select extensions.has_table('private', 'profile_auth_bindings', 'BINDING_TABLE_PRIVATE_EXISTS');
select extensions.results_eq($$select count(*)::bigint from pg_constraint where conrelid='private.profile_auth_bindings'::regclass and contype='f' and confrelid='public.profiles'::regclass$$, array[1::bigint], 'BINDING_PUBLIC_PROFILE_FK_EXISTS');
select extensions.results_eq($$select count(*)::bigint from pg_constraint where conrelid='private.profile_auth_bindings'::regclass and contype='f' and confrelid='core.profiles'::regclass$$, array[1::bigint], 'BINDING_CORE_PROFILE_FK_EXISTS');
select extensions.results_eq($$select count(*)::bigint from pg_constraint where conrelid='private.profile_auth_bindings'::regclass and pg_get_constraintdef(oid) like '%EXACT_ID%OWNER_VERIFIED%MIGRATION_VERIFIED%ADMIN_VERIFIED%'$$, array[1::bigint], 'BINDING_SOURCE_ALLOWLIST_EXACT');
select extensions.results_eq($$select count(*)::bigint from pg_constraint where conrelid='private.profile_auth_bindings'::regclass and pg_get_constraintdef(oid) like '%ACTIVE%REVOKED%'$$, array[2::bigint], 'BINDING_STATUS_CONSTRAINTS_PRESENT');
select extensions.results_eq($$select count(*)::bigint from pg_indexes where schemaname='private' and tablename='profile_auth_bindings' and indexdef like '%UNIQUE%public_profile_id%WHERE%'$$, array[1::bigint], 'ACTIVE_PUBLIC_PROFILE_UNIQUE');
select extensions.results_eq($$select count(*)::bigint from pg_indexes where schemaname='private' and tablename='profile_auth_bindings' and indexdef like '%UNIQUE%auth_profile_id%WHERE%'$$, array[1::bigint], 'ACTIVE_AUTH_PROFILE_UNIQUE');
select extensions.results_eq($$select has_table_privilege('anon','private.profile_auth_bindings','SELECT') or has_table_privilege('anon','private.profile_auth_bindings','INSERT')$$, array[false], 'ANON_BINDING_TABLE_PRIVILEGE_ZERO');
select extensions.results_eq($$select has_table_privilege('authenticated','private.profile_auth_bindings','SELECT') or has_table_privilege('authenticated','private.profile_auth_bindings','INSERT')$$, array[false], 'AUTHENTICATED_BINDING_TABLE_PRIVILEGE_ZERO');
select extensions.results_eq($$select count(*)::bigint from pg_proc where oid in ('private.current_service_os_business_profile_id()'::regprocedure,'private.is_service_os_store_member(uuid)'::regprocedure)$$, array[2::bigint], 'SERVICE_OS_RESOLVER_FUNCTIONS_EXIST');
select extensions.results_eq($$select count(*)::bigint from pg_proc where oid in ('private.current_service_os_business_profile_id()'::regprocedure,'private.is_service_os_store_member(uuid)'::regprocedure) and prosecdef$$, array[2::bigint], 'RESOLVERS_SECURITY_DEFINER');
select extensions.results_eq($$select count(*)::bigint from pg_proc where oid in ('private.current_service_os_business_profile_id()'::regprocedure,'private.is_service_os_store_member(uuid)'::regprocedure) and proconfig @> array['search_path=""']$$, array[2::bigint], 'RESOLVERS_EMPTY_SEARCH_PATH');
select extensions.results_eq($$select count(*)::bigint from (values ('private.current_service_os_business_profile_id()'::regprocedure),('private.is_service_os_store_member(uuid)'::regprocedure)) f(oid) where has_function_privilege('anon', f.oid, 'EXECUTE')$$, array[0::bigint], 'ANON_RESOLVER_EXECUTE_ZERO');
select extensions.results_eq($$select count(*)::bigint from (values ('private.current_service_os_business_profile_id()'::regprocedure),('private.is_service_os_store_member(uuid)'::regprocedure)) f(oid) where has_function_privilege('authenticated', f.oid, 'EXECUTE')$$, array[2::bigint], 'AUTHENTICATED_RESOLVER_EXECUTE_EXACT');

-- 15-23: sanitized current-shape and exact-only backfill.
select extensions.results_eq($$select count(*)::bigint from auth.users where id::text like '91000000-%'$$, array[3::bigint], 'AUTH_USERS_COUNT_THREE');
select extensions.results_eq($$select count(*)::bigint from core.profiles where id::text like '91000000-%'$$, array[3::bigint], 'CORE_PROFILES_COUNT_THREE');
select extensions.results_eq($$select ((select count(*) from auth.users au where au.id::text like '91000000-%' and not exists(select 1 from core.profiles cp where cp.id=au.id)) + (select count(*) from core.profiles cp where cp.id::text like '91000000-%' and not exists(select 1 from auth.users au where au.id=cp.id)))::bigint$$, array[0::bigint], 'AUTH_CORE_ONE_TO_ONE');
select extensions.results_eq($$select count(*)::bigint from public.profiles where id::text like any(array['91000000-%','92000000-%'])$$, array[3::bigint], 'PUBLIC_PROFILES_COUNT_THREE');
select extensions.results_eq($$select count(*)::bigint from private.profile_auth_bindings$$, array[2::bigint], 'EXACT_ID_BACKFILL_COUNT_TWO');
select extensions.results_eq($$select count(*)::bigint from private.profile_auth_bindings where binding_source='EXACT_ID' and public_profile_id=auth_profile_id and status='ACTIVE'$$, array[2::bigint], 'BACKFILL_EXACT_ID_ONLY');
select extensions.results_eq($$select count(*)::bigint from public.profiles p where p.id='92000000-0000-0000-0000-000000000001' and not exists(select 1 from private.profile_auth_bindings b where b.public_profile_id=p.id)$$, array[1::bigint], 'LEGACY_UNBOUND_PROFILE_COUNT_ONE');
select extensions.results_eq($$select count(*)::bigint from public.store_members sm join private.profile_auth_bindings b on b.public_profile_id=sm.profile_id and b.status='ACTIVE'$$, array[1::bigint], 'EXACT_ID_BOUND_MEMBERSHIP_COUNT_ONE');
select extensions.results_eq($$select count(*)::bigint from public.store_members sm where sm.profile_id='92000000-0000-0000-0000-000000000001'$$, array[6::bigint], 'LEGACY_UNBOUND_MEMBERSHIP_COUNT_SIX');

-- 24-34: authenticated resolver behavior.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select private.current_service_os_business_profile_id()$$, array['91000000-0000-0000-0000-000000000001'::uuid], 'EXACT_ID_OWNER_RESOLUTION_ALLOW');
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000001')$$, array[true], 'EXACT_ID_OWNER_STORE_ALLOW');
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000002')$$, array[false], 'EXACT_ID_OWNER_WRONG_STORE_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select extensions.results_eq($$select private.current_service_os_business_profile_id()$$, array['91000000-0000-0000-0000-000000000002'::uuid], 'BOUND_NON_MEMBER_PROFILE_RESOLVES');
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000001')$$, array[false], 'BOUND_NON_MEMBER_STORE_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select extensions.is_empty($$select private.current_service_os_business_profile_id() where private.current_service_os_business_profile_id() is not null$$, 'AUTH_WITHOUT_PUBLIC_PROFILE_RESOLVES_NULL');
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000001')$$, array[false], 'AUTH_WITHOUT_MEMBERSHIP_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000002')$$, array[false], 'AUTH_A_LEGACY_STORE_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000003')$$, array[false], 'AUTH_B_LEGACY_STORE_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000004')$$, array[false], 'AUTH_C_LEGACY_STORE_DENY');
set local role anon;
select extensions.throws_ok($$select private.current_service_os_business_profile_id()$$, '42501', null, 'ANON_RESOLVER_DENY');

-- 35-39: actual Stage 2 RLS with the Service OS-only resolver.
reset role;
select extensions.results_eq($$select ((select count(*) from public.service_jobs)+(select count(*) from public.job_evidence_assets)+(select count(*) from public.job_evidence_revisions)+(select count(*) from public.job_confirmations)+(select count(*) from public.job_confirmation_links)+(select count(*) from public.consent_records)+(select count(*) from public.job_payment_requests)+(select count(*) from public.content_candidates)+(select count(*) from public.brand_sites)+(select count(*) from public.brand_site_portfolio_items))::bigint$$, array[0::bigint], 'STAGE2_ROWS_ZERO_BEFORE_RLS_FIXTURE');
insert into public.service_jobs(id, store_id, vertical, service_name, created_by) values
  ('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','cleaning','fixture','91000000-0000-0000-0000-000000000001'),
  ('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','cleaning','fixture','92000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='94000000-0000-0000-0000-000000000001'$$, array[1::bigint], 'STAGE2_EXACT_OWNER_SELECT_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='94000000-0000-0000-0000-000000000002'$$, array[0::bigint], 'STAGE2_LEGACY_JOB_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs$$, array[0::bigint], 'STAGE2_NON_MEMBER_SELECT_DENY');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs$$, array[0::bigint], 'STAGE2_UNBOUND_AUTH_SELECT_DENY');

-- 40-46: revoked binding and explicit Owner-verified rehearsal.
reset role;
update private.profile_auth_bindings
set status='REVOKED', revoked_at=timezone('utc', now())
where auth_profile_id='91000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.is_empty($$select private.current_service_os_business_profile_id() where private.current_service_os_business_profile_id() is not null$$, 'REVOKED_BINDING_SUPPRESSES_EXACT_FALLBACK');
select extensions.results_eq($$select private.is_service_os_store_member('93000000-0000-0000-0000-000000000001')$$, array[false], 'REVOKED_BINDING_ACCESS_DENY');
reset role;
insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status,verified_at)
values ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000003','OWNER_VERIFIED','ACTIVE',timezone('utc',now()));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select extensions.results_eq($$select private.current_service_os_business_profile_id()$$, array['92000000-0000-0000-0000-000000000001'::uuid], 'OWNER_VERIFIED_MANUAL_BIND_RESOLVES_CHOSEN_PROFILE');
select extensions.results_eq($$select count(*)::bigint from (values ('93000000-0000-0000-0000-000000000002'::uuid),('93000000-0000-0000-0000-000000000003'::uuid),('93000000-0000-0000-0000-000000000004'::uuid),('93000000-0000-0000-0000-000000000005'::uuid),('93000000-0000-0000-0000-000000000006'::uuid),('93000000-0000-0000-0000-000000000007'::uuid)) s(id) where private.is_service_os_store_member(s.id)$$, array[6::bigint], 'OWNER_VERIFIED_CHOSEN_AUTH_GETS_SIX_MEMBERSHIPS');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from (values ('93000000-0000-0000-0000-000000000002'::uuid),('93000000-0000-0000-0000-000000000007'::uuid)) s(id) where private.is_service_os_store_member(s.id)$$, array[0::bigint], 'OTHER_AUTH_A_LEGACY_ACCESS_ZERO');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from (values ('93000000-0000-0000-0000-000000000002'::uuid),('93000000-0000-0000-0000-000000000007'::uuid)) s(id) where private.is_service_os_store_member(s.id)$$, array[0::bigint], 'OTHER_AUTH_B_LEGACY_ACCESS_ZERO');
reset role;
select extensions.results_eq($$select count(*)::bigint from private.profile_auth_bindings where binding_source='OWNER_VERIFIED' and public_profile_id='92000000-0000-0000-0000-000000000001' and auth_profile_id='91000000-0000-0000-0000-000000000003'$$, array[1::bigint], 'MANUAL_BIND_EXACT_CHOICE_ONLY');

-- 47-52: no global rewrite, no write activation, no membership reassignment.
select extensions.results_eq($$select count(*)::bigint from pg_policies where schemaname='public' and policyname=any(array['service_jobs_member_select','evidence_assets_member_select','evidence_revisions_member_select','confirmations_member_select','consent_records_member_select','payment_requests_member_select','content_candidates_member_select','brand_sites_member_select','portfolio_items_member_select']) and qual like '%is_service_os_store_member%'$$, array[9::bigint], 'STAGE2_POLICY_ALIGNMENT_EXACT_NINE');
select extensions.results_eq($$select count(*)::bigint from pg_policies where schemaname='public' and policyname='vertical_templates_public_v1_select' and qual like '%public_v1%' and qual like '%medical_mode%'$$, array[1::bigint], 'VERTICAL_TEMPLATE_POLICY_UNCHANGED');
select extensions.results_eq($$select pg_get_functiondef('public.is_store_member(uuid)'::regprocedure) like '%sm.profile_id = auth.uid()%'$$, array[true], 'GLOBAL_IS_STORE_MEMBER_SEMANTICS_UNCHANGED');
select extensions.results_eq($$select count(*)::bigint from (values ('public.service_jobs'),('public.job_evidence_assets'),('public.job_evidence_revisions'),('public.job_confirmations'),('public.job_confirmation_links'),('public.consent_records'),('public.job_payment_requests'),('public.content_candidates'),('public.brand_sites'),('public.brand_site_portfolio_items')) t(name) where has_table_privilege('authenticated',name,'INSERT') or has_table_privilege('authenticated',name,'UPDATE') or has_table_privilege('authenticated',name,'DELETE')$$, array[0::bigint], 'SERVICE_OS_AUTHENTICATED_WRITE_GRANTS_ZERO');
select extensions.results_eq($$select count(*)::bigint from pg_policies where schemaname='public' and tablename=any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items']) and cmd in ('INSERT','UPDATE','DELETE','ALL')$$, array[0::bigint], 'SERVICE_OS_WRITE_POLICIES_ZERO');
select extensions.results_eq($$select count(*)::bigint from public.store_members where store_id::text like '93000000-%'$$, array[7::bigint], 'STORE_MEMBER_ROWS_REASSIGNED_ZERO');

select * from extensions.finish();
rollback;
