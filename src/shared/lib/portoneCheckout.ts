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

type CheckoutSessionField =
  | 'channelKey'
  | 'currency'
  | 'orderName'
  | 'payMethod'
  | 'paymentId'
  | 'redirectUrl'
  | 'storeId'
  | 'totalAmount';

interface CheckoutSessionValidationIssue {
  field: CheckoutSessionField;
  reason: string;
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

function normalizeNonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAbsoluteHttpUrl(value: unknown) {
  const normalized = normalizeNonEmptyString(value);

  if (!normalized) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPositiveFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function resolveCheckoutPayload(session: CheckoutSessionPayload | CheckoutSessionResponse) {
  if ('checkout' in session) {
    return session.checkout;
  }

  return session;
}

function createCheckoutSessionValidationMessage(issues: CheckoutSessionValidationIssue[]) {
  return `Checkout session is invalid: ${issues.map(({ field, reason }) => `${field} (${reason})`).join(', ')}`;
}

export function assertCheckoutSession(
  session: CheckoutSessionPayload | CheckoutSessionResponse,
): CheckoutSessionPayload {
  const checkout = resolveCheckoutPayload(session);
  const issues: CheckoutSessionValidationIssue[] = [];

  if (!normalizeNonEmptyString(checkout.storeId)) {
    issues.push({
      field: 'storeId',
      reason: 'must be a non-empty string',
    });
  }

  if (!normalizeNonEmptyString(checkout.channelKey)) {
    issues.push({
      field: 'channelKey',
      reason: 'must be a non-empty string',
    });
  }

  if (!normalizeNonEmptyString(checkout.paymentId)) {
    issues.push({
      field: 'paymentId',
      reason: 'must be a non-empty string',
    });
  }

  if (!normalizeNonEmptyString(checkout.orderName)) {
    issues.push({
      field: 'orderName',
      reason: 'must be a non-empty string',
    });
  }

  if (!isAbsoluteHttpUrl(checkout.redirectUrl)) {
    issues.push({
      field: 'redirectUrl',
      reason: 'must be an absolute http/https URL',
    });
  }

  if (!isPositiveFiniteNumber(checkout.totalAmount)) {
    issues.push({
      field: 'totalAmount',
      reason: 'must be a positive finite number',
    });
  }

  if (checkout.currency !== 'KRW') {
    issues.push({
      field: 'currency',
      reason: 'must be KRW',
    });
  }

  if (checkout.payMethod !== 'CARD') {
    issues.push({
      field: 'payMethod',
      reason: 'must be CARD',
    });
  }

  if (issues.length > 0) {
    throw new PortOneCheckoutError({
      code: 'INVALID_CHECKOUT_SESSION',
      details: {
        channelKeyConfigured: Boolean(normalizeNonEmptyString(checkout.channelKey)),
        missingOrInvalidFields: issues.map(({ field }) => field),
        plan: checkout.plan ?? null,
        redirectUrl: normalizeNonEmptyString(checkout.redirectUrl) || null,
        storeIdConfigured: Boolean(normalizeNonEmptyString(checkout.storeId)),
        totalAmount: checkout.totalAmount,
        validationErrors: issues,
      },
      message: createCheckoutSessionValidationMessage(issues),
      stage: 'checkout-session-validate',
    });
  }

  return checkout;
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
  const checkout = assertCheckoutSession(session);

  return {
    channelKey: checkout.channelKey,
    currency: Currency.KRW,
    customData: checkout.customData,
    noticeUrls: checkout.noticeUrls,
    orderName: checkout.orderName,
    payMethod: PaymentPayMethod.CARD,
    paymentId: checkout.paymentId,
    popup: {
      center: true,
    },
    redirectUrl: checkout.redirectUrl,
    storeId: checkout.storeId,
    totalAmount: checkout.totalAmount,
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
  console.info('[portone-checkout] checkout session', {
    channelKey: session.checkout.channelKey,
    currency: session.checkout.currency,
    orderName: session.checkout.orderName,
    payMethod: session.checkout.payMethod,
    paymentId: session.checkout.paymentId,
    plan: session.checkout.plan,
    redirectUrl: session.checkout.redirectUrl,
    storeId: session.checkout.storeId,
    totalAmount: session.checkout.totalAmount,
  });
  const checkout = assertCheckoutSession(session);
  const paymentRequest = buildPortOnePaymentRequest(checkout);
  const payment = await PortOne.requestPayment(paymentRequest);

  return {
    payment,
    paymentRequest,
    session,
  };
}
