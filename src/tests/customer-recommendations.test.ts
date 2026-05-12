import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { resetDatabase } from '@/shared/lib/mockDb';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import {
  buildCustomerRecommendations,
  listRecommendedCustomers,
  upsertCustomerRecommendationAction,
} from '@/shared/lib/services/customerRecommendationService';
import type {
  Customer,
  CustomerContact,
  CustomerPreference,
  Order,
  OrderItem,
  Reservation,
  StoreReview,
  WaitingEntry,
} from '@/shared/types/models';

const STORE_ID = 'store_golden_coffee';
const OTHER_STORE_ID = 'store_mint_bbq';
const CUSTOMER_ID = 'customer_reco_1';
const OTHER_CUSTOMER_ID = 'customer_reco_other';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';
const REFERENCE_DATE = '2026-05-13T00:00:00.000Z';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    email: '',
    id: CUSTOMER_ID,
    is_regular: false,
    last_visit_at: '2026-04-01T00:00:00.000Z',
    marketing_opt_in: true,
    name: '',
    phone: '',
    store_id: STORE_ID,
    updated_at: '2026-05-01T00:00:00.000Z',
    visit_count: 3,
    ...overrides,
  };
}

function contact(overrides: Partial<CustomerContact> = {}): CustomerContact {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    customer_id: CUSTOMER_ID,
    id: `contact_${overrides.type || 'phone'}`,
    is_primary: true,
    is_verified: true,
    normalized_value: '01012345678',
    store_id: STORE_ID,
    type: 'phone',
    updated_at: '2026-01-01T00:00:00.000Z',
    value: '010-1234-5678',
    ...overrides,
  };
}

function preference(overrides: Partial<CustomerPreference> = {}): CustomerPreference {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    customer_id: CUSTOMER_ID,
    id: 'preference_1',
    marketing_opt_in: true,
    preference_tags: [],
    store_id: STORE_ID,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function order(overrides: Partial<Order & { items?: OrderItem[]; raw?: unknown }> = {}): Order & { items?: OrderItem[]; raw?: unknown } {
  return {
    channel: 'table',
    customer_id: CUSTOMER_ID,
    id: 'order_1',
    items: [
      item({ id: 'item_1', menu_name: '아메리카노', order_id: 'order_1', quantity: 1, unit_price: 4500 }),
      item({ id: 'item_2', menu_name: '치즈케이크', order_id: 'order_1', quantity: 1, unit_price: 7000 }),
    ],
    payment_status: 'paid',
    placed_at: '2026-04-01T00:00:00.000Z',
    status: 'completed',
    store_id: STORE_ID,
    total_amount: 11500,
    ...overrides,
  };
}

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item_1',
    line_total: (overrides.unit_price || 4500) * (overrides.quantity || 1),
    menu_item_id: `menu_${overrides.menu_name || 'americano'}`,
    menu_name: '아메리카노',
    order_id: 'order_1',
    quantity: 1,
    store_id: STORE_ID,
    unit_price: 4500,
    ...overrides,
  };
}

