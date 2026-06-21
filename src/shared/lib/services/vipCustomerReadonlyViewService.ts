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

const VIP_VISIT_THRESHOLD = 5;
const VIP_ORDER_THRESHOLD = 5;
const VIP_LIFETIME_VALUE_THRESHOLD = 300000;

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
