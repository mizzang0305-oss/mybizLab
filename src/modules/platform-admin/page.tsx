import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import {
  PAYMENT_TEST_PRODUCT_CODE,
  formatProductKrw,
  type PlatformAdminOverview,
  type PlatformContentQualityResult,
  type PlatformPaymentEvent,
  type PlatformPricingPlan,
} from '@/shared/lib/platformAdminConfig';
import { launchPortOneCheckout } from '@/shared/lib/portoneCheckout';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  PLATFORM_ADMIN_RESOURCE_LABELS,
  createPlatformAdminResource,
  getPaymentTestsSnapshot,
  getPlatformContentQualitySnapshot,
  getPlatformAdminOverview,
  listPlatformAdminResource,
  updatePlatformAdminResource,
  type PlatformAdminResource,
} from '@/shared/lib/services/platformAdminContentService';

type JsonRow = Record<string, unknown>;

type EditablePlatformAdminResource = Extract<
  PlatformAdminResource,
  | 'announcements'
  | 'banners'
  | 'billing-products'
  | 'board-posts'
  | 'content-quality-rules'
  | 'content-versions'
  | 'feature-flags'
  | 'faq-items'
  | 'footer-settings'
  | 'homepage-sections'
  | 'media-assets'
  | 'page-sections'
  | 'pages'
  | 'popups'
  | 'pricing-plans'
  | 'promotions'
  | 'site-settings'
  | 'site-snapshots'
  | 'trust-signals'
>;

const resourceDescriptions: Partial<Record<PlatformAdminResource, string>> = {
  announcements: '방문자와 점주에게 노출할 공지사항을 작성하고 게시 상태를 관리합니다.',
  banners: '홈페이지, 가격표, 운영 화면 상단에 노출할 배너를 관리합니다.',
  'billing-products': '구독 플랜이 아닌 단건/테스트 결제 상품을 관리합니다. 실제 결제 금액은 서버 카탈로그 기준으로 결정됩니다.',
  'board-posts': '업데이트, 뉴스, 가이드 게시글을 초안/게시/보관 상태로 관리합니다.',
  'content-quality-rules': '공개 콘텐츠에 허용되지 않는 내부 문구, 누락 필드, 링크 품질 규칙을 관리합니다.',
  'feature-flags': '안전한 기능 플래그를 관리합니다. MYBI는 명시 요청 전까지 false로 유지합니다.',
  'faq-items': '공개 FAQ 질문과 답변을 관리합니다. 짧고 고객 친화적인 문장으로 작성합니다.',
  'footer-settings': '회사 정보, 지원 연락처, 정책 링크 등 푸터 신뢰 정보를 관리합니다.',
  'homepage-sections': '공개 홈페이지 섹션의 문구, CTA, 미디어, 고급 설정, 게시 상태를 관리합니다.',
  'media-assets': '스토리지 업로드 인프라 전까지 URL 기반 미디어 등록과 대체 텍스트 관리를 제공합니다.',
  'page-sections': '개별 공개 페이지의 섹션 순서와 콘텐츠 블록을 관리합니다.',
  pages: '기능, FAQ, 소개, 문의, 신뢰 페이지의 공개 상태와 SEO를 관리합니다.',
  popups: '홈페이지/가격표/공개 페이지에 표시할 팝업을 경로, 일정, 빈도 정책 기준으로 관리합니다.',
  'pricing-plans': 'FREE/PRO/VIP 가격표 표시를 관리합니다. plan_code는 free/pro/vip만 허용됩니다.',
  promotions: '실제 결제 금액이 아닌 표시용 할인/비교가/배지를 관리합니다.',
  'site-settings': 'SEO, CTA, 푸터, 지원 연락처 등 글로벌 공개 사이트 설정을 관리합니다.',
  'trust-signals': '결제 안정성, 접근권한 분리, 공개 콘텐츠 품질 등 신뢰요소를 관리합니다.',
};

