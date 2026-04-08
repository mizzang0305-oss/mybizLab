import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import checkoutHandler from '../../api/billing/checkout';
import {
  createCheckoutPaymentId,
  type CheckoutCustomerPayload,
  type CheckoutSessionPayload,
  type InvalidCheckoutSessionDetails,
  validateCheckoutSessionPayload,
} from '../../api/billing/_billingCheckout';

function createValidCheckoutCustomer(
  overrides: Partial<CheckoutCustomerPayload> = {},
): CheckoutCustomerPayload {
  return {
    email: 'buyer@example.com',
    fullName: 'Hong Gil Dong',
    phoneNumber: '010-1234-5678',
    ...overrides,
  };
}

function createValidCheckoutSessionPayload(
  overrides: Partial<CheckoutSessionPayload> = {},
): CheckoutSessionPayload {
  return {
    channelKey: 'channel-key-test',
    currency: 'KRW',
    customData: {
      initiatedAt: '2026-03-15T00:00:00.000Z',
      plan: 'pro',
      source: 'pricing-page',
    },
    customer: createValidCheckoutCustomer(),
    noticeUrls: ['https://example.com/api/billing/webhook'],
    orderName: 'PRO \uad6c\ub3c5',
    payMethod: 'CARD',
    paymentId: 'subscription-pro-001',
    plan: 'pro',
    redirectUrl: 'https://example.com/pricing?portone=redirect&plan=pro',
    storeId: 'store-v2-test',
    totalAmount: 79000,
    ...overrides,
  };
}

