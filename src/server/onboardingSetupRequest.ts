import { z } from 'zod';

import { buildLiveStoreSetupRequestInsertPayload, buildStoreSetupRequestRecord } from '../shared/lib/setupRequestPersistence.js';
import type { FeatureKey, SetupRequestInput, StoreRequest, SubscriptionPlan } from '../shared/types/models.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

const ENDPOINT = '/api/onboarding/setup-request';
const MAX_REQUESTS_PER_IP = 6;
const MAX_REQUESTS_PER_EMAIL_WINDOW = 3;
const EMAIL_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
const IP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const KNOWN_FEATURE_KEYS = new Set<FeatureKey>([
  'ai_manager',
  'ai_business_report',
  'brand_management',
  'contracts',
  'customer_management',
  'order_management',
  'reservation_management',
  'sales_analysis',
  'schedule_management',
  'surveys',
  'table_order',
  'waiting_board',
]);
const RESERVED_STORE_SLUGS = [
  'admin',
  'api',
  'login',
  'onboarding',
  'dashboard',
  'pricing',
  'terms',
  'privacy',
  'refund',
  'store',
] as const;

let requestedPlanColumnSupported: boolean | null = null;
const ipSubmissionTimestamps = new Map<string, number[]>();

type RequestLike =
  | Request
  | {
      body?: unknown;
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      rawBody?: unknown;
      text?: () => Promise<string>;
      url?: string;
    };

interface OnboardingSetupRequestBody {
  input: SetupRequestInput;
  requestedPlan: SubscriptionPlan;
  website?: string;
}

const featureKeySchema = z.custom<FeatureKey>((value) => typeof value === 'string' && KNOWN_FEATURE_KEYS.has(value as FeatureKey), {
  message: 'Unknown feature key.',
});

const setupRequestBodySchema = z.object({
  input: z.object({
    business_name: z.string().trim().min(2).max(80),
    owner_name: z.string().trim().min(2).max(60),
    business_number: z.string().trim().min(5).max(32).regex(/^[0-9A-Za-z-]+$/),
    phone: z.string().trim().min(8).max(24).regex(/^[0-9+\-\s()]+$/),
    email: z.string().trim().email().max(120),
    address: z.string().trim().min(5).max(200),
    business_type: z.string().trim().min(2).max(80),
    requested_slug: z.string().trim().min(2).max(80),
    selected_features: z.array(featureKeySchema).min(1).max(12),
    brand_name: z.string().trim().min(1).max(80).optional(),
    store_mode: z.enum(['order_first', 'survey_first', 'hybrid', 'brand_inquiry_first']).optional(),
    data_mode: z.enum(['order_only', 'survey_only', 'manual_only', 'order_survey', 'survey_manual', 'order_survey_manual']).optional(),
    tagline: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(8).max(400).optional(),
    opening_hours: z.string().trim().min(2).max(80).optional(),
    public_status: z.enum(['public', 'private']).optional(),
    theme_preset: z.enum(['light', 'warm', 'modern']).optional(),
    primary_cta_label: z.string().trim().min(2).max(40).optional(),
    mobile_cta_label: z.string().trim().min(2).max(40).optional(),
    preview_target: z.enum(['survey', 'order', 'inquiry']).optional(),
  }),
  requestedPlan: z.enum(['free', 'pro', 'vip']),
  website: z.string().max(0).optional(),
});

class OnboardingSetupRequestError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'OnboardingSetupRequestError';
    this.code = input.code;
    this.details = input.details;
    this.status = input.status;
  }
}

function responseJson(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function getRequestMethod(request: RequestLike) {
  return typeof request.method === 'string' && request.method.trim() ? request.method.toUpperCase() : 'GET';
}

function normalizeRequestedSlug(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{Script=Hangul}a-z0-9\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'store';
}

function isReservedRequestedSlug(slug: string) {
  return RESERVED_STORE_SLUGS.includes(normalizeRequestedSlug(slug) as (typeof RESERVED_STORE_SLUGS)[number]);
}

function getHeaderValue(request: RequestLike, name: string) {
  const headers = request.headers;

  if (headers instanceof Headers) {
    return headers.get(name) || undefined;
  }

  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const match = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === name.toLowerCase())?.[1];
  if (typeof match === 'string') {
    return match;
  }
  if (Array.isArray(match) && typeof match[0] === 'string') {
    return match[0];
  }

  return undefined;
}

