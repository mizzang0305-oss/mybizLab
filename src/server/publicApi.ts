import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminClient } from './supabaseAdmin.js';
import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import { buildPublicInquirySummary, getPublicInquiryFormSnapshot, submitCanonicalPublicInquiry } from '../shared/lib/services/inquiryService.js';
import {
  buildDefaultStorePublicPage,
  getCanonicalStorePublicPage,
  resolvePublicPageCapabilities,
  touchVisitorSession,
} from '../shared/lib/services/publicPageService.js';
import { saveStoreReservation } from '../shared/lib/services/reservationService.js';
import { saveStoreWaitingEntry } from '../shared/lib/services/waitingService.js';
import { getStoreBrandConfig, getStoreRecordId, normalizeStoreRecord } from '../shared/lib/storeData.js';
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
  StoreTable,
  Survey,
  SurveyResponse,
} from '../shared/types/models.js';

function responseJson(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

type PublicApiRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: unknown;
      method?: string;
      rawBody?: unknown;
      text?: () => Promise<string>;
      url?: string;
    };

function isRequestWithText(request: PublicApiRequestLike): request is Request | { text: () => Promise<string> } {
  return typeof request === 'object' && request !== null && typeof request.text === 'function';
}

function isArrayBufferView(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value);
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getHeaderValue(headers: unknown, key: string) {
  if (headers instanceof Headers) {
    return headers.get(key) || undefined;
  }

  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const match = Object.entries(headers as Record<string, unknown>).find(
    ([candidate]) => candidate.toLowerCase() === key.toLowerCase(),
  )?.[1];

  if (typeof match === 'string') {
    return match;
  }

  if (Array.isArray(match) && typeof match[0] === 'string') {
    return match[0];
  }

  return undefined;
}

async function readRequestBodyText(request: PublicApiRequestLike) {
  if (isRequestWithText(request)) {
    return request.text();
  }

  const rawBody =
    typeof request === 'object' && request !== null && 'rawBody' in request && request.rawBody !== undefined
      ? request.rawBody
      : typeof request === 'object' && request !== null && 'body' in request
        ? request.body
        : undefined;

  if (rawBody === undefined || rawBody === null) {
    return '';
  }

  if (typeof rawBody === 'string') {
    return rawBody;
  }

  if (Buffer.isBuffer(rawBody)) {
    return rawBody.toString('utf8');
  }

  if (rawBody instanceof ArrayBuffer) {
    return Buffer.from(rawBody).toString('utf8');
  }

  if (isArrayBufferView(rawBody)) {
    return Buffer.from(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength).toString('utf8');
  }

  if (isPlainObject(rawBody)) {
    return JSON.stringify(rawBody);
  }

  if (isAsyncIterable(rawBody)) {
    const chunks: Uint8Array[] = [];

    for await (const chunk of rawBody) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
        continue;
      }

      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        continue;
      }

      if (chunk instanceof ArrayBuffer) {
        chunks.push(Buffer.from(chunk));
        continue;
      }

      if (isArrayBufferView(chunk)) {
        chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      }
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  return String(rawBody);
}

async function parseJsonBody<T>(request: PublicApiRequestLike) {
  const rawBody = await readRequestBodyText(request);

  if (!rawBody.trim()) {
    throw new Error('Request body is required.');
  }

  return JSON.parse(rawBody) as T;
}

