/**
 * storeOAuthCredentialsService
 *
 * 점주가 직접 입력한 소셜 플랫폼 OAuth 자격증명(client_id, client_secret 등)을
 * Supabase store_oauth_credentials 테이블에 저장·조회합니다.
 *
 * 동작 우선순위:
 *   1. DB에 해당 store + provider 의 자격증명이 있으면 사용
 *   2. 없으면 서버 환경 변수(THREADS_CLIENT_ID 등) 폴백
 */

import { supabase } from '../../../integrations/supabase/client.js';

export type OAuthProvider = 'threads' | 'naver_blog' | 'youtube' | 'kakao_share';

export interface StoreOAuthCredential {
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  extraConfig?: Record<string, string>;
}

export interface StoreOAuthCredentialInput {
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  extraConfig?: Record<string, string>;
}

// ─── 조회 ─────────────────────────────────────────────────────────────────────

export async function getStoreOAuthCredential(
  storeId: string,
  provider: OAuthProvider,
): Promise<StoreOAuthCredential | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('store_oauth_credentials')
    .select('client_id, client_secret, redirect_uri, extra_config')
    .eq('store_id', storeId)
    .eq('provider', provider)
    .maybeSingle();

  if (error || !data) return null;

  const clientId = (data.client_id as string | null) || '';
  const clientSecret = (data.client_secret as string | null) || '';
  const redirectUri = (data.redirect_uri as string | null) || '';

  // 최소한 client_id 가 있어야 유효한 자격증명으로 간주
  if (!clientId) return null;

  return {
    provider,
    clientId,
    clientSecret,
    redirectUri,
    extraConfig: (data.extra_config as Record<string, string> | null) || {},
  };
}

export async function listStoreOAuthCredentials(
  storeId: string,
): Promise<Array<{ provider: OAuthProvider; hasCredentials: boolean; redirectUri: string }>> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('store_oauth_credentials')
    .select('provider, client_id, redirect_uri')
    .eq('store_id', storeId);

  if (error || !data) return [];

  return data.map((row) => ({
    provider: row.provider as OAuthProvider,
    hasCredentials: Boolean(row.client_id),
    redirectUri: (row.redirect_uri as string | null) || '',
  }));
}

// ─── 저장 ─────────────────────────────────────────────────────────────────────

export async function saveStoreOAuthCredential(
  storeId: string,
  input: StoreOAuthCredentialInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase 클라이언트를 사용할 수 없습니다.' };

  const { error } = await supabase.from('store_oauth_credentials').upsert(
    {
      store_id: storeId,
      provider: input.provider,
      client_id: input.clientId.trim() || null,
      client_secret: input.clientSecret.trim() || null,
      redirect_uri: input.redirectUri.trim() || null,
      extra_config: input.extraConfig || {},
    },
    { onConflict: 'store_id,provider' },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteStoreOAuthCredential(
  storeId: string,
  provider: OAuthProvider,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase 클라이언트를 사용할 수 없습니다.' };

  const { error } = await supabase
    .from('store_oauth_credentials')
    .delete()
    .eq('store_id', storeId)
    .eq('provider', provider);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── 기본 Redirect URI 생성 헬퍼 ─────────────────────────────────────────────

export function getDefaultRedirectUri(provider: OAuthProvider): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://mybiz.ai.kr');

  const paths: Record<OAuthProvider, string> = {
    threads: '/api/auth/threads/callback',
    naver_blog: '/api/auth/naver/callback',
    youtube: '/api/auth/youtube/callback',
    kakao_share: '/api/auth/kakao/callback',
  };

  return `${base}${paths[provider]}`;
}
