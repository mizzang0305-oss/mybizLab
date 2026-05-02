import {
  FALLBACK_BILLING_PRODUCTS,
  FALLBACK_FAQ_ITEMS,
  FALLBACK_HOMEPAGE_SECTIONS,
  FALLBACK_PUBLIC_PAGES,
  FALLBACK_PRICING_PLANS,
  FALLBACK_SITE_SETTINGS,
  FALLBACK_TRUST_SIGNALS,
  PAYMENT_TEST_PRODUCT_CODE,
  filterPublicBillingProducts,
  filterPublicHomepageSections,
  filterPublicPricingPlans,
  isInSchedule,
  isPlatformPlanCode,
  normalizeJsonArray,
  pathMatchesTarget,
  sanitizePublicPlatformText,
  type PlatformAnnouncement,
  type PlatformBanner,
  type PlatformBillingProduct,
  type PlatformBoardPost,
  type PlatformFaqItem,
  type PlatformHomepageSection,
  type PlatformPaymentEvent,
  type PlatformPlanCode,
  type PlatformPopup,
  type PlatformPricingPlan,
  type PlatformPublicPage,
  type PlatformSiteSettings,
  type PlatformTrustSignal,
} from '../shared/lib/platformAdminConfig.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

interface PlatformPublicQuery {
  adminPreview?: boolean;
  pathname?: string;
  searchParams?: URLSearchParams;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return [];
}

function normalizeSiteSettings(row: Record<string, unknown> | null | undefined): PlatformSiteSettings {
  if (!row) return FALLBACK_SITE_SETTINGS;

  return {
    footer_business_info: typeof row.footer_business_info === 'string' ? row.footer_business_info : FALLBACK_SITE_SETTINGS.footer_business_info,
    footer_company_name: typeof row.footer_company_name === 'string' ? row.footer_company_name : FALLBACK_SITE_SETTINGS.footer_company_name,
    footer_links: Array.isArray(row.footer_links) ? row.footer_links as PlatformSiteSettings['footer_links'] : FALLBACK_SITE_SETTINGS.footer_links,
    homepage_status: row.homepage_status === 'draft' || row.homepage_status === 'maintenance' || row.homepage_status === 'published'
      ? row.homepage_status
      : FALLBACK_SITE_SETTINGS.homepage_status,
    og_image_url: typeof row.og_image_url === 'string' ? row.og_image_url : null,
    primary_cta_href: typeof row.primary_cta_href === 'string' ? row.primary_cta_href : FALLBACK_SITE_SETTINGS.primary_cta_href,
    primary_cta_label: typeof row.primary_cta_label === 'string' ? row.primary_cta_label : FALLBACK_SITE_SETTINGS.primary_cta_label,
    secondary_cta_href: typeof row.secondary_cta_href === 'string' ? row.secondary_cta_href : FALLBACK_SITE_SETTINGS.secondary_cta_href,
    secondary_cta_label: typeof row.secondary_cta_label === 'string' ? row.secondary_cta_label : FALLBACK_SITE_SETTINGS.secondary_cta_label,
    seo_description: typeof row.seo_description === 'string' ? row.seo_description : FALLBACK_SITE_SETTINGS.seo_description,
    seo_title: typeof row.seo_title === 'string' ? row.seo_title : FALLBACK_SITE_SETTINGS.seo_title,
    site_name: typeof row.site_name === 'string' && row.site_name.trim() ? row.site_name : FALLBACK_SITE_SETTINGS.site_name,
    support_email: typeof row.support_email === 'string' ? row.support_email : FALLBACK_SITE_SETTINGS.support_email,
    support_phone: typeof row.support_phone === 'string' ? row.support_phone : FALLBACK_SITE_SETTINGS.support_phone,
  };
}

function normalizeHomepageSection(row: Record<string, unknown>): PlatformHomepageSection {
  return {
    body: sanitizePublicPlatformText(row.body, null),
    cta_href: typeof row.cta_href === 'string' ? row.cta_href : null,
    cta_label: sanitizePublicPlatformText(row.cta_label, null),
    ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
    eyebrow: sanitizePublicPlatformText(row.eyebrow, null),
    id: typeof row.id === 'string' ? row.id : undefined,
    is_visible: row.is_visible !== false,
    media_url: typeof row.media_url === 'string' ? row.media_url : null,
    payload: toRecord(row.payload),
    section_key: typeof row.section_key === 'string' ? row.section_key : '',
    section_type: typeof row.section_type === 'string' ? row.section_type as PlatformHomepageSection['section_type'] : 'custom_json',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 100,
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
    status: row.status === 'draft' || row.status === 'archived' || row.status === 'published' ? row.status : 'draft',
    subtitle: sanitizePublicPlatformText(row.subtitle, null),
    title: sanitizePublicPlatformText(row.title, null),
  };
}

