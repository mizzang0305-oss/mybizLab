import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import checkoutHandler from '../../api/billing/checkout';
import verifyHandler from '../../api/billing/verify';

describe('/api/billing checkout and verify handlers', () => {
  const originalApiSecret = process.env.PORTONE_V2_API_SECRET;
  const originalStoreId = process.env.VITE_PORTONE_STORE_ID;
  const originalChannelKey = process.env.VITE_PORTONE_CHANNEL_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.PORTONE_V2_API_SECRET = 'ptn_secret_test';
    process.env.VITE_PORTONE_STORE_ID = 'store-v2-test';
    process.env.VITE_PORTONE_CHANNEL_KEY = 'channel-key-test';
  });

  afterEach(() => {
    process.env.PORTONE_V2_API_SECRET = originalApiSecret;
    process.env.VITE_PORTONE_STORE_ID = originalStoreId;
    process.env.VITE_PORTONE_CHANNEL_KEY = originalChannelKey;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns a clear env error for checkout when the channel key is missing', async () => {
    delete process.env.VITE_PORTONE_CHANNEL_KEY;

    const response = await checkoutHandler.fetch(
      new Request('https://example.com/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      ok: false,
      code: 'SERVER_MISCONFIGURED',
      stage: 'env-load',
    });
  });

  it('returns 200 from checkout after a successful PortOne probe call', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const response = await checkoutHandler.fetch(
      new Request('https://example.com/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      endpoint: '/api/billing/checkout',
      checkout: {
        storeId: 'store-v2-test',
        channelKey: 'channel-key-test',
      },
      probeStatus: 200,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 400 from verify when paymentId is missing', async () => {
    const response = await verifyHandler.fetch(
      new Request('https://example.com/api/billing/verify', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      code: 'MISSING_PAYMENT_ID',
      stage: 'request-body',
    });
  });

  it('returns 200 from verify after a successful PortOne payment lookup', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'payment-123', status: 'PAID' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const response = await verifyHandler.fetch(
      new Request('https://example.com/api/billing/verify', {
        method: 'POST',
        body: JSON.stringify({ paymentId: 'payment-123' }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      endpoint: '/api/billing/verify',
      paymentId: 'payment-123',
      portoneStatus: 200,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
