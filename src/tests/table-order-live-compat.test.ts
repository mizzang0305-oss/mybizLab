import { afterEach, describe, expect, it, vi } from 'vitest';

const liveState = {
  conversationMessages: [] as Array<Record<string, unknown>>,
  conversationSessions: [] as Array<Record<string, unknown>>,
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
        name: 'QA 주문 고객',
        order_id: 'order_live_001',
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
  menuCategories: [
    {
      category_id: 'category_live_001',
      name: '브런치',
      store_id: 'store-live-001',
    },
  ] as Array<Record<string, unknown>>,
  menuItems: [
    {
      category_id: 'category_live_001',
      is_active: true,
      menu_id: 'menu_live_001',
      name: '브런치 세트',
      price: 19500,
      store_id: 'store-live-001',
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
  paymentEvents: [
    {
      amount: 19500,
      created_at: '2026-04-24T05:55:00.000Z',
      event_id: 'public-order:order_live_001:created',
      order_id: 'order_live_001',
      provider: 'mybiz',
      raw: {
        items: [
          {
            id: 'compat_item_001',
            line_total: 19500,
            menu_item_id: 'menu_live_001',
            menu_name: '브런치 세트',
            quantity: 1,
            unit_price: 19500,
          },
        ],
        payment_source: 'counter',
        payment_status: 'pending',
        table_id: 'table_live_001',
        table_no: '1',
      },
      status: 'pending',
    },
  ] as Array<Record<string, unknown>>,
  storeRows: [
    {
      brand_config: {},
      created_at: '2026-04-24T00:00:00.000Z',
      name: 'MyBiz Live Cafe',
      plan: 'pro',
      slug: 'mybiz-live-cafe',
      store_id: 'store-live-001',
      timezone: 'Asia/Seoul',
      trial_ends_at: null,
    },
  ] as Array<Record<string, unknown>>,
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

function createThenableQuery(
  resultFactory: () => { data: unknown; error: unknown },
  options: { onOrder?: (column: string) => void } = {},
) {
  const query = {
    eq(column: string, value: unknown) {
      return createThenableQuery(
        () => {
          const current = resultFactory();
          return {
            ...current,
            data: Array.isArray(current.data)
              ? current.data.filter((row) => (row as Record<string, unknown>)[column] === value)
              : current.data,
          };
        },
        options,
      );
    },
    in(column: string, values: unknown[]) {
      return createThenableQuery(
        () => {
          const current = resultFactory();
          return {
            ...current,
            data: Array.isArray(current.data)
              ? current.data.filter((row) => values.includes((row as Record<string, unknown>)[column]))
              : current.data,
          };
        },
        options,
      );
    },
    maybeSingle: async () => {
      const current = resultFactory();
      return {
        data: Array.isArray(current.data) ? current.data[0] || null : current.data,
        error: current.error,
      };
    },
    order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
      options.onOrder?.(column);
      return createThenableQuery(
        () => {
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
        },
        options,
      );
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

async function loadService(options: { accessToken?: string } = {}) {
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

  let menuCategorySortOrderRequested = false;
  let missingOrderTableRequested = false;
  let ordersUpdateRequested = false;
  const merchantApiCalls: Array<{
    authorization: string | null;
    body: Record<string, unknown>;
    url: string;
  }> = [];

  if (options.accessToken) {
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      merchantApiCalls.push({
        authorization: init?.headers instanceof Headers
          ? init.headers.get('authorization')
          : ((init?.headers as Record<string, string> | undefined)?.Authorization || null),
        body,
        url: String(url),
      });
      liveState.paymentEvents.push({
        amount: body.amount,
        created_at: '2026-04-24T06:30:00.000Z',
        event_id: body.paymentId,
        order_id: body.orderId,
        provider: 'mybiz',
        raw: body.raw,
        status: body.status,
      });

      return new Response(JSON.stringify({ ok: true, data: { orderId: body.orderId, paymentId: body.paymentId } }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
        status: 200,
      });
    });
  }

  const supabase = {
    auth: {
      getSession: async () => ({
        data: {
          session: options.accessToken
            ? {
                access_token: options.accessToken,
              }
            : null,
        },
      }),
    },
    from(table: string) {
      if (table === 'orders') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.orders, error: null })),
          update: () => {
            ordersUpdateRequested = true;
            throw new Error('orders.update should not be called for live legacy order writes');
          },
        };
      }

      if (table === 'order_items' || table === 'kitchen_tickets') {
        missingOrderTableRequested = true;
        throw new Error(`${table} should not be queried for live legacy table-order state`);
      }

      if (table === 'payment_events') {
        return {
          insert(payload: Record<string, unknown>) {
            liveState.paymentEvents.push({
              ...payload,
              created_at: String(payload.created_at || new Date().toISOString()),
            });
            return Promise.resolve({ data: null, error: null });
          },
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

      if (table === 'stores') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.storeRows, error: null })),
        };
      }

      if (table === 'conversation_sessions') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.conversationSessions, error: null })),
        };
      }

      if (table === 'conversation_messages') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.conversationMessages, error: null })),
        };
      }

      if (table === 'menu_categories') {
        return {
          select: () =>
            createThenableQuery(() => ({ data: liveState.menuCategories, error: null }), {
              onOrder(column) {
                if (column === 'sort_order') {
                  menuCategorySortOrderRequested = true;
                  throw new Error('menu_categories.sort_order should not be requested in live legacy schemas');
                }
              },
            }),
        };
      }

      if (table === 'menu_items') {
        return {
          select: () => createThenableQuery(() => ({ data: liveState.menuItems, error: null })),
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

  return {
    service: await import('@/shared/lib/services/mvpService'),
    merchantApiCalls,
    wasMenuCategorySortOrderRequested: () => menuCategorySortOrderRequested,
    wasMissingOrderTableRequested: () => missingOrderTableRequested,
    wasOrdersUpdateRequested: () => ordersUpdateRequested,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock('@/shared/lib/appConfig');
  vi.doUnmock('@/integrations/supabase/client');
  vi.doUnmock('@/shared/lib/repositories/index');
});

describe('table-order live compatibility', () => {
  it('builds a usable table board without querying missing kitchen/order item tables', async () => {
    const { service, wasMissingOrderTableRequested } = await loadService();

    const board = await service.getTableLiveBoard('store-live-001');

    expect(wasMissingOrderTableRequested()).toBe(false);
    expect(board[0]).toMatchObject({
      activeOrderCount: 1,
      pendingPaymentCount: 1,
      tableNo: '1',
    });
    expect(board[0]?.tableOrders[0]).toMatchObject({
      customer_id: 'customer_live_001',
      payment_source: 'counter',
      payment_status: 'pending',
    });
    expect(board[0]?.tableOrders[0]?.items[0]?.menu_name).toBe('브런치 세트');
    expect(board[0]?.recentTimeline[0]?.summary).toContain('주문 고객 정보');
  });

  it('loads live legacy menu categories without requesting a missing sort_order column', async () => {
    const { service, wasMenuCategorySortOrderRequested } = await loadService();

    const menu = await service.listMenu('store-live-001');

    expect(wasMenuCategorySortOrderRequested()).toBe(false);
    expect(menu.categories[0]?.name).toBe('브런치');
    expect(menu.items[0]?.name).toBe('브런치 세트');
  });

  it('records live legacy status and counter payment changes through compat events without updating orders columns', async () => {
    const { service, wasOrdersUpdateRequested } = await loadService();

    await service.updateOrderStatus('store-live-001', 'order_live_001', 'accepted');
    const acceptedOrder = (await service.listOrders('store-live-001'))[0];

    await service.recordOrderPayment('store-live-001', 'order_live_001', {
      paymentMethod: 'cash',
      paymentSource: 'counter',
    });
    const paidOrder = (await service.listOrders('store-live-001'))[0];

    expect(wasOrdersUpdateRequested()).toBe(false);
    expect(acceptedOrder).toMatchObject({
      id: 'order_live_001',
      status: 'accepted',
    });
    expect(paidOrder).toMatchObject({
      id: 'order_live_001',
      payment_method: 'cash',
      payment_source: 'counter',
      payment_status: 'paid',
      status: 'accepted',
    });
  });

  it('uses the merchant API for authenticated live order operation events', async () => {
    const { merchantApiCalls, service } = await loadService({ accessToken: 'merchant-session-token' });

    await service.updateOrderStatus('store-live-001', 'order_live_001', 'accepted');
    await service.recordOrderPayment('store-live-001', 'order_live_001', {
      paymentMethod: 'cash',
      paymentSource: 'counter',
    });

    expect(merchantApiCalls).toHaveLength(2);
    expect(merchantApiCalls[0]).toMatchObject({
      authorization: 'Bearer merchant-session-token',
      url: '/api/merchant/order-event',
    });
    expect(merchantApiCalls[0]?.body).toMatchObject({
      orderId: 'order_live_001',
      storeId: 'store-live-001',
    });
    expect(merchantApiCalls[1]?.body).toMatchObject({
      orderId: 'order_live_001',
      storeId: 'store-live-001',
      status: 'paid',
    });
    expect(merchantApiCalls[1]?.body.raw).toMatchObject({
      payment_method: 'cash',
      payment_source: 'counter',
      payment_status: 'paid',
    });
  });
});