const templateByResource: Partial<Record<PlatformAdminResource, JsonRow>> = {
  announcements: {
    audience: 'all',
    body: '공지 내용을 입력하세요.',
    category: 'service',
    is_pinned: false,
    is_published: false,
    severity: 'info',
    title: '새 공지',
  },
  banners: {
    banner_key: `banner_${Date.now()}`,
    is_active: false,
    message: '배너 메시지를 입력하세요.',
    priority: 100,
    severity: 'info',
    target_paths: ['/'],
  },
  'billing-products': {
    amount: 1000,
    bullet_items: [],
    currency: 'KRW',
    grants_entitlement: false,
    is_test_product: false,
    is_visible_public: false,
    product_code: `product_${Date.now()}`,
    product_name: '새 결제 상품',
    product_type: 'one_time',
    sort_order: 100,
    status: 'draft',
  },
  'board-posts': {
    body: '본문을 입력하세요.',
    excerpt: '요약을 입력하세요.',
    is_pinned: false,
    slug: `post-${Date.now()}`,
    status: 'draft',
    tags: [],
    title: '새 게시글',
  },
  'content-quality-rules': {
    is_active: true,
    keyword: 'webhook',
    rule_key: `rule_${Date.now()}`,
    severity: 'critical',
    suggestion: '고객에게는 결제 안정성/지원 안내로 표현하세요.',
  },
  'faq-items': {
    answer: '문의, 예약, 웨이팅, 주문이 한 고객의 맥락으로 쌓여 재방문 액션을 더 빠르게 정할 수 있습니다.',
    category: '제품',
    is_published: false,
    question: '고객 기억은 매출에 어떻게 도움이 되나요?',
    sort_order: 100,
  },
  'footer-settings': {
    footer_business_info: '고객 기억 기반 매출 AI SaaS',
    footer_company_name: 'MyBiz',
    footer_links: [
      { href: '/terms', label: '이용약관' },
      { href: '/privacy', label: '개인정보처리방침' },
    ],
    status: 'draft',
    support_email: 'support@mybiz.ai.kr',
  },
  'feature-flags': {
    description: '기능 설명',
    flag_key: `flag_${Date.now()}`,
    is_enabled: false,
    payload: {},
    scope: 'global',
  },
  'homepage-sections': {
    body: '본문을 입력하세요.',
    is_visible: true,
    payload: {},
    section_key: `section_${Date.now()}`,
    section_type: 'custom_json',
    sort_order: 100,
    status: 'draft',
    title: '새 섹션',
  },
  'media-assets': {
    alt_text: '이미지 설명',
    tags: [],
    url: 'https://',
    usage_context: 'homepage',
  },
  'page-sections': {
    body: '섹션 본문을 입력하세요.',
    is_visible: true,
    page_slug: 'features',
    payload: {},
    section_key: `page_section_${Date.now()}`,
    sort_order: 100,
    status: 'draft',
    title: '새 페이지 섹션',
  },
  pages: {
    body: '페이지 본문을 입력하세요.',
    cta_href: '/onboarding?plan=free',
    cta_label: '무료로 시작하기',
    description: '고객이 이해할 수 있는 한 문장 설명을 입력하세요.',
    is_published: false,
    payload: {},
    seo_description: 'MyBiz 공개 페이지 설명',
    seo_title: 'MyBiz',
    slug: `page-${Date.now()}`,
    sort_order: 100,
    title: '새 공개 페이지',
  },
  popups: {
    audience: 'all',
    dismissible: true,
    frequency_policy: 'once_per_session',
    is_active: false,
    popup_key: `popup_${Date.now()}`,
    popup_type: 'modal',
    priority: 100,
    status: 'draft',
    target_paths: ['/'],
    title: '새 팝업',
  },
  'pricing-plans': {
    billing_cycle: 'month',
    bullet_items: ['항목을 입력하세요'],
    cta_action: 'checkout',
    cta_label: '시작하기',
    currency: 'KRW',
    display_name: 'PRO',
    is_recommended: false,
    is_visible: true,
    plan_code: 'pro',
    price_amount: 79000,
    sort_order: 20,
    status: 'draft',
  },
  promotions: {
    applies_to_code: 'pro',
    applies_to_type: 'plan',
    display_mode: 'badge',
    discount_type: 'display_only',
    is_active: false,
    label: '할인 표시',
    promotion_code: `promotion_${Date.now()}`,
    title: '새 프로모션',
  },
  'site-settings': {
    homepage_status: 'published',
    primary_cta_href: '/onboarding?plan=free',
    primary_cta_label: '무료로 시작하기',
    seo_description: '공개 스토어, 문의, 예약, 웨이팅, QR 주문을 고객 기억으로 연결합니다.',
    seo_title: 'MyBiz | 고객 기억 기반 매출 AI SaaS',
    site_name: 'MyBiz',
  },
  'trust-signals': {
    body: '신뢰요소 설명을 입력하세요.',
    icon_key: 'shield',
    is_visible: true,
    signal_key: `trust_${Date.now()}`,
    sort_order: 100,
    title: '새 신뢰요소',
  },
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}

