import type { SocialAccountStatus, SocialPublishJob, StoreMediaAsset } from '../../types/models.js';

export const YOUTUBE_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
] as const;

export const YOUTUBE_REQUIRED_ENV_NAMES = [
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REDIRECT_URI',
  'YOUTUBE_OAUTH_ENABLED',
  'TOKEN_ENCRYPTION_KEY',
  'YOUTUBE_UPLOAD_ENABLED',
] as const;

export type YouTubeEnv = Partial<Record<(typeof YOUTUBE_REQUIRED_ENV_NAMES)[number] | string, string | undefined>>;

export interface YouTubeProviderReadiness {
  disabledMessage: string;
  missingOAuthEnvNames: string[];
  oauthEnabled: boolean;
  oauthReady: boolean;
  requiredEnvNames: string[];
  requiredScopes: string[];
  tokenEncryptionConfigured: boolean;
  uploadEnabled: boolean;
  uploadReady: boolean;
}

export interface YouTubeUploadExecutionInput {
  accountStatus?: SocialAccountStatus | 'ready';
  env?: YouTubeEnv;
  job: SocialPublishJob;
  mediaAsset?: StoreMediaAsset;
}

function readProcessEnv(): YouTubeEnv {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }

  return process.env;
}

function normalizeEnvFlag(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function hasEnvValue(env: YouTubeEnv, name: string) {
  return Boolean(String(env[name] || '').trim());
}

export function getYouTubeProviderReadiness(env: YouTubeEnv = readProcessEnv()): YouTubeProviderReadiness {
  const oauthEnabled = normalizeEnvFlag(env.YOUTUBE_OAUTH_ENABLED);
  const uploadEnabled = normalizeEnvFlag(env.YOUTUBE_UPLOAD_ENABLED);
  const tokenEncryptionConfigured = hasEnvValue(env, 'TOKEN_ENCRYPTION_KEY');
  const missingOAuthEnvNames = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI', 'TOKEN_ENCRYPTION_KEY'].filter(
    (name) => !hasEnvValue(env, name),
  );
  if (!oauthEnabled) {
    missingOAuthEnvNames.push('YOUTUBE_OAUTH_ENABLED');
  }

  const oauthReady = oauthEnabled && missingOAuthEnvNames.length === 0 && tokenEncryptionConfigured;
  const uploadReady = oauthReady && uploadEnabled;

  return {
    disabledMessage: oauthReady
      ? 'YouTube 영상 업로드는 계정 연동과 업로드 설정 완료 후 사용할 수 있습니다.'
      : 'YouTube 계정 연동은 설정이 완료되면 사용할 수 있습니다.',
    missingOAuthEnvNames,
    oauthEnabled,
    oauthReady,
    requiredEnvNames: [...YOUTUBE_REQUIRED_ENV_NAMES],
    requiredScopes: [...YOUTUBE_REQUIRED_SCOPES],
    tokenEncryptionConfigured,
    uploadEnabled,
    uploadReady,
  };
}

export function getYouTubeCaptionReadiness(mediaAsset?: StoreMediaAsset) {
  const hasCaptionFile = Boolean(mediaAsset?.captions_srt?.trim() || mediaAsset?.captions_vtt?.trim());

  return {
    message: hasCaptionFile
      ? '자막 파일이 준비되어 있습니다. YouTube 연동과 업로드 설정 완료 후 등록할 수 있습니다.'
      : '자막 업로드는 자막 파일이 준비되고 YouTube 연동이 완료되면 사용할 수 있습니다.',
    ready: hasCaptionFile,
  };
}

function hasInternalStoragePath(mediaAsset?: StoreMediaAsset) {
  const storagePath = mediaAsset?.storage_path?.trim();
  if (!storagePath) {
    return false;
  }

  if (/^https?:\/\//i.test(storagePath) || /^[a-z]:/i.test(storagePath) || storagePath.startsWith('/') || storagePath.startsWith('\\')) {
    return false;
  }

  return !storagePath.split(/[\\/]/).some((part) => part === '..');
}

export function getYouTubeUploadExecutionReadiness(input: YouTubeUploadExecutionInput) {
  if (input.job.provider !== 'youtube') {
    return {
      message: 'YouTube 게시 작업만 업로드 실행 대상입니다.',
      ready: false,
    };
  }

  if (!input.job.approved_at || !input.job.approved_by) {
    return {
      message: '점주 승인 후 YouTube 업로드를 진행할 수 있습니다.',
      ready: false,
    };
  }

  if (input.accountStatus !== 'connected' && input.accountStatus !== 'ready') {
    return {
      message: 'YouTube 계정 연동이 필요합니다.',
      ready: false,
    };
  }

  const providerReadiness = getYouTubeProviderReadiness(input.env);
  if (!providerReadiness.uploadReady) {
    return {
      message: 'YouTube 업로드 설정이 아직 완료되지 않았습니다.',
      ready: false,
    };
  }

  if (input.job.source_type === 'media' && !hasInternalStoragePath(input.mediaAsset)) {
    return {
      message: 'YouTube 업로드에는 내부 storage_path 기반 파일 handoff가 필요합니다.',
      ready: false,
    };
  }

  return {
    captionReady: getYouTubeCaptionReadiness(input.mediaAsset).ready,
    message: 'YouTube 업로드 준비 조건을 충족했습니다.',
    ready: true,
  };
}
