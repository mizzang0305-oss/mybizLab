\set ON_ERROR_STOP on
DO $$
DECLARE targets text[] := ARRAY[
  'ai_briefing_logs','ai_reports','events','menu_categories','menu_items',
  'orders','sessions','store_analytics_profile','store_daily_metrics',
  'store_home_content','store_modules','store_priority_settings',
  'store_setup_requests','store_staff','store_tables'
];
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY(targets)) <> 147 THEN
    RAISE EXCEPTION 'EXACT_COLUMN_COUNT_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=ANY(targets)) <> 41 THEN
    RAISE EXCEPTION 'EXACT_CONSTRAINT_COUNT_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM pg_indexes WHERE schemaname='public'
      AND tablename=ANY(targets)) <> 36 THEN
    RAISE EXCEPTION 'EXACT_INDEX_COUNT_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY(targets)
      AND column_name='store_id' AND udt_name='text') <> 6
    OR (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY(targets)
      AND column_name='store_id' AND udt_name='uuid') <> 8 THEN
    RAISE EXCEPTION 'EXACT_STORE_SCOPE_TYPE_MISMATCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='store_setup_requests'
      AND column_name='created_by' AND udt_name='uuid' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'SETUP_REQUEST_OWNER_SCOPE_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='orders'
      AND column_name=ANY(ARRAY['payment_status','payment_source','payment_method','payment_recorded_at','customer_id'])) <> 5 THEN
    RAISE EXCEPTION 'ORDER_SENSITIVITY_COLUMNS_MISSING';
  END IF;
END $$;
\echo EXACT_CATALOG_SHAPE=PASS
