import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { adminClient, fromMock, getUserMock, rpcMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const rpcMock = vi.fn();
  const fromMock = vi.fn();

  return {
    adminClient: {
      auth: { getUser: getUserMock },
      from: fromMock,
      rpc: rpcMock,
    },
    fromMock,
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
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => table === 'platform_pricing_plans'
      ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { plan_code: 'pro', price_amount: 79000, status: 'published' }, error: null,
      }) }) }) }
      : undefined);
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
            catalogSource: 'plan',
            grantsEntitlement: true,
            planKey: 'pro',
            productCode: 'subscription_pro',
            productType: 'subscription',
            requestId: 'request-live-001',
            sessionId: 'payment-live-001',
            slug: 'paid-store',
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

  it('returns a truthful HOLD when the new server-only RPC is not installed', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'RPC missing' } });
    const response = await provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        address: 'Synthetic', business_name: 'Synthetic', business_number: 'SYN-1',
        business_type: 'service', email: 'synthetic@example.test', owner_name: 'Synthetic',
        phone: '0000000000', plan: 'free', request_id: 'missing-rpc-test',
      }),
    }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('PROVISIONING_NOT_AVAILABLE');
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed required fields and reserved slugs before the RPC', async () => {
    const base = {
      address: 'Synthetic', business_name: 'Synthetic', business_number: 'SYN-1',
      business_type: 'service', email: 'synthetic@example.test', owner_name: 'Synthetic',
      phone: '0000000000', plan: 'free', request_id: 'synthetic-request-2',
    };
    for (const body of [
      { ...base, business_name: { unsafe: true } },
      { ...base, requested_slug: 'admin' },
      { ...base, business_type: 7 },
    ]) {
      const response = await provisionHandler(new Request('https://example.test/api/stores/provision', {
        method: 'POST', headers: authHeaders, body: JSON.stringify(body),
      }));
      expect(response.status).toBe(400);
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns a client error for invalid JSON and overlong input without invoking the RPC', async () => {
    const invalid = await provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders, body: '{invalid',
    }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).code).toBe('INVALID_JSON');
    const overlong = await provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        address: 'X'.repeat(2049), business_name: 'Synthetic', email: 'synthetic@example.test',
        owner_name: 'Synthetic', phone: '0000000000', plan: 'free', request_id: 'overlong-test',
      }),
    }));
    expect(overlong.status).toBe(400);
    expect((await overlong.json()).code).toBe('PROVISIONING_FIELD_TOO_LONG');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('hashes the same normalized request and uses a deterministic business-number fallback', async () => {
    const body = {
      address: 'Synthetic', business_name: 'Synthetic', business_type: 'service',
      email: 'synthetic@example.test', owner_name: 'Synthetic', phone: '0000000000',
      plan: 'free', request_id: 'synthetic-stable-key',
    };
    for (const variant of [body, { ...body, requested_slug: '   ', business_number: '' }]) {
      const response = await provisionHandler(new Request('https://example.test/api/stores/provision', {
        method: 'POST', headers: authHeaders, body: JSON.stringify(variant),
      }));
      expect(response.status).toBe(200);
    }
    const first = rpcMock.mock.calls[0][1];
    const second = rpcMock.mock.calls[1][1];
    expect(second.p_request_hash).toBe(first.p_request_hash);
    expect(second.p_business_number).toBe('BIZ-synthetic-stable-key');
    expect(second.p_requested_slug).toBe(first.p_requested_slug);
  });

  it('checks a paid receipt against the published catalog amount and checkout slug', async () => {
    fromMock.mockImplementation((table: string) => table === 'platform_pricing_plans'
      ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { plan_code: 'pro', price_amount: 82500, status: 'published' }, error: null,
      }) }) }) }
      : undefined);
    const receipt = {
      amount: { total: 82500 }, currency: 'KRW', id: 'payment-dynamic-001', status: 'PAID',
      customData: {
        actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', catalogSource: 'plan', grantsEntitlement: true,
        planKey: 'pro', productCode: 'subscription_pro', productType: 'subscription',
        requestId: 'request-dynamic-001', sessionId: 'payment-dynamic-001', slug: 'dynamic-store',
      },
    };
    globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(receipt), {
      headers: { 'content-type': 'application/json' }, status: 200,
    }))) as typeof fetch;
    const body = {
      address: 'Synthetic', business_name: 'Dynamic', business_number: 'SYN-2',
      business_type: 'service', email: 'synthetic@example.test', owner_name: 'Synthetic',
      payment_id: 'payment-dynamic-001', phone: '0000000000', plan: 'pro',
      request_id: 'request-dynamic-001', requested_slug: 'dynamic-store',
    };
    const post = (input: object) => provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders, body: JSON.stringify(input),
    }));
    const accepted = await post(body);
    expect(accepted.status, await accepted.text()).toBe(200);
    expect(rpcMock.mock.calls.at(-1)?.[1]).toMatchObject({ p_payment_amount: 82500 });

    rpcMock.mockClear();
    const slugMismatch = await post({ ...body, requested_slug: 'another-store' });
    expect(slugMismatch.status).toBe(409);
    expect((await slugMismatch.json()).code).toBe('PAYMENT_BINDING_MISMATCH');
    expect(rpcMock).not.toHaveBeenCalled();

    receipt.customData.productCode = 'payment_test_100';
    const productMismatch = await post(body);
    expect(productMismatch.status).toBe(409);
    expect((await productMismatch.json()).code).toBe('PAYMENT_CATALOG_MISMATCH');
    expect(rpcMock).not.toHaveBeenCalled();

    receipt.customData.productCode = 'subscription_pro';
    fromMock.mockImplementation((table: string) => table === 'platform_pricing_plans'
      ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: null, error: { message: 'catalog unavailable' },
      }) }) }) }
      : undefined);
    const unavailable = await post(body);
    expect(unavailable.status).toBe(409);
    expect((await unavailable.json()).code).toBe('PAYMENT_CATALOG_MISMATCH');
    expect(rpcMock).not.toHaveBeenCalled();

    globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      ...receipt, customData: { ...receipt.customData, catalogSource: undefined },
    }), { headers: { 'content-type': 'application/json' }, status: 200 }))) as typeof fetch;
    const oldCheckout = await post(body);
    expect(oldCheckout.status).toBe(409);
    expect((await oldCheckout.json()).code).toBe('PAID_RECEIPT_RECONCILIATION_REQUIRED');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('binds a colliding subscription product code to checkout product source, not plan fallback', async () => {
    const product = {
      product_code: 'subscription_pro', product_type: 'subscription', linked_plan_code: 'pro',
      grants_entitlement: true, amount: 82500, status: 'published', product_name: 'Synthetic PRO',
    };
    fromMock.mockImplementation((table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: table === 'platform_billing_products' ? product : {
          plan_code: 'pro', price_amount: 79000, status: 'published',
        }, error: null,
      }) }) }),
    }));
    const receipt = {
      amount: { total: 82500 }, currency: 'KRW', id: 'payment-product-001', status: 'PAID',
      customData: {
        actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', catalogSource: 'product',
        grantsEntitlement: true, planKey: 'pro', productCode: 'subscription_pro',
        productType: 'subscription', requestId: 'request-product-001',
        sessionId: 'payment-product-001', slug: 'product-store',
      },
    };
    globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(receipt), {
      headers: { 'content-type': 'application/json' }, status: 200,
    }))) as typeof fetch;
    const body = {
      address: 'Synthetic', business_name: 'Product', business_number: 'SYN-PRODUCT',
      business_type: 'service', email: 'synthetic@example.test', owner_name: 'Synthetic',
      payment_id: 'payment-product-001', phone: '0000000000', plan: 'pro',
      request_id: 'request-product-001', requested_slug: 'product-store',
    };
    const post = () => provisionHandler(new Request('https://example.test/api/stores/provision', {
      method: 'POST', headers: authHeaders, body: JSON.stringify(body),
    }));
    expect((await post()).status).toBe(200);
    expect(rpcMock.mock.calls.at(-1)?.[1]).toMatchObject({ p_payment_amount: 82500 });
    rpcMock.mockClear();
    product.status = 'archived';
    const archived = await post();
    expect(archived.status).toBe(409);
    expect((await archived.json()).code).toBe('PAYMENT_CATALOG_MISMATCH');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
