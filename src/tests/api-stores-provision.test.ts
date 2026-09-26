import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { adminClient, eqMock, fromMock, getUserMock, updateMock } = vi.hoisted(() => {
  const eqMock = vi.fn(async () => ({ error: null }));
  const updateMock = vi.fn(() => ({
    eq: eqMock,
  }));
  const fromMock = vi.fn(() => ({
    update: updateMock,
  }));
  const getUserMock = vi.fn();

  return {
    adminClient: {
      auth: {
        getUser: getUserMock,
      },
      from: fromMock,
    },
    eqMock,
    fromMock,
    getUserMock,
    updateMock,
  };
});

vi.mock('../../src/server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => adminClient,
}));

import provisionHandler from '../../api/stores/provision';

describe('/api/stores/provision', () => {
  const originalApiSecret = process.env.PORTONE_API_SECRET;
  const originalLegacyApiSecret = process.env.PORTONE_V2_API_SECRET;
  const originalStoreId = process.env.PORTONE_STORE_ID;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.PORTONE_API_SECRET = 'ptn_secret_test';
    delete process.env.PORTONE_V2_API_SECRET;
    process.env.PORTONE_STORE_ID = 'store-v2-test';
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-publishable-key';

    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-live-owner',
          email: 'owner@example.com',
        },
      },
      error: null,
    });
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    process.env.PORTONE_API_SECRET = originalApiSecret;
    process.env.PORTONE_V2_API_SECRET = originalLegacyApiSecret;
    process.env.PORTONE_STORE_ID = originalStoreId;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.VITE_SUPABASE_ANON_KEY = originalAnonKey;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function authenticatedRequest(body: Record<string, unknown>) {
    return new Request('https://example.com/api/stores/provision', {
      body: JSON.stringify(body),
      headers: {
        authorization: 'Bearer user-session-token',
        'content-type': 'application/json',
      },
      method: 'POST',
    });
  }

  it('requires an authenticated owner session before provisioning', async () => {
    const response = await provisionHandler(
      new Request('https://example.com/api/stores/provision', {
        body: JSON.stringify({
          address: 'Seoul Seongsu 123-45',
          business_name: 'Free Store',
          business_number: '123-45-67890',
          business_type: 'Cafe',
          email: 'owner@example.com',
          owner_name: 'Owner Kim',
          phone: '010-1234-5678',
          plan: 'free',
          requested_slug: 'free-store',
        }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      ok: false,
    });
  });

  it('requires the request email to match the authenticated owner email', async () => {
    const response = await provisionHandler(
      authenticatedRequest({
        address: 'Seoul Seongsu 123-45',
        business_name: 'Mismatch Store',
        business_number: '123-45-67890',
        business_type: 'Cafe',
        email: 'other-owner@example.com',
        owner_name: 'Owner Kim',
        phone: '010-1234-5678',
        plan: 'free',
        requested_slug: 'mismatch-store',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'OWNER_EMAIL_MISMATCH',
      ok: false,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('requires payment_id for paid onboarding store provisioning', async () => {
    const response = await provisionHandler(
      authenticatedRequest({
        address: 'Seoul Seongsu 123-45',
        business_name: 'Paid Store',
        business_number: '123-45-67890',
        business_type: 'Cafe',
        email: 'owner@example.com',
        owner_name: 'Owner Kim',
        phone: '010-1234-5678',
        plan: 'pro',
        request_id: 'request-live-001',
        requested_slug: 'paid-store',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'PAYMENT_VERIFICATION_REQUIRED',
      ok: false,
    });
    expect(getUserMock).toHaveBeenCalledWith('user-session-token');
  });

  it('verifies payment and calls the production-compatible RPC with the user auth context', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            amount: {
              total: 79000,
            },
            customData: {
              planKey: 'pro',
              requestId: 'request-live-001',
            },
            id: 'payment-live-001',
            status: 'PAID',
          }),
          {
            headers: { 'content-type': 'application/json' },
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              slug: 'live-store',
              store_id: 'live-store-001',
            },
          ]),
          {
            headers: { 'content-type': 'application/json' },
            status: 200,
          },
        ),
      ) as typeof fetch;

    const response = await provisionHandler(
      authenticatedRequest({
        address: 'Seoul Seongsu 123-45',
        business_name: 'Paid Store',
        business_number: '123-45-67890',
        business_type: 'Cafe',
        email: 'owner@example.com',
        owner_name: 'Owner Kim',
        payment_id: 'payment-live-001',
        phone: '010-1234-5678',
        plan: 'pro',
        request_id: 'request-live-001',
        requested_slug: 'paid-store',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      payment: {
        status: 'PAID',
      },
      store: {
        id: 'live-store-001',
        plan: 'pro',
      },
    });
    expect(getUserMock).toHaveBeenCalledWith('user-session-token');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        href: 'https://api.portone.io/payments/payment-live-001?storeId=store-v2-test',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'PortOne ptn_secret_test',
        }),
        method: 'GET',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'https://test-project.supabase.co/rest/v1/rpc/create_store_with_owner',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'test-publishable-key',
          Authorization: 'Bearer user-session-token',
        }),
        method: 'POST',
      }),
    );
    const rpcInit = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(rpcInit.body))).toEqual({
      p_address: 'Seoul Seongsu 123-45',
      p_business_number: '123-45-67890',
      p_business_type: 'Cafe',
      p_email: 'owner@example.com',
      p_owner_name: 'Owner Kim',
      p_phone: '010-1234-5678',
      p_plan: 'pro',
      p_requested_slug: 'paid-store',
      p_store_name: 'Paid Store',
    });
    expect(fromMock).toHaveBeenCalledWith('store_setup_requests');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'converted',
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'request-live-001');
  });

  it('rejects provisioning when PortOne verify returns a non-paid status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'payment-live-002', status: 'FAILED' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    ) as typeof fetch;

    const response = await provisionHandler(
      authenticatedRequest({
        address: 'Seoul Seongsu 123-45',
        business_name: 'Paid Store',
        business_number: '123-45-67890',
        business_type: 'Cafe',
        email: 'owner@example.com',
        owner_name: 'Owner Kim',
        payment_id: 'payment-live-002',
        phone: '010-1234-5678',
        plan: 'pro',
        request_id: 'request-live-002',
        requested_slug: 'paid-store',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      code: 'PAYMENT_NOT_COMPLETED',
      ok: false,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
