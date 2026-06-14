import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCustomerDisplayLabel } from '@/shared/lib/customerDisplay';

// Live-schema compatibility paths can exceed Vitest's 5s default on Windows.
const LIVE_COMPAT_TEST_TIMEOUT_MS = 15_000;

const liveState = {
  customerContacts: [
    {
      contact_type: 'phone',
      customer_id: 'customer_live_001',
      id: 'contact_phone_live_001',
      is_primary: true,
      normalized_value: '01070001005',
      raw_value: '010-7000-1005',
    },
  ] as Array<Record<string, unknown>>,
  customerTimelineEvents: [
    {
      created_at: '2026-04-24T06:00:00.000Z',
      customer_id: 'customer_live_001',
      event_type: 'order_linked',
      id: 'timeline_order_linked_001',
      metadata: {
        items_count: 1,
        items_summary: '브런치 세트 x1',
        name: 'QA 주문 고객',
        order_id: 'order_live_001',
        payment_source: 'counter',
        payment_status: 'pending',
        table_id: 'table_live_001',
        table_no: '1',
      },
      occurred_at: '2026-04-24T06:00:00.000Z',
      source: 'public_order',
      store_id: 'store-live-001',
      summary: '주문 고객 정보가 고객 메모리에 연결되었습니다.',
    },
  ] as Array<Record<string, unknown>>,
  customers: [
    {
      customer_id: 'customer_live_001',
      customer_key: '01070001005',
      first_seen_at: '2026-04-24T05:56:57.722+00:00',
      last_seen_at: '2026-04-24T05:56:57.722+00:00',
      marketing_consent: true,
      store_id: 'store-live-001',
      tags: [],
    },
  ] as Array<Record<string, unknown>>,
  orders: [
    {
      created_at: '2026-04-24T05:55:00.000Z',
      order_id: 'order_live_001',
      status: 'pending',
      store_id: 'store-live-001',
      submitted_at: '2026-04-24T05:55:00.000Z',
      table_id: 'table_live_001',
      total_amount: 19500,
    },
  ] as Array<Record<string, unknown>>,
  orderItems: [] as Array<Record<string, unknown>>,
  paymentEvents: [] as Array<Record<string, unknown>>,
  storeTables: [
    {
      status: 'occupied',
      status_updated_at: '2026-04-24T05:55:00.000Z',
      store_id: 'store-live-001',
      table_id: 'table_live_001',
      table_no: '1',
    },
  ] as Array<Record<string, unknown>>,
};

function createThenableQuery(resultFactory: () => { data: unknown; error: unknown }) {
  const query = {
    eq(column: string, value: unknown) {
      return createThenableQuery(() => {
        const current = resultFactory();
        return {
          ...current,
          data: Array.isArray(current.data)
            ? current.data.filter((row) => (row as Record<string, unknown>)[column] === value)
            : current.data,
        };
      });
    },
    in(column: string, values: unknown[]) {
      return createThenableQuery(() => {
        const current = resultFactory();
        return {
          ...current,
          data: Array.isArray(current.data)
            ? current.data.filter((row) => values.includes((row as Record<string, unknown>)[column]))
            : current.data,
        };
      });
    },
    maybeSingle: async () => {
      const current = resultFactory();
      return {
        data: Array.isArray(current.data) ? current.data[0] || null : current.data,
        error: current.error,
      };
    },
    order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
      return createThenableQuery(() => {
        const current = resultFactory();
        return {
          ...current,
          data: Array.isArray(current.data)
            ? [...current.data].sort((left, right) => {
                const leftValue = String((left as Record<string, unknown>)[column] || '');
                const rightValue = String((right as Record<string, unknown>)[column] || '');
                return ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
              })
            : current.data,
        };
      });
    },
    select() {
      return query;
    },
    then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(resultFactory()).then(resolve);
    },
  };

  return query;
}

