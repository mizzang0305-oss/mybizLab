import type {
  Customer,
  CustomerPreference,
  CustomerTimelineEvent,
  Order,
  StoreSubscription,
  SubscriptionPlan,
} from '../../types/models.js';

type CustomerVipFieldSource = Customer & {
  customer_value?: number;
  is_vip?: boolean;
  lifetime_value?: number;
  order_count?: number;
  segment?: string;
  tags?: string[];
  tier?: string;
  vip?: boolean;
};

export type VipCustomerReason =
  | 'explicit_vip_field'
  | 'lifetime_value_threshold'
  | 'order_count_threshold'
  | 'segment_or_tag'
  | 'visit_count_threshold';

export interface VipCustomerReadonlyCard {
  allowedActions: [];
  customerId: string;
  expectedNextAction: string;
  lastActivityAt?: string;
  maskedContact: string;
  maskedDisplayName: string;
  orderCount: number;
  preferenceSummary: string;
  profileSummaryText: string;
  readOnly: true;
  recentEventSummary: string;
  totalOrderAmount: number;
  totalVisitCount: number;
  vipReasons: VipCustomerReason[];
}

export interface VipCustomerReadonlyView {
  emptyState: {
    description: string;
    title: string;
  };
  readOnlyNotice: string;
  summary: {
    storeId: string;
    storeSubscriptionPlan?: SubscriptionPlan;
    subscriptionPlanIsCustomerVipSource: false;
    totalCustomersReviewed: number;
    vipCustomerCount: number;
  };
  vipCustomers: VipCustomerReadonlyCard[];
}

export type VipCustomerReportSectionId = 'dormancy_risk' | 'revisit_this_week' | 'raise_average_order_value';

export interface VipCustomerReadonlyReportCandidate {
  customerId: string;
  maskedContact: string;
  maskedDisplayName: string;
  reasonSummary: string;
  totalOrderAmount: number;
  totalVisitCount: number;
}

export interface VipCustomerReadonlyReportSection {
  candidates: VipCustomerReadonlyReportCandidate[];
  description: string;
  id: VipCustomerReportSectionId;
  title: string;
}

export interface VipCustomerReadonlyReportSample {
  allowedActions: [];
  readOnlyNotice: string;
  sections: VipCustomerReadonlyReportSection[];
  summary: VipCustomerReadonlyView['summary'] & {
    campaignGateRequired: true;
    reportMode: 'sample_read_only';
  };
}

export const VIP_CUSTOMER_CRITERIA_DOCUMENTATION = {
  customerVipDefinition:
    'customer VIP means a store-scoped customer candidate derived from customer memory signals.',
  futureSignals: ['recent inquiries', 'reservations', 'waiting entries', 'POS LTV integration'],
  longTermSignals: ['lifetime value', 'order count', 'visit count', 'preference depth'],
  masking: ['masked name', 'masked contact', 'aggregate evidence only'],
  reportLabels: ['VIP 고객 후보', '이번 주 다시 부를 고객', '객단가 상승 가능 고객', '휴면 위험 고객', '확인 전용 리포트'],
  shortTermSignals: ['recent visit', 'recent order', 'recent customer timeline event'],
  storeTenancy: 'every report candidate must match the active store_id before scoring.',
  subscriptionVipDefinition:
    'subscription VIP means the store plan; it is never a customer VIP scoring signal.',
} as const;

const VIP_VISIT_THRESHOLD = 5;
const VIP_ORDER_THRESHOLD = 5;
const VIP_LIFETIME_VALUE_THRESHOLD = 300000;
const REVISIT_WINDOW_DAYS = 14;
const DORMANCY_RISK_DAYS = 45;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeCustomerId(customer: Pick<Customer, 'customer_id' | 'id'>) {
  return customer.customer_id || customer.id;
}

function isSameStore<T extends { store_id: string }>(storeId: string, item: T) {
  return item.store_id === storeId;
}

function latestDate(values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => right!.localeCompare(left!))[0];
}

function maskPlainText(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 'masked';
  }

  if (normalized.length <= 1) {
    return '*';
  }

  return `${normalized[0]}${'*'.repeat(Math.min(normalized.length - 1, 10))}`;
}

export function maskVipCustomerName(value?: string | null) {
  return maskPlainText(value || '');
}

export function maskVipCustomerContact(value?: string | null, type: 'email' | 'phone' = 'phone') {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 'contact unavailable';
  }

  if (type === 'email') {
    const [localPart, domain] = normalized.toLowerCase().split('@');
    if (!localPart || !domain) {
      return 'contact unavailable';
    }

    return `${localPart[0]}***@${domain}`;
  }

  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 7) {
    return 'contact unavailable';
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  }

  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function resolveMaskedContact(customer: Customer) {
  return (
    maskVipCustomerContact(customer.phone, 'phone') ||
    maskVipCustomerContact(customer.email, 'email') ||
    'contact unavailable'
  );
}

