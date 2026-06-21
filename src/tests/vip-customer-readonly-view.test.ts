import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildVipCustomerReadonlyView,
  maskVipCustomerContact,
  maskVipCustomerName,
} from '@/shared/lib/services/vipCustomerReadonlyViewService';
import type { Customer, CustomerPreference, CustomerTimelineEvent, Order } from '@/shared/types/models';

const baseCustomer = {
  created_at: '2026-06-01T00:00:00.000Z',
  email: 'alpha@example.test',
  id: 'customer-alpha',
  is_regular: false,
  last_visit_at: '2026-06-10T00:00:00.000Z',
  marketing_opt_in: false,
  name: 'Alpha Guest',
  phone: '0000000000',
  store_id: 'store-a',
  updated_at: '2026-06-10T00:00:00.000Z',
  visit_count: 1,
} satisfies Customer;

function customer(overrides: Partial<Customer> & Record<string, unknown> = {}): Customer {
  return {
    ...baseCustomer,
    ...overrides,
  } as Customer;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    channel: 'table',
    id: 'order-a',
    payment_status: 'paid',
    placed_at: '2026-06-12T00:00:00.000Z',
    status: 'completed',
    store_id: 'store-a',
    total_amount: 120000,
    ...overrides,
  };
}

describe('VIP customer readonly view service', () => {
  it('filters only derived VIP customers for the requested store and never uses subscription VIP as customer VIP', () => {
    const result = buildVipCustomerReadonlyView({
      customers: [
        customer({ id: 'vip-by-orders', visit_count: 1 }),
        customer({ id: 'not-vip', name: 'Beta Guest', phone: '0000000001', visit_count: 1 }),
        customer({ id: 'other-store-vip', store_id: 'store-b', visit_count: 9 }),
      ],
      orders: [
        order({ customer_id: 'vip-by-orders', id: 'order-1', total_amount: 80000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-2', total_amount: 90000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-3', total_amount: 100000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-4', total_amount: 110000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-5', total_amount: 120000 }),
        order({ customer_id: 'other-store-vip', id: 'order-other', store_id: 'store-b', total_amount: 500000 }),
      ],
      storeId: 'store-a',
      storeSubscriptionPlan: 'vip',
    });

    expect(result.vipCustomers.map((item) => item.customerId)).toEqual(['vip-by-orders']);
    expect(result.vipCustomers[0]?.vipReasons).toContain('order_count_threshold');
    expect(result.vipCustomers[0]?.vipReasons).toContain('lifetime_value_threshold');
    expect(result.summary.storeSubscriptionPlan).toBe('vip');
    expect(result.summary.subscriptionPlanIsCustomerVipSource).toBe(false);
  });

  it('masks names and contacts while returning aggregate read-only profile evidence', () => {
    const result = buildVipCustomerReadonlyView({
      customers: [customer({ email: 'alpha@example.test', id: 'vip-alpha', name: 'Alpha Guest', visit_count: 6 })],
      orders: [order({ customer_id: 'vip-alpha', total_amount: 360000 })],
      preferences: [
        {
          created_at: '2026-06-01T00:00:00.000Z',
          customer_id: 'vip-alpha',
          id: 'preference-alpha',
          is_primary: true,
          marketing_opt_in: false,
          preference_tags: ['window seat', 'decaf'],
          store_id: 'store-a',
          updated_at: '2026-06-10T00:00:00.000Z',
        } as unknown as CustomerPreference,
      ],
      timelineEvents: [
        {
          created_at: '2026-06-12T00:00:00.000Z',
          customer_id: 'vip-alpha',
          event_type: 'order_linked',
          id: 'timeline-alpha',
          metadata: {},
          occurred_at: '2026-06-12T00:00:00.000Z',
          source: 'public_order',
          store_id: 'store-a',
          summary: 'order linked',
        } satisfies CustomerTimelineEvent,
      ],
      storeId: 'store-a',
    });

    const vip = result.vipCustomers[0];

    expect(maskVipCustomerName('Alpha Guest')).toBe('A**********');
    expect(maskVipCustomerContact('0000000000', 'phone')).toBe('000-***-0000');
    expect(maskVipCustomerContact('alpha@example.test', 'email')).toBe('a***@example.test');
    expect(vip?.maskedDisplayName).toBe('A**********');
    expect(vip?.maskedContact).toBe('000-***-0000');
    expect(vip?.profileSummaryText).toContain('orders=1');
    expect(vip?.preferenceSummary).toContain('window seat');
    expect(vip?.readOnly).toBe(true);
    expect(vip?.allowedActions).toEqual([]);
  });

  it('returns an empty read-only state when no customer reaches VIP rules', () => {
    const result = buildVipCustomerReadonlyView({
      customers: [customer({ id: 'not-vip', visit_count: 1 })],
      orders: [],
      storeId: 'store-a',
    });

    expect(result.vipCustomers).toEqual([]);
    expect(result.emptyState.title).toContain('VIP');
    expect(result.readOnlyNotice).toContain('read-only');
  });

  it('wires a read-only VIP customer panel into the customer dashboard page without write controls', () => {
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(pageSource).toContain('buildVipCustomerReadonlyView');
    expect(pageSource).toContain('VIP Customer Memory');
    expect(pageSource).toContain('read-only');
    expect(pageSource).not.toMatch(/vipCustomerMutation|setVip|updateVip|deleteVip|mergeVip|createVip/i);
  });
});
