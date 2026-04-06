import { createId } from '@/shared/lib/ids';
import { IS_LIVE_RUNTIME } from '@/shared/lib/appConfig';
import { requestPublicApi } from '@/shared/lib/publicApiClient';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import type { CanonicalMyBizRepository } from '@/shared/lib/repositories/contracts';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import type { Store, StoreFeature, StoreLocation, StoreMedia, StoreNotice, StorePublicPage, VisitorSession } from '@/shared/types/models';
import { assertStoreEntitlement, getStoreEntitlements } from '@/shared/lib/services/storeEntitlementsService';

function nowIso() {
  return new Date().toISOString();
}

type PublicPageServiceOptions = {
  repository?: CanonicalMyBizRepository;
};

export interface StorePublicPageUpsertInput {
  storeName: string;
  slug: string;
  businessType: string;
  phone: string;
  email: string;
  address: string;
  publicStatus: Store['public_status'];
  homepageVisible: boolean;
  consultationEnabled: boolean;
  inquiryEnabled: boolean;
  reservationEnabled: boolean;
  orderEntryEnabled: boolean;
  logoUrl: string;
  brandColor: string;
  tagline: string;
  description: string;
  openingHours: string;
  directions: string;
  parkingNote: string;
  heroImageUrl: string;
  storefrontImageUrl: string;
  interiorImageUrl: string;
  noticeTitle: string;
  noticeContent: string;
  themePreset?: Store['theme_preset'];
  previewTarget?: Store['preview_target'];
  primaryCtaLabel?: string;
  mobileCtaLabel?: string;
}

export interface PublicPageCapabilities {
  homepageVisible: boolean;
  consultationEnabled: boolean;
  inquiryEnabled: boolean;
  reservationEnabled: boolean;
  orderEntryEnabled: boolean;
}

function hasEnabledFeature(features: StoreFeature[] | undefined, key: StoreFeature['feature_key']) {
  return (features || []).some((feature) => feature.feature_key === key && feature.enabled);
}

function buildMedia(storeId: string, input: StorePublicPageUpsertInput, timestamp: string): StoreMedia[] {
  return [
    {
      id: createId('store_media'),
      store_id: storeId,
      type: 'hero' as const,
      title: '대표 이미지',
      image_url: input.heroImageUrl.trim(),
      caption: `${input.storeName.trim()} 대표 이미지`,
      sort_order: 1,
    },
    {
      id: createId('store_media'),
      store_id: storeId,
      type: 'storefront' as const,
      title: '매장 외관',
      image_url: input.storefrontImageUrl.trim(),
      caption: `${input.storeName.trim()} 매장 외관`,
      sort_order: 2,
    },
    {
      id: createId('store_media'),
      store_id: storeId,
      type: 'interior' as const,
      title: '매장 내부',
      image_url: input.interiorImageUrl.trim(),
      caption: `${input.storeName.trim()} 매장 내부`,
      sort_order: 3,
    },
  ].filter((media) => Boolean(media.image_url));
}

function buildNotices(storeId: string, input: StorePublicPageUpsertInput, timestamp: string): StoreNotice[] {
  if (!input.noticeTitle.trim() && !input.noticeContent.trim()) {
    return [];
  }

  return [
    {
      id: createId('store_notice'),
      store_id: storeId,
      title: input.noticeTitle.trim(),
      content: input.noticeContent.trim(),
      is_pinned: true,
      published_at: timestamp,
    },
  ];
}

export function buildDefaultStorePublicPage(input: {
  store: Store;
  features?: StoreFeature[];
  location?: StoreLocation | null;
  media?: StoreMedia[];
  notices?: StoreNotice[];
}): StorePublicPage {
  const timestamp = input.store.updated_at || input.store.created_at;
  const brandConfig = getStoreBrandConfig(input.store);
  const media = (input.media || []).filter((item) => item.store_id === input.store.id);
  const notices = (input.notices || []).filter((item) => item.store_id === input.store.id);

  return {
    id: createId('store_public_page'),
    store_id: input.store.id,
    slug: input.store.slug,
    brand_name: input.store.name,
    logo_url: input.store.logo_url,
    brand_color: input.store.brand_color,
    tagline: input.store.tagline,
    description: input.store.description,
    business_type: brandConfig.business_type,
    phone: brandConfig.phone,
    email: brandConfig.email,
    address: brandConfig.address,
    directions: input.location?.directions || '',
    opening_hours: input.location?.opening_hours,
    parking_note: input.location?.parking_note,
    public_status: input.store.public_status,
    homepage_visible: input.store.homepage_visible ?? input.store.public_status === 'public',
    consultation_enabled: input.store.consultation_enabled ?? true,
    inquiry_enabled: input.store.inquiry_enabled ?? true,
    reservation_enabled: input.store.reservation_enabled ?? hasEnabledFeature(input.features, 'reservation_management'),
    order_entry_enabled:
      input.store.order_entry_enabled ??
      (hasEnabledFeature(input.features, 'table_order') || hasEnabledFeature(input.features, 'order_management')),
    theme_preset: input.store.theme_preset,
    preview_target: input.store.preview_target,
    hero_title: input.store.name,
    hero_subtitle: input.store.tagline,
    hero_description: input.store.description,
    primary_cta_label: input.store.primary_cta_label,
    mobile_cta_label: input.store.mobile_cta_label,
    cta_config: {},
    content_blocks: [],
    seo_metadata: {
      description: input.store.description,
      title: input.store.name,
    },
    media,
    notices,
    created_at: input.store.created_at,
    updated_at: timestamp,
  };
}

