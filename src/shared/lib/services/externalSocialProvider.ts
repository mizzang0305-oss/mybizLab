import type { SocialAccountStatus, SocialProvider } from '../../types/models.js';

export type ExternalSocialProvider = Extract<SocialProvider, 'threads' | 'naver_blog' | 'kakao_share'>;
export type ExternalOAuthProvider = Extract<ExternalSocialProvider, 'threads' | 'naver_blog'>;
export type ExternalSocialProviderStatus = 'disabled' | 'not_connected' | 'connected' | 'ready' | 'error';

export const EXTERNAL_SOCIAL_PROVIDER_ENV = {
  kakao_share: {
    message: '카카오 공유는 자동 게시가 아니라 사용자가 직접 공유하는 방식으로 제공됩니다.',
    optionalEnvNames: ['KAKAO_TEMPLATE_ID'],
    publishEnabledEnvName: 'KAKAO_SHARE_ENABLED',
    requiredEnvNames: ['KAKAO_JAVASCRIPT_KEY', 'KAKAO_SHARE_ENABLED'],
    requiredScopes: [],
    title: 'Kakao',
  },
  naver_blog: {
    message: '네이버 블로그 글쓰기는 네이버 계정 연결과 게시 설정이 완료된 뒤 사용할 수 있습니다.',
    oauthCookieName: 'mybiz_naver_oauth_state',
    oauthPath: '/api/social/naver/oauth',
    optionalEnvNames: [],
    publishEnabledEnvName: 'NAVER_BLOG_WRITE_ENABLED',
    redirectEnvName: 'NAVER_REDIRECT_URI',
    requiredEnvNames: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET', 'NAVER_REDIRECT_URI', 'NAVER_BLOG_WRITE_ENABLED'],
    requiredScopes: ['blog.write'],
    title: 'Naver Blog',
  },
  threads: {
    message: 'Threads 게시 기능은 점주 계정 연동과 게시 권한 확인 후 사용할 수 있습니다.',
    oauthCookieName: 'mybiz_threads_oauth_state',
    oauthPath: '/api/social/threads/oauth',
    optionalEnvNames: [],
    publishEnabledEnvName: 'THREADS_PUBLISH_ENABLED',
    redirectEnvName: 'THREADS_REDIRECT_URI',
    requiredEnvNames: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET', 'THREADS_REDIRECT_URI', 'THREADS_PUBLISH_ENABLED'],
    requiredScopes: ['threads_basic', 'threads_content_publish'],
    title: 'Threads',
  },
} as const;

type ExternalSocialEnvName =
  | (typeof EXTERNAL_SOCIAL_PROVIDER_ENV)[ExternalSocialProvider]['requiredEnvNames'][number]
  | (typeof EXTERNAL_SOCIAL_PROVIDER_ENV)[ExternalSocialProvider]['optionalEnvNames'][number]
  | 'TOKEN_ENCRYPTION_KEY';

export type ExternalSocialEnv = Partial<Record<ExternalSocialEnvName | string, string | undefined>>;

const MIN_TOKEN_ENCRYPTION_KEY_BYTES = 32;
const TOKEN_ENCRYPTION_DISABLED_MESSAGE = '외부 계정 연결은 토큰 암호화 설정이 완료된 뒤 사용할 수 있습니다.';

export interface ExternalSocialProviderReadiness {
  connectionReady: boolean;
  enabled: boolean;
  message: string;
  missingEnvNames: string[];
  oauthReady: boolean;
  optionalEnvNames: string[];
  provider: ExternalSocialProvider;
  publishReady: boolean;
  requiredEnvNames: string[];
  requiredScopes: string[];
  status: ExternalSocialProviderStatus;
  title: string;
  tokenEncryptionConfigured: boolean;
}

function readProcessEnv(): ExternalSocialEnv {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }

  return process.env;
}