async function loadService() {
  vi.resetModules();
  vi.stubGlobal('window', {
    location: {
      origin: 'https://mybiz.ai.kr',
    },
  });

  const actualAppConfig = await vi.importActual<typeof import('@/shared/lib/appConfig')>('@/shared/lib/appConfig');
  const actualRepositoryModule = await vi.importActual<typeof import('@/shared/lib/repositories/supabaseRepository')>(
    '@/shared/lib/repositories/supabaseRepository',
  );

  const supabase = {
    from(table: string) {
      if (table === 'orders') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.orders, error: null })),
        };
      }

      if (table === 'order_items') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.orderItems, error: null })),
        };
      }

      if (table === 'payment_events') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.paymentEvents, error: null })),
        };
      }

      if (table === 'customers') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.customers, error: null })),
        };
      }

      if (table === 'customer_contacts') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.customerContacts, error: null })),
        };
      }

      if (table === 'customer_timeline_events') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.customerTimelineEvents, error: null })),
        };
      }

      if (table === 'store_tables') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.storeTables, error: null })),
        };
      }

      throw new Error(`Unexpected table lookup: ${table}`);
    },
  };

  vi.doMock('@/shared/lib/appConfig', () => ({
    ...actualAppConfig,
    DATA_PROVIDER: 'supabase',
    IS_DEMO_RUNTIME: false,
    IS_LIVE_RUNTIME: true,
    IS_PRODUCTION_RUNTIME: true,
  }));
  vi.doMock('@/integrations/supabase/client', () => ({
    supabase,
  }));
  vi.doMock('@/shared/lib/repositories/index', () => ({
    getCanonicalMyBizRepository: () => actualRepositoryModule.createSupabaseRepository(supabase as never),
  }));

  return import('@/shared/lib/services/mvpService');
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock('@/shared/lib/appConfig');
  vi.doUnmock('@/integrations/supabase/client');
  vi.doUnmock('@/shared/lib/repositories/index');
});

describe('merchant orders customer truth', () => {
  it('resolves a legacy live order customer from order_linked timeline when payment_events are not readable', async () => {
    const service = await loadService();

    const orders = await service.listOrders('store-live-001');

    expect(orders[0]).toMatchObject({
      customer_id: 'customer_live_001',
      id: 'order_live_001',
      payment_source: 'counter',
      table_no: '1',
    });
    expect(orders[0]?.items[0]?.menu_name).toBe('브런치 세트 x1');
    expect(getCustomerDisplayLabel({ customer: orders[0]?.customer, customerId: orders[0]?.customer_id })).toBe('QA 주문 고객');
  }, LIVE_COMPAT_TEST_TIMEOUT_MS);

  it('does not attach a customer when timeline metadata points at another order', async () => {
    liveState.customerTimelineEvents[0] = {
      ...liveState.customerTimelineEvents[0],
      metadata: {
        order_id: 'other_order',
      },
    };

    const service = await loadService();
    const orders = await service.listOrders('store-live-001');

    expect(orders[0]?.customer_id).toBeUndefined();
    expect(getCustomerDisplayLabel({ customer: orders[0]?.customer, customerId: orders[0]?.customer_id })).toBe('미등록 고객');
  });

  it('preserves a direct orders.customer_id even when the customer display record is not readable', async () => {
    liveState.orders[0] = {
      ...liveState.orders[0],
      customer_id: 'a1b2c3d4-e5f6-7890-abcd-111122223333',
      order_id: 'order_live_001',
      store_id: 'store-live-001',
    };
    liveState.customers = [];
    liveState.customerContacts = [];
    liveState.customerTimelineEvents = [];

    const service = await loadService();
    const orders = await service.listOrders('store-live-001');

    expect(orders[0]?.customer_id).toBe('a1b2c3d4-e5f6-7890-abcd-111122223333');
    expect(getCustomerDisplayLabel({ customer: orders[0]?.customer, customerId: orders[0]?.customer_id })).toBe('고객 #223333');
  });

  it('uses canonical order_items when they are available for a legacy live order', async () => {
    liveState.orders[0] = {
      created_at: '2026-04-24T05:55:00.000Z',
      id: '11111111-1111-1111-1111-111111111111',
      order_id: 'order_live_001',
      status: 'pending',
      store_id: 'store-live-001',
      submitted_at: '2026-04-24T05:55:00.000Z',
      table_id: 'table_live_001',
      total_amount: 18000,
    };
    liveState.customers = [];
    liveState.customerContacts = [];
    liveState.customerTimelineEvents = [];
    liveState.orderItems = [
      {
        id: '22222222-2222-2222-2222-222222222222',
        order_id: '11111111-1111-1111-1111-111111111111',
        store_id: 'store-live-001',
        item_name: 'Canonical set',
        quantity: 2,
        unit_price: 9000,
        total_price: 18000,
      },
    ];
    liveState.paymentEvents = [
      {
        created_at: '2026-04-24T05:55:10.000Z',
        order_id: 'order_live_001',
        raw: {
          items: [
            {
              item_name: 'Raw fallback item',
              quantity: 1,
              unit_price: 19500,
            },
          ],
        },
        status: 'pending',
      },
    ];

    const service = await loadService();
    const orders = await service.listOrders('store-live-001');

    expect(orders[0]?.items[0]).toMatchObject({
      id: '22222222-2222-2222-2222-222222222222',
      menu_name: 'Canonical set',
      quantity: 2,
      line_total: 18000,
    });
    expect(orders[0]?.items_source).toBe('canonical');
  });
});