function review(overrides: Partial<StoreReview> = {}): StoreReview {
  return {
    body: '다시 방문하고 싶은 경험이었습니다.',
    content_usage_consent: true,
    created_at: '2026-04-20T00:00:00.000Z',
    customer_id: CUSTOMER_ID,
    keywords: ['친절'],
    marketing_consent: true,
    media_urls: [],
    rating: 5,
    review_id: 'review_1',
    store_id: STORE_ID,
    updated_at: '2026-04-20T00:00:00.000Z',
    visibility_status: 'published',
    ...overrides,
  };
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    created_at: '2026-05-01T00:00:00.000Z',
    customer_id: CUSTOMER_ID,
    customer_name: '고객',
    id: 'reservation_1',
    party_size: 2,
    phone: '010-1234-5678',
    reserved_at: '2026-05-15T09:00:00.000Z',
    status: 'booked',
    store_id: STORE_ID,
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function waiting(overrides: Partial<WaitingEntry> = {}): WaitingEntry {
  return {
    created_at: '2026-05-10T00:00:00.000Z',
    customer_id: CUSTOMER_ID,
    customer_name: '고객',
    id: 'waiting_1',
    party_size: 2,
    phone: '010-1234-5678',
    quoted_wait_minutes: 20,
    status: 'seated',
    store_id: STORE_ID,
    updated_at: '2026-05-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('customer reorder and upsell recommendations', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('builds deterministic reorder, upsell, revisit, review, waiting, and content recommendations from scoped memory', () => {
    const recommendations = buildCustomerRecommendations({
      contacts: [contact()],
      customers: [customer(), customer({ id: OTHER_CUSTOMER_ID, store_id: OTHER_STORE_ID })],
      orders: [
        order(),
        order({
          id: 'order_2',
          items: [item({ id: 'item_3', menu_name: '아메리카노', order_id: 'order_2', quantity: 2 })],
          placed_at: '2026-03-25T00:00:00.000Z',
          total_amount: 9000,
        }),
        order({
          customer_id: OTHER_CUSTOMER_ID,
          id: 'order_other',
          store_id: OTHER_STORE_ID,
          total_amount: 999000,
        }),
      ],
      preferences: [preference()],
      referenceDate: REFERENCE_DATE,
      reservations: [reservation()],
      reviews: [review()],
      storeId: STORE_ID,
      waitingEntries: [waiting()],
    });

    expect(recommendations.map((item) => item.type)).toEqual(
      expect.arrayContaining(['reorder', 'upsell', 'revisit', 'review_request', 'reservation_followup', 'waiting_followup', 'content_conversion']),
    );
    expect(recommendations.every((item) => item.store_id === STORE_ID && item.customer_id === CUSTOMER_ID)).toBe(true);
    expect(recommendations.find((item) => item.type === 'reorder')).toMatchObject({
      can_execute: true,
      confidence: 'high',
      priority: 'high',
      suggested_action_label: '재주문 안내 후보',
    });
    expect(recommendations.find((item) => item.type === 'upsell')?.source_signals.join(' ')).toContain('아메리카노');
    expect(JSON.stringify(recommendations)).not.toContain('010-1234-5678');
    expect(JSON.stringify(recommendations)).not.toContain('public_token');
  });

  it('blocks outreach and content recommendations when consent, quiet mode, or contact data is missing', () => {
    const recommendations = buildCustomerRecommendations({
      contacts: [],
      customers: [customer({ marketing_opt_in: false })],
      orders: [order({ raw: { items: [{ menu_name: '라떼', quantity: 1, unit_price: 5500 }], public_token: 'token-should-not-leak' } })],
      preferences: [preference({ marketing_opt_in: false, preference_tags: ['quiet_mode'] })],
      referenceDate: REFERENCE_DATE,
      reviews: [review({ content_usage_consent: false, review_id: 'review_no_consent' })],
      storeId: STORE_ID,
    });

    const reorder = recommendations.find((item) => item.type === 'reorder');
    const content = recommendations.find((item) => item.type === 'content_conversion');

    expect(reorder).toMatchObject({
      blocked_reason: 'quiet_mode',
      can_execute: false,
    });
    expect(content).toMatchObject({
      blocked_reason: 'content_usage_consent_missing',
      can_execute: false,
    });
    expect(recommendations.some((item) => item.blocked_reason === 'contact_missing')).toBe(true);
    expect(JSON.stringify(recommendations)).not.toContain('token-should-not-leak');
  });

  it('persists action state per store/customer/recommendation key and denies other store actors', async () => {
    const recommendation = buildCustomerRecommendations({
      contacts: [contact()],
      customers: [customer()],
      orders: [order(), order({ id: 'order_2', items: [item({ order_id: 'order_2' })] })],
      preferences: [preference()],
      referenceDate: REFERENCE_DATE,
      storeId: STORE_ID,
    }).find((item) => item.type === 'reorder');

    expect(recommendation).toBeTruthy();

    const dismissed = await upsertCustomerRecommendationAction(
      STORE_ID,
      CUSTOMER_ID,
      {
        recommendationKey: recommendation!.recommendation_key,
        recommendationType: recommendation!.type,
        status: 'dismissed',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const completed = await upsertCustomerRecommendationAction(
      STORE_ID,
      CUSTOMER_ID,
      {
        recommendationKey: recommendation!.recommendation_key,
        recommendationType: recommendation!.type,
        status: 'completed',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect(completed.action_id).toBe(dismissed.action_id);
    expect(completed.status).toBe('completed');
    await expect(
      upsertCustomerRecommendationAction(
        STORE_ID,
        CUSTOMER_ID,
        {
          recommendationKey: recommendation!.recommendation_key,
          recommendationType: recommendation!.type,
          status: 'snoozed',
        },
        { actorProfileId: OTHER_PROFILE_ID },
      ),
    ).rejects.toThrow(/store member/i);
  });

  it('lists recommended customers and preserves customer/order/payment regressions', () => {
    const dashboard = listRecommendedCustomers({
      contacts: [contact()],
      customers: [customer({ name: '', phone: '' })],
      orders: [order(), order({ id: 'order_2', items: [item({ order_id: 'order_2' })] })],
      preferences: [preference()],
      referenceDate: REFERENCE_DATE,
      storeId: STORE_ID,
    });

    expect(dashboard[0]).toMatchObject({
      customer_id: CUSTOMER_ID,
      top_recommendation_type: 'reorder',
    });
    expect(dashboard[0].display_label).not.toBe('미등록 고객');
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'free')).toMatchObject({
      cta_href: '/onboarding?plan=free',
      price_amount: 0,
    });
    expect(PAYMENT_TEST_100_PRODUCT).toMatchObject({
      amount: 100,
      grants_entitlement: false,
      is_visible_public: false,
    });
    expect(ENABLE_MYBI_COMPANION).toBe(false);
  });

  it('ships a non-destructive store-member-scoped action state migration', () => {
    const sql = readFileSync('supabase/migrations/20260513_customer_recommendation_actions.sql', 'utf8').toLowerCase();

    expect(sql).toContain('create table if not exists public.customer_recommendation_actions');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('from public.store_members');
    expect(sql).toContain('unique (store_id, customer_id, recommendation_key)');
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('truncate');
    expect(sql).not.toContain('delete from');
  });
});
