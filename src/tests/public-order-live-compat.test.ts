import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const customerInsertPayloads: Array<Record<string, unknown>> = [];
  const orderInsertPayloads: Array<Record<string, unknown>> = [];
  const paymentEventRows: Array<Record<string, unknown>> = [];
  const sessionInsertPayloads: Array<Record<string, unknown>> = [];

  function createThenableQuery(resultFactory: () => { data: unknown; error: { code?: string; message?: string } | null }) {
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
      single: async () => {
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

  const store = {
    id: 'store_live_001',
    name: 'MyBiz Live Cafe',
    slug: 'mybiz-live-cafe',
    brand_config: {
      owner_name: 'Live Merchant',
      business_number: '123-45-67890',
      phone: '010-0000-0000',
      email: 'merchant@example.com',
      address: 'Seoul',
      business_type: 'Cafe',
    },
    phone: '010-0000-0000',
    email: 'merchant@example.com',
    address: 'Seoul',
    business_type: 'Cafe',
    brand_color: '#111827',
    tagline: 'Live verification store',
    description: 'Live verification store',
    public_status: 'public' as const,
    subscription_plan: 'pro' as const,
    admin_email: 'merchant@example.com',
    created_at: '2026-04-23T09:00:00.000Z',
    updated_at: '2026-04-23T09:00:00.000Z',
  };

  const publicPage = {
    id: 'public_page_live_001',
    store_id: 'store_live_001',
    slug: 'mybiz-live-cafe',
    brand_name: 'MyBiz Live Cafe',
    brand_color: '#111827',
    tagline: 'Live verification store',
    description: 'Live verification store',
    business_type: 'Cafe',
    phone: '010-0000-0000',
    email: 'merchant@example.com',
    address: 'Seoul',
    directions: '',
    public_status: 'public' as const,
    homepage_visible: true,
    consultation_enabled: true,
    inquiry_enabled: true,
    reservation_enabled: true,
    order_entry_enabled: true,
    hero_title: 'MyBiz Live Cafe',
    hero_subtitle: 'Live verification store',
    hero_description: 'Live verification store',
    cta_config: {},
    content_blocks: [],
    seo_metadata: {},
    media: [],
    notices: [],
    created_at: '2026-04-23T09:00:00.000Z',
    updated_at: '2026-04-23T09:00:00.000Z',
  };

  const repository = {
    findStoreById: vi.fn(async (storeId: string) => (storeId === store.id ? store : null)),
    findStoreBySlug: vi.fn(async (slug: string) => (slug === store.slug ? store : null)),
    getStorePublicPage: vi.fn(async () => publicPage),
    listInquiries: vi.fn(async () => []),
  };

  const client = {
    from(table: string) {
      if (table === 'store_features' || table === 'store_locations' || table === 'store_media' || table === 'store_notices') {
        return {
          select: () => createThenableQuery(() => ({ data: [], error: null })),
        };
      }

      if (table === 'store_tables') {
        return {
          select: () =>
            createThenableQuery(() => ({
              data: [
                {
                  table_id: 'table_live_001',
                  store_id: store.id,
                  table_no: '1',
                  status: 'available',
                },
              ],
              error: null,
            })),
        };
      }

      if (table === 'menu_categories') {
        return {
          select: () =>
            createThenableQuery(() => ({
              data: [
                {
                  category_id: 'menu_category_live_001',
                  store_id: store.id,
                  name: 'Signature',
                  sort_order: 1,
                },
              ],
              error: null,
            })),
        };
      }

      if (table === 'menu_items') {
        return {
          select: () =>
            createThenableQuery(() => ({
              data: [
                {
                  menu_id: 'menu_live_001',
                  store_id: store.id,
                  category_id: 'menu_category_live_001',
                  name: 'Signature Set',
                  price: 19500,
                  is_active: true,
                  is_popular: true,
                },
              ],
              error: null,
            })),
        };
      }

      if (table === 'surveys' || table === 'survey_responses') {
        return {
          select: () => createThenableQuery(() => ({ data: [], error: null })),
        };
      }

      if (table === 'orders') {
        return {
          insert(payload: Record<string, unknown>) {
            orderInsertPayloads.push(payload);
            const isCanonicalAttempt = Object.prototype.hasOwnProperty.call(payload, 'channel');

            return {
              select() {
                return {
                  single: async () =>
                    isCanonicalAttempt
                      ? {
                          data: null,
                          error: {
                            code: 'PGRST204',
                            message: "Could not find the 'channel' column of 'orders' in the schema cache",
                          },
                        }
                      : {
                          data: {
                            order_id: 'order_live_compat_001',
                            store_id: store.id,
                            table_id: 'table_live_001',
                            status: 'pending',
                            total_amount: 19500,
                            created_at: '2026-04-23T09:00:00.000Z',
                            submitted_at: '2026-04-23T09:00:00.000Z',
                          },
                          error: null,
                        },
                };
              },
            };
          },
          select: () => createThenableQuery(() => ({ data: [], error: null })),
        };
      }

      if (table === 'customers') {
        return {
          insert(payload: Record<string, unknown>) {
            customerInsertPayloads.push(payload);
            return Promise.resolve({ data: payload, error: null });
          },
        };
      }

      if (table === 'sessions') {
        return {
          insert(payload: Record<string, unknown>) {
            sessionInsertPayloads.push(payload);
            return Promise.resolve({
              data: {
                ...payload,
                channel: null,
                user_agent: null,
              },
              error: null,
            });
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

      if (table === 'order_items') {
        return {
          insert() {
            return {
              select: async () => ({
                data: null,
                error: {
                  code: 'PGRST205',
                  message: 'Could not find the table public.order_items in the schema cache',
                },
              }),
            };
          },
          select: () => createThenableQuery(() => ({ data: [], error: null })),
        };
      }

      if (table === 'kitchen_tickets') {
        return {
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: null,
                    error: {
                      code: 'PGRST205',
                      message: 'Could not find the table public.kitchen_tickets in the schema cache',
                    },
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table lookup in public order compat test: ${table}`);
    },
  };

  return {
    client,
    customerInsertPayloads,
    orderInsertPayloads,
    paymentEventRows,
    publicPage,
    repository,
    sessionInsertPayloads,
    store,
  };
});

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => routeMocks.client,
}));

vi.mock('../shared/lib/repositories/supabaseRepository.js', () => ({
  createSupabaseRepository: () => routeMocks.repository,
}));

vi.mock('../shared/lib/services/publicPageService.js', () => ({
  buildDefaultStorePublicPage: vi.fn(() => routeMocks.publicPage),
  getCanonicalStorePublicPage: vi.fn(),
  resolvePublicPageCapabilities: vi.fn(async () => ({
    consultationEnabled: true,
    inquiryEnabled: true,
    orderEntryEnabled: true,
    publicPageEnabled: true,
    reservationEnabled: true,
    waitingEnabled: true,
  })),
  touchVisitorSession: vi.fn(),
}));

vi.mock('../shared/lib/services/inquiryService.js', () => ({
  buildPublicInquirySummary: vi.fn(() => ({
    openCount: 0,
    recentTags: [],
    totalCount: 0,
  })),
  getPublicInquiryFormSnapshot: vi.fn(),
  submitCanonicalPublicInquiry: vi.fn(),
}));

import { handlePublicOrderRequest } from '../server/publicApi';

describe('public order live schema compatibility', () => {
  beforeEach(() => {
    routeMocks.customerInsertPayloads.length = 0;
    routeMocks.orderInsertPayloads.length = 0;
    routeMocks.paymentEventRows.length = 0;
    routeMocks.sessionInsertPayloads.length = 0;
    routeMocks.repository.findStoreById.mockClear();
    routeMocks.repository.findStoreBySlug.mockClear();
    routeMocks.repository.getStorePublicPage.mockClear();
    routeMocks.repository.listInquiries.mockClear();
  });

  it('falls back to the legacy live order write path when canonical order columns are missing', async () => {
    const response = await handlePublicOrderRequest({
      body: {
        items: [{ menu_item_id: 'menu_live_001', quantity: 1 }],
        note: 'live-order-mobile-verification-20260423',
        paymentMethod: 'card',
        paymentSource: 'mobile',
        storeSlug: 'mybiz-live-cafe',
        tableNo: '1',
      },
      headers: {
        host: 'example.com',
      },
      method: 'POST',
      url: '/api/public/order',
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.customerInsertPayloads).toHaveLength(1);
    expect(routeMocks.customerInsertPayloads[0]).toMatchObject({
      customer_key: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      marketing_consent: false,
      quiet_mode: false,
      store_id: routeMocks.store.id,
      tags: [],
    });
    expect(routeMocks.sessionInsertPayloads).toHaveLength(1);
    expect(routeMocks.sessionInsertPayloads[0]).toMatchObject({
      customer_id: routeMocks.customerInsertPayloads[0].customer_id,
      session_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      store_id: routeMocks.store.id,
      table_id: 'table_live_001',
    });
    expect(routeMocks.orderInsertPayloads).toHaveLength(2);
    expect(routeMocks.orderInsertPayloads[0]).toMatchObject({
      channel: 'table',
      payment_method: 'card',
      payment_source: 'mobile',
      payment_status: 'pending',
      table_no: '1',
      total_amount: 19500,
    });
    expect(routeMocks.orderInsertPayloads[1]).toMatchObject({
      session_id: routeMocks.sessionInsertPayloads[0].session_id,
      status: 'pending',
      store_id: routeMocks.store.id,
      table_id: 'table_live_001',
      total_amount: 19500,
    });
    expect(routeMocks.orderInsertPayloads[1]).not.toHaveProperty('channel');

    expect(routeMocks.paymentEventRows).toHaveLength(1);
    expect(routeMocks.paymentEventRows[0]).toMatchObject({
      amount: 19500,
      order_id: 'order_live_compat_001',
      provider: 'mybiz',
      status: 'pending',
      raw: expect.objectContaining({
        note: 'live-order-mobile-verification-20260423',
        payment_method: 'card',
        payment_source: 'mobile',
        payment_status: 'pending',
        table_id: 'table_live_001',
        table_no: '1',
      }),
    });

    expect(payload).toMatchObject({
      ok: true,
      data: {
        order: {
          channel: 'table',
          id: 'order_live_compat_001',
          payment_method: 'card',
          payment_source: 'mobile',
          payment_status: 'pending',
          table_id: 'table_live_001',
          table_no: '1',
          total_amount: 19500,
        },
        items: [
          expect.objectContaining({
            menu_item_id: 'menu_live_001',
            menu_name: 'Signature Set',
            quantity: 1,
          }),
        ],
        ticket: {
          order_id: 'order_live_compat_001',
          status: 'pending',
          table_id: 'table_live_001',
          table_no: '1',
        },
      },
    });
  });
});
