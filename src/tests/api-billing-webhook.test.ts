import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { MockWebhookVerificationError, verifyMock } = vi.hoisted(() => {
  class HoistedWebhookVerificationError extends Error {
    reason: string;

    constructor(message: string, reason = 'INVALID_SIGNATURE') {
      super(message);
      this.reason = reason;
    }
  }

  return {
    MockWebhookVerificationError: HoistedWebhookVerificationError,
    verifyMock: vi.fn(),
  };
});

vi.mock('@portone/server-sdk', () => ({
  Webhook: {
    verify: verifyMock,
    WebhookVerificationError: MockWebhookVerificationError,
  },
}));

import webhookHandler from '../../api/billing/webhook';

const webhookHeaders = {
  'content-type': 'application/json',
  'webhook-id': 'test-webhook-id',
  'webhook-signature': 'test-signature',
  'webhook-timestamp': '1700000000',
} as const;

describe('/api/billing/webhook function', () => {
  const originalApiSecret = process.env.PORTONE_API_SECRET;
  const originalLegacyApiSecret = process.env.PORTONE_V2_API_SECRET;
  const originalWebhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
  const originalStoreId = process.env.PORTONE_STORE_ID;
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalViteSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.PORTONE_API_SECRET = 'ptn_secret_test';
    delete process.env.PORTONE_V2_API_SECRET;
    process.env.PORTONE_WEBHOOK_SECRET = 'whsec_test';
    process.env.PORTONE_STORE_ID = 'store-v2-test';
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    verifyMock.mockReset();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    process.env.PORTONE_API_SECRET = originalApiSecret;
    process.env.PORTONE_V2_API_SECRET = originalLegacyApiSecret;
    process.env.PORTONE_WEBHOOK_SECRET = originalWebhookSecret;
    process.env.PORTONE_STORE_ID = originalStoreId;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.VITE_SUPABASE_URL = originalViteSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns 405 for GET requests', async () => {
    const response = await webhookHandler.fetch(new Request('https://example.com/api/billing/webhook', { method: 'GET' }));
    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(payload).toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
      ok: false,
    });
  });

  it('returns 500 with a clear message when PORTONE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.PORTONE_WEBHOOK_SECRET;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
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

  it('returns 401 when PortOne webhook signature verification fails', async () => {
    verifyMock.mockRejectedValue(new MockWebhookVerificationError('Signature mismatch', 'INVALID_SIGNATURE'));
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      code: 'PORTONE_WEBHOOK_VERIFICATION_FAILED',
      ok: false,
      reason: 'INVALID_SIGNATURE',
      stage: 'webhook-verify',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns JSON 500 when an unexpected webhook verification error bubbles up', async () => {
    verifyMock.mockRejectedValue(new Error('Unexpected verifier failure'));
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      code: 'PORTONE_WEBHOOK_INTERNAL_ERROR',
      ok: false,
      stage: 'webhook-unhandled',
      error: 'Unexpected verifier failure',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when required webhook headers are missing during verification', async () => {
    verifyMock.mockRejectedValue(
      new MockWebhookVerificationError('Missing webhook headers', 'MISSING_REQUIRED_HEADERS'),
    );
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'PORTONE_WEBHOOK_VERIFICATION_FAILED',
      ok: false,
      reason: 'MISSING_REQUIRED_HEADERS',
      stage: 'webhook-verify',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('re-queries billing key state after BillingKey.Issued and returns 200', async () => {
    verifyMock.mockResolvedValue({
      data: {
        billingKey: 'billing-key-001',
        storeId: 'portone-store-001',
      },
      timestamp: '2026-03-14T09:00:00.000Z',
      type: 'BillingKey.Issued',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          billingKey: 'billing-key-001',
          customer: {},
          status: 'ISSUED',
          storeId: 'portone-store-001',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      ),
    ) as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      billingKey: 'billing-key-001',
      normalizedStatus: 'billing_key_issued',
      ok: true,
    });
    expect(String(url)).toContain('/billing-keys/billing-key-001');
    expect(String(url)).toContain('storeId=portone-store-001');
  });

  it('re-queries payment state after Transaction.Paid and returns 200', async () => {
    verifyMock.mockResolvedValue({
      data: {
        paymentId: 'payment-001',
        storeId: 'portone-store-001',
      },
      timestamp: '2026-03-14T10:00:00.000Z',
      type: 'Transaction.Paid',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          billingKey: 'billing-key-001',
          paymentId: 'payment-001',
          status: 'PAID',
          storeId: 'portone-store-001',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      ),
    ) as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      normalizedStatus: 'payment_completed',
      ok: true,
      paymentId: 'payment-001',
    });
    expect(String(url)).toContain('/payments/payment-001');
    expect(String(url)).toContain('storeId=portone-store-001');
  });

  it('returns JSON 500 when a real webhook event requires PORTONE_API_SECRET but it is missing', async () => {
    delete process.env.PORTONE_API_SECRET;
    verifyMock.mockResolvedValue({
      data: {
        paymentId: 'payment-001',
        storeId: 'portone-store-001',
      },
      timestamp: '2026-03-14T10:15:00.000Z',
      type: 'Transaction.Paid',
    });
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      code: 'SERVER_MISCONFIGURED',
      ok: false,
      stage: 'env-load',
      error: 'PORTONE_API_SECRET is required for /api/billing/webhook sync',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 200 ignored for identifierless Transaction sample payloads', async () => {
    delete process.env.PORTONE_API_SECRET;
    verifyMock.mockResolvedValue({
      data: {
        storeId: 'portone-store-001',
      },
      timestamp: '2026-03-14T10:30:00.000Z',
      type: 'Transaction.Paid',
    });
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      endpoint: '/api/billing/webhook',
      normalizedStatus: 'ignored',
      ok: true,
      actions: ['ignored'],
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('ignores unknown webhook types and still returns 200', async () => {
    verifyMock.mockResolvedValue({
      data: {
        storeId: 'portone-store-001',
      },
      timestamp: '2026-03-14T11:00:00.000Z',
      type: 'Webhook.Ping',
    });
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        body: JSON.stringify({ ok: true }),
        headers: webhookHeaders,
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      actions: ['ignored'],
      endpoint: '/api/billing/webhook',
      normalizedStatus: 'ignored',
      ok: true,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
