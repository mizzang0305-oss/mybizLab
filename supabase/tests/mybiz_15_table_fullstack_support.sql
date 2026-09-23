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

-- Minimal non-target dependencies required by the real public route. They
-- isolate the 15 target-table permission contract, not a full Production dump.
CREATE TABLE public.store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(store_id),
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  billing_provider text,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Synthetic Auth/Core foundation for the R3 provisioning rehearsal. The
-- Production Auth bridge remains untouched; this local fixture models only
-- the exact-ID and revoked-binding boundaries consumed by the new RPC.
CREATE SCHEMA core;
CREATE TABLE core.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  is_active boolean NOT NULL DEFAULT true
);
CREATE FUNCTION core.handle_auth_user_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO core.profiles (id) VALUES (new.id);
  RETURN new;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION core.handle_auth_user_created();
CREATE TABLE private.profile_auth_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  auth_profile_id uuid NOT NULL REFERENCES core.profiles(id),
  binding_source text NOT NULL CHECK (binding_source IN ('EXACT_ID','OWNER_VERIFIED','MIGRATION_VERIFIED','ADMIN_VERIFIED')),
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
  revoked_at timestamptz,
  UNIQUE (public_profile_id, auth_profile_id)
);
ALTER TABLE private.profile_auth_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.profile_auth_bindings FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(store_id),
  customer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_events (
  event_id text PRIMARY KEY,
  order_id text NOT NULL,
  provider text NOT NULL,
  user_id uuid,
  status text NOT NULL,
  amount numeric NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_subscriptions, public.inquiries, public.customers TO service_role;
GRANT INSERT ON public.customers TO service_role;
GRANT SELECT, INSERT ON public.payment_events TO service_role;
UPDATE public.stores SET slug = 'fixture-a' WHERE store_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.stores SET slug = 'fixture-b' WHERE store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
INSERT INTO public.store_subscriptions (store_id, plan) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pro'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pro');

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
