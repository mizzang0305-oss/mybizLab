import { afterEach, describe, expect, it, vi } from 'vitest';

const orderState = {
  customerContacts: [] as Array<Record<string, unknown>>,
  customerTimelineEvents: [] as Array<Record<string, unknown>>,
  customers: [
    {
      customer_id: 'customer_live_001',
      store_id: 'store-live-001',
      name: '김손님',
      phone: '010-1234-5678',
      email: 'guest@example.com',
      visit_count: 1,
      last_visit_at: '2026-04-23T09:00:00.000Z',
      is_regular: false,
      marketing_opt_in: true,
      created_at: '2026-04-23T09:00:00.000Z',
      updated_at: '2026-04-23T09:00:00.000Z',
    },
  ] as Array<Record<string, unknown>>,
  orderItems: [] as Array<Record<string, unknown>>,
  orders: [
    {
      order_id: 'order_live_001',
      store_id: 'store-live-001',
      table_id: 'table_live_001',
      status: 'pending',
      total_amount: 18000,
      created_at: '2026-04-23T09:00:00.000Z',
      submitted_at: '2026-04-23T09:00:00.000Z',
    },
  ],
  paymentEvents: [
    {
      id: 'payment_event_created',
      provider: 'mybiz',
      event_id: 'public-order:created',
      order_id: 'order_live_001',
      user_id: null,
      status: 'pending',
      amount: 18000,
      raw: {
        items: [
          {
            id: 'compat_item_001',
            menu_item_id: 'menu_live_001',
            menu_name: '브런치 세트',
            quantity: 1,
            unit_price: 18000,
            line_total: 18000,
          },
        ],
        payment_method: 'card',
        payment_source: 'mobile',
        payment_status: 'pending',
        table_no: 'A1',
      },
      created_at: '2026-04-23T09:00:00.000Z',
    },
  ] as Array<Record<string, unknown>>,
  storeTables: [
    {
      table_id: 'table_live_001',
      store_id: 'store-live-001',
      table_no: 'A1',
      status: 'occupied',
      status_updated_at: '2026-04-23T09:00:00.000Z',
    },
  ],
};

let orderItemsLookupCount = 0;

