import { getCustomerDisplayLabel, isBrokenCustomerDisplayText } from '../customerDisplay.js';
import { formatCurrency } from '../format.js';
import { createId } from '../ids.js';
import { getDatabase, updateDatabase } from '../mockDb.js';
import { getOrderItemSummary, getOrderLineItems } from '../orderItemsReadModel.js';
import type {
  Customer,
  CustomerContact,
  CustomerPreference,
  CustomerRecommendationAction,
  CustomerRecommendationActionStatus,
  CustomerRecommendationType,
  Order,
  OrderItem,
  Reservation,
  StoreReview,
  WaitingEntry,
} from '../../types/models.js';

export type CustomerRecommendationConfidence = 'high' | 'low' | 'medium';
export type CustomerRecommendationPriority = 'high' | 'low' | 'medium';
export type CustomerRecommendationBlockedReason =
  | 'contact_missing'
  | 'content_usage_consent_missing'
  | 'marketing_consent_missing'
  | 'quiet_mode';

export interface CustomerRecommendation {
  blocked_reason?: CustomerRecommendationBlockedReason;
  can_execute: boolean;
  confidence: CustomerRecommendationConfidence;
  created_at: string;
  customer_id: string;
  description: string;
  priority: CustomerRecommendationPriority;
  reason: string;
  recommendation_id: string;
  recommendation_key: string;
  source_signals: string[];
  status: CustomerRecommendationActionStatus;
  store_id: string;
  suggested_action_label: string;
  title: string;
  type: CustomerRecommendationType;
}

export interface RecommendedCustomerSummary {
  blocked_reason?: CustomerRecommendationBlockedReason;
  can_execute: boolean;
  customer_id: string;
  display_label: string;
  priority: CustomerRecommendationPriority;
  recommendation_count: number;
  top_recommendation_label: string;
  top_recommendation_type: CustomerRecommendationType;
}

type OrderWithItems = Order & {
  items?: OrderItem[];
  raw?: unknown;
};

export interface CustomerRecommendationInput {
  actions?: CustomerRecommendationAction[];
  contacts?: CustomerContact[];
  customers: Customer[];
  orders?: OrderWithItems[];
  preferences?: CustomerPreference[];
  referenceDate?: string;
  reservations?: Reservation[];
  reviews?: StoreReview[];
  storeId: string;
  waitingEntries?: WaitingEntry[];
}

export interface CustomerRecommendationOptions {
  actorProfileId?: string;
}

export interface UpsertCustomerRecommendationActionInput {
  note?: string;
  recommendationKey: string;
  recommendationType: CustomerRecommendationType;
  snoozedUntil?: string;
  status: CustomerRecommendationActionStatus;
}

interface CustomerRecommendationProfile {
  averageOrderAmount: number;
  contacts: CustomerContact[];
  customer: Customer;
  frequentItems: CustomerItemSignal[];
  hasContact: boolean;
  hasRecentReview: boolean;
  lastActivityAt?: string;
  lastOrderAt?: string;
  latestPendingReservation?: Reservation;
  latestWaitingAfterOrder?: WaitingEntry;
  marketingConsent: boolean;
  orders: OrderWithItems[];
  publishedConsentReview?: StoreReview;
  publishedReviewWithoutConsent?: StoreReview;
  quietMode: boolean;
  recentItemSummary: string;
  referenceDate: string;
  reviews: StoreReview[];
  storeAverageOrderAmount: number;
  storeId: string;
  totalOrderAmount: number;
}

interface CustomerItemSignal {
  lastOrderedAt: string;
  menuName: string;
  orderCount: number;
  quantity: number;
  revenue: number;
}

const OUTREACH_TYPES = new Set<CustomerRecommendationType>([
  'reorder',
  'reservation_followup',
  'revisit',
  'upsell',
  'waiting_followup',
]);

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function safeText(value: unknown, fallback = '') {
  const normalized = normalizeText(value);
  if (!normalized || isBrokenCustomerDisplayText(normalized)) {
    return fallback;
  }

  return normalized
    .replace(/public_token\s*[:=]\s*[^,\s}]+/gi, '')
    .replace(/token\s*[:=]\s*[^,\s}]+/gi, '')
    .replace(/\b\d{2,3}-?\d{3,4}-?\d{4}\b/g, '연락처')
    .slice(0, 160);
}

