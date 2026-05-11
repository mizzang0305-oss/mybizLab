import { describe, expect, it } from 'vitest';

import { getOrderItemSummary, ORDER_ITEMS_EMPTY_MESSAGE } from '@/shared/lib/orderItemsReadModel';
import {
  buildCustomerTimelineIntelligenceDashboard,
  getCustomerIntelligenceCard,
} from '@/shared/lib/services/customerTimelineIntelligenceService';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import type {
  Customer,
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
} from '@/shared/types/models';

const STORE_ID = 'store_intelligence';
const OTHER_STORE_ID = 'store_other';
const CUSTOMER_ID = 'customer_111122223333';
const OTHER_CUSTOMER_ID = 'customer_444455556666';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    created_at: '2026-03-01T00:00:00.000Z',
    email: '',
    id: CUSTOMER_ID,
    is_regular: false,
    last_visit_at: '2026-04-01T09:00:00.000Z',
    marketing_opt_in: true,
    name: '????',
    phone: '',
    store_id: STORE_ID,
    updated_at: '2026-04-01T09:00:00.000Z',
    visit_count: 2,
    ...overrides,
  };
}

function order(overrides: Partial<Order> & { items?: OrderItem[]; raw?: unknown } = {}): Order & { items?: OrderItem[]; raw?: unknown } {
  return {
    channel: 'table',
    customer_id: CUSTOMER_ID,
    id: 'order_1',
    payment_status: 'paid',
    placed_at: '2026-04-01T09:00:00.000Z',
    status: 'completed',
    store_id: STORE_ID,
    total_amount: 12000,
    ...overrides,
  };
}

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item_1',
    line_total: 9000,
    menu_item_id: 'menu_americano',
    menu_name: '아메리카노',
    order_id: 'order_1',
    quantity: 2,
    store_id: STORE_ID,
    unit_price: 4500,
    ...overrides,
  };
}

function review(overrides: Partial<StoreReview> = {}): StoreReview {
  return {
    body: '커피가 좋고 직원 응대가 따뜻했습니다.',
    content_usage_consent: true,
    created_at: '2026-04-03T09:00:00.000Z',
    customer_id: CUSTOMER_ID,
    keywords: ['커피', '응대'],
    marketing_consent: true,
    media_urls: [],
    rating: 5,
    review_id: 'review_1',
    store_id: STORE_ID,
    updated_at: '2026-04-03T09:00:00.000Z',
    visibility_status: 'published',
    ...overrides,
  };
}

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    category: 'general',
    created_at: '2026-04-02T09:00:00.000Z',
    customer_id: CUSTOMER_ID,
    customer_name: '민지 고객',
    id: 'inquiry_1',
    marketing_opt_in: true,
    message: '예약 가능 여부를 문의했습니다.',
    phone: '010-1111-2222',
    source: 'public_form',
    status: 'completed',
    store_id: STORE_ID,
    tags: ['예약 관심'],
    updated_at: '2026-04-02T09:00:00.000Z',
    ...overrides,
  };
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    created_at: '2026-04-04T09:00:00.000Z',
    customer_id: CUSTOMER_ID,
    customer_name: '민지 고객',
    id: 'reservation_1',
    party_size: 2,
    phone: '010-1111-2222',
    reserved_at: '2026-04-10T10:00:00.000Z',
    status: 'booked',
    store_id: STORE_ID,
    updated_at: '2026-04-04T09:00:00.000Z',
    ...overrides,
  };
}

function waiting(overrides: Partial<WaitingEntry> = {}): WaitingEntry {
  return {
    created_at: '2026-04-05T09:00:00.000Z',
    customer_id: CUSTOMER_ID,
    customer_name: '민지 고객',
    id: 'waiting_1',
    party_size: 2,
    phone: '010-1111-2222',
    quoted_wait_minutes: 15,
    status: 'seated',
    store_id: STORE_ID,
    updated_at: '2026-04-05T09:00:00.000Z',
    ...overrides,
  };
}

function timelineEvent(overrides: Partial<CustomerTimelineEvent> = {}): CustomerTimelineEvent {
  return {
    created_at: '2026-04-01T09:00:00.000Z',
    customer_id: CUSTOMER_ID,
    event_type: 'order_linked',
    id: 'timeline_1',
    metadata: { order_id: 'order_1', public_token: 'secret-token-should-not-leak' },
    occurred_at: '2026-04-01T09:00:00.000Z',
    source: 'public_order',
    store_id: STORE_ID,
    summary: '주문이 고객 기억에 연결되었습니다.',
    ...overrides,
  };
}

