import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const selectResultQueue: Array<{ data: unknown[]; error: { code?: string; message: string } | null }> = [];
  const insertResultQueue: Array<{ error: { code?: string; message: string } | null }> = [];
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    gte: vi.fn(() => queryBuilder),
    limit: vi.fn(() => Promise.resolve(selectResultQueue.shift() || { data: [], error: null })),
  };

  const insert = vi.fn((payload: unknown) => Promise.resolve(insertResultQueue.shift() || { error: null }));
  const from = vi.fn(() => ({
    insert,
    select: vi.fn(() => queryBuilder),
  }));
  return {
    from,
    insert,
    insertResultQueue,
    queryBuilder,
    selectResultQueue,
  };
});

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => ({
    from: routeMocks.from,
  }),
}));

import onboardingSetupRequestHandler from '../../api/onboarding/setup-request';

describe('/api/onboarding/setup-request', () => {
  beforeEach(() => {
    routeMocks.from.mockClear();
    routeMocks.insert.mockClear();
    routeMocks.queryBuilder.eq.mockClear();
    routeMocks.queryBuilder.gte.mockClear();
    routeMocks.queryBuilder.limit.mockClear();
    routeMocks.selectResultQueue.length = 0;
    routeMocks.insertResultQueue.length = 0;
  });

  it('saves a valid onboarding request through the server route even when requested_plan is not yet migrated', async () => {
    routeMocks.selectResultQueue.push({ data: [], error: null }, { data: [], error: null }, { data: [], error: null });
    routeMocks.insertResultQueue.push(
      {
        error: {
          code: 'PGRST204',
          message: `Could not find the 'requested_plan' column of 'store_setup_requests' in the schema cache`,
        },
      },
      { error: null },
    );

    const response = await onboardingSetupRequestHandler(
      new Request('https://example.com/api/onboarding/setup-request', {
        method: 'POST',
        body: JSON.stringify({
          input: {
            business_name: 'Runtime Save Store',
            owner_name: '홍길동',
            business_number: '123-45-67890',
            phone: '010-1234-5678',
            email: 'owner@example.com',
            address: '서울 성수동 123-45',
            business_type: 'Cafe',
            requested_slug: 'runtime-save-store',
            selected_features: ['ai_manager', 'sales_analysis'],
          },
          requestedPlan: 'pro',
        }),
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(routeMocks.from.mock.calls.map((call) => call.at(0))).toEqual([
      'stores',
      'store_setup_requests',
      'store_setup_requests',
      'store_setup_requests',
      'store_setup_requests',
    ]);
    expect(routeMocks.insert).toHaveBeenCalledTimes(2);
    expect(routeMocks.insert.mock.calls[0]?.[0]).toMatchObject({
      requested_plan: 'pro',
      requested_slug: 'runtime-save-store',
    });
    expect(routeMocks.insert.mock.calls[1]?.[0]).not.toHaveProperty('requested_plan');
    expect(payload).toMatchObject({
      ok: true,
      data: {
        request: {
          requested_plan: 'pro',
          requested_slug: 'runtime-save-store',
          status: 'submitted',
        },
        persistence: {
          requestedPlanPersisted: false,
        },
      },
    });
  });

  it('rejects duplicate canonical slugs before inserting a setup request', async () => {
    routeMocks.selectResultQueue.push({
      data: [{ id: 'store-live', slug: 'runtime-save-store' }],
      error: null,
    });

    const response = await onboardingSetupRequestHandler(
      new Request('https://example.com/api/onboarding/setup-request', {
        method: 'POST',
        body: JSON.stringify({
          input: {
            business_name: 'Runtime Save Store',
            owner_name: '홍길동',
            business_number: '123-45-67890',
            phone: '010-1234-5678',
            email: 'owner@example.com',
            address: '서울 성수동 123-45',
            business_type: 'Cafe',
            requested_slug: 'runtime-save-store',
            selected_features: ['ai_manager', 'sales_analysis'],
          },
          requestedPlan: 'pro',
        }),
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(routeMocks.insert).not.toHaveBeenCalled();
    expect(routeMocks.from.mock.calls.map((call) => call.at(0))).toEqual(['stores']);
    expect(payload).toMatchObject({
      ok: false,
      code: 'DUPLICATE_SLUG',
    });
  });
});
