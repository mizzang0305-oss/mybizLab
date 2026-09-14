-- DRAFT ONLY: Service OS browser write activation V2 design.
-- LIVE_WRITE_ACTIVATION_STATUS=BLOCKED_AUTH_IDENTITY_FOUNDATION_NOT_APPLIED
-- Do not stage or execute this file during Auth Identity Readiness R1.

begin;

do $$
begin
  if to_regprocedure('private.current_service_os_business_profile_id()') is null
     or to_regprocedure('private.is_service_os_store_member(uuid)') is null then
    raise exception 'AUTH_IDENTITY_FOUNDATION_REQUIRED' using errcode = '42883';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname in ('service_jobs_member_insert_v2', 'evidence_assets_member_insert_v2')
  ) then
    raise exception 'SERVICE_OS_WRITE_POLICY_COLLISION_REQUIRES_REVIEW' using errcode = '42710';
  end if;
end;
$$;

grant insert on table public.service_jobs, public.job_evidence_assets to authenticated;

create policy service_jobs_member_insert_v2 on public.service_jobs for insert to authenticated with check (
  private.current_service_os_business_profile_id() is not null
  and private.is_service_os_store_member(store_id)
  and created_by = private.current_service_os_business_profile_id()
  and evidence_revision = 1
  and payment_state = 'PAYMENT_NOT_REQUESTED'
  and state in ('JOB_CREATED', 'CONTRACT_REQUIRED', 'WORK_READY')
  and (customer_id is null or exists (
    select 1 from public.customers c
    where c.customer_id = service_jobs.customer_id and c.store_id = service_jobs.store_id
  ))
);

create policy evidence_assets_member_insert_v2 on public.job_evidence_assets for insert to authenticated with check (
  private.current_service_os_business_profile_id() is not null
  and private.is_service_os_store_member(store_id)
  and uploader_user_id = private.current_service_os_business_profile_id()
  and status = 'active'
  and exists (
    select 1 from public.service_jobs j
    where j.id = job_evidence_assets.job_id
      and j.store_id = job_evidence_assets.store_id
      and j.evidence_revision = job_evidence_assets.revision_number
  )
);

commit;