function normalizePricingPlan(row: Record<string, unknown>): PlatformPricingPlan | null {
  if (!isPlatformPlanCode(row.plan_code)) return null;

  return {
    badge_text: typeof row.badge_text === 'string' ? row.badge_text : null,
    billing_cycle:
      row.billing_cycle === 'free' || row.billing_cycle === 'month' || row.billing_cycle === 'year' || row.billing_cycle === 'one_time'
        ? row.billing_cycle
        : row.plan_code === 'free'
          ? 'free'
          : 'month',
    bullet_items: normalizeJsonArray(row.bullet_items),
    compare_at_amount: typeof row.compare_at_amount === 'number' ? row.compare_at_amount : null,
    cta_action:
      row.cta_action === 'onboarding' || row.cta_action === 'checkout' || row.cta_action === 'contact' || row.cta_action === 'disabled'
        ? row.cta_action
        : row.plan_code === 'free'
          ? 'onboarding'
          : 'checkout',
    cta_href: typeof row.cta_href === 'string' ? row.cta_href : null,
    cta_label: typeof row.cta_label === 'string' ? row.cta_label : null,
    currency: 'KRW',
    discount_label: typeof row.discount_label === 'string' ? row.discount_label : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : row.plan_code.toUpperCase(),
    footnote: typeof row.footnote === 'string' ? row.footnote : null,
    id: typeof row.id === 'string' ? row.id : undefined,
    is_recommended: row.is_recommended === true,
    is_visible: row.is_visible !== false,
    plan_code: row.plan_code,
    price_amount: typeof row.price_amount === 'number' ? row.price_amount : 0,
    short_description: typeof row.short_description === 'string' ? row.short_description : null,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 100,
    status: row.status === 'draft' || row.status === 'archived' || row.status === 'published' ? row.status : 'draft',
  };
}

function normalizeBillingProduct(row: Record<string, unknown>): PlatformBillingProduct {
  return {
    amount: typeof row.amount === 'number' ? row.amount : 0,
    badge_text: typeof row.badge_text === 'string' ? row.badge_text : null,
    billing_cycle: typeof row.billing_cycle === 'string' ? row.billing_cycle : null,
    bullet_items: normalizeJsonArray(row.bullet_items),
    compare_at_amount: typeof row.compare_at_amount === 'number' ? row.compare_at_amount : null,
    currency: 'KRW',
    description: typeof row.description === 'string' ? row.description : null,
    discount_label: typeof row.discount_label === 'string' ? row.discount_label : null,
    grants_entitlement: row.grants_entitlement === true,
    id: typeof row.id === 'string' ? row.id : undefined,
    is_test_product: row.is_test_product === true,
    is_visible_public: row.is_visible_public === true,
    linked_plan_code: isPlatformPlanCode(row.linked_plan_code) ? row.linked_plan_code : null,
    metadata: toRecord(row.metadata),
    order_name: typeof row.order_name === 'string' ? row.order_name : null,
    product_code: typeof row.product_code === 'string' ? row.product_code : '',
    product_name: typeof row.product_name === 'string' ? row.product_name : '',
    product_type:
      row.product_type === 'subscription' || row.product_type === 'one_time' || row.product_type === 'test'
        ? row.product_type
        : 'one_time',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 100,
    status: row.status === 'draft' || row.status === 'archived' || row.status === 'published' ? row.status : 'draft',
    visible_only_in_env: typeof row.visible_only_in_env === 'string' ? row.visible_only_in_env : null,
    visible_only_with_query: typeof row.visible_only_with_query === 'string' ? row.visible_only_with_query : null,
  };
}

function normalizeAnnouncement(row: Record<string, unknown>): PlatformAnnouncement {
  return {
    audience: typeof row.audience === 'string' ? row.audience as PlatformAnnouncement['audience'] : 'all',
    body: sanitizePublicPlatformText(row.body, '') || '',
    category: sanitizePublicPlatformText(row.category, null),
    ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
    id: typeof row.id === 'string' ? row.id : undefined,
    is_pinned: row.is_pinned === true,
    is_published: row.is_published === true,
    link_href: typeof row.link_href === 'string' ? row.link_href : null,
    link_label: sanitizePublicPlatformText(row.link_label, null),
    severity: typeof row.severity === 'string' ? row.severity as PlatformAnnouncement['severity'] : 'info',
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
    summary: sanitizePublicPlatformText(row.summary, null),
    title: sanitizePublicPlatformText(row.title, '') || '',
  };
}