function createThenableQuery(resultFactory: () => { data: unknown; error: unknown }) {
  const query = {
    eq(column: string, value: unknown) {
      return createThenableQuery(() => {
        const current = resultFactory();
        if (!Array.isArray(current.data)) {
          return current;
        }

        return {
          data: current.data.filter((row) => (row as Record<string, unknown>)[column] === value),
          error: current.error,
        };
      });
    },
    in(column: string, values: unknown[]) {
      return createThenableQuery(() => {
        const current = resultFactory();
        if (!Array.isArray(current.data)) {
          return current;
        }

        return {
          data: current.data.filter((row) => values.includes((row as Record<string, unknown>)[column])),
          error: current.error,
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
    order(column: string, { ascending = true }: { ascending?: boolean }) {
      return createThenableQuery(() => {
        const current = resultFactory();
        if (!Array.isArray(current.data)) {
          return current;
        }

        const sorted = [...current.data].sort((left, right) => {
          const leftValue = String((left as Record<string, unknown>)[column] || '');
          const rightValue = String((right as Record<string, unknown>)[column] || '');
          return ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
        });

        return {
          data: sorted,
          error: current.error,
        };
      });
    },
    select() {
      return query;
    },
    single: async () => {
      const current = resultFactory();
      return {
        data: Array.isArray(current.data) ? current.data[0] || null : current.data,
        error: current.error,
      };
    },
    then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(resultFactory()).then(resolve);
    },
  };

  return query;
}

function createLegacyOrdersQuery() {
  return {
    eq(column: string, value: unknown) {
      if (column !== 'store_id') {
        return createLegacyOrdersQuery();
      }

      const filtered = orderState.orders.filter((row) => (row as Record<string, unknown>)[column] === value);
      return {
        order(requestedColumn: string) {
          if (requestedColumn === 'placed_at') {
            return Promise.resolve({
              data: null,
              error: {
                code: '42703',
                message: 'column orders.placed_at does not exist',
              },
            });
          }

          return Promise.resolve({ data: filtered, error: null });
        },
        then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        },
      };
    },
    select() {
      return createLegacyOrdersQuery();
    },
  };
}

async function loadLiveRuntimeOrderService() {
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
          select: () => createLegacyOrdersQuery(),
          update: (payload: Record<string, unknown>) => {
            const hasLegacyOnlyPaymentFields = ['payment_method', 'payment_source', 'payment_status', 'payment_recorded_at'].some((key) =>
              key in payload,
            );

            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () =>
                      hasLegacyOnlyPaymentFields
                        ? {
                            data: null,
                            error: {
                              code: '42703',
                              message: 'column payment_status does not exist',
                            },
                          }
                        : { data: null, error: null },
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === 'order_items') {
        orderItemsLookupCount += 1;
        return {
          select: () =>
            createThenableQuery(() => ({
              data: orderState.orderItems,
              error: {
                code: 'PGRST205',
                message: 'Could not find the table public.order_items in the schema cache',
              },
            })),
        };
      }

      if (table === 'payment_events') {
        return {
          insert: (payload: Record<string, unknown>) => {
            orderState.paymentEvents.push(payload);
            return Promise.resolve({ data: null, error: null });
          },
          select: () => createThenableQuery(() => ({ data: orderState.paymentEvents, error: null })),
        };
      }

      if (table === 'customers') {
        return {
          select: () => createThenableQuery(() => ({ data: orderState.customers, error: null })),
        };
      }

      if (table === 'customer_contacts') {
        return {
          select: () => createThenableQuery(() => ({ data: orderState.customerContacts, error: null })),
        };
      }

      if (table === 'customer_timeline_events') {
        return {
          select: () => createThenableQuery(() => ({ data: orderState.customerTimelineEvents, error: null })),
        };
      }

      if (table === 'store_tables') {
        return {
          select: () => createThenableQuery(() => ({ data: orderState.storeTables, error: null })),
        };
      }

      throw new Error(`Unexpected live compat table lookup: ${table}`);
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
  orderState.paymentEvents.splice(1);
  orderState.customerContacts.length = 0;
  orderState.customerTimelineEvents.length = 0;
  orderItemsLookupCount = 0;
});

describe('live runtime order compatibility', () => {
  it('reconstructs legacy live orders from payment_events and records payment through compat events', async () => {
    const service = await loadLiveRuntimeOrderService();

    const beforePayment = await service.listOrders('store-live-001');
    expect(beforePayment[0]).toMatchObject({
      id: 'order_live_001',
      payment_source: 'mobile',
      payment_status: 'pending',
      table_no: 'A1',
    });
    expect(beforePayment[0]?.items).toMatchObject([
      expect.objectContaining({
        menu_item_id: 'menu_live_001',
        quantity: 1,
      }),
    ]);
    expect(orderItemsLookupCount).toBe(0);

    const paidOrder = await service.recordOrderPayment('store-live-001', 'order_live_001', {
      paymentMethod: 'card',
      paymentSource: 'mobile',
    });

    expect(paidOrder).toMatchObject({
      id: 'order_live_001',
      payment_method: 'card',
      payment_source: 'mobile',
      payment_status: 'paid',
    });
    expect(orderState.paymentEvents.some((event) => (event.raw as Record<string, unknown>)?.payment_status === 'paid')).toBe(true);
  });

  it('keeps the newest compat customer link when payment_events arrive out of order', async () => {
    orderState.paymentEvents.splice(
      0,
      orderState.paymentEvents.length,
      {
        id: 'payment_event_customer_linked',
        provider: 'mybiz',
        event_id: 'compat-customer:order_live_001:2',
        order_id: 'order_live_001',
        user_id: null,
        status: 'pending',
        amount: 18000,
        raw: {
          customer_id: 'customer_live_001',
          items: [
            {
              id: 'compat_item_001',
              menu_item_id: 'menu_live_001',
              menu_name: '브런치 세트',
              quantity: 1,
              unit_price: 18000,
              line_total: 18000,
            },
          ],
          payment_method: 'card',
          payment_source: 'mobile',
          payment_status: 'pending',
          table_no: 'A1',
        },
        created_at: '2026-04-23T09:05:00.000Z',
      },
      {
        id: 'payment_event_created',
        provider: 'mybiz',
        event_id: 'public-order:created',
        order_id: 'order_live_001',
        user_id: null,
        status: 'pending',
        amount: 18000,
        raw: {
          customer_id: null,
          items: [
            {
              id: 'compat_item_001',
              menu_item_id: 'menu_live_001',
              menu_name: '브런치 세트',
              quantity: 1,
              unit_price: 18000,
              line_total: 18000,
            },
          ],
          payment_method: 'card',
          payment_source: 'mobile',
          payment_status: 'pending',
          table_no: 'A1',
        },
        created_at: '2026-04-23T09:00:00.000Z',
      },
    );

    const service = await loadLiveRuntimeOrderService();
    const orders = await service.listOrders('store-live-001');

    expect(orders[0]).toMatchObject({
      customer: expect.objectContaining({
        id: 'customer_live_001',
      }),
      customer_id: 'customer_live_001',
      id: 'order_live_001',
    });
  });

  it('enriches compat-linked order customers from customer_contacts when legacy rows omit display fields', async () => {
    orderState.customers.splice(0, orderState.customers.length, {
      customer_id: 'customer_live_001',
      store_id: 'store-live-001',
      customer_key: '01070001005',
      first_seen_at: '2026-04-24T05:56:57.722+00:00',
      last_seen_at: '2026-04-24T05:56:57.722+00:00',
      marketing_consent: true,
      tags: [],
    });
    orderState.customerContacts.splice(
      0,
      orderState.customerContacts.length,
      {
        id: 'contact_phone_live_001',
        customer_id: 'customer_live_001',
        contact_type: 'phone',
        normalized_value: '01070001005',
        raw_value: '010-7000-1005',
        is_primary: true,
        is_verified: false,
        created_at: '2026-04-24T05:56:57.722+00:00',
      },
      {
        id: 'contact_email_live_001',
        customer_id: 'customer_live_001',
        contact_type: 'email',
        normalized_value: 'qa.order.link@mybiz.ai',
        raw_value: 'qa.order.link@mybiz.ai',
        is_primary: false,
        is_verified: false,
        created_at: '2026-04-24T05:56:57.722+00:00',
      },
    );
    orderState.paymentEvents.splice(
      0,
      orderState.paymentEvents.length,
      {
        id: 'payment_event_created',
        provider: 'mybiz',
        event_id: 'public-order:created',
        order_id: 'order_live_001',
        user_id: null,
        status: 'pending',
        amount: 18000,
        raw: {
          items: [
            {
              id: 'compat_item_001',
              menu_item_id: 'menu_live_001',
              menu_name: '브런치 세트',
              quantity: 1,
              unit_price: 18000,
              line_total: 18000,
            },
          ],
          payment_method: 'card',
          payment_source: 'mobile',
          payment_status: 'pending',
          table_no: 'A1',
        },
        created_at: '2026-04-23T09:00:00.000Z',
      },
      {
        id: 'payment_event_customer_linked',
        provider: 'mybiz',
        event_id: 'compat-customer:order_live_001:2',
        order_id: 'order_live_001',
        user_id: null,
        status: 'pending',
        amount: 18000,
        raw: {
          customer_id: 'customer_live_001',
          items: [
            {
              id: 'compat_item_001',
              menu_item_id: 'menu_live_001',
              menu_name: '브런치 세트',
              quantity: 1,
              unit_price: 18000,
              line_total: 18000,
            },
          ],
          payment_method: 'card',
          payment_source: 'mobile',
          payment_status: 'pending',
          table_no: 'A1',
        },
        created_at: '2026-04-23T09:05:00.000Z',
      },
    );

    const service = await loadLiveRuntimeOrderService();
    const orders = await service.listOrders('store-live-001');

    expect(orders[0]).toMatchObject({
      customer: expect.objectContaining({
        email: 'qa.order.link@mybiz.ai',
        phone: '010-7000-1005',
      }),
      customer_id: 'customer_live_001',
      id: 'order_live_001',
    });
  });
});