function expectInvalidResult(result: ReturnType<typeof validateCheckoutSessionPayload>) {
  if (result.ok) {
    throw new Error('Expected invalid checkout session result');
  }

  return result as {
    details: InvalidCheckoutSessionDetails;
    message: string;
    ok: false;
    status: number;
  };
}

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
        body: JSON.stringify({ plan: 'pro' }),
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
        body: JSON.stringify({ plan: 'pro' }),
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
        body: JSON.stringify({ plan: 'pro' }),
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

  it('fails validation when redirectUrl is not an absolute URL', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        redirectUrl: '/pricing?portone=redirect&plan=pro',
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        redirectUrl: '/pricing?portone=redirect&plan=pro',
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.missingOrInvalidFields).toEqual(expect.arrayContaining(['redirectUrl']));
  });

  it('fails validation when totalAmount is zero or negative', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        totalAmount: 0,
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        totalAmount: 0,
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.missingOrInvalidFields).toEqual(expect.arrayContaining(['totalAmount']));
  });

  it('fails validation when storeId is blank', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        storeId: '   ',
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        storeIdConfigured: false,
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.missingOrInvalidFields).toEqual(expect.arrayContaining(['storeId']));
  });

  it('fails validation when channelKey is blank', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        channelKey: '   ',
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        channelKeyConfigured: false,
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.missingOrInvalidFields).toEqual(expect.arrayContaining(['channelKey']));
  });

  it('fails validation when paymentId exceeds the KG Inicis limit', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        paymentId: `mb_st_${'a'.repeat(35)}`,
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        paymentId: `mb_st_${'a'.repeat(35)}`,
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.validationErrors).toEqual(
      expect.arrayContaining([
        {
          field: 'paymentId',
          reason: 'must be 40 characters or fewer for KG Inicis',
        },
      ]),
    );
  });

  it('fails validation when KG Inicis customer data is blank', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        customer: createValidCheckoutCustomer({
          email: '',
          fullName: '',
          phoneNumber: '',
        }),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        customerConfigured: {
          email: false,
          fullName: false,
          phoneNumber: false,
        },
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.missingOrInvalidFields).toEqual(
      expect.arrayContaining(['customer.email', 'customer.fullName', 'customer.phoneNumber']),
    );
  });

  it('fails validation when customData is not ASCII-safe', () => {
    const result = validateCheckoutSessionPayload(
      createValidCheckoutSessionPayload({
        customData: {
          storeName: '\uC131\uC218 \uBE0C\uB7F0\uCE58 \uD558\uC6B0\uC2A4',
        },
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      details: {
        customDataConfigured: true,
      },
      status: 500,
    });

    expect(expectInvalidResult(result).details.missingOrInvalidFields).toEqual(expect.arrayContaining(['customData']));
  });

  it('keeps the validator result ok for a valid checkout session', () => {
    const result = validateCheckoutSessionPayload(createValidCheckoutSessionPayload());

    expect(result).toEqual({
      ok: true,
    });
  });

  it.each([
    ['free', /^mb_free_[a-f0-9]{16}$/],
    ['pro', /^mb_pro_[a-f0-9]{16}$/],
    ['vip', /^mb_vip_[a-f0-9]{16}$/],
  ] as const)('creates a short ASCII-safe paymentId for %s', (plan, pattern) => {
    const paymentId = createCheckoutPaymentId(plan);

    expect(paymentId).toMatch(pattern);
    expect(paymentId.length).toBeLessThanOrEqual(40);
    expect(paymentId).toMatch(/^[A-Za-z0-9_-]+$/);
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
        customData: {
          planKey: 'pro',
        },
        currency: 'KRW',
        customer: {
          email: expect.any(String),
          fullName: expect.any(String),
          phoneNumber: expect.any(String),
        },
        noticeUrls: ['https://example.com/api/billing/webhook'],
        orderName: 'PRO \uad6c\ub3c5',
        payMethod: 'CARD',
        plan: 'pro',
        redirectUrl: 'https://example.com/pricing?portone=redirect&plan=pro',
        storeId: 'store-v2-test',
        totalAmount: 79000,
      },
    });
    expect(payload.checkout.paymentId).toMatch(/^mb_pro_[a-f0-9]{16}$/);
    expect(payload.checkout.paymentId.length).toBeLessThanOrEqual(40);
    expect(payload.checkout.customData.sessionId).toBe(payload.checkout.paymentId);
  });

  it('accepts a node-style parsed body object without request.text()', async () => {
    const response = await checkoutHandler({
      body: {
        browserContext: {
          appBaseUrl: 'https://example.com',
          channelKey: 'channel-key-test',
          storeId: 'store-v2-test',
        },
        plan: 'pro',
      },
      headers: {
        host: 'example.com',
      },
      method: 'POST',
      url: '/api/billing/checkout',
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.checkout.storeId).toBe('store-v2-test');
    expect(payload.checkout.channelKey).toBe('channel-key-test');
  });

  it('writes a node-style response when a server response object is provided', async () => {
    const recorded = {
      headers: new Map<string, string>(),
      payload: null as unknown,
      statusCode: 0,
    };
    const response = {
      json(payload: unknown) {
        recorded.payload = payload;
        return payload;
      },
      setHeader(name: string, value: string) {
        recorded.headers.set(name, value);
        return value;
      },
      status(code: number) {
        recorded.statusCode = code;
        return this;
      },
    };

    await checkoutHandler(
      {
        body: { plan: 'pro' },
        headers: { host: 'example.com' },
        method: 'POST',
        url: '/api/billing/checkout',
      } as never,
      response as never,
    );

    expect(recorded.statusCode).toBe(200);
    expect(recorded.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(recorded.payload).toMatchObject({
      ok: true,
      plan: 'pro',
    });
  });

  it('keeps only minimal ASCII-safe merchant data for onboarding checkout', async () => {
    const rawStoreName = '\uC131\uC218 \uBE0C\uB7F0\uCE58 \uD558\uC6B0\uC2A4';
    const rawRegion = '\uC11C\uC6B8 \uC131\uC218\uB3D9';
    const rawCustomerType = '\uC9C1\uC7A5\uC778 \uC810\uC2EC \uACE0\uAC1D';
    const rawSlug = '\uC131\uC218 \uBE0C\uB7F0\uCE58 \uD558\uC6B0\uC2A4';

    const response = await checkoutHandler(
      new Request('https://example.com/api/billing/checkout', {
        body: JSON.stringify({
          customData: {
            customerType: rawCustomerType,
            requestId: 'request_123',
            region: rawRegion,
            slug: rawSlug,
            storeName: rawStoreName,
          },
          plan: 'pro',
          redirectPath: '/onboarding?step=payment',
          source: 'onboarding-flow',
          orderName: '\uc131\uc218 \ube0c\ub7f0\uce58 \ud558\uc6b0\uc2a4 PRO \uacb0\uc81c',
        }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.checkout.redirectUrl).toBe('https://example.com/onboarding?step=payment&portone=redirect&plan=pro');
    expect(payload.checkout.orderName).toBe('\uc131\uc218 \ube0c\ub7f0\uce58 \ud558\uc6b0\uc2a4 PRO \uacb0\uc81c');
    expect(payload.checkout.customData.requestId).toBe('request_123');
    expect(payload.checkout.customData.planKey).toBe('pro');
    expect(payload.checkout.customData.sessionId).toBe(payload.checkout.paymentId);
    expect(payload.checkout.customData.slug).toBe(encodeURIComponent('\uc131\uc218-\ube0c\ub7f0\uce58-\ud558\uc6b0\uc2a4'));
    expect(payload.checkout.customData.source).toBeUndefined();
    expect(payload.checkout.customData.storeName).toBeUndefined();
    expect(payload.checkout.customData.region).toBeUndefined();
    expect(payload.checkout.customData.customerType).toBeUndefined();
    expect(payload.checkout.customData.orderName).toBeUndefined();
  });
});


