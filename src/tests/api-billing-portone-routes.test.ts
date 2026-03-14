import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import checkoutHandler from '../../api/billing/checkout';
import verifyHandler from '../../api/billing/verify';

describe('/api/billing checkout and verify handlers', () => {
  const originalApiSecret = process.env.PORTONE_V2_API_SECRET;
  const originalStoreId = process.env.VITE_PORTONE_STORE_ID;
  const originalChannelKey = process.env.VITE_PORTONE_CHANNEL_KEY;
  const originalAppBaseUrl = process.env.VITE_APP_BASE_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.PORTONE_V2_API_SECRET = 'ptn_secret_test';
    process.env.VITE_PORTONE_STORE_ID = 'store-v2-test';
    process.env.VITE_PORTONE_CHANNEL_KEY = 'channel-key-test';
    process.env.VITE_APP_BASE_URL = 'https://example.com';
  });

  afterEach(() => {
    process.env.PORTONE_V2_API_SECRET = originalApiSecret;
    process.env.VITE_PORTONE_STORE_ID = originalStoreId;
    process.env.VITE_PORTONE_CHANNEL_KEY = originalChannelKey;
    process.env.VITE_APP_BASE_URL = originalAppBaseUrl;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 405 with a clear message for GET /api/billing/checkout', async () => {
    const response = await checkoutHandler.fetch(
      new Request('https://example.com/api/billing/checkout', {
        method: 'GET',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(payload).toEqual({
      ok: false,
      message: 'Checkout endpoint. Use POST.',
    });
  });

  it('returns a clear env error for checkout when the channel key is missing', async () => {
    delete process.env.VITE_PORTONE_CHANNEL_KEY;

    const response = await checkoutHandler.fetch(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({ plan: 'starter' }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      code: 'SERVER_MISCONFIGURED',
      ok: false,
      stage: 'env-load',
    });
  });

  it('returns 400 from checkout when the plan is missing', async () => {
    const response = await checkoutHandler.fetch(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({}),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'INVALID_PLAN',
      ok: false,
      stage: 'request-body',
    });
  });

  it('returns a PortOne checkout session for a valid subscription plan', async () => {
    const response = await checkoutHandler.fetch(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({ plan: 'pro' }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      endpoint: '/api/billing/checkout',
      ok: true,
      plan: 'pro',
      checkout: {
        channelKey: 'channel-key-test',
        currency: 'KRW',
        orderName: 'Pro 월 구독',
        payMethod: 'CARD',
        plan: 'pro',
        storeId: 'store-v2-test',
        totalAmount: 79000,
      },
    });
    expect(payload.checkout.paymentId).toMatch(/^subscription-pro-/);
    expect(payload.checkout.noticeUrls).toEqual(['https://example.com/api/billing/webhook']);
  });

  it('returns 400 from verify when paymentId is missing', async () => {
    const response = await verifyHandler.fetch(
      new Request('https://example.com/api/billing/verify', {
        body: JSON.stringify({}),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'MISSING_PAYMENT_ID',
      ok: false,
      stage: 'request-body',
    });
  });

  it('returns 200 from verify after a successful PortOne payment lookup', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'payment-123', status: 'PAID' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    ) as typeof fetch;

    const response = await verifyHandler.fetch(
      new Request('https://example.com/api/billing/verify', {
        body: JSON.stringify({ paymentId: 'payment-123' }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      endpoint: '/api/billing/verify',
      ok: true,
      paymentId: 'payment-123',
      portoneStatus: 200,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
