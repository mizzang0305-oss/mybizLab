-- DRAFT ONLY. Owner-gated permission rollback for the exact 15-table candidate.
-- No DELETE, TRUNCATE, business-row rewrite, or unrelated schema change.
BEGIN;
DO $$
DECLARE target text;
DECLARE privilege_name text;
DECLARE expected_auth boolean;
DECLARE expected_service boolean;
BEGIN
  IF to_regprocedure('private.is_legacy_text_store_member(text)') IS NULL THEN
    RAISE EXCEPTION '15_TABLE_ROLLBACK_HELPER_MISSING';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ])) <> 12 THEN
    RAISE EXCEPTION '15_TABLE_ROLLBACK_POLICY_DRIFT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('store_setup_requests','setup_requests_select_own','SELECT','public','auth.uid=created_by',''),
      ('store_setup_requests','setup_requests_update_own','UPDATE','public','auth.uid=created_by','auth.uid=created_by'),
      ('menu_categories','menu_categories_member_select','SELECT','authenticated','is_store_memberstore_id',''),
      ('menu_categories','menu_categories_member_insert','INSERT','authenticated','','is_store_memberstore_id'),
      ('menu_items','menu_items_member_select','SELECT','authenticated','is_store_memberstore_id',''),
      ('menu_items','menu_items_member_insert','INSERT','authenticated','','is_store_memberstore_id'),
      ('store_tables','store_tables_member_select','SELECT','authenticated','is_store_memberstore_id',''),
      ('store_tables','store_tables_member_insert','INSERT','authenticated','','is_store_memberstore_id'),
      ('orders','orders_member_select','SELECT','authenticated','is_store_memberstore_id',''),
      ('store_priority_settings','priority_settings_member_select','SELECT','authenticated','private.is_legacy_text_store_memberstore_id',''),
      ('store_priority_settings','priority_settings_member_insert','INSERT','authenticated','','private.is_legacy_text_store_memberstore_id'),
      ('store_priority_settings','priority_settings_member_update','UPDATE','authenticated','private.is_legacy_text_store_memberstore_id','private.is_legacy_text_store_memberstore_id')
    ) AS expected(tablename,policyname,cmd,role_name,qual,with_check)
    LEFT JOIN pg_policies p ON p.schemaname='public'
      AND p.tablename=expected.tablename AND p.policyname=expected.policyname
    WHERE p.policyname IS NULL OR p.cmd <> expected.cmd OR p.permissive <> 'PERMISSIVE'
      OR p.roles IS DISTINCT FROM ARRAY[expected.role_name]::name[]
      OR replace(regexp_replace(coalesce(p.qual,''),'[[:space:]()]','','g'),
        'public.is_store_member','is_store_member') <> expected.qual
      OR replace(regexp_replace(coalesce(p.with_check,''),'[[:space:]()]','','g'),
        'public.is_store_member','is_store_member') <> expected.with_check
  ) THEN
    RAISE EXCEPTION '15_TABLE_ROLLBACK_POLICY_DRIFT';
  END IF;
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ] LOOP
    IF NOT (SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class
      WHERE oid=format('public.%I',target)::regclass) THEN
      RAISE EXCEPTION '15_TABLE_ROLLBACK_RLS_DRIFT: %',target;
    END IF;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected_auth := (privilege_name='SELECT' AND target IN
          ('menu_categories','menu_items','store_tables','orders','store_priority_settings'))
        OR (privilege_name='INSERT' AND target IN
          ('menu_categories','menu_items','store_tables','store_priority_settings'))
        OR (privilege_name='UPDATE' AND target='store_priority_settings');
      expected_service := (privilege_name='SELECT' AND target IN
          ('menu_categories','menu_items','store_tables','orders','store_home_content','store_setup_requests'))
        OR (privilege_name='INSERT' AND target IN ('orders','sessions','store_setup_requests'))
        OR (privilege_name='UPDATE' AND target IN ('orders','store_setup_requests'));
      IF has_table_privilege('anon',format('public.%I',target),privilege_name)
        OR has_table_privilege('authenticated',format('public.%I',target),privilege_name) IS DISTINCT FROM expected_auth
        OR has_table_privilege('service_role',format('public.%I',target),privilege_name) IS DISTINCT FROM expected_service THEN
        RAISE EXCEPTION '15_TABLE_ROLLBACK_GRANT_DRIFT: % %',target,privilege_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP POLICY menu_categories_member_select ON public.menu_categories;
DROP POLICY menu_categories_member_insert ON public.menu_categories;
DROP POLICY menu_items_member_select ON public.menu_items;
DROP POLICY menu_items_member_insert ON public.menu_items;
DROP POLICY store_tables_member_select ON public.store_tables;
DROP POLICY store_tables_member_insert ON public.store_tables;
DROP POLICY orders_member_select ON public.orders;
DROP POLICY priority_settings_member_select ON public.store_priority_settings;
DROP POLICY priority_settings_member_insert ON public.store_priority_settings;
DROP POLICY priority_settings_member_update ON public.store_priority_settings;
DROP FUNCTION private.is_legacy_text_store_member(text);

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',target);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role',target);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',target);
  END LOOP;
END $$;
COMMIT;
