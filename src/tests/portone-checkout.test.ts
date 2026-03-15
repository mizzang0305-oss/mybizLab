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
  createCheckoutSession,
  launchPortOneCheckout,
} from '@/shared/lib/portoneCheckout';

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