function normalizeEnvFlag(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function hasEnvValue(env: ExternalSocialEnv, name: string) {
  return Boolean(String(env[name] || '').trim());
}

function hasTokenEncryptionKey(env: ExternalSocialEnv) {
  const key = String(env.TOKEN_ENCRYPTION_KEY || '').trim();
  return new TextEncoder().encode(key).length >= MIN_TOKEN_ENCRYPTION_KEY_BYTES;
}

function getClientEnvNames(provider: ExternalOAuthProvider) {
  return provider === 'threads'
    ? {
        clientId: 'THREADS_CLIENT_ID',
        clientSecret: 'THREADS_CLIENT_SECRET',
        redirectUri: 'THREADS_REDIRECT_URI',
      }
    : {
        clientId: 'NAVER_CLIENT_ID',
        clientSecret: 'NAVER_CLIENT_SECRET',
        redirectUri: 'NAVER_REDIRECT_URI',
      };
}

function getOAuthMissingEnvNames(provider: ExternalOAuthProvider, env: ExternalSocialEnv) {
  const names = getClientEnvNames(provider);
  return [names.clientId, names.clientSecret, names.redirectUri, 'TOKEN_ENCRYPTION_KEY'].filter((name) =>
    name === 'TOKEN_ENCRYPTION_KEY' ? !hasTokenEncryptionKey(env) : !hasEnvValue(env, name),
  );
}

function getProviderMissingEnvNames(provider: ExternalSocialProvider, env: ExternalSocialEnv) {
  const config = EXTERNAL_SOCIAL_PROVIDER_ENV[provider];
  const missing: string[] = config.requiredEnvNames.filter((name) => {
    if (name === config.publishEnabledEnvName) {
      return !normalizeEnvFlag(env[name]);
    }

    return !hasEnvValue(env, name);
  });

  if (provider === 'threads' || provider === 'naver_blog') {
    missing.push(...getOAuthMissingEnvNames(provider, env));
  }

  return [...new Set(missing)];
}

export function getExternalSocialProviderReadiness(
  provider: ExternalSocialProvider,
  env: ExternalSocialEnv = readProcessEnv(),
  options: { accountStatus?: SocialAccountStatus | ExternalSocialProviderStatus } = {},
): ExternalSocialProviderReadiness {
  const config = EXTERNAL_SOCIAL_PROVIDER_ENV[provider];
  const enabled = normalizeEnvFlag(env[config.publishEnabledEnvName]);
  const missingEnvNames = getProviderMissingEnvNames(provider, env);
  const tokenEncryptionConfigured = provider === 'kakao_share' ? true : hasTokenEncryptionKey(env);
  const oauthReady =
    provider === 'kakao_share'
      ? false
      : getOAuthMissingEnvNames(provider, env).length === 0 && tokenEncryptionConfigured;
  const connectionReady = provider === 'kakao_share' ? enabled && missingEnvNames.length === 0 : oauthReady;
  const publishReady = enabled && missingEnvNames.length === 0;

  let status: ExternalSocialProviderStatus = publishReady ? 'not_connected' : 'disabled';
  if (provider === 'kakao_share') {
    status = publishReady ? 'ready' : 'disabled';
  } else if (options.accountStatus === 'connected' || options.accountStatus === 'ready') {
    status = publishReady ? 'ready' : 'connected';
  } else if (connectionReady) {
    status = 'not_connected';
  }

  return {
    connectionReady,
    enabled,
    message: !tokenEncryptionConfigured ? TOKEN_ENCRYPTION_DISABLED_MESSAGE : config.message,
    missingEnvNames,
    oauthReady,
    optionalEnvNames: [...config.optionalEnvNames],
    provider,
    publishReady,
    requiredEnvNames: [...config.requiredEnvNames],
    requiredScopes: [...config.requiredScopes],
    status,
    title: config.title,
    tokenEncryptionConfigured,
  };
}

export function isExternalFoundationProvider(provider: SocialProvider): provider is ExternalSocialProvider {
  return provider === 'threads' || provider === 'naver_blog' || provider === 'kakao_share';
}
