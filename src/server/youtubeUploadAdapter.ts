import type { SupabaseClient } from '@supabase/supabase-js';

import { getDatabase, updateDatabase } from '../shared/lib/mockDb.js';
import { getYouTubeProviderReadiness, type YouTubeEnv } from '../shared/lib/services/youtubeProvider.js';
import type { SocialAccount, SocialPublishJob, StoreMediaAsset } from '../shared/types/models.js';
import { decryptOAuthToken, getTokenVaultReadiness, type OAuthTokenVaultEnv } from './oauthTokenVault.js';

export type YouTubeUploadReadinessReason =
  | 'approval_missing'
  | 'file_handoff_missing'
  | 'invalid_provider'
  | 'media_not_ready'
  | 'media_storage_missing'
  | 'media_type_unsupported'
  | 'provider_disabled'
  | 'token_missing'
  | 'token_not_connected';

export interface YouTubeUploadReadiness {
  message: string;
  ready: boolean;
  reasonCode?: YouTubeUploadReadinessReason;
}

export interface YouTubeUploadPayload {
  media: {
    storagePath: string;
  };
  snippet: {
    description: string;
    tags: string[];
    title: string;
  };
  status: {
    privacyStatus: 'private' | 'public' | 'unlisted';
  };
}

export interface YouTubeMediaFile {
  data: Blob | Buffer | Uint8Array | ArrayBuffer;
  filename?: string;
  mimeType: string;
  sizeBytes: number;
}

export interface YouTubeUploadTransport {
  uploadCaption(input: {
    accessToken: string;
    caption: YouTubeCaptionFile;
    videoId: string;
  }): Promise<YouTubeCaptionUploadResult>;
  uploadVideo(input: {
    accessToken: string;
    mediaFile: YouTubeMediaFile;
    payload: YouTubeUploadPayload;
  }): Promise<{
    providerPostId: string;
    providerUrl: string;
  }>;
}

export interface YouTubeCaptionFile {
  body: string;
  language: string;
  mimeType: 'application/x-subrip' | 'text/vtt';
  name: string;
}

export interface YouTubeCaptionUploadResult {
  captionId?: string;
  reasonCode?: 'caption_missing';
  uploaded: boolean;
}

export interface YouTubeUploadJobContext {
  account?: SocialAccount;
  job: SocialPublishJob;
  mediaAsset?: StoreMediaAsset;
}

export interface YouTubeUploadAdapterOptions {
  actorProfileId?: string;
  client?: SupabaseClient;
  env?: YouTubeEnv & OAuthTokenVaultEnv;
  loadContext?: (jobId: string, options: YouTubeUploadAdapterOptions) => Promise<YouTubeUploadJobContext>;
  maxFileSizeBytes?: number;
  now?: () => string;
  privacyStatus?: 'private' | 'public' | 'unlisted';
  readMediaFile?: (storagePath: string, mediaAsset: StoreMediaAsset) => Promise<YouTubeMediaFile>;
  storeId: string;
  transport?: YouTubeUploadTransport;
  updateJob?: (job: SocialPublishJob, patch: Partial<SocialPublishJob>) => Promise<SocialPublishJob>;
}

