-- LOCAL SYNTHETIC SUPPORT ONLY. Never promote or apply to a linked project.
-- The 15 target relations come unchanged from mybiz_15_table_exact_shape_fixture.sql.
-- These non-target dependencies let the historical provisioning RPC run in a
-- disposable Supabase Auth/PostgREST stack. They are not Production-shape proof.

ALTER TABLE public.stores
  ADD COLUMN owner_name text,
  ADD COLUMN business_number text,
  ADD COLUMN phone text,
  ADD COLUMN email text,
  ADD COLUMN address text,
  ADD COLUMN business_type text;

CREATE TABLE public.store_analytics_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(store_id),
  industry text,
  region text,
  customer_focus text,
  analytics_preset text,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The current Production ACL/function signature are checked independently.
-- This helper is a synthetic slug dependency, not a claim of byte parity.
CREATE FUNCTION public.generate_unique_store_slug(base_name text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  base_slug text := trim(both '-' from regexp_replace(lower(trim(base_name)), '[^a-z0-9]+', '-', 'g'));
  candidate text;
  suffix integer := 1;
BEGIN
  IF base_slug = '' THEN base_slug := 'fixture-store'; END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = candidate) LOOP
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  END LOOP;
  RETURN candidate;
END $$;
REVOKE ALL ON FUNCTION public.generate_unique_store_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_unique_store_slug(text) TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.store_analytics_profiles TO service_role;

-- Local-only invoker probe proves Kong/PostgREST's JWT-to-Postgres role mapping.
CREATE FUNCTION public.local_test_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT current_user::text;
$$;
REVOKE ALL ON FUNCTION public.local_test_current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.local_test_current_role() TO anon, authenticated, service_role;
