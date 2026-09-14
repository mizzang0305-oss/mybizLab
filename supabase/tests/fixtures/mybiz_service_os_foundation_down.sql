-- CI-ONLY Window A rollback rehearsal.
-- Refuses to drop anything after legitimate Service OS rows exist.

begin;

do $$
declare
  v_table text;
  v_count bigint;
begin
  foreach v_table in array array[
    'service_jobs', 'job_evidence_assets', 'job_evidence_revisions',
    'job_confirmations', 'job_confirmation_links', 'consent_records',
    'job_payment_requests', 'content_candidates', 'brand_sites',
    'brand_site_portfolio_items', 'vertical_templates'
  ]
  loop
    execute format('select count(*) from public.%I', v_table) into v_count;
    if v_count <> 0 then
      raise exception 'SERVICE_OS_ROLLBACK_REQUIRES_ZERO_ROWS: public.% has % rows', v_table, v_count using errcode = '55000';
    end if;
  end loop;
end;
$$;

drop trigger enforce_portfolio_publication_eligibility_before_write on public.brand_site_portfolio_items;
drop trigger enforce_content_candidate_terminal_state_before_write on public.content_candidates;
drop trigger initialize_job_evidence_revision_after_insert on public.service_jobs;

drop function private.enforce_portfolio_publication_eligibility();
drop function private.enforce_content_candidate_terminal_state();
drop function private.is_service_os_publication_eligible(uuid, uuid, integer, text, timestamptz);
drop function private.consume_job_confirmation_link(text, text, text, jsonb);
drop function private.create_next_job_evidence_revision(uuid, uuid, text);
drop function private.initialize_job_evidence_revision();

drop schema private;

drop table public.brand_site_portfolio_items;
drop table public.brand_sites;
drop table public.content_candidates;
drop table public.job_payment_requests;
drop table public.consent_records;
drop table public.job_confirmation_links;
drop table public.job_confirmations;
drop table public.job_evidence_assets;
drop table public.job_evidence_revisions;
drop table public.service_jobs;
drop table public.vertical_templates;

commit;
