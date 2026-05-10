import type { SupabaseClient } from '@supabase/supabase-js';

import { getDatabase, updateDatabase } from '../shared/lib/mockDb.js';
import type { SocialAccount, SocialAccountStatus, SocialProvider } from '../shared/types/models.js';
import {
  TOKEN_ENCRYPTION_KEY_ENV_NAME,
  decryptOAuthToken,
  encryptOAuthToken,
  getTokenVaultReadiness,
  type TokenVaultEnv,
} from './oauthTokenVault.js';

export type OAuthTokenProvider = Extract<SocialProvider, 'youtube' | 'threads' | 'naver_blog'>;

export interface ProviderTokenPayload {
  accessToken: string;
  displayName?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  providerAccountId?: string;
  refreshToken?: string;
  scopes?: string[];
}

export interface ProviderTokenStatus {
  displayName?: string;
  missingEnvNames: string[];
  oauthStatus: SocialAccountStatus;
  provider: OAuthTokenProvider;
  providerAccountId?: string;
  scopes: string[];
  tokenEncryptionReady: boolean;
  tokenExpiresAt?: string;
  tokenExpired: boolean;
  tokenExpiringSoon: boolean;
}

export interface ProviderTokenStoreOptions {
  actorProfileId?: string;
  client?: SupabaseClient;
  env?: TokenVaultEnv;
  now?: Date | (() => Date);
}

export type ProviderTokenRefreshAdapter = (input: {
  provider: OAuthTokenProvider;
  refreshToken: string;
  scopes: string[];
  storeId: string;
}) => Promise<ProviderTokenPayload> | ProviderTokenPayload;

export interface ProviderTokenRefreshOptions extends ProviderTokenStoreOptions {
  refreshAdapter?: ProviderTokenRefreshAdapter;
}

const TOKEN_PROVIDERS: OAuthTokenProvider[] = ['youtube', 'threads', 'naver_blog'];
const SAFE_ACCOUNT_COLUMNS =
  'account_id,store_id,provider,provider_account_id,display_name,oauth_status,token_expires_at,scopes,created_at,updated_at';
const TOKEN_ACCOUNT_COLUMNS = `${SAFE_ACCOUNT_COLUMNS},access_token_encrypted,refresh_token_encrypted`;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function getNow(options?: ProviderTokenStoreOptions) {
  if (typeof options?.now === 'function') {
    return options.now();
  }

  return options?.now || new Date();
}

function nowIso(options?: ProviderTokenStoreOptions) {
  return getNow(options).toISOString();
}

function createAccountId(storeId: string, provider: OAuthTokenProvider) {
  const normalizedStoreId = storeId.replace(/[^a-zA-Z0-9_:-]/g, '_');
  return `social_${normalizedStoreId}_${provider}`;
}

function assertTokenProvider(provider: SocialProvider): asserts provider is OAuthTokenProvider {
  if (!TOKEN_PROVIDERS.includes(provider as OAuthTokenProvider)) {
    throw new Error('Unsupported OAuth token provider.');
  }
}

function mapSocialAccount(row: Record<string, unknown>): SocialAccount {
  return {
    access_token_encrypted: normalizeText(row.access_token_encrypted) || undefined,
    account_id: normalizeText(row.account_id || row.id),
    created_at: normalizeText(row.created_at) || new Date().toISOString(),
    display_name: normalizeText(row.display_name) || undefined,
    oauth_status: (normalizeText(row.oauth_status) || 'not_connected') as SocialAccountStatus,
    provider: normalizeText(row.provider) as SocialProvider,
    provider_account_id: normalizeText(row.provider_account_id) || undefined,
    refresh_token_encrypted: normalizeText(row.refresh_token_encrypted) || undefined,
    scopes: toStringArray(row.scopes),
    store_id: normalizeText(row.store_id),
    token_expires_at: normalizeText(row.token_expires_at) || undefined,
    updated_at: normalizeText(row.updated_at || row.created_at) || new Date().toISOString(),
  };
}

