import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import {
  YOUTUBE_REQUIRED_SCOPES,
  getYouTubeProviderReadiness,
  type YouTubeEnv,
} from '../shared/lib/services/youtubeProvider.js';
import {
  saveProviderTokens,
  type ProviderTokenPayload,
} from './socialAccountTokens.js';
import { getRequestMethod } from './nodeResponse.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

export type YouTubeOAuthRequestLike =
  | Request
  | {
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
    };

export interface YouTubeOAuthStatePayload {
  issuedAt: number;
  nonce: string;
  profileId: string;
  storeId: string;
}

type MerchantAccessResult =
  | {
      ok: true;
      profileId: string;
      storeId: string;
    }
  | {
      error: string;
      ok: false;
      status: number;
    };

interface YouTubeOAuthHandlerOptions {
  client?: SupabaseClient;
  env?: YouTubeEnv;
  nonceFactory?: () => string;
  now?: () => number;
  resolveMerchantAccess?: (
    request: YouTubeOAuthRequestLike,
    storeId: string,
    bearerToken: string,
  ) => Promise<MerchantAccessResult>;
  tokenExchangeAdapter?: (input: {
    code: string;
    env?: YouTubeEnv;
    redirectUri: string;
  }) => Promise<ProviderTokenPayload> | ProviderTokenPayload;
}

const STATE_COOKIE_NAME = 'mybiz_youtube_oauth_state';
const STATE_MAX_AGE_SECONDS = 10 * 60;
const STATE_MAX_AGE_MS = STATE_MAX_AGE_SECONDS * 1000;

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
    status,
  });
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    headers: { allow: 'GET' },
    status: 405,
  });
}