describe('customer timeline intelligence dashboard', () => {
  it('aggregates customer memory without exposing raw payload or marking linked orders as unregistered', () => {
    const dashboard = buildCustomerTimelineIntelligenceDashboard({
      blogPosts: [
        {
          body: '후기를 바탕으로 만든 블로그 초안입니다.',
          created_at: '2026-04-06T09:00:00.000Z',
          media_urls: [],
          post_id: 'blog_1',
          slug: 'review-story',
          source_review_id: 'review_1',
          source_type: 'review',
          status: 'draft',
          store_id: STORE_ID,
          tags: [],
          title: '후기 소개',
          updated_at: '2026-04-06T09:00:00.000Z',
        } satisfies StoreBlogPost,
      ],
      customers: [customer(), customer({ id: OTHER_CUSTOMER_ID, store_id: OTHER_STORE_ID })],
      inquiries: [inquiry(), inquiry({ id: 'inquiry_other', store_id: OTHER_STORE_ID })],
      orders: [
        order({ items: [item()] }),
        order({
          id: 'order_2',
          placed_at: '2026-04-07T09:00:00.000Z',
          raw: {
            items: [{ menu_name: '치즈케이크', quantity: 1, unit_price: 7000 }],
            public_token: 'secret-token-should-not-leak',
          },
          total_amount: 7000,
        }),
        order({ customer_id: OTHER_CUSTOMER_ID, id: 'order_other', store_id: OTHER_STORE_ID }),
      ],
      preferences: [],
      reservations: [reservation()],
      reviews: [review()],
      socialJobs: [
        {
          created_at: '2026-04-06T10:00:00.000Z',
          hashtags: [],
          job_id: 'job_1',
          provider: 'mybiz_blog',
          source_id: 'blog_1',
          source_type: 'blog_post',
          status: 'draft',
          store_id: STORE_ID,
          updated_at: '2026-04-06T10:00:00.000Z',
        } satisfies SocialPublishJob,
      ],
      storeId: STORE_ID,
      timelineEvents: [
        timelineEvent(),
        timelineEvent({ id: 'timeline_duplicate', metadata: { order_id: 'order_1' } }),
      ],
      waitingEntries: [waiting()],
    });

    expect(dashboard.cards).toHaveLength(1);
    const card = dashboard.cards[0]!;
    expect(card.displayLabel).not.toBe('미등록 고객');
    expect(card.counts).toMatchObject({
      inquiries: 1,
      orders: 2,
      reservations: 1,
      reviews: 1,
      waitingEntries: 1,
    });
    expect(card.totalOrderAmount).toBe(19000);
    expect(card.averageOrderAmount).toBe(9500);
    expect(card.recentOrderItemSummary).toBe('치즈케이크 x1');
    expect(card.frequentItems[0]).toMatchObject({ menuName: '아메리카노', quantity: 2 });
    expect(card.timeline.filter((event) => event.type === 'order_linked')).toHaveLength(1);
    expect(JSON.stringify(card)).not.toContain('secret-token-should-not-leak');
  });

  it('builds deterministic next actions while respecting quiet mode and review consent', () => {
    const activeCard = getCustomerIntelligenceCard(
      buildCustomerTimelineIntelligenceDashboard({
        customers: [customer({ last_visit_at: '2026-03-01T09:00:00.000Z' })],
        orders: [
          order({
            id: 'old_order_1',
            items: [item({ order_id: 'old_order_1', quantity: 2 })],
            placed_at: '2026-03-01T09:00:00.000Z',
            total_amount: 72000,
          }),
          order({
            id: 'old_order_2',
            items: [item({ id: 'item_2', order_id: 'old_order_2', quantity: 1 })],
            placed_at: '2026-02-20T09:00:00.000Z',
            total_amount: 68000,
          }),
        ],
        preferences: [],
        reviews: [review({ content_usage_consent: false, review_id: 'review_no_consent' })],
        storeId: STORE_ID,
      }),
      CUSTOMER_ID,
    );

    expect(activeCard?.nextActions.map((action) => action.id)).toEqual(
      expect.arrayContaining(['revisit_outreach', 'reorder_prompt', 'vip_candidate']),
    );
    expect(activeCard?.nextActions.map((action) => action.id)).not.toContain('blog_draft_from_review');

    const quietCard = getCustomerIntelligenceCard(
      buildCustomerTimelineIntelligenceDashboard({
        customers: [customer()],
        orders: [order({ items: [item()] })],
        preferences: [
          {
            created_at: '2026-03-01T00:00:00.000Z',
            customer_id: CUSTOMER_ID,
            id: 'pref_1',
            marketing_opt_in: true,
            preference_tags: ['quiet_mode'],
            store_id: STORE_ID,
            updated_at: '2026-03-01T00:00:00.000Z',
          } satisfies CustomerPreference,
        ],
        reviews: [review()],
        storeId: STORE_ID,
      }),
      CUSTOMER_ID,
    );

    expect(quietCard?.quietMode).toBe(true);
    expect(quietCard?.nextActions.some((action) => action.kind === 'outreach')).toBe(false);
    expect(quietCard?.nextActions.map((action) => action.id)).toContain('blog_draft_from_review');
  });

  it('keeps empty item state, order item compatibility, and payment regressions safe', () => {
    const dashboard = buildCustomerTimelineIntelligenceDashboard({
      customers: [customer()],
      orders: [order({ id: 'empty_order', total_amount: 0 })],
      storeId: STORE_ID,
    });
    const card = dashboard.cards[0]!;

    expect(card.recentOrderItemSummary).toBe(ORDER_ITEMS_EMPTY_MESSAGE);
    expect(getOrderItemSummary([])).toBe(ORDER_ITEMS_EMPTY_MESSAGE);
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'free')).toMatchObject({
      cta_href: '/onboarding?plan=free',
      price_amount: 0,
    });
    expect(PAYMENT_TEST_100_PRODUCT).toMatchObject({
      amount: 100,
      grants_entitlement: false,
      is_visible_public: false,
      product_code: 'payment_test_100',
    });
    expect(ENABLE_MYBI_COMPANION).toBe(false);
  });
});
