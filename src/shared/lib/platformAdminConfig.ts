export const PLATFORM_PLAN_CODES = ['free', 'pro', 'vip'] as const;
export type PlatformPlanCode = (typeof PLATFORM_PLAN_CODES)[number];

export const PAYMENT_TEST_PRODUCT_CODE = 'payment_test_100' as const;

export type PlatformStatus = 'archived' | 'draft' | 'published';
export type PlatformSeverity = 'critical' | 'info' | 'success' | 'warning';
export type PlatformAudience = 'admins' | 'all' | 'merchants' | 'specific' | 'visitors';
export type PlatformBillingProductType = 'one_time' | 'subscription' | 'test';
export type PlatformCtaAction = 'checkout' | 'contact' | 'disabled' | 'onboarding';

export interface PlatformSiteSettings {
  footer_business_info?: string | null;
  footer_company_name?: string | null;
  footer_links?: Array<{ href: string; label: string }>;
  homepage_status: 'draft' | 'maintenance' | 'published';
  og_image_url?: string | null;
  primary_cta_href?: string | null;
  primary_cta_label?: string | null;
  secondary_cta_href?: string | null;
  secondary_cta_label?: string | null;
  seo_description?: string | null;
  seo_title?: string | null;
  site_name: string;
  support_email?: string | null;
  support_phone?: string | null;
}

export interface PlatformHomepageSection {
  body?: string | null;
  cta_href?: string | null;
  cta_label?: string | null;
  ends_at?: string | null;
  eyebrow?: string | null;
  id?: string;
  is_visible: boolean;
  media_url?: string | null;
  payload: Record<string, unknown>;
  section_key: string;
  section_type:
    | 'custom_json'
    | 'customer_memory_flow'
    | 'faq'
    | 'features'
    | 'final_cta'
    | 'hero'
    | 'pricing_teaser'
    | 'problem'
    | 'solution'
    | 'testimonials'
    | 'value_cards';
  sort_order: number;
  starts_at?: string | null;
  status: PlatformStatus;
  subtitle?: string | null;
  title?: string | null;
}

export interface PlatformPricingPlan {
  badge_text?: string | null;
  billing_cycle: 'free' | 'month' | 'one_time' | 'year';
  bullet_items: string[];
  compare_at_amount?: number | null;
  cta_action: PlatformCtaAction;
  cta_href?: string | null;
  cta_label?: string | null;
  currency: 'KRW';
  discount_label?: string | null;
  display_name: string;
  footnote?: string | null;
  id?: string;
  is_recommended: boolean;
  is_visible: boolean;
  plan_code: PlatformPlanCode;
  price_amount: number;
  short_description?: string | null;
  sort_order: number;
  status: PlatformStatus;
}

export interface PlatformBillingProduct {
  amount: number;
  badge_text?: string | null;
  billing_cycle?: string | null;
  bullet_items: string[];
  compare_at_amount?: number | null;
  currency: 'KRW';
  description?: string | null;
  discount_label?: string | null;
  grants_entitlement: boolean;
  id?: string;
  is_test_product: boolean;
  is_visible_public: boolean;
  linked_plan_code?: PlatformPlanCode | null;
  metadata: Record<string, unknown>;
  order_name?: string | null;
  product_code: string;
  product_name: string;
  product_type: PlatformBillingProductType;
  sort_order: number;
  status: PlatformStatus;
  visible_only_in_env?: string | null;
  visible_only_with_query?: string | null;
}

export interface PlatformPromotion {
  applies_to_code?: string | null;
  applies_to_type: 'custom' | 'homepage' | 'plan' | 'product';
  description?: string | null;
  discount_type?: 'display_only' | 'fixed' | 'percent' | null;
  discount_value?: number | null;
  display_mode: 'badge' | 'banner' | 'compare_at' | 'notice';
  ends_at?: string | null;
  id?: string;
  is_active: boolean;
  label?: string | null;
  payload: Record<string, unknown>;
  promotion_code: string;
  starts_at?: string | null;
  title: string;
}

export interface PlatformAnnouncement {
  audience: PlatformAudience;
  body: string;
  category?: string | null;
  ends_at?: string | null;
  id?: string;
  is_pinned: boolean;
  is_published: boolean;
  link_href?: string | null;
  link_label?: string | null;
  severity: PlatformSeverity;
  starts_at?: string | null;
  summary?: string | null;
  title: string;
}