function daysBetween(referenceDate: string, value?: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const reference = new Date(referenceDate).getTime();
  const target = new Date(value).getTime();
  if (!Number.isFinite(reference) || !Number.isFinite(target)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((reference - target) / 86_400_000);
}

function latestDate(values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => right!.localeCompare(left!))[0];
}

function isSameStore<T extends { store_id: string }>(storeId: string, item: T) {
  return item.store_id === storeId;
}

function matchesCustomer(customerId: string, item: { customer_id?: string }) {
  return item.customer_id === customerId;
}

function sortNewest<T>(items: T[], getDate: (item: T) => string | undefined) {
  return items.slice().sort((left, right) => normalizeText(getDate(right)).localeCompare(normalizeText(getDate(left))));
}

function orderItems(order: OrderWithItems) {
  return getOrderLineItems(order, order.items || []).items;
}

function buildFrequentItems(orders: OrderWithItems[]): CustomerItemSignal[] {
  const itemMap = new Map<string, CustomerItemSignal>();

  orders.forEach((order) => {
    const seenInOrder = new Set<string>();
    orderItems(order).forEach((item) => {
      const menuName = safeText(item.menu_name);
      if (!menuName) {
        return;
      }

      const key = menuName.toLowerCase();
      const previous = itemMap.get(key) || {
        lastOrderedAt: order.placed_at,
        menuName,
        orderCount: 0,
        quantity: 0,
        revenue: 0,
      };

      itemMap.set(key, {
        ...previous,
        lastOrderedAt: latestDate([previous.lastOrderedAt, order.placed_at]) || order.placed_at,
        orderCount: previous.orderCount + (seenInOrder.has(key) ? 0 : 1),
        quantity: previous.quantity + item.quantity,
        revenue: previous.revenue + item.line_total,
      });
      seenInOrder.add(key);
    });
  });

  return [...itemMap.values()].sort((left, right) => {
    if (right.orderCount !== left.orderCount) {
      return right.orderCount - left.orderCount;
    }

    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return right.lastOrderedAt.localeCompare(left.lastOrderedAt);
  });
}

function hasCustomerContact(contacts: CustomerContact[]) {
  return contacts.some((contact) => (contact.type === 'phone' || contact.type === 'email') && Boolean(normalizeText(contact.value)));
}

function isQuietMode(customer: Customer, preference?: CustomerPreference) {
  return Boolean(
    (customer as Customer & { quiet_mode?: boolean }).quiet_mode ||
      preference?.preference_tags.some((tag) => tag.toLowerCase() === 'quiet_mode'),
  );
}

function resolveMarketingConsent(customer: Customer, preference?: CustomerPreference) {
  return Boolean(preference?.marketing_opt_in ?? customer.marketing_opt_in);
}

function getBlockReason(profile: CustomerRecommendationProfile, type: CustomerRecommendationType) {
  if (type === 'content_conversion') {
    return profile.publishedReviewWithoutConsent && !profile.publishedConsentReview
      ? ('content_usage_consent_missing' as const)
      : undefined;
  }

  if (type === 'review_request') {
    if (!profile.hasContact) {
      return 'contact_missing' as const;
    }

    return profile.quietMode ? ('quiet_mode' as const) : undefined;
  }

  if (OUTREACH_TYPES.has(type)) {
    if (profile.quietMode) {
      return 'quiet_mode' as const;
    }

    if (!profile.marketingConsent) {
      return 'marketing_consent_missing' as const;
    }

    if (!profile.hasContact) {
      return 'contact_missing' as const;
    }
  }

  return undefined;
}

function confidenceFromSignals(score: number, hasItems: boolean): CustomerRecommendationConfidence {
  if (score >= 75 && hasItems) {
    return 'high';
  }

  if (score >= 45) {
    return 'medium';
  }

  return 'low';
}

function priorityFromScore(score: number): CustomerRecommendationPriority {
  if (score >= 75) {
    return 'high';
  }

  if (score >= 45) {
    return 'medium';
  }

  return 'low';
}

function recommendationKey(customerId: string, type: CustomerRecommendationType, signal: string) {
  const safeSignal = signal
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return `${customerId}:${type}:${safeSignal || 'general'}`;
}

