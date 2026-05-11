import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { upsertCustomerMemory } from '@/shared/lib/services/customerMemoryService';
import type { Customer, CustomerPreference, CustomerTimelineEvent } from '@/shared/types/models';

const customer: Customer = {
  created_at: '2026-05-11T00:00:00.000Z',
  customer_id: 'a1b2c3d4-e5f6-7890-abcd-111122223333',
  email: undefined,
  id: 'a1b2c3d4-e5f6-7890-abcd-111122223333',
  is_regular: false,
  last_visit_at: undefined,
  marketing_opt_in: false,
  name: '',
  phone: '',
  store_id: 'store_order_001',
  updated_at: '2026-05-11T00:00:00.000Z',
  visit_count: 0,
};

const preference: CustomerPreference = {
  created_at: '2026-05-11T00:00:00.000Z',
  customer_id: customer.id,
  id: 'preference_001',
  marketing_opt_in: false,
  preference_tags: [],
  store_id: customer.store_id,
  updated_at: '2026-05-11T00:00:00.000Z',
};

const existingOrderEvent: CustomerTimelineEvent = {
  created_at: '2026-05-11T00:00:00.000Z',
  customer_id: customer.id,
  event_type: 'order_linked',
  id: 'timeline_order_linked_001',
  metadata: {
    order_id: 'order_001',
  },
  occurred_at: '2026-05-11T00:00:00.000Z',
  source: 'public_order',
  store_id: customer.store_id,
  summary: '주문 고객 정보가 고객 기억에 연결되었습니다.',
};

describe('order/customer canonical alignment', () => {
  it('does not create duplicate order_linked timeline events for the same order and customer', async () => {
    const appendTimelineEvent = vi.fn(async (event: CustomerTimelineEvent) => event);
    const repository = {
      appendTimelineEvent,
      listCustomerContacts: vi.fn(async () => []),
      listCustomerPreferences: vi.fn(async () => [preference]),
      listCustomerTimelineEvents: vi.fn(async () => [existingOrderEvent]),
      listCustomers: vi.fn(async () => [customer]),
      saveCustomer: vi.fn(async (nextCustomer: Customer) => nextCustomer),
      saveCustomerContact: vi.fn(),
      saveCustomerPreference: vi.fn(async (nextPreference: CustomerPreference) => nextPreference),
    };

    const result = await upsertCustomerMemory(
      {
        customerId: customer.id,
        eventType: 'order_linked',
        metadata: {
          order_id: 'order_001',
          payment_status: 'paid',
        },
        name: '김하나',
        source: 'public_order',
        storeId: customer.store_id,
        summary: '주문 고객 정보가 고객 기억에 연결되었습니다.',
        visitIncrement: 1,
      },
      { repository: repository as never },
    );

    expect(repository.listCustomerTimelineEvents).toHaveBeenCalledWith(customer.store_id, customer.id);
    expect(appendTimelineEvent).not.toHaveBeenCalled();
    expect(result.timelineEvent).toEqual(existingOrderEvent);
  });

  it('documents a manual dry-run backfill that never overwrites existing orders.customer_id', () => {
    const runbook = readFileSync('supabase/runbooks/20260511_order_customer_canonical_alignment.sql', 'utf8');

    expect(runbook).toContain('BEGIN;');
    expect(runbook).toContain('ROLLBACK;');
    expect(runbook).toMatch(/dry[- ]run count/i);
    expect(runbook).toMatch(/where\s+o\.customer_id\s+is\s+null/i);
    expect(runbook).not.toMatch(/customers\.(name|phone|email)|\bc\.(name|phone|email)\b/i);
    expect(runbook).not.toMatch(/payment_events\.store_id|\bpe\.store_id\b/i);
    expect(runbook).not.toMatch(/\bo\.id\b/i);
    expect(runbook).toMatch(/orders\.order_id::text|o\.order_id::text/i);
    expect(runbook).toContain('on pe.order_id = o.order_id_text');
    expect(runbook).toMatch(/^[^]*manual review[^]*$/i);
  });

  it('keeps payment event reads scoped through orders instead of payment_events.store_id', () => {
    const publicApi = readFileSync('src/server/publicApi.ts', 'utf8');
    const mvpService = readFileSync('src/shared/lib/services/mvpService.ts', 'utf8');

    expect(publicApi).not.toContain("selectOptionalList<Record<string, unknown>>(client, 'payment_events', storeId)");
    expect(`${publicApi}\n${mvpService}`).not.toMatch(/from\('payment_events'\)\.select\('\*'\)\.eq\('store_id'/);
  });
});