async function assertStoreMember(storeId: string, options?: ProviderTokenStoreOptions) {
  const actorProfileId = normalizeText(options?.actorProfileId);
  if (!actorProfileId) {
    throw new Error('A store member is required to manage provider tokens.');
  }

  if (options?.client) {
    const { data, error } = await options.client
      .from('store_members')
      .select('store_id')
      .eq('store_id', storeId)
      .eq('profile_id', actorProfileId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to verify store member: ${error.message}`);
    }

    if (!data) {
      throw new Error('A store member is required to manage provider tokens.');
    }

    return;
  }

  const hasMembership = getDatabase().store_members.some(
    (member) => member.store_id === storeId && member.profile_id === actorProfileId,
  );
  if (!hasMembership) {
    throw new Error('A store member is required to manage provider tokens.');
  }
}

async function readProviderAccount(storeId: string, provider: OAuthTokenProvider, options?: ProviderTokenStoreOptions) {
  if (options?.client) {
    const { data, error } = await options.client
      .from('social_accounts')
      .select(TOKEN_ACCOUNT_COLUMNS)
      .eq('store_id', storeId)
      .eq('provider', provider)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load provider token status: ${error.message}`);
    }

    return data ? mapSocialAccount(data as Record<string, unknown>) : null;
  }

  const account = getDatabase().social_accounts.find((entry) => entry.store_id === storeId && entry.provider === provider);
  return account ? mapSocialAccount(account as unknown as Record<string, unknown>) : null;
}

async function persistProviderAccount(account: SocialAccount, options?: ProviderTokenStoreOptions) {
  if (options?.client) {
    const { data, error } = await options.client
      .from('social_accounts')
      .upsert(
        {
          access_token_encrypted: account.access_token_encrypted || null,
          account_id: account.account_id,
          display_name: account.display_name || null,
          oauth_status: account.oauth_status,
          provider: account.provider,
          provider_account_id: account.provider_account_id || null,
          refresh_token_encrypted: account.refresh_token_encrypted || null,
          scopes: account.scopes,
          store_id: account.store_id,
          token_expires_at: account.token_expires_at || null,
          updated_at: account.updated_at,
        },
        { onConflict: 'store_id,provider' },
      )
      .select(TOKEN_ACCOUNT_COLUMNS)
      .single();
    if (error) {
      throw new Error(`Failed to save provider tokens: ${error.message}`);
    }

    return mapSocialAccount(data as Record<string, unknown>);
  }

  updateDatabase((database) => {
    const accountIndex = database.social_accounts.findIndex(
      (entry) => entry.store_id === account.store_id && entry.provider === account.provider,
    );
    if (accountIndex >= 0) {
      database.social_accounts[accountIndex] = account;
      return;
    }

    database.social_accounts.unshift(account);
  });

  return account;
}

function normalizeExpiresAt(input: ProviderTokenPayload, options?: ProviderTokenStoreOptions) {
  const expiresAt = normalizeText(input.expiresAt);
  if (expiresAt) {
    return expiresAt;
  }

  if (typeof input.expiresInSeconds === 'number' && Number.isFinite(input.expiresInSeconds) && input.expiresInSeconds > 0) {
    return new Date(getNow(options).getTime() + input.expiresInSeconds * 1000).toISOString();
  }

  return undefined;
}

export function isTokenExpired(expiresAt?: string, now: Date = new Date()) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= now.getTime();
}

export function isTokenExpiringSoon(expiresAt?: string, now: Date = new Date(), windowMs = 60 * 60 * 1000) {
  if (!expiresAt || isTokenExpired(expiresAt, now)) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs - now.getTime() <= windowMs;
}

function resolveOAuthStatus(account: SocialAccount | null, now: Date): SocialAccountStatus {
  if (!account) {
    return 'not_connected';
  }

  if (account.oauth_status === 'connected' && isTokenExpired(account.token_expires_at, now)) {
    return 'expired';
  }

  return account.oauth_status || 'not_connected';
}

function toProviderTokenStatus(
  provider: OAuthTokenProvider,
  account: SocialAccount | null,
  options?: ProviderTokenStoreOptions,
): ProviderTokenStatus {
  const readiness = getTokenVaultReadiness(options?.env);
  const now = getNow(options);
  const oauthStatus = resolveOAuthStatus(account, now);

  return {
    displayName: account?.display_name,
    missingEnvNames: readiness.ready ? [] : [TOKEN_ENCRYPTION_KEY_ENV_NAME],
    oauthStatus,
    provider,
    providerAccountId: account?.provider_account_id,
    scopes: account?.scopes || [],
    tokenEncryptionReady: readiness.ready,
    tokenExpiresAt: account?.token_expires_at,
    tokenExpired: oauthStatus === 'expired',
    tokenExpiringSoon: oauthStatus === 'connected' && isTokenExpiringSoon(account?.token_expires_at, now),
  };
}

function assertVaultReady(options?: ProviderTokenStoreOptions) {
  const readiness = getTokenVaultReadiness(options?.env);
  if (!readiness.ready) {
    throw new Error(readiness.error);
  }
}