function createRecommendation(input: {
  profile: CustomerRecommendationProfile;
  reasonCode: string;
  score: number;
  signal: string;
  sourceSignals: string[];
  suggestedActionLabel: string;
  title: string;
  type: CustomerRecommendationType;
}): CustomerRecommendation {
  const blockedReason = getBlockReason(input.profile, input.type);
  const key = recommendationKey(input.profile.customer.id, input.type, input.signal);
  const hasItems = input.profile.frequentItems.length > 0 || input.profile.orders.some((order) => orderItems(order).length > 0);

  return {
    blocked_reason: blockedReason,
    can_execute: !blockedReason,
    confidence: confidenceFromSignals(input.score, hasItems),
    created_at: input.profile.referenceDate,
    customer_id: input.profile.customer.id,
    description: explainRecommendation(input.reasonCode, {
      averageOrderAmount: input.profile.averageOrderAmount,
      frequentItem: input.profile.frequentItems[0]?.menuName,
      recentItems: input.profile.recentItemSummary,
      totalOrderAmount: input.profile.totalOrderAmount,
    }),
    priority: blockedReason ? 'low' : priorityFromScore(input.score),
    reason: input.reasonCode,
    recommendation_id: `rec_${key.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}`,
    recommendation_key: key,
    source_signals: input.sourceSignals.map((signal) => safeText(signal)).filter(Boolean).slice(0, 5),
    status: 'suggested',
    store_id: input.profile.storeId,
    suggested_action_label: input.suggestedActionLabel,
    title: input.title,
    type: input.type,
  };
}

export function scoreReorderCandidate(profile: CustomerRecommendationProfile) {
  const frequentItem = profile.frequentItems[0];
  if (!profile.orders.length) {
    return 0;
  }

  return Math.min(100, (frequentItem?.orderCount || 1) * 25 + Math.min(daysBetween(profile.referenceDate, profile.lastOrderAt), 45));
}

export function scoreUpsellCandidate(profile: CustomerRecommendationProfile) {
  const aovLift = profile.storeAverageOrderAmount
    ? Math.max(0, Math.round(((profile.averageOrderAmount - profile.storeAverageOrderAmount) / profile.storeAverageOrderAmount) * 100))
    : 0;
  const itemVariety = Math.min(profile.frequentItems.length * 12, 30);

  return Math.min(100, 35 + aovLift + itemVariety);
}

export function scoreRevisitCandidate(profile: CustomerRecommendationProfile) {
  if (!profile.orders.length && !profile.latestPendingReservation && !profile.latestWaitingAfterOrder) {
    return 0;
  }

  return Math.min(100, daysBetween(profile.referenceDate, profile.lastOrderAt || profile.lastActivityAt));
}

export function explainRecommendation(reasonCode: string, data: Record<string, unknown> = {}) {
  switch (reasonCode) {
    case 'frequent_item_reorder':
      return `${safeText(data.frequentItem, '자주 주문한 품목')} 반복 주문 이력이 있어 재주문 안내 후보입니다.`;
    case 'high_aov_upsell':
      return `평균 객단가가 ${formatCurrency(Number(data.averageOrderAmount) || 0)}로 높아 세트/프리미엄 옵션 제안 후보입니다.`;
    case 'dormant_revisit':
      return '과거 구매 이력이 있지만 최근 주문 간격이 벌어져 재방문 안내 후보입니다.';
    case 'recent_visit_review_request':
      return '최근 주문/예약/웨이팅 흐름이 있어 리뷰 요청 후보입니다.';
    case 'reservation_followup':
      return '예약 상태 확인이 필요한 고객입니다.';
    case 'waiting_without_order_or_review':
      return '웨이팅 이후 주문 또는 리뷰 흐름이 약해 후속 안내 후보입니다.';
    case 'review_content_conversion':
      return '게시된 리뷰와 콘텐츠 활용 동의가 있어 블로그/소식 초안 전환 후보입니다.';
    case 'review_without_content_consent':
      return '리뷰는 있지만 콘텐츠 활용 동의가 없어 외부 콘텐츠 전환을 실행할 수 없습니다.';
    default:
      return safeText(data.recentItems, '고객 행동 데이터가 더 쌓이면 추천 정확도가 올라갑니다.');
  }
}

