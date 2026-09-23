-- Sanitized catalog-shape fixture. No Production rows, identifiers, or credentials.
-- Target-table columns/types/defaults/constraints/indexes captured from read-only pg_catalog on 2026-09-23.
-- Dependency tables reproduce relevant key shape; only 15 targets are under test.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
-- Keep the real GoTrue/PostgREST auth.uid() when this fixture is staged in a
-- disposable Supabase stack. Standalone PostgreSQL rehearsal still needs it.
DO $fixture$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    EXECUTE $create$
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $body$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $body$;
    $create$;
  END IF;
END $fixture$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.stores (
  store_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Seoul'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  brand_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  slug text,
  trial_ends_at timestamp with time zone,
  plan text
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.store_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE FUNCTION public.is_store_member(target_store_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.store_id = target_store_id AND sm.profile_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_store_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_member(uuid) TO authenticated, service_role;

CREATE TABLE public.customers (
  customer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  customer_key text NOT NULL,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  quiet_mode boolean NOT NULL DEFAULT false,
  quiet_until timestamp with time zone,
  marketing_consent boolean,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text,
  normalized_phone text,
  normalized_email text,
  visit_count integer NOT NULL DEFAULT 0,
  is_regular boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone
);

CREATE TABLE public.ai_briefing_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  snapshot_id text,
  action_title text,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  period_type text,
  period_start date,
  period_end date,
  operations_score numeric,
  top_bottlenecks jsonb,
  recommended_actions jsonb,
  expected_impact jsonb,
  summary text,
  created_at timestamp with time zone DEFAULT now(),
  version integer DEFAULT 1
);

CREATE TABLE public.menu_categories (
  category_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL
);

CREATE TABLE public.store_tables (
  table_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  table_no integer NOT NULL,
  status text NOT NULL DEFAULT 'available'::text,
  status_updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_items (
  menu_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  category_id uuid,
  name text NOT NULL,
  price integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.sessions (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  table_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'qr_web'::text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  user_agent text,
  ip_hash text
);

CREATE TABLE public.orders (
  order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  table_id uuid NOT NULL,
  session_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  total_amount integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  payment_status text NOT NULL DEFAULT 'pending'::text,
  payment_source text,
  payment_method text,
  payment_recorded_at timestamp with time zone,
  customer_id uuid
);

CREATE TABLE public.events (
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  table_id uuid,
  session_id uuid,
  customer_id uuid,
  actor text NOT NULL,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.store_analytics_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  industry text,
  region text,
  customer_focus text,
  analytics_preset text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  version integer DEFAULT 1
);

CREATE TABLE public.store_daily_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  metric_date date NOT NULL,
  revenue_total numeric DEFAULT 0,
  revenue_growth_rate numeric DEFAULT 0,
  orders_count integer DEFAULT 0,
  avg_order_value numeric DEFAULT 0,
  new_customers integer DEFAULT 0,
  repeat_customers integer DEFAULT 0,
  repeat_customer_rate numeric DEFAULT 0,
  reservation_count integer DEFAULT 0,
  reservation_no_show_rate numeric DEFAULT 0,
  consultation_count integer DEFAULT 0,
  consultation_conversion_rate numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  review_response_rate numeric DEFAULT 0,
  operations_score numeric DEFAULT 0,
  waiting_dropoff_rate numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  version integer DEFAULT 1
);

CREATE TABLE public.store_home_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  hero_title text,
  hero_subtitle text,
  notice_text text,
  contact_enabled boolean DEFAULT true,
  consultation_enabled boolean DEFAULT true,
  reservation_enabled boolean DEFAULT true,
  layout_mode text DEFAULT 'default'::text,
  updated_at timestamp with time zone DEFAULT now(),
  version integer DEFAULT 1
);

CREATE TABLE public.store_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  module_key text NOT NULL,
  status text NOT NULL DEFAULT 'locked'::text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.store_priority_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  revenue_weight numeric DEFAULT 0.25,
  repeat_customer_weight numeric DEFAULT 0.25,
  reservation_weight numeric DEFAULT 0.15,
  consultation_weight numeric DEFAULT 0.10,
  branding_weight numeric DEFAULT 0.15,
  order_efficiency_weight numeric DEFAULT 0.10,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  version integer DEFAULT 1
);

