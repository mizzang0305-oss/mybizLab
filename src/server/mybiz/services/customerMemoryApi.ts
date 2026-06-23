import type { SupabaseClient } from '@supabase/supabase-js';

import { isLaunchGateEnabled } from '../../../shared/lib/launchGates.js';
import { createSupabaseRepository } from '../../../shared/lib/repositories/supabaseRepository.js';
import { getRequestMethod } from '../../nodeResponse.js';
import { getSupabaseAdminClient } from '../../supabaseAdmin.js';
import {
  type CustomerMemoryIntakeRepository,
} from '../repositories/customerRepository.js';
import {
  createProductionCustomerMemorySchemaAdapter,
  type CustomerMemorySupabaseClientLike,
} from '../repositories/customerMemoryProductionAdapter.js';
import {
  buildAdminCustomerMemoryReadModel,
  submitCustomerMemoryInquiryIntake,
  type CustomerMemoryInquiryIntakeInput,
} from './customerMemoryIntakeService.js';

export type CustomerMemoryRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      rawBody?: unknown;
      url?: string;
    };

export interface CustomerMemoryApiAccess {
  adminClient?: SupabaseClient;
  profileId: string;
  repository: CustomerMemoryIntakeRepository;
  storeId: string;
}

export interface CustomerMemoryApiDependencies {
  resolveAdminAccess?: (request: CustomerMemoryRequestLike, storeId: string) => Promise<CustomerMemoryApiAccess | Response>;
  resolvePublicRepository?: (
    request: CustomerMemoryRequestLike,
    body: Partial<CustomerMemoryInquiryIntakeInput> & { storeSlug?: string },
  ) => Promise<{ repository: CustomerMemoryIntakeRepository; storeId: string } | Response>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    status,
  });
}

function methodNotAllowed(allowed: string) {
  return new Response('Method Not Allowed', {
    headers: { allow: allowed },
    status: 405,
  });
}

function getHeaderValue(headers: CustomerMemoryRequestLike['headers'], key: string) {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(key) || undefined;
  }

  const matchedKey = Object.keys(headers).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  if (!matchedKey) {
    return undefined;
  }

  const value = headers[matchedKey];
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function getBearerToken(request: CustomerMemoryRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  const matched = authorization?.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

function getRequestUrl(request: CustomerMemoryRequestLike) {
  return new URL(typeof request.url === 'string' && request.url.trim() ? request.url : '/', 'https://mybiz.ai.kr');
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function parseJsonBody<T>(request: CustomerMemoryRequestLike): Promise<T> {
  if (request instanceof Request) {
    return (await request.json()) as T;
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T;
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as T;
  }

  if (typeof request.rawBody === 'string') {
    return JSON.parse(request.rawBody) as T;
  }

  throw new Error('JSON body is required.');
}

function getStoreSlugFromPath(request: CustomerMemoryRequestLike) {
  const segments = getRequestUrl(request).pathname.split('/').filter(Boolean);
  const storesIndex = segments.indexOf('stores');
  return storesIndex >= 0 ? segments[storesIndex + 1] : undefined;
}

function isWriteGateError(error: unknown) {
  return (
    error instanceof Error &&
    ['BROAD_DB_WRITE_DISABLED', 'CUSTOMER_MEMORY_SPINE_DISABLED', 'LIVE_CUSTOMER_MEMORY_WRITE_DISABLED'].includes(error.message)
  );
}

function createRepositoryFromClient(adminClient: SupabaseClient): CustomerMemoryIntakeRepository {
  return createProductionCustomerMemorySchemaAdapter(adminClient as unknown as CustomerMemorySupabaseClientLike);
}

async function defaultResolveAdminAccess(
  request: CustomerMemoryRequestLike,
  storeId: string,
): Promise<CustomerMemoryApiAccess | Response> {
  const token = getBearerToken(request);
  if (!token) {
    return json({ ok: false, error: 'Authorization bearer token is required.' }, 401);
  }

  const adminClient = getSupabaseAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ ok: false, error: `Supabase auth validation failed: ${authError?.message || 'No user found.'}` }, 401);
  }

  const { data: membershipRows, error: membershipError } = await adminClient
    .from('store_members')
    .select('id,store_id,profile_id,role,created_at')
    .eq('profile_id', authData.user.id)
    .eq('store_id', storeId)
    .limit(1);

  if (membershipError) {
    throw new Error(`Failed to load store membership: ${membershipError.message}`);
  }

  if (!membershipRows?.length) {
    return json({ ok: false, error: 'The authenticated merchant does not have access to this store.' }, 403);
  }

  return {
    adminClient,
    profileId: authData.user.id,
    repository: createRepositoryFromClient(adminClient),
    storeId,
  };
}

async function defaultResolvePublicRepository(
  request: CustomerMemoryRequestLike,
  body: Partial<CustomerMemoryInquiryIntakeInput> & { storeSlug?: string },
): Promise<{ repository: CustomerMemoryIntakeRepository; storeId: string } | Response> {
  const explicitStoreId = normalizeText(body.storeId);
  if (explicitStoreId) {
    return {
      repository: createRepositoryFromClient(getSupabaseAdminClient()),
      storeId: explicitStoreId,
    };
  }

  const storeSlug = normalizeText(body.storeSlug) || getStoreSlugFromPath(request);
  if (!storeSlug) {
    return json({ ok: false, error: 'storeId or storeSlug is required.' }, 400);
  }

  const adminClient = getSupabaseAdminClient();
  const repository = createSupabaseRepository(adminClient);
  const store = await repository.findStoreBySlug(storeSlug);
  if (!store) {
    return json({ ok: false, error: 'Store could not be found for this inquiry.' }, 404);
  }

  return {
    repository: createRepositoryFromClient(adminClient),
    storeId: store.id,
  };
}