function normalizeBoardPost(row: Record<string, unknown>): PlatformBoardPost {
  return {
    body: sanitizePublicPlatformText(row.body, '') || '',
    category: sanitizePublicPlatformText(row.category, null),
    cover_image_url: typeof row.cover_image_url === 'string' ? row.cover_image_url : null,
    excerpt: sanitizePublicPlatformText(row.excerpt, null),
    id: typeof row.id === 'string' ? row.id : undefined,
    is_pinned: row.is_pinned === true,
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
    slug: typeof row.slug === 'string' ? row.slug : '',
    status: row.status === 'draft' || row.status === 'archived' || row.status === 'published' ? row.status : 'draft',
    tags: toStringArray(row.tags),
    title: sanitizePublicPlatformText(row.title, '') || '',
  };
}

function normalizePopup(row: Record<string, unknown>): PlatformPopup {
  return {
    audience: typeof row.audience === 'string' ? row.audience as PlatformPopup['audience'] : 'all',
    body: sanitizePublicPlatformText(row.body, null),
    cta_href: typeof row.cta_href === 'string' ? row.cta_href : null,
    cta_label: sanitizePublicPlatformText(row.cta_label, null),
    dismissible: row.dismissible !== false,
    ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
    exclude_paths: toStringArray(row.exclude_paths),
    frequency_policy:
      row.frequency_policy === 'always' || row.frequency_policy === 'once_per_day' || row.frequency_policy === 'once_per_session'
        ? row.frequency_policy
        : 'once_per_session',
    id: typeof row.id === 'string' ? row.id : undefined,
    image_url: typeof row.image_url === 'string' ? row.image_url : null,
    is_active: row.is_active === true,
    popup_key: typeof row.popup_key === 'string' ? row.popup_key : '',
    popup_type:
      row.popup_type === 'modal' || row.popup_type === 'banner' || row.popup_type === 'toast' || row.popup_type === 'bottom_sheet'
        ? row.popup_type
        : 'modal',
    priority: typeof row.priority === 'number' ? row.priority : 100,
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
    status: row.status === 'draft' || row.status === 'archived' || row.status === 'published' ? row.status : 'draft',
    target_paths: toStringArray(row.target_paths),
    title: sanitizePublicPlatformText(row.title, '') || '',
  };
}

function normalizeBanner(row: Record<string, unknown>): PlatformBanner {
  return {
    banner_key: typeof row.banner_key === 'string' ? row.banner_key : '',
    cta_href: typeof row.cta_href === 'string' ? row.cta_href : null,
    cta_label: sanitizePublicPlatformText(row.cta_label, null),
    ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
    id: typeof row.id === 'string' ? row.id : undefined,
    is_active: row.is_active === true,
    message: sanitizePublicPlatformText(row.message, '') || '',
    priority: typeof row.priority === 'number' ? row.priority : 100,
    severity: typeof row.severity === 'string' ? row.severity as PlatformBanner['severity'] : 'info',
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
    target_paths: toStringArray(row.target_paths),
  };
}

function normalizePublicPage(row: Record<string, unknown>): PlatformPublicPage {
  const slug = typeof row.slug === 'string' ? row.slug : '';
  const fallback = FALLBACK_PUBLIC_PAGES.find((page) => page.slug === slug) || FALLBACK_PUBLIC_PAGES[0];

  return {
    body: sanitizePublicPlatformText(row.body, fallback.body || null),
    cta_href: typeof row.cta_href === 'string' ? row.cta_href : fallback.cta_href,
    cta_label: sanitizePublicPlatformText(row.cta_label, fallback.cta_label || null),
    description: sanitizePublicPlatformText(row.description, fallback.description || null),
    hero_media_url: typeof row.hero_media_url === 'string' ? row.hero_media_url : null,
    is_published: row.is_published !== false,
    payload: toRecord(row.payload),
    seo_description: sanitizePublicPlatformText(row.seo_description, fallback.seo_description || null),
    seo_title: sanitizePublicPlatformText(row.seo_title, fallback.seo_title || null),
    slug,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : fallback.sort_order,
    title: sanitizePublicPlatformText(row.title, fallback.title) || fallback.title,
  };
}

function normalizeFaqItem(row: Record<string, unknown>): PlatformFaqItem {
  return {
    answer: sanitizePublicPlatformText(row.answer, '') || '',
    category: sanitizePublicPlatformText(row.category, null),
    is_published: row.is_published !== false,
    question: sanitizePublicPlatformText(row.question, '') || '',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 100,
  };
}

