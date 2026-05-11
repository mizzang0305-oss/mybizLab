import { getCustomerDisplayLabel, isBrokenCustomerDisplayText } from '../customerDisplay.js';
import { formatCurrency } from '../format.js';
import { getOrderItemSummary, getOrderLineItems, ORDER_ITEMS_EMPTY_MESSAGE } from '../orderItemsReadModel.js';
import type {
  Customer,
  CustomerContact,
  CustomerPreference,
  CustomerTimelineEvent,
  Inquiry,
  Order,
  OrderItem,
  Reservation,
  SocialPublishJob,
  StoreBlogPost,
  StoreReview,
  WaitingEntry,
} from '../../types/models.js';

export type CustomerIntelligenceStatus =
  | 'new'
  | 'regular_candidate'
  | 'revisit_needed'
  | 'quiet_customer'
  | 'review_customer'
  | 'vip_candidate';

export type CustomerNextActionKind = 'content' | 'ops' | 'outreach' | 'review';
export type CustomerNextActionState = 'suggested' | 'dismissed' | 'completed';

export interface CustomerNextAction {
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  id:
    | 'blog_draft_from_review'
    | 'review_request'
    | 'reorder_prompt'
    | 'reservation_follow_up'
    | 'revisit_outreach'
    | 'vip_candidate'
    | 'waiting_follow_up';
  kind: CustomerNextActionKind;
  label: string;
  state: CustomerNextActionState;
}

export interface CustomerTimelineIntelligenceEvent {
  icon: string;
  id: string;
  label: string;
  occurredAt: string;
  orderItemSummary?: string;
  relatedHref?: string;
  sourceBadge: string;
  summary: string;
  type: string;
}

export interface CustomerFrequentItem {
  lastOrderedAt?: string;
  menuName: string;
  orderCount: number;
  quantity: number;
}

export interface CustomerIntelligenceCard {
  averageOrderAmount: number;
  counts: {
    blogPosts: number;
    inquiries: number;
    orders: number;
    reservations: number;
    reviews: number;
    socialJobs: number;
    waitingEntries: number;
  };
  customerId: string;
  displayLabel: string;
  frequentItems: CustomerFrequentItem[];
  lastActivityAt?: string;
  marketingConsent: boolean;
  nextActions: CustomerNextAction[];
  quietMode: boolean;
  recentOrderItemSummary: string;
  recentReviewSummary?: string;
  statusBadges: Array<{ label: string; status: CustomerIntelligenceStatus }>;
  tags: string[];
  timeline: CustomerTimelineIntelligenceEvent[];
  totalItemQuantity: number;
  totalOrderAmount: number;
}

export interface CustomerTimelineIntelligenceDashboard {
  cards: CustomerIntelligenceCard[];
  generatedAt: string;
  storeId: string;
}

type OrderWithItems = Order & {
  items?: OrderItem[];
  raw?: unknown;
};

export interface CustomerTimelineIntelligenceInput {
  blogPosts?: StoreBlogPost[];
  contacts?: CustomerContact[];
  customers: Customer[];
  inquiries?: Inquiry[];
  orders?: OrderWithItems[];
  preferences?: CustomerPreference[];
  referenceDate?: string;
  reservations?: Reservation[];
  reviews?: StoreReview[];
  socialJobs?: SocialPublishJob[];
  storeId: string;
  timelineEvents?: CustomerTimelineEvent[];
  waitingEntries?: WaitingEntry[];
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function safeSummary(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  if (!normalized || isBrokenCustomerDisplayText(normalized)) {
    return fallback;
  }

  return normalized
    .replace(/public_token\s*[:=]\s*[^,\s}]+/gi, '')
    .replace(/token\s*[:=]\s*[^,\s}]+/gi, '')
    .slice(0, 180);
}

function sortNewest<T>(items: T[], getDate: (item: T) => string | undefined) {
  return items.slice().sort((left, right) => normalizeText(getDate(right)).localeCompare(normalizeText(getDate(left))));
}

