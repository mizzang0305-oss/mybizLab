-- READ-ONLY Production catalog/count evidence for Auth Identity apply preflight.
-- Returns no UUID, contact value, auth metadata, credential, or customer row.

select
  (select count(*) from auth.users) as auth_users_count,
  (select count(*) from core.profiles) as core_profiles_count,
  (select count(*) from auth.users au where not exists (select 1 from core.profiles cp where cp.id = au.id)) as auth_without_core_profile,
  (select count(*) from core.profiles cp where not exists (select 1 from auth.users au where au.id = cp.id)) as core_profile_without_auth,
  (select count(*) from public.profiles) as public_profiles_count,
  (select count(*) from public.profiles pp join core.profiles cp on cp.id = pp.id join auth.users au on au.id = cp.id) as public_profile_exact_id_match_count,
  (select count(*) from public.profiles pp where not exists (select 1 from core.profiles cp where cp.id = pp.id)) as public_profile_unbound_count,
  (select count(*) from public.store_members) as store_members_total,
  (select count(*) from public.store_members sm where exists (select 1 from public.profiles pp join core.profiles cp on cp.id = pp.id join auth.users au on au.id = cp.id where pp.id = sm.profile_id)) as exact_id_bound_memberships,
  (select count(*) from public.store_members sm where not exists (select 1 from public.profiles pp join core.profiles cp on cp.id = pp.id join auth.users au on au.id = cp.id where pp.id = sm.profile_id)) as legacy_unbound_memberships;

select
  count(*) filter (where c.contype = 'f') as core_profile_auth_fk_count
from pg_catalog.pg_constraint c
where c.conrelid = 'core.profiles'::regclass
  and c.confrelid = 'auth.users'::regclass;

select
  count(*) as enabled_auth_insert_trigger_count,
  min(t.tgname) as sanitized_trigger_name,
  min(md5(pg_catalog.pg_get_functiondef(t.tgfoid))) as trigger_function_md5
from pg_catalog.pg_trigger t
where t.tgrelid = 'auth.users'::regclass
  and t.tgfoid = 'core.handle_auth_user_created()'::regprocedure
  and not t.tgisinternal
  and t.tgenabled <> 'D';

select
  md5(pg_catalog.pg_get_functiondef('public.is_store_member(uuid)'::regprocedure)) as global_membership_function_md5,
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and coalesce(qual, '') like '%is_store_member%') as global_membership_policy_dependencies,
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and tablename = any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates'])) as stage2_select_policy_count,
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and tablename = any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items']) and coalesce(qual, '') like '%is_store_member%') as stage2_membership_policy_count;

select
  to_regclass('private.profile_auth_bindings') is not null as binding_table_exists,
  to_regprocedure('private.current_service_os_business_profile_id()') is not null as profile_resolver_exists,
  to_regprocedure('private.is_service_os_store_member(uuid)') is not null as membership_resolver_exists;