function getRowKey(row: JsonRow) {
  return String(
    row.id ||
      row.section_key ||
      row.plan_code ||
      row.product_code ||
      row.promotion_code ||
      row.slug ||
      row.popup_key ||
      row.banner_key ||
      row.flag_key ||
      row.url ||
      JSON.stringify(row),
  );
}

function getRowTitle(row: JsonRow) {
  return String(
    row.title ||
      row.display_name ||
      row.product_name ||
      row.message ||
      row.site_name ||
      row.flag_key ||
      row.url ||
      getRowKey(row),
  );
}

function AdminCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_-56px_rgba(0,0,0,0.8)]">
      <h2 className="font-display text-xl font-black text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function JsonEditor({ resource }: { resource: PlatformAdminResource }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<JsonRow | null>(null);
  const [draftText, setDraftText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.platformAdminResource(resource),
    queryFn: () => listPlatformAdminResource<JsonRow>(resource),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      setParseError(null);
      let payload: JsonRow;
      try {
        payload = JSON.parse(draftText) as JsonRow;
      } catch {
        setParseError('JSON 형식이 올바르지 않습니다.');
        throw new Error('JSON 형식이 올바르지 않습니다.');
      }

      return selected
        ? updatePlatformAdminResource(resource, payload)
        : createPlatformAdminResource(resource, payload);
    },
    onSuccess: async () => {
      setSelected(null);
      setDraftText('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platformAdminResource(resource) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platformAdminOverview }),
      ]);
    },
  });

  const rows = query.data || [];
  const template = useMemo(() => JSON.stringify(templateByResource[resource] || {}, null, 2), [resource]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_28rem]">
      <AdminCard title={`${PLATFORM_ADMIN_RESOURCE_LABELS[resource]} 목록`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-sm leading-6 text-slate-400">{resourceDescriptions[resource]}</p>
          <button
            className="btn-primary"
            onClick={() => {
              setSelected(null);
              setParseError(null);
              setDraftText(template);
            }}
            type="button"
          >
            새 항목
          </button>
        </div>

        {query.isLoading ? <p className="text-sm text-slate-400">불러오는 중입니다.</p> : null}
        {query.isError ? (
          <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            {query.error instanceof Error ? query.error.message : '목록을 불러오지 못했습니다.'}
          </p>
        ) : null}
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState title="관리 항목이 없습니다" description="새 항목을 만들거나 migration seed 적용 상태를 확인하세요." />
        ) : null}

        <div className="space-y-3">
          {rows.map((row) => {
            const key = getRowKey(row);
            const title = getRowTitle(row);
            const status = String(row.status || (row.is_published ? 'published' : '') || (row.is_active ? 'active' : '') || '');
            return (
              <button
                key={key}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left transition hover:border-orange-300/40"
                onClick={() => {
                  setSelected(row);
                  setParseError(null);
                  setDraftText(JSON.stringify(row, null, 2));
                }}
                type="button"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-white">{title}</p>
                  {status ? <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">{status}</span> : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{key}</p>
              </button>
            );
          })}
        </div>
      </AdminCard>

      <AdminCard title={selected ? '항목 수정' : '새 항목 작성'}>
        <textarea
          className="min-h-[28rem] w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none focus:border-orange-300/50"
          onChange={(event) => setDraftText(event.target.value)}
          placeholder={template}
          value={draftText}
        />
        {parseError || saveMutation.isError ? (
          <p className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            {parseError || (saveMutation.error instanceof Error ? saveMutation.error.message : '저장에 실패했습니다.')}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!draftText.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            type="button"
          >
            {saveMutation.isPending ? '저장 중' : selected ? '변경 저장' : '새 항목 생성'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setSelected(null);
              setParseError(null);
              setDraftText('');
            }}
            type="button"
          >
            취소
          </button>
        </div>
      </AdminCard>
    </div>
  );
}

