import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  orders: [] as Array<Record<string, unknown>>,
  paymentEvents: [] as Array<Record<string, unknown>>,
  resolveStoreAccess: vi.fn(),
}));

function createOrdersQuery(filters: Array<{ column: string; value: unknown }> = []) {
  return {
    eq(column: string, value: unknown) {
      return createOrdersQuery([...filters, { column, value }]);
    },
    maybeSingle: async () => {
      const matchedOrder = state.orders.find((order) =>
        filters.every(({ column, value }) => order[column] === value),
      );

      return { data: matchedOrder || null, error: null };
    },
    select() {
      return this;
    },
  };
}

const adminClient = {
  auth: {
    getUser: state.authGetUser,
  },
  from(table: string) {
    if (table === 'orders') {
      return createOrdersQuery();
    }

    if (table === 'payment_events') {
      return {
        insert: async (payload: Record<string, unknown>) => {
          state.paymentEvents.push(payload);
          return { data: null, error: null };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  },
};

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => adminClient,
}));

vi.mock('../shared/lib/repositories/supabaseRepository.js', () => ({
  createSupabaseRepository: () => ({
    resolveStoreAccess: state.resolveStoreAccess,
  }),
}));

import { handleMerchantOrderEventRequest } from '../server/merchantApi.js';

function merchantRequest(body: Record<string, unknown>, token?: string) {
  return new Request('https://example.com/api/merchant/order-event', {
    body: JSON.stringify(body),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

beforeEach(() => {
  state.authGetUser.mockReset();
  state.resolveStoreAccess.mockReset();
  state.orders = [
    {
      order_id: 'order_live_001',
      store_id: 'store-live-001',
    },
  ];
  state.paymentEvents = [];
});

describe('/api/merchant/order-event', () => {
  it('requires an authenticated merchant token', async () => {
    const response = await handleMerchantOrderEventRequest(
      merchantRequest({
        orderId: 'order_live_001',
        paymentId: 'compat-status:order_live_001:1',
        storeId: 'store-live-001',
      }),
    );

    expect(response.status).toBe(401);
    expect(state.paymentEvents).toHaveLength(0);
  });

  it('persists order operation events only for stores the merchant can access', async () => {
    state.authGetUser.mockResolvedValueOnce({
      data: {
        user: {
          email: 'merchant@example.com',
          id: 'profile-live-001',
          user_metadata: { full_name: 'Live Merchant' },
        },
      },
      error: null,
    });
    state.resolveStoreAccess.mockResolvedValueOnce({
      accessibleStores: [{ id: 'store-live-001' }],
    });

    const response = await handleMerchantOrderEventRequest(
      merchantRequest(
        {
          amount: 19500,
          orderId: 'order_live_001',
          paymentId: 'compat-payment:order_live_001:1',
          raw: {
            payment_source: 'counter',
            payment_status: 'paid',
          },
          status: 'paid',
          storeId: 'store-live-001',
        },
        'merchant-token',
      ),
    );

    expect(response.status).toBe(200);
    expect(state.paymentEvents).toEqual([
      expect.objectContaining({
        amount: 19500,
        event_id: 'compat-payment:order_live_001:1',
        order_id: 'order_live_001',
        provider: 'mybiz',
        raw: {
          payment_source: 'counter',
          payment_status: 'paid',
        },
        status: 'paid',
      }),
    ]);
  });

  it('does not persist an event for a merchant/order store mismatch', async () => {
    state.authGetUser.mockResolvedValueOnce({
      data: {
        user: {
          email: 'merchant@example.com',
          id: 'profile-live-001',
          user_metadata: {},
        },
      },
      error: null,
    });
    state.resolveStoreAccess.mockResolvedValueOnce({
      accessibleStores: [{ id: 'store-live-001' }],
    });

    const response = await handleMerchantOrderEventRequest(
      merchantRequest(
        {
          orderId: 'order_other_store',
          paymentId: 'compat-payment:order_other_store:1',
          raw: { payment_status: 'paid' },
          status: 'paid',
          storeId: 'store-live-001',
        },
        'merchant-token',
      ),
    );

    expect(response.status).toBe(403);
    expect(state.paymentEvents).toHaveLength(0);
  });
});
