-- EMERGENCY WRITE LOCKDOWN DRAFT. Separate Owner approval is required.
-- Preserves all existing rows and leaves RLS enabled. This is not an automatic
-- restore of old anonymous grants and is not a complete application rollback.
begin;

revoke insert, update, delete on public.store_tables from anon, authenticated, service_role;
revoke insert, update, delete on public.sessions from anon, authenticated, service_role;
revoke insert, update, delete on public.orders from anon, authenticated, service_role;
revoke insert, update, delete on public.events from anon, authenticated, service_role;
revoke insert, update, delete on public.menu_categories from anon, authenticated, service_role;
revoke insert, update, delete on public.menu_items from anon, authenticated, service_role;
revoke insert, update, delete on public.store_staff from anon, authenticated, service_role;
revoke insert, update, delete on public.store_modules from anon, authenticated, service_role;
revoke insert, update, delete on public.ai_briefing_logs from anon, authenticated, service_role;
revoke insert, update, delete on public.store_analytics_profile from anon, authenticated, service_role;
revoke insert, update, delete on public.store_priority_settings from anon, authenticated, service_role;
revoke insert, update, delete on public.store_daily_metrics from anon, authenticated, service_role;
revoke insert, update, delete on public.ai_reports from anon, authenticated, service_role;
revoke insert, update, delete on public.store_home_content from anon, authenticated, service_role;
revoke insert, update, delete on public.store_setup_requests from anon, authenticated, service_role;

-- Provisioning is a SECURITY DEFINER write path; disable direct execution too.
-- The CI fixture does not reproduce this unrelated RPC body, so guard its absence.
do $lock$
begin
  if to_regprocedure('public.create_store_with_owner(text,text,text,text,text,text,text,text,text)') is not null then
    execute 'revoke execute on function public.create_store_with_owner(text,text,text,text,text,text,text,text,text) from public, anon, authenticated, service_role';
  end if;
end;
$lock$;

commit;
