import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRepository } from '../../../shared/lib/repositories/supabaseRepository';
import {
  listAiTraceRecords,
  type AiTraceEvalStatus,
  type AiTraceSourceType,
} from '../../../shared/lib/services/aiTraceReadModelService';
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

function normalizeSourceType(value: string | null): AiTraceSourceType | undefined {
  return value === 'inquiry_summary' || value === 'customer_summary' || value === 'daily_report'
    ? value
    : undefined;
}

function normalizeEvalStatus(value: string | null): AiTraceEvalStatus | undefined {
  return value === 'pending' || value === 'pass' || value === 'fail' || value === 'needs_review' ? value : undefined;
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

export async function handleAdminAiTracesRequest(
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

    const data = await listAiTraceRecords({
      evalStatus: normalizeEvalStatus(url.searchParams.get('evalStatus')),
      repository: access.repository,
      sourceType: normalizeSourceType(url.searchParams.get('sourceType')),
      storeId,
    });
    const traceId = normalizeText(url.searchParams.get('traceId') || url.pathname.split('/').filter(Boolean).at(-1));
    if (traceId && traceId !== 'ai-traces') {
      const item = data.items.find((candidate) => candidate.traceId === traceId);
      return item
        ? json({ ok: true, data: item })
        : json({ ok: false, error: 'AI trace could not be found for this store.' }, 404);
    }

    return json({ ok: true, data });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown AI trace read error.' }, 500);
  }
}