function normalizeTrustSignal(row: Record<string, unknown>): PlatformTrustSignal {
  return {
    body: sanitizePublicPlatformText(row.body, '') || '',
    icon_key: typeof row.icon_key === 'string' ? row.icon_key : null,
    is_visible: row.is_visible !== false,
    signal_key: typeof row.signal_key === 'string' ? row.signal_key : '',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 100,
    title: sanitizePublicPlatformText(row.title, '') || '',
  };
}

function normalizePaymentEvent(row: Record<string, unknown>): PlatformPaymentEvent {
  const raw = toRecord(row.raw || row.payload);
  return {
    amount: typeof row.amount === 'number' ? row.amount : typeof raw.amount === 'number' ? raw.amount : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : typeof row.processed_at === 'string' ? row.processed_at : null,
    currency: typeof row.currency === 'string' ? row.currency : typeof raw.currency === 'string' ? raw.currency : null,
    id: typeof row.id === 'string' ? row.id : typeof row.webhook_id === 'string' ? row.webhook_id : undefined,
    order_id: typeof row.order_id === 'string' ? row.order_id : typeof raw.order_id === 'string' ? raw.order_id : null,
    product_code: typeof row.product_code === 'string' ? row.product_code : typeof raw.productCode === 'string' ? raw.productCode : null,
    provider: typeof row.provider === 'string' ? row.provider : 'portone',
    provider_payment_id: typeof row.provider_payment_id === 'string' ? row.provider_payment_id : typeof row.payment_id === 'string' ? row.payment_id : null,
    purpose: typeof row.purpose === 'string' ? row.purpose : typeof raw.purpose === 'string' ? raw.purpose : null,
    raw,
    status: typeof row.status === 'string' ? row.status : typeof row.normalized_status === 'string' ? row.normalized_status : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

async function maybeSelectTable(table: string, select = '*') {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client.from(table).select(select);
    if (error) return null;
    return Array.isArray(data) ? data as unknown as Record<string, unknown>[] : [];
  } catch {
    return null;
  }
}

export async function listPlatformPricingPlansForServer() {
  const rows = await maybeSelectTable('platform_pricing_plans');
  if (!rows?.length) return FALLBACK_PRICING_PLANS;
  const normalized = rows.map(normalizePricingPlan).filter(Boolean) as PlatformPricingPlan[];
  return normalized.length ? normalized : FALLBACK_PRICING_PLANS;
}

export async function listPlatformBillingProductsForServer() {
  const rows = await maybeSelectTable('platform_billing_products');
  if (!rows?.length) return FALLBACK_BILLING_PRODUCTS;
  const normalized = rows.map(normalizeBillingProduct).filter((product) => product.product_code);
  return normalized.length ? normalized : FALLBACK_BILLING_PRODUCTS;
}

export async function getPublicPlatformHomepage() {
  const [settingsRows, sectionRows] = await Promise.all([
    maybeSelectTable('platform_site_settings'),
    maybeSelectTable('platform_homepage_sections'),
  ]);

  const settings = normalizeSiteSettings(settingsRows?.[0]);
  const sections = sectionRows?.length
    ? filterPublicHomepageSections(sectionRows.map(normalizeHomepageSection))
    : FALLBACK_HOMEPAGE_SECTIONS;

  return {
    settings,
    sections: sections.length ? sections : FALLBACK_HOMEPAGE_SECTIONS,
  };
}

export async function getPublicPlatformPricing(query: PlatformPublicQuery = {}) {
  const [plans, products] = await Promise.all([
    listPlatformPricingPlansForServer(),
    listPlatformBillingProductsForServer(),
  ]);

  return {
    plans: filterPublicPricingPlans(plans),
    testProducts: filterPublicBillingProducts({
      adminPreview: query.adminPreview,
      envEnabled: process.env.VITE_ENABLE_PAYMENT_TEST_PRODUCT === 'true',
      products,
      searchParams: query.searchParams,
    }),
  };
}

export async function getPublicPlatformAnnouncements() {
  const rows = await maybeSelectTable('platform_announcements');
  if (!rows?.length) return [];
  const now = new Date();
  return rows
    .map(normalizeAnnouncement)
    .filter((item) => item.is_published && isInSchedule(item, now))
    .sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned));
}

export async function getPublicPlatformBoardPosts() {
  const rows = await maybeSelectTable('platform_board_posts');
  if (!rows?.length) return [];
  return rows
    .map(normalizeBoardPost)
    .filter((item) => item.status === 'published')
    .sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned));
}

