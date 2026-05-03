-- MyBiz Platform Admin Console
-- Date: 2026-05-01
-- Status: migration file only. Do not apply automatically to production.
-- Purpose: Separate MyBiz platform operations from merchant /dashboard operations.

create extension if not exists pgcrypto;

create table if not exists public.platform_admin_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'platform_admin' check (role in ('platform_owner', 'platform_admin', 'platform_viewer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id)
);

create table if not exists public.platform_site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'MyBiz',
  homepage_status text not null default 'published' check (homepage_status in ('draft', 'published', 'maintenance')),
  seo_title text,
  seo_description text,
  og_image_url text,
  primary_cta_label text,
  primary_cta_href text,
  secondary_cta_label text,
  secondary_cta_href text,
  support_email text,
  support_phone text,
  footer_company_name text,
  footer_business_info text,
  footer_links jsonb not null default '[]'::jsonb,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  section_type text not null check (
    section_type in (
      'hero',
      'value_cards',
      'problem',
      'solution',
      'customer_memory_flow',
      'features',
      'pricing_teaser',
      'testimonials',
      'faq',
      'final_cta',
      'custom_json'
    )
  ),
  title text,
  subtitle text,
  body text,
  eyebrow text,
  cta_label text,
  cta_href text,
  media_url text,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_visible boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz null,
  ends_at timestamptz null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_pricing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique check (plan_code in ('free', 'pro', 'vip')),
  display_name text not null,
  badge_text text null,
  price_amount integer not null default 0 check (price_amount >= 0),
  currency text not null default 'KRW',
  billing_cycle text not null default 'month' check (billing_cycle in ('free', 'month', 'year', 'one_time')),
  compare_at_amount integer null check (compare_at_amount is null or compare_at_amount >= 0),
  discount_label text null,
  short_description text,
  bullet_items jsonb not null default '[]'::jsonb,
  footnote text,
  cta_label text,
  cta_action text not null default 'onboarding' check (cta_action in ('onboarding', 'checkout', 'contact', 'disabled')),
  cta_href text null,
  is_recommended boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_billing_products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  product_name text not null,
  product_type text not null check (product_type in ('subscription', 'one_time', 'test')),
  linked_plan_code text null check (linked_plan_code is null or linked_plan_code in ('free', 'pro', 'vip')),
  amount integer not null check (amount >= 0),
  currency text not null default 'KRW',
  billing_cycle text null,
  order_name text,
  description text,
  bullet_items jsonb not null default '[]'::jsonb,
  badge_text text null,
  compare_at_amount integer null check (compare_at_amount is null or compare_at_amount >= 0),
  discount_label text null,
  grants_entitlement boolean not null default false,
  is_test_product boolean not null default false,
  is_visible_public boolean not null default false,
  visible_only_with_query text null,
  visible_only_in_env text null,
  sort_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint platform_billing_products_subscription_plan_required check (
    product_type <> 'subscription' or linked_plan_code in ('pro', 'vip')
  ),
  constraint platform_billing_products_test_no_entitlement check (
    not is_test_product or grants_entitlement = false
  )
);

