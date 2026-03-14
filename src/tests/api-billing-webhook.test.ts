import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
}));

vi.mock('@portone/server-sdk', () => {
  class MockWebhookVerificationError extends Error {
    reason: string;

    constructor(message: string, reason = 'INVALID_SIGNATURE') {
      super(message);
      this.reason = reason;
    }
  }

  return {
    Webhook: {
      verify: verifyMock,
      WebhookVerificationError: MockWebhookVerificationError,
    },
  };
});

import webhookHandler from '../../api/billing/webhook';

describe('/api/billing/webhook function', () => {
  const originalWebhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
  const originalApiSecret = process.env.PORTONE_V2_API_SECRET;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalViteSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.PORTONE_WEBHOOK_SECRET = 'whsec_test';
    process.env.PORTONE_V2_API_SECRET = 'ptn_secret_test';
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    verifyMock.mockReset();
  });

  afterEach(() => {
    process.env.PORTONE_WEBHOOK_SECRET = originalWebhookSecret;
    process.env.PORTONE_V2_API_SECRET = originalApiSecret;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.VITE_SUPABASE_URL = originalViteSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    vi.unstubAllEnvs();
  });

  it('returns 405 for GET requests', async () => {
    const response = await webhookHandler.fetch(new Request('https://example.com/api/billing/webhook', { method: 'GET' }));
    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(payload).toMatchObject({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
    });
  });

  it('returns 200 for POST requests when PortOne verification succeeds', async () => {
    verifyMock.mockResolvedValue({
      type: 'BillingKey.Issued',
      timestamp: '2026-03-14T09:00:00.000Z',
      data: {
        storeId: 'portone-store-001',
        billingKey: 'billing-key-001',
      },
    });

    const response = await webhookHandler.fetch(
      new Request('https://example.com/api/billing/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': 'test-webhook-id',
          'webhook-signature': 'test-signature',
          'webhook-timestamp': '1700000000',
        },
        body: JSON.stringify({ ok: true }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      endpoint: '/api/billing/webhook',
      normalizedStatus: 'billing_key_issued',
    });
    expect(verifyMock).toHaveBeenCalledWith(
      'whsec_test',
      JSON.stringify({ ok: true }),
      expect.objectContaining({
        'webhook-id': 'test-webhook-id',
        'webhook-signature': 'test-signature',
        'webhook-timestamp': '1700000000',
      }),
    );
  });
});