function isSameStore<T extends { store_id: string }>(storeId: string, item: T) {
  return item.store_id === storeId;
}

function matchesCustomer(customerId: string, item: { customer_id?: string }) {
  return item.customer_id === customerId;
}

function getOrderItems(order: OrderWithItems) {
  return getOrderLineItems(order, order.items || []).items;
}

function latestDate(values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => right!.localeCompare(left!))[0];
}

function daysBetween(referenceDate: string, occurredAt?: string) {
  if (!occurredAt) {
    return Number.POSITIVE_INFINITY;
  }

  const reference = new Date(referenceDate).getTime();
  const occurred = new Date(occurredAt).getTime();
  if (!Number.isFinite(reference) || !Number.isFinite(occurred)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((reference - occurred) / (1000 * 60 * 60 * 24));
}

function summarizeReview(review: StoreReview | undefined) {
  if (!review) {
    return undefined;
  }

  return safeSummary(review.ai_summary || review.title || review.body, '최근 리뷰 요약을 준비 중입니다.');
}

function buildFrequentItems(orders: OrderWithItems[]): CustomerFrequentItem[] {
  const byName = new Map<string, CustomerFrequentItem>();

  for (const order of orders) {
    const uniqueNamesInOrder = new Set<string>();
    for (const item of getOrderItems(order)) {
      const menuName = safeSummary(item.menu_name, '');
      if (!menuName) {
        continue;
      }

      const current = byName.get(menuName) || {
        lastOrderedAt: order.placed_at,
        menuName,
        orderCount: 0,
        quantity: 0,
      };
      current.quantity += item.quantity;
      current.lastOrderedAt = latestDate([current.lastOrderedAt, order.placed_at]);
      if (!uniqueNamesInOrder.has(menuName)) {
        current.orderCount += 1;
        uniqueNamesInOrder.add(menuName);
      }
      byName.set(menuName, current);
    }
  }

  return [...byName.values()].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return normalizeText(right.lastOrderedAt).localeCompare(normalizeText(left.lastOrderedAt));
  });
}

function statusBadges(input: {
  averageOrderAmount: number;
  customer: Customer;
  daysSinceLastOrder: number;
  hasReview: boolean;
  orderCount: number;
  quietMode: boolean;
}) {
  const badges: CustomerIntelligenceCard['statusBadges'] = [];
  if (input.orderCount === 0 && input.customer.visit_count <= 1) {
    badges.push({ label: '신규', status: 'new' });
  }

  if (input.customer.is_regular || input.orderCount >= 2 || input.customer.visit_count >= 3) {
    badges.push({ label: '단골 후보', status: 'regular_candidate' });
  }

  if (input.orderCount > 0 && input.daysSinceLastOrder >= 30) {
    badges.push({ label: '재방문 필요', status: 'revisit_needed' });
  }

  if (input.quietMode) {
    badges.push({ label: '조용한 고객', status: 'quiet_customer' });
  }

  if (input.hasReview) {
    badges.push({ label: '리뷰 작성 고객', status: 'review_customer' });
  }

  if (input.averageOrderAmount >= 50000) {
    badges.push({ label: 'VIP 후보', status: 'vip_candidate' });
  }

  return badges;
}