export async function getPublicPlatformPage(slug: string) {
  const [pageRows, faqRows, trustRows] = await Promise.all([
    maybeSelectTable('platform_pages'),
    maybeSelectTable('platform_faq_items'),
    maybeSelectTable('platform_trust_signals'),
  ]);
  const fallbackPage = FALLBACK_PUBLIC_PAGES.find((page) => page.slug === slug) || FALLBACK_PUBLIC_PAGES[0];
  const page = (pageRows || [])
    .map(normalizePublicPage)
    .find((item) => item.slug === slug && item.is_published) || fallbackPage;
  const faqItems = (faqRows?.length ? faqRows.map(normalizeFaqItem) : FALLBACK_FAQ_ITEMS)
    .filter((item) => item.is_published && item.question && item.answer)
    .sort((left, right) => left.sort_order - right.sort_order);
  const trustSignals = (trustRows?.length ? trustRows.map(normalizeTrustSignal) : FALLBACK_TRUST_SIGNALS)
    .filter((item) => item.is_visible && item.title && item.body)
    .sort((left, right) => left.sort_order - right.sort_order);

  return { faqItems, page, trustSignals };
}

export async function getPublicPlatformChrome(query: PlatformPublicQuery = {}) {
  const [popupRows, bannerRows] = await Promise.all([
    maybeSelectTable('platform_popups'),
    maybeSelectTable('platform_banners'),
  ]);
  const pathname = query.pathname || '/';
  const now = new Date();
  const popups = (popupRows || [])
    .map(normalizePopup)
    .filter((item) => item.status === 'published' && item.is_active)
    .filter((item) => isInSchedule(item, now) && pathMatchesTarget(item, pathname))
    .sort((left, right) => left.priority - right.priority);
  const banners = (bannerRows || [])
    .map(normalizeBanner)
    .filter((item) => item.is_active)
    .filter((item) => isInSchedule(item, now) && pathMatchesTarget(item, pathname))
    .sort((left, right) => left.priority - right.priority);

  return { banners, popups };
}

export async function resolveServerCatalogItem(input: { plan?: unknown; productCode?: unknown }) {
  const productCode = typeof input.productCode === 'string' ? input.productCode.trim() : '';

  if (productCode) {
    const products = await listPlatformBillingProductsForServer();
    const product = products.find((item) => item.product_code === productCode && item.status === 'published');
    if (!product) {
      throw new Error(`지원하지 않는 결제 상품입니다: ${productCode}`);
    }

    return {
      amount: product.amount,
      currency: product.currency,
      grantsEntitlement: product.grants_entitlement,
      orderName: product.order_name || product.product_name,
      plan: product.linked_plan_code,
      productCode: product.product_code,
      productType: product.product_type,
      purpose: typeof product.metadata.purpose === 'string' ? product.metadata.purpose : product.is_test_product ? 'payment_test' : undefined,
    };
  }

  if (!isPlatformPlanCode(input.plan)) {
    throw new Error('결제 요청은 free, pro, vip 중 하나의 plan이 필요합니다.');
  }

  if (input.plan === 'free') {
    throw new Error('FREE 플랜은 유료 결제를 호출하지 않고 /onboarding?plan=free로 이동해야 합니다.');
  }

  const plans = await listPlatformPricingPlansForServer();
  const plan = plans.find((item) => item.plan_code === input.plan && item.status === 'published');
  if (!plan) {
    throw new Error(`게시 중인 결제 플랜을 찾을 수 없습니다: ${input.plan}`);
  }

  return {
    amount: plan.price_amount,
    currency: plan.currency,
    grantsEntitlement: true,
    orderName: `${plan.display_name} 구독`,
    plan: plan.plan_code as PlatformPlanCode,
    productCode: `subscription_${plan.plan_code}`,
    productType: 'subscription' as const,
    purpose: 'subscription',
  };
}

export async function listPlatformPaymentEventsForServer() {
  const [paymentEvents, webhookEvents] = await Promise.all([
    maybeSelectTable('payment_events'),
    maybeSelectTable('billing_webhook_events'),
  ]);

  return [
    ...(paymentEvents || []).map(normalizePaymentEvent),
    ...(webhookEvents || []).map(normalizePaymentEvent),
  ].sort((left, right) => (right.created_at || '').localeCompare(left.created_at || ''));
}

export function isPaymentTestProductCode(value: unknown) {
  return value === PAYMENT_TEST_PRODUCT_CODE;
}
