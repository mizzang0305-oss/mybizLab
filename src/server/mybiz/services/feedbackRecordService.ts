import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRepository } from '../../../shared/lib/repositories/supabaseRepository';
import {
  buildMockFeedbackRecords,
  listFeedbackRecords,
  type FeedbackSourceType,
} from '../../../shared/lib/services/feedbackRecordReadModelService';
import { getRequestMethod } from '../../nodeResponse';
import { getSupabaseAdminClient } from '../../supabaseAdmin';
import {
  createProductionCustomerMemoryIntakeRepository,
  type CustomerMemoryIntakeRepository,
} from '../repositories/customerRepository';
import type {
  CustomerMemoryApiAccess,
  CustomerMemoryApiDependencies,
  CustomerMemoryRequestLike,
} from './customerMemoryApi';

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

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRequestUrl(request: CustomerMemoryRequestLike) {
  return new URL(typeof request.url === 'string' && request.url.trim() ? request.url : '/', 'https://mybiz.ai.kr');
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

function normalizeSourceType(value: string | null): FeedbackSourceType | undefined {
  return value === 'inquiry' ||
    value === 'review' ||
    value === 'survey' ||
    value === 'manual_note' ||
    value === 'public_page'
    ? value
    : undefined;
}

function createRepositoryFromClient(adminClient: SupabaseClient) {
  return createProductionCustomerMemoryIntakeRepository(
    createSupabaseRepository(adminClient) as unknown as CustomerMemoryIntakeRepository,
  );
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

function getFeedbackIdFromRequest(url: URL) {
  const explicit = normalizeText(url.searchParams.get('feedbackId'));
  if (explicit) {
    return explicit;
  }

  const lastSegment = normalizeText(url.pathname.split('/').filter(Boolean).at(-1));
  return lastSegment && lastSegment !== 'feedback-records' && lastSegment !== 'feedback-summary'
    ? lastSegment
    : undefined;
}

export async function handleAdminFeedbackRecordsRequest(
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

    const data = await listFeedbackRecords({
      feedbackId: getFeedbackIdFromRequest(url),
      mockRecords: buildMockFeedbackRecords({ storeId: access.storeId }),
      repository: access.repository,
      sourceType: normalizeSourceType(url.searchParams.get('sourceType')),
      storeId: access.storeId,
    });

    if (getFeedbackIdFromRequest(url)) {
      const item = data.items[0];
      return item
        ? json({ ok: true, data: item })
        : json({ ok: false, error: 'Feedback record could not be found for this store.' }, 404);
    }

    return json({ ok: true, data });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown feedback record read error.' }, 500);
  }
}
