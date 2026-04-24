import type { StoreMedia, StoreNotice, StorePublicPage } from '../types/models.js';

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildStorefrontLead(storeName: string, businessType?: string) {
  const normalizedBusinessType = normalizeText(businessType);
  return normalizedBusinessType ? `${storeName} ${normalizedBusinessType}` : storeName;
}

export function isBrokenPublicStoreText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  const compact = normalized.replace(/\s+/g, '');
  const placeholderCount = [...compact].filter((character) => character === '?' || character === '\uFFFD').length;
  if (placeholderCount >= Math.max(2, Math.ceil(compact.length / 2))) {
    return true;
  }

  const lower = normalized.toLowerCase();
  return (
    lower === 'demo' ||
    lower === 'test' ||
    lower === 'sample' ||
    lower === 'placeholder' ||
    lower.includes('운영 스토어') ||
    lower.includes('운영 데이터를 확인하는 스토어') ||
    lower.includes('placeholder') ||
    lower.includes('todo')
  );
}

function preferText(value: string | null | undefined, fallback: string) {
  return isBrokenPublicStoreText(value) ? fallback : normalizeText(value);
}

function preferOptionalText(value: string | null | undefined) {
  return isBrokenPublicStoreText(value) ? '' : normalizeText(value);
}

export function createPublicStoreCopyFallback(input: {
  storeName: string;
  businessType?: string;
}) {
  const lead = buildStorefrontLead(input.storeName, input.businessType);

  return {
    brandName: input.storeName,
    description: `${lead}의 메뉴, 문의, 예약, 웨이팅, 주문 안내를 한 번에 확인할 수 있습니다.`,
    heroDescription: `${lead} 방문 전에 필요한 메뉴와 이용 안내, 문의·예약·웨이팅·주문 시작 화면을 한곳에서 확인할 수 있습니다.`,
    heroSubtitle: `${lead}의 메뉴와 방문 안내를 먼저 확인해 보세요.`,
    heroTitle: input.storeName,
    mediaCaption: `${input.storeName} 대표 이미지`,
    mediaTitle: '대표 이미지',
    mobileCtaLabel: '바로 보기',
    noticeContent: `${lead} 방문 전에 필요한 매장 안내를 공지에서 확인해 주세요.`,
    noticeTitle: '매장 안내',
    primaryCtaLabel: '메뉴 보기',
    seoDescription: `${lead}의 메뉴와 방문 안내를 확인할 수 있는 공개 매장 페이지입니다.`,
    seoTitle: `${input.storeName} 공개 스토어`,
    tagline: `${lead}의 메뉴와 방문 안내를 먼저 확인해 보세요.`,
  };
}

export function repairPublicStorePageCopy(input: {
  businessType?: string;
  page: StorePublicPage;
  storeName: string;
}) {
  const fallback = createPublicStoreCopyFallback({
    businessType: input.businessType,
    storeName: input.storeName,
  });

  const nextNotices: StoreNotice[] = (input.page.notices || []).map((notice) => ({
    ...notice,
    content: preferText(notice.content, fallback.noticeContent),
    title: preferText(notice.title, fallback.noticeTitle),
  }));

  const nextMedia: StoreMedia[] = (input.page.media || []).map((media) => ({
    ...media,
    caption: preferText(media.caption, fallback.mediaCaption),
    title: preferText(media.title, fallback.mediaTitle),
  }));

  return {
    ...input.page,
    address: preferOptionalText(input.page.address),
    brand_name: preferText(input.page.brand_name, fallback.brandName),
    business_type: preferOptionalText(input.page.business_type),
    description: preferText(input.page.description, fallback.description),
    hero_description: preferText(input.page.hero_description, fallback.heroDescription),
    hero_subtitle: preferText(input.page.hero_subtitle, fallback.heroSubtitle),
    hero_title: preferText(input.page.hero_title, fallback.heroTitle),
    media: nextMedia,
    mobile_cta_label: preferText(input.page.mobile_cta_label, fallback.mobileCtaLabel),
    notices: nextNotices,
    primary_cta_label: preferText(input.page.primary_cta_label, fallback.primaryCtaLabel),
    seo_metadata: {
      ...input.page.seo_metadata,
      description: preferText(String(input.page.seo_metadata.description || ''), fallback.seoDescription),
      title: preferText(String(input.page.seo_metadata.title || ''), fallback.seoTitle),
    },
    tagline: preferText(input.page.tagline, fallback.tagline),
  } satisfies StorePublicPage;
}

export function repairStorefrontSummary(input: {
  businessType?: string;
  description?: string;
  storeName: string;
  tagline?: string;
}) {
  const fallback = createPublicStoreCopyFallback({
    businessType: input.businessType,
    storeName: input.storeName,
  });

  return {
    description: preferText(input.description, fallback.description),
    tagline: preferText(input.tagline, fallback.tagline),
  };
}
