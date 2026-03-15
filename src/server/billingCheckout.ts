import { getBillingPlan, isBillingPlanCode, type BillingPlanCode } from '../shared/lib/billingPlans';

const CHECKOUT_ENDPOINT = '/api/billing/checkout';
const SERVER_ENV_HINT =
  'Add it to .env.local when using vercel dev, and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

const CHECKOUT_ENV_NAMES = {
  appBaseUrl: ['APP_BASE_URL', 'NEXT_PUBLIC_APP_BASE_URL', 'VITE_APP_BASE_URL'],
  channelKey: ['PORTONE_CHANNEL_KEY', 'NEXT_PUBLIC_PORTONE_CHANNEL_KEY', 'VITE_PORTONE_CHANNEL_KEY'],
  storeId: ['PORTONE_STORE_ID', 'NEXT_PUBLIC_PORTONE_STORE_ID', 'VITE_PORTONE_STORE_ID'],
} as const;

type CheckoutEnvKey = keyof typeof CHECKOUT_ENV_NAMES;

export interface CheckoutSessionPayload {
  channelKey: string;
  currency: 'KRW';
  customData: Record<string, unknown>;
  noticeUrls: string[];
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
  endpoint: typeof CHECKOUT_ENDPOINT;
  ok: true;
  plan: BillingPlanCode;
}

interface CheckoutEnv {
  appBaseUrl?: string;
  channelKey?: string;
  storeId?: string;
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

export interface InvalidCheckoutSessionDetails {
  channelKeyConfigured: boolean;
  missingOrInvalidFields: CheckoutSessionField[];
  plan: BillingPlanCode | null;
  redirectUrl: string | null;
  storeIdConfigured: boolean;
  totalAmount: unknown;
  validationErrors: CheckoutSessionValidationIssue[];
}

type CheckoutSessionValidationResult =
  | {
      ok: true;
    }
  | {
      details: InvalidCheckoutSessionDetails;
      message: string;
      ok: false;
      status: number;
    };

class CheckoutApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  stage: string;
  status: number;

  constructor(input: {
    code?: string;
    details?: Record<string, unknown>;
    message: string;
    stage: string;
    status: number;
  }) {
    super(input.message);
    this.name = 'CheckoutApiError';
    this.code = input.code ?? 'CHECKOUT_API_ERROR';
    this.details = input.details;
    this.stage = input.stage;
    this.status = input.status;
  }
}