function ResourcePage({ resource }: { resource: EditablePlatformAdminResource }) {
  return <JsonEditor resource={resource} />;
}

export function PlatformAdminOverviewPage() {
  const overviewQuery = useQuery({
    queryKey: queryKeys.platformAdminOverview,
    queryFn: getPlatformAdminOverview,
  });
  const overview = overviewQuery.data as PlatformAdminOverview | undefined;

  if (overviewQuery.isLoading) {
    return <p className="text-sm font-bold text-slate-400">플랫폼 운영 현황을 불러오는 중입니다.</p>;
  }

  if (overviewQuery.isError || !overview) {
    return (
      <EmptyState
        title="플랫폼 관리자 데이터를 불러오지 못했습니다"
        description="migration 적용 상태와 플랫폼 관리자 권한을 확인하세요."
      />
    );
  }

  const cards = [
    ['게시 중 홈페이지 섹션', overview.publishedHomepageSections],
    ['노출 가격 플랜', overview.visiblePricingPlans],
    ['활성 팝업', overview.activePopups],
    ['활성 공지', overview.activeAnnouncements],
    ['최근 결제 이벤트', overview.recentPaymentEvents],
    ['실패 결제 이벤트', overview.failedPaymentEvents],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-xs font-black text-slate-500">{label}</p>
            <p className="mt-2 font-display text-3xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <AdminCard title="빠른 작업">
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary" to="/admin/homepage">홈페이지 섹션 관리</Link>
          <Link className="btn-secondary" to="/admin/pricing">가격표 관리</Link>
          <Link className="btn-secondary" to="/admin/payment-tests">100원 테스트 결제</Link>
          <Link className="btn-secondary" to="/admin/popups">팝업 관리</Link>
        </div>
      </AdminCard>

      <AdminCard title="최근 감사 로그">
        {overview.recentAuditLogs.length ? (
          <div className="space-y-2">
            {overview.recentAuditLogs.map((log) => (
              <div key={log.id || `${log.entity_type}-${log.created_at}`} className="rounded-2xl bg-slate-900/80 px-4 py-3 text-sm">
                <p className="font-bold text-white">{log.action} · {log.entity_type}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(log.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">아직 플랫폼 관리자 변경 로그가 없습니다.</p>
        )}
      </AdminCard>
    </div>
  );
}

export function PlatformHomepageAdminPage() {
  return <ResourcePage resource="homepage-sections" />;
}

export function PlatformPagesAdminPage() {
  return <ResourcePage resource="pages" />;
}

export function PlatformSectionsAdminPage() {
  return <ResourcePage resource="page-sections" />;
}

export function PlatformFaqAdminPage() {
  return <ResourcePage resource="faq-items" />;
}

export function PlatformTrustAdminPage() {
  return <ResourcePage resource="trust-signals" />;
}

export function PlatformFooterAdminPage() {
  return <ResourcePage resource="footer-settings" />;
}

export function PlatformSeoAdminPage() {
  return <ResourcePage resource="site-settings" />;
}

export function PlatformPricingAdminPage() {
  const previewQuery = useQuery({
    queryKey: queryKeys.platformAdminResource('pricing-plans'),
    queryFn: () => listPlatformAdminResource<PlatformPricingPlan>('pricing-plans'),
  });

  return (
    <div className="space-y-6">
      <AdminCard title="가격표 안전 규칙">
        <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
          <p>FREE는 실제 구독 플랜이지만 유료 checkout을 호출하지 않고 항상 `/onboarding?plan=free`로 이동해야 합니다.</p>
          <p>PRO는 79,000원, VIP는 149,000원 기준을 유지합니다. 할인처럼 보이는 표시는 compare-at/label로 관리합니다.</p>
          <p>클라이언트가 보낸 금액은 신뢰하지 않고 서버 상품 정보가 결제 요청 금액을 결정합니다.</p>
        </div>
        {previewQuery.data ? (
          <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
            {JSON.stringify(previewQuery.data, null, 2)}
          </pre>
        ) : null}
      </AdminCard>
      <ResourcePage resource="pricing-plans" />
    </div>
  );
}

export function PlatformProductsAdminPage() {
  return (
    <div className="space-y-6">
      <AdminCard title="100원 테스트 상품 규칙">
        <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
          <p>`payment_test_100`은 단건 테스트 상품입니다. subscription plan이 아니며 PRO/VIP 권한을 부여하지 않습니다.</p>
          <p>기본 공개 가격표에는 숨겨지고 `?testPayment=1` 또는 관리자 미리보기에서만 노출됩니다.</p>
          <p>결제창 진입, 복귀, 검증, 결제 이벤트 기록 상태를 확인하는 운영자 전용 상품입니다.</p>
        </div>
      </AdminCard>
      <ResourcePage resource="billing-products" />
    </div>
  );
}

export function PlatformPromotionsAdminPage() {
  return <ResourcePage resource="promotions" />;
}

export function PlatformAnnouncementsAdminPage() {
  return <ResourcePage resource="announcements" />;
}

export function PlatformBoardAdminPage() {
  return <ResourcePage resource="board-posts" />;
}

export function PlatformPopupsAdminPage() {
  return <ResourcePage resource="popups" />;
}

export function PlatformBannersAdminPage() {
  return <ResourcePage resource="banners" />;
}

export function PlatformMediaAdminPage() {
  return <ResourcePage resource="media-assets" />;
}

export function PlatformFeatureFlagsAdminPage() {
  return (
    <div className="space-y-6">
      <AdminCard title="기능 플래그 안전 규칙">
        <p className="text-sm leading-6 text-slate-300">
          MYBI companion은 현재 전역 비활성 상태입니다. 명시적인 재활성 요청 전에는 관리자 UI/API에서 켤 수 없습니다.
        </p>
      </AdminCard>
      <ResourcePage resource="feature-flags" />
    </div>
  );
}

export function PlatformSettingsAdminPage() {
  return <ResourcePage resource="site-settings" />;
}

export function PlatformPaymentEventsAdminPage() {
  const query = useQuery({
    queryKey: queryKeys.platformAdminResource('payment-events'),
    queryFn: () => listPlatformAdminResource<PlatformPaymentEvent>('payment-events'),
  });
  const [filter, setFilter] = useState('');
  const rows = (query.data || []).filter((event) => JSON.stringify(event).toLowerCase().includes(filter.toLowerCase()));

  return (
    <AdminCard title="결제 이벤트">
      <input
        className="mb-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-300/50"
        onChange={(event) => setFilter(event.target.value)}
        placeholder="status, provider, productCode, payment_test 검색"
        value={filter}
      />
      {query.isLoading ? <p className="text-sm text-slate-400">결제 이벤트를 불러오는 중입니다.</p> : null}
      <div className="space-y-3">
        {rows.map((event, index) => (
          <details key={event.id || `${event.provider_payment_id}-${index}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <summary className="cursor-pointer text-sm font-bold text-white">
              {event.status || '상태 없음'} · {event.product_code || event.purpose || '상품 코드 없음'} · {event.provider_payment_id || event.id || '-'}
            </summary>
            <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(event, null, 2)}</pre>
          </details>
        ))}
      </div>
    </AdminCard>
  );
}

export function PlatformPaymentTestsAdminPage() {
  const query = useQuery({
    queryKey: queryKeys.platformPaymentTests,
    queryFn: getPaymentTestsSnapshot,
  });
  const [message, setMessage] = useState<string | null>(null);
  const product = query.data?.product;
  const readiness = query.data?.readiness;
  const productIsSafe =
    product?.product_code === PAYMENT_TEST_PRODUCT_CODE &&
    product.amount === 100 &&
    product.grants_entitlement === false &&
    product.is_test_product === true;
  const canStartPaymentTest = Boolean(productIsSafe && readiness?.isReady);

  async function startPaymentTest() {
    if (!product) return;
    if (!canStartPaymentTest) {
      setMessage(readiness?.message || 'PortOne 테스트 결제 설정이 아직 완료되지 않았습니다.');
      return;
    }
    setMessage('100원 테스트 결제창을 준비합니다.');
    try {
      const { payment } = await launchPortOneCheckout('pro', {
        billingProductCode: PAYMENT_TEST_PRODUCT_CODE,
        customData: {
          grantsEntitlement: false,
          productCode: PAYMENT_TEST_PRODUCT_CODE,
          purpose: 'payment_test',
        },
        orderName: product.order_name || product.product_name,
        redirectPath: '/admin/payment-tests',
        source: 'platform-admin-payment-test',
      });
      if (payment?.code) {
        setMessage(query.data?.failureCopy || '100원 테스트 결제가 실패했습니다. PortOne 설정과 결제 이벤트 로그를 확인하세요.');
      } else {
        setMessage(query.data?.successCopy || '100원 테스트 결제가 완료되었습니다. 구독 권한은 변경되지 않았습니다.');
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      if (/FUNCTION_INVOCATION_FAILED/i.test(rawMessage)) {
        setMessage('PortOne 테스트 결제 설정이 아직 완료되지 않았습니다. 설정 상태와 결제 이벤트 로그를 확인하세요.');
      } else {
        setMessage(rawMessage || '100원 테스트 결제를 시작하지 못했습니다.');
      }
    }
  }

  return (
    <div className="space-y-6">
      <AdminCard title="100원 테스트 결제">
        {product ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-3 text-sm leading-6 text-slate-300">
              <p>상품 코드: <strong className="text-white">{product.product_code}</strong></p>
              <p>금액: <strong className="text-white">{formatProductKrw(product.amount)}</strong></p>
              <p>구독 권한 부여: <strong className="text-white">{product.grants_entitlement ? '예' : '아니오'}</strong></p>
              <p>용도: <strong className="text-white">{String(product.metadata?.purpose || 'payment_test')}</strong></p>
              <p className="rounded-2xl bg-emerald-400/10 px-4 py-3 font-bold text-emerald-100">
                100원 테스트 결제가 성공해도 구독 권한이나 PRO/VIP 이용 권한을 변경하지 않습니다.
              </p>
              <div className={`rounded-2xl border px-4 py-3 ${canStartPaymentTest ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/30 bg-amber-400/10 text-amber-100'}`}>
                <p className="font-bold">{readiness?.message || 'PortOne 테스트 결제 설정 상태를 확인하는 중입니다.'}</p>
                {readiness?.missing?.length ? (
                  <p className="mt-2 text-xs text-amber-100/80">확인 필요 항목: {readiness.missing.join(', ')}</p>
                ) : null}
              </div>
            </div>
            <button className="btn-primary self-start disabled:cursor-not-allowed disabled:opacity-60" disabled={!canStartPaymentTest} onClick={() => void startPaymentTest()} type="button">
              100원 테스트 결제 열기
            </button>
          </div>
        ) : (
          <EmptyState title="100원 테스트 상품이 없습니다" description="결제 상품 관리에서 payment_test_100을 생성하거나 migration seed를 적용하세요." />
        )}
        {message ? <p className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">{message}</p> : null}
      </AdminCard>

      <AdminCard title="최근 테스트 결제 이벤트">
        <div className="space-y-3">
          {(query.data?.events || []).map((event) => (
            <details key={event.id || event.provider_payment_id || JSON.stringify(event)} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <summary className="cursor-pointer text-sm font-bold text-white">
                {event.status || '상태 없음'} · {event.provider_payment_id || event.id}
              </summary>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(event, null, 2)}</pre>
            </details>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

export function PlatformAuditLogsAdminPage() {
  const query = useQuery({
    queryKey: queryKeys.platformAdminResource('audit-logs'),
    queryFn: () => listPlatformAdminResource<JsonRow>('audit-logs'),
  });

  return (
    <AdminCard title="감사 로그">
      <div className="space-y-3">
        {(query.data || []).map((log) => (
          <details key={String(log.id || `${log.entity_type}-${log.created_at}`)} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <summary className="cursor-pointer text-sm font-bold text-white">
              {String(log.action)} · {String(log.entity_type)} · {formatDate(String(log.created_at || ''))}
            </summary>
            <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(log, null, 2)}</pre>
          </details>
        ))}
      </div>
    </AdminCard>
  );
}

function QualityBadge({ count, label, tone }: { count: number; label: string; tone: 'critical' | 'warning' | 'score' }) {
  const className =
    tone === 'critical'
      ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
      : tone === 'warning'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
        : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <p className="text-xs font-black text-current/70">{label}</p>
      <p className="mt-1 font-display text-2xl font-black">{count}</p>
    </div>
  );
}

export function PlatformContentQualityAdminPage() {
  const query = useQuery({
    queryKey: queryKeys.platformContentQuality,
    queryFn: getPlatformContentQualitySnapshot,
  });
  const result = query.data as PlatformContentQualityResult | undefined;

  return (
    <div className="space-y-6">
      <AdminCard title="공개 콘텐츠 품질 검사">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            홈페이지, 가격표, 공지, 게시판, 팝업, 배너, FAQ, 신뢰요소에 내부/개발자용 표현이 섞였는지 검사합니다.
            critical 이슈는 게시 전에 수정해야 합니다.
          </p>
          <button className="btn-primary" onClick={() => void query.refetch()} type="button">
            다시 검사
          </button>
        </div>
        {query.isLoading ? <p className="mt-4 text-sm text-slate-400">콘텐츠 품질을 검사하는 중입니다.</p> : null}
        {query.isError ? (
          <p className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            {query.error instanceof Error ? query.error.message : '콘텐츠 품질 검사를 실행하지 못했습니다.'}
          </p>
        ) : null}
        {result ? (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <QualityBadge count={result.score} label="품질 점수" tone="score" />
              <QualityBadge count={result.scannedCount} label="검사 항목" tone="score" />
              <QualityBadge count={result.criticalCount} label="차단 이슈" tone="critical" />
              <QualityBadge count={result.warningCount} label="경고" tone="warning" />
            </div>
            <div className="mt-5 space-y-3">
              {result.issues.map((issue, index) => (
                <article key={`${issue.entityType}-${issue.entityId}-${issue.field}-${index}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${issue.severity === 'critical' ? 'bg-rose-500/15 text-rose-200' : 'bg-amber-500/15 text-amber-200'}`}>
                      {issue.severity === 'critical' ? '게시 차단' : '경고'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{issue.entityType} · {issue.entityId} · {issue.field}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-white">{issue.message}</p>
                </article>
              ))}
              {!result.issues.length ? <p className="text-sm font-bold text-emerald-200">공개 콘텐츠 품질 이슈가 없습니다.</p> : null}
            </div>
          </>
        ) : null}
      </AdminCard>
      <ResourcePage resource="content-quality-rules" />
    </div>
  );
}

export function PlatformVersionsAdminPage() {
  return (
    <div className="space-y-6">
      <AdminCard title="게시 버전과 스냅샷">
        <p className="text-sm leading-6 text-slate-300">
          공개 사이트 게시 이력과 마지막 정상 스냅샷을 확인합니다. 롤백 실행은 다음 배포에서 제공됩니다. 현재는 버전 기록만 확인할 수 있습니다.
        </p>
      </AdminCard>
      <ResourcePage resource="content-versions" />
      <ResourcePage resource="site-snapshots" />
    </div>
  );
}

export function PlatformPreviewAdminPage() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 text-white transition hover:border-orange-300/40" to="/?preview=admin">
        <p className="font-black">홈페이지 미리보기</p>
        <p className="mt-2 text-sm text-slate-400">게시 중인 홈페이지 섹션과 fallback을 확인합니다.</p>
      </Link>
      <Link className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 text-white transition hover:border-orange-300/40" to="/pricing?testPayment=1">
        <p className="font-black">가격표 + 테스트 상품</p>
        <p className="mt-2 text-sm text-slate-400">100원 테스트 상품 노출 조건을 확인합니다.</p>
      </Link>
      <Link className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 text-white transition hover:border-orange-300/40" to="/notices">
        <p className="font-black">공지/게시판</p>
        <p className="mt-2 text-sm text-slate-400">공개 공지와 업데이트 게시글을 확인합니다.</p>
      </Link>
    </div>
  );
}