CREATE TABLE public.store_setup_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid,
  business_name text NOT NULL,
  owner_name text NOT NULL,
  business_number text,
  phone text,
  email text,
  address text,
  business_type text,
  requested_slug text,
  selected_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  converted_store_id uuid,
  requested_plan text NOT NULL DEFAULT 'free'::text
);

CREATE TABLE public.store_staff (
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_briefing_logs ADD CONSTRAINT ai_briefing_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_reports ADD CONSTRAINT ai_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (event_id);
ALTER TABLE public.menu_categories ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (category_id);
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_pkey PRIMARY KEY (menu_id);
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'other'::text]));
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_source_check CHECK (payment_source = ANY (ARRAY['counter'::text, 'mobile'::text]));
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text]));
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);
ALTER TABLE public.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (session_id);
ALTER TABLE public.store_analytics_profile ADD CONSTRAINT store_analytics_profile_pkey PRIMARY KEY (id);
ALTER TABLE public.store_daily_metrics ADD CONSTRAINT store_daily_metrics_pkey PRIMARY KEY (id);
ALTER TABLE public.store_home_content ADD CONSTRAINT store_home_content_pkey PRIMARY KEY (id);
ALTER TABLE public.store_home_content ADD CONSTRAINT store_home_content_store_id_key UNIQUE (store_id);
ALTER TABLE public.store_modules ADD CONSTRAINT store_modules_pkey PRIMARY KEY (id);
ALTER TABLE public.store_modules ADD CONSTRAINT store_modules_store_id_module_key_key UNIQUE (store_id, module_key);
ALTER TABLE public.store_priority_settings ADD CONSTRAINT store_priority_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.store_priority_settings ADD CONSTRAINT store_priority_settings_store_id_key UNIQUE (store_id);
ALTER TABLE public.store_setup_requests ADD CONSTRAINT store_setup_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.store_setup_requests ADD CONSTRAINT store_setup_requests_requested_plan_check CHECK (requested_plan = ANY (ARRAY['free'::text, 'pro'::text, 'vip'::text]));
ALTER TABLE public.store_staff ADD CONSTRAINT store_staff_pkey PRIMARY KEY (store_id, user_id);
ALTER TABLE public.store_tables ADD CONSTRAINT store_tables_pkey PRIMARY KEY (table_id);
ALTER TABLE public.store_tables ADD CONSTRAINT store_tables_store_id_table_no_key UNIQUE (store_id, table_no);
ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);
ALTER TABLE public.customers ADD CONSTRAINT customers_store_id_customer_key_key UNIQUE (store_id, customer_key);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.store_members ADD CONSTRAINT store_members_pkey PRIMARY KEY (id);
ALTER TABLE public.store_members ADD CONSTRAINT store_members_role_check CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]));
ALTER TABLE public.store_members ADD CONSTRAINT store_members_store_id_profile_id_key UNIQUE (store_id, profile_id);
ALTER TABLE public.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);

ALTER TABLE public.events ADD CONSTRAINT events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL;
ALTER TABLE public.events ADD CONSTRAINT events_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL;
ALTER TABLE public.events ADD CONSTRAINT events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.events ADD CONSTRAINT events_table_id_fkey FOREIGN KEY (table_id) REFERENCES store_tables(table_id) ON DELETE SET NULL;
ALTER TABLE public.menu_categories ADD CONSTRAINT menu_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES menu_categories(category_id) ON DELETE SET NULL;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES store_tables(table_id) ON DELETE RESTRICT;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_table_id_fkey FOREIGN KEY (table_id) REFERENCES store_tables(table_id) ON DELETE RESTRICT;
ALTER TABLE public.store_modules ADD CONSTRAINT store_modules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.store_setup_requests ADD CONSTRAINT store_setup_requests_converted_store_id_fkey FOREIGN KEY (converted_store_id) REFERENCES stores(store_id) ON DELETE SET NULL;
ALTER TABLE public.store_staff ADD CONSTRAINT store_staff_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.store_tables ADD CONSTRAINT store_tables_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD CONSTRAINT customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
ALTER TABLE public.store_members ADD CONSTRAINT store_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.store_members ADD CONSTRAINT store_members_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;