export interface PlatformBoardPost {
  body: string;
  category?: string | null;
  cover_image_url?: string | null;
  excerpt?: string | null;
  id?: string;
  is_pinned: boolean;
  published_at?: string | null;
  slug: string;
  status: PlatformStatus;
  tags: string[];
  title: string;
}

export interface PlatformPopup {
  audience: Exclude<PlatformAudience, 'specific'>;
  body?: string | null;
  cta_href?: string | null;
  cta_label?: string | null;
  dismissible: boolean;
  ends_at?: string | null;
  exclude_paths: string[];
  frequency_policy: 'always' | 'once_per_day' | 'once_per_session';
  id?: string;
  image_url?: string | null;
  is_active: boolean;
  popup_key: string;
  popup_type: 'banner' | 'bottom_sheet' | 'modal' | 'toast';
  priority: number;
  starts_at?: string | null;
  status: PlatformStatus;
  target_paths: string[];
  title: string;
}

export interface PlatformBanner {
  banner_key: string;
  cta_href?: string | null;
  cta_label?: string | null;
  ends_at?: string | null;
  id?: string;
  is_active: boolean;
  message: string;
  priority: number;
  severity: PlatformSeverity;
  starts_at?: string | null;
  target_paths: string[];
}

export interface PlatformMediaAsset {
  alt_text?: string | null;
  file_name?: string | null;
  height?: number | null;
  id?: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
  tags: string[];
  url: string;
  usage_context?: string | null;
  width?: number | null;
}

export interface PlatformFeatureFlag {
  description?: string | null;
  flag_key: string;
  id?: string;
  is_enabled: boolean;
  payload: Record<string, unknown>;
  scope: 'admin' | 'global' | 'merchant' | 'public';
}

export interface PlatformAuditLog {
  action: string;
  actor_profile_id?: string | null;
  after_value?: Record<string, unknown> | null;
  before_value?: Record<string, unknown> | null;
  created_at: string;
  entity_id?: string | null;
  entity_type: string;
  id?: string;
}

export interface PlatformPaymentEvent {
  amount?: number | null;
  created_at?: string | null;
  currency?: string | null;
  id?: string;
  order_id?: string | null;
  product_code?: string | null;
  provider?: string | null;
  provider_payment_id?: string | null;
  purpose?: string | null;
  raw?: Record<string, unknown> | null;
  status?: string | null;
  updated_at?: string | null;
}

export interface PublicPlatformHomepagePayload {
  settings: PlatformSiteSettings;
  sections: PlatformHomepageSection[];
}

export interface PublicPlatformPricingPayload {
  plans: PlatformPricingPlan[];
  testProducts: PlatformBillingProduct[];
}

export interface PublicPlatformChromePayload {
  banners: PlatformBanner[];
  popups: PlatformPopup[];
}

export interface PlatformAdminOverview {
  activeAnnouncements: number;
  activePopups: number;
  failedPaymentEvents: number;
  lastUpdatedContent: string | null;
  publishedHomepageSections: number;
  recentAuditLogs: PlatformAuditLog[];
  recentPaymentEvents: number;
  visiblePricingPlans: number;
}

export const FALLBACK_SITE_SETTINGS: PlatformSiteSettings = {
  footer_business_info: '고객 기억 기반 매출 AI SaaS',
  footer_company_name: 'MyBiz',
  footer_links: [
    { href: '/terms', label: '이용약관' },
    { href: '/privacy', label: '개인정보처리방침' },
    { href: '/refund', label: '환불정책' },
  ],
  homepage_status: 'published',
  primary_cta_href: '/onboarding',
  primary_cta_label: '공개 스토어 시작하기',
  secondary_cta_href: '/?demo=1',
  secondary_cta_label: '데모 보기',
  seo_description: '공개 스토어, 문의, 예약, 웨이팅, QR 주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.',
  seo_title: 'MyBiz | 고객 기억 기반 매출 AI SaaS',
  site_name: 'MyBiz',
  support_email: 'support@mybiz.ai.kr',
};

