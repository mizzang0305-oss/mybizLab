import {
  buildMockPublicPageEvents,
  buildPublicPageEventReadModel,
} from '../../../shared/lib/services/publicPageEventReadModelService.js';
import { getRequestMethod } from '../../nodeResponse.js';
import { getSupabaseAdminClient } from '../../supabaseAdmin.js';
import type { CustomerMemoryRequestLike } from './customerMemoryApi.js';

interface PublicPageEventApiAccess {
  profileId: string;
  storeId: string;
}

interface PublicPageEventApiDependencies {
  resolveAdminAccess?: (
    request: CustomerMemoryRequestLike,
    storeId: string,
  ) => Promise<PublicPageEventApiAccess | Response>;
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

function getRequestedPublicPageId(url: URL) {
  const publicPageId = normalizeText(url.searchParams.get('publicPageId'));
  return publicPageId || undefined;
}

function buildReadModelFromRequest(url: URL, storeId: string) {
  const publicPageId = getRequestedPublicPageId(url);

  return buildPublicPageEventReadModel({
    events: buildMockPublicPageEvents({
      publicPageId,
      sourcePath: normalizeText(url.searchParams.get('sourcePath')) || undefined,
      storeId,
    }),
    publicPageId,
    storeId,
  });
}

async function defaultResolveAdminAccess(
  request: CustomerMemoryRequestLike,
  storeId: string,
): Promise<PublicPageEventApiAccess | Response> {
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
    profileId: authData.user.id,
    storeId,
  };
}

export async function handlePublicPageEventPreviewRequest(request: CustomerMemoryRequestLike): Promise<Response> {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed('GET');
  }

  try {
    const url = getRequestUrl(request);
    const storeId = normalizeText(url.searchParams.get('storeId'));
    if (!storeId) {
      return json({ ok: false, error: 'storeId is required.' }, 400);
    }

    return json({ ok: true, data: buildReadModelFromRequest(url, storeId) });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown public page event read error.' }, 500);
  }
}

export async function handleAdminPublicPageEventsRequest(
  request: CustomerMemoryRequestLike,
  dependencies: PublicPageEventApiDependencies = {},
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

    return json({ ok: true, data: buildReadModelFromRequest(url, access.storeId) });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown public page event admin read error.' }, 500);
  }
}