function suggestedActions(input: {
  averageOrderAmount: number;
  daysSinceLastOrder: number;
  frequentItems: CustomerFrequentItem[];
  hasConsentedPublishedReview: boolean;
  orderCount: number;
  quietMode: boolean;
  waitingWithoutLaterOrder: boolean;
}) {
  const actions: CustomerNextAction[] = [];
  const disabledReason = '이 기능은 다음 배포에서 제공됩니다.';

  if (!input.quietMode && input.orderCount > 0 && input.daysSinceLastOrder >= 30) {
    actions.push({
      description: '최근 30일 주문이 없어 재방문 안내 후보입니다. 실제 발송은 아직 실행하지 않습니다.',
      disabled: true,
      disabledReason,
      id: 'revisit_outreach',
      kind: 'outreach',
      label: '재방문 안내',
      state: 'suggested',
    });
  }

  if (!input.quietMode && input.frequentItems.length) {
    actions.push({
      description: `${input.frequentItems[0]!.menuName} 재주문 관심을 확인할 수 있습니다. 실제 메시지 발송은 하지 않습니다.`,
      disabled: true,
      disabledReason,
      id: 'reorder_prompt',
      kind: 'outreach',
      label: '재주문 안내',
      state: 'suggested',
    });
  }

  if (input.hasConsentedPublishedReview) {
    actions.push({
      description: '고객 동의가 있는 published 리뷰를 바탕으로 블로그 초안 후보를 만들 수 있습니다.',
      disabled: true,
      disabledReason,
      id: 'blog_draft_from_review',
      kind: 'content',
      label: '블로그 초안 후보',
      state: 'suggested',
    });
  }

  if (!input.quietMode && input.waitingWithoutLaterOrder) {
    actions.push({
      description: '웨이팅 이후 주문 연결이 없어 후기 또는 재방문 확인 후보입니다.',
      disabled: true,
      disabledReason,
      id: 'waiting_follow_up',
      kind: 'outreach',
      label: '웨이팅 후속 확인',
      state: 'suggested',
    });
  }

  if (input.averageOrderAmount >= 50000) {
    actions.push({
      description: '평균 주문금액이 높아 VIP 후보로 볼 수 있습니다. 혜택 설계는 다음 배포에서 제공합니다.',
      disabled: true,
      disabledReason,
      id: 'vip_candidate',
      kind: 'ops',
      label: 'VIP 후보 관리',
      state: 'suggested',
    });
  }

  if (!actions.length) {
    actions.push({
      description: '추가 행동 후보를 만들 만큼의 고객 기억 데이터가 아직 부족합니다.',
      disabled: true,
      disabledReason,
      id: 'review_request',
      kind: 'review',
      label: '리뷰 요청 후보',
      state: 'suggested',
    });
  }

  return actions;
}

const EVENT_LABELS: Record<string, { icon: string; label: string; sourceBadge: string }> = {
  ai_consultation: { icon: 'ai', label: 'AI 상담', sourceBadge: 'AI 상담' },
  blog_created_from_review: { icon: 'content', label: '블로그 초안', sourceBadge: '콘텐츠' },
  contact_captured: { icon: 'contact', label: '연락처 수집', sourceBadge: '고객 기억' },
  conversation_message: { icon: 'message', label: '상담 메시지', sourceBadge: '상담' },
  conversation_started: { icon: 'message', label: '상담 시작', sourceBadge: '상담' },
  customer_created: { icon: 'customer', label: '고객 생성', sourceBadge: '고객 기억' },
  inquiry_captured: { icon: 'inquiry', label: '문의 접수', sourceBadge: '문의' },
  inquiry_created: { icon: 'inquiry', label: '문의 접수', sourceBadge: '문의' },
  order_created: { icon: 'order', label: '주문 생성', sourceBadge: '주문' },
  order_linked: { icon: 'order', label: '주문 연결', sourceBadge: '주문' },
  order_paid: { icon: 'payment', label: '결제 완료', sourceBadge: '결제' },
  order_status_changed: { icon: 'order', label: '주문 상태 변경', sourceBadge: '주문' },
  reservation_captured: { icon: 'reservation', label: '예약 접수', sourceBadge: '예약' },
  reservation_created: { icon: 'reservation', label: '예약 생성', sourceBadge: '예약' },
  reservation_updated: { icon: 'reservation', label: '예약 변경', sourceBadge: '예약' },
  review_published: { icon: 'review', label: '리뷰 게시', sourceBadge: '리뷰' },
  review_submitted: { icon: 'review', label: '리뷰 제출', sourceBadge: '리뷰' },
  social_job_created: { icon: 'social', label: '소셜 작업 생성', sourceBadge: '콘텐츠 확산' },
  waitlist_captured: { icon: 'waiting', label: '웨이팅 접수', sourceBadge: '웨이팅' },
  waitlist_updated: { icon: 'waiting', label: '웨이팅 변경', sourceBadge: '웨이팅' },
  waiting_created: { icon: 'waiting', label: '웨이팅 접수', sourceBadge: '웨이팅' },
};

