import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import {
  EXTERNAL_SOCIAL_PROVIDER_ENV,
  getExternalSocialProviderReadiness,
  type ExternalOAuthProvider,
  type ExternalSocialEnv,
} from '../shared/lib/services/externalSocialProvider.js';
import { getRequestMethod } from './nodeResponse.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';
import { encryptToken } from './tokenEncryption.js';

export type ExternalSocialOAuthRequestLike =
  | Request
  | {
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
    };

export interface ExternalSocialOAuthStatePayload {
  issuedAt: number;
  nonce: string;
  profileId: string;
  provider: ExternalOAuthProvider;
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

interface ExternalSocialOAuthHandlerOptions {
  env?: ExternalSocialEnv;
  nonceFactory?: () => string;
  now?: () => number;
  resolveMerchantAccess?: (
    request: ExternalSocialOAuthRequestLike,
    storeId: string,
    bearerToken: string,
  ) => Promise<MerchantAccessResult>;
}

interface TokenExchangeResult {
  accessToken: string;
  displayName: string;
  expiresAt: string | null;
  providerAccountId: string;
  refreshToken: string | null;
  scopes: string[];
}

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

function getHeaderValue(headers: ExternalSocialOAuthRequestLike['headers'], key: string) {
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

function getBearerToken(request: ExternalSocialOAuthRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  const matched = authorization?.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

function getRequestUrl(request: ExternalSocialOAuthRequestLike) {
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

export function createExternalSocialOAuthState(payload: ExternalSocialOAuthStatePayload) {
  return base64UrlEncode(JSON.stringify(payload));
}

export function validateExternalSocialOAuthState(
  state: string,
  options: {
    expectedNonce?: string;
    expectedProvider?: ExternalOAuthProvider;
    expectedStoreId?: string;
    maxAgeMs?: number;
    now?: () => number;
  } = {},
):
  | {
      ok: true;
      state: ExternalSocialOAuthStatePayload;
    }
  | {
      error: string;
      ok: false;
    } {
  try {
    const parsed = JSON.parse(base64UrlDecode(state)) as Partial<ExternalSocialOAuthStatePayload>;
    const provider = parsed.provider === 'threads' || parsed.provider === 'naver_blog' ? parsed.provider : undefined;
    const payload = {
      issuedAt: Number(parsed.issuedAt),
      nonce: normalizeText(parsed.nonce),
      profileId: normalizeText(parsed.profileId),
      provider,
      storeId: normalizeText(parsed.storeId),
    };

    if (!payload.issuedAt || !payload.nonce || !payload.profileId || !payload.provider || !payload.storeId) {
      return { error: 'OAuth state is incomplete.', ok: false };
    }

    if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
      return { error: 'OAuth state nonce mismatch.', ok: false };
    }

    if (options.expectedProvider && payload.provider !== options.expectedProvider) {
      return { error: 'OAuth state provider mismatch.', ok: false };
    }

    if (options.expectedStoreId && payload.storeId !== options.expectedStoreId) {
      return { error: 'OAuth state store mismatch.', ok: false };
    }

    const now = options.now?.() ?? Date.now();
    const maxAgeMs = options.maxAgeMs ?? STATE_MAX_AGE_MS;
    if (now - payload.issuedAt > maxAgeMs) {
      return { error: 'OAuth state expired.', ok: false };
    }

    return {
      ok: true,
      state: payload as ExternalSocialOAuthStatePayload,
    };
  } catch {
    return { error: 'OAuth state is invalid.', ok: false };
  }
}

function getCookieName(provider: ExternalOAuthProvider) {
  return EXTERNAL_SOCIAL_PROVIDER_ENV[provider].oauthCookieName;
}

function getCookiePath(provider: ExternalOAuthProvider) {
  return EXTERNAL_SOCIAL_PROVIDER_ENV[provider].oauthPath;
}

function createStateCookie(provider: ExternalOAuthProvider, nonce: string) {
  return `${getCookieName(provider)}=${encodeURIComponent(nonce)}; Max-Age=${STATE_MAX_AGE_SECONDS}; Path=${getCookiePath(provider)}; HttpOnly; Secure; SameSite=Lax`;
}

function expireStateCookie(provider: ExternalOAuthProvider) {
  return `${getCookieName(provider)}=; Max-Age=0; Path=${getCookiePath(provider)}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: ExternalSocialOAuthRequestLike, name: string) {
  const cookie = getHeaderValue(request.headers, 'cookie') || '';
  const pairs = cookie.split(';').map((entry) => entry.trim());
  const matched = pairs.find((entry) => entry.startsWith(`${name}=`));
  return matched ? decodeURIComponent(matched.slice(name.length + 1)) : undefined;
}

async function resolveDefaultMerchantAccess(
  _request: ExternalSocialOAuthRequestLike,
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

function createAuthorizeUrl(provider: ExternalOAuthProvider, input: { clientId: string; redirectUri: string; state: string }) {
  if (provider === 'threads') {
    const url = new URL('https://threads.net/oauth/authorize');
    url.searchParams.set('client_id', input.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', EXTERNAL_SOCIAL_PROVIDER_ENV.threads.requiredScopes.join(','));
    url.searchParams.set('state', input.state);
    return url.toString();
  }

  const url = new URL('https://nid.naver.com/oauth2.0/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', input.state);
  return url.toString();
}

function getClientId(provider: ExternalOAuthProvider, env?: ExternalSocialEnv) {
  return normalizeText(provider === 'threads' ? env?.THREADS_CLIENT_ID : env?.NAVER_CLIENT_ID);
}

function getClientSecret(provider: ExternalOAuthProvider, env?: ExternalSocialEnv) {
  return normalizeText(provider === 'threads' ? env?.THREADS_CLIENT_SECRET : env?.NAVER_CLIENT_SECRET);
}

function getRedirectUri(provider: ExternalOAuthProvider, env?: ExternalSocialEnv) {
  return normalizeText(provider === 'threads' ? env?.THREADS_REDIRECT_URI : env?.NAVER_REDIRECT_URI);
}

async function exchangeThreadsToken(code: string, env: ExternalSocialEnv): Promise<TokenExchangeResult> {
  const clientId = getClientId('threads', env);
  const clientSecret = getClientSecret('threads', env);
  const redirectUri = getRedirectUri('threads', env);

  // Step 1: short-lived token exchange
  const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Threads token exchange failed: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error_message?: string };
  if (!tokenData.access_token) {
    throw new Error(`Threads token exchange missing access_token: ${tokenData.error_message || 'unknown'}`);
  }

  // Step 2: exchange for long-lived token (valid 60 days)
  const longUrl = new URL('https://graph.threads.net/access_token');
  longUrl.searchParams.set('grant_type', 'th_exchange_token');
  longUrl.searchParams.set('client_secret', clientSecret);
  longUrl.searchParams.set('access_token', tokenData.access_token);

  const longRes = await fetch(longUrl.toString());
  const longData = (await longRes.json()) as { access_token?: string; expires_in?: number };
  const finalToken = longData.access_token || tokenData.access_token;
  const expiresIn = longData.expires_in ?? 3600;

  // Step 3: get user profile
  const meUrl = new URL('https://graph.threads.net/v1.0/me');
  meUrl.searchParams.set('fields', 'id,username');
  meUrl.searchParams.set('access_token', finalToken);
  const meRes = await fetch(meUrl.toString());
  const meData = (await meRes.json()) as { id?: string; username?: string };

  return {
    accessToken: finalToken,
    displayName: meData.username || meData.id || 'Threads',
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    providerAccountId: meData.id || '',
    refreshToken: null,
    scopes: ['threads_basic', 'threads_content_publish'],
  };
}

async function exchangeNaverToken(code: string, state: string, env: ExternalSocialEnv): Promise<TokenExchangeResult> {
  const clientId = getClientId('naver_blog', env);
  const clientSecret = getClientSecret('naver_blog', env);
  const redirectUri = getRedirectUri('naver_blog', env);

  const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
  tokenUrl.searchParams.set('grant_type', 'authorization_code');
  tokenUrl.searchParams.set('client_id', clientId);
  tokenUrl.searchParams.set('client_secret', clientSecret);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('state', state);

  const tokenRes = await fetch(tokenUrl.toString());
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Naver token exchange failed: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; expires_in?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(`Naver token exchange missing access_token: ${tokenData.error_description || tokenData.error || 'unknown'}`);
  }

  // Get user profile
  const meRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const meData = (await meRes.json()) as { response?: { id?: string; name?: string; email?: string } };
  const profile = meData.response || {};

  const expiresIn = Number(tokenData.expires_in || 3600);

  return {
    accessToken: tokenData.access_token,
    displayName: profile.name || profile.email || profile.id || 'Naver',
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    providerAccountId: profile.id || '',
    refreshToken: tokenData.refresh_token || null,
    scopes: ['blog.write'],
  };
}

async function saveSocialAccount(
  supabase: SupabaseClient,
  storeId: string,
  provider: ExternalOAuthProvider,
  result: TokenExchangeResult,
  encryptionKey: string,
) {
  const { error } = await supabase.from('social_accounts').upsert(
    {
      access_token_encrypted: encryptToken(result.accessToken, encryptionKey),
      display_name: result.displayName,
      oauth_status: 'connected',
      provider,
      provider_account_id: result.providerAccountId,
      refresh_token_encrypted: result.refreshToken ? encryptToken(result.refreshToken, encryptionKey) : null,
      scopes: result.scopes,
      store_id: storeId,
      token_expires_at: result.expiresAt,
    },
    { onConflict: 'store_id,provider' },
  );

  if (error) {
    throw new Error(`Failed to save social account: ${error.message}`);
  }
}

export async function handleExternalSocialOAuthStartRequest(
  provider: ExternalOAuthProvider,
  request: ExternalSocialOAuthRequestLike,
  options: ExternalSocialOAuthHandlerOptions = {},
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

  const readiness = getExternalSocialProviderReadiness(provider, options.env);
  if (!readiness.oauthReady) {
    return json(
      {
        ok: false,
        error: readiness.message,
        missingEnvNames: readiness.missingEnvNames,
      },
      503,
    );
  }

  const nonce = options.nonceFactory?.() || crypto.randomUUID();
  const state = createExternalSocialOAuthState({
    issuedAt: options.now?.() ?? Date.now(),
    nonce,
    profileId: access.profileId,
    provider,
    storeId,
  });
  const authorizeUrl = createAuthorizeUrl(provider, {
    clientId: getClientId(provider, options.env),
    redirectUri: getRedirectUri(provider, options.env),
    state,
  });

  return json(
    {
      ok: true,
      data: {
        authorizeUrl,
        provider,
        requiredScopes: [...EXTERNAL_SOCIAL_PROVIDER_ENV[provider].requiredScopes],
        state,
      },
    },
    200,
    {
      'set-cookie': createStateCookie(provider, nonce),
    },
  );
}

export async function handleExternalSocialOAuthCallbackRequest(
  provider: ExternalOAuthProvider,
  request: ExternalSocialOAuthRequestLike,
  options: ExternalSocialOAuthHandlerOptions = {},
) {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed();
  }

  const url = getRequestUrl(request);
  const code = normalizeText(url.searchParams.get('code'));
  const stateParam = normalizeText(url.searchParams.get('state'));
  if (!code || !stateParam) {
    return json({ ok: false, error: 'OAuth code and state are required.' }, 400);
  }

  const nonce = readCookie(request, getCookieName(provider));
  const validatedState = validateExternalSocialOAuthState(stateParam, {
    expectedNonce: nonce,
    expectedProvider: provider,
    maxAgeMs: STATE_MAX_AGE_MS,
    now: options.now,
  });
  if (!nonce || !validatedState.ok) {
    return json({ ok: false, error: `OAuth state validation failed: ${validatedState.ok ? 'missing nonce' : validatedState.error}` }, 400);
  }

  const env = options.env ?? (typeof process !== 'undefined' ? (process.env as ExternalSocialEnv) : {});
  const readiness = getExternalSocialProviderReadiness(provider, env);
  if (!readiness.oauthReady) {
    return json(
      { ok: false, error: readiness.message, missingEnvNames: readiness.missingEnvNames },
      503,
      { 'set-cookie': expireStateCookie(provider) },
    );
  }

  const encryptionKey = normalizeText(env.TOKEN_ENCRYPTION_KEY);
  if (!encryptionKey) {
    return json({ ok: false, error: 'TOKEN_ENCRYPTION_KEY is not configured.' }, 503, { 'set-cookie': expireStateCookie(provider) });
  }

  try {
    let tokenResult: TokenExchangeResult;
    if (provider === 'threads') {
      tokenResult = await exchangeThreadsToken(code, env);
    } else {
      tokenResult = await exchangeNaverToken(code, stateParam, env);
    }

    const supabase = getSupabaseAdminClient();
    await saveSocialAccount(supabase, validatedState.state.storeId, provider, tokenResult, encryptionKey);

    const redirectBase = normalizeText(env.VITE_APP_BASE_URL) || 'https://mybiz.ai.kr';
    const successUrl = new URL('/dashboard/content/social', redirectBase);
    successUrl.searchParams.set('connected', provider);

    return new Response(null, {
      headers: {
        'location': successUrl.toString(),
        'set-cookie': expireStateCookie(provider),
      },
      status: 302,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '계정 연동 중 오류가 발생했습니다.';
    return json(
      { ok: false, error: message, provider, storeId: validatedState.state.storeId },
      500,
      { 'set-cookie': expireStateCookie(provider) },
    );
  }
}

export async function handleExternalSocialDisconnectRequest(
  provider: ExternalOAuthProvider,
  request: ExternalSocialOAuthRequestLike,
  options: ExternalSocialOAuthHandlerOptions = {},
) {
  if (getRequestMethod(request) !== 'POST') {
    return new Response('Method Not Allowed', { headers: { allow: 'POST' }, status: 405 });
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

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('social_accounts')
    .update({ oauth_status: 'revoked', access_token_encrypted: null, refresh_token_encrypted: null })
    .eq('store_id', storeId)
    .eq('provider', provider);

  if (error) {
    return json({ ok: false, error: `Failed to disconnect account: ${error.message}` }, 500);
  }

  return json({ ok: true, provider, storeId });
}