function buildProfile(input: CustomerRecommendationInput, customer: Customer): CustomerRecommendationProfile {
  const referenceDate = input.referenceDate || new Date().toISOString();
  const orders = sortNewest(
    (input.orders || []).filter((order) => isSameStore(input.storeId, order) && matchesCustomer(customer.id, order)),
    (order) => order.placed_at,
  );
  const contacts = (input.contacts || []).filter((contact) => isSameStore(input.storeId, contact) && matchesCustomer(customer.id, contact));
  const preference =
    (input.preferences || []).find((item) => isSameStore(input.storeId, item) && item.customer_id === customer.id) || undefined;
  const reservations = sortNewest(
    (input.reservations || []).filter((item) => isSameStore(input.storeId, item) && matchesCustomer(customer.id, item)),
    (item) => item.created_at || item.reserved_at,
  );
  const waitingEntries = sortNewest(
    (input.waitingEntries || []).filter((item) => isSameStore(input.storeId, item) && matchesCustomer(customer.id, item)),
    (item) => item.created_at,
  );
  const reviews = sortNewest(
    (input.reviews || []).filter((item) => isSameStore(input.storeId, item) && matchesCustomer(customer.id, item)),
    (item) => item.created_at,
  );
  const storeOrders = (input.orders || []).filter((order) => isSameStore(input.storeId, order));
  const storeAverageOrderAmount = storeOrders.length
    ? Math.round(storeOrders.reduce((sum, order) => sum + order.total_amount, 0) / storeOrders.length)
    : 0;
  const totalOrderAmount = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const averageOrderAmount = orders.length ? Math.round(totalOrderAmount / orders.length) : 0;
  const lastOrderAt = orders[0]?.placed_at;
  const latestWaiting = waitingEntries[0];
  const latestReviewAt = reviews[0]?.created_at;
  const latestPendingReservation = reservations.find((reservation) => reservation.status === 'booked');
  const latestWaitingAfterOrder =
    latestWaiting && (!lastOrderAt || latestWaiting.created_at.localeCompare(lastOrderAt) > 0) ? latestWaiting : undefined;
  const frequentItems = buildFrequentItems(orders);

  return {
    averageOrderAmount,
    contacts,
    customer,
    frequentItems,
    hasContact: hasCustomerContact(contacts),
    hasRecentReview: daysBetween(referenceDate, latestReviewAt) <= 14,
    lastActivityAt: latestDate([
      customer.last_visit_at,
      lastOrderAt,
      reservations[0]?.created_at || reservations[0]?.reserved_at,
      waitingEntries[0]?.created_at,
      reviews[0]?.created_at,
    ]),
    lastOrderAt,
    latestPendingReservation,
    latestWaitingAfterOrder,
    marketingConsent: resolveMarketingConsent(customer, preference),
    orders,
    publishedConsentReview: reviews.find((review) => review.visibility_status === 'published' && review.content_usage_consent),
    publishedReviewWithoutConsent: reviews.find((review) => review.visibility_status === 'published' && !review.content_usage_consent),
    quietMode: isQuietMode(customer, preference),
    recentItemSummary: orders[0] ? getOrderItemSummary(orderItems(orders[0])) : '주문 품목 정보가 아직 연결되지 않았습니다.',
    referenceDate,
    reviews,
    storeAverageOrderAmount,
    storeId: input.storeId,
    totalOrderAmount,
  };
}

