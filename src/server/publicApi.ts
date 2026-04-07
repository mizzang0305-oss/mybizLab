import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminClient } from '@/server/supabaseAdmin';
import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';
import { buildPublicInquirySummary, getPublicInquiryFormSnapshot, submitCanonicalPublicInquiry } from '@/shared/lib/services/inquiryService';
import {
  buildDefaultStorePublicPage,
  resolvePublicPageCapabilities,
  touchVisitorSession,
} from '@/shared/lib/services/publicPageService';
import { getStoreBrandConfig, normalizeStoreRecord } from '@/shared/lib/storeData';
import type {
  Inquiry,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  Store,
  StoreFeature,
  StoreLocation,
  StoreMedia,
  StoreNotice,
  StorePublicPage,
  StoreTable,
  Survey,
  SurveyResponse,
  VisitorSession,
} from '@/shared/types/models';

function responseJson(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function parseJsonBody<T>(request: Request) {
  return request.json() as Promise<T>;
}

function createPublicApiErrorResponse(error: unknown, status = 500) {
  return responseJson(
    {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown public API error',
    },
    status,
  );
}

function sortMedia(media: StoreMedia[]) {
  return media.slice().sort((left, right) => left.sort_order - right.sort_order);
}

function sortNotices(notices: StoreNotice[]) {
  return notices
    .filter((notice) => Boolean(notice.published_at))
    .slice()
    .sort((left, right) => right.published_at.localeCompare(left.published_at));
}

function getPrimaryLocation(locations: StoreLocation[]) {
  return locations[0] || null;
}

function startOfDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isWithinRange(value: string | undefined, from: Date, to: Date) {
  if (!value) {
    return false;
  }

  const target = new Date(value).getTime();
  return target >= from.getTime() && target <= to.getTime();
}

function normalizeMenuItems(menuItems: MenuItem[]) {
  return menuItems
    .filter((item) => item.is_active)
    .map((item) => ({
      ...item,
      price: Number(item.price),
    }));
}

function selectMenuHighlights(menuItems: MenuItem[], orderItems: OrderItem[], orders: Order[], mode: 'today' | 'weekly') {
  const now = new Date();
  const from = mode === 'today' ? startOfDay(now) : startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const targetOrderIds = new Set(
    orders
      .filter((order) => isWithinRange(order.completed_at || order.placed_at, from, now))
      .map((order) => order.id),
  );
  const scores = new Map<string, number>();

  orderItems.forEach((item) => {
    if (!targetOrderIds.has(item.order_id)) {
      return;
    }

    scores.set(item.menu_item_id, (scores.get(item.menu_item_id) || 0) + Number(item.quantity || 0));
  });

  const ranked = Array.from(scores.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([menuItemId]) => menuItems.find((item) => item.id === menuItemId))
    .filter((item): item is MenuItem => Boolean(item));

  if (ranked.length >= 3) {
    return ranked.slice(0, 3);
  }

  const fallback = menuItems.filter((item) => item.is_popular);
  const combined = [...ranked];

  [...fallback, ...menuItems].forEach((item) => {
    if (combined.some((entry) => entry.id === item.id)) {
      return;
    }

    combined.push(item);
  });

  return combined.slice(0, 3);
}

function buildSurveySummary(activeSurvey: Survey | null, responses: SurveyResponse[]) {
  if (!activeSurvey) {
    return null;
  }

  const surveyResponses = responses.filter((response) => response.survey_id === activeSurvey.id);
  const averageRating = surveyResponses.length
    ? Number(
        (
          surveyResponses.reduce((total, response) => total + Number(response.rating || 0), 0) /
          surveyResponses.length
        ).toFixed(1),
      )
    : 0;

  return {
    survey: activeSurvey,
    responseCount: surveyResponses.length,
    averageRating,
  };
}

function buildPublicExperience(store: Store, notices: StoreNotice[]) {
  const source = `${store.slug} ${store.name} ${store.business_type || ''}`.toLowerCase();
  const latestNotice = notices[0];

  if (source.includes('bbq') || source.includes('izakaya') || source.includes('pub') || source.includes('bar')) {
    return {
      eyebrow: '저녁 피크 대응형 공개 스토어',
      todayLabel: '오늘 추천 세트',
      weeklyLabel: '이번 주 반응 메뉴',
      surveyLabel: '고객 만족도 체크',
      inquiryLabel: '단체 예약/문의',
      eventTitle: latestNotice?.title || '오늘 저녁 운영 안내',
      eventDescription:
        latestNotice?.content || '저녁 피크 시간 운영 방식과 문의 동선을 먼저 보여주는 공개 스토어입니다.',
    };
  }

  if (source.includes('buffet')) {
    return {
      eyebrow: '방문 경험 중심 공개 스토어',
      todayLabel: '오늘 인기 메뉴',
      weeklyLabel: '이번 주 만족 메뉴',
      surveyLabel: '방문 만족도 남기기',
      inquiryLabel: '단체 방문 문의',
      eventTitle: latestNotice?.title || '오늘 운영 공지',
      eventDescription: latestNotice?.content || '대기와 방문 흐름을 쉽게 이해할 수 있게 정리한 공개 스토어입니다.',
    };
  }

  if (source.includes('coffee') || source.includes('cafe')) {
    return {
      eyebrow: '메뉴 반응형 공개 스토어',
      todayLabel: '오늘 많이 찾는 메뉴',
      weeklyLabel: '이번 주 시그니처',
      surveyLabel: '방문 후기 남기기',
      inquiryLabel: '매장/브랜드 문의',
      eventTitle: latestNotice?.title || '이번 주 스토어 소식',
      eventDescription: latestNotice?.content || '대표 메뉴와 브랜드 분위기를 함께 보여주는 공개 스토어입니다.',
    };
  }

  return {
    eyebrow: '점주 이해 중심 공개 스토어',
    todayLabel: '오늘 추천 메뉴',
    weeklyLabel: '이번 주 인기 메뉴',
    surveyLabel: '고객 의견 남기기',
    inquiryLabel: '문의 남기기',
    eventTitle: latestNotice?.title || '이번 주 안내',
    eventDescription: latestNotice?.content || '매장 소개와 문의 동선을 간단하게 보여주는 공개 스토어입니다.',
  };
}

async function selectOptionalList<T>(
  client: SupabaseClient,
  table: string,
  storeId: string,
  orderBy?: { column: string; ascending?: boolean },
) {
  try {
    let query = client.from(table).select('*').eq('store_id', storeId);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    const { data, error } = await query;
    if (error) {
      return [] as T[];
    }

    return (data || []) as T[];
  } catch {
    return [] as T[];
  }
}

async function buildPublicStoreSnapshot(input: { slug?: string; storeId?: string }) {
  const client = getSupabaseAdminClient();
  const repository = createSupabaseRepository(client);
  const store = input.storeId ? await repository.findStoreById(input.storeId) : await repository.findStoreBySlug(input.slug || '');

  if (!store) {
    return null;
  }

  const [
    page,
    features,
    locations,
    media,
    notices,
    tables,
    menuCategories,
    rawMenuItems,
    surveys,
    surveyResponses,
    inquiries,
    orders,
    orderItems,
  ] = await Promise.all([
    repository.getStorePublicPage(store.id),
    selectOptionalList<StoreFeature>(client, 'store_features', store.id),
    selectOptionalList<StoreLocation>(client, 'store_locations', store.id),
    selectOptionalList<StoreMedia>(client, 'store_media', store.id, { column: 'sort_order', ascending: true }),
    selectOptionalList<StoreNotice>(client, 'store_notices', store.id, { column: 'published_at', ascending: false }),
    selectOptionalList<StoreTable>(client, 'store_tables', store.id, { column: 'table_no', ascending: true }),
    selectOptionalList<MenuCategory>(client, 'menu_categories', store.id, { column: 'sort_order', ascending: true }),
    selectOptionalList<MenuItem>(client, 'menu_items', store.id, { column: 'name', ascending: true }),
    selectOptionalList<Survey>(client, 'surveys', store.id),
    selectOptionalList<SurveyResponse>(client, 'survey_responses', store.id),
    repository.listInquiries(store.id),
    selectOptionalList<Order>(client, 'orders', store.id),
    selectOptionalList<OrderItem>(client, 'order_items', store.id),
  ]);

  const sortedMedia = sortMedia(media);
  const publishedNotices = sortNotices(notices);
  const primaryLocation = getPrimaryLocation(locations);
  const canonicalPage =
    page ||
    buildDefaultStorePublicPage({
      store,
      features,
      location: primaryLocation,
      media: sortedMedia,
      notices: publishedNotices,
    });
  const capabilities = await resolvePublicPageCapabilities(store.id, canonicalPage, { repository });
  const publicStoreRecord = normalizeStoreRecord({
    ...store,
    slug: canonicalPage.slug,
    logo_url: canonicalPage.logo_url || store.logo_url,
    brand_color: canonicalPage.brand_color,
    tagline: canonicalPage.tagline,
    description: canonicalPage.description,
    business_type: canonicalPage.business_type,
    phone: canonicalPage.phone,
    email: canonicalPage.email,
    address: canonicalPage.address,
    public_status: canonicalPage.public_status,
    homepage_visible: canonicalPage.homepage_visible,
    consultation_enabled: canonicalPage.consultation_enabled,
    inquiry_enabled: canonicalPage.inquiry_enabled,
    reservation_enabled: canonicalPage.reservation_enabled,
    order_entry_enabled: canonicalPage.order_entry_enabled,
    primary_cta_label: canonicalPage.primary_cta_label,
    mobile_cta_label: canonicalPage.mobile_cta_label,
    preview_target: canonicalPage.preview_target,
    theme_preset: canonicalPage.theme_preset,
    brand_config: {
      ...getStoreBrandConfig(store),
      address: canonicalPage.address,
      business_type: canonicalPage.business_type || getStoreBrandConfig(store).business_type,
      email: canonicalPage.email,
      phone: canonicalPage.phone,
    },
  });
  const menuItems = normalizeMenuItems(rawMenuItems);
  const activeSurvey = surveys.find((survey) => survey.is_active) || surveys[0] || null;
  const surveySummary = buildSurveySummary(activeSurvey, surveyResponses);
  const inquirySummary = buildPublicInquirySummary(inquiries as Inquiry[]);
  const experience = buildPublicExperience(publicStoreRecord, sortNotices(canonicalPage.notices));

  return {
    store: publicStoreRecord,
    publicPageId: canonicalPage.id,
    menu: {
      categories: menuCategories.slice().sort((left, right) => left.sort_order - right.sort_order),
      items: menuItems,
    },
    tables: tables.filter((table) => table.is_active),
    location: {
      id: primaryLocation?.id || `store_public_location_${store.id}`,
      store_id: store.id,
      address: canonicalPage.address,
      directions: canonicalPage.directions,
      parking_note: canonicalPage.parking_note,
      opening_hours: canonicalPage.opening_hours,
      published: canonicalPage.homepage_visible,
    },
    media: sortMedia((canonicalPage.media || []) as StoreMedia[]),
    notices: sortNotices((canonicalPage.notices || []) as StoreNotice[]),
    capabilities,
    features: features.filter((feature) => feature.enabled),
    menuHighlights: {
      today: selectMenuHighlights(menuItems, orderItems, orders, 'today'),
      weekly: selectMenuHighlights(menuItems, orderItems, orders, 'weekly'),
    },
    surveySummary,
    inquirySummary,
    experience,
  };
}

export async function handlePublicStoreRequest(request: Request) {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId') || undefined;
    const slug = url.searchParams.get('slug') || undefined;

    if (!storeId && !slug) {
      return createPublicApiErrorResponse(new Error('storeId or slug is required.'), 400);
    }

    const snapshot = await buildPublicStoreSnapshot({ slug, storeId });
    if (!snapshot) {
      return createPublicApiErrorResponse(new Error('Public store could not be found.'), 404);
    }

    return responseJson({ ok: true, data: snapshot });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

export async function handlePublicInquiryFormRequest(request: Request) {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId');

    if (!storeId) {
      return createPublicApiErrorResponse(new Error('storeId is required.'), 400);
    }

    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const snapshot = await getPublicInquiryFormSnapshot(storeId, { repository });
    if (!snapshot) {
      return createPublicApiErrorResponse(new Error('Inquiry form could not be found for this store.'), 404);
    }

    return responseJson({ ok: true, data: snapshot });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

export async function handlePublicVisitorSessionRequest(request: Request) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<Parameters<typeof touchVisitorSession>[0]>(request);
    const session = await touchVisitorSession(body, { repository });
    return responseJson({ ok: true, data: session });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

export async function handlePublicInquiryRequest(request: Request) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<Parameters<typeof submitCanonicalPublicInquiry>[0]>(request);
    const result = await submitCanonicalPublicInquiry(body, { repository });
    return responseJson({ ok: true, data: result });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}