function readClientIp(request: RequestLike) {
  const forwardedFor = getHeaderValue(request, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return (
    getHeaderValue(request, 'x-real-ip') ||
    getHeaderValue(request, 'cf-connecting-ip') ||
    'unknown'
  );
}

function trimIpWindow(ip: string, now: number) {
  const windowStart = now - IP_RATE_LIMIT_WINDOW_MS;
  const existing = ipSubmissionTimestamps.get(ip) || [];
  const kept = existing.filter((timestamp) => timestamp >= windowStart);
  ipSubmissionTimestamps.set(ip, kept);
  return kept;
}

function assertIpRateLimit(request: RequestLike) {
  const ip = readClientIp(request);
  const now = Date.now();
  const recentTimestamps = trimIpWindow(ip, now);

  if (recentTimestamps.length >= MAX_REQUESTS_PER_IP) {
    throw new OnboardingSetupRequestError({
      code: 'RATE_LIMITED',
      message: '요청이 너무 자주 들어오고 있습니다. 잠시 후 다시 시도해 주세요.',
      status: 429,
      details: {
        ip,
        retryAfterSeconds: Math.ceil(IP_RATE_LIMIT_WINDOW_MS / 1000),
      },
    });
  }

  recentTimestamps.push(now);
  ipSubmissionTimestamps.set(ip, recentTimestamps);
}

async function readRequestBodyText(request: RequestLike) {
  if (request instanceof Request) {
    return request.text();
  }

  if (typeof request.text === 'function') {
    return request.text();
  }

  if (typeof request.rawBody === 'string') {
    return request.rawBody;
  }

  if (typeof request.body === 'string') {
    return request.body;
  }

  if (request.body && typeof request.body === 'object') {
    return JSON.stringify(request.body);
  }

  return '';
}

async function parseOnboardingSetupRequestBody(request: RequestLike) {
  const rawBody = await readRequestBodyText(request);

  if (!rawBody.trim()) {
    throw new OnboardingSetupRequestError({
      code: 'INVALID_REQUEST_BODY',
      message: `Request body is required for ${ENDPOINT}`,
      status: 400,
    });
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    throw new OnboardingSetupRequestError({
      code: 'INVALID_REQUEST_BODY',
      message: error instanceof Error ? error.message : 'Failed to parse onboarding setup request body.',
      status: 400,
    });
  }

  const parsed = setupRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new OnboardingSetupRequestError({
      code: 'INVALID_REQUEST_BODY',
      message: '스토어 생성 요청 형식이 올바르지 않습니다.',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  return parsed.data as OnboardingSetupRequestBody;
}

async function assertCanonicalSlugAvailable(input: {
  adminClient: ReturnType<typeof getSupabaseAdminClient>;
  requestedSlug: string;
}) {
  const normalizedSlug = normalizeRequestedSlug(input.requestedSlug);

  if (!normalizedSlug || isReservedRequestedSlug(normalizedSlug)) {
    throw new OnboardingSetupRequestError({
      code: 'INVALID_SLUG',
      message: '이미 사용 중이거나 예약된 스토어 주소입니다.',
      status: 409,
    });
  }

  const { data: existingStore, error: storeLookupError } = await input.adminClient
    .from('stores')
    .select('store_id,slug')
    .eq('slug', normalizedSlug)
    .limit(1);

  if (storeLookupError) {
    throw new OnboardingSetupRequestError({
      code: 'STORE_LOOKUP_FAILED',
      message: `Failed to inspect stores by slug: ${storeLookupError.message}`,
      status: 500,
    });
  }

  if (existingStore && existingStore.length > 0) {
    throw new OnboardingSetupRequestError({
      code: 'DUPLICATE_SLUG',
      message: '이미 접수되었거나 사용 중인 스토어 주소입니다.',
      status: 409,
    });
  }

  const { data, error } = await input.adminClient
    .from('store_setup_requests')
    .select('id,status,created_at')
    .eq('requested_slug', normalizedSlug)
    .limit(1);

  if (error) {
    throw new OnboardingSetupRequestError({
      code: 'STORE_SETUP_REQUEST_LOOKUP_FAILED',
      message: `Failed to inspect store setup requests by slug: ${error.message}`,
      status: 500,
    });
  }

  if (data && data.length > 0) {
    throw new OnboardingSetupRequestError({
      code: 'DUPLICATE_SLUG',
      message: '이미 접수되었거나 사용 중인 스토어 주소입니다.',
      status: 409,
    });
  }

  return normalizedSlug;
}

async function assertEmailRateLimit(input: {
  adminClient: ReturnType<typeof getSupabaseAdminClient>;
  email: string;
}) {
  const sinceIso = new Date(Date.now() - EMAIL_RATE_LIMIT_WINDOW_MS).toISOString();
  const { data, error } = await input.adminClient
    .from('store_setup_requests')
    .select('id,created_at')
    .eq('email', input.email)
    .gte('created_at', sinceIso)
    .limit(MAX_REQUESTS_PER_EMAIL_WINDOW);

  if (error) {
    throw new OnboardingSetupRequestError({
      code: 'STORE_SETUP_REQUEST_LOOKUP_FAILED',
      message: `Failed to inspect store setup requests by email: ${error.message}`,
      status: 500,
    });
  }

  if ((data || []).length >= MAX_REQUESTS_PER_EMAIL_WINDOW) {
    throw new OnboardingSetupRequestError({
      code: 'RATE_LIMITED',
      message: '동일한 이메일로 짧은 시간 안에 너무 많은 요청이 들어왔습니다. 잠시 후 다시 시도해 주세요.',
      status: 429,
      details: {
        email: input.email,
        retryAfterSeconds: Math.ceil(EMAIL_RATE_LIMIT_WINDOW_MS / 1000),
      },
    });
  }
}

function isMissingColumnError(error: { code?: string | null; message?: string | null }, columnName: string) {
  const message = error.message || '';
  return error.code === 'PGRST204' || message.includes(`'${columnName}'`) || message.includes(`"${columnName}"`);
}

async function insertStoreSetupRequest(input: {
  adminClient: ReturnType<typeof getSupabaseAdminClient>;
  request: StoreRequest;
}) {
  const insertPayloadWithPlan = buildLiveStoreSetupRequestInsertPayload(input.request, {
    includeRequestedPlan: true,
  });

  if (requestedPlanColumnSupported !== false) {
    const { error } = await input.adminClient.from('store_setup_requests').insert(insertPayloadWithPlan);

    if (!error) {
      requestedPlanColumnSupported = true;
      return {
        requestedPlanPersisted: true,
      };
    }

    if (!isMissingColumnError(error, 'requested_plan')) {
      throw new OnboardingSetupRequestError({
        code: 'STORE_SETUP_REQUEST_SAVE_FAILED',
        message: `스토어 생성 요청을 저장하지 못했습니다: ${error.message}`,
        status: 500,
      });
    }

    requestedPlanColumnSupported = false;
  }

  const { error } = await input.adminClient
    .from('store_setup_requests')
    .insert(buildLiveStoreSetupRequestInsertPayload(input.request));

  if (error) {
    throw new OnboardingSetupRequestError({
      code: 'STORE_SETUP_REQUEST_SAVE_FAILED',
      message: `스토어 생성 요청을 저장하지 못했습니다: ${error.message}`,
      status: 500,
    });
  }

  return {
    requestedPlanPersisted: false,
  };
}

export async function handleOnboardingSetupRequest(request: RequestLike) {
  if (getRequestMethod(request) !== 'POST') {
    return responseJson(
      {
        ok: false,
        code: 'METHOD_NOT_ALLOWED',
        error: `Only POST is supported on ${ENDPOINT}`,
      },
      405,
      { allow: 'POST' },
    );
  }

  try {
    assertIpRateLimit(request);
    const body = await parseOnboardingSetupRequestBody(request);
    const adminClient = getSupabaseAdminClient();
    const requestedSlug = await assertCanonicalSlugAvailable({
      adminClient,
      requestedSlug: body.input.requested_slug,
    });

    await assertEmailRateLimit({
      adminClient,
      email: body.input.email,
    });

    const setupRequest = buildStoreSetupRequestRecord(body.input, {
      requestedPlan: body.requestedPlan,
      requestedSlug,
    });
    const persistence = await insertStoreSetupRequest({
      adminClient,
      request: setupRequest,
    });

    return responseJson(
      {
        ok: true,
        data: {
          request: setupRequest,
          persistence,
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof OnboardingSetupRequestError) {
      return responseJson(
        {
          ok: false,
          code: error.code,
          error: error.message,
          details: error.details,
        },
        error.status,
      );
    }

    console.error('[onboarding-setup-request] unexpected failure', error);

    return responseJson(
      {
        ok: false,
        code: 'ONBOARDING_SETUP_REQUEST_INTERNAL_ERROR',
        error: error instanceof Error ? error.message : 'Unknown onboarding setup request error',
      },
      500,
    );
  }
}