create table if not exists public.platform_promotions (
  id uuid primary key default gen_random_uuid(),
  promotion_code text not null unique,
  title text not null,
  label text,
  description text,
  applies_to_type text not null check (applies_to_type in ('plan', 'product', 'homepage', 'custom')),
  applies_to_code text,
  display_mode text not null default 'badge' check (display_mode in ('badge', 'compare_at', 'notice', 'banner')),
  discount_type text null check (discount_type is null or discount_type in ('percent', 'fixed', 'display_only')),
  discount_value integer null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  is_active boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  summary text null,
  category text,
  audience text not null default 'all' check (audience in ('all', 'visitors', 'merchants', 'admins', 'specific')),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  is_pinned boolean not null default false,
  is_published boolean not null default false,
  starts_at timestamptz null,
  ends_at timestamptz null,
  link_label text null,
  link_href text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_board_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  category text,
  tags jsonb not null default '[]'::jsonb,
  cover_image_url text null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_pinned boolean not null default false,
  published_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_popups (
  id uuid primary key default gen_random_uuid(),
  popup_key text not null unique,
  title text not null,
  body text,
  image_url text null,
  popup_type text not null default 'modal' check (popup_type in ('modal', 'banner', 'toast', 'bottom_sheet')),
  audience text not null default 'all' check (audience in ('all', 'visitors', 'merchants', 'admins')),
  target_paths jsonb not null default '[]'::jsonb,
  exclude_paths jsonb not null default '[]'::jsonb,
  starts_at timestamptz null,
  ends_at timestamptz null,
  frequency_policy text not null default 'once_per_session' check (frequency_policy in ('once_per_session', 'once_per_day', 'always')),
  dismissible boolean not null default true,
  cta_label text null,
  cta_href text null,
  priority integer not null default 100,
  is_active boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_banners (
  id uuid primary key default gen_random_uuid(),
  banner_key text not null unique,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  target_paths jsonb not null default '[]'::jsonb,
  cta_label text null,
  cta_href text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  is_active boolean not null default false,
  priority integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_path text null,
  file_name text,
  mime_type text,
  size_bytes integer,
  width integer null,
  height integer null,
  alt_text text,
  usage_context text null,
  tags jsonb not null default '[]'::jsonb,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  description text,
  is_enabled boolean not null default false,
  scope text not null default 'global' check (scope in ('global', 'admin', 'public', 'merchant')),
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists platform_homepage_sections_public_idx
  on public.platform_homepage_sections (status, is_visible, sort_order);
create index if not exists platform_pricing_plans_public_idx
  on public.platform_pricing_plans (status, is_visible, sort_order);
create index if not exists platform_billing_products_code_idx
  on public.platform_billing_products (product_code);
create index if not exists platform_announcements_public_idx
  on public.platform_announcements (is_published, is_pinned, starts_at, ends_at);
create index if not exists platform_board_posts_public_idx
  on public.platform_board_posts (status, is_pinned, published_at);
create index if not exists platform_popups_public_idx
  on public.platform_popups (status, is_active, priority);
create index if not exists platform_banners_public_idx
  on public.platform_banners (is_active, priority);
create index if not exists platform_audit_logs_created_idx
  on public.platform_audit_logs (created_at desc);
create index if not exists platform_admin_members_profile_idx
  on public.platform_admin_members (profile_id, status);

alter table public.platform_admin_members enable row level security;
alter table public.platform_site_settings enable row level security;
alter table public.platform_homepage_sections enable row level security;
alter table public.platform_pricing_plans enable row level security;
alter table public.platform_billing_products enable row level security;
alter table public.platform_promotions enable row level security;
alter table public.platform_announcements enable row level security;
alter table public.platform_board_posts enable row level security;
alter table public.platform_popups enable row level security;
alter table public.platform_banners enable row level security;
alter table public.platform_media_assets enable row level security;
alter table public.platform_feature_flags enable row level security;
alter table public.platform_audit_logs enable row level security;

insert into public.platform_site_settings (
  site_name,
  homepage_status,
  seo_title,
  seo_description,
  primary_cta_label,
  primary_cta_href,
  secondary_cta_label,
  secondary_cta_href,
  support_email,
  footer_company_name,
  footer_business_info
)
values (
  'MyBiz',
  'published',
  'MyBiz | 고객 기억 기반 매출 AI SaaS',
  '공개 스토어, 문의, 예약, 웨이팅, QR 주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.',
  '무료로 시작하기',
  '/onboarding?plan=free',
  '가격 보기',
  '/pricing',
  'support@mybiz.ai.kr',
  'MyBiz',
  '고객 기억 기반 매출 AI SaaS'
)
on conflict do nothing;

insert into public.platform_homepage_sections (
  section_key,
  section_type,
  eyebrow,
  title,
  subtitle,
  body,
  cta_label,
  cta_href,
  payload,
  sort_order,
  is_visible,
  status
)
values
  (
    'hero',
    'hero',
    'AI 운영 플랫폼, MyBiz',
    '고객을 기억하는 매장이 더 많이 팝니다',
    '문의·예약·웨이팅·주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.',
    '고객 신호가 고객 기억으로 쌓이고, 점주가 다음 행동을 빠르게 정할 수 있게 돕습니다.',
    '무료로 시작하기',
    '/onboarding?plan=free',
    '{"secondaryCtaLabel":"가격 보기","secondaryCtaHref":"/pricing","chips":["공개 스토어","고객 기억","운영 대시보드"]}'::jsonb,
    10,
    true,
    'published'
  ),
  (
    'customer-memory-flow',
    'customer_memory_flow',
    '고객 기억 흐름',
    '공개 접점부터 운영 액션까지 하나로 연결합니다',
    '문의, 예약, 웨이팅, QR 주문은 모두 고객 기억을 보강하는 입력 채널입니다.',
    '점주는 흩어진 기록 대신 고객별 맥락과 다음 행동을 빠르게 확인합니다.',
    '흐름 보기',
    '#features',
    '{"steps":["공개 스토어","문의","예약","웨이팅","QR 주문","고객 기억","운영 액션"]}'::jsonb,
    20,
    true,
    'published'
  ),
  (
    'features',
    'features',
    '핵심 기능',
    '작은 매장의 반복 매출을 만드는 운영 기능',
    '고객을 기억하고 다시 오게 만드는 기능에 집중합니다.',
    '공개 페이지, 고객 입력 채널, 고객 타임라인, 운영 대시보드가 하나의 시스템으로 움직입니다.',
    '요금제 보기',
    '/pricing',
    '{"cards":["공개 스토어","AI 상담","예약·웨이팅","QR 주문","고객 타임라인","운영 대시보드"]}'::jsonb,
    30,
    true,
    'published'
  ),
  (
    'final-cta',
    'final_cta',
    '시작하기',
    '우리 가게의 고객 기억 구조부터 확인해 보세요',
    '무료로 공개 스토어와 기본 진단을 시작할 수 있습니다.',
    '결제 전에도 고객 접점과 운영 흐름을 정리할 수 있습니다.',
    '무료로 시작하기',
    '/onboarding?plan=free',
    '{}'::jsonb,
    90,
    true,
    'published'
  )
on conflict (section_key) do nothing;

insert into public.platform_pricing_plans (
  plan_code,
  display_name,
  badge_text,
  price_amount,
  currency,
  billing_cycle,
  compare_at_amount,
  discount_label,
  short_description,
  bullet_items,
  footnote,
  cta_label,
  cta_action,
  cta_href,
  is_recommended,
  is_visible,
  sort_order,
  status
)
values
  (
    'free',
    'FREE',
    null,
    0,
    'KRW',
    'free',
    null,
    null,
    '한 매장을 빠르게 시작하는 기본 플랜',
    '["공개 스토어","AI 진단","기본 주문 관리"]'::jsonb,
    'FREE는 결제 없이 온보딩으로 이동합니다.',
    '무료로 시작',
    'onboarding',
    '/onboarding?plan=free',
    false,
    true,
    10,
    'published'
  ),
  (
    'pro',
    'PRO',
    null,
    79000,
    'KRW',
    'month',
    null,
    null,
    '고객 관리와 예약 운영까지 함께 보는 추천 플랜',
    '["고객 관리","예약 관리","AI 운영 리포트"]'::jsonb,
    '결제 완료 후 이용 권한이 안전하게 적용됩니다.',
    'PRO 시작',
    'checkout',
    null,
    true,
    true,
    20,
    'published'
  ),
  (
    'vip',
    'VIP',
    '추천',
    149000,
    'KRW',
    'month',
    null,
    null,
    '운영 자동화와 리포트를 깊게 보는 확장 플랜',
    '["주간 운영 리포트","통합 운영 분석","브랜드 확장 준비"]'::jsonb,
    '결제 완료 후 이용 권한이 안전하게 적용됩니다.',
    'VIP 시작',
    'checkout',
    null,
    false,
    true,
    30,
    'published'
  )
on conflict (plan_code) do nothing;

insert into public.platform_billing_products (
  product_code,
  product_name,
  product_type,
  linked_plan_code,
  amount,
  currency,
  billing_cycle,
  order_name,
  description,
  bullet_items,
  grants_entitlement,
  is_test_product,
  is_visible_public,
  visible_only_with_query,
  sort_order,
  status,
  metadata
)
values (
  'payment_test_100',
  'MyBiz 결제 테스트 100원',
  'test',
  null,
  100,
  'KRW',
  'one_time',
  'MyBiz 결제 테스트 100원',
  '관리자 전용 결제 점검 상품입니다. 일반 공개 가격표에는 노출되지 않습니다.',
  '["100원 단건 결제","구독 권한 변경 없음","PRO/VIP 이용 권한 부여 없음"]'::jsonb,
  false,
  true,
  false,
  'testPayment=1',
  10,
  'published',
  '{"purpose":"payment_test"}'::jsonb
)
on conflict (product_code) do nothing;

insert into public.platform_feature_flags (
  flag_key,
  description,
  is_enabled,
  scope,
  payload
)
values (
  'mybi_companion',
  'MYBI companion visibility. Must remain disabled until explicitly re-enabled.',
  false,
  'public',
  '{}'::jsonb
)
on conflict (flag_key) do nothing;
