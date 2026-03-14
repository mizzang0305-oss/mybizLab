import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildBillingWebhookMutation,
  createBillingWebhookErrorResponse,
  getBillingWebhookStoreSnapshotForTests,
  handleBillingWebhook,
  persistBillingWebhookMutation,
  resetBillingWebhookStoreForTests,
} from '@/server/billingWebhook';

const webhookHeaders = {
  'webhook-id': 'test-webhook-id',
  'webhook-signature': 'test-signature',
  'webhook-timestamp': '1700000000',
} as const;

describe('billing webhook processing', () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalViteSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalWebhookSecret = process.env.PORTONE_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.PORTONE_WEBHOOK_SECRET;
    resetBillingWebhookStoreForTests();
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.VITE_SUPABASE_URL = originalViteSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    process.env.PORTONE_WEBHOOK_SECRET = originalWebhookSecret;
    vi.unstubAllEnvs();
    resetBillingWebhookStoreForTests();
  });

  it('marks billing key issuance as subscription activation and stores it in the placeholder store', async () => {
    const mutation = buildBillingWebhookMutation(
      {
        type: 'BillingKey.Issued',
        timestamp: '2026-03-14T09:00:00.000Z',
        data: {
          storeId: 'portone-store-001',
          billingKey: 'billing-key-001',
        },
      },
      webhookHeaders,
    );

    const persistence = await persistBillingWebhookMutation(mutation);
    const snapshot = getBillingWebhookStoreSnapshotForTests();

    expect(persistence).toBe('memory');
    expect(mutation.eventLog.actions).toEqual(['billing_key_issued', 'subscription_active']);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.states[0]?.billingKeyStatus).toBe('issued');
    expect(snapshot.states[0]?.subscriptionStatus).toBe('active');
  });

  it('moves an issued billing key into past_due when a transaction fails afterwards', async () => {
    await persistBillingWebhookMutation(
      buildBillingWebhookMutation(
        {
          type: 'BillingKey.Issued',
          timestamp: '2026-03-14T09:00:00.000Z',
          data: {
            storeId: 'portone-store-001',
            billingKey: 'billing-key-001',
          },
        },
        {
          ...webhookHeaders,
          'webhook-id': 'test-webhook-id-issued',
        },
      ),
    );

    const failedMutation = buildBillingWebhookMutation(
      {
        type: 'Transaction.Failed',
        timestamp: '2026-03-14T10:00:00.000Z',
        data: {
          storeId: 'portone-store-001',
          paymentId: 'payment-001',
          transactionId: 'transaction-001',
        },
      },
      {
        ...webhookHeaders,
        'webhook-id': 'test-webhook-id-failed',
      },
    );

    await persistBillingWebhookMutation(failedMutation);
    const snapshot = getBillingWebhookStoreSnapshotForTests();

    expect(failedMutation.eventLog.normalizedStatus).toBe('payment_failed');
    expect(snapshot.states[0]?.paymentStatus).toBe('failed');
    expect(snapshot.states[0]?.subscriptionStatus).toBe('past_due');
  });

  it('returns a misconfiguration response when the PortOne webhook secret is missing', async () => {
    await expect(
      handleBillingWebhook({
        rawBody: '{}',
        headers: new Headers(webhookHeaders),
        requestUrl: 'https://example.com/api/billing/webhook',
      }),
    ).rejects.toThrowError(/PORTONE_WEBHOOK_SECRET/);

    const response = createBillingWebhookErrorResponse(new Error('Missing required server env PORTONE_WEBHOOK_SECRET'));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      ok: false,
      code: 'SERVER_MISCONFIGURED',
    });
  });
});