export const FALLBACK_HOMEPAGE_SECTIONS: PlatformHomepageSection[] = [
  {
    body: '공개 스토어에서 시작한 고객 신호가 상담, 예약, 웨이팅, 주문, 고객 기억으로 이어집니다.',
    cta_href: '/onboarding',
    cta_label: '공개 스토어 시작하기',
    eyebrow: 'AI 운영 플랫폼, MyBiz',
    is_visible: true,
    payload: {
      chips: ['공개 스토어', '고객 기억', '운영 대시보드'],
      secondaryCtaHref: '/?demo=1',
      secondaryCtaLabel: '데모 보기',
    },
    section_key: 'hero',
    section_type: 'hero',
    sort_order: 10,
    status: 'published',
    subtitle: '문의·예약·웨이팅·주문을 고객 기억 축으로 연결해 재방문과 객단가를 높입니다.',
    title: '고객을 기억할수록 매출이 쌓이는 시스템',
  },
  {
    body: '문의, 예약, 웨이팅, QR 주문은 모두 고객 기억을 보강하는 입력 채널입니다.',
    cta_href: '#features',
    cta_label: '흐름 보기',
    eyebrow: '고객 기억 흐름',
    is_visible: true,
    payload: {
      steps: ['공개 스토어', '문의', '예약', '웨이팅', 'QR 주문', '고객 기억', '운영 액션'],
    },
    section_key: 'customer-memory-flow',
    section_type: 'customer_memory_flow',
    sort_order: 20,
    status: 'published',
    subtitle: '흩어진 입력을 고객별 맥락과 다음 행동으로 바꿉니다.',
    title: '공개 접점부터 운영 액션까지 하나로 연결합니다',
  },
  {
    body: '공개 페이지, 고객 입력 채널, 고객 타임라인, 운영 대시보드가 하나의 시스템으로 움직입니다.',
    cta_href: '/pricing',
    cta_label: '요금제 보기',
    eyebrow: '핵심 기능',
    is_visible: true,
    payload: {
      cards: ['공개 스토어', 'AI 상담', '예약·웨이팅', 'QR 주문', '고객 타임라인', '운영 대시보드'],
    },
    section_key: 'features',
    section_type: 'features',
    sort_order: 30,
    status: 'published',
    subtitle: '고객을 기억하고 다시 오게 만드는 기능에 집중합니다.',
    title: '작은 매장의 반복 매출을 만드는 운영 기능',
  },
  {
    body: '무료로 공개 스토어와 기본 진단을 시작할 수 있습니다.',
    cta_href: '/onboarding?plan=free',
    cta_label: '무료로 시작하기',
    eyebrow: '시작하기',
    is_visible: true,
    payload: {},
    section_key: 'final-cta',
    section_type: 'final_cta',
    sort_order: 90,
    status: 'published',
    subtitle: '결제 전에 고객 접점과 운영 흐름을 정리할 수 있습니다.',
    title: '우리 가게의 고객 기억 구조부터 확인해 보세요',
  },
];

export const FALLBACK_PRICING_PLANS: PlatformPricingPlan[] = [
  {
    billing_cycle: 'free',
    bullet_items: ['공개 스토어', 'AI 진단', '기본 주문 관리'],
    cta_action: 'onboarding',
    cta_href: '/onboarding?plan=free',
    cta_label: '무료로 시작',
    currency: 'KRW',
    display_name: 'FREE',
    footnote: 'FREE는 결제 없이 온보딩으로 이동합니다.',
    is_recommended: false,
    is_visible: true,
    plan_code: 'free',
    price_amount: 0,
    short_description: '한 매장을 빠르게 시작하는 기본 플랜',
    sort_order: 10,
    status: 'published',
  },
  {
    billing_cycle: 'month',
    bullet_items: ['고객 관리', '예약 관리', 'AI 운영 리포트'],
    cta_action: 'checkout',
    cta_label: 'PRO 시작',
    currency: 'KRW',
    display_name: 'PRO',
    footnote: '결제 완료 후 store_subscriptions 반영으로 권한이 확정됩니다.',
    is_recommended: true,
    is_visible: true,
    plan_code: 'pro',
    price_amount: 79000,
    short_description: '고객 관리와 예약 운영까지 함께 보는 추천 플랜',
    sort_order: 20,
    status: 'published',
  },
  {
    badge_text: '추천',
    billing_cycle: 'month',
    bullet_items: ['주간 운영 리포트', '통합 운영 분석', '브랜드 확장 준비'],
    cta_action: 'checkout',
    cta_label: 'VIP 시작',
    currency: 'KRW',
    display_name: 'VIP',
    footnote: '결제 완료 후 store_subscriptions 반영으로 권한이 확정됩니다.',
    is_recommended: false,
    is_visible: true,
    plan_code: 'vip',
    price_amount: 149000,
    short_description: '운영 자동화와 리포트를 깊게 보는 확장 플랜',
    sort_order: 30,
    status: 'published',
  },
];

