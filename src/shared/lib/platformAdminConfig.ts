export const PLATFORM_PLAN_CODES = ['free', 'pro', 'vip'] as const;
export type PlatformPlanCode = (typeof PLATFORM_PLAN_CODES)[number];

export const PAYMENT_TEST_PRODUCT_CODE = 'payment_test_100' as const;

export type PlatformStatus = 'archived' | 'draft' | 'published';
export type PlatformSeverity = 'critical' | 'info' | 'success' | 'warning';
export type PlatformAudience = 'admins' | 'all' | 'merchants' | 'specific' | 'visitors';
export type PlatformBillingProductType = 'one_time' | 'subscription' | 'test';
export type PlatformCtaAction = 'checkout' | 'contact' | 'disabled' | 'onboarding';
export type PlatformContentIssueSeverity = 'critical' | 'warning';

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

export interface PublicPlatformBillingProduct {
  amount: number;
  bullet_items: string[];
  currency: 'KRW';
  description?: string | null;
  order_name?: string | null;
  product_code: string;
  product_name: string;
  product_type: PlatformBillingProductType;
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

export interface PlatformPublicPage {
  body?: string | null;
  cta_href?: string | null;
  cta_label?: string | null;
  description?: string | null;
  hero_media_url?: string | null;
  is_published: boolean;
  payload: Record<string, unknown>;
  seo_description?: string | null;
  seo_title?: string | null;
  slug: string;
  sort_order: number;
  title: string;
}

export interface PlatformFaqItem {
  answer: string;
  category?: string | null;
  is_published: boolean;
  question: string;
  sort_order: number;
}

export interface PlatformTrustSignal {
  body: string;
  icon_key?: string | null;
  is_visible: boolean;
  signal_key: string;
  sort_order: number;
  title: string;
}

export interface PlatformContentQualityIssue {
  entityId: string;
  entityType: string;
  field: string;
  keyword?: string;
  message: string;
  severity: PlatformContentIssueSeverity;
}

export interface PlatformContentQualityInput {
  entityId: string;
  entityType: string;
  fields: Record<string, unknown>;
  publicExposure?: boolean;
}

export interface PlatformContentQualityResult {
  criticalCount: number;
  issues: PlatformContentQualityIssue[];
  score: number;
  scannedCount: number;
  warningCount: number;
}

export interface PublicPlatformHomepagePayload {
  settings: PlatformSiteSettings;
  sections: PlatformHomepageSection[];
}

export interface PublicPlatformPricingPayload {
  plans: PlatformPricingPlan[];
  testProducts: PublicPlatformBillingProduct[];
}

export interface PublicPlatformChromePayload {
  banners: PlatformBanner[];
  popups: PlatformPopup[];
}

export interface PublicPlatformPagePayload {
  faqItems: PlatformFaqItem[];
  page: PlatformPublicPage;
  trustSignals: PlatformTrustSignal[];
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
  footer_business_info: '고객 기억 기반 매출 AI SaaS · 공개 스토어, 문의, 예약, 웨이팅, 주문을 하나의 고객 기억으로 연결합니다.',
  footer_company_name: 'MyBiz',
  footer_links: [
    { href: '/features', label: '기능' },
    { href: '/faq', label: 'FAQ' },
    { href: '/trust', label: '신뢰와 보안' },
    { href: '/contact', label: '문의' },
    { href: '/terms', label: '이용약관' },
    { href: '/privacy', label: '개인정보처리방침' },
    { href: '/refund', label: '환불정책' },
  ],
  homepage_status: 'published',
  primary_cta_href: '/onboarding?plan=free',
  primary_cta_label: '무료로 시작하기',
  secondary_cta_href: '/pricing',
  secondary_cta_label: '가격 보기',
  seo_description: '공개 스토어, 문의, 예약, 웨이팅, QR 주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.',
  seo_title: 'MyBiz | 고객 기억 기반 매출 AI SaaS',
  site_name: 'MyBiz',
  support_email: 'support@mybiz.ai.kr',
};

export const FALLBACK_HOMEPAGE_SECTIONS: PlatformHomepageSection[] = [
  {
    body: '고객 신호가 고객 기억으로 쌓이고, 점주가 다음 행동을 빠르게 정할 수 있게 돕습니다.',
    cta_href: '/onboarding?plan=free',
    cta_label: '무료로 시작하기',
    eyebrow: 'AI 운영 플랫폼, MyBiz',
    is_visible: true,
    payload: {
      chips: ['공개 스토어', '고객 기억', '운영 대시보드'],
      secondaryCtaHref: '/pricing',
      secondaryCtaLabel: '가격 보기',
    },
    section_key: 'hero',
    section_type: 'hero',
    sort_order: 10,
    status: 'published',
    subtitle: '문의·예약·웨이팅·주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.',
    title: '고객을 기억하는 매장이 더 많이 팝니다',
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
    footnote: '무료로 공개 스토어와 고객 입력 흐름을 먼저 정리할 수 있습니다.',
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
    footnote: '결제 완료 후 이용 권한이 안전하게 적용됩니다.',
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
    footnote: '결제 완료 후 이용 권한이 안전하게 적용됩니다.',
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
  bullet_items: ['100원 단건 결제', '구독 권한 변경 없음', 'PRO/VIP 이용 권한 부여 없음'],
  currency: 'KRW',
  description: '관리자 전용 결제 점검 상품입니다. 일반 공개 가격표에는 노출되지 않습니다.',
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

export function toPublicBillingProduct(product: PlatformBillingProduct): PublicPlatformBillingProduct {
  return {
    amount: product.amount,
    bullet_items: sanitizePublicTextArray(product.bullet_items, []),
    currency: product.currency,
    description: sanitizePublicPlatformText(product.description, null),
    order_name: sanitizePublicPlatformText(product.order_name, product.product_name),
    product_code: product.product_code,
    product_name: sanitizePublicPlatformText(product.product_name, '결제 상품') || '결제 상품',
    product_type: product.product_type,
  };
}

export const FALLBACK_PUBLIC_PAGES: PlatformPublicPage[] = [
  {
    body: 'MyBiz는 공개 스토어, 문의, 예약, 웨이팅, QR 주문을 하나의 고객 기억 흐름으로 연결해 작은 매장의 재방문과 객단가 성장을 돕습니다.',
    cta_href: '/onboarding',
    cta_label: '공개 스토어 시작하기',
    description: '흩어진 고객 행동을 기억하고, 점주가 다음 액션을 빠르게 정할 수 있게 만드는 운영 플랫폼입니다.',
    is_published: true,
    payload: {
      cards: [
        '공개 스토어로 고객 접점을 엽니다',
        '문의·예약·웨이팅·주문을 고객별로 연결합니다',
        '운영 대시보드에서 다음 액션을 확인합니다',
      ],
    },
    seo_description: 'MyBiz 기능 소개: 고객 기억, 공개 스토어, 예약, 웨이팅, QR 주문, 운영 대시보드',
    seo_title: 'MyBiz 기능 | 고객 기억 기반 매출 AI SaaS',
    slug: 'features',
    sort_order: 10,
    title: '고객 기억으로 이어지는 매장 운영 기능',
  },
  {
    body: '요금제, 공개 스토어, 고객 기억, 결제와 운영 방식에 대해 자주 묻는 질문을 정리했습니다.',
    cta_href: '/contact',
    cta_label: '도입 문의하기',
    description: '처음 도입하는 사장님도 빠르게 판단할 수 있도록 핵심 질문만 모았습니다.',
    is_published: true,
    payload: {},
    seo_description: 'MyBiz FAQ와 도입 안내',
    seo_title: 'MyBiz FAQ',
    slug: 'faq',
    sort_order: 20,
    title: '자주 묻는 질문',
  },
  {
    body: 'MyBiz는 작은 매장의 고객 신호가 사라지지 않도록 기록하고, 다시 방문하게 만드는 운영 액션으로 연결합니다.',
    cta_href: '/pricing',
    cta_label: '요금제 보기',
    description: '홈페이지 도구가 아니라 고객 기억 기반 매출 시스템을 만듭니다.',
    is_published: true,
    payload: {},
    seo_description: 'MyBiz 소개와 제품 방향',
    seo_title: 'MyBiz 소개',
    slug: 'about',
    sort_order: 30,
    title: '작은 매장의 고객 기억을 매출로 연결합니다',
  },
  {
    body: '도입, 요금제, 매장 공개 페이지, 결제 관련 문의는 MyBiz 지원팀으로 연락해 주세요.',
    cta_href: 'mailto:support@mybiz.ai.kr',
    cta_label: 'support@mybiz.ai.kr',
    description: '실제 매장 운영 흐름에 맞춰 도입을 도와드립니다.',
    is_published: true,
    payload: {},
    seo_description: 'MyBiz 문의와 지원 안내',
    seo_title: 'MyBiz 문의',
    slug: 'contact',
    sort_order: 40,
    title: '도입과 운영을 함께 확인해 드립니다',
  },
  {
    body: 'MyBiz는 매장 운영 데이터를 고객 기억으로 정리하고, 공개페이지와 점주 대시보드를 분리해 운영합니다. 결제와 구독 상태는 안전한 서버 기준으로 처리되며, 도입과 운영 문의는 지원 채널에서 확인할 수 있습니다.',
    cta_href: '/privacy',
    cta_label: '개인정보처리방침 보기',
    description: '고객이 안심하고 남긴 신호를 점주가 책임 있게 활용할 수 있도록 돕습니다.',
    is_published: true,
    payload: {},
    seo_description: 'MyBiz 신뢰, 보안, 결제 안전 안내',
    seo_title: 'MyBiz 신뢰와 보안',
    slug: 'trust',
    sort_order: 50,
    title: '고객 기억을 안전하게 운영하기 위한 기준',
  },
];

export const FALLBACK_FAQ_ITEMS: PlatformFaqItem[] = [
  {
    answer: 'FREE는 결제 없이 공개 스토어와 기본 고객 입력 흐름을 시작하는 플랜입니다.',
    category: '요금제',
    is_published: true,
    question: 'FREE는 어떤 플랜인가요?',
    sort_order: 10,
  },
  {
    answer: '문의, 예약, 웨이팅, 주문이 고객별 맥락으로 쌓이면 재방문 안내와 운영 판단을 더 빠르게 할 수 있습니다.',
    category: '제품',
    is_published: true,
    question: '고객 기억은 매출에 어떻게 도움이 되나요?',
    sort_order: 20,
  },
  {
    answer: 'PRO와 VIP는 결제 완료 후 서버에서 확인된 가격과 권한 기준으로 적용됩니다.',
    category: '결제',
    is_published: true,
    question: '유료 플랜은 어떻게 적용되나요?',
    sort_order: 30,
  },
];

export const FALLBACK_TRUST_SIGNALS: PlatformTrustSignal[] = [
  {
    body: '가격과 상품 정보는 고객 화면의 표시값이 아니라 안전한 기준 금액으로 확인됩니다.',
    icon_key: 'payment',
    is_visible: true,
    signal_key: 'server-owned-catalog',
    sort_order: 10,
    title: '안전한 가격 확인',
  },
  {
    body: '공개 페이지에는 게시 승인된 콘텐츠만 노출하고, 고객에게 부적절한 운영 문구는 품질 검사로 차단합니다.',
    icon_key: 'content',
    is_visible: true,
    signal_key: 'public-content-guard',
    sort_order: 20,
    title: '공개 콘텐츠 품질 관리',
  },
  {
    body: '점주 운영 화면과 플랫폼 관리자 콘솔을 분리해 매장 운영 권한과 서비스 운영 권한을 구분합니다.',
    icon_key: 'access',
    is_visible: true,
    signal_key: 'access-separation',
    sort_order: 30,
    title: '운영 권한 분리',
  },
];

const PUBLIC_INTERNAL_KEYWORD_RULES = [
  'api',
  'webhook',
  'preview',
  'production',
  'test only',
  'dummy',
  'internal',
  'developer',
  'env',
  'todo',
  'fixme',
  'temp',
  'staging',
  'store_subscriptions',
  'payment_events',
  'PortOne checkout',
  'server catalog',
  'raw payload',
  'localhost',
  '127.0.0.1',
  'Vite',
  'Supabase table',
  'admin-only',
  'grants_entitlement',
  'entitlement',
  'redirect',
  'verify',
  '테스트 전용',
  '개발자',
  '더미',
  '웹훅',
  '서버 카탈로그',
  '성공처럼',
  '환경이 준비',
  '실결제',
] as const;

const PUBLIC_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/결제 완료 후 store_subscriptions 반영으로 권한이 확정됩니다\./gi, '결제 완료 후 이용 권한이 안전하게 적용됩니다.'],
  [/PortOne checkout, redirect, verify, webhook 상태 확인용입니다\./gi, '안전한 결제 흐름을 확인하는 관리자 전용 항목입니다.'],
  [/PortOne checkout, redirect, verify, webhook, payment event 흐름을 확인하는 내부 테스트 상품입니다\./gi, '관리자 전용 결제 점검 상품입니다. 일반 공개 가격표에는 노출되지 않습니다.'],
  [/환경이 준비되지 않은 경우[^.。]*[.。]?/gi, ''],
  [/성공처럼[^.。]*[.。]?/gi, ''],
];

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

function hasInternalPlatformText(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return PUBLIC_INTERNAL_KEYWORD_RULES.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isValidPublicHref(value: unknown) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    /^https?:\/\/[^\s]+$/i.test(trimmed)
  );
}