export async function saveProviderTokens(
  storeId: string,
  provider: OAuthTokenProvider,
  tokenPayload: ProviderTokenPayload,
  options?: ProviderTokenStoreOptions,
) {
  assertTokenProvider(provider);
  await assertStoreMember(storeId, options);
  assertVaultReady(options);
  const accessToken = normalizeText(tokenPayload.accessToken);
  if (!accessToken) {
    throw new Error('OAuth access token is required.');
  }

  const current = await readProviderAccount(storeId, provider, options);
  const timestamp = nowIso(options);
  const account: SocialAccount = {
    account_id: current?.account_id || createAccountId(storeId, provider),
    access_token_encrypted: encryptOAuthToken(accessToken, { env: options?.env }),
    created_at: current?.created_at || timestamp,
    display_name: normalizeText(tokenPayload.displayName) || current?.display_name,
    oauth_status: 'connected',
    provider,
    provider_account_id: normalizeText(tokenPayload.providerAccountId) || current?.provider_account_id,
    refresh_token_encrypted: tokenPayload.refreshToken
      ? encryptOAuthToken(tokenPayload.refreshToken, { env: options?.env })
      : current?.refresh_token_encrypted,
    scopes: tokenPayload.scopes || current?.scopes || [],
    store_id: storeId,
    token_expires_at: normalizeExpiresAt(tokenPayload, options) || current?.token_expires_at,
    updated_at: timestamp,
  };

  const saved = await persistProviderAccount(account, options);
  return toProviderTokenStatus(provider, saved, options);
}

export async function getProviderTokenStatus(
  storeId: string,
  provider: OAuthTokenProvider,
  options?: ProviderTokenStoreOptions,
) {
  assertTokenProvider(provider);
  await assertStoreMember(storeId, options);
  const account = await readProviderAccount(storeId, provider, options);
  return toProviderTokenStatus(provider, account, options);
}

export async function revokeProviderTokens(
  storeId: string,
  provider: OAuthTokenProvider,
  options?: ProviderTokenStoreOptions,
) {
  assertTokenProvider(provider);
  await assertStoreMember(storeId, options);
  const current = await readProviderAccount(storeId, provider, options);
  const timestamp = nowIso(options);
  const revoked: SocialAccount = {
    account_id: current?.account_id || createAccountId(storeId, provider),
    created_at: current?.created_at || timestamp,
    display_name: current?.display_name,
    oauth_status: 'revoked',
    provider,
    provider_account_id: current?.provider_account_id,
    scopes: [],
    store_id: storeId,
    token_expires_at: undefined,
    updated_at: timestamp,
  };

  const saved = await persistProviderAccount(revoked, options);
  return toProviderTokenStatus(provider, saved, options);
}

export async function markProviderTokenExpired(
  storeId: string,
  provider: OAuthTokenProvider,
  options?: ProviderTokenStoreOptions,
) {
  assertTokenProvider(provider);
  await assertStoreMember(storeId, options);
  const current = await readProviderAccount(storeId, provider, options);
  const timestamp = nowIso(options);
  const expired: SocialAccount = {
    account_id: current?.account_id || createAccountId(storeId, provider),
    access_token_encrypted: current?.access_token_encrypted,
    created_at: current?.created_at || timestamp,
    display_name: current?.display_name,
    oauth_status: current ? 'expired' : 'not_connected',
    provider,
    provider_account_id: current?.provider_account_id,
    refresh_token_encrypted: current?.refresh_token_encrypted,
    scopes: current?.scopes || [],
    store_id: storeId,
    token_expires_at: current?.token_expires_at,
    updated_at: timestamp,
  };

  const saved = await persistProviderAccount(expired, options);
  return toProviderTokenStatus(provider, saved, options);
}

export async function refreshProviderToken(
  storeId: string,
  provider: OAuthTokenProvider,
  options?: ProviderTokenRefreshOptions,
) {
  assertTokenProvider(provider);
  await assertStoreMember(storeId, options);
  if (!options?.refreshAdapter) {
    throw new Error('토큰 갱신 기능은 provider 설정 완료 후 사용할 수 있습니다.');
  }

  assertVaultReady(options);
  const account = await readProviderAccount(storeId, provider, options);
  if (!account?.refresh_token_encrypted) {
    throw new Error('Refresh token is not available for this provider.');
  }

  const refreshToken = decryptOAuthToken(account.refresh_token_encrypted, { env: options.env });
  const refreshed = await options.refreshAdapter({
    provider,
    refreshToken,
    scopes: account.scopes,
    storeId,
  });
  return saveProviderTokens(storeId, provider, refreshed, options);
}
