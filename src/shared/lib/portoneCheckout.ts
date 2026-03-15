import PortOne, { Currency, PaymentPayMethod, WindowType, type PaymentRequest, type PaymentResponse } from '@portone/browser-sdk/v2';

import type { BillingPlanCode } from './billingPlans';

const CHECKOUT_ENDPOINT = '/api/billing/checkout';

export interface CheckoutSessionPayload {
  channelKey: string;
  currency: 'KRW';
  customData?: Record<string, unknown>;
  noticeUrls?: string[];
  orderName: string;
  payMethod: 'CARD';
  paymentId: string;
  plan: BillingPlanCode;
  redirectUrl: string;
  storeId: string;
  totalAmount: number;
}

export interface CheckoutSessionResponse {
  checkout: CheckoutSessionPayload;
  endpoint: string;
  ok: true;
  plan: BillingPlanCode;
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

function normalizeResponseText(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildFriendlyApiError(
  endpoint: string,
  status: number,
  payload: BillingApiErrorPayload | null,
  responseText: string,
) {
  if (payload?.error || payload?.message) {
    return new PortOneCheckoutError({
      code: payload.code ?? 'CHECKOUT_API_ERROR',
      details: payload.details,
      message: payload.error ?? payload.message ?? `${endpoint} 요청에 실패했습니다.`,
      stage: payload.stage,
      status,
    });
  }

  const normalizedText = normalizeResponseText(responseText);

  if (normalizedText) {
    if (/FUNCTION_INVOCATION_FAILED/i.test(normalizedText)) {
      return new PortOneCheckoutError({
        code: 'FUNCTION_INVOCATION_FAILED',
        details: {
          responseText: normalizedText,
        },
        message: `서버 함수 실행에 실패했습니다. ${normalizedText}`,
        stage: 'server-invocation',
        status,
      });
    }

    return new PortOneCheckoutError({
      code: 'NON_JSON_ERROR_RESPONSE',
      details: {
        responseText: normalizedText,
      },
      message: normalizedText,
      stage: 'server-response',
      status,
    });
  }

  return new PortOneCheckoutError({
    code: 'CHECKOUT_API_ERROR',
    message: `${endpoint} 요청에 실패했습니다.`,
    stage: 'server-response',
    status,
  });
}

async function readApiResponse<T>(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const responseText = await response.text();

  if (!responseText.trim()) {
    return {
      contentType,
      payload: null as T | null,
      responseText,
    };
  }

  if (contentType.includes('application/json')) {
    try {
      return {
        contentType,
        payload: JSON.parse(responseText) as T,
        responseText,
      };
    } catch {
      if (!response.ok) {
        return {
          contentType,
          payload: null as T | null,
          responseText,
        };
      }

      throw new PortOneCheckoutError({
        code: 'INVALID_API_RESPONSE',
        message: '결제 API 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.',
        stage: 'response-parse',
        status: response.status,
      });
    }
  }

  return {
    contentType,
    payload: null as T | null,
    responseText,
  };
}

export async function createCheckoutSession(plan: BillingPlanCode) {
  const response = await fetch(CHECKOUT_ENDPOINT, {
    body: JSON.stringify({ plan }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const { payload, responseText } = await readApiResponse<CheckoutSessionResponse | BillingApiErrorPayload>(response);

  if (!response.ok || !payload || payload.ok !== true) {
    throw buildFriendlyApiError(CHECKOUT_ENDPOINT, response.status, (payload as BillingApiErrorPayload | null) ?? null, responseText);
  }

  return payload;
}

export function buildPortOnePaymentRequest(session: CheckoutSessionPayload): PaymentRequest {
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
    redirectUrl: session.redirectUrl,
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

export function getPortOnePaymentSuccessMessage(payment: PaymentResponse) {
  const status = (payment as Record<string, unknown>).status;

  if (typeof status === 'string' && status.trim()) {
    return `결제 요청이 접수되었습니다. PortOne 상태: ${status}`;
  }

  return `결제 요청이 접수되었습니다. 결제 ID: ${payment.paymentId}`;
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