function getTextField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function autoFixPlatformText(value: string) {
  return PUBLIC_TEXT_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizePublicPlatformText(value: unknown, fallback: string | null = '') {
  if (typeof value !== 'string') return fallback;
  const repaired = autoFixPlatformText(value);
  if (!repaired.trim() || isBrokenPlatformText(repaired) || hasInternalPlatformText(repaired)) return fallback;
  return repaired;
}

function sanitizePublicTextArray(values: string[], fallback: string[] = []) {
  const sanitized = values
    .map((value) => sanitizePublicPlatformText(value, ''))
    .filter((value): value is string => Boolean(value));
  return sanitized.length ? sanitized : fallback;
}

export function scanPlatformContentQuality(items: PlatformContentQualityInput[]): PlatformContentQualityResult {
  const issues: PlatformContentQualityIssue[] = [];

  items.forEach((item) => {
    const fields = item.fields;
    const startsAt = getTextField(fields.starts_at);
    const endsAt = getTextField(fields.ends_at);
    const publicTitle = getTextField(fields.title);
    const publicSubtitle = getTextField(fields.subtitle);
    const publicBody = getTextField(fields.body);
    const sectionType = getTextField(fields.section_type || fields.sectionType);

    if (item.publicExposure && !publicTitle && !publicSubtitle && !publicBody) {
      issues.push({
        entityId: item.entityId,
        entityType: item.entityType,
        field: 'content',
        keyword: 'empty-section',
        message: '공개 섹션 또는 페이지에 보여줄 본문이 없습니다.',
        severity: 'critical',
      });
    }

    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      issues.push({
        entityId: item.entityId,
        entityType: item.entityType,
        field: 'schedule',
        keyword: 'schedule-conflict',
        message: '노출 종료 시간이 시작 시간보다 빠릅니다.',
        severity: 'warning',
      });
    }

    ['cta_href', 'link_href', 'media_url', 'hero_media_url', 'og_image_url'].forEach((field) => {
      if (!isValidPublicHref(fields[field])) {
        issues.push({
          entityId: item.entityId,
          entityType: item.entityType,
          field,
          keyword: 'invalid-url',
          message: `${field} 값이 공개 페이지에서 사용할 수 없는 링크 형식입니다.`,
          severity: 'critical',
        });
      }
    });

    if (
      item.publicExposure &&
      ['hero', 'pricing_teaser', 'final_cta'].includes(sectionType) &&
      (!getTextField(fields.cta_label) || !getTextField(fields.cta_href))
    ) {
      issues.push({
        entityId: item.entityId,
        entityType: item.entityType,
        field: 'cta',
        keyword: 'missing-cta',
        message: '주요 공개 섹션에는 CTA 라벨과 링크가 필요합니다.',
        severity: 'critical',
      });
    }

    if (item.publicExposure && (item.entityType.includes('footer') || item.entityType.includes('site_settings') || 'footer_links' in fields)) {
      const footerLinks = Array.isArray(fields.footer_links) ? fields.footer_links : [];
      const hrefs = footerLinks
        .map((link) => (typeof link === 'object' && link ? String((link as { href?: unknown }).href || '') : ''))
        .filter(Boolean);
      if (!hrefs.includes('/terms') || !hrefs.includes('/privacy')) {
        issues.push({
          entityId: item.entityId,
          entityType: item.entityType,
          field: 'footer_links',
          keyword: 'missing-legal-links',
          message: '푸터에는 이용약관과 개인정보처리방침 링크가 필요합니다.',
          severity: 'critical',
        });
      }
    }

    if (
      item.publicExposure &&
      (item.entityType.includes('seo') || item.entityType.includes('page') || 'seo_title' in fields || 'seo_description' in fields) &&
      (!getTextField(fields.seo_title) || !getTextField(fields.seo_description))
    ) {
      issues.push({
        entityId: item.entityId,
        entityType: item.entityType,
        field: 'seo',
        keyword: 'missing-seo',
        message: '공개 페이지 SEO 제목과 설명이 비어 있습니다.',
        severity: 'warning',
      });
    }

    if (item.entityType.includes('media') && !getTextField(fields.alt_text)) {
      issues.push({
        entityId: item.entityId,
        entityType: item.entityType,
        field: 'alt_text',
        keyword: 'missing-alt-text',
        message: '이미지에는 접근성과 신뢰를 위한 대체 텍스트가 필요합니다.',
        severity: 'warning',
      });
    }

    Object.entries(item.fields).forEach(([field, value]) => {
      if (typeof value !== 'string') return;
      if (!value.trim()) {
        issues.push({
          entityId: item.entityId,
          entityType: item.entityType,
          field,
          message: `${field} 값이 비어 있습니다.`,
          severity: 'warning',
        });
        return;
      }

      if (isBrokenPlatformText(value)) {
        issues.push({
          entityId: item.entityId,
          entityType: item.entityType,
          field,
          keyword: 'broken-text',
          message: `${field}에 깨진 문자열이 포함되어 있습니다.`,
          severity: 'critical',
        });
      }

      PUBLIC_INTERNAL_KEYWORD_RULES.forEach((keyword) => {
        if (value.toLowerCase().includes(keyword.toLowerCase())) {
          issues.push({
            entityId: item.entityId,
            entityType: item.entityType,
            field,
            keyword,
            message: `${field}에 공개 페이지에 부적절한 내부/개발자용 표현이 포함되어 있습니다: ${keyword}`,
            severity: item.publicExposure ? 'critical' : 'warning',
          });
        }
      });
    });
  });

  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const score = Math.max(0, 100 - criticalCount * 20 - warningCount * 5);

  return {
    criticalCount,
    issues,
    score,
    scannedCount: items.length,
    warningCount,
  };
}

