import PortOne, { Currency, PaymentPayMethod, type PaymentRequest, type PaymentResponse } from '@portone/browser-sdk/v2';

import { requestPublicApi } from '@/shared/lib/publicApiClient';
import { PortOneCheckoutError } from '@/shared/lib/portoneCheckout';

export interface PublicOrderCheckoutSession {
  channelKey: string;
  currency: 'KRW';
  customData?: Record<string, unknown>;
  customer: {
    email: string;
    fullName: string;
    phoneNumber: string;
  };
  noticeUrls?: string[];
  orderName: string;
  payMethod: 'CARD';
  paymentId: string;
  redirectUrl: string;
  storeId: string;
  totalAmount: number;
}

function buildPaymentRequest(session: PublicOrderCheckoutSession): PaymentRequest {
  return {
    channelKey: session.channelKey,
    currency: Currency.KRW,
    customData: session.customData,
    customer: {
      email: session.customer.email,
      fullName: session.customer.fullName,
      phoneNumber: session.customer.phoneNumber,
    },
    noticeUrls: session.noticeUrls,
    orderName: session.orderName,
    payMethod: PaymentPayMethod.CARD,
    paymentId: session.paymentId,
    redirectUrl: session.redirectUrl,
    storeId: session.storeId,
    totalAmount: session.totalAmount,
  };
}

export async function launchPublicOrderPaymentCheckout(input: {
  customer?: {
    email?: string;
    fullName?: string;
    phoneNumber?: string;
  };
  orderId: string;
  redirectPath?: string;
  returnOrigin?: string;
  storeSlug: string;
}) {
  const payload = await requestPublicApi<{
    checkout: PublicOrderCheckoutSession;
    orderId: string;
  }>('/api/public/order-payment-checkout', {
    body: input,
    method: 'POST',
  });

  const paymentRequest = buildPaymentRequest(payload.checkout);
  const payment = await PortOne.requestPayment(paymentRequest);

  return {
    orderId: payload.orderId,
    payment,
    paymentRequest,
    session: payload.checkout,
  };
}

export async function verifyPublicOrderPayment(input: {
  orderId: string;
  paymentId: string;
  storeSlug: string;
}) {
  const payload = await requestPublicApi<{
    order: Record<string, unknown>;
    payment?: {
      paymentId: string;
      paymentStatus: string;
    };
  }>('/api/public/order-payment-verify', {
    body: input,
    method: 'POST',
  });

  if (!payload.order) {
    throw new PortOneCheckoutError({
      code: 'PAYMENT_VERIFY_FAILED',
      message: 'Public order payment verification did not return an updated order.',
      stage: 'payment-verify',
      status: 500,
    });
  }

  return payload;
}

export function getPublicOrderPaymentErrorMessage(payment: PaymentResponse) {
  if (payment.message?.trim()) {
    return payment.message.trim();
  }

  if (payment.pgMessage?.trim()) {
    return payment.pgMessage.trim();
  }

  return '모바일 결제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
