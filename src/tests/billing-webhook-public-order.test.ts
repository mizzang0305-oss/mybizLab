import { describe, expect, it } from 'vitest';

import { buildBillingWebhookMutation, buildBillingWebhookSideEffect } from '@/server/billingWebhook';

const webhookHeaders = {
  'webhook-id': 'public-order-webhook',
  'webhook-signature': 'signature',
  'webhook-timestamp': '1700000000',
} as const;

describe('billing webhook public order side effects', () => {
  it('builds a public order payment side effect when a paid transaction resolves a public order checkout', () => {
    const resolvedResource = {
      kind: 'payment' as const,
      paymentId: 'payment-live-001',
      payload: {
        customData: {
          kind: 'public_order',
          orderId: 'order_001',
          storeId: 'store_live_001',
        },
        paymentId: 'payment-live-001',
        status: 'PAID',
        storeId: 'portone-store-001',
      },
      status: 'PAID',
      storeId: 'portone-store-001',
    };

    const mutation = buildBillingWebhookMutation(
      {
        data: {
          paymentId: 'payment-live-001',
          storeId: 'portone-store-001',
        },
        timestamp: '2026-04-22T10:00:00.000Z',
        type: 'Transaction.Paid',
      },
      webhookHeaders,
      resolvedResource,
    );

    const sideEffect = buildBillingWebhookSideEffect(mutation, resolvedResource);

    expect(sideEffect).toMatchObject({
      kind: 'public_order_payment',
      orderId: 'order_001',
      paymentId: 'payment-live-001',
      storeId: 'store_live_001',
    });
  });

  it('does not build a public order side effect for non-public-order payments', () => {
    const resolvedResource = {
      kind: 'payment' as const,
      paymentId: 'payment-live-002',
      payload: {
        customData: {
          kind: 'subscription',
          planKey: 'pro',
        },
        paymentId: 'payment-live-002',
        status: 'PAID',
        storeId: 'portone-store-001',
      },
      status: 'PAID',
      storeId: 'portone-store-001',
    };

    const mutation = buildBillingWebhookMutation(
      {
        data: {
          paymentId: 'payment-live-002',
          storeId: 'portone-store-001',
        },
        timestamp: '2026-04-22T10:05:00.000Z',
        type: 'Transaction.Paid',
      },
      {
        ...webhookHeaders,
        'webhook-id': 'subscription-webhook',
      },
      resolvedResource,
    );

    expect(buildBillingWebhookSideEffect(mutation, resolvedResource)).toBeNull();
  });
});