function eventMeta(type: string) {
  return EVENT_LABELS[type] || { icon: 'event', label: type, sourceBadge: '타임라인' };
}

function addEvent(
  events: CustomerTimelineIntelligenceEvent[],
  seen: Set<string>,
  event: Omit<CustomerTimelineIntelligenceEvent, 'icon' | 'label' | 'sourceBadge'> &
    Partial<Pick<CustomerTimelineIntelligenceEvent, 'icon' | 'label' | 'sourceBadge'>>,
  dedupeKey?: string,
) {
  const key = dedupeKey || `${event.type}:${event.id}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  const meta = eventMeta(event.type);
  events.push({
    icon: event.icon || meta.icon,
    label: event.label || meta.label,
    sourceBadge: event.sourceBadge || meta.sourceBadge,
    ...event,
  });
}

function buildTimeline(input: {
  blogPosts: StoreBlogPost[];
  inquiries: Inquiry[];
  orders: OrderWithItems[];
  reservations: Reservation[];
  reviews: StoreReview[];
  socialJobs: SocialPublishJob[];
  timelineEvents: CustomerTimelineEvent[];
  waitingEntries: WaitingEntry[];
}) {
  const events: CustomerTimelineIntelligenceEvent[] = [];
  const seen = new Set<string>();

  for (const event of input.timelineEvents) {
    const orderId = normalizeText(event.metadata?.order_id || event.metadata?.orderId);
    const type = event.event_type;
    addEvent(
      events,
      seen,
      {
        id: `timeline:${event.id}`,
        occurredAt: event.occurred_at,
        summary: safeSummary(event.summary, eventMeta(type).label),
        type,
      },
      type === 'order_linked' && orderId ? `order_linked:${orderId}` : undefined,
    );
  }

  for (const inquiry of input.inquiries) {
    addEvent(events, seen, {
      id: `inquiry:${inquiry.id}`,
      occurredAt: inquiry.created_at,
      relatedHref: '/dashboard/customers',
      summary: safeSummary(inquiry.message, '문의가 접수되었습니다.'),
      type: 'inquiry_created',
    });
  }

  for (const reservation of input.reservations) {
    const type = reservation.status === 'cancelled' ? 'reservation_updated' : 'reservation_created';
    addEvent(events, seen, {
      id: `reservation:${reservation.id}:${reservation.status}`,
      occurredAt: reservation.updated_at || reservation.created_at || reservation.reserved_at,
      relatedHref: '/dashboard/reservations',
      summary: `${reservation.party_size}명 예약 ${reservation.status}`,
      type,
    });
  }

  for (const entry of input.waitingEntries) {
    addEvent(events, seen, {
      id: `waiting:${entry.id}:${entry.status}`,
      occurredAt: entry.updated_at || entry.created_at,
      relatedHref: '/dashboard/waiting',
      summary: `${entry.party_size}명 웨이팅 ${entry.status}`,
      type: entry.status === 'waiting' ? 'waiting_created' : 'waitlist_updated',
    });
  }

  for (const order of input.orders) {
    const itemSummary = getOrderItemSummary(getOrderItems(order));
    addEvent(events, seen, {
      id: `order:${order.id}:created`,
      occurredAt: order.placed_at,
      orderItemSummary: itemSummary,
      relatedHref: '/dashboard/orders',
      summary: `주문 ${formatCurrency(order.total_amount)} · ${itemSummary}`,
      type: 'order_created',
    });

    if (order.payment_status === 'paid') {
      addEvent(events, seen, {
        id: `order:${order.id}:paid`,
        occurredAt: order.payment_recorded_at || order.placed_at,
        relatedHref: '/dashboard/orders',
        summary: `결제 완료 ${formatCurrency(order.total_amount)}`,
        type: 'order_paid',
      });
    }
  }

  for (const review of input.reviews) {
    addEvent(events, seen, {
      id: `review:${review.review_id}:${review.visibility_status}`,
      occurredAt: review.updated_at || review.created_at,
      relatedHref: '/dashboard/content/reviews',
      summary: summarizeReview(review) || '리뷰가 제출되었습니다.',
      type: review.visibility_status === 'published' ? 'review_published' : 'review_submitted',
    });
  }

  for (const post of input.blogPosts) {
    addEvent(events, seen, {
      id: `blog:${post.post_id}`,
      occurredAt: post.published_at || post.created_at,
      relatedHref: '/dashboard/content/blog',
      summary: safeSummary(post.title, '리뷰 기반 블로그 초안이 생성되었습니다.'),
      type: 'blog_created_from_review',
    });
  }

  for (const job of input.socialJobs) {
    addEvent(events, seen, {
      id: `social:${job.job_id}`,
      occurredAt: job.created_at,
      relatedHref: '/dashboard/content/social',
      summary: `${job.provider} ${job.status}`,
      type: 'social_job_created',
    });
  }

  return sortNewest(events, (event) => event.occurredAt);
}

export function buildCustomerTimelineIntelligenceDashboard(
  input: CustomerTimelineIntelligenceInput,
): CustomerTimelineIntelligenceDashboard {
  const referenceDate = input.referenceDate || new Date().toISOString();
  const customers = input.customers.filter((item) => isSameStore(input.storeId, item));
  const contacts = (input.contacts || []).filter((item) => isSameStore(input.storeId, item));
  const preferences = (input.preferences || []).filter((item) => isSameStore(input.storeId, item));
  const allOrders = (input.orders || []).filter((item) => isSameStore(input.storeId, item));
  const allInquiries = (input.inquiries || []).filter((item) => isSameStore(input.storeId, item));
  const allReservations = (input.reservations || []).filter((item) => isSameStore(input.storeId, item));
  const allWaitingEntries = (input.waitingEntries || []).filter((item) => isSameStore(input.storeId, item));
  const allReviews = (input.reviews || []).filter((item) => isSameStore(input.storeId, item));
  const allBlogPosts = (input.blogPosts || []).filter((item) => isSameStore(input.storeId, item));
  const allSocialJobs = (input.socialJobs || []).filter((item) => isSameStore(input.storeId, item));
  const allTimelineEvents = (input.timelineEvents || []).filter((item) => isSameStore(input.storeId, item));

  const cards = customers.map((customer) => {
    const customerId = customer.id;
    const customerContacts = contacts.filter((item) => item.customer_id === customerId);
    const preference = preferences.find((item) => item.customer_id === customerId) || null;
    const orders = sortNewest(allOrders.filter((item) => matchesCustomer(customerId, item)), (item) => item.placed_at);
    const inquiries = sortNewest(allInquiries.filter((item) => matchesCustomer(customerId, item)), (item) => item.created_at);
    const reservations = sortNewest(allReservations.filter((item) => matchesCustomer(customerId, item)), (item) => item.created_at || item.reserved_at);
    const waitingEntries = sortNewest(allWaitingEntries.filter((item) => matchesCustomer(customerId, item)), (item) => item.created_at);
    const reviews = sortNewest(allReviews.filter((item) => matchesCustomer(customerId, item)), (item) => item.created_at);
    const blogPosts = sortNewest(
      allBlogPosts.filter((post) => reviews.some((review) => review.review_id === post.source_review_id)),
      (item) => item.created_at,
    );
    const socialJobs = sortNewest(
      allSocialJobs.filter((job) => blogPosts.some((post) => post.post_id === job.source_id) || reviews.some((review) => review.review_id === job.source_id)),
      (item) => item.created_at,
    );
    const timelineEvents = sortNewest(allTimelineEvents.filter((item) => matchesCustomer(customerId, item)), (item) => item.occurred_at);
    const displayLabel = getCustomerDisplayLabel({
      customer,
      customerId,
      raw: {
        email: customerContacts.find((item) => item.type === 'email')?.value,
        phone: customerContacts.find((item) => item.type === 'phone')?.value,
      },
    });
    const totalOrderAmount = orders.reduce((sum, item) => sum + item.total_amount, 0);
    const averageOrderAmount = orders.length ? Math.round(totalOrderAmount / orders.length) : 0;
    const frequentItems = buildFrequentItems(orders);
    const recentOrderItemSummary = orders[0] ? getOrderItemSummary(getOrderItems(orders[0])) : ORDER_ITEMS_EMPTY_MESSAGE;
    const totalItemQuantity = orders.flatMap((item) => getOrderItems(item)).reduce((sum, item) => sum + item.quantity, 0);
    const quietMode = Boolean(
      (customer as Customer & { quiet_mode?: boolean }).quiet_mode ||
        preference?.preference_tags.some((tag) => tag.toLowerCase() === 'quiet_mode'),
    );
    const marketingConsent = Boolean(preference?.marketing_opt_in ?? customer.marketing_opt_in);
    const lastOrderAt = orders[0]?.placed_at;
    const lastActivityAt = latestDate([
      customer.last_visit_at,
      lastOrderAt,
      inquiries[0]?.created_at,
      reservations[0]?.created_at || reservations[0]?.reserved_at,
      waitingEntries[0]?.created_at,
      reviews[0]?.created_at,
      timelineEvents[0]?.occurred_at,
    ]);
    const daysSinceLastOrder = daysBetween(referenceDate, lastOrderAt);
    const hasConsentedPublishedReview = reviews.some(
      (review) => review.visibility_status === 'published' && review.content_usage_consent,
    );
    const latestWaitingAt = waitingEntries[0]?.created_at;
    const waitingWithoutLaterOrder = Boolean(
      latestWaitingAt && (!lastOrderAt || new Date(lastOrderAt).getTime() < new Date(latestWaitingAt).getTime()),
    );
    const tags = [
      ...(preference?.preference_tags || []),
      ...inquiries.flatMap((inquiry) => inquiry.tags),
      ...reviews.flatMap((review) => review.keywords),
    ]
      .map((tag) => safeSummary(tag, ''))
      .filter(Boolean)
      .filter((tag, index, source) => source.indexOf(tag) === index)
      .slice(0, 8);

    return {
      averageOrderAmount,
      counts: {
        blogPosts: blogPosts.length,
        inquiries: inquiries.length,
        orders: orders.length,
        reservations: reservations.length,
        reviews: reviews.length,
        socialJobs: socialJobs.length,
        waitingEntries: waitingEntries.length,
      },
      customerId,
      displayLabel,
      frequentItems,
      lastActivityAt,
      marketingConsent,
      nextActions: suggestedActions({
        averageOrderAmount,
        daysSinceLastOrder,
        frequentItems,
        hasConsentedPublishedReview,
        orderCount: orders.length,
        quietMode,
        waitingWithoutLaterOrder,
      }),
      quietMode,
      recentOrderItemSummary,
      recentReviewSummary: summarizeReview(reviews[0]),
      statusBadges: statusBadges({
        averageOrderAmount,
        customer,
        daysSinceLastOrder,
        hasReview: Boolean(reviews.length),
        orderCount: orders.length,
        quietMode,
      }),
      tags,
      timeline: buildTimeline({
        blogPosts,
        inquiries,
        orders,
        reservations,
        reviews,
        socialJobs,
        timelineEvents,
        waitingEntries,
      }),
      totalItemQuantity,
      totalOrderAmount,
    } satisfies CustomerIntelligenceCard;
  });

  return {
    cards: sortNewest(cards, (card) => card.lastActivityAt),
    generatedAt: referenceDate,
    storeId: input.storeId,
  };
}

export function getCustomerIntelligenceCard(
  dashboard: CustomerTimelineIntelligenceDashboard,
  customerId: string | undefined,
) {
  if (!customerId) {
    return undefined;
  }

  return dashboard.cards.find((card) => card.customerId === customerId);
}
