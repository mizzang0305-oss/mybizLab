import { supabase } from '../../../integrations/supabase/client';
import {
  FALLBACK_BILLING_PRODUCTS,
  FALLBACK_HOMEPAGE_SECTIONS,
  FALLBACK_PRICING_PLANS,
  FALLBACK_SITE_SETTINGS,
  PAYMENT_TEST_PRODUCT_CODE,
  type PlatformAdminOverview,
  type PlatformAnnouncement,
  type PlatformAuditLog,
  type PlatformBanner,
  type PlatformBillingProduct,
  type PlatformBoardPost,
  type PlatformFeatureFlag,
  type PlatformHomepageSection,
  type PlatformMediaAsset,
  type PlatformPaymentEvent,
  type PlatformPopup,
  type PlatformPricingPlan,
  type PlatformPromotion,
  type PlatformSiteSettings,
  type PublicPlatformChromePayload,
  type PublicPlatformHomepagePayload,
  type PublicPlatformPricingPayload,
} from '../platformAdminConfig';
import { resolveServerApiUrl } from '../serverApiUrl';

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
  ok: boolean;
}

export interface PlatformAdminSession {
  email: string;
  profileId: string;
  role: 'platform_admin' | 'platform_owner' | 'platform_viewer';
}

export type PlatformAdminResource =
  | 'announcements'
  | 'audit-logs'
  | 'banners'
  | 'billing-products'
  | 'board-posts'
  | 'feature-flags'
  | 'homepage-sections'
  | 'media-assets'
  | 'overview'
  | 'payment-events'
  | 'payment-tests'
  | 'popups'
  | 'pricing-plans'
  | 'pricing-preview'
  | 'promotions'
  | 'session'
  | 'site-settings';

async function readJson<T>(response: Response) {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : ({ ok: response.ok } as ApiEnvelope<T>);
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `요청 처리에 실패했습니다. (${response.status})`);
  }

  return payload.data as T;
}

async function getAccessToken() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.access_token || null;
}

async function platformAdminFetch<T>(resource: PlatformAdminResource, init?: RequestInit & { query?: Record<string, string> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('플랫폼 관리자 로그인이 필요합니다.');
  }

  const url = new URL(resolveServerApiUrl(`/api/admin/platform/${resource}`), window.location.origin);
  Object.entries(init?.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  return readJson<T>(response);
}

async function platformPublicFetch<T>(resource: string, fallback: T, query?: Record<string, string>) {
  try {
    const url = new URL(resolveServerApiUrl(`/api/public/platform/${resource}`), window.location.origin);
    Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString());
    return readJson<T>(response);
  } catch {
    return fallback;
  }
}

export async function getPlatformAdminSession() {
  return platformAdminFetch<PlatformAdminSession>('session');
}

export async function getPlatformAdminOverview() {
  return platformAdminFetch<PlatformAdminOverview>('overview');
}

export async function listPlatformAdminResource<T>(resource: PlatformAdminResource) {
  return platformAdminFetch<T[]>(resource);
}

export async function createPlatformAdminResource<T>(resource: PlatformAdminResource, payload: Record<string, unknown>) {
  return platformAdminFetch<T>(resource, {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function updatePlatformAdminResource<T>(resource: PlatformAdminResource, payload: Record<string, unknown>) {
  return platformAdminFetch<T>(resource, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}

export async function getPaymentTestsSnapshot() {
  return platformAdminFetch<{
    events: PlatformPaymentEvent[];
    failureCopy: string;
    product: PlatformBillingProduct | null;
    successCopy: string;
  }>('payment-tests');
}

export async function getPublicPlatformHomepageContent() {
  return platformPublicFetch<PublicPlatformHomepagePayload>('homepage', {
    sections: FALLBACK_HOMEPAGE_SECTIONS,
    settings: FALLBACK_SITE_SETTINGS,
  });
}

export async function getPublicPlatformPricingContent(searchParams?: URLSearchParams, adminPreview = false) {
  return platformPublicFetch<PublicPlatformPricingPayload>(
    'pricing',
    {
      plans: FALLBACK_PRICING_PLANS,
      testProducts: [],
    },
    {
      ...(adminPreview ? { preview: 'admin' } : {}),
      ...(searchParams?.get('testPayment') ? { testPayment: searchParams.get('testPayment') || '1' } : {}),
    },
  );
}

export async function getPublicPlatformChrome(pathname: string) {
  return platformPublicFetch<PublicPlatformChromePayload>('chrome', { banners: [], popups: [] }, { pathname });
}

export async function getPublicPlatformAnnouncements() {
  return platformPublicFetch<PlatformAnnouncement[]>('announcements', []);
}

export async function getPublicPlatformBoardPosts() {
  return platformPublicFetch<PlatformBoardPost[]>('board-posts', []);
}

export const PLATFORM_ADMIN_RESOURCE_LABELS: Record<PlatformAdminResource, string> = {
  announcements: '공지',
  'audit-logs': '감사 로그',
  banners: '배너',
  'billing-products': '결제 상품',
  'board-posts': '게시판',
  'feature-flags': '기능 플래그',
  'homepage-sections': '홈페이지 섹션',
  'media-assets': '미디어',
  overview: '개요',
  'payment-events': '결제 이벤트',
  'payment-tests': '100원 테스트 결제',
  popups: '팝업',
  'pricing-plans': '가격표',
  'pricing-preview': '가격표 미리보기',
  promotions: '프로모션/할인 표시',
  session: '세션',
  'site-settings': 'SEO/푸터 설정',
};

export type PlatformAdminEntity =
  | PlatformAnnouncement
  | PlatformAuditLog
  | PlatformBanner
  | PlatformBillingProduct
  | PlatformBoardPost
  | PlatformFeatureFlag
  | PlatformHomepageSection
  | PlatformMediaAsset
  | PlatformPopup
  | PlatformPricingPlan
  | PlatformPromotion
  | PlatformSiteSettings;

export function getPaymentTestProduct(products: PlatformBillingProduct[]) {
  return products.find((product) => product.product_code === PAYMENT_TEST_PRODUCT_CODE) || FALLBACK_BILLING_PRODUCTS[0];
}
