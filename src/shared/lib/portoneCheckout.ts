import PortOne, { Currency, PaymentPayMethod, WindowType, type PaymentResponse, type PaymentRequest } from '@portone/browser-sdk/v2';

import type { BillingPlanCode } from '@/shared/lib/billingPlans';
import { getPortOneBrowserEnv } from '@/shared/lib/portoneEnv';

const CHECKOUT_ENDPOINT = '/api/billing/checkout';
const VERIFY_ENDPOINT = '/api/billing/verify';

export interface CheckoutSessionPayload {
  channelKey: string;
  currency: 'KRW';
  customData?: Record<string, unknown>;
  noticeUrls?: string[];
  orderName: string;
  payMethod: 'CARD';
  paymentId: string;
  plan: BillingPlanCode;
  storeId: string;
  totalAmount: number;
}

export interface CheckoutSessionResponse {
  checkout: CheckoutSessionPayload;
  endpoint: string;
  ok: true;
  plan: BillingPlanCode;
}

export interface CheckoutVerifyResponse {
  endpoint: string;
  ok: true;
  payment: Record<string, unknown> | null;
  paymentId: string;
  portoneStatus: number;
}

interface BillingApiErrorPayload {
  code?: string;
  details?: Record<string, unknown>;
  error?: string;
  message?: string;
  ok?: false;
  stage?: string;
}

export class PortOneCheckoutError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  stage?: string;
  status?: number;

  constructor(input: {
    code?: string;
    details?: Record<string, unknown>;
    message: string;
    stage?: string;
    status?: number;
  }) {
    super(input.message);
    this.name = 'PortOneCheckoutError';
    this.code = input.code;
    this.details = input.details;
    this.stage = input.stage;
    this.status = input.status;
  }
}

function trimSlash(value: string) {
  return value.replace(/\/$/, '');
}

function buildFriendlyApiError(endpoint: string, status: number, payload: BillingApiErrorPayload | null) {
  return new PortOneCheckoutError({
    code: payload?.code ?? 'CHECKOUT_API_ERROR',
    details: payload?.details,
    message: payload?.error ?? payload?.message ?? `${endpoint} 요청에 실패했습니다.`,
    stage: payload?.stage,
    status,
  });
}

async function parseJsonResponse<T>(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null as T | null;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new PortOneCheckoutError({
      code: 'INVALID_API_RESPONSE',
      message: '결제 API 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.',
      stage: 'response-parse',
      status: response.status,
    });
  }
}

export async function createCheckoutSession(plan: BillingPlanCode) {
  const response = await fetch(CHECKOUT_ENDPOINT, {
    body: JSON.stringify({ plan }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const payload = await parseJsonResponse<CheckoutSessionResponse | BillingApiErrorPayload>(response);

  if (!response.ok || !payload || payload.ok !== true) {
    throw buildFriendlyApiError(CHECKOUT_ENDPOINT, response.status, (payload as BillingApiErrorPayload | null) ?? null);
  }

  return payload;
}

export async function verifyCheckoutPayment(paymentId: string) {
  const response = await fetch(VERIFY_ENDPOINT, {
    body: JSON.stringify({ paymentId }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const payload = await parseJsonResponse<CheckoutVerifyResponse | BillingApiErrorPayload>(response);

  if (!response.ok || !payload || payload.ok !== true) {
    throw buildFriendlyApiError(VERIFY_ENDPOINT, response.status, (payload as BillingApiErrorPayload | null) ?? null);
  }

  return payload;
}

export function buildPortOnePaymentRequest(session: CheckoutSessionPayload): PaymentRequest {
  const { appBaseUrl } = getPortOneBrowserEnv();
  const normalizedBaseUrl = trimSlash(appBaseUrl);

  return {
    channelKey: session.channelKey,
    currency: Currency.KRW,
    customData: session.customData,
    noticeUrls: session.noticeUrls,
    orderName: session.orderName,
    payMethod: PaymentPayMethod.CARD,
    paymentId: session.paymentId,
    popup: {
      center: true,
    },
    redirectUrl: `${normalizedBaseUrl}/pricing?portone=redirect&plan=${encodeURIComponent(session.plan)}`,
    storeId: session.storeId,
    totalAmount: session.totalAmount,
    windowType: {
      mobile: WindowType.REDIRECTION,
      pc: WindowType.POPUP,
    },
  };
}

export function getPortOnePaymentErrorMessage(payment: PaymentResponse) {
  if (payment.message?.trim()) {
    return payment.message.trim();
  }

  if (payment.pgMessage?.trim()) {
    return payment.pgMessage.trim();
  }

  return '결제창에서 요청을 완료하지 못했습니다. 팝업 차단을 해제한 뒤 다시 시도해주세요.';
}

export function getPortOneVerifyMessage(verification: CheckoutVerifyResponse) {
  const paymentStatus = typeof verification.payment?.status === 'string' ? verification.payment.status : undefined;

  if (paymentStatus) {
    return `결제 요청이 접수되었습니다. PortOne 상태: ${paymentStatus}`;
  }

  return `결제 요청이 접수되었습니다. 결제 ID: ${verification.paymentId}`;
}

export async function launchPortOneCheckout(plan: BillingPlanCode) {
  const session = await createCheckoutSession(plan);
  const paymentRequest = buildPortOnePaymentRequest(session.checkout);
  const payment = await PortOne.requestPayment(paymentRequest);

  return {
    payment,
    paymentRequest,
    session,
  };
}
