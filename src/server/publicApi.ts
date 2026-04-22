import type { SupabaseClient } from '@supabase/supabase-js';

import { sanitizeCheckoutCustomData } from '../shared/lib/checkoutCustomData.js';
import {
  BillingApiStageError,
  callPortOneApi,
  validateBillingEnv,
} from './billingApiRuntime.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';
import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import { buildPublicInquirySummary, getPublicInquiryFormSnapshot, submitCanonicalPublicInquiry } from '../shared/lib/services/inquiryService.js';
import {
  getPublicConsultationSnapshot,
  submitPublicConsultationMessage,
} from '../shared/lib/services/consultationService.js';
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
  KitchenTicket,
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

const PUBLIC_ORDER_CHECKOUT_ENDPOINT = '/api/public/order-payment-checkout';
const PUBLIC_ORDER_PAYMENT_VERIFY_ENDPOINT = '/api/public/order-payment-verify';
const PUBLIC_ORDER_PAYMENT_ID_MAX_LENGTH = 40;

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return fallback;
}

function normalizeNumeric(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function createPublicOrderPaymentId() {
  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const paymentId = `mb_ord_${shortId}`;

  if (paymentId.length > PUBLIC_ORDER_PAYMENT_ID_MAX_LENGTH) {
    throw new Error('Failed to generate a safe payment id for public order checkout.');
  }

  return paymentId;
}

function mapOrderRecord(row: Record<string, unknown>): Order {
  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id) || undefined,
    table_id: normalizeText(row.table_id) || undefined,
    table_no: normalizeText(row.table_no) || undefined,
    channel: (normalizeText(row.channel) || 'walk_in') as Order['channel'],
    status: (normalizeText(row.status) || 'pending') as Order['status'],
    payment_status: (normalizeText(row.payment_status) || 'pending') as Order['payment_status'],
    payment_source: (normalizeText(row.payment_source) || undefined) as Order['payment_source'],
    payment_method: (normalizeText(row.payment_method) || undefined) as Order['payment_method'],
    payment_recorded_at: normalizeText(row.payment_recorded_at) || undefined,
    total_amount: normalizeNumeric(row.total_amount),
    placed_at: normalizeText(row.placed_at),
    completed_at: normalizeText(row.completed_at) || undefined,
    note: normalizeText(row.note) || undefined,
  };
}

function mapOrderItemRecord(row: Record<string, unknown>): OrderItem {
  return {
    id: normalizeText(row.id),
    order_id: normalizeText(row.order_id),
    store_id: normalizeText(row.store_id),
    menu_item_id: normalizeText(row.menu_item_id),
    menu_name: normalizeText(row.menu_name),
    quantity: normalizeInteger(row.quantity, 1),
    unit_price: normalizeNumeric(row.unit_price),
    line_total: normalizeNumeric(row.line_total),
  };
}

function mapKitchenTicketRecord(row: Record<string, unknown>): KitchenTicket {
  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    order_id: normalizeText(row.order_id),
    table_id: normalizeText(row.table_id) || undefined,
    table_no: normalizeText(row.table_no) || undefined,
    status: (normalizeText(row.status) || 'pending') as KitchenTicket['status'],
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
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

function inferPublicApiErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (/invalid input syntax for type uuid/i.test(error.message)) {
    return 400;
  }

  if (/could not be found|not available for this store/i.test(error.message)) {
    return 404;
  }

  return 500;
}

