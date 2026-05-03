-- MyBiz public-site operating system expansion.
-- Purpose: CMS-managed public pages, FAQ, trust signals, content QA, snapshots, and version history.
-- Safety: non-destructive. Creates missing tables and seeds safe defaults only when absent.

create table if not exists public.platform_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  body text,
  cta_label text,
  cta_href text,
  hero_media_url text,
  seo_title text,
  seo_description text,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_published boolean not null default false,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_page_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null,
  section_key text not null,
  section_type text not null default 'content',
  title text,
  subtitle text,
  body text,
  cta_label text,
  cta_href text,
  media_url text,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_visible boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  starts_at timestamptz null,
  ends_at timestamptz null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(page_slug, section_key)
);

create table if not exists public.platform_faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null unique,
  answer text not null,
  category text,
  sort_order integer not null default 100,
  is_published boolean not null default false,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_trust_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  title text not null,
  body text not null,
  icon_key text,
  sort_order integer not null default 100,
  is_visible boolean not null default true,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_footer_settings (
  id uuid primary key default gen_random_uuid(),
  footer_company_name text not null default 'MyBiz',
  footer_business_info text,
  support_email text,
  support_phone text,
  footer_links jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_content_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  version_label text,
  change_summary text,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_site_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  status text not null default 'published' check (status in ('published','archived','rollback_candidate')),
  payload jsonb not null default '{}'::jsonb,
  quality_score integer not null default 100,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_content_quality_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  keyword text not null,
  severity text not null default 'critical' check (severity in ('critical','warning')),
  suggestion text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_effect_presets (
  id uuid primary key default gen_random_uuid(),
  preset_key text not null unique,
  title text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists platform_pages_slug_idx on public.platform_pages (slug, is_published);
create index if not exists platform_page_sections_page_idx on public.platform_page_sections (page_slug, status, sort_order);
create index if not exists platform_faq_items_public_idx on public.platform_faq_items (is_published, sort_order);
create index if not exists platform_trust_signals_public_idx on public.platform_trust_signals (is_visible, sort_order);
create index if not exists platform_content_versions_entity_idx on public.platform_content_versions (entity_type, entity_id, created_at desc);
create index if not exists platform_site_snapshots_status_idx on public.platform_site_snapshots (status, created_at desc);

alter table public.platform_pages enable row level security;
alter table public.platform_page_sections enable row level security;
alter table public.platform_faq_items enable row level security;
alter table public.platform_trust_signals enable row level security;
alter table public.platform_footer_settings enable row level security;
alter table public.platform_content_versions enable row level security;
alter table public.platform_site_snapshots enable row level security;
alter table public.platform_content_quality_rules enable row level security;
alter table public.platform_effect_presets enable row level security;

insert into public.platform_pages (slug, title, description, body, cta_label, cta_href, seo_title, seo_description, payload, sort_order, is_published)
values
  ('features', '고객 기억으로 이어지는 매장 운영 기능', '흩어진 고객 행동을 기억하고, 점주가 다음 액션을 빠르게 정할 수 있게 만드는 운영 플랫폼입니다.', 'MyBiz는 공개 스토어, 문의, 예약, 웨이팅, QR 주문을 하나의 고객 기억 흐름으로 연결해 작은 매장의 재방문과 객단가 성장을 돕습니다.', '공개 스토어 시작하기', '/onboarding', 'MyBiz 기능 | 고객 기억 기반 매출 AI SaaS', 'MyBiz 기능 소개: 고객 기억, 공개 스토어, 예약, 웨이팅, QR 주문, 운영 대시보드', '{"cards":["공개 스토어로 고객 접점을 엽니다","문의·예약·웨이팅·주문을 고객별로 연결합니다","운영 대시보드에서 다음 액션을 확인합니다"]}'::jsonb, 10, true),
  ('faq', '자주 묻는 질문', '처음 도입하는 사장님도 빠르게 판단할 수 있도록 핵심 질문만 모았습니다.', '요금제, 공개 스토어, 고객 기억, 결제와 운영 방식에 대해 자주 묻는 질문을 정리했습니다.', '도입 문의하기', '/contact', 'MyBiz FAQ', 'MyBiz FAQ와 도입 안내', '{}'::jsonb, 20, true),
  ('about', '작은 매장의 고객 기억을 매출로 연결합니다', '홈페이지 도구가 아니라 고객 기억 기반 매출 시스템을 만듭니다.', 'MyBiz는 작은 매장의 고객 신호가 사라지지 않도록 기록하고, 다시 방문하게 만드는 운영 액션으로 연결합니다.', '요금제 보기', '/pricing', 'MyBiz 소개', 'MyBiz 소개와 제품 방향', '{}'::jsonb, 30, true),
  ('contact', '도입과 운영을 함께 확인해 드립니다', '실제 매장 운영 흐름에 맞춰 도입을 도와드립니다.', '도입, 요금제, 매장 공개 페이지, 결제 관련 문의는 MyBiz 지원팀으로 연락해 주세요.', 'support@mybiz.ai.kr', 'mailto:support@mybiz.ai.kr', 'MyBiz 문의', 'MyBiz 문의와 지원 안내', '{}'::jsonb, 40, true),
  ('trust', '고객 기억을 안전하게 운영하기 위한 기준', '고객이 안심하고 남긴 신호를 점주가 책임 있게 활용할 수 있도록 돕습니다.', 'MyBiz는 매장 운영 데이터를 고객 기억으로 정리하고, 공개페이지와 점주 대시보드를 분리해 운영합니다. 결제와 구독 상태는 안전한 서버 기준으로 처리되며, 도입과 운영 문의는 지원 채널에서 확인할 수 있습니다.', '개인정보처리방침 보기', '/privacy', 'MyBiz 신뢰와 보안', 'MyBiz 신뢰, 보안, 결제 안전 안내', '{}'::jsonb, 50, true)
on conflict (slug) do nothing;

insert into public.platform_faq_items (question, answer, category, sort_order, is_published)
values
  ('FREE는 어떤 플랜인가요?', 'FREE는 결제 없이 공개 스토어와 기본 고객 입력 흐름을 시작하는 플랜입니다.', '요금제', 10, true),
  ('고객 기억은 매출에 어떻게 도움이 되나요?', '문의, 예약, 웨이팅, 주문이 한 고객의 맥락으로 쌓여 재방문 액션을 더 빠르게 정할 수 있습니다.', '제품', 20, true),
  ('유료 플랜은 어떻게 적용되나요?', 'PRO와 VIP는 결제 완료 후 서버에서 확인된 가격과 권한 기준으로 적용됩니다.', '결제', 30, true)
on conflict do nothing;

insert into public.platform_trust_signals (signal_key, title, body, icon_key, sort_order, is_visible)
values
  ('server-owned-catalog', '안전한 가격 확인', '가격과 상품 정보는 고객 화면의 표시값이 아니라 안전한 기준 금액으로 확인됩니다.', 'payment', 10, true),
  ('public-content-guard', '공개 콘텐츠 품질 관리', '공개 페이지에는 게시 승인된 콘텐츠만 노출하고, 고객에게 부적절한 운영 문구는 품질 검사로 차단합니다.', 'content', 20, true),
  ('access-separation', '운영 권한 분리', '점주 운영 화면과 플랫폼 관리자 콘솔을 분리해 매장 운영 권한과 서비스 운영 권한을 구분합니다.', 'access', 30, true)
on conflict (signal_key) do nothing;

insert into public.platform_content_quality_rules (rule_key, keyword, severity, suggestion)
values
  ('block_webhook_copy', 'webhook', 'critical', '고객에게는 결제 안정성 또는 지원 안내로 표현하세요.'),
  ('block_api_copy', 'api', 'critical', '공개 페이지에서는 내부 API 설명을 노출하지 마세요.'),
  ('block_store_subscriptions_copy', 'store_subscriptions', 'critical', '권한 적용 또는 이용 상태처럼 고객 친화적으로 표현하세요.'),
  ('block_dummy_copy', 'dummy', 'critical', '실제 고객용 문구로 교체하세요.'),
  ('warn_preview_copy', 'preview', 'warning', '공개 페이지에서는 미리보기 대신 체험/데모처럼 표현하세요.')
on conflict (rule_key) do nothing;

insert into public.platform_effect_presets (preset_key, title, description, payload, is_active)
values
  ('memory-orbit', '고객 기억 오비트', '고객 입력 채널이 기억 코어로 연결되는 가벼운 3D-like 배경 효과입니다.', '{"reducedMotionFallback":true,"mobileParticleCount":0}'::jsonb, true)
on conflict (preset_key) do nothing;
