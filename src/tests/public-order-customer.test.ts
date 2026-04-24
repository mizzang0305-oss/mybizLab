import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const paymentEventRows: Array<Record<string, unknown>> = [];
  const updateTargets: string[] = [];
  let mode: 'canonical' | 'legacy' = 'canonical';
  let orderRow: Record<string, unknown> = {
    created_at: '2026-04-24T01:00:00.000Z',
    customer_id: null,
    id: 'order_live_001',
    note: 'Counter order',
    order_id: 'order_live_001',
    payment_method: 'cash',
    payment_recorded_at: null,
    payment_source: 'counter',
    payment_status: 'pending',
    status: 'pending',
    store_id: 'store_live_001',
    submitted_at: '2026-04-24T01:00:00.000Z',
    table_id: 'table_live_001',
    table_no: '1',
    total_amount: 19500,
  };

  function createThenableQuery(
    resultFactory: () => {
      data: unknown;
      error: { code?: string; message?: string } | null;
    },
  ) {
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
      order(_column: string, _options?: { ascending?: boolean }) {
        return query;
      },
      select() {
        return query;
      },
      maybeSingle: async () => {
        const current = resultFactory();
        return {
          data: Array.isArray(current.data) ? current.data[0] || null : current.data,
          error: current.error,
        };
      },
      then(resolve: (value: { data: unknown; error: { code?: string; message?: string } | null }) => unknown) {
        return Promise.resolve(resultFactory()).then(resolve);
      },
    };

    return query;
  }

  const repository = {
    listCustomerContacts: vi.fn(async () => []),
    listCustomerPreferences: vi.fn(async () => []),
    listCustomers: vi.fn(async () => []),
  };

  const upsertCustomerMemory = vi.fn(async () => ({
    contacts: [],
    created: true,
    customer: {
      created_at: '2026-04-24T01:00:00.000Z',
      email: 'qa.order.customer@mybiz.ai',
      id: 'customer_live_001',
      is_regular: false,
      last_visit_at: '2026-04-24T01:00:00.000Z',
      marketing_opt_in: true,
      name: 'QA Order Customer',
      phone: '010-7777-0429',
      store_id: 'store_live_001',
      updated_at: '2026-04-24T01:00:00.000Z',
      visit_count: 1,
    },
    duplicateConflict: false,
    preference: null,
    timelineEvent: null,
  }));

  const client = {
    from(table: string) {
      if (table === 'orders') {
        return {
          select: () =>
            createThenableQuery(() => ({
              data: [orderRow],
              error: null,
            })),
          update(payload: Record<string, unknown>) {
            const filters: Array<{ column: string; value: unknown }> = [];

            const query = {
              eq(column: string, value: unknown) {
                filters.push({ column, value });
                return query;
              },
              select() {
                return query;
              },
              maybeSingle: async () => {
                const targetById = filters.find((filter) => filter.column === 'id')?.value;
                const targetByLegacyId = filters.find((filter) => filter.column === 'order_id')?.value;
                updateTargets.push(String(targetByLegacyId || targetById || ''));

                if (mode === 'legacy' && targetById) {
                  return {
                    data: null,
                    error: {
                      code: 'PGRST204',
                      message: "Could not find the 'id' column of 'orders' in the schema cache",
                    },
                  };
                }

                const targetId = String(targetByLegacyId || targetById || '');
                const currentOrderId = String(orderRow.id || orderRow.order_id);
                if (!targetId || targetId !== currentOrderId) {
                  return {
                    data: null,
                    error: null,
                  };
                }

                orderRow = {
                  ...orderRow,
                  ...payload,
                };

                return {
                  data: orderRow,
                  error: null,
                };
              },
            };

            return query;
          },
        };
      }

      if (table === 'payment_events') {
        return {
          insert(payload: Record<string, unknown>) {
            paymentEventRows.push(payload);
            return Promise.resolve({ data: null, error: null });
          },
          select: () => createThenableQuery(() => ({ data: paymentEventRows, error: null })),
        };
      }

      throw new Error(`Unexpected table lookup in public order customer test: ${table}`);
    },
  };

  return {
    client,
    paymentEventRows,
    repository,
    reset() {
      mode = 'canonical';
      orderRow = {
        created_at: '2026-04-24T01:00:00.000Z',
        customer_id: null,
        id: 'order_live_001',
        note: 'Counter order',
        order_id: 'order_live_001',
        payment_method: 'cash',
        payment_recorded_at: null,
        payment_source: 'counter',
        payment_status: 'pending',
        status: 'pending',
        store_id: 'store_live_001',
        submitted_at: '2026-04-24T01:00:00.000Z',
        table_id: 'table_live_001',
        table_no: '1',
        total_amount: 19500,
      };
      paymentEventRows.length = 0;
      updateTargets.length = 0;
      upsertCustomerMemory.mockClear();
    },
    setMode(nextMode: 'canonical' | 'legacy') {
      mode = nextMode;
    },
    upsertCustomerMemory,
    updateTargets,
  };
});

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => routeMocks.client,
}));

vi.mock('../shared/lib/repositories/supabaseRepository.js', () => ({
  createSupabaseRepository: () => routeMocks.repository,
}));

vi.mock('../shared/lib/services/customerMemoryService.js', () => ({
  upsertCustomerMemory: routeMocks.upsertCustomerMemory,
}));

import { handlePublicOrderCustomerRequest } from '../server/publicApi';

describe('public order customer attachment', () => {
  beforeEach(() => {
    routeMocks.reset();
  });

  it('attaches a customer to a canonical public order through the server mutation path', async () => {
    const response = await handlePublicOrderCustomerRequest({
      body: {
        email: 'qa.order.customer@mybiz.ai',
        marketingOptIn: true,
        name: 'QA Order Customer',
        orderId: 'order_live_001',
        phone: '010-7777-0429',
        storeId: 'store_live_001',
      },
      method: 'POST',
      url: '/api/public/order-customer',
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.upsertCustomerMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'order_linked',
        metadata: expect.objectContaining({
          items_count: expect.any(Number),
          items_summary: expect.any(String),
          order_id: 'order_live_001',
          payment_source: 'counter',
          payment_status: 'pending',
          table_id: 'table_live_001',
          table_no: '1',
          total_amount: 19500,
        }),
        phone: '010-7777-0429',
        source: 'public_order',
        storeId: 'store_live_001',
      }),
      { repository: routeMocks.repository },
    );
    expect(routeMocks.updateTargets).toEqual(['order_live_001']);
    expect(payload).toMatchObject({
      ok: true,
      data: {
        customer: {
          id: 'customer_live_001',
        },
        order: {
          customer_id: 'customer_live_001',
          id: 'order_live_001',
        },
      },
    });
  });

  it('falls back to the legacy order_id path when the live schema does not expose orders.id', async () => {
    routeMocks.setMode('legacy');

    const response = await handlePublicOrderCustomerRequest({
      body: {
        name: 'QA Order Customer',
        orderId: 'order_live_001',
        phone: '010-7777-0429',
        storeId: 'store_live_001',
      },
      method: 'POST',
      url: '/api/public/order-customer',
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.updateTargets).toEqual(['order_live_001', 'order_live_001']);
    expect(routeMocks.paymentEventRows).toHaveLength(0);
    expect(payload).toMatchObject({
      ok: true,
      data: {
        order: {
          customer_id: 'customer_live_001',
          id: 'order_live_001',
        },
      },
    });
  });
});
