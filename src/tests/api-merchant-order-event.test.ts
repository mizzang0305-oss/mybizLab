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
    then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
      return Promise.resolve({
        data: state.orders.filter((order) => filters.every(({ column, value }) => order[column] === value)),
        error: null,
      }).then(resolve);
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
        select: () => ({
          in: async (_column: string, ids: string[]) => ({
            data: state.paymentEvents.filter((event) => ids.includes(String(event.order_id))),
            error: null,
          }),
        }),
        insert: async (payload: Record<string, unknown>) => {
          state.paymentEvents.push(payload);
          return { data: null, error: null };
        },
      };
    }

    if (table === 'order_items' || table === 'store_tables') {
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
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

import { handleMerchantMediaTranscribeRequest, handleMerchantOrderEventRequest, handleMerchantOrdersRequest } from '../server/merchantApi.js';

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

function merchantMediaTranscribeRequest(body: Record<string, unknown>, token?: string) {
  return new Request('https://example.com/api/dashboard/content/media/asset_live_001/transcribe?assetId=asset_live_001', {
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

describe('/api/merchant/orders', () => {
  function request(storeId: string, token?: string) {
    return new Request(`https://example.com/api/merchant/orders?storeId=${storeId}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  it('rejects missing and invalid bearer tokens', async () => {
    expect((await handleMerchantOrdersRequest(request('store-live-001'))).status).toBe(401);
    state.authGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid token' } });
    expect((await handleMerchantOrdersRequest(request('store-live-001', 'invalid'))).status).toBe(401);
  });

  it('rejects a merchant without membership in the requested store', async () => {
    state.authGetUser.mockResolvedValueOnce({ data: { user: { id: 'merchant-a', email: 'a@example.invalid' } }, error: null });
    state.resolveStoreAccess.mockResolvedValueOnce({ accessibleStores: [{ id: 'store-a' }] });
    expect((await handleMerchantOrdersRequest(request('store-b', 'valid'))).status).toBe(403);
  });

  it('returns only the authorized store orders', async () => {
    state.orders.push({ order_id: 'order_other', store_id: 'store-b' });
    state.authGetUser.mockResolvedValueOnce({ data: { user: { id: 'merchant-a', email: 'a@example.invalid' } }, error: null });
    state.resolveStoreAccess.mockResolvedValueOnce({ accessibleStores: [{ id: 'store-live-001' }] });
    const response = await handleMerchantOrdersRequest(request('store-live-001', 'valid'));
    expect(response.status).toBe(200);
    expect(state.resolveStoreAccess).toHaveBeenCalledWith(expect.objectContaining({
      verifiedAuthUserId: 'merchant-a',
    }));
    const payload = await response.json();
    expect(payload.data.orders).toEqual([{ order_id: 'order_live_001', store_id: 'store-live-001' }]);
    expect(JSON.stringify(payload)).not.toContain('order_other');
  });
});

describe('/api/dashboard/content/media/:assetId/transcribe', () => {
  it('requires an authenticated merchant token before running STT', async () => {
    const response = await handleMerchantMediaTranscribeRequest(
      merchantMediaTranscribeRequest({
        storeId: 'store-live-001',
      }),
    );

    expect(response.status).toBe(401);
    expect(state.authGetUser).not.toHaveBeenCalled();
  });
});
