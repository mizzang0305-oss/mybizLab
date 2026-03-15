import PortOne, { Currency, PaymentPayMethod, type PaymentRequest, type PaymentResponse } from '@portone/browser-sdk/v2';

import type { BillingPlanCode } from './billingPlans';
import { BUSINESS_INFO } from './siteConfig';

const CHECKOUT_ENDPOINT = '/api/billing/checkout';
const KG_INICIS_PAYMENT_ID_MAX_LENGTH = 40;

interface BrowserCheckoutContext {
  appBaseUrl: string;
  channelKey: string;
  storeId: string;
}

export interface CheckoutCustomerPayload {
  email: string;
  fullName: string;
  phoneNumber: string;
}

export interface CheckoutSessionPayload {
  channelKey: string;
  currency: 'KRW';
  customData?: Record<string, unknown>;
  customer: CheckoutCustomerPayload;
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
  } else if (checkout.storeId !== browserEnv.storeId) {
    issues.push({
      field: 'storeId',
      reason: 'must match NEXT_PUBLIC_PORTONE_STORE_ID',
    });
  }

  if (!normalizeNonEmptyString(checkout.channelKey)) {
    issues.push({
      field: 'channelKey',
      reason: 'must be a non-empty string',
    });
  } else if (checkout.channelKey !== browserEnv.channelKey) {
    issues.push({
      field: 'channelKey',
      reason: 'must match NEXT_PUBLIC_PORTONE_CHANNEL_KEY',
    });
  }

  if (!normalizeNonEmptyString(checkout.paymentId)) {
    issues.push({
      field: 'paymentId',
      reason: 'must be a non-empty string',
    });
  } else if (!isAsciiSafePaymentId(checkout.paymentId)) {
    issues.push({
      field: 'paymentId',
      reason: 'must contain only ASCII letters, numbers, underscores, or hyphens',
    });
  } else if (checkout.paymentId.length > KG_INICIS_PAYMENT_ID_MAX_LENGTH) {
    issues.push({
      field: 'paymentId',
      reason: 'must be 40 characters or fewer for KG Inicis',
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
  } else if (!checkout.redirectUrl.startsWith(browserEnv.appBaseUrl)) {
    issues.push({
      field: 'redirectUrl',
      reason: 'must use the VITE_APP_BASE_URL origin',
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

  if (!customer || typeof customer !== 'object') {
    issues.push({
      field: 'customer.fullName',
      reason: 'is required for KG Inicis card checkout',
    });
    issues.push({
      field: 'customer.phoneNumber',
      reason: 'is required for KG Inicis card checkout',
    });
    issues.push({
      field: 'customer.email',
      reason: 'is required for KG Inicis card checkout',
    });
  } else {
    if (!normalizeNonEmptyString(customer.fullName)) {
      issues.push({
        field: 'customer.fullName',
        reason: 'is required for KG Inicis card checkout',
      });
    }

    if (!normalizeNonEmptyString(customer.phoneNumber)) {
      issues.push({
        field: 'customer.phoneNumber',
        reason: 'is required for KG Inicis card checkout',
      });
    }

    if (!normalizeNonEmptyString(customer.email)) {
      issues.push({
        field: 'customer.email',
        reason: 'is required for KG Inicis card checkout',
      });
    } else if (!isValidEmailAddress(customer.email)) {
      issues.push({
        field: 'customer.email',
        reason: 'must be a valid email address',
      });
    }
  }

  if (issues.length > 0) {
    throw new PortOneCheckoutError({
      code: 'INVALID_CHECKOUT_SESSION',
      details: {
        channelKeyConfigured: Boolean(normalizeNonEmptyString(checkout.channelKey)),
        customerConfigured: {
          email: Boolean(normalizeNonEmptyString(customer?.email)),
          fullName: Boolean(normalizeNonEmptyString(customer?.fullName)),
          phoneNumber: Boolean(normalizeNonEmptyString(customer?.phoneNumber)),
        },
        missingOrInvalidFields: issues.map(({ field }) => field),
        paymentId: normalizeNonEmptyString(checkout.paymentId) || null,
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
      message: payload.error ?? payload.message ?? `${endpoint} ?붿껌???ㅽ뙣?덉뒿?덈떎.`,
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
        message: `?쒕쾭 ?⑥닔 ?ㅽ뻾???ㅽ뙣?덉뒿?덈떎. ${normalizedText}`,
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
    message: `${endpoint} ?붿껌???ㅽ뙣?덉뒿?덈떎.`,
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
        message: '寃곗젣 API ?묐떟???댁꽍?섏? 紐삵뻽?듬땲?? ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.',
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
  const body = buildCheckoutSessionRequestBody(plan);
  const response = await fetch(CHECKOUT_ENDPOINT, {
    body: JSON.stringify(body),
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
    customer: {
      email: checkout.customer.email,
      fullName: checkout.customer.fullName,
      phoneNumber: checkout.customer.phoneNumber,
    },
    noticeUrls: checkout.noticeUrls,
    orderName: checkout.orderName,
    payMethod: PaymentPayMethod.CARD,
    paymentId: checkout.paymentId,
    redirectUrl: checkout.redirectUrl,
    storeId: checkout.storeId,
    totalAmount: checkout.totalAmount,
  };
}

export function getPortOnePaymentErrorMessage(payment: PaymentResponse) {
  if (payment.message?.trim()) {
    return payment.message.trim();
  }

  if (payment.pgMessage?.trim()) {
    return payment.pgMessage.trim();
  }

  return '寃곗젣李쎌뿉???붿껌???꾨즺?섏? 紐삵뻽?듬땲?? ?앹뾽 李⑤떒???댁젣?????ㅼ떆 ?쒕룄?댁＜?몄슂.';
}

export function getPortOnePaymentSuccessMessage(payment: PaymentResponse) {
  const status = (payment as Record<string, unknown>).status;

  if (typeof status === 'string' && status.trim()) {
    return `寃곗젣 ?붿껌???묒닔?섏뿀?듬땲?? PortOne ?곹깭: ${status}`;
  }

  return `寃곗젣 ?붿껌???묒닔?섏뿀?듬땲?? 寃곗젣 ID: ${payment.paymentId}`;
}

export async function launchPortOneCheckout(plan: BillingPlanCode) {
  const session = await createCheckoutSession(plan);
  console.info('[portone-checkout] checkout session', buildMaskedCheckoutLog(session.checkout));
  const paymentRequest = buildPortOnePaymentRequest(session.checkout);
  console.info('[portone-checkout] requestPayment payload', buildMaskedPaymentRequestLog(paymentRequest));
  const payment = await PortOne.requestPayment(paymentRequest);

  return {
    payment,
    paymentRequest,
    session,
  };
}