CREATE INDEX idx_ai_briefing_logs_store ON public.ai_briefing_logs USING btree (store_id);
CREATE INDEX idx_ai_reports_store_id ON public.ai_reports USING btree (store_id);
CREATE INDEX idx_events_store_created ON public.events USING btree (store_id, created_at DESC);
CREATE INDEX idx_events_table_created ON public.events USING btree (table_id, created_at DESC);
CREATE UNIQUE INDEX ux_events_dedupe ON public.events USING btree (store_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);
CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);
CREATE INDEX idx_orders_store_customer ON public.orders USING btree (store_id, customer_id) WHERE (customer_id IS NOT NULL);
CREATE INDEX idx_orders_store_table_created ON public.orders USING btree (store_id, table_id, created_at DESC);
CREATE INDEX orders_store_payment_status_idx ON public.orders USING btree (store_id, payment_status, created_at DESC);
CREATE INDEX idx_sessions_store_table_started ON public.sessions USING btree (store_id, table_id, started_at DESC);
CREATE INDEX idx_store_analytics_profile_store_id ON public.store_analytics_profile USING btree (store_id);
CREATE INDEX idx_store_daily_metrics_store_date ON public.store_daily_metrics USING btree (store_id, metric_date DESC);
CREATE INDEX idx_store_home_content_store_id ON public.store_home_content USING btree (store_id);
CREATE INDEX idx_store_priority_settings_store_id ON public.store_priority_settings USING btree (store_id);
CREATE INDEX store_setup_requests_email_idx ON public.store_setup_requests USING btree (email);
CREATE INDEX store_setup_requests_requested_slug_idx ON public.store_setup_requests USING btree (requested_slug);
CREATE INDEX idx_store_tables_store_status ON public.store_tables USING btree (store_id, status);

GRANT ALL ON TABLE public.ai_briefing_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_reports TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.menu_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_tables TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.menu_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.events TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_analytics_profile TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_daily_metrics TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_home_content TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_modules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_priority_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_setup_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_staff TO anon, authenticated, service_role;
-- Synthetic Auth setup uses the local server role on dependency tables only.
GRANT SELECT, INSERT, UPDATE ON TABLE public.stores, public.profiles, public.store_members TO service_role;

CREATE POLICY setup_requests_select_own ON public.store_setup_requests FOR SELECT TO PUBLIC USING (auth.uid() = created_by);
CREATE POLICY setup_requests_update_own ON public.store_setup_requests FOR UPDATE TO PUBLIC USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Synthetic access matrix only. These UUIDs are fixture constants, not Production identifiers.
INSERT INTO public.stores (store_id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fixture A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Fixture B');
INSERT INTO public.profiles (id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.store_members (store_id, profile_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222');
INSERT INTO public.customers (customer_id, store_id, customer_key) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'fixture-a'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fixture-b');
INSERT INTO public.store_tables (table_id, store_id, table_no) VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1);
INSERT INTO public.menu_categories (category_id, store_id, name) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fixture A'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Fixture B');
INSERT INTO public.menu_items (menu_id, store_id, category_id, name, price) VALUES
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'A item', 100),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'B item', 200);
INSERT INTO public.sessions (session_id, store_id, table_id, customer_id) VALUES
  ('99999999-9999-4999-8999-999999999991', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
  ('99999999-9999-4999-8999-999999999992', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2');
INSERT INTO public.orders (order_id, store_id, table_id, session_id, total_amount) VALUES
  ('88888888-8888-4888-8888-888888888881', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '99999999-9999-4999-8999-999999999991', 100),
  ('88888888-8888-4888-8888-888888888882', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '99999999-9999-4999-8999-999999999992', 200);
INSERT INTO public.store_priority_settings (store_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.store_home_content (store_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.store_setup_requests (business_name, owner_name, created_by) VALUES
  ('Fixture A', 'Synthetic', null),
  ('Fixture B', 'Synthetic', null);