function numericField(customer: CustomerVipFieldSource, key: 'customer_value' | 'lifetime_value' | 'order_count') {
  const value = customer[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function resolveVipReasons(input: {
  customer: CustomerVipFieldSource;
  orderCount: number;
  totalOrderAmount: number;
}) {
  const reasons: VipCustomerReason[] = [];
  const tags = Array.isArray(input.customer.tags) ? input.customer.tags : [];
  const segmentValues = [input.customer.segment, input.customer.tier, ...tags]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);
  const lifetimeValue = Math.max(
    input.totalOrderAmount,
    numericField(input.customer, 'customer_value'),
    numericField(input.customer, 'lifetime_value'),
  );
  const orderCount = Math.max(input.orderCount, numericField(input.customer, 'order_count'));

  if (input.customer.vip === true || input.customer.is_vip === true) {
    reasons.push('explicit_vip_field');
  }

  if (segmentValues.includes('vip')) {
    reasons.push('segment_or_tag');
  }

  if (input.customer.visit_count >= VIP_VISIT_THRESHOLD) {
    reasons.push('visit_count_threshold');
  }

  if (orderCount >= VIP_ORDER_THRESHOLD) {
    reasons.push('order_count_threshold');
  }

  if (lifetimeValue >= VIP_LIFETIME_VALUE_THRESHOLD) {
    reasons.push('lifetime_value_threshold');
  }

  return [...new Set(reasons)];
}

function summarizePreferences(preference: CustomerPreference | undefined) {
  const tags = (preference?.preference_tags || []).map(normalizeText).filter(Boolean).slice(0, 3);
  return tags.length ? tags.join(', ') : 'preference summary unavailable';
}

function summarizeRecentEvent(event: CustomerTimelineEvent | undefined, latestOrder: Order | undefined) {
  if (event) {
    return `${event.event_type} at ${event.occurred_at}`;
  }

  if (latestOrder) {
    return `order at ${latestOrder.placed_at}`;
  }

  return 'no recent event';
}

function daysSince(value: string | undefined, referenceDate: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const reference = Date.parse(referenceDate);
  const target = Date.parse(value);
  if (!Number.isFinite(reference) || !Number.isFinite(target)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((reference - target) / 86_400_000);
}

function toReportCandidate(card: VipCustomerReadonlyCard): VipCustomerReadonlyReportCandidate {
  return {
    customerId: card.customerId,
    maskedContact: card.maskedContact,
    maskedDisplayName: card.maskedDisplayName,
    reasonSummary: card.vipReasons.join(', '),
    totalOrderAmount: card.totalOrderAmount,
    totalVisitCount: card.totalVisitCount,
  };
}

function resolveStoreSubscriptionPlan(
  plan?: SubscriptionPlan,
  subscriptions?: StoreSubscription[],
  storeId?: string,
) {
  if (plan) {
    return plan;
  }

  return subscriptions?.find((subscription) => subscription.store_id === storeId)?.plan;
}

export function buildVipCustomerReadonlyView(input: {
  customers: Customer[];
  orders?: Order[];
  preferences?: CustomerPreference[];
  storeId: string;
  storeSubscriptionPlan?: SubscriptionPlan;
  storeSubscriptions?: StoreSubscription[];
  timelineEvents?: CustomerTimelineEvent[];
}): VipCustomerReadonlyView {
  const customers = input.customers.filter((customer) => isSameStore(input.storeId, customer));
  const orders = (input.orders || []).filter((order) => isSameStore(input.storeId, order));
  const preferences = (input.preferences || []).filter((preference) => isSameStore(input.storeId, preference));
  const timelineEvents = (input.timelineEvents || []).filter((event) => isSameStore(input.storeId, event));
  const vipCustomers = customers
    .flatMap((customer): VipCustomerReadonlyCard[] => {
      const customerId = normalizeCustomerId(customer);
      const customerOrders = orders
        .filter((order) => order.customer_id === customerId)
        .sort((left, right) => right.placed_at.localeCompare(left.placed_at));
      const customerTimeline = timelineEvents
        .filter((event) => event.customer_id === customerId)
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
      const totalOrderAmount = customerOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const vipReasons = resolveVipReasons({
        customer: customer as CustomerVipFieldSource,
        orderCount: customerOrders.length,
        totalOrderAmount,
      });

      if (!vipReasons.length) {
        return [];
      }

      const preference = preferences.find((item) => item.customer_id === customerId);
      const lastActivityAt = latestDate([
        customer.last_visit_at,
        customerOrders[0]?.placed_at,
        customerTimeline[0]?.occurred_at,
      ]);

      const card: VipCustomerReadonlyCard = {
        allowedActions: [],
        customerId,
        expectedNextAction: 'review profile summary before any separately approved outreach',
        maskedContact: resolveMaskedContact(customer),
        maskedDisplayName: maskVipCustomerName(customer.name),
        orderCount: customerOrders.length,
        preferenceSummary: summarizePreferences(preference),
        profileSummaryText: `visits=${customer.visit_count}; orders=${customerOrders.length}; total=${totalOrderAmount}`,
        readOnly: true,
        recentEventSummary: summarizeRecentEvent(customerTimeline[0], customerOrders[0]),
        totalOrderAmount,
        totalVisitCount: customer.visit_count,
        vipReasons,
        ...(lastActivityAt ? { lastActivityAt } : {}),
      };

      return [card];
    })
    .sort((left, right) => {
      if (right.totalOrderAmount !== left.totalOrderAmount) {
        return right.totalOrderAmount - left.totalOrderAmount;
      }

      return (right.lastActivityAt || '').localeCompare(left.lastActivityAt || '');
    });

  return {
    emptyState: {
      description:
        'Customer visits, orders, reservations, inquiries, and preferences can create VIP candidates after more memory signals accumulate.',
      title: 'No VIP customer candidates yet',
    },
    readOnlyNotice:
      'This is a read-only VIP customer memory view. It does not change customer tier, edit notes, send notifications, or write production data.',
    summary: {
      storeId: input.storeId,
      storeSubscriptionPlan: resolveStoreSubscriptionPlan(
        input.storeSubscriptionPlan,
        input.storeSubscriptions,
        input.storeId,
      ),
      subscriptionPlanIsCustomerVipSource: false,
      totalCustomersReviewed: customers.length,
      vipCustomerCount: vipCustomers.length,
    },
    vipCustomers,
  };
}

export function buildVipCustomerReadonlyReportSample(input: {
  customers: Customer[];
  orders?: Order[];
  preferences?: CustomerPreference[];
  referenceDate?: string;
  storeId: string;
  storeSubscriptionPlan?: SubscriptionPlan;
  storeSubscriptions?: StoreSubscription[];
  timelineEvents?: CustomerTimelineEvent[];
}): VipCustomerReadonlyReportSample {
  const referenceDate = input.referenceDate || new Date().toISOString();
  const view = buildVipCustomerReadonlyView(input);
  const recentCandidates = view.vipCustomers
    .filter((card) => daysSince(card.lastActivityAt, referenceDate) <= REVISIT_WINDOW_DAYS)
    .map(toReportCandidate);
  const averageOrderCandidates = view.vipCustomers
    .filter((card) => card.orderCount > 0 && card.totalOrderAmount / card.orderCount >= VIP_LIFETIME_VALUE_THRESHOLD / 2)
    .map(toReportCandidate);
  const dormancyRiskCandidates = view.vipCustomers
    .filter((card) => daysSince(card.lastActivityAt, referenceDate) >= DORMANCY_RISK_DAYS)
    .map(toReportCandidate);

  return {
    allowedActions: [],
    readOnlyNotice:
      '확인 전용 리포트입니다. 발송/수정 기능은 별도 승인 후 확장하며, 이 샘플은 고객 등급이나 운영 데이터를 바꾸지 않습니다.',
    sections: [
      {
        candidates: recentCandidates,
        description: '최근 방문/주문/이벤트가 있어 이번 주 재방문 제안을 검토할 수 있는 VIP 고객 후보입니다.',
        id: 'revisit_this_week',
        title: '이번 주 다시 부를 고객 후보',
      },
      {
        candidates: averageOrderCandidates,
        description: '평균 주문 금액이 높아 구성 추천이나 프리미엄 제안을 검토할 수 있는 VIP 고객 후보입니다.',
        id: 'raise_average_order_value',
        title: '객단가 상승 가능 고객 후보',
      },
      {
        candidates: dormancyRiskCandidates,
        description: '과거 VIP 신호는 강하지만 최근 활동이 줄어 재방문 검토가 필요한 고객 후보입니다.',
        id: 'dormancy_risk',
        title: '휴면 위험 VIP 고객 후보',
      },
    ],
    summary: {
      ...view.summary,
      campaignGateRequired: true,
      reportMode: 'sample_read_only',
    },
  };
}
