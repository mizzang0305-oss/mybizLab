import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestPaymentMock } = vi.hoisted(() => ({
  requestPaymentMock: vi.fn(),
}));

vi.mock('@portone/browser-sdk/v2', () => ({
  Currency: {
    KRW: 'KRW',
  },
  default: {
    requestPayment: requestPaymentMock,
  },
  PaymentPayMethod: {
    CARD: 'CARD',
  },
}));

import {
  PortOneCheckoutError,
  buildPortOnePaymentRequest,
  type CheckoutCustomerPayload,
  type CheckoutSessionPayload,
  type CheckoutSessionResponse,
  createCheckoutSession,
  launchPortOneCheckout,
} from '@/shared/lib/portoneCheckout';

function createValidCheckoutCustomer(
  overrides: Partial<CheckoutCustomerPayload> = {},
): CheckoutCustomerPayload {
  return {
    email: 'buyer@example.com',
    fullName: '홍길동',
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
      payMethod: 'CARD',
      pgProvider: 'KG_INICIS',
      plan: 'starter',
      source: 'pricing-page',
    },
    customer: createValidCheckoutCustomer(),
    noticeUrls: ['https://example.com/api/billing/webhook'],
    orderName: 'Starter 구독',
    payMethod: 'CARD',
    paymentId: 'subscription-starter-001',
    plan: 'starter',
    redirectUrl: 'https://example.com/pricing?portone=redirect&plan=starter',
    storeId: 'store-v2-test',
    totalAmount: 29000,
    ...overrides,
  };
}

function createValidCheckoutSessionResponse(
  overrides: Partial<CheckoutSessionPayload> = {},
): CheckoutSessionResponse {
  return {
    checkout: createValidCheckoutSessionPayload(overrides),
    endpoint: '/api/billing/checkout',
    ok: true,
    plan: 'starter',
  };
}

