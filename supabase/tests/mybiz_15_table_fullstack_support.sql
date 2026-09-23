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
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  verified_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (binding_source <> 'EXACT_ID' OR public_profile_id = auth_profile_id),
  CHECK ((status = 'ACTIVE' AND revoked_at IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX profile_auth_bindings_active_auth_uidx ON private.profile_auth_bindings (auth_profile_id)
  WHERE status = 'ACTIVE' AND revoked_at IS NULL;
CREATE UNIQUE INDEX profile_auth_bindings_active_public_uidx ON private.profile_auth_bindings (public_profile_id)
  WHERE status = 'ACTIVE' AND revoked_at IS NULL;
CREATE INDEX profile_auth_bindings_auth_lookup_idx ON private.profile_auth_bindings (auth_profile_id, status);
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
-- Non-target canonical public-page/visitor-session dependencies are synthetic
-- route fixtures. Only the 15 target relations use the exact-shape catalog.
CREATE TABLE public.store_public_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(store_id),
  slug text NOT NULL, brand_name text NOT NULL, logo_url text,
  brand_color text NOT NULL DEFAULT '#ec5b13', tagline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '', business_type text, phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', directions text NOT NULL DEFAULT '',
  opening_hours text, parking_note text, public_status text NOT NULL DEFAULT 'public',
  homepage_visible boolean NOT NULL DEFAULT true, consultation_enabled boolean NOT NULL DEFAULT true,
  inquiry_enabled boolean NOT NULL DEFAULT false, reservation_enabled boolean NOT NULL DEFAULT false,
  order_entry_enabled boolean NOT NULL DEFAULT false, theme_preset text, preview_target text,
  hero_title text NOT NULL DEFAULT '', hero_subtitle text NOT NULL DEFAULT '',
  hero_description text NOT NULL DEFAULT '', primary_cta_label text, mobile_cta_label text,
  cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  notices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.visitor_sessions (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(store_id),
  public_page_id uuid REFERENCES public.store_public_pages(id),
  customer_id uuid, inquiry_id uuid, reservation_id uuid, waiting_entry_id uuid,
  visitor_token text NOT NULL, channel text NOT NULL, entry_path text NOT NULL,
  last_path text NOT NULL, referrer text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.store_public_pages, public.visitor_sessions TO service_role;
-- Browser post-provision reads and public-page upsert use the current
-- Production member policies (read-only catalog evidence, 2026-09-24).
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_member_access ON public.stores FOR ALL TO PUBLIC
  USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_members_select_member ON public.store_members FOR SELECT TO PUBLIC
  USING (public.is_store_member(store_id));
ALTER TABLE public.store_analytics_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_analytics_profiles_member_access ON public.store_analytics_profiles FOR ALL TO PUBLIC
  USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));
ALTER TABLE public.store_public_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_public_pages_member_access ON public.store_public_pages FOR ALL TO PUBLIC
  USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));
GRANT SELECT ON public.stores, public.store_members, public.store_analytics_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_public_pages TO authenticated;
CREATE TABLE public.platform_pricing_plans (
  plan_code text PRIMARY KEY, price_amount integer NOT NULL,
  status text NOT NULL, display_name text NOT NULL,
  currency text NOT NULL DEFAULT 'KRW'
);
INSERT INTO public.platform_pricing_plans (plan_code, price_amount, status, display_name)
VALUES ('pro', 79000, 'published', 'PRO'), ('vip', 149000, 'published', 'VIP');
GRANT SELECT ON public.platform_pricing_plans TO service_role;
CREATE TABLE public.platform_billing_products (
  product_code text PRIMARY KEY, product_name text NOT NULL,
  product_type text NOT NULL, linked_plan_code text,
  amount integer NOT NULL, currency text NOT NULL DEFAULT 'KRW',
  grants_entitlement boolean NOT NULL DEFAULT false,
  status text NOT NULL
);
INSERT INTO public.platform_billing_products
  (product_code, product_name, product_type, linked_plan_code, amount, grants_entitlement, status)
VALUES
  ('subscription_pro', 'Synthetic published PRO', 'subscription', 'pro', 82500, true, 'published'),
  ('archived_pro', 'Synthetic archived PRO', 'subscription', 'pro', 82500, true, 'archived');
GRANT SELECT ON public.platform_billing_products TO service_role;
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
