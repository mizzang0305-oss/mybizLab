import { describe, expect, it } from 'vitest';

import {
  assertCustomerTimelineScope,
  assertCustomerWriteScope,
  assertTimelineEventWriteScope,
  buildStoreLocalCustomerDedupeKey,
  normalizePhoneForCustomerMemory,
} from '@/domain/mybiz/customerMemory';
import type { Customer, CustomerTimelineEvent } from '@/shared/types/models';

const baseCustomer: Customer = {
  id: 'customer_a',
  customer_id: 'customer_a',
  created_at: '2026-06-08T00:00:00.000Z',
  email: 'customer@example.com',
  is_regular: false,
  last_visit_at: '2026-06-08T00:00:00.000Z',
  marketing_opt_in: true,
  name: 'Pilot Customer',
  phone: '010-1234-5678',
  store_id: 'store_a',
  updated_at: '2026-06-08T00:00:00.000Z',
  visit_count: 1,
};

const baseTimelineEvent: CustomerTimelineEvent = {
  id: 'timeline_customer_a',
  created_at: '2026-06-08T00:00:00.000Z',
  customer_id: 'customer_a',
  event_type: 'contact_captured',
  metadata: {},
  occurred_at: '2026-06-08T00:00:00.000Z',
  source: 'public_store',
  store_id: 'store_a',
  summary: 'Customer contact captured for owner review.',
};

describe('customer memory spine', () => {
  it('normalizes phone numbers for store-local dedupe', () => {
    expect(normalizePhoneForCustomerMemory('010-1234-5678')).toBe('01012345678');
    expect(
      buildStoreLocalCustomerDedupeKey({
        phone: '010 1234 5678',
        storeId: 'store_a',
      }),
    ).toBe('store_a:phone:01012345678');
    expect(
      buildStoreLocalCustomerDedupeKey({
        phone: '010 1234 5678',
        storeId: 'store_b',
      }),
    ).toBe('store_b:phone:01012345678');
  });

  it('requires store_id before customer memory writes', () => {
    expect(assertCustomerWriteScope(baseCustomer)).toBe('store_a');
    expect(() =>
      assertCustomerWriteScope({
        ...baseCustomer,
        store_id: '',
      }),
    ).toThrow('CUSTOMER_MEMORY_STORE_ID_REQUIRED');
  });

  it('requires both store_id and customer_id for timeline ledger events', () => {
    expect(assertTimelineEventWriteScope(baseTimelineEvent)).toEqual({
      customerId: 'customer_a',
      storeId: 'store_a',
    });

    expect(() =>
      assertCustomerTimelineScope({
        customerId: '',
        storeId: 'store_a',
      }),
    ).toThrow('CUSTOMER_TIMELINE_CUSTOMER_ID_REQUIRED');
  });

  it('rejects dedupe when no store-local identity is available', () => {
    expect(() =>
      buildStoreLocalCustomerDedupeKey({
        storeId: 'store_a',
      }),
    ).toThrow('CUSTOMER_MEMORY_DEDUPE_IDENTITY_REQUIRED');
  });
});
