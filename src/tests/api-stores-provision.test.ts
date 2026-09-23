import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { adminClient, getUserMock, rpcMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const rpcMock = vi.fn();

  return {
    adminClient: {
      auth: { getUser: getUserMock },
      rpc: rpcMock,
    },
    getUserMock,
    rpcMock,
  };
});

vi.mock('../../src/server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => adminClient,
}));

import provisionHandler from '../../api/stores/provision';
import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '../shared/lib/launchGates';

const authHeaders = { authorization: 'Bearer synthetic-valid-token' };

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
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, error: null });
    rpcMock.mockResolvedValue({
      data: {
        id: 'live-store-001',
        slug: 'live-store',
        store_id: 'live-store-001',
      },
      error: null,
    });
    setLaunchGateOverridesForTest({ selfServePaidLaunchEnabled: true });
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    process.env.PORTONE_API_SECRET = originalApiSecret;
    process.env.PORTONE_V2_API_SECRET = originalLegacyApiSecret;
    process.env.PORTONE_STORE_ID = originalStoreId;
    globalThis.fetch = originalFetch;
    clearLaunchGateOverridesForTest();
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
        headers: authHeaders,
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

  it('verifies a paid PortOne payment bound to the actor before server-only provisioning', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          amount: {
            total: 79000,
          },
          currency: 'KRW',
          customData: {
            actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            grantsEntitlement: true,
            planKey: 'pro',
            productCode: 'mybiz_pro',
            productType: 'subscription',
            requestId: 'request-live-001',
            sessionId: 'payment-live-001',
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
        headers: authHeaders,
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
      'provision_store_from_verified_actor',
      expect.objectContaining({
        p_auth_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        p_plan: 'pro',
        p_requested_slug: 'paid-store',
      }),
    );
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
        headers: authHeaders,
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

  it('denies unauthenticated and caller-supplied actor assertions before any RPC', async () => {
    const body = {
      address: 'Synthetic', business_name: 'Synthetic', business_number: 'SYN-1',
      business_type: 'service', email: 'synthetic@example.test', owner_name: 'Synthetic',
      phone: '0000000000', plan: 'free', request_id: 'synthetic-request-1',
    };
    const unsigned = await provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(unsigned.status).toBe(401);

    const spoof = await provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ ...body, owner_profile_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    }));
    expect(spoof.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('passes only a verified actor and free plan to the server-only RPC', async () => {
    const response = await provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        address: 'Synthetic', business_name: 'Synthetic', business_number: 'SYN-1',
        business_type: 'service', email: 'synthetic@example.test', owner_name: 'Synthetic',
        phone: '0000000000', plan: 'free', request_id: 'synthetic-request-1',
      }),
    }));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('provision_store_from_verified_actor', expect.objectContaining({
      p_auth_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_plan: 'free', p_payment_id: null, p_payment_amount: null,
    }));
    expect(globalThis.fetch).toBe(originalFetch);
  });
});
