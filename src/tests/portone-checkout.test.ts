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
  verifyCheckoutPayment,
} from '@/shared/lib/portoneCheckout';

describe('PortOne checkout client helpers', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_APP_BASE_URL', 'https://example.com');
    vi.stubEnv('VITE_PORTONE_STORE_ID', 'store-v2-test');
    vi.stubEnv('VITE_PORTONE_CHANNEL_KEY', 'channel-key-test');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    requestPaymentMock.mockReset();
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
            orderName: 'Starter 월 구독',
            payMethod: 'CARD',
            paymentId: 'subscription-starter-001',
            plan: 'starter',
            storeId: 'store-v2-test',
            totalAmount: 29000,
          },
          endpoint: '/api/billing/checkout',
          ok: true,
          plan: 'starter',
        }),
        {
          headers: { 'content-type': 'application/json' },
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

  it('returns a clear error when checkout API responds with a billing error payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SERVER_MISCONFIGURED',
          error: 'Missing required env for /api/billing/checkout',
          ok: false,
          stage: 'env-load',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 500,
        },
      ),
    ) as typeof fetch;

    const request = createCheckoutSession('pro');

    await expect(request).rejects.toBeInstanceOf(PortOneCheckoutError);
    await expect(request).rejects.toThrowError(/Missing required env/);
  });

  it('verifies a payment through the verify endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          endpoint: '/api/billing/verify',
          ok: true,
          payment: {
            id: 'payment-123',
            status: 'PAID',
          },
          paymentId: 'payment-123',
          portoneStatus: 200,
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      ),
    ) as typeof fetch;

    const payload = await verifyCheckoutPayment('payment-123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/billing/verify',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(payload).toMatchObject({
      ok: true,
      paymentId: 'payment-123',
      portoneStatus: 200,
    });
  });
});
