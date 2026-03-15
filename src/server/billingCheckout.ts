import { getBillingPlan, isBillingPlanCode, type BillingPlanCode } from '../shared/lib/billingPlans';
import { BUSINESS_INFO } from '../shared/lib/siteConfig';

const CHECKOUT_ENDPOINT = '/api/billing/checkout';
const SERVER_ENV_HINT =
  'Add it to .env.local when using vercel dev, and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

const CHECKOUT_ENV_NAMES = {
  appBaseUrl: ['VITE_APP_BASE_URL'],
  channelKey: ['PORTONE_CHANNEL_KEY'],
  storeId: ['PORTONE_STORE_ID'],
} as const;

type CheckoutEnvKey = keyof typeof CHECKOUT_ENV_NAMES;

export interface CheckoutCustomerPayload {
  email: string;
  fullName: string;
  phoneNumber: string;
}

export interface CheckoutSessionPayload {
  channelKey: string;
  currency: 'KRW';
  customData: Record<string, unknown>;
  customer: CheckoutCustomerPayload;
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

interface BrowserCheckoutContext {
  appBaseUrl?: string;
  channelKey?: string;
  storeId?: string;
}

interface CheckoutEnv {
  appBaseUrl?: string;
  channelKey?: string;
  storeId?: string;
}

type CheckoutSessionField =
  | 'channelKey'
  | 'currency'
  | 'customer.email'
  | 'customer.fullName'
  | 'customer.phoneNumber'
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
  customerConfigured: {
    email: boolean;
    fullName: boolean;
    phoneNumber: boolean;
  };
  missingOrInvalidFields: CheckoutSessionField[];
  paymentId: string | null;
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
      message: `VITE_APP_BASE_URL is invalid for ${CHECKOUT_ENDPOINT}. ${SERVER_ENV_HINT}`,
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

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAsciiSafePaymentId(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function createCheckoutSessionValidationMessage(issues: CheckoutSessionValidationIssue[]) {
  return `Checkout session is invalid: ${issues.map(({ field, reason }) => `${field} (${reason})`).join(', ')}`;
}

function defaultCheckoutCustomer(): CheckoutCustomerPayload {
  return {
    email: BUSINESS_INFO.email,
    fullName: BUSINESS_INFO.representative,
    phoneNumber: BUSINESS_INFO.customerCenter,
  };
}

function readCheckoutCustomer(body: Record<string, unknown>): CheckoutCustomerPayload {
  const defaults = defaultCheckoutCustomer();
  const customer = typeof body.customer === 'object' && body.customer ? (body.customer as Record<string, unknown>) : {};

  return {
    email: normalizeNonEmptyString(customer.email) || defaults.email,
    fullName: normalizeNonEmptyString(customer.fullName) || defaults.fullName,
    phoneNumber: normalizeNonEmptyString(customer.phoneNumber) || defaults.phoneNumber,
  };
}

function readBrowserCheckoutContext(body: Record<string, unknown>): BrowserCheckoutContext | null {
  if (typeof body.browserContext !== 'object' || !body.browserContext) {
    return null;
  }

  const browserContext = body.browserContext as Record<string, unknown>;

  return {
    appBaseUrl: normalizeNonEmptyString(browserContext.appBaseUrl) || undefined,
    channelKey: normalizeNonEmptyString(browserContext.channelKey) || undefined,
    storeId: normalizeNonEmptyString(browserContext.storeId) || undefined,
  };
}

function assertBrowserContextMatchesEnv(context: BrowserCheckoutContext | null, env: Required<CheckoutEnv>) {
  if (!context) {
    return;
  }

  const mismatchedFields = (
    [
      ['appBaseUrl', context.appBaseUrl, env.appBaseUrl],
      ['channelKey', context.channelKey, env.channelKey],
      ['storeId', context.storeId, env.storeId],
    ] as const
  )
    .filter(([, received, expected]) => received && received !== expected)
    .map(([field]) => field);

  if (mismatchedFields.length === 0) {
    return;
  }

  throw new CheckoutApiError({
    code: 'SERVER_MISCONFIGURED',
    details: {
      browserContext: context,
      mismatchedFields,
      resolvedEnv: env,
    },
    message: `Browser checkout env does not match server checkout env for ${CHECKOUT_ENDPOINT}.`,
    stage: 'env-load',
    status: 500,
  });
}

export function validateCheckoutSessionPayload(
  payload: CheckoutSessionPayload,
): CheckoutSessionValidationResult {
  const issues: CheckoutSessionValidationIssue[] = [];
  const customer = payload.customer;

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
  } else if (!isAsciiSafePaymentId(payload.paymentId)) {
    issues.push({
      field: 'paymentId',
      reason: 'must contain only ASCII letters, numbers, underscores, or hyphens',
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

  if (issues.length === 0) {
    return {
      ok: true,
    };
  }

  return {
    details: {
      channelKeyConfigured: Boolean(normalizeNonEmptyString(payload.channelKey)),
      customerConfigured: {
        email: Boolean(normalizeNonEmptyString(customer.email)),
        fullName: Boolean(normalizeNonEmptyString(customer.fullName)),
        phoneNumber: Boolean(normalizeNonEmptyString(customer.phoneNumber)),
      },
      missingOrInvalidFields: issues.map(({ field }) => field),
      paymentId: normalizeNonEmptyString(payload.paymentId) || null,
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
    PORTONE_API_SECRET: Boolean(process.env.PORTONE_API_SECRET?.trim()),
    PORTONE_CHANNEL_KEY: Boolean(process.env.PORTONE_CHANNEL_KEY?.trim()),
    PORTONE_STORE_ID: Boolean(process.env.PORTONE_STORE_ID?.trim()),
    PORTONE_WEBHOOK_SECRET: Boolean(process.env.PORTONE_WEBHOOK_SECRET?.trim()),
    VITE_APP_BASE_URL: Boolean(process.env.VITE_APP_BASE_URL?.trim()),
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

function createCheckoutPaymentId(plan: BillingPlanCode) {
  const rawPaymentId = `subscription-${plan}-${crypto.randomUUID()}`;
  const paymentId = rawPaymentId.replace(/[^A-Za-z0-9_-]/g, '');

  if (!paymentId || !isAsciiSafePaymentId(paymentId)) {
    throw new CheckoutApiError({
      code: 'INVALID_CHECKOUT_SESSION',
      details: {
        paymentId,
        rawPaymentId,
      },
      message: 'Failed to generate an ASCII-safe paymentId for checkout.',
      stage: 'checkout-session-build',
      status: 500,
    });
  }

  return paymentId;
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
      details: {
        allow: ['POST'],
      },
      error: `Only POST is supported on ${CHECKOUT_ENDPOINT}`,
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

  assertBrowserContextMatchesEnv(readBrowserCheckoutContext(body), env);

  const requestedPlan = resolveRequestedPlan(body);
  const billingPlan = getBillingPlan(requestedPlan);
  const paymentId = createCheckoutPaymentId(requestedPlan);

  const payload: CheckoutSessionResponse = {
    checkout: {
      channelKey: env.channelKey,
      currency: 'KRW',
      customData: {
        initiatedAt: new Date().toISOString(),
        payMethod: 'CARD',
        pgProvider: 'KG_INICIS',
        plan: requestedPlan,
        source: 'pricing-page',
      },
      customer: readCheckoutCustomer(body),
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
      details: error instanceof Error ? { name: error.name } : undefined,
      error: error instanceof Error ? error.message : 'Unknown checkout processing error',
      ok: false,
      stage: 'unhandled',
    },
    500,
  );
}