function getRequestUrl(request: PublicApiRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';

  if (/^https?:\/\//i.test(rawUrl)) {
    return new URL(rawUrl);
  }

  const protocol = getHeaderValue(request.headers, 'x-forwarded-proto') || 'https';
  const host =
    getHeaderValue(request.headers, 'x-forwarded-host') ||
    getHeaderValue(request.headers, 'host') ||
    'localhost';

  return new URL(rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`, `${protocol}://${host}`);
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
  const storeId = getStoreRecordId(store);

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
    repository.getStorePublicPage(storeId),
    selectOptionalList<StoreFeature>(client, 'store_features', storeId),
    selectOptionalList<StoreLocation>(client, 'store_locations', storeId),
    selectOptionalList<StoreMedia>(client, 'store_media', storeId, { column: 'sort_order', ascending: true }),
    selectOptionalList<StoreNotice>(client, 'store_notices', storeId, { column: 'published_at', ascending: false }),
    selectOptionalList<StoreTable>(client, 'store_tables', storeId, { column: 'table_no', ascending: true }),
    selectOptionalList<MenuCategory>(client, 'menu_categories', storeId, { column: 'sort_order', ascending: true }),
    selectOptionalList<MenuItem>(client, 'menu_items', storeId, { column: 'name', ascending: true }),
    selectOptionalList<Survey>(client, 'surveys', storeId),
    selectOptionalList<SurveyResponse>(client, 'survey_responses', storeId),
    repository.listInquiries(storeId),
    selectOptionalList<Order>(client, 'orders', storeId),
    selectOptionalList<OrderItem>(client, 'order_items', storeId),
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
      id: primaryLocation?.id || `store_public_location_${storeId}`,
      store_id: storeId,
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

export async function handlePublicStoreRequest(request: PublicApiRequestLike) {
  try {
    const url = getRequestUrl(request);
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

export async function handlePublicInquiryFormRequest(request: PublicApiRequestLike) {
  try {
    const url = getRequestUrl(request);
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

export async function handlePublicVisitorSessionRequest(request: PublicApiRequestLike) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<Parameters<typeof touchVisitorSession>[0]>(request);
    const session = await touchVisitorSession(body, { repository });
    return responseJson({ ok: true, data: session });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

export async function handlePublicInquiryRequest(request: PublicApiRequestLike) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<Parameters<typeof submitCanonicalPublicInquiry>[0]>(request);
    const result = await submitCanonicalPublicInquiry(body, { repository });
    return responseJson({ ok: true, data: result });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

export async function handlePublicReservationRequest(request: PublicApiRequestLike) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<{
      customerName: string;
      note?: string;
      partySize: number;
      phone: string;
      reservedAt: string;
      storeId: string;
      visitorSessionId?: string;
    }>(request);

    if (!body.storeId) {
      return createPublicApiErrorResponse(new Error('storeId is required.'), 400);
    }

    const publicPage = await getCanonicalStorePublicPage(body.storeId, { repository });
    if (!publicPage) {
      return createPublicApiErrorResponse(new Error('Reservation is not available for this store.'), 404);
    }

    const capabilities = await resolvePublicPageCapabilities(body.storeId, publicPage, { repository });
    if (!capabilities.reservationEnabled) {
      return createPublicApiErrorResponse(new Error('Reservation is not enabled for this store.'), 403);
    }

    const reservation = await saveStoreReservation(
      body.storeId,
      {
        customer_name: body.customerName,
        note: body.note?.trim() || undefined,
        party_size: body.partySize,
        phone: body.phone,
        reserved_at: body.reservedAt,
        status: 'booked',
        visitor_session_id: body.visitorSessionId,
      },
      { repository },
    );

    return responseJson({
      ok: true,
      data: {
        reservation,
        visitorSessionId: body.visitorSessionId,
      },
    });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

export async function handlePublicWaitingRequest(request: PublicApiRequestLike) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<{
      customerName: string;
      partySize: number;
      phone: string;
      quotedWaitMinutes?: number;
      storeId: string;
      visitorSessionId?: string;
    }>(request);

    if (!body.storeId) {
      return createPublicApiErrorResponse(new Error('storeId is required.'), 400);
    }

    const publicPage = await getCanonicalStorePublicPage(body.storeId, { repository });
    if (!publicPage) {
      return createPublicApiErrorResponse(new Error('Waiting is not available for this store.'), 404);
    }

    const waitingEntry = await saveStoreWaitingEntry(
      body.storeId,
      {
        customer_name: body.customerName,
        party_size: body.partySize,
        phone: body.phone,
        quoted_wait_minutes: body.quotedWaitMinutes ?? 0,
        status: 'waiting',
        visitor_session_id: body.visitorSessionId,
      },
      { repository },
    );

    return responseJson({
      ok: true,
      data: {
        visitorSessionId: body.visitorSessionId,
        waitingEntry,
      },
    });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}
