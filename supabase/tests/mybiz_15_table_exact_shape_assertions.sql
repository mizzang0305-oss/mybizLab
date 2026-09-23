\set ON_ERROR_STOP on
-- Run only against the disposable fixture database. Fails before candidate apply.
DO $$
DECLARE target text;
DECLARE expected_auth text[] := ARRAY['menu_categories','menu_items','orders','store_priority_settings','store_tables'];
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
    'orders','sessions','store_analytics_profile','store_daily_metrics',
    'store_home_content','store_modules','store_priority_settings',
    'store_setup_requests','store_staff','store_tables'
  ] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',target)::regclass) THEN
      RAISE EXCEPTION 'RLS_NOT_ENABLED: %',target;
    END IF;
    IF has_table_privilege('anon',format('public.%I',target),'SELECT')
       OR has_table_privilege('anon',format('public.%I',target),'INSERT')
       OR has_table_privilege('anon',format('public.%I',target),'UPDATE')
       OR has_table_privilege('anon',format('public.%I',target),'DELETE') THEN
      RAISE EXCEPTION 'ANON_ACCESS_REMAINS: %',target;
    END IF;
    IF has_table_privilege('authenticated',format('public.%I',target),'DELETE')
       OR has_table_privilege('authenticated',format('public.%I',target),'TRUNCATE')
       OR has_table_privilege('authenticated',format('public.%I',target),'TRIGGER') THEN
      RAISE EXCEPTION 'AUTH_DESTRUCTIVE_ACCESS_REMAINS: %',target;
    END IF;
    IF has_table_privilege('authenticated',format('public.%I',target),'SELECT') <> (target=ANY(expected_auth)) THEN
      RAISE EXCEPTION 'AUTH_SELECT_MATRIX_MISMATCH: %',target;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.orders','UPDATE')
    OR has_table_privilege('authenticated','public.store_setup_requests','INSERT')
    OR has_table_privilege('authenticated','public.sessions','INSERT') THEN
    RAISE EXCEPTION 'BROWSER_WRITE_BOUNDARY_BROKEN';
  END IF;
  IF NOT has_table_privilege('authenticated','public.store_priority_settings','UPDATE') THEN
    RAISE EXCEPTION 'MERCHANT_PRIORITY_WRITE_MISSING';
  END IF;
  IF NOT has_table_privilege('service_role','public.sessions','INSERT')
    OR NOT has_table_privilege('service_role','public.orders','UPDATE')
    OR NOT has_table_privilege('service_role','public.store_setup_requests','INSERT') THEN
    RAISE EXCEPTION 'SERVER_OPERATION_MISSING';
  END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.menu_items) <> 1
    OR (SELECT count(*) FROM public.orders) <> 1
    OR (SELECT count(*) FROM public.store_priority_settings) <> 1 THEN
    RAISE EXCEPTION 'OWN_STORE_READ_FAILED';
  END IF;
  IF (SELECT count(*) FROM public.menu_items WHERE store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 0 THEN
    RAISE EXCEPTION 'CROSS_STORE_READ_ALLOWED';
  END IF;
  IF private.is_legacy_text_store_member('not-a-uuid') THEN
    RAISE EXCEPTION 'NON_UUID_TEXT_SCOPE_ALLOWED';
  END IF;
  INSERT INTO public.menu_categories(store_id,name)
    VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Own category');
  UPDATE public.store_priority_settings SET version=2
    WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF (SELECT version FROM public.store_priority_settings
    WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 2 THEN
    RAISE EXCEPTION 'OWN_STORE_UPDATE_FAILED';
  END IF;
  BEGIN
    INSERT INTO public.menu_categories(store_id,name) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Wrong store');
    RAISE EXCEPTION 'CROSS_STORE_INSERT_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.store_priority_settings SET store_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'CROSS_STORE_MOVE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.orders) <> 0 THEN
    RAISE EXCEPTION 'NONMEMBER_ORDER_READ_ALLOWED';
  END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM public.orders;
    RAISE EXCEPTION 'ANON_ORDER_READ_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.orders) <> 2 THEN
    RAISE EXCEPTION 'SERVICE_ROLE_ORDER_READ_FAILED';
  END IF;
END $$;
ROLLBACK;

\echo EXACT_SHAPE_GRANT_AND_RLS_MATRIX=PASS