function createPublicApiErrorResponse(error: unknown, status = 500) {
  const resolvedStatus = status === 500 ? inferPublicApiErrorStatus(error) : status;
  return responseJson(
    {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown public API error',
    },
    resolvedStatus,
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

export async function handlePublicConsultationFormRequest(request: PublicApiRequestLike) {
  try {
    const url = getRequestUrl(request);
    const storeId = url.searchParams.get('storeId');

    if (!storeId) {
      return createPublicApiErrorResponse(new Error('storeId is required.'), 400);
    }

    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const snapshot = await getPublicConsultationSnapshot(storeId, { repository });
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

export async function handlePublicConsultationRequest(request: PublicApiRequestLike) {
  try {
    const repository = createSupabaseRepository(getSupabaseAdminClient());
    const body = await parseJsonBody<Parameters<typeof submitPublicConsultationMessage>[0]>(request);
    const result = await submitPublicConsultationMessage(body, { repository });
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

export async function handlePublicOrderRequest(request: PublicApiRequestLike) {
  try {
    const body = await parseJsonBody<{
      items: Array<{ menu_item_id: string; quantity: number }>;
      note?: string;
      paymentMethod?: Order['payment_method'];
      paymentSource?: Order['payment_source'];
      storeSlug: string;
      tableNo?: string;
    }>(request);

    const storeSlug = normalizeText(body.storeSlug);
    if (!storeSlug) {
      return createPublicApiErrorResponse(new Error('storeSlug is required.'), 400);
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return createPublicApiErrorResponse(new Error('At least one order item is required.'), 400);
    }

    const snapshot = await buildPublicStoreSnapshot({ slug: storeSlug });
    if (!snapshot) {
      return createPublicApiErrorResponse(new Error('Public store could not be found.'), 404);
    }

    if (!snapshot.capabilities.orderEntryEnabled) {
      return createPublicApiErrorResponse(new Error('Order entry is not enabled for this store.'), 403);
    }

    const adminClient = getSupabaseAdminClient();
    const tableNo = normalizeText(body.tableNo);
    const table = tableNo
      ? snapshot.tables.find((entry) => entry.table_no.toLowerCase() === tableNo.toLowerCase())
      : undefined;

    const lineItems = body.items
      .map((item) => {
        const menuItem = snapshot.menu.items.find((entry) => entry.id === item.menu_item_id);
        if (!menuItem) {
          return null;
        }

        const quantity = Math.max(1, normalizeInteger(item.quantity, 1));
        return {
          line_total: menuItem.price * quantity,
          menu_item_id: menuItem.id,
          menu_name: menuItem.name,
          quantity,
          store_id: snapshot.store.id,
          unit_price: menuItem.price,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!lineItems.length) {
      return createPublicApiErrorResponse(new Error('No valid menu items were found for this order.'), 400);
    }

    const paymentSource = body.paymentSource === 'mobile' ? 'mobile' : 'counter';
    const paymentMethod = body.paymentMethod || (paymentSource === 'counter' ? 'cash' : 'card');
    const totalAmount = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const isAlreadyPaid = totalAmount === 0;
    const placedAt = nowIso();

    const { data: insertedOrder, error: orderError } = await adminClient
      .from('orders')
      .insert({
        channel: table ? 'table' : 'walk_in',
        completed_at: null,
        note: normalizeText(body.note) || null,
        payment_method: paymentMethod,
        payment_recorded_at: isAlreadyPaid ? placedAt : null,
        payment_source: paymentSource,
        payment_status: isAlreadyPaid ? 'paid' : 'pending',
        placed_at: placedAt,
        status: 'pending',
        store_id: snapshot.store.id,
        table_id: table?.id || null,
        table_no: table?.table_no || null,
        total_amount: totalAmount,
      })
      .select('*')
      .single();

    if (orderError || !insertedOrder) {
      throw new Error(`Failed to create public order: ${orderError?.message || 'Unknown insert error'}`);
    }

    const order = mapOrderRecord(insertedOrder as Record<string, unknown>);
    const { data: insertedItems, error: itemsError } = await adminClient
      .from('order_items')
      .insert(
        lineItems.map((item) => ({
          ...item,
          order_id: order.id,
        })),
      )
      .select('*');

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    const { data: insertedTicket, error: ticketError } = await adminClient
      .from('kitchen_tickets')
      .insert({
        created_at: placedAt,
        order_id: order.id,
        status: 'pending',
        store_id: snapshot.store.id,
        table_id: table?.id || null,
        table_no: table?.table_no || null,
        updated_at: placedAt,
      })
      .select('*')
      .single();

    if (ticketError || !insertedTicket) {
      throw new Error(`Failed to create kitchen ticket: ${ticketError?.message || 'Unknown insert error'}`);
    }

    return responseJson({
      ok: true,
      data: {
        items: ((insertedItems || []) as Record<string, unknown>[]).map((item) => mapOrderItemRecord(item)),
        order,
        ticket: mapKitchenTicketRecord(insertedTicket as Record<string, unknown>),
      },
    });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

function resolvePublicOrderRedirectUrl(input: {
  orderId: string;
  redirectPath?: string;
  returnOrigin?: string;
  storeSlug: string;
  tableNo?: string;
}) {
  const rawOrigin = normalizeText(input.returnOrigin);
  const rawPath = normalizeText(input.redirectPath);
  const fallbackPath = `/${encodeURIComponent(input.storeSlug)}/order${input.tableNo ? `?table=${encodeURIComponent(input.tableNo)}` : ''}`;

  let origin: string;
  if (rawOrigin) {
    origin = new URL(rawOrigin).origin;
  } else {
    origin = process.env.VITE_APP_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim() || 'https://mybiz.ai.kr';
  }

  const safePath =
    rawPath && rawPath.startsWith('/') && !rawPath.startsWith('//')
      ? rawPath
      : fallbackPath;

  const url = new URL(safePath, origin);
  url.searchParams.set('portone', 'public-order');
  url.searchParams.set('orderId', input.orderId);
  return url.toString();
}

function buildPublicOrderCheckoutCustomer(
  snapshot: NonNullable<Awaited<ReturnType<typeof buildPublicStoreSnapshot>>>,
  customer?: { email?: string; fullName?: string; phoneNumber?: string },
) {
  return {
    email: normalizeText(customer?.email) || snapshot.store.email || 'orders@mybiz.ai.kr',
    fullName: normalizeText(customer?.fullName) || `${snapshot.store.name} 주문`,
    phoneNumber: normalizeText(customer?.phoneNumber) || snapshot.store.phone || '010-0000-0000',
  };
}

export async function handlePublicOrderPaymentCheckoutRequest(request: PublicApiRequestLike) {
  try {
    const body = await parseJsonBody<{
      customer?: {
        email?: string;
        fullName?: string;
        phoneNumber?: string;
      };
      orderId: string;
      redirectPath?: string;
      returnOrigin?: string;
      storeSlug: string;
    }>(request);

    const orderId = normalizeText(body.orderId);
    const storeSlug = normalizeText(body.storeSlug);
    if (!orderId || !storeSlug) {
      return createPublicApiErrorResponse(new Error('orderId and storeSlug are required.'), 400);
    }

    const snapshot = await buildPublicStoreSnapshot({ slug: storeSlug });
    if (!snapshot) {
      return createPublicApiErrorResponse(new Error('Public store could not be found.'), 404);
    }

    const adminClient = getSupabaseAdminClient();
    const { data: orderRow, error: orderError } = await adminClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('store_id', snapshot.store.id)
      .maybeSingle();

    if (orderError) {
      throw new Error(`Failed to load public order: ${orderError.message}`);
    }

    if (!orderRow) {
      return createPublicApiErrorResponse(new Error('Order could not be found for this store.'), 404);
    }

    const order = mapOrderRecord(orderRow as Record<string, unknown>);
    if (order.payment_status === 'paid') {
      return createPublicApiErrorResponse(new Error('This order is already paid.'), 409);
    }

    if (order.total_amount <= 0) {
      return createPublicApiErrorResponse(new Error('Only payable orders can enter mobile payment checkout.'), 409);
    }

    const env = validateBillingEnv(['channelKey', 'storeId'], PUBLIC_ORDER_CHECKOUT_ENDPOINT);
    const paymentId = createPublicOrderPaymentId();

    return responseJson({
      ok: true,
      data: {
        checkout: {
          channelKey: env.channelKey!,
          currency: 'KRW',
          customer: buildPublicOrderCheckoutCustomer(snapshot, body.customer),
          noticeUrls: [`${getRequestUrl(request).origin}/api/billing/webhook`],
          orderName: `${snapshot.store.name} 주문 결제`,
          payMethod: 'CARD',
          paymentId,
          redirectUrl: resolvePublicOrderRedirectUrl({
            orderId,
            redirectPath: body.redirectPath,
            returnOrigin: body.returnOrigin,
            storeSlug,
            tableNo: order.table_no,
          }),
          storeId: env.storeId!,
          totalAmount: order.total_amount,
          customData: sanitizeCheckoutCustomData({
            kind: 'public_order',
            orderId,
            storeId: snapshot.store.id,
            storeSlug,
            tableNo: order.table_no || null,
          }),
        },
        orderId,
      },
    });
  } catch (error) {
    return createPublicApiErrorResponse(error);
  }
}

function readPortOnePaymentStatus(payment: Record<string, unknown>) {
  return normalizeText(payment.status) || 'UNKNOWN';
}

function readPortOnePaymentAmount(payment: Record<string, unknown>) {
  const amount = payment.amount;
  if (amount && typeof amount === 'object' && !Array.isArray(amount)) {
    return normalizeNumeric((amount as Record<string, unknown>).total);
  }

  return normalizeNumeric(amount);
}

function readPortOneCustomData(payment: Record<string, unknown>) {
  return typeof payment.customData === 'object' && payment.customData && !Array.isArray(payment.customData)
    ? (payment.customData as Record<string, unknown>)
    : {};
}

export async function handlePublicOrderPaymentVerifyRequest(request: PublicApiRequestLike) {
  try {
    const body = await parseJsonBody<{
      orderId: string;
      paymentId: string;
      storeSlug: string;
    }>(request);

    const orderId = normalizeText(body.orderId);
    const paymentId = normalizeText(body.paymentId);
    const storeSlug = normalizeText(body.storeSlug);
    if (!orderId || !paymentId || !storeSlug) {
      return createPublicApiErrorResponse(new Error('orderId, paymentId, and storeSlug are required.'), 400);
    }

    const snapshot = await buildPublicStoreSnapshot({ slug: storeSlug });
    if (!snapshot) {
      return createPublicApiErrorResponse(new Error('Public store could not be found.'), 404);
    }

    const adminClient = getSupabaseAdminClient();
    const { data: orderRow, error: orderError } = await adminClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('store_id', snapshot.store.id)
      .maybeSingle();

    if (orderError) {
      throw new Error(`Failed to load public order: ${orderError.message}`);
    }

    if (!orderRow) {
      return createPublicApiErrorResponse(new Error('Order could not be found for this store.'), 404);
    }

    const order = mapOrderRecord(orderRow as Record<string, unknown>);
    if (order.payment_status === 'paid') {
      return responseJson({ ok: true, data: { order } });
    }

    const env = validateBillingEnv(['apiSecret', 'storeId'], PUBLIC_ORDER_PAYMENT_VERIFY_ENDPOINT);
    const paymentResponse = await callPortOneApi({
      apiSecret: env.apiSecret!,
      endpoint: PUBLIC_ORDER_PAYMENT_VERIFY_ENDPOINT,
      method: 'GET',
      path: `/payments/${encodeURIComponent(paymentId)}`,
      query: {
        storeId: env.storeId!,
      },
      stage: 'payment-verify',
    });

    const payment = (paymentResponse.data || {}) as Record<string, unknown>;
    const paymentStatus = readPortOnePaymentStatus(payment);
    if (paymentStatus !== 'PAID') {
      throw new BillingApiStageError({
        code: 'PAYMENT_NOT_COMPLETED',
        details: { orderId, paymentId, paymentStatus },
        message: `Payment ${paymentId} is not completed. Current status: ${paymentStatus}`,
        stage: 'payment-verify',
        status: 409,
      });
    }

    const paymentAmount = readPortOnePaymentAmount(payment);
    if (paymentAmount !== order.total_amount) {
      throw new BillingApiStageError({
        code: 'PAYMENT_AMOUNT_MISMATCH',
        details: { orderId, paymentAmount, totalAmount: order.total_amount },
        message: `Payment ${paymentId} amount ${paymentAmount} does not match order total ${order.total_amount}.`,
        stage: 'payment-verify',
        status: 409,
      });
    }

    const customData = readPortOneCustomData(payment);
    if (normalizeText(customData.kind) !== 'public_order' || normalizeText(customData.orderId) !== orderId) {
      throw new BillingApiStageError({
        code: 'PAYMENT_ORDER_MISMATCH',
        details: { customData, orderId, paymentId },
        message: `Payment ${paymentId} does not match public order ${orderId}.`,
        stage: 'payment-verify',
        status: 409,
      });
    }

    const { data: updatedOrder, error: updateError } = await adminClient
      .from('orders')
      .update({
        payment_method: 'card',
        payment_recorded_at: nowIso(),
        payment_source: 'mobile',
        payment_status: 'paid',
      })
      .eq('id', orderId)
      .eq('store_id', snapshot.store.id)
      .select('*')
      .single();

    if (updateError || !updatedOrder) {
      throw new Error(`Failed to mark public order as paid: ${updateError?.message || 'Unknown update error'}`);
    }

    return responseJson({
      ok: true,
      data: {
        order: mapOrderRecord(updatedOrder as Record<string, unknown>),
        payment: {
          paymentId,
          paymentStatus,
        },
      },
    });
  } catch (error) {
    if (error instanceof BillingApiStageError) {
      return responseJson(
        {
          ok: false,
          code: error.code,
          error: error.message,
          details: error.details,
        },
        error.status,
      );
    }

    return createPublicApiErrorResponse(error);
  }
}