export async function getCanonicalStorePublicPage(storeId: string, options?: PublicPageServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  return repository.getStorePublicPage(storeId);
}

export async function getCanonicalStorePublicPageBySlug(slug: string, options?: PublicPageServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  return repository.getStorePublicPageBySlug(slug);
}

export async function saveCanonicalStorePublicPage(
  store: Store,
  input: StorePublicPageUpsertInput,
  currentPage?: StorePublicPage | null,
  options?: PublicPageServiceOptions,
) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const timestamp = nowIso();

  const nextPage: StorePublicPage = {
    id: currentPage?.id || createId('store_public_page'),
    store_id: store.id,
    slug: input.slug.trim(),
    brand_name: input.storeName.trim(),
    logo_url: input.logoUrl.trim() || undefined,
    brand_color: input.brandColor.trim() || store.brand_color,
    tagline: input.tagline.trim(),
    description: input.description.trim(),
    business_type: input.businessType.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    directions: input.directions.trim(),
    opening_hours: input.openingHours.trim() || undefined,
    parking_note: input.parkingNote.trim() || undefined,
    public_status: input.publicStatus,
    homepage_visible: input.homepageVisible,
    consultation_enabled: input.consultationEnabled,
    inquiry_enabled: input.inquiryEnabled,
    reservation_enabled: input.reservationEnabled,
    order_entry_enabled: input.orderEntryEnabled,
    theme_preset: input.themePreset || store.theme_preset,
    preview_target: input.previewTarget || store.preview_target,
    hero_title: input.storeName.trim(),
    hero_subtitle: input.tagline.trim(),
    hero_description: input.description.trim(),
    primary_cta_label: input.primaryCtaLabel?.trim() || store.primary_cta_label,
    mobile_cta_label: input.mobileCtaLabel?.trim() || store.mobile_cta_label,
    cta_config: {
      consultationEnabled: input.consultationEnabled,
      inquiryEnabled: input.inquiryEnabled,
      orderEntryEnabled: input.orderEntryEnabled,
      reservationEnabled: input.reservationEnabled,
    },
    content_blocks: [],
    seo_metadata: {
      description: input.description.trim(),
      title: input.storeName.trim(),
    },
    media: buildMedia(store.id, input, timestamp),
    notices: buildNotices(store.id, input, timestamp),
    created_at: currentPage?.created_at || timestamp,
    updated_at: timestamp,
  };

  return repository.saveStorePublicPage(nextPage);
}

export async function resolvePublicPageCapabilities(
  storeId: string,
  page: StorePublicPage,
  options?: PublicPageServiceOptions,
): Promise<PublicPageCapabilities> {
  const { entitlements } = await getStoreEntitlements(storeId, { repository: options?.repository });

  return {
    homepageVisible: entitlements.public_store_page && page.homepage_visible && page.public_status === 'public',
    consultationEnabled: entitlements.public_store_page && page.consultation_enabled,
    inquiryEnabled: entitlements.public_inquiry && page.inquiry_enabled,
    reservationEnabled: entitlements.reservations && page.reservation_enabled,
    orderEntryEnabled: entitlements.public_store_page && page.order_entry_enabled,
  };
}

export interface TouchVisitorSessionInput {
  storeId: string;
  publicPageId?: string;
  visitorToken: string;
  channel: VisitorSession['channel'];
  path: string;
  firstSeenAt?: string;
  referrer?: string;
  sessionId?: string;
  customerId?: string;
  inquiryId?: string;
  reservationId?: string;
  waitingEntryId?: string;
  metadata?: VisitorSession['metadata'];
}

export async function touchVisitorSession(input: TouchVisitorSessionInput, options?: PublicPageServiceOptions) {
  if (!options?.repository && IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<VisitorSession>('/api/public/visitor-session', {
      body: input,
      method: 'POST',
    });
  }

  await assertStoreEntitlement(input.storeId, 'public_store_page', undefined, { repository: options?.repository });
  const repository = options?.repository || getCanonicalMyBizRepository();
  const timestamp = nowIso();
  let existing: VisitorSession | null = null;

  if (input.sessionId) {
    try {
      const existingSessions = await repository.listVisitorSessions(input.storeId, input.visitorToken);
      existing = existingSessions.find((session) => session.id === input.sessionId) || null;
    } catch {
      existing = null;
    }
  }

  const nextSession: VisitorSession = {
    id: input.sessionId || existing?.id || createId('visitor_session'),
    store_id: input.storeId,
    public_page_id: input.publicPageId || existing?.public_page_id,
    customer_id: input.customerId || existing?.customer_id,
    inquiry_id: input.inquiryId || existing?.inquiry_id,
    reservation_id: input.reservationId || existing?.reservation_id,
    waiting_entry_id: input.waitingEntryId || existing?.waiting_entry_id,
    visitor_token: input.visitorToken,
    channel: input.channel,
    entry_path: existing?.entry_path || input.path,
    last_path: input.path,
    referrer: input.referrer || existing?.referrer,
    metadata: {
      ...(existing?.metadata || {}),
      ...(input.metadata || {}),
    },
    first_seen_at: input.firstSeenAt || existing?.first_seen_at || timestamp,
    last_seen_at: timestamp,
    created_at: input.firstSeenAt || existing?.created_at || timestamp,
    updated_at: timestamp,
  };

  return repository.saveVisitorSession(nextSession);
}