export interface YouTubeUploadVideoResult {
  caption: YouTubeCaptionUploadResult;
  job: SocialPublishJob;
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024;
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nowIso(options?: Pick<YouTubeUploadAdapterOptions, 'now'>) {
  return options?.now?.() || new Date().toISOString();
}

function sanitizeText(value: unknown, fallback: string, maxLength: number) {
  const stripped = normalizeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = stripped || fallback;
  return safe.length > maxLength ? safe.slice(0, maxLength).trim() : safe;
}

function uniqueTags(values: string[]) {
  return [...new Set(values.map((value) => normalizeText(value).replace(/^#/, '')).filter(Boolean))].slice(0, 15);
}

function getCaptionLines(job: SocialPublishJob) {
  return normalizeText(job.caption).split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function hasSafeStoragePath(mediaAsset?: StoreMediaAsset) {
  const storagePath = normalizeText(mediaAsset?.storage_path);
  if (!storagePath) {
    return false;
  }

  if (/^https?:\/\//i.test(storagePath) || /^[a-z]:/i.test(storagePath) || storagePath.startsWith('/') || storagePath.startsWith('\\')) {
    return false;
  }

  return !storagePath.split(/[\\/]/).some((part) => part === '..');
}

function assertStoreMember(storeId: string, actorProfileId?: string) {
  if (!actorProfileId) {
    throw new Error('A store member is required to run YouTube upload jobs.');
  }

  const isMember = getDatabase().store_members.some(
    (member) => member.store_id === storeId && member.profile_id === actorProfileId,
  );
  if (!isMember) {
    throw new Error('A store member is required to run YouTube upload jobs.');
  }
}

function findConnectedYouTubeAccount(storeId: string) {
  return getDatabase().social_accounts.find(
    (account) => account.store_id === storeId && account.provider === 'youtube' && account.oauth_status === 'connected',
  );
}

async function loadLocalContext(jobId: string, options: YouTubeUploadAdapterOptions): Promise<YouTubeUploadJobContext> {
  assertStoreMember(options.storeId, options.actorProfileId);
  const database = getDatabase();
  const job = database.social_publish_jobs.find((entry) => entry.store_id === options.storeId && entry.job_id === jobId);
  if (!job) {
    throw new Error('YouTube upload job not found.');
  }

  return {
    account: findConnectedYouTubeAccount(options.storeId),
    job,
    mediaAsset: job.source_type === 'media' && job.source_id
      ? database.store_media_assets.find((asset) => asset.store_id === options.storeId && asset.asset_id === job.source_id)
      : undefined,
  };
}

async function updateLocalJob(job: SocialPublishJob, patch: Partial<SocialPublishJob>) {
  const nextJob: SocialPublishJob = {
    ...job,
    ...patch,
    updated_at: patch.updated_at || new Date().toISOString(),
  };

  updateDatabase((database) => {
    database.social_publish_jobs = database.social_publish_jobs.map((entry) => {
      if (entry.store_id !== job.store_id || entry.job_id !== job.job_id) {
        return entry;
      }

      return nextJob;
    });
  });

  return nextJob;
}

async function patchJob(job: SocialPublishJob, patch: Partial<SocialPublishJob>, options: YouTubeUploadAdapterOptions) {
  if (options.updateJob) {
    return options.updateJob(job, patch);
  }

  return updateLocalJob(job, patch);
}

export function getYouTubeUploadReadiness(input: {
  account?: Pick<SocialAccount, 'access_token_encrypted' | 'oauth_status'>;
  env?: YouTubeUploadAdapterOptions['env'];
  job: SocialPublishJob;
  mediaAsset?: StoreMediaAsset;
}): YouTubeUploadReadiness {
  if (input.job.provider !== 'youtube') {
    return {
      message: 'YouTube 게시 작업만 업로드 실행 대상입니다.',
      ready: false,
      reasonCode: 'invalid_provider',
    };
  }

  if (!input.job.approved_at || !input.job.approved_by) {
    return {
      message: '점주 승인 후 YouTube 업로드를 진행할 수 있습니다.',
      ready: false,
      reasonCode: 'approval_missing',
    };
  }

  if (input.account?.oauth_status !== 'connected') {
    return {
      message: 'YouTube 계정 연동이 필요합니다.',
      ready: false,
      reasonCode: 'token_not_connected',
    };
  }

  if (!getYouTubeProviderReadiness(input.env).uploadReady || !getTokenVaultReadiness({ env: input.env }).ready) {
    return {
      message: 'YouTube 업로드 설정이 아직 완료되지 않았습니다.',
      ready: false,
      reasonCode: 'provider_disabled',
    };
  }

  if (!input.account.access_token_encrypted) {
    return {
      message: 'YouTube 업로드 토큰 저장이 필요합니다.',
      ready: false,
      reasonCode: 'token_missing',
    };
  }

  if (input.job.source_type !== 'media' || input.mediaAsset?.asset_type !== 'video') {
    return {
      message: 'YouTube 업로드에는 영상 미디어 소스가 필요합니다.',
      ready: false,
      reasonCode: 'media_type_unsupported',
    };
  }

  if (input.mediaAsset.status !== 'ready' && input.mediaAsset.status !== 'published') {
    return {
      message: 'YouTube 업로드에는 준비 완료된 영상 미디어가 필요합니다.',
      ready: false,
      reasonCode: 'media_not_ready',
    };
  }

  if (!hasSafeStoragePath(input.mediaAsset)) {
    return {
      message: 'YouTube 업로드에는 내부 storage_path 기반 파일 handoff가 필요합니다.',
      ready: false,
      reasonCode: 'media_storage_missing',
    };
  }

  return {
    message: 'YouTube 업로드 준비 조건을 충족했습니다.',
    ready: true,
  };
}

export function createYouTubeUploadPayload(
  job: SocialPublishJob,
  mediaAsset: StoreMediaAsset,
  options?: Pick<YouTubeUploadAdapterOptions, 'privacyStatus'>,
): YouTubeUploadPayload {
  if (!hasSafeStoragePath(mediaAsset) || !mediaAsset.storage_path) {
    throw new Error('A safe storage_path is required before creating a YouTube upload payload.');
  }

  const captionLines = getCaptionLines(job);
  const title = sanitizeText(captionLines[0] || mediaAsset.ai_title, 'MyBiz 매장 영상', 100);
  const descriptionSource = captionLines.filter((line) => !line.startsWith('#')).slice(1).join('\n\n') || mediaAsset.ai_description;
  const description = sanitizeText(descriptionSource, '점주가 승인한 MyBiz 매장 영상입니다.', 4900);

  return {
    media: {
      storagePath: mediaAsset.storage_path,
    },
    snippet: {
      description,
      tags: uniqueTags([...(job.hashtags || []), ...(mediaAsset.ai_hashtags || [])]),
      title,
    },
    status: {
      privacyStatus: options?.privacyStatus || 'private',
    },
  };
}

function getCaptionFile(mediaAsset?: StoreMediaAsset): YouTubeCaptionFile | undefined {
  const srt = normalizeText(mediaAsset?.captions_srt);
  if (srt) {
    return {
      body: srt,
      language: 'ko',
      mimeType: 'application/x-subrip',
      name: 'MyBiz Korean captions',
    };
  }

  const vtt = normalizeText(mediaAsset?.captions_vtt);
  if (vtt) {
    return {
      body: vtt,
      language: 'ko',
      mimeType: 'text/vtt',
      name: 'MyBiz Korean captions',
    };
  }

  return undefined;
}

function toBlobPart(data: YouTubeMediaFile['data']) {
  if (data instanceof Blob) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return data;
  }

  return new Uint8Array(data as Uint8Array);
}

function createDefaultTransport(): YouTubeUploadTransport {
  return {
    async uploadCaption(input) {
      const metadata = {
        snippet: {
          language: input.caption.language,
          name: input.caption.name,
          videoId: input.videoId,
        },
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('caption', new Blob([input.caption.body], { type: input.caption.mimeType }), input.caption.mimeType === 'text/vtt' ? 'captions.vtt' : 'captions.srt');
      const response = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart', {
        body: form,
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`YouTube captions.insert failed with status ${response.status}`);
      }
      const payload = await response.json() as { id?: string };
      return {
        captionId: payload.id,
        uploaded: true,
      };
    },
    async uploadVideo(input) {
      const metadata = {
        snippet: input.payload.snippet,
        status: input.payload.status,
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('media', new Blob([toBlobPart(input.mediaFile.data)], { type: input.mediaFile.mimeType }), input.mediaFile.filename || 'video.mp4');
      const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart', {
        body: form,
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`YouTube videos.insert failed with status ${response.status}`);
      }
      const payload = await response.json() as { id?: string };
      if (!payload.id) {
        throw new Error('YouTube videos.insert did not return a video id.');
      }

      return {
        providerPostId: payload.id,
        providerUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(payload.id)}`,
      };
    },
  };
}

function sanitizeErrorValue(value: string, env?: YouTubeUploadAdapterOptions['env']) {
  let sanitized = value;
  Object.values(env || {}).forEach((secret) => {
    const normalized = normalizeText(secret);
    if (normalized && normalized.length >= 6) {
      sanitized = sanitized.split(normalized).join('[redacted]');
    }
  });

  return sanitized.replace(/ya29\.[A-Za-z0-9._-]+/g, '[redacted-token]');
}

export function mapYouTubeError(error: unknown, env?: YouTubeUploadAdapterOptions['env']) {
  const rawMessage = error instanceof Error ? error.message : String(error || 'unknown');
  const safeMessage = sanitizeErrorValue(rawMessage, env);

  return {
    code: 'youtube_upload_failed',
    detail: safeMessage.slice(0, 180),
    message: 'YouTube 업로드 중 오류가 발생했습니다. 설정, quota, 파일 상태를 확인해 주세요.',
  };
}

function mapReadinessFailure(reasonCode?: YouTubeUploadReadinessReason) {
  if (reasonCode === 'media_storage_missing') {
    return {
      code: 'media_storage_missing',
      message: 'YouTube 업로드에는 내부 storage_path 기반 파일 handoff가 필요합니다.',
    };
  }

  if (reasonCode === 'token_missing' || reasonCode === 'token_not_connected') {
    return {
      code: 'youtube_token_not_ready',
      message: 'YouTube 계정 토큰 연결이 필요합니다.',
    };
  }

  if (reasonCode === 'approval_missing') {
    return {
      code: 'merchant_approval_required',
      message: '점주 승인 후 YouTube 업로드를 진행할 수 있습니다.',
    };
  }

  return {
    code: 'youtube_upload_not_configured',
    message: 'YouTube 업로드 설정이 아직 완료되지 않았습니다.',
  };
}

function validateMediaFile(mediaFile: YouTubeMediaFile, options: YouTubeUploadAdapterOptions) {
  if (!ALLOWED_VIDEO_MIME_TYPES.has(mediaFile.mimeType)) {
    throw new Error('Unsupported YouTube upload MIME type.');
  }

  if (mediaFile.sizeBytes <= 0 || mediaFile.sizeBytes > (options.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES)) {
    throw new Error('YouTube upload file size is outside the allowed range.');
  }
}

export async function uploadYouTubeCaption(
  videoId: string,
  caption: YouTubeCaptionFile | undefined,
  options: {
    accessToken: string;
    transport?: YouTubeUploadTransport;
  },
): Promise<YouTubeCaptionUploadResult> {
  if (!caption?.body.trim()) {
    return {
      reasonCode: 'caption_missing',
      uploaded: false,
    };
  }

  return (options.transport || createDefaultTransport()).uploadCaption({
    accessToken: options.accessToken,
    caption,
    videoId,
  });
}

export async function uploadYouTubeVideo(
  jobId: string,
  options: YouTubeUploadAdapterOptions,
): Promise<YouTubeUploadVideoResult> {
  const context = await (options.loadContext || loadLocalContext)(jobId, options);
  let job = context.job;
  const readiness = getYouTubeUploadReadiness({
    account: context.account,
    env: options.env,
    job,
    mediaAsset: context.mediaAsset,
  });

  if (!readiness.ready) {
    const failure = mapReadinessFailure(readiness.reasonCode);
    job = await patchJob(job, {
      error_code: failure.code,
      error_message: failure.message,
      status: 'failed',
      updated_at: nowIso(options),
    }, options);

    return {
      caption: { reasonCode: 'caption_missing', uploaded: false },
      job,
    };
  }

  try {
    const accessToken = decryptOAuthToken(context.account?.access_token_encrypted || '', { env: options.env });
    const mediaAsset = context.mediaAsset as StoreMediaAsset;
    const payload = createYouTubeUploadPayload(job, mediaAsset, options);
    if (!options.readMediaFile) {
      throw new Error('YouTube upload file handoff is not configured.');
    }

    const mediaFile = await options.readMediaFile(payload.media.storagePath, mediaAsset);
    validateMediaFile(mediaFile, options);
    job = await patchJob(job, {
      error_code: undefined,
      error_message: undefined,
      status: 'publishing',
      updated_at: nowIso(options),
    }, options);

    const uploadResult = await (options.transport || createDefaultTransport()).uploadVideo({
      accessToken,
      mediaFile,
      payload,
    });
    const caption = await uploadYouTubeCaption(uploadResult.providerPostId, getCaptionFile(mediaAsset), {
      accessToken,
      transport: options.transport,
    });
    job = await patchJob(job, {
      error_code: undefined,
      error_message: undefined,
      provider_post_id: uploadResult.providerPostId,
      provider_url: uploadResult.providerUrl,
      published_at: nowIso(options),
      status: 'published',
      updated_at: nowIso(options),
    }, options);

    return {
      caption,
      job,
    };
  } catch (error) {
    const mapped = mapYouTubeError(error, options.env);
    job = await patchJob(job, {
      error_code: mapped.code,
      error_message: mapped.message,
      status: 'failed',
      updated_at: nowIso(options),
    }, options);

    return {
      caption: { reasonCode: 'caption_missing', uploaded: false },
      job,
    };
  }
}