function readServerEnv(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function normalizeBaseUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new CheckoutApiError({
      code: 'SERVER_MISCONFIGURED',
      details: {
        receivedAppBaseUrl: value,
      },
      message: `APP_BASE_URL is invalid for ${CHECKOUT_ENDPOINT}. ${SERVER_ENV_HINT}`,
      stage: 'env-load',
      status: 500,
    });
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

function createCheckoutSessionValidationMessage(issues: CheckoutSessionValidationIssue[]) {
  return `Checkout session is invalid: ${issues.map(({ field, reason }) => `${field} (${reason})`).join(', ')}`;
}

export function validateCheckoutSessionPayload(
  payload: CheckoutSessionPayload,
): CheckoutSessionValidationResult {
  const issues: CheckoutSessionValidationIssue[] = [];

  if (!normalizeNonEmptyString(payload.storeId)) {
    issues.push({
      field: 'storeId',
      reason: 'must be a non-empty string',
    });
  }

  if (!normalizeNonEmptyString(payload.channelKey)) {
    issues.push({
      field: 'channelKey',
      reason: 'must be a non-empty string',
    });
  }

  if (!normalizeNonEmptyString(payload.paymentId)) {
    issues.push({
      field: 'paymentId',
      reason: 'must be a non-empty string',
    });
  }

  if (!normalizeNonEmptyString(payload.orderName)) {
    issues.push({
      field: 'orderName',
      reason: 'must be a non-empty string',
    });
  }

  if (!isAbsoluteHttpUrl(payload.redirectUrl)) {
    issues.push({
      field: 'redirectUrl',
      reason: 'must be an absolute http/https URL',
    });
  }

  if (!isPositiveFiniteNumber(payload.totalAmount)) {
    issues.push({
      field: 'totalAmount',
      reason: 'must be a positive finite number',
    });
  }

  if (payload.currency !== 'KRW') {
    issues.push({
      field: 'currency',
      reason: 'must be KRW',
    });
  }

  if (payload.payMethod !== 'CARD') {
    issues.push({
      field: 'payMethod',
      reason: 'must be CARD',
    });
  }

  if (issues.length === 0) {
    return {
      ok: true,
    };
  }

  return {
    details: {
      channelKeyConfigured: Boolean(normalizeNonEmptyString(payload.channelKey)),
      missingOrInvalidFields: issues.map(({ field }) => field),
      plan: payload.plan ?? null,
      redirectUrl: normalizeNonEmptyString(payload.redirectUrl) || null,
      storeIdConfigured: Boolean(normalizeNonEmptyString(payload.storeId)),
      totalAmount: payload.totalAmount,
      validationErrors: issues,
    },
    message: createCheckoutSessionValidationMessage(issues),
    ok: false,
    status: 500,
  };
}

function readCheckoutEnv(): CheckoutEnv {
  return {
    appBaseUrl: readServerEnv(CHECKOUT_ENV_NAMES.appBaseUrl),
    channelKey: readServerEnv(CHECKOUT_ENV_NAMES.channelKey),
    storeId: readServerEnv(CHECKOUT_ENV_NAMES.storeId),
  };
}

function getCheckoutEnvStatus(env: CheckoutEnv) {
  return {
    APP_BASE_URL: Boolean(process.env.APP_BASE_URL?.trim()),
    NEXT_PUBLIC_APP_BASE_URL: Boolean(process.env.NEXT_PUBLIC_APP_BASE_URL?.trim()),
    NEXT_PUBLIC_PORTONE_CHANNEL_KEY: Boolean(process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim()),
    NEXT_PUBLIC_PORTONE_STORE_ID: Boolean(process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim()),
    PORTONE_API_SECRET: Boolean(process.env.PORTONE_API_SECRET?.trim()),
    PORTONE_CHANNEL_KEY: Boolean(process.env.PORTONE_CHANNEL_KEY?.trim()),
    PORTONE_STORE_ID: Boolean(process.env.PORTONE_STORE_ID?.trim()),
    PORTONE_V2_API_SECRET: Boolean(process.env.PORTONE_V2_API_SECRET?.trim()),
    VITE_APP_BASE_URL: Boolean(process.env.VITE_APP_BASE_URL?.trim()),
    VITE_PORTONE_CHANNEL_KEY: Boolean(process.env.VITE_PORTONE_CHANNEL_KEY?.trim()),
    VITE_PORTONE_STORE_ID: Boolean(process.env.VITE_PORTONE_STORE_ID?.trim()),
    resolvedAppBaseUrl: Boolean(env.appBaseUrl),
    resolvedChannelKey: Boolean(env.channelKey),
    resolvedStoreId: Boolean(env.storeId),
  };
}

function requireCheckoutEnv() {
  const env = readCheckoutEnv();
  const missing = (Object.keys(CHECKOUT_ENV_NAMES) as CheckoutEnvKey[]).filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new CheckoutApiError({
      code: 'SERVER_MISCONFIGURED',
      details: {
        acceptedEnvNames: Object.fromEntries(
          missing.map((key) => [key, [...CHECKOUT_ENV_NAMES[key]]]),
        ),
        envStatus: getCheckoutEnvStatus(env),
        missing,
      },
      message: `Missing required env for ${CHECKOUT_ENDPOINT}: ${missing.join(', ')}. ${SERVER_ENV_HINT}`,
      stage: 'env-load',
      status: 500,
    });
  }

  return {
    appBaseUrl: normalizeBaseUrl(env.appBaseUrl!),
    channelKey: env.channelKey!,
    storeId: env.storeId!,
  };
}