function getHeaderValue(headers: YouTubeOAuthRequestLike['headers'], key: string) {
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
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(request: YouTubeOAuthRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  const matched = authorization?.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

function getRequestUrl(request: YouTubeOAuthRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';
  return new URL(rawUrl, 'https://mybiz.ai.kr');
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createYouTubeOAuthState(payload: YouTubeOAuthStatePayload) {
  return base64UrlEncode(JSON.stringify(payload));
}

export function validateYouTubeOAuthState(
  state: string,
  options: {
    expectedNonce?: string;
    expectedStoreId?: string;
    maxAgeMs?: number;
    now?: () => number;
  } = {},
):
  | {
      ok: true;
      state: YouTubeOAuthStatePayload;
    }
  | {
      error: string;
      ok: false;
    } {
  try {
    const parsed = JSON.parse(base64UrlDecode(state)) as Partial<YouTubeOAuthStatePayload>;
    const payload = {
      issuedAt: Number(parsed.issuedAt),
      nonce: normalizeText(parsed.nonce),
      profileId: normalizeText(parsed.profileId),
      storeId: normalizeText(parsed.storeId),
    };

    if (!payload.issuedAt || !payload.nonce || !payload.profileId || !payload.storeId) {
      return { error: 'OAuth state is incomplete.', ok: false };
    }

    if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
      return { error: 'OAuth state nonce mismatch.', ok: false };
    }

    if (options.expectedStoreId && payload.storeId !== options.expectedStoreId) {
      return { error: 'OAuth state store mismatch.', ok: false };
    }

    const now = options.now?.() ?? Date.now();
    const maxAgeMs = options.maxAgeMs ?? STATE_MAX_AGE_MS;
    if (now - payload.issuedAt > maxAgeMs) {
      return { error: 'OAuth state expired.', ok: false };
    }

    return { ok: true, state: payload };
  } catch {
    return { error: 'OAuth state is invalid.', ok: false };
  }
}

function createStateCookie(nonce: string) {
  return `${STATE_COOKIE_NAME}=${encodeURIComponent(nonce)}; Max-Age=${STATE_MAX_AGE_SECONDS}; Path=/api/social/youtube/oauth; HttpOnly; Secure; SameSite=Lax`;
}

function expireStateCookie() {
  return `${STATE_COOKIE_NAME}=; Max-Age=0; Path=/api/social/youtube/oauth; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: YouTubeOAuthRequestLike, name: string) {
  const cookie = getHeaderValue(request.headers, 'cookie') || '';
  const pairs = cookie.split(';').map((entry) => entry.trim());
  const matched = pairs.find((entry) => entry.startsWith(`${name}=`));
  return matched ? decodeURIComponent(matched.slice(name.length + 1)) : undefined;
}

async function resolveDefaultMerchantAccess(
  _request: YouTubeOAuthRequestLike,
  storeId: string,
  bearerToken: string,
  client: SupabaseClient = getSupabaseAdminClient(),
): Promise<MerchantAccessResult> {
  const { data: authData, error: authError } = await client.auth.getUser(bearerToken);
  if (authError || !authData.user) {
    return {
      error: `Supabase auth validation failed: ${authError?.message || 'No user found.'}`,
      ok: false,
      status: 401,
    };
  }

  const repository = createSupabaseRepository(client);
  const resolvedAccess = await repository.resolveStoreAccess({
    fallbackEmail: authData.user.email || 'ops@mybiz.ai.kr',
    fallbackFullName: (authData.user.user_metadata?.full_name as string | undefined) || authData.user.email || '운영 관리자',
    fallbackProfileId: authData.user.id,
    requestedEmail: authData.user.email || undefined,
    requestedFullName: authData.user.user_metadata?.full_name as string | undefined,
  });

  if (!resolvedAccess?.accessibleStores.some((store) => store.id === storeId)) {
    return {
      error: 'The authenticated merchant does not have access to this store.',
      ok: false,
      status: 403,
    };
  }

  return {
    ok: true,
    profileId: resolvedAccess.profile.id,
    storeId,
  };
}

function createAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', YOUTUBE_REQUIRED_SCOPES.join(' '));
  url.searchParams.set('state', input.state);
  return url.toString();
}

export async function handleYouTubeOAuthStartRequest(
  request: YouTubeOAuthRequestLike,
  options: YouTubeOAuthHandlerOptions = {},
) {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed();
  }

  const storeId = normalizeText(getRequestUrl(request).searchParams.get('storeId'));
  if (!storeId) {
    return json({ ok: false, error: 'storeId is required.' }, 400);
  }

  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return json({ ok: false, error: 'Authorization bearer token is required.' }, 401);
  }

  const resolveAccess = options.resolveMerchantAccess || resolveDefaultMerchantAccess;
  const access = await resolveAccess(request, storeId, bearerToken);
  if (!access.ok) {
    return json({ ok: false, error: access.error }, access.status);
  }

  const readiness = getYouTubeProviderReadiness(options.env);
  if (!readiness.oauthReady) {
    return json(
      {
        ok: false,
        error: readiness.disabledMessage,
        missingEnvNames: readiness.missingOAuthEnvNames,
      },
      503,
    );
  }

  const nonce = options.nonceFactory?.() || crypto.randomUUID();
  const state = createYouTubeOAuthState({
    issuedAt: options.now?.() ?? Date.now(),
    nonce,
    profileId: access.profileId,
    storeId,
  });
  const authorizeUrl = createAuthorizeUrl({
    clientId: normalizeText(options.env?.YOUTUBE_CLIENT_ID),
    redirectUri: normalizeText(options.env?.YOUTUBE_REDIRECT_URI),
    state,
  });

  return json(
    {
      ok: true,
      data: {
        authorizeUrl,
        requiredScopes: [...YOUTUBE_REQUIRED_SCOPES],
        state,
      },
    },
    200,
    {
      'set-cookie': createStateCookie(nonce),
    },
  );
}

export async function handleYouTubeOAuthCallbackRequest(
  request: YouTubeOAuthRequestLike,
  options: YouTubeOAuthHandlerOptions = {},
) {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed();
  }

  const url = getRequestUrl(request);
  const code = normalizeText(url.searchParams.get('code'));
  const state = normalizeText(url.searchParams.get('state'));
  if (!code || !state) {
    return json({ ok: false, error: 'YouTube OAuth code and state are required.' }, 400);
  }

  const nonce = readCookie(request, STATE_COOKIE_NAME);
  const validatedState = validateYouTubeOAuthState(state, {
    expectedNonce: nonce,
    maxAgeMs: STATE_MAX_AGE_MS,
    now: options.now,
  });
  if (!nonce || !validatedState.ok) {
    return json({ ok: false, error: `OAuth state validation failed: ${validatedState.ok ? 'missing nonce' : validatedState.error}` }, 400);
  }

  const readiness = getYouTubeProviderReadiness(options.env);
  if (!readiness.oauthReady) {
    return json(
      {
        ok: false,
        error: readiness.disabledMessage,
        missingEnvNames: readiness.missingOAuthEnvNames,
      },
      503,
      {
        'set-cookie': expireStateCookie(),
      },
    );
  }

  if (!options.tokenExchangeAdapter) {
    return json(
      {
        ok: false,
        error: '외부 계정 연결 저장은 암호화 설정이 완료되면 사용할 수 있습니다.',
        storeId: validatedState.state.storeId,
      },
      501,
      {
        'set-cookie': expireStateCookie(),
      },
    );
  }

  try {
    const tokenPayload = await options.tokenExchangeAdapter({
      code,
      env: options.env,
      redirectUri: normalizeText(options.env?.YOUTUBE_REDIRECT_URI),
    });
    const tokenStatus = await saveProviderTokens(validatedState.state.storeId, 'youtube', tokenPayload, {
      actorProfileId: validatedState.state.profileId,
      client: options.client,
      env: options.env,
    });

    return json(
      {
        ok: true,
        data: {
          displayName: tokenStatus.displayName,
          oauthStatus: tokenStatus.oauthStatus,
          provider: 'youtube',
          providerAccountId: tokenStatus.providerAccountId,
          scopes: tokenStatus.scopes,
          storeId: validatedState.state.storeId,
          tokenExpiresAt: tokenStatus.tokenExpiresAt,
          tokenExpiringSoon: tokenStatus.tokenExpiringSoon,
        },
      },
      200,
      {
        'set-cookie': expireStateCookie(),
      },
    );
  } catch {
    return json(
      {
        ok: false,
        error: '외부 계정 연결 저장에 실패했습니다.',
        storeId: validatedState.state.storeId,
      },
      503,
      {
        'set-cookie': expireStateCookie(),
      },
    );
  }
}
