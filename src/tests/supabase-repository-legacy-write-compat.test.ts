import { describe, expect, it } from 'vitest';

import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

describe('supabase repository legacy write compatibility', () => {
  it('maps public inquiry sessions to the legacy support channel with uuid ids', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let attempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'conversation_sessions' && attempt === 0) {
              attempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'subject' column of 'conversation_sessions' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    await expect(
      repository.saveConversationSession({
        id: 'conversation_session_live_001',
        store_id: 'store_live_001',
        customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
        inquiry_id: 'inquiry_live_001',
        visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
        channel: 'public_inquiry',
        status: 'open',
        subject: 'Public inquiry',
        created_at: '2026-04-23T00:00:00.000Z',
        updated_at: '2026-04-23T00:00:10.000Z',
        last_message_at: '2026-04-23T00:00:10.000Z',
      }),
    ).resolves.toMatchObject({
      channel: 'public_inquiry',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[1]?.payload).toMatchObject({
      channel: 'support',
      customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
      visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
    });
    expect(upsertCalls[1]?.payload.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('maps customer conversation messages to the legacy user role with uuid ids', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let attempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'conversation_messages' && attempt === 0) {
              attempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'body' column of 'conversation_messages' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    await expect(
      repository.saveConversationMessage({
        id: 'conversation_message_live_001',
        store_id: 'store_live_001',
        conversation_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
        customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
        inquiry_id: 'inquiry_live_001',
        sender: 'customer',
        body: 'Legacy compat customer message',
        metadata: { category: 'general' },
        created_at: '2026-04-23T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      sender: 'customer',
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[1]?.payload).toMatchObject({
      conversation_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
      content: 'Legacy compat customer message',
      role: 'user',
    });
    expect(upsertCalls[1]?.payload.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('retries customer writes after removing legacy-missing columns from the payload', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let customerAttempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'customers' && customerAttempt === 0) {
              customerAttempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'email' column of 'customers' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    await expect(
      repository.saveCustomer({
        id: 'customer_live_001',
        customer_id: 'customer_live_001',
        store_id: 'store_live_001',
        name: 'Live Customer',
        phone: '010-1111-2222',
        email: 'customer@example.com',
        visit_count: 1,
        last_visit_at: '2026-04-23T00:00:00.000Z',
        is_regular: false,
        marketing_opt_in: true,
        created_at: '2026-04-23T00:00:00.000Z',
        updated_at: '2026-04-23T00:10:00.000Z',
      }),
    ).resolves.toMatchObject({
      customer_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      name: 'Live Customer',
      store_id: 'store_live_001',
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[0]?.table).toBe('customers');
    expect(upsertCalls[1]?.table).toBe('customers');
    expect(upsertCalls[0]?.payload.customer_id).toBe('customer_live_001');
    expect(upsertCalls[1]?.payload.customer_id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('falls back to legacy visitor_sessions payload when live schema is missing canonical columns', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let visitorSessionAttempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'visitor_sessions' && visitorSessionAttempt === 0) {
              visitorSessionAttempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'channel' column of 'visitor_sessions' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    const session = {
      id: 'visitor_session_live_001',
      store_id: 'store_live_001',
      public_page_id: 'page_live_001',
      customer_id: undefined,
      inquiry_id: undefined,
      reservation_id: undefined,
      waiting_entry_id: undefined,
      visitor_token: 'token_live_001',
      channel: 'home' as const,
      entry_path: '/mybiz-live-cafe',
      last_path: '/mybiz-live-cafe',
      referrer: 'https://search.example.com',
      metadata: {
        routeMode: 'public-store',
      },
      first_seen_at: '2026-04-23T00:00:00.000Z',
      last_seen_at: '2026-04-23T00:00:10.000Z',
      created_at: '2026-04-23T00:00:00.000Z',
      updated_at: '2026-04-23T00:00:10.000Z',
    };

    await expect(repository.saveVisitorSession(session)).resolves.toMatchObject({
      ...session,
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[0]?.payload).toMatchObject({
      channel: 'home',
      id: 'visitor_session_live_001',
      last_path: '/mybiz-live-cafe',
    });
    expect(upsertCalls[1]?.payload).toMatchObject({
      customer_id: null,
      device_type: null,
      ended_at: '2026-04-23T00:00:10.000Z',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      ip_hash: 'token_live_001',
      landing_path: '/mybiz-live-cafe',
      source: 'home',
      store_id: 'store_live_001',
      started_at: '2026-04-23T00:00:00.000Z',
    });
  });

  it('maps public inquiries to the legacy public_page channel with uuid ids', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let inquiryAttempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'inquiries' && inquiryAttempt === 0) {
              inquiryAttempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'message' column of 'inquiries' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    await expect(
      repository.saveInquiry({
        id: 'inquiry_live_001',
        store_id: 'store_live_001',
        customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
        conversation_session_id: '6ba47f89-a56e-4b6d-8170-c95dd0c88dd8',
        visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
        customer_name: '라이브 고객',
        phone: '010-1234-5678',
        email: 'live@example.com',
        category: 'general',
        status: 'new',
        message: 'Legacy compat inquiry body.',
        tags: [],
        memo: undefined,
        marketing_opt_in: true,
        requested_visit_date: undefined,
        source: 'public_form',
        created_at: '2026-04-23T00:00:00.000Z',
        updated_at: '2026-04-23T00:00:10.000Z',
      }),
    ).resolves.toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      source: 'public_form',
      store_id: 'store_live_001',
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[1]?.payload).toMatchObject({
      channel: 'public_page',
      conversation_session_id: '6ba47f89-a56e-4b6d-8170-c95dd0c88dd8',
      customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
      visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
    });
    expect(upsertCalls[1]?.payload.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('maps public reservations to the legacy phone/requested payload with uuid ids', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let reservationAttempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'reservations' && reservationAttempt === 0) {
              reservationAttempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'customer_name' column of 'reservations' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    await expect(
      repository.saveReservation({
        id: 'reservation_live_001',
        store_id: 'store_live_001',
        customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
        visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
        customer_name: '예약 고객',
        phone: '010-1234-5678',
        party_size: 4,
        reserved_at: '2026-04-24T10:00:00.000Z',
        status: 'booked',
        note: 'window seat',
        created_at: '2026-04-23T00:00:00.000Z',
        updated_at: '2026-04-23T00:10:00.000Z',
      }),
    ).resolves.toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      status: 'booked',
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[1]?.payload).toMatchObject({
      customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
      source: 'phone',
      status: 'requested',
      visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
    });
    expect(upsertCalls[1]?.payload.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('maps public waiting entries to the legacy kiosk payload with uuid ids', async () => {
    const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];
    let waitingAttempt = 0;

    const repository = createSupabaseRepository({
      from(table: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            upsertCalls.push({ payload, table });

            if (table === 'waiting_entries' && waitingAttempt === 0) {
              waitingAttempt += 1;
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'quoted_wait_minutes' column of 'waiting_entries' in the schema cache",
                },
              };
            }

            return { error: null };
          },
        };
      },
    } as never);

    await expect(
      repository.saveWaitingEntry({
        id: 'waiting_entry_live_001',
        store_id: 'store_live_001',
        customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
        visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
        customer_name: '웨이팅 고객',
        phone: '010-9999-8888',
        party_size: 2,
        quoted_wait_minutes: 15,
        status: 'cancelled',
        created_at: '2026-04-23T00:00:00.000Z',
        updated_at: '2026-04-23T00:05:00.000Z',
      }),
    ).resolves.toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      status: 'cancelled',
    });

    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[1]?.payload).toMatchObject({
      customer_id: 'b9f69402-32f0-4e0b-9a0d-b4563fdbdd66',
      name_snapshot: '웨이팅 고객',
      phone_snapshot: '010-9999-8888',
      source: 'kiosk',
      status: 'canceled',
      visitor_session_id: '14b63d19-b929-4923-9d1b-0746bf50be42',
    });
    expect(upsertCalls[1]?.payload.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
