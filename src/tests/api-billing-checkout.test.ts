import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import checkoutHandler from '../../api/billing/checkout';

describe('/api/billing/checkout', () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalNextPublicAppBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;
  const originalViteAppBaseUrl = process.env.VITE_APP_BASE_URL;
  const originalApiSecret = process.env.PORTONE_API_SECRET;
  const originalLegacyApiSecret = process.env.PORTONE_V2_API_SECRET;
  const originalStoreId = process.env.PORTONE_STORE_ID;
  const originalNextPublicStoreId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const originalViteStoreId = process.env.VITE_PORTONE_STORE_ID;
  const originalChannelKey = process.env.PORTONE_CHANNEL_KEY;
  const originalNextPublicChannelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  const originalViteChannelKey = process.env.VITE_PORTONE_CHANNEL_KEY;

  beforeEach(() => {
    delete process.env.PORTONE_API_SECRET;
    delete process.env.PORTONE_V2_API_SECRET;
    delete process.env.APP_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_BASE_URL;
    process.env.VITE_APP_BASE_URL = 'https://example.com';
    process.env.PORTONE_STORE_ID = 'store-v2-test';
    delete process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    delete process.env.VITE_PORTONE_STORE_ID;
    process.env.PORTONE_CHANNEL_KEY = 'channel-key-test';
    delete process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    delete process.env.VITE_PORTONE_CHANNEL_KEY;
  });

  afterEach(() => {
    process.env.APP_BASE_URL = originalAppBaseUrl;
    process.env.NEXT_PUBLIC_APP_BASE_URL = originalNextPublicAppBaseUrl;
    process.env.VITE_APP_BASE_URL = originalViteAppBaseUrl;
    process.env.PORTONE_API_SECRET = originalApiSecret;
    process.env.PORTONE_V2_API_SECRET = originalLegacyApiSecret;
    process.env.PORTONE_STORE_ID = originalStoreId;
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID = originalNextPublicStoreId;
    process.env.VITE_PORTONE_STORE_ID = originalViteStoreId;
    process.env.PORTONE_CHANNEL_KEY = originalChannelKey;
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY = originalNextPublicChannelKey;
    process.env.VITE_PORTONE_CHANNEL_KEY = originalViteChannelKey;
  });

  it('returns JSON 405 for non-POST requests', async () => {
    const response = await checkoutHandler(
      new Request('https://example.com/api/billing/checkout', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
      ok: false,
      stage: 'method-check',
    });
  });

  it('returns JSON 500 when the store env is missing', async () => {
    delete process.env.PORTONE_STORE_ID;
    delete process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    delete process.env.VITE_PORTONE_STORE_ID;

    const response = await checkoutHandler(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({ plan: 'starter' }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'SERVER_MISCONFIGURED',
      ok: false,
      stage: 'env-load',
    });
  });

  it('returns JSON 500 when the channel key env is missing', async () => {
    delete process.env.PORTONE_CHANNEL_KEY;
    delete process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    delete process.env.VITE_PORTONE_CHANNEL_KEY;

    const response = await checkoutHandler(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({ plan: 'starter' }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'SERVER_MISCONFIGURED',
      ok: false,
      stage: 'env-load',
    });
  });

  it('returns JSON 500 when the app base url env is missing', async () => {
    delete process.env.APP_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_BASE_URL;
    delete process.env.VITE_APP_BASE_URL;

    const response = await checkoutHandler(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({ plan: 'starter' }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'SERVER_MISCONFIGURED',
      ok: false,
      stage: 'env-load',
    });
  });

  it('does not require PORTONE_API_SECRET for checkout success', async () => {
    const response = await checkoutHandler(
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
        noticeUrls: ['https://example.com/api/billing/webhook'],
        orderName: 'Pro 월 구독',
        payMethod: 'CARD',
        plan: 'pro',
        redirectUrl: 'https://example.com/pricing?portone=redirect&plan=pro',
        storeId: 'store-v2-test',
        totalAmount: 79000,
      },
    });
    expect(payload.checkout.paymentId).toMatch(/^subscription-pro-/);
  });
});