describe('PortOne checkout client helpers', () => {
  const originalFetch = globalThis.fetch;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requestPaymentMock.mockReset();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubEnv('NEXT_PUBLIC_PORTONE_STORE_ID', 'store-v2-test');
    vi.stubEnv('NEXT_PUBLIC_PORTONE_CHANNEL_KEY', 'channel-key-test');
    vi.stubEnv('VITE_APP_BASE_URL', 'https://example.com');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('creates a checkout session and forwards it to PortOne.requestPayment', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkout: {
            channelKey: 'channel-key-test',
            currency: 'KRW',
            customer: {
              email: 'buyer@example.com',
              fullName: '홍길동',
              phoneNumber: '010-1234-5678',
            },
            noticeUrls: ['https://example.com/api/billing/webhook'],
            orderName: 'Starter 구독',
            payMethod: 'CARD',
            paymentId: 'subscription-starter-001',
            plan: 'starter',
            redirectUrl: 'https://example.com/pricing?portone=redirect&plan=starter',
            storeId: 'store-v2-test',
            totalAmount: 29000,
          },
          endpoint: '/api/billing/checkout',
          ok: true,
          plan: 'starter',
        }),
        {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 200,
        },
      ),
    ) as typeof fetch;
    requestPaymentMock.mockResolvedValue({
      paymentId: 'subscription-starter-001',
      transactionType: 'PAYMENT',
    });

    const result = await launchPortOneCheckout('starter');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/billing/checkout',
      expect.objectContaining({
        body: expect.any(String),
        method: 'POST',
      }),
    );

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(fetchCall?.[1]?.body));

    expect(requestBody).toMatchObject({
      browserContext: {
        appBaseUrl: 'https://example.com',
        channelKey: 'channel-key-test',
        storeId: 'store-v2-test',
      },
      plan: 'starter',
    });
    expect(requestBody.customer).toMatchObject({
      email: expect.any(String),
      fullName: expect.any(String),
      phoneNumber: expect.any(String),
    });

    expect(requestPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channelKey: 'channel-key-test',
        currency: 'KRW',
        customer: {
          email: 'buyer@example.com',
          fullName: '홍길동',
          phoneNumber: '010-1234-5678',
        },
        payMethod: 'CARD',
        paymentId: 'subscription-starter-001',
        redirectUrl: 'https://example.com/pricing?portone=redirect&plan=starter',
        storeId: 'store-v2-test',
        totalAmount: 29000,
      }),
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[portone-checkout] checkout session',
      expect.objectContaining({
        channelKey: 'chan***test',
        customer: expect.objectContaining({
          email: 'b***r@example.com',
          phoneNumber: '010-***5678',
        }),
        paymentId: 'subs***-001',
        redirectUrl: 'https://example.com/pricing?***',
        storeId: 'stor***test',
        totalAmount: 29000,
      }),
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[portone-checkout] requestPayment payload',
      expect.objectContaining({
        channelKey: 'chan***test',
        currency: 'KRW',
        customer: expect.objectContaining({
          email: 'b***r@example.com',
          phoneNumber: '010-***5678',
        }),
        payMethod: 'CARD',
        paymentId: 'subs***-001',
        redirectUrl: 'https://example.com/pricing?***',
        storeId: 'stor***test',
        totalAmount: 29000,
      }),
    );
    expect(result.payment).toMatchObject({
      paymentId: 'subscription-starter-001',
      transactionType: 'PAYMENT',
    });
  });

  it('forwards onboarding checkout options to the billing checkout API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createValidCheckoutSessionResponse()), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
        status: 200,
      }),
    ) as typeof fetch;
    requestPaymentMock.mockResolvedValue({
      paymentId: 'subscription-starter-001',
      transactionType: 'PAYMENT',
    });

    await launchPortOneCheckout('starter', {
      customData: { requestId: 'request_123' },
      customer: {
        email: 'owner@store.kr',
        fullName: '홍길동',
        phoneNumber: '010-1234-5678',
      },
      orderName: '성수 브런치 하우스 Starter 결제',
      redirectPath: '/onboarding?step=payment',
      source: 'onboarding-flow',
    });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(fetchCall?.[1]?.body));

    expect(requestBody).toMatchObject({
      customData: { requestId: 'request_123' },
      customer: {
        email: 'owner@store.kr',
        fullName: '홍길동',
        phoneNumber: '010-1234-5678',
      },
      orderName: '성수 브런치 하우스 Starter 결제',
      redirectPath: '/onboarding?step=payment',
      source: 'onboarding-flow',
    });
  });

  it('returns a clear error when checkout API responds with JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SERVER_MISCONFIGURED',
          error: 'Missing required env for /api/billing/checkout',
          ok: false,
          stage: 'env-load',
        }),
        {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 500,
        },
      ),
    ) as typeof fetch;

    const request = createCheckoutSession('pro');

    await expect(request).rejects.toBeInstanceOf(PortOneCheckoutError);
    await expect(request).rejects.toThrowError(/Missing required env/);
  });

  it('throws before SDK invocation when the server returns an invalid checkout session', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          createValidCheckoutSessionResponse({
            customer: createValidCheckoutCustomer({
              email: '',
            }),
          }),
        ),
        {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 200,
        },
      ),
    ) as typeof fetch;

    const request = launchPortOneCheckout('starter');

    await expect(request).rejects.toMatchObject({
      code: 'INVALID_CHECKOUT_SESSION',
      stage: 'checkout-session-validate',
    });
    expect(requestPaymentMock).not.toHaveBeenCalled();
  });

  it('throws INVALID_CHECKOUT_SESSION when customData is not ASCII-safe', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          customData: {
            storeName: '\uC131\uC218 \uBE0C\uB7F0\uCE58 \uD558\uC6B0\uC2A4',
          },
        }),
      ),
    ).toThrowError(PortOneCheckoutError);

    try {
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          customData: {
            storeName: '\uC131\uC218 \uBE0C\uB7F0\uCE58 \uD558\uC6B0\uC2A4',
          },
        }),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_CHECKOUT_SESSION',
        details: {
          validationErrors: expect.arrayContaining([
            {
              field: 'customData',
              reason: 'must serialize to ASCII-safe JSON for KG Inicis merchantData',
            },
          ]),
        },
      });
    }
  });

  it('builds a PortOne payment request when the checkout session is valid', () => {
    const paymentRequest = buildPortOnePaymentRequest(createValidCheckoutSessionPayload());

    expect(paymentRequest).toMatchObject({
      channelKey: 'channel-key-test',
      currency: 'KRW',
      customer: {
        email: 'buyer@example.com',
        fullName: '홍길동',
        phoneNumber: '010-1234-5678',
      },
      orderName: 'Starter 구독',
      payMethod: 'CARD',
      paymentId: 'subscription-starter-001',
      redirectUrl: 'https://example.com/pricing?portone=redirect&plan=starter',
      storeId: 'store-v2-test',
      totalAmount: 29000,
    });
    expect(paymentRequest).not.toHaveProperty('popup');
    expect(paymentRequest).not.toHaveProperty('windowType');
  });

  it('throws INVALID_CHECKOUT_SESSION when customer data is missing', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          customer: createValidCheckoutCustomer({
            email: '',
            fullName: '',
            phoneNumber: '',
          }),
        }),
      ),
    ).toThrowError(PortOneCheckoutError);

    try {
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          customer: createValidCheckoutCustomer({
            email: '',
            fullName: '',
            phoneNumber: '',
          }),
        }),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_CHECKOUT_SESSION',
      });
      expect(error).toBeInstanceOf(PortOneCheckoutError);
    }
  });

  it('throws INVALID_CHECKOUT_SESSION when payMethod is not CARD', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          payMethod: 'EASY_PAY' as never,
        }),
      ),
    ).toThrowError(PortOneCheckoutError);
  });

  it('throws INVALID_CHECKOUT_SESSION when paymentId exceeds 40 characters', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          paymentId: `mb_st_${'a'.repeat(35)}`,
        }),
      ),
    ).toThrowError(PortOneCheckoutError);

    try {
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          paymentId: `mb_st_${'a'.repeat(35)}`,
        }),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_CHECKOUT_SESSION',
        details: {
          validationErrors: expect.arrayContaining([
            {
              field: 'paymentId',
              reason: 'must be 40 characters or fewer for KG Inicis',
            },
          ]),
        },
      });
    }
  });

  it('throws INVALID_CHECKOUT_SESSION when currency is not KRW', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          currency: 'USD' as never,
        }),
      ),
    ).toThrowError(PortOneCheckoutError);
  });

  it('throws INVALID_CHECKOUT_SESSION when redirectUrl is invalid', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          redirectUrl: '/pricing?portone=redirect&plan=starter',
        }),
      ),
    ).toThrowError(PortOneCheckoutError);
  });

  it.each([
    ['string', '29000'],
    ['zero', 0],
    ['NaN', Number.NaN],
  ])('throws when totalAmount is %s', (_label, totalAmount) => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          totalAmount: totalAmount as never,
        }),
      ),
    ).toThrowError(PortOneCheckoutError);
  });

  it('distinguishes FUNCTION_INVOCATION_FAILED from non-JSON server errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('FUNCTION_INVOCATION_FAILED', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        status: 500,
      }),
    ) as typeof fetch;

    await expect(createCheckoutSession('business')).rejects.toMatchObject({
      code: 'FUNCTION_INVOCATION_FAILED',
      stage: 'server-invocation',
      status: 500,
    });
  });
});