export const PAYMENT_TEST_100_PRODUCT: PlatformBillingProduct = {
  amount: 100,
  billing_cycle: 'one_time',
  bullet_items: ['100원 단건 결제', '구독 권한 변경 없음', 'PRO/VIP entitlement 부여 없음'],
  currency: 'KRW',
  description: 'PortOne checkout, redirect, verify, webhook, payment event 흐름을 확인하는 내부 테스트 상품입니다.',
  grants_entitlement: false,
  is_test_product: true,
  is_visible_public: false,
  linked_plan_code: null,
  metadata: { purpose: 'payment_test' },
  order_name: 'MyBiz 결제 테스트 100원',
  product_code: PAYMENT_TEST_PRODUCT_CODE,
  product_name: 'MyBiz 결제 테스트 100원',
  product_type: 'test',
  sort_order: 10,
  status: 'published',
  visible_only_with_query: 'testPayment=1',
};

export const FALLBACK_BILLING_PRODUCTS: PlatformBillingProduct[] = [PAYMENT_TEST_100_PRODUCT];

export function isPlatformPlanCode(value: unknown): value is PlatformPlanCode {
  return typeof value === 'string' && PLATFORM_PLAN_CODES.includes(value as PlatformPlanCode);
}

export function normalizeJsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export function isBrokenPlatformText(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return /\?{2,}/.test(normalized) || ['怨좉', '寃곗', '臾몄', '留ㅼ', '댁'].some((token) => normalized.includes(token));
}

export function assertSafePlatformText(value: unknown, fieldName: string) {
  if (isBrokenPlatformText(value)) {
    throw new Error(`${fieldName}에 깨진 문자열이 포함되어 있습니다.`);
  }
}

export function isInSchedule(item: { ends_at?: string | null; starts_at?: string | null }, at = new Date()) {
  const startsAt = item.starts_at ? new Date(item.starts_at) : null;
  const endsAt = item.ends_at ? new Date(item.ends_at) : null;

  if (startsAt && startsAt > at) return false;
  if (endsAt && endsAt < at) return false;
  return true;
}

export function pathMatchesTarget(item: { exclude_paths?: string[]; target_paths?: string[] }, pathname: string) {
  const targetPaths = item.target_paths || [];
  const excludePaths = item.exclude_paths || [];
  const matches = (pattern: string) => {
    if (!pattern || pattern === '*') return true;
    if (pattern.endsWith('*')) return pathname.startsWith(pattern.slice(0, -1));
    return pathname === pattern;
  };

  if (excludePaths.some(matches)) return false;
  if (targetPaths.length === 0) return true;
  return targetPaths.some(matches);
}

export function filterPublicHomepageSections(sections: PlatformHomepageSection[], at = new Date()) {
  return sections
    .filter((section) => section.status === 'published' && section.is_visible && isInSchedule(section, at))
    .sort((left, right) => left.sort_order - right.sort_order);
}

export function filterPublicPricingPlans(plans: PlatformPricingPlan[]) {
  const byCode = new Map(plans.map((plan) => [plan.plan_code, plan]));
  return PLATFORM_PLAN_CODES
    .map((code) => byCode.get(code) || FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === code)!)
    .filter((plan) => plan.status === 'published' && plan.is_visible)
    .sort((left, right) => left.sort_order - right.sort_order);
}

export function shouldExposeBillingProduct(input: {
  adminPreview?: boolean;
  envEnabled?: boolean;
  product: PlatformBillingProduct;
  searchParams?: URLSearchParams;
}) {
  const { adminPreview, envEnabled, product, searchParams } = input;
  if (product.status !== 'published') return false;
  if (adminPreview || envEnabled) return true;
  if (product.is_visible_public) return true;

  const requiredQuery = product.visible_only_with_query?.trim();
  if (!requiredQuery || !searchParams) return false;

  const [key, expectedValue] = requiredQuery.split('=');
  if (!key) return false;

  const actualValue = searchParams.get(key);
  return expectedValue === undefined ? actualValue !== null : actualValue === expectedValue;
}

export function filterPublicBillingProducts(input: {
  adminPreview?: boolean;
  envEnabled?: boolean;
  products: PlatformBillingProduct[];
  searchParams?: URLSearchParams;
}) {
  return input.products
    .filter((product) => shouldExposeBillingProduct({ ...input, product }))
    .sort((left, right) => left.sort_order - right.sort_order);
}

export function formatKrw(amount: number) {
  return amount === 0 ? '월 0원' : `월 ${amount.toLocaleString('ko-KR')}원`;
}

export function formatProductKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`;
}
