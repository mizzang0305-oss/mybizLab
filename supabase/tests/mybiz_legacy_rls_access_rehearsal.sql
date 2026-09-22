-- Synthetic PostgreSQL authorization-shape rehearsal only.
-- This is NOT a migration and must never be applied to the linked MyBiz project.
-- No real identifiers, customer rows, credentials, or Production schema are copied.
\set ON_ERROR_STOP on

BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.store_members (store_id uuid NOT NULL, profile_id uuid NOT NULL);
INSERT INTO public.store_members VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222');

CREATE FUNCTION public.is_store_member(target_store_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = target_store_id AND profile_id = auth.uid()
  );
$$;

-- All fourteen store-scoped targets receive two synthetic tenant rows.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs', 'ai_reports', 'events', 'menu_categories', 'menu_items',
    'orders', 'sessions', 'store_analytics_profile', 'store_daily_metrics',
    'store_home_content', 'store_modules', 'store_priority_settings',
    'store_staff', 'store_tables'
  ] LOOP
    EXECUTE format('CREATE TABLE public.%I (id uuid PRIMARY KEY, store_id uuid NOT NULL, payload text)', target);
    EXECUTE format(
      'INSERT INTO public.%I (id, store_id, payload) VALUES
       (''00000000-0000-4000-8000-000000000001'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', ''synthetic A''),
       (''00000000-0000-4000-8000-000000000002'', ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'', ''synthetic B'')',
      target
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated, service_role', target);
  END LOOP;
END $$;

CREATE TABLE public.store_setup_requests (id uuid PRIMARY KEY, created_by uuid NOT NULL, payload text);
INSERT INTO public.store_setup_requests VALUES
  ('00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'synthetic A'),
  ('00000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'synthetic B');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_setup_requests TO anon, authenticated, service_role;

-- Mirror the current dormant Production policy shape before enabling RLS.
CREATE POLICY setup_requests_select_own ON public.store_setup_requests
  FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY setup_requests_update_own ON public.store_setup_requests
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs', 'ai_reports', 'events', 'menu_categories', 'menu_items',
    'orders', 'sessions', 'store_analytics_profile', 'store_daily_metrics',
    'store_home_content', 'store_modules', 'store_priority_settings',
    'store_setup_requests', 'store_staff', 'store_tables'
  ] LOOP
    IF (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', target)::regclass) THEN
      RAISE EXCEPTION 'BASELINE_RLS_ALREADY_ENABLED: %', target;
    END IF;
    IF NOT (has_table_privilege('anon', format('public.%I', target), 'SELECT')
      AND has_table_privilege('anon', format('public.%I', target), 'INSERT')
      AND has_table_privilege('anon', format('public.%I', target), 'UPDATE')
      AND has_table_privilege('anon', format('public.%I', target), 'DELETE')) THEN
      RAISE EXCEPTION 'BASELINE_ANON_GRANT_MISMATCH: %', target;
    END IF;
  END LOOP;
END $$;
\echo BASELINE_15_RLS_DISABLED_AND_ANON_CRUD=PASS

-- Illustrative least-privilege candidate. This block is deliberately test-only.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs', 'ai_reports', 'events', 'menu_categories', 'menu_items',
    'orders', 'sessions', 'store_analytics_profile', 'store_daily_metrics',
    'store_home_content', 'store_modules', 'store_priority_settings',
    'store_setup_requests', 'store_staff', 'store_tables'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', target);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END $$;

-- Six observed browser read surfaces. The public-page fallback still needs
-- a separate route-equivalence decision before any Production change.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'menu_categories', 'menu_items', 'orders', 'store_home_content',
    'store_priority_settings', 'store_tables'
  ] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', target);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_store_member(store_id))',
      target || '_member_select', target
    );
  END LOOP;

  FOREACH target IN ARRAY ARRAY[
    'menu_categories', 'menu_items', 'store_priority_settings', 'store_tables'
  ] LOOP
    EXECUTE format('GRANT INSERT ON public.%I TO authenticated', target);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_store_member(store_id))',
      target || '_member_insert', target
    );
  END LOOP;

  FOREACH target IN ARRAY ARRAY[
    'menu_categories', 'menu_items', 'orders', 'store_priority_settings', 'store_tables'
  ] LOOP
    EXECUTE format('GRANT UPDATE ON public.%I TO authenticated', target);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
       USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id))',
      target || '_member_update', target
    );
  END LOOP;
END $$;