async function parseRequestBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    throw new CheckoutApiError({
      code: 'INVALID_REQUEST_BODY',
      message: `Request body is required for ${CHECKOUT_ENDPOINT}`,
      stage: 'request-body',
      status: 400,
    });
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch (error) {
    throw new CheckoutApiError({
      code: 'INVALID_REQUEST_BODY',
      details: {
        parseError: error instanceof Error ? error.message : 'Unknown JSON parse error',
      },
      message: `Failed to parse request body for ${CHECKOUT_ENDPOINT}`,
      stage: 'request-body',
      status: 400,
    });
  }
}

function resolveRequestedPlan(body: Record<string, unknown>) {
  const requestedPlan = body.plan;

  if (!isBillingPlanCode(requestedPlan)) {
    throw new CheckoutApiError({
      code: 'INVALID_PLAN',
      details: {
        receivedPlan: requestedPlan ?? null,
      },
      message: 'Checkout requires plan to be one of starter, pro, business.',
      stage: 'request-body',
      status: 400,
    });
  }

  return requestedPlan;
}

export function responseJson(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

export function createCheckoutMethodNotAllowedResponse() {
  return responseJson(
    {
      code: 'METHOD_NOT_ALLOWED',
      endpoint: CHECKOUT_ENDPOINT,
      message: `Only POST is supported on ${CHECKOUT_ENDPOINT}`,
      ok: false,
      stage: 'method-check',
    },
    405,
    { allow: 'POST' },
  );
}

export async function handleCheckoutRequest(request: Request) {
  const env = requireCheckoutEnv();
  const body = await parseRequestBody(request);
  const requestedPlan = resolveRequestedPlan(body);
  const billingPlan = getBillingPlan(requestedPlan);
  const paymentId = `subscription-${requestedPlan}-${crypto.randomUUID()}`;

  const payload: CheckoutSessionResponse = {
    checkout: {
      channelKey: env.channelKey,
      currency: 'KRW',
      customData: {
        initiatedAt: new Date().toISOString(),
        plan: requestedPlan,
        source: 'pricing-page',
      },
      noticeUrls: [`${env.appBaseUrl}/api/billing/webhook`],
      orderName: billingPlan.orderName,
      payMethod: 'CARD',
      paymentId,
      plan: requestedPlan,
      redirectUrl: `${env.appBaseUrl}/pricing?portone=redirect&plan=${encodeURIComponent(requestedPlan)}`,
      storeId: env.storeId,
      totalAmount: billingPlan.amount,
    },
    endpoint: CHECKOUT_ENDPOINT,
    ok: true,
    plan: requestedPlan,
  };

  const validation = validateCheckoutSessionPayload(payload.checkout);

  if (!validation.ok) {
    return createCheckoutErrorResponse(
      new CheckoutApiError({
        code: 'INVALID_CHECKOUT_SESSION',
        details: validation.details,
        message: validation.message,
        stage: 'checkout-session-build',
        status: validation.status,
      }),
    );
  }

  return responseJson(payload, 200);
}

export function createCheckoutErrorResponse(error: unknown) {
  if (error instanceof CheckoutApiError) {
    return responseJson(
      {
        code: error.code,
        details: error.details,
        endpoint: CHECKOUT_ENDPOINT,
        error: error.message,
        ok: false,
        stage: error.stage,
      },
      error.status,
    );
  }

  console.error('[billing-checkout] unexpected failure', error);

  return responseJson(
    {
      code: 'UNEXPECTED_BILLING_ERROR',
      endpoint: CHECKOUT_ENDPOINT,
      error: error instanceof Error ? error.message : 'Unknown checkout processing error',
      ok: false,
      stage: 'unhandled',
    },
    500,
  );
}