function sanitizeIntakeResult(result: Awaited<ReturnType<typeof submitCustomerMemoryInquiryIntake>>) {
  return {
    contactChannels: result.contacts.map((contact) => contact.type),
    created: result.created,
    customerId: result.customer.customer_id || result.customer.id,
    inquiryId: result.inquiry.id,
    timelineEventTypes: result.timelineEvents.map((event) => event.event_type),
  };
}

function sanitizeInquiryPreview(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]')
    .slice(0, 96);
}

export async function handlePublicCustomerMemoryInquiryRequest(
  request: CustomerMemoryRequestLike,
  dependencies: CustomerMemoryApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'POST') {
    return methodNotAllowed('POST');
  }

  try {
    if (!isLaunchGateEnabled('customerMemorySpineEnabled')) {
      return json({ ok: false, error: 'CUSTOMER_MEMORY_SPINE_DISABLED' }, 403);
    }

    const body = await parseJsonBody<Partial<CustomerMemoryInquiryIntakeInput> & { storeSlug?: string }>(request);
    const resolver = dependencies.resolvePublicRepository || defaultResolvePublicRepository;
    const resolved = await resolver(request, body);
    if (resolved instanceof Response) {
      return resolved;
    }

    const result = await submitCustomerMemoryInquiryIntake(
      {
        category: body.category,
        email: body.email,
        intent: body.intent,
        marketingOptIn: body.marketingOptIn,
        message: normalizeText(body.message),
        name: normalizeText(body.name),
        phone: body.phone,
        requestedVisitDate: body.requestedVisitDate,
        source: body.source || 'public_inquiry',
        storeId: resolved.storeId,
        summary: body.summary,
        tags: body.tags,
      },
      { repository: resolved.repository },
    );

    return json({ ok: true, data: sanitizeIntakeResult(result) });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown customer memory inquiry error.',
      },
      isWriteGateError(error) ? 403 : 400,
    );
  }
}

export async function handleAdminCustomersRequest(
  request: CustomerMemoryRequestLike,
  dependencies: CustomerMemoryApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed('GET');
  }

  try {
    const url = getRequestUrl(request);
    const storeId = normalizeText(url.searchParams.get('storeId'));
    if (!storeId) {
      return json({ ok: false, error: 'storeId is required.' }, 400);
    }

    const resolveAccess = dependencies.resolveAdminAccess || defaultResolveAdminAccess;
    const access = await resolveAccess(request, storeId);
    if (access instanceof Response) {
      return access;
    }

    const data = await buildAdminCustomerMemoryReadModel({
      repository: access.repository,
      storeId,
    });

    return json({ ok: true, data });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown customer read error.' }, 500);
  }
}

export async function handleAdminCustomerDetailRequest(
  request: CustomerMemoryRequestLike,
  dependencies: CustomerMemoryApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed('GET');
  }

  try {
    const url = getRequestUrl(request);
    const storeId = normalizeText(url.searchParams.get('storeId'));
    const customerId = normalizeText(url.searchParams.get('customerId') || url.pathname.split('/').filter(Boolean).at(-1));
    if (!storeId || !customerId) {
      return json({ ok: false, error: 'storeId and customerId are required.' }, 400);
    }

    const resolveAccess = dependencies.resolveAdminAccess || defaultResolveAdminAccess;
    const access = await resolveAccess(request, storeId);
    if (access instanceof Response) {
      return access;
    }

    const data = await buildAdminCustomerMemoryReadModel({
      customerId,
      repository: access.repository,
      storeId,
    });
    if (!data.detail) {
      return json({ ok: false, error: 'Customer could not be found for this store.' }, 404);
    }

    return json({ ok: true, data: data.detail });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown customer detail error.' }, 500);
  }
}

export async function handleAdminInquiriesRequest(
  request: CustomerMemoryRequestLike,
  dependencies: CustomerMemoryApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed('GET');
  }

  try {
    const url = getRequestUrl(request);
    const storeId = normalizeText(url.searchParams.get('storeId'));
    if (!storeId) {
      return json({ ok: false, error: 'storeId is required.' }, 400);
    }

    const resolveAccess = dependencies.resolveAdminAccess || defaultResolveAdminAccess;
    const access = await resolveAccess(request, storeId);
    if (access instanceof Response) {
      return access;
    }

    const inquiries = await access.repository.listInquiries(storeId);
    return json({
      ok: true,
      data: inquiries.map((inquiry) => ({
        category: inquiry.category,
        customerId: inquiry.customer_id,
        id: inquiry.id,
        messagePreview: sanitizeInquiryPreview(inquiry.message),
        status: inquiry.status,
        tags: inquiry.tags,
      })),
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown inquiry read error.' }, 500);
  }
}