function recommendationsForProfile(profile: CustomerRecommendationProfile) {
  const recommendations: CustomerRecommendation[] = [];
  const reorderScore = scoreReorderCandidate(profile);
  const frequentItem = profile.frequentItems[0];

  if (profile.orders.length && (reorderScore >= 40 || frequentItem)) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: 'frequent_item_reorder',
        score: reorderScore,
        signal: frequentItem?.menuName || 'recent-order',
        sourceSignals: [
          `최근 품목: ${profile.recentItemSummary}`,
          frequentItem ? `${frequentItem.menuName} ${frequentItem.orderCount}회 주문` : '',
          `마지막 주문 ${daysBetween(profile.referenceDate, profile.lastOrderAt)}일 전`,
        ],
        suggestedActionLabel: '재주문 안내 후보',
        title: `${frequentItem?.menuName || '최근 주문'} 재주문 후보`,
        type: 'reorder',
      }),
    );
  }

  const upsellScore = scoreUpsellCandidate(profile);
  if (profile.orders.length && (upsellScore >= 45 || profile.frequentItems.length >= 2)) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: 'high_aov_upsell',
        score: upsellScore,
        signal: frequentItem?.menuName || 'aov',
        sourceSignals: [
          `평균 객단가 ${formatCurrency(profile.averageOrderAmount)}`,
          `매장 평균 ${formatCurrency(profile.storeAverageOrderAmount)}`,
          frequentItem ? `대표 품목 ${frequentItem.menuName}` : '',
        ],
        suggestedActionLabel: '세트/프리미엄 옵션 추천',
        title: '업셀 제안 후보',
        type: 'upsell',
      }),
    );
  }

  const revisitScore = scoreRevisitCandidate(profile);
  if (revisitScore >= 30) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: 'dormant_revisit',
        score: revisitScore,
        signal: 'last-order-gap',
        sourceSignals: [`마지막 주문 ${daysBetween(profile.referenceDate, profile.lastOrderAt)}일 전`, `누적 주문 ${profile.orders.length}건`],
        suggestedActionLabel: '재방문 안내 후보',
        title: '재방문 안내 후보',
        type: 'revisit',
      }),
    );
  }

  if (profile.orders.length && !profile.hasRecentReview) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: 'recent_visit_review_request',
        score: profile.orders[0] ? 55 : 35,
        signal: 'review-request',
        sourceSignals: [`최근 주문: ${profile.recentItemSummary}`, profile.reviews.length ? '최근 리뷰 없음' : '리뷰 이력 없음'],
        suggestedActionLabel: '리뷰 요청 후보',
        title: '리뷰 요청 후보',
        type: 'review_request',
      }),
    );
  }

  if (profile.latestPendingReservation) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: 'reservation_followup',
        score: 55,
        signal: profile.latestPendingReservation.status,
        sourceSignals: [`예약 상태 ${profile.latestPendingReservation.status}`, safeText(profile.latestPendingReservation.reserved_at)],
        suggestedActionLabel: '예약 확인 후보',
        title: '예약 후속 확인 후보',
        type: 'reservation_followup',
      }),
    );
  }

  if (profile.latestWaitingAfterOrder) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: 'waiting_without_order_or_review',
        score: 50,
        signal: profile.latestWaitingAfterOrder.status,
        sourceSignals: [`웨이팅 상태 ${profile.latestWaitingAfterOrder.status}`, '웨이팅 이후 주문 연결 약함'],
        suggestedActionLabel: '웨이팅 후속 안내 후보',
        title: '웨이팅 후속 안내 후보',
        type: 'waiting_followup',
      }),
    );
  }

  if (profile.publishedConsentReview || profile.publishedReviewWithoutConsent) {
    recommendations.push(
      createRecommendation({
        profile,
        reasonCode: profile.publishedConsentReview ? 'review_content_conversion' : 'review_without_content_consent',
        score: profile.publishedConsentReview ? 65 : 20,
        signal: profile.publishedConsentReview?.review_id || profile.publishedReviewWithoutConsent?.review_id || 'review',
        sourceSignals: [
          profile.publishedConsentReview ? '게시 리뷰 + 콘텐츠 활용 동의' : '게시 리뷰 + 콘텐츠 활용 동의 없음',
          safeText(profile.publishedConsentReview?.ai_summary || profile.publishedReviewWithoutConsent?.ai_summary || '리뷰 기반 콘텐츠 후보'),
        ],
        suggestedActionLabel: '블로그/소식 초안 후보',
        title: '리뷰 콘텐츠 전환 후보',
        type: 'content_conversion',
      }),
    );
  }

  return recommendations;
}

function applyActionState(recommendations: CustomerRecommendation[], actions: CustomerRecommendationAction[]) {
  const actionMap = new Map(actions.map((action) => [`${action.customer_id}:${action.recommendation_key}`, action]));

  return recommendations.map((recommendation) => {
    const action = actionMap.get(`${recommendation.customer_id}:${recommendation.recommendation_key}`);
    if (!action) {
      return recommendation;
    }

    return {
      ...recommendation,
      status: action.status,
    };
  });
}

