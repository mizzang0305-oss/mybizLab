import { describe, expect, it } from 'vitest';

import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

type QueryError = { code?: string; message?: string } | null;
type TableFixture = unknown[] | { error?: QueryError; rows?: unknown[] };

function createMockSupabaseClient(
  fixtures: Record<string, TableFixture>,
  upsertResults?: Record<string, Array<{ data?: unknown; error?: QueryError }>>,
) {
  const upsertCalls: Array<{ payload: Record<string, unknown>; table: string }> = [];

  function readFixture(table: string) {
    const entry = fixtures[table];
    if (Array.isArray(entry)) {
      return { error: null, rows: entry };
    }

    return {
      error: entry?.error || null,
      rows: entry?.rows || [],
    };
  }

  function createReadBuilder(table: string) {
    const fixture = readFixture(table);
    let rows = [...fixture.rows];
    const error = fixture.error;

    const builder = {
      eq(column: string, value: unknown) {
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value);
        return builder;
      },
      in(column: string, values: unknown[]) {
        rows = rows.filter((row) => values.includes((row as Record<string, unknown>)[column]));
        return builder;
      },
      maybeSingle: async () => ({
        data: rows[0] || null,
        error,
      }),
      order(column: string, { ascending = true }: { ascending?: boolean }) {
        const sorted = [...rows].sort((left, right) => {
          const leftValue = String((left as Record<string, unknown>)[column] || '');
          const rightValue = String((right as Record<string, unknown>)[column] || '');
          return ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
        });

        return Promise.resolve({
          data: sorted,
          error,
        });
      },
      select() {
        return builder;
      },
      single: async () => ({
        data: rows[0] || null,
        error,
      }),
      then(resolve: (value: { data: unknown[]; error: QueryError }) => unknown) {
        return Promise.resolve({
          data: rows,
          error,
        }).then(resolve);
      },
    };

    return builder;
  }

  return {
    from(table: string) {
      const readBuilder = createReadBuilder(table) as Record<string, unknown>;

      readBuilder.upsert = (payload: Record<string, unknown>) => {
        upsertCalls.push({ payload, table });
        const next = upsertResults?.[table]?.shift() || { data: payload, error: null };

        const mutationBuilder = {
          select() {
            return mutationBuilder;
          },
          single: async () => ({
            data: next.data || null,
            error: next.error || null,
          }),
        };

        return mutationBuilder;
      };

      return readBuilder;
    },
    upsertCalls,
  };
}

describe('supabase repository store subscription compatibility', () => {
  it('falls back to legacy subscriptions when store_subscriptions is missing in the live schema cache', async () => {
    const client = createMockSupabaseClient({
      store_members: [
        {
          id: 'member_live_001',
          store_id: 'store_live_001',
          profile_id: 'profile_live_001',
          role: 'owner',
          created_at: '2026-04-24T00:00:00.000Z',
        },
      ],
      store_subscriptions: {
        error: {
          code: 'PGRST205',
          message: 'Could not find the table public.store_subscriptions in the schema cache',
        },
        rows: [],
      },
      subscriptions: [
        {
          id: 'legacy_subscription_001',
          user_id: 'profile_live_001',
          tier: 'pro',
          status: 'active',
          billing_key: 'billing_live_001',
          started_at: '2026-04-20T00:00:00.000Z',
          expires_at: '2026-05-20T00:00:00.000Z',
          updated_at: '2026-04-24T00:00:00.000Z',
          last_payment_status: 'paid',
        },
      ],
    });

    const repository = createSupabaseRepository(client as never);

    await expect(repository.getStoreSubscription('store_live_001')).resolves.toMatchObject({
      billing_provider: 'portone',
      plan: 'pro',
      status: 'active',
      store_id: 'store_live_001',
    });
  });

  it('lists legacy subscriptions for each store when canonical rows are unavailable', async () => {
    const client = createMockSupabaseClient({
      store_members: [
        {
          id: 'member_live_001',
          store_id: 'store_live_001',
          profile_id: 'profile_live_001',
          role: 'owner',
          created_at: '2026-04-20T00:00:00.000Z',
        },
        {
          id: 'member_live_002',
          store_id: 'store_live_002',
          profile_id: 'profile_live_002',
          role: 'manager',
          created_at: '2026-04-21T00:00:00.000Z',
        },
      ],
      store_subscriptions: {
        error: {
          code: 'PGRST205',
          message: 'Could not find the table public.store_subscriptions in the schema cache',
        },
        rows: [],
      },
      subscriptions: [
        {
          id: 'legacy_subscription_001',
          user_id: 'profile_live_001',
          tier: 'vip',
          status: 'active',
          started_at: '2026-04-20T00:00:00.000Z',
          expires_at: '2026-05-20T00:00:00.000Z',
          updated_at: '2026-04-24T00:00:00.000Z',
          last_payment_status: 'paid',
        },
        {
          id: 'legacy_subscription_002',
          user_id: 'profile_live_002',
          tier: 'pro',
          status: 'trialing',
          started_at: '2026-04-22T00:00:00.000Z',
          expires_at: '2026-05-22T00:00:00.000Z',
          updated_at: '2026-04-23T00:00:00.000Z',
          last_payment_status: 'pending',
        },
      ],
    });

    const repository = createSupabaseRepository(client as never);

    await expect(repository.listStoreSubscriptions(['store_live_001', 'store_live_002'])).resolves.toMatchObject([
      expect.objectContaining({
        plan: 'vip',
        status: 'active',
        store_id: 'store_live_001',
      }),
      expect.objectContaining({
        plan: 'pro',
        status: 'trialing',
        store_id: 'store_live_002',
      }),
    ]);
  });

  it('writes to the legacy subscriptions table when store_subscriptions upsert is unavailable', async () => {
    const client = createMockSupabaseClient(
      {
        store_members: [
          {
            id: 'member_live_001',
            store_id: 'store_live_001',
            profile_id: 'profile_live_001',
            role: 'owner',
            created_at: '2026-04-20T00:00:00.000Z',
          },
        ],
      },
      {
        store_subscriptions: [
          {
            error: {
              code: 'PGRST205',
              message: 'Could not find the table public.store_subscriptions in the schema cache',
            },
          },
        ],
        subscriptions: [{ data: null, error: null }],
      },
    );

    const repository = createSupabaseRepository(client as never);

    await expect(
      repository.saveStoreSubscription({
        id: 'subscription_live_001',
        store_id: 'store_live_001',
        plan: 'pro',
        status: 'active',
        billing_provider: 'portone',
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:30.000Z',
        current_period_starts_at: '2026-04-24T00:00:00.000Z',
        current_period_ends_at: '2026-05-24T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      plan: 'pro',
      status: 'active',
      store_id: 'store_live_001',
    });

    expect(client.upsertCalls).toHaveLength(2);
    expect(client.upsertCalls[0]).toMatchObject({
      table: 'store_subscriptions',
    });
    expect(client.upsertCalls[1]).toMatchObject({
      table: 'subscriptions',
      payload: expect.objectContaining({
        billing_key: 'compat_subscription_live_001',
        last_payment_status: 'paid',
        tier: 'pro',
        user_id: 'profile_live_001',
      }),
    });
  });
});