GRANT SELECT, UPDATE ON public.store_setup_requests TO authenticated;

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs', 'ai_reports', 'events', 'menu_categories', 'menu_items',
    'orders', 'sessions', 'store_analytics_profile', 'store_daily_metrics',
    'store_home_content', 'store_modules', 'store_priority_settings',
    'store_setup_requests', 'store_staff', 'store_tables'
  ] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', target)::regclass) THEN
      RAISE EXCEPTION 'TARGET_RLS_MISSING: %', target;
    END IF;
    IF has_table_privilege('anon', format('public.%I', target), 'SELECT')
      OR has_table_privilege('anon', format('public.%I', target), 'INSERT')
      OR has_table_privilege('anon', format('public.%I', target), 'UPDATE')
      OR has_table_privilege('anon', format('public.%I', target), 'DELETE') THEN
      RAISE EXCEPTION 'ANON_GRANT_REMAINS: %', target;
    END IF;
    IF NOT has_table_privilege('service_role', format('public.%I', target), 'SELECT') THEN
      RAISE EXCEPTION 'SERVICE_ROLE_READ_LOST: %', target;
    END IF;
  END LOOP;
END $$;
\echo TARGET_15_RLS_ENABLED_ANON_DENIED_SERVICE_ROLE_PRESERVED=PASS

SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SET ROLE authenticated;
DO $$
DECLARE target text; visible_rows integer; changed_rows integer;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'menu_categories', 'menu_items', 'orders', 'store_home_content',
    'store_priority_settings', 'store_tables'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', target) INTO visible_rows;
    IF visible_rows <> 1 THEN
      RAISE EXCEPTION 'MEMBER_SELECT_NOT_TENANT_SCOPED: %, %', target, visible_rows;
    END IF;
  END LOOP;

  SELECT count(*) INTO visible_rows FROM public.store_setup_requests;
  IF visible_rows <> 1 THEN RAISE EXCEPTION 'OWN_SETUP_REQUEST_SELECT_FAILED'; END IF;

  INSERT INTO public.menu_items (id, store_id, payload)
    VALUES ('00000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic member write');
  UPDATE public.orders SET payload = 'synthetic member update'
    WHERE store_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 1 THEN RAISE EXCEPTION 'OWN_ORDER_UPDATE_FAILED'; END IF;
  UPDATE public.store_setup_requests SET payload = 'synthetic owner update'
    WHERE created_by = '11111111-1111-4111-8111-111111111111';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 1 THEN RAISE EXCEPTION 'OWN_SETUP_REQUEST_UPDATE_FAILED'; END IF;

  UPDATE public.orders SET payload = 'forbidden cross-store update'
    WHERE store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 0 THEN RAISE EXCEPTION 'CROSS_STORE_ORDER_UPDATE_ALLOWED'; END IF;

  BEGIN
    INSERT INTO public.menu_items (id, store_id, payload)
      VALUES ('00000000-0000-4000-8000-000000000004', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'forbidden');
    RAISE EXCEPTION 'CROSS_STORE_MENU_INSERT_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.store_setup_requests (id, created_by, payload)
      VALUES ('00000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'forbidden');
    RAISE EXCEPTION 'BROWSER_SETUP_REQUEST_INSERT_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
\echo AUTH_MEMBER_OWN_READ_WRITE_CROSS_STORE_DENY=PASS

SET LOCAL request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
SET ROLE authenticated;
DO $$
DECLARE visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows FROM public.menu_items;
  IF visible_rows <> 0 THEN RAISE EXCEPTION 'NONMEMBER_MENU_READ_ALLOWED'; END IF;
  SELECT count(*) INTO visible_rows FROM public.store_setup_requests;
  IF visible_rows <> 0 THEN RAISE EXCEPTION 'NONOWNER_SETUP_REQUEST_READ_ALLOWED'; END IF;
  IF has_table_privilege(current_user, 'public.ai_reports', 'SELECT')
    OR has_table_privilege(current_user, 'public.sessions', 'INSERT') THEN
    RAISE EXCEPTION 'SERVER_ONLY_BROWSER_GRANT_FOUND';
  END IF;
END $$;
RESET ROLE;
\echo AUTH_NONMEMBER_AND_SERVER_ONLY_DENY=PASS

SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.menu_items;
    RAISE EXCEPTION 'ANON_MENU_READ_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.sessions (id, store_id) VALUES
      ('00000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    RAISE EXCEPTION 'ANON_SESSION_INSERT_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
\echo ANON_READ_WRITE_DENY=PASS

SET ROLE service_role;
DO $$
DECLARE visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows FROM public.menu_items;
  IF visible_rows <> 3 THEN RAISE EXCEPTION 'SERVICE_ROLE_MEMBER_DATA_LOST'; END IF;
  SELECT count(*) INTO visible_rows FROM public.store_setup_requests;
  IF visible_rows <> 2 THEN RAISE EXCEPTION 'SERVICE_ROLE_SETUP_DATA_LOST'; END IF;
END $$;
RESET ROLE;
\echo SERVICE_ROLE_READ_PRESERVED=PASS

ROLLBACK;
\echo SYNTHETIC_REHEARSAL_ROLLED_BACK=PASS
