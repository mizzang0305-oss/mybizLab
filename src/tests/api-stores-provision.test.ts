import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { adminClient, eqMock, fromMock, rpcMock, updateMock } = vi.hoisted(() => {
  const eqMock = vi.fn(async () => ({ error: null }));
  const updateMock = vi.fn(() => ({
    eq: eqMock,
  }));
  const fromMock = vi.fn(() => ({
    update: updateMock,
  }));
  const rpcMock = vi.fn();

  return {
    adminClient: {
      from: fromMock,
      rpc: rpcMock,
    },
    eqMock,
    fromMock,
    rpcMock,
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
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.PORTONE_API_SECRET = 'ptn_secret_test';
    delete process.env.PORTONE_V2_API_SECRET;
    process.env.PORTONE_STORE_ID = 'store-v2-test';
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: {
        id: 'live-store-001',
        slug: 'live-store',
        store_id: 'live-store-001',
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
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requires payment_id for paid onboarding store provisioning', async () => {
    const response = await provisionHandler(
      new Request('https://example.com/api/stores/provision', {
        body: JSON.stringify({
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
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'PAYMENT_VERIFICATION_REQUIRED',
      ok: false,
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('verifies a paid PortOne payment before provisioning and marks the request converted', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
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
    ) as typeof fetch;

    const response = await provisionHandler(
      new Request('https://example.com/api/stores/provision', {
        body: JSON.stringify({
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
        method: 'POST',
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
    expect(globalThis.fetch).toHaveBeenCalledWith(
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
    expect(rpcMock).toHaveBeenCalledWith(
      'create_store_with_owner',
      expect.objectContaining({
        p_plan: 'pro',
        p_requested_slug: 'paid-store',
      }),
    );
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
      new Request('https://example.com/api/stores/provision', {
        body: JSON.stringify({
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
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      code: 'PAYMENT_NOT_COMPLETED',
      ok: false,
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
