-- DRAFT ONLY. Never place in supabase/migrations without a separate Owner Apply Gate.
-- 15 exact Production-shape tables; no customer/business row mutation.
-- The entire candidate is transaction-scoped to reject drift without partial policy state.
BEGIN;

DO $$
DECLARE target text;
DECLARE role_name text;
DECLARE privilege_name text;
DECLARE scope_type text;
BEGIN
  IF to_regnamespace('private') IS NULL
    OR to_regprocedure('public.is_store_member(uuid)') IS NULL
    OR to_regprocedure('private.is_legacy_text_store_member(text)') IS NOT NULL
    OR NOT has_schema_privilege('authenticated','private','USAGE') THEN
    RAISE EXCEPTION '15_TABLE_PRECONDITION_HELPER_STATE_MISMATCH';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ])) <> 2
  OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename='store_setup_requests'
      AND policyname IN ('setup_requests_select_own','setup_requests_update_own')) <> 2 THEN
    RAISE EXCEPTION '15_TABLE_PRECONDITION_POLICY_DRIFT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('setup_requests_select_own','SELECT','auth.uid=created_by',''),
      ('setup_requests_update_own','UPDATE','auth.uid=created_by','auth.uid=created_by')
    ) AS expected(policyname,cmd,qual,with_check)
    LEFT JOIN pg_policies p ON p.schemaname='public'
      AND p.tablename='store_setup_requests' AND p.policyname=expected.policyname
    WHERE p.policyname IS NULL OR p.cmd <> expected.cmd OR p.permissive <> 'PERMISSIVE'
      OR p.roles IS DISTINCT FROM ARRAY['public']::name[]
      OR regexp_replace(coalesce(p.qual,''),'[[:space:]()]','','g') <> expected.qual
      OR regexp_replace(coalesce(p.with_check,''),'[[:space:]()]','','g') <> expected.with_check
  ) THEN
    RAISE EXCEPTION '15_TABLE_PRECONDITION_POLICY_DRIFT';
  END IF;

  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=target AND c.relkind='r'
      AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) THEN
      RAISE EXCEPTION '15_TABLE_PRECONDITION_RLS_DRIFT: %',target;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF NOT has_table_privilege(role_name,format('public.%I',target),privilege_name) THEN
          RAISE EXCEPTION '15_TABLE_PRECONDITION_GRANT_DRIFT: % % %',target,role_name,privilege_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR target,scope_type IN SELECT * FROM (VALUES
    ('ai_briefing_logs','text'),('ai_reports','text'),('store_analytics_profile','text'),
    ('store_daily_metrics','text'),('store_home_content','text'),('store_priority_settings','text'),
    ('events','uuid'),('menu_categories','uuid'),('menu_items','uuid'),('orders','uuid'),
    ('sessions','uuid'),('store_modules','uuid'),('store_staff','uuid'),('store_tables','uuid')
  ) AS expected(table_name,data_type) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=target AND column_name='store_id'
      AND udt_name=scope_type) THEN
      RAISE EXCEPTION '15_TABLE_PRECONDITION_SCOPE_TYPE_DRIFT: %',target;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='store_setup_requests'
    AND column_name='created_by' AND udt_name='uuid') THEN
    RAISE EXCEPTION '15_TABLE_PRECONDITION_OWNER_SCOPE_DRIFT';
  END IF;
END $$;

-- Do not FORCE RLS: existing postgres-owned SECURITY DEFINER provisioning
-- writes store_home_content and store_priority_settings during store creation.
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',target);
  END LOOP;
END $$;

-- Only the browser operations proven by the active source call paths.
GRANT SELECT, INSERT ON public.menu_categories, public.menu_items, public.store_tables TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_priority_settings TO authenticated;

-- Service-role operations exercised by the current server API and webhook.
GRANT SELECT ON public.menu_categories, public.menu_items, public.store_tables,
  public.orders, public.store_home_content, public.store_setup_requests TO service_role;
GRANT INSERT ON public.orders, public.sessions, public.store_setup_requests TO service_role;
GRANT UPDATE ON public.orders, public.store_setup_requests TO service_role;

-- TEXT scope never casts arbitrary input to uuid. Exact canonical text equality
-- preserves the current auth.uid() == store_members.profile_id membership model.
CREATE FUNCTION private.is_legacy_text_store_member(target_store_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id::text = target_store_id AND sm.profile_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION private.is_legacy_text_store_member(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_legacy_text_store_member(text) TO authenticated;

CREATE POLICY menu_categories_member_select ON public.menu_categories
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
CREATE POLICY menu_categories_member_insert ON public.menu_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_store_member(store_id));
CREATE POLICY menu_items_member_select ON public.menu_items
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
CREATE POLICY menu_items_member_insert ON public.menu_items
  FOR INSERT TO authenticated WITH CHECK (public.is_store_member(store_id));
CREATE POLICY store_tables_member_select ON public.store_tables
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
CREATE POLICY store_tables_member_insert ON public.store_tables
  FOR INSERT TO authenticated WITH CHECK (public.is_store_member(store_id));
CREATE POLICY orders_member_select ON public.orders
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
CREATE POLICY priority_settings_member_select ON public.store_priority_settings
  FOR SELECT TO authenticated USING (private.is_legacy_text_store_member(store_id));
CREATE POLICY priority_settings_member_insert ON public.store_priority_settings
  FOR INSERT TO authenticated WITH CHECK (private.is_legacy_text_store_member(store_id));
CREATE POLICY priority_settings_member_update ON public.store_priority_settings
  FOR UPDATE TO authenticated
  USING (private.is_legacy_text_store_member(store_id))
  WITH CHECK (private.is_legacy_text_store_member(store_id));

-- Dormant setup_requests_* policies remain, but no browser table grants survive.
COMMIT;