export function assertSafePlatformText(value: unknown, fieldName: string) {
  if (isBrokenPlatformText(value)) {
    throw new Error(`${fieldName}에 깨진 문자열이 포함되어 있습니다.`);
  }

  if (hasInternalPlatformText(value)) {
    throw new Error(`${fieldName}에 공개 페이지에 부적절한 내부/개발자용 표현이 포함되어 있습니다.`);
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
    .map((plan) => ({
      ...plan,
      bullet_items: sanitizePublicTextArray(
        plan.bullet_items,
        FALLBACK_PRICING_PLANS.find((fallbackPlan) => fallbackPlan.plan_code === plan.plan_code)?.bullet_items || [],
      ),
      cta_label: sanitizePublicPlatformText(plan.cta_label, FALLBACK_PRICING_PLANS.find((fallbackPlan) => fallbackPlan.plan_code === plan.plan_code)?.cta_label || null),
      discount_label: sanitizePublicPlatformText(plan.discount_label, null),
      footnote: sanitizePublicPlatformText(plan.footnote, FALLBACK_PRICING_PLANS.find((fallbackPlan) => fallbackPlan.plan_code === plan.plan_code)?.footnote || null),
      short_description: sanitizePublicPlatformText(
        plan.short_description,
        FALLBACK_PRICING_PLANS.find((fallbackPlan) => fallbackPlan.plan_code === plan.plan_code)?.short_description || null,
      ),
    }))
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
