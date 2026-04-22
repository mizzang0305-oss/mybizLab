import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestPaymentMock, requestPublicApiMock } = vi.hoisted(() => ({
  requestPaymentMock: vi.fn(),
  requestPublicApiMock: vi.fn(),
}));

vi.mock('@portone/browser-sdk/v2', () => ({
  Currency: {
    KRW: 'KRW',
  },
  PaymentPayMethod: {
    CARD: 'CARD',
  },
  default: {
    requestPayment: requestPaymentMock,
  },
}));

vi.mock('@/shared/lib/publicApiClient', () => ({
  requestPublicApi: requestPublicApiMock,
}));

import {
  getPublicOrderPaymentErrorMessage,
  launchPublicOrderPaymentCheckout,
  verifyPublicOrderPayment,
} from '@/shared/lib/publicOrderPayment';

describe('public order payment helpers', () => {
  beforeEach(() => {
    requestPaymentMock.mockReset();
    requestPublicApiMock.mockReset();
  });

  it('starts a PortOne checkout session for a public order mobile payment', async () => {
    requestPublicApiMock.mockResolvedValue({
      checkout: {
        channelKey: 'channel-key-test',
        currency: 'KRW',
        customer: {
          email: 'guest@example.com',
          fullName: 'Kim Guest',
          phoneNumber: '010-1234-5678',
        },
        orderName: 'Golden Coffee 주문',
        payMethod: 'CARD',
        paymentId: 'mb_ord_001',
        redirectUrl: 'https://example.com/golden-coffee/order?table=A1&portone=public-order&orderId=order_001',
        storeId: 'portone-store-test',
        totalAmount: 18000,
      },
      orderId: 'order_001',
    });
    requestPaymentMock.mockResolvedValue({
      paymentId: 'payment-live-001',
    });

    const result = await launchPublicOrderPaymentCheckout({
      customer: {
        email: 'guest@example.com',
        fullName: 'Kim Guest',
        phoneNumber: '010-1234-5678',
      },
      orderId: 'order_001',
      redirectPath: '/golden-coffee/order?table=A1',
      returnOrigin: 'https://example.com',
      storeSlug: 'golden-coffee',
    });

    expect(requestPublicApiMock).toHaveBeenCalledWith('/api/public/order-payment-checkout', {
      body: {
        customer: {
          email: 'guest@example.com',
          fullName: 'Kim Guest',
          phoneNumber: '010-1234-5678',
        },
        orderId: 'order_001',
        redirectPath: '/golden-coffee/order?table=A1',
        returnOrigin: 'https://example.com',
        storeSlug: 'golden-coffee',
      },
      method: 'POST',
    });
    expect(requestPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channelKey: 'channel-key-test',
        currency: 'KRW',
        orderName: 'Golden Coffee 주문',
        payMethod: 'CARD',
        paymentId: 'mb_ord_001',
        storeId: 'portone-store-test',
        totalAmount: 18000,
      }),
    );
    expect(result.orderId).toBe('order_001');
    expect(result.payment).toMatchObject({
      paymentId: 'payment-live-001',
    });
  });

  it('verifies a completed public order payment through the public API', async () => {
    requestPublicApiMock.mockResolvedValue({
      order: {
        id: 'order_001',
        payment_status: 'paid',
      },
      payment: {
        paymentId: 'payment-live-001',
        paymentStatus: 'PAID',
      },
    });

    const result = await verifyPublicOrderPayment({
      orderId: 'order_001',
      paymentId: 'payment-live-001',
      storeSlug: 'golden-coffee',
    });

    expect(requestPublicApiMock).toHaveBeenCalledWith('/api/public/order-payment-verify', {
      body: {
        orderId: 'order_001',
        paymentId: 'payment-live-001',
        storeSlug: 'golden-coffee',
      },
      method: 'POST',
    });
    expect(result.order).toMatchObject({
      id: 'order_001',
      payment_status: 'paid',
    });
  });

  it('throws a clear error when payment verification does not return an updated order', async () => {
    requestPublicApiMock.mockResolvedValue({
      payment: {
        paymentId: 'payment-live-001',
        paymentStatus: 'PAID',
      },
    });

    await expect(
      verifyPublicOrderPayment({
        orderId: 'order_001',
        paymentId: 'payment-live-001',
        storeSlug: 'golden-coffee',
      }),
    ).rejects.toThrow('Public order payment verification did not return an updated order.');
  });

  it('prefers explicit payment error messages for customer-facing mobile payment failures', () => {
    expect(
      getPublicOrderPaymentErrorMessage({
        message: '카드 인증이 취소되었습니다.',
      } as never),
    ).toBe('카드 인증이 취소되었습니다.');

    expect(
      getPublicOrderPaymentErrorMessage({
        pgMessage: '한도 초과',
      } as never),
    ).toBe('한도 초과');
  });
});
