-- Incident-only, two-table rollback. This intentionally restores the verified
-- pre-R5 broad ACL and therefore must never run automatically in a release.
-- It does not touch provisioning RPCs, receipts, control, stores or rows.
BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'store_priority_settings'
                 AND policyname = 'store_priority_settings_member_select')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'store_priority_settings'
                 AND policyname = 'store_priority_settings_member_insert')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'store_priority_settings'
                 AND policyname = 'store_priority_settings_member_update')
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'store_priority_settings') <> 3
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'store_home_content')
     OR to_regprocedure('private.is_legacy_text_store_member(text)') IS NULL THEN
    RAISE EXCEPTION 'R5 rollback target differs from reviewed state';
  END IF;
END
$guard$;

DROP POLICY store_priority_settings_member_update ON public.store_priority_settings;
DROP POLICY store_priority_settings_member_insert ON public.store_priority_settings;
DROP POLICY store_priority_settings_member_select ON public.store_priority_settings;
ALTER TABLE public.store_home_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_priority_settings DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_home_content FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.store_priority_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_home_content TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_priority_settings TO anon, authenticated, service_role;
DROP FUNCTION private.is_legacy_text_store_member(text);

COMMIT;
