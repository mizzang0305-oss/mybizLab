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
  WindowType: {
    POPUP: 'POPUP',
    REDIRECTION: 'REDIRECTION',
  },
}));

import {
  PortOneCheckoutError,
  buildPortOnePaymentRequest,
  type CheckoutSessionPayload,
  type CheckoutSessionResponse,
  createCheckoutSession,
  launchPortOneCheckout,
} from '@/shared/lib/portoneCheckout';

function createValidCheckoutSessionPayload(
  overrides: Partial<CheckoutSessionPayload> = {},
): CheckoutSessionPayload {
  return {
    channelKey: 'channel-key-test',
    currency: 'KRW',
    customData: {
      initiatedAt: '2026-03-15T00:00:00.000Z',
      plan: 'starter',
      source: 'pricing-page',
    },
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

  beforeEach(() => {
    requestPaymentMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('creates a checkout session and forwards it to PortOne.requestPayment', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkout: {
            channelKey: 'channel-key-test',
            currency: 'KRW',
            noticeUrls: ['https://example.com/api/billing/webhook'],
            orderName: 'Starter 월 구독',
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
        method: 'POST',
      }),
    );
    expect(requestPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channelKey: 'channel-key-test',
        paymentId: 'subscription-starter-001',
        redirectUrl: 'https://example.com/pricing?portone=redirect&plan=starter',
        storeId: 'store-v2-test',
        totalAmount: 29000,
        windowType: {
          mobile: 'REDIRECTION',
          pc: 'POPUP',
        },
      }),
    );
    expect(result.payment).toMatchObject({
      paymentId: 'subscription-starter-001',
      transactionType: 'PAYMENT',
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
      new Response(JSON.stringify(createValidCheckoutSessionResponse({ redirectUrl: '/pricing' })), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
        status: 200,
      }),
    ) as typeof fetch;

    const request = launchPortOneCheckout('starter');

    await expect(request).rejects.toMatchObject({
      code: 'INVALID_CHECKOUT_SESSION',
      stage: 'checkout-session-validate',
    });
    expect(requestPaymentMock).not.toHaveBeenCalled();
  });

  it('builds a PortOne payment request when the checkout session is valid', () => {
    const paymentRequest = buildPortOnePaymentRequest(createValidCheckoutSessionPayload());

    expect(paymentRequest).toMatchObject({
      channelKey: 'channel-key-test',
      currency: 'KRW',
      orderName: 'Starter 구독',
      payMethod: 'CARD',
      paymentId: 'subscription-starter-001',
      redirectUrl: 'https://example.com/pricing?portone=redirect&plan=starter',
      storeId: 'store-v2-test',
      totalAmount: 29000,
      windowType: {
        mobile: 'REDIRECTION',
        pc: 'POPUP',
      },
    });
  });

  it('throws INVALID_CHECKOUT_SESSION when redirectUrl is invalid', () => {
    expect(() =>
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          redirectUrl: '/pricing?portone=redirect&plan=starter',
        }),
      ),
    ).toThrowError(PortOneCheckoutError);

    try {
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          redirectUrl: '/pricing?portone=redirect&plan=starter',
        }),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_CHECKOUT_SESSION',
      });
      expect(error).toBeInstanceOf(PortOneCheckoutError);
    }
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

    try {
      buildPortOnePaymentRequest(
        createValidCheckoutSessionPayload({
          totalAmount: totalAmount as never,
        }),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_CHECKOUT_SESSION',
      });
      expect(error).toBeInstanceOf(PortOneCheckoutError);
    }
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
