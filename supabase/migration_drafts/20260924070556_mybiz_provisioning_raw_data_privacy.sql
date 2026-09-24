-- R5 DRAFT narrow raw Data API boundary. Apply only after the provisioning HOLD
-- migration and its independent postcheck. No other business table is changed.
BEGIN;

DO $guard$
DECLARE
  target record;
BEGIN
  IF to_regclass('private.store_provisioning_release_control') IS NULL
     OR (SELECT count(*) FROM private.store_provisioning_release_control
         WHERE singleton = true AND mode = 'HOLD') <> 1 THEN
    RAISE EXCEPTION 'R5 requires the installed provisioning release control in HOLD';
  END IF;

  IF to_regprocedure('private.is_legacy_text_store_member(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'R5 legacy text membership helper collision';
  END IF;

  IF NOT has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'R5 requires existing authenticated private schema usage';
  END IF;

  FOR target IN
    SELECT c.oid, c.relname, c.relowner, c.relrowsecurity, c.relforcerowsecurity,
           c.relacl, a.atttypid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attribute a ON a.attrelid = c.oid
                                  AND a.attname = 'store_id' AND NOT a.attisdropped
     WHERE n.nspname = 'public'
       AND c.relname IN ('store_home_content', 'store_priority_settings')
       AND c.relkind = 'r'
  LOOP
    IF target.relowner <> 'postgres'::regrole
       OR target.relrowsecurity OR target.relforcerowsecurity
       OR target.atttypid IS DISTINCT FROM 'text'::regtype
       OR target.relacl::text <> '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
       OR EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = target.relname) THEN
      RAISE EXCEPTION 'R5 unexpected baseline for public.%', target.relname;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND c.relname IN ('store_home_content', 'store_priority_settings')) <> 2 THEN
    RAISE EXCEPTION 'R5 target table count differs from two';
  END IF;
END
$guard$;

CREATE FUNCTION private.is_legacy_text_store_member(target_store_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.store_members AS member
       WHERE member.store_id::text = target_store_id
         AND member.profile_id = auth.uid()
    );
$function$;

REVOKE ALL ON FUNCTION private.is_legacy_text_store_member(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_legacy_text_store_member(text) TO authenticated;

REVOKE ALL ON TABLE public.store_home_content FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.store_home_content ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.store_home_content TO service_role;

REVOKE ALL ON TABLE public.store_priority_settings FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.store_priority_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.store_priority_settings TO authenticated;

CREATE POLICY store_priority_settings_member_select
  ON public.store_priority_settings FOR SELECT TO authenticated
  USING (private.is_legacy_text_store_member(store_id));

CREATE POLICY store_priority_settings_member_insert
  ON public.store_priority_settings FOR INSERT TO authenticated
  WITH CHECK (private.is_legacy_text_store_member(store_id));

CREATE POLICY store_priority_settings_member_update
  ON public.store_priority_settings FOR UPDATE TO authenticated
  USING (private.is_legacy_text_store_member(store_id))
  WITH CHECK (private.is_legacy_text_store_member(store_id));

COMMIT;
