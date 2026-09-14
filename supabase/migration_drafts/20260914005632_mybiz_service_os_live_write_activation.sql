-- DRAFT ONLY: MyBiz Service OS browser write activation candidate.
-- This migration MUST NOT be applied with the foundation migration.
-- It requires post-foundation certification and a separate exact Owner Gate.

begin;

do $$
declare
  v_profile_id_attnum smallint;
  v_auth_id_attnum smallint;
begin
  if to_regclass('public.service_jobs') is null or to_regclass('public.job_evidence_assets') is null then
    raise exception 'SERVICE_OS_FOUNDATION_REQUIRED' using errcode = '42P01';
  end if;

  select attnum into v_profile_id_attnum
  from pg_attribute
  where attrelid = 'public.profiles'::regclass and attname = 'id' and attnum > 0 and not attisdropped;

  select attnum into v_auth_id_attnum
  from pg_attribute
  where attrelid = 'auth.users'::regclass and attname = 'id' and attnum > 0 and not attisdropped;

  if not exists (
    select 1
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = 'public.profiles'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.conkey = array[v_profile_id_attnum]::smallint[]
      and c.confkey = array[v_auth_id_attnum]::smallint[]
  ) then
    raise exception 'AUTH_UID_TO_PROFILE_ID_MAPPING_NOT_PROVEN' using errcode = '42830';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in ('service_jobs_member_insert', 'evidence_assets_member_insert')
  ) then
    raise exception 'SERVICE_OS_WRITE_POLICY_COLLISION_REQUIRES_REVIEW' using errcode = '42710';
  end if;
end;
$$;

grant insert on table public.service_jobs, public.job_evidence_assets to authenticated;

create policy service_jobs_member_insert on public.service_jobs for insert to authenticated with check (
  (select auth.uid()) is not null
  and public.is_store_member(store_id)
  and created_by = (select auth.uid())
  and evidence_revision = 1
  and payment_state = 'PAYMENT_NOT_REQUESTED'
  and state in ('JOB_CREATED', 'CONTRACT_REQUIRED', 'WORK_READY')
  and (customer_id is null or exists (
    select 1 from public.customers c
    where c.customer_id = service_jobs.customer_id and c.store_id = service_jobs.store_id
  ))
  and (contract_id is null or exists (
    select 1 from public.contracts c
    where c.id = service_jobs.contract_id and c.store_id = service_jobs.store_id
  ))
);

create policy evidence_assets_member_insert on public.job_evidence_assets for insert to authenticated with check (
  (select auth.uid()) is not null
  and public.is_store_member(store_id)
  and uploader_user_id = (select auth.uid())
  and status = 'active'
  and exists (
    select 1 from public.service_jobs j
    where j.id = job_evidence_assets.job_id
      and j.store_id = job_evidence_assets.store_id
      and j.evidence_revision = job_evidence_assets.revision_number
  )
);

commit;
