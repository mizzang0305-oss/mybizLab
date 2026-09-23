\set ON_ERROR_STOP on
DO $$
DECLARE target text;
DECLARE role_name text;
DECLARE privilege_name text;
BEGIN
  IF to_regprocedure('private.is_legacy_text_store_member(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK_HELPER_REMAINS';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ])) <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_POLICY_COUNT_MISMATCH';
  END IF;
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ] LOOP
    IF (SELECT relrowsecurity OR relforcerowsecurity FROM pg_class
      WHERE oid=format('public.%I',target)::regclass) THEN
      RAISE EXCEPTION 'ROLLBACK_RLS_REMAINS: %',target;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF NOT has_table_privilege(role_name,format('public.%I',target),privilege_name) THEN
          RAISE EXCEPTION 'ROLLBACK_GRANT_MISSING: % % %',target,role_name,privilege_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
\echo EXACT_SHAPE_ROLLBACK=PASS