export function buildCustomerRecommendations(input: CustomerRecommendationInput, customerId?: string) {
  const customers = input.customers.filter(
    (customer) => isSameStore(input.storeId, customer) && (!customerId || customer.id === customerId),
  );
  const recommendations = customers.flatMap((customer) => recommendationsForProfile(buildProfile(input, customer)));
  const scopedActions = (input.actions || []).filter(
    (action) => isSameStore(input.storeId, action) && (!customerId || action.customer_id === customerId),
  );

  return applyActionState(recommendations, scopedActions).sort((left, right) => {
    const priorityOrder: Record<CustomerRecommendationPriority, number> = { high: 3, medium: 2, low: 1 };
    if (priorityOrder[right.priority] !== priorityOrder[left.priority]) {
      return priorityOrder[right.priority] - priorityOrder[left.priority];
    }

    return left.type.localeCompare(right.type);
  });
}

export function listRecommendedCustomers(input: CustomerRecommendationInput): RecommendedCustomerSummary[] {
  const recommendations = buildCustomerRecommendations(input);

  return input.customers
    .filter((customer) => isSameStore(input.storeId, customer))
    .flatMap((customer) => {
      const customerRecommendations = recommendations.filter((recommendation) => recommendation.customer_id === customer.id);
      const topRecommendation = customerRecommendations[0];
      if (!topRecommendation) {
        return [];
      }

      return [{
        blocked_reason: topRecommendation.blocked_reason,
        can_execute: topRecommendation.can_execute,
        customer_id: customer.id,
        display_label: getCustomerDisplayLabel({ customer, customerId: customer.id }),
        priority: topRecommendation.priority,
        recommendation_count: customerRecommendations.length,
        top_recommendation_label: topRecommendation.title,
        top_recommendation_type: topRecommendation.type,
      } satisfies RecommendedCustomerSummary];
    });
}

function assertDemoStoreMember(storeId: string, actorProfileId?: string) {
  if (!actorProfileId) {
    return;
  }

  const hasMembership = getDatabase().store_members.some(
    (member) => member.store_id === storeId && member.profile_id === actorProfileId,
  );

  if (!hasMembership) {
    throw new Error('A store member is required to manage customer recommendations.');
  }
}

export async function listCustomerRecommendationActions(
  storeId: string,
  customerId?: string,
  options?: CustomerRecommendationOptions,
) {
  assertDemoStoreMember(storeId, options?.actorProfileId);

  return getDatabase().customer_recommendation_actions.filter(
    (action) => action.store_id === storeId && (!customerId || action.customer_id === customerId),
  );
}

export async function upsertCustomerRecommendationAction(
  storeId: string,
  customerId: string,
  input: UpsertCustomerRecommendationActionInput,
  options?: CustomerRecommendationOptions,
) {
  assertDemoStoreMember(storeId, options?.actorProfileId);
  const timestamp = new Date().toISOString();
  let savedAction: CustomerRecommendationAction | null = null;

  updateDatabase((database) => {
    const existing = database.customer_recommendation_actions.find(
      (action) =>
        action.store_id === storeId &&
        action.customer_id === customerId &&
        action.recommendation_key === input.recommendationKey,
    );

    const nextAction: CustomerRecommendationAction = {
      action_id: existing?.action_id || createId('customer_recommendation_action'),
      acted_at: input.status === 'suggested' ? existing?.acted_at : timestamp,
      acted_by: input.status === 'suggested' ? existing?.acted_by : options?.actorProfileId,
      created_at: existing?.created_at || timestamp,
      customer_id: customerId,
      note: input.note?.trim() || existing?.note,
      recommendation_key: input.recommendationKey,
      recommendation_type: input.recommendationType,
      snoozed_until: input.status === 'snoozed' ? input.snoozedUntil : undefined,
      status: input.status,
      store_id: storeId,
      updated_at: timestamp,
    };

    if (existing) {
      database.customer_recommendation_actions = database.customer_recommendation_actions.map((action) =>
        action.action_id === existing.action_id ? nextAction : action,
      );
    } else {
      database.customer_recommendation_actions.unshift(nextAction);
    }

    savedAction = nextAction;
  });

  return savedAction!;
}
