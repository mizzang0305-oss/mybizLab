import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

type AdminAuthRequestLike =
  | Request
  | {
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
    };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    status,
  });
}

function getHeaderValue(headers: Headers | Record<string, string | string[] | undefined> | undefined, key: string) {
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

function normalizeDisplayName(fullName?: string | null) {
  if (!fullName?.trim() || fullName === 'Platform Owner') {
    return '운영 관리자';
  }

  return fullName.trim();
}

function getBearerToken(request: AdminAuthRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  if (!authorization) {
    return null;
  }

  const matched = authorization.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

export async function handleAdminSessionRequest(request: AdminAuthRequestLike) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return json({ ok: false, error: 'Authorization bearer token is required.' }, 401);
    }

    const adminClient = getSupabaseAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);

    if (authError) {
      return json({ ok: false, error: `Supabase auth validation failed: ${authError.message}` }, 401);
    }

    if (!authData.user) {
      return json({ ok: false, error: 'No authenticated user was found for this access token.' }, 401);
    }

    const repository = createSupabaseRepository(adminClient);
    const resolvedAccess = await repository.resolveStoreAccess({
      fallbackEmail: authData.user.email || 'ops@mybiz.ai.kr',
      fallbackFullName: normalizeDisplayName((authData.user.user_metadata?.full_name as string | undefined) || authData.user.email),
      fallbackProfileId: authData.user.id,
      requestedEmail: authData.user.email || undefined,
      requestedFullName: authData.user.user_metadata?.full_name as string | undefined,
    });

    if (!resolvedAccess || !resolvedAccess.accessibleStores.length || !resolvedAccess.primaryRole) {
      return json(
        {
          ok: false,
          error: 'The authenticated profile does not have a store_members role for merchant operations.',
        },
        403,
      );
    }

    return json({
      ok: true,
      data: {
        accessibleStoreIds: resolvedAccess.accessibleStores.map((store) => store.id),
        accessibleStores: resolvedAccess.accessibleStores,
        authenticatedAt: new Date().toISOString(),
        email: resolvedAccess.email,
        fullName: normalizeDisplayName(resolvedAccess.fullName),
        memberships: resolvedAccess.memberships,
        profileId: resolvedAccess.profile.id,
        provider: resolvedAccess.provider,
        role: resolvedAccess.primaryRole,
      },
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown admin auth error',
      },
      500,
    );
  }
}
