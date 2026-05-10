import type { StoreMediaAsset } from '../../types/models.js';

export const STT_REQUIRED_ENV_NAMES = [
  'STT_PROVIDER',
  'STT_ENABLED',
  'OPENAI_API_KEY',
  'STT_MAX_DURATION_SECONDS',
  'STT_ALLOWED_MIME_TYPES',
] as const;

export type SttEnv = Partial<Record<(typeof STT_REQUIRED_ENV_NAMES)[number] | 'NODE_ENV' | 'VITEST' | string, string | undefined>>;
export type SttProviderName = 'disabled' | 'mock' | 'openai';

export interface SttTranscriptSegment {
  endSeconds: number;
  startSeconds: number;
  text: string;
}

export interface SttTranscriptDraft {
  provider: SttProviderName;
  segments?: SttTranscriptSegment[];
  text: string;
}

export type SttProviderAdapter = (
  asset: StoreMediaAsset,
  options: { env: SttEnv; readiness: SttReadiness },
) => Promise<SttTranscriptDraft> | SttTranscriptDraft;

export interface SttReadiness {
  allowedMimeTypes: string[];
  enabled: boolean;
  maxDurationSeconds: number;
  message: string;
  missingEnvNames: string[];
  provider: SttProviderName;
  ready: boolean;
  requiredEnvNames: string[];
}

export interface TranscribeMediaAssetOptions {
  env?: SttEnv;
  providerAdapter?: SttProviderAdapter;
}

export type TranscribeMediaAssetResult =
  | {
      message: string;
      ok: false;
      readiness: SttReadiness;
    }
  | {
      message: string;
      ok: true;
      readiness: SttReadiness;
      transcript: SttTranscriptDraft;
    };

const DISABLED_MESSAGE = '영상 자막 초안은 음성 분석 설정이 완료되면 생성할 수 있습니다.';
const DEFAULT_ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'video/mp4', 'video/quicktime'];
const DEFAULT_MAX_DURATION_SECONDS = 600;

function readProcessEnv(): SttEnv {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }

  return process.env;
}

function normalizeEnvFlag(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasEnvValue(env: SttEnv, name: string) {
  return Boolean(normalizeText(env[name]));
}

function parseProvider(value: unknown): SttProviderName {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'openai' || normalized === 'mock') {
    return normalized;
  }

  return 'disabled';
}

function parseMaxDuration(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_DURATION_SECONDS;
}

function parseAllowedMimeTypes(value: unknown) {
  const configured = normalizeText(value)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_MIME_TYPES;
}

function isTestRuntime(env: SttEnv) {
  return env.NODE_ENV === 'test' || env.VITEST === 'true' || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

export function getSttReadiness(env: SttEnv = readProcessEnv()): SttReadiness {
  const enabled = normalizeEnvFlag(env.STT_ENABLED);
  const provider = enabled ? parseProvider(env.STT_PROVIDER) : 'disabled';
  const maxDurationSeconds = parseMaxDuration(env.STT_MAX_DURATION_SECONDS);
  const allowedMimeTypes = parseAllowedMimeTypes(env.STT_ALLOWED_MIME_TYPES);
  const missingEnvNames: string[] = [];

  if (!enabled) {
    missingEnvNames.push('STT_ENABLED');
  }

  if (!normalizeText(env.STT_PROVIDER) || provider === 'disabled') {
    missingEnvNames.push('STT_PROVIDER');
  }

  if (provider === 'openai' && !hasEnvValue(env, 'OPENAI_API_KEY')) {
    missingEnvNames.push('OPENAI_API_KEY');
  }

  if (provider === 'mock' && !isTestRuntime(env)) {
    missingEnvNames.push('STT_PROVIDER');
  }

  const ready = enabled && provider !== 'disabled' && missingEnvNames.length === 0;

  return {
    allowedMimeTypes,
    enabled,
    maxDurationSeconds,
    message: ready ? '음성 분석 provider가 준비되었습니다.' : DISABLED_MESSAGE,
    missingEnvNames: [...new Set(missingEnvNames)],
    provider,
    ready,
    requiredEnvNames: [...STT_REQUIRED_ENV_NAMES],
  };
}

function assertSafeAssetUrl(asset: StoreMediaAsset) {
  try {
    const parsed = new URL(asset.url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new Error('Media asset URL must use a safe http/https URL before STT can run.');
  }
}

function assertTranscribableAsset(asset: StoreMediaAsset, readiness: SttReadiness) {
  if (asset.asset_type !== 'video') {
    throw new Error('Only video media assets can be transcribed.');
  }

  if (asset.duration_seconds && asset.duration_seconds > readiness.maxDurationSeconds) {
    throw new Error('Media asset duration exceeds the configured STT duration limit.');
  }

  assertSafeAssetUrl(asset);

  if (!asset.storage_path?.trim()) {
    throw new Error('An uploaded file storage_path is required for STT. External URL assets are not server-fetched.');
  }
}

export function transcribeMediaAsset(
  asset: StoreMediaAsset,
  options: TranscribeMediaAssetOptions = {},
): Promise<TranscribeMediaAssetResult> {
  const readiness = getSttReadiness(options.env);
  assertSafeAssetUrl(asset);

  if (!readiness.ready) {
    return Promise.resolve({
      message: readiness.message,
      ok: false,
      readiness,
    });
  }

  assertTranscribableAsset(asset, readiness);

  if (!options.providerAdapter) {
    return Promise.resolve({
      message: 'STT provider 연결은 다음 배포에서 활성화됩니다.',
      ok: false,
      readiness,
    });
  }

  return Promise.resolve(options.providerAdapter(asset, { env: options.env || {}, readiness })).then((transcript) => ({
    message: '음성 분석 초안이 생성되었습니다.',
    ok: true,
    readiness,
    transcript: normalizeTranscript(transcript, readiness.provider),
  }));
}

function normalizeTranscript(transcript: SttTranscriptDraft, provider: SttProviderName): SttTranscriptDraft {
  const text = normalizeText(transcript.text);
  if (!text) {
    throw new Error('STT provider returned an empty transcript.');
  }

  const segments = (transcript.segments || [])
    .map((segment) => ({
      endSeconds: Number(segment.endSeconds),
      startSeconds: Number(segment.startSeconds),
      text: normalizeText(segment.text),
    }))
    .filter(
      (segment) =>
        segment.text &&
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.endSeconds > segment.startSeconds,
    );

  return {
    provider: transcript.provider || provider,
    segments: segments.length ? segments : undefined,
    text,
  };
}

function formatTimestamp(seconds: number, separator: ',' | '.') {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const millis = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)}${separator}${pad(millis, 3)}`;
}

export function generateCaptionFiles(transcript: SttTranscriptDraft) {
  const segments = transcript.segments?.filter((segment) => segment.text.trim()) || [];
  if (!segments.length) {
    return {
      srt: undefined,
      vtt: undefined,
    };
  }

  const srt = segments
    .map(
      (segment, index) =>
        `${index + 1}\n${formatTimestamp(segment.startSeconds, ',')} --> ${formatTimestamp(segment.endSeconds, ',')}\n${segment.text.trim()}`,
    )
    .join('\n\n');
  const vtt = `WEBVTT\n\n${segments
    .map(
      (segment) =>
        `${formatTimestamp(segment.startSeconds, '.')} --> ${formatTimestamp(segment.endSeconds, '.')}\n${segment.text.trim()}`,
    )
    .join('\n\n')}`;

  return {
    srt,
    vtt,
  };
}

function sanitizeTranscriptExcerpt(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function generateMediaContentDraft(transcript: SttTranscriptDraft, asset: StoreMediaAsset) {
  const excerpt = sanitizeTranscriptExcerpt(transcript.text);
  const baseTitle = asset.alt_text?.trim() || '매장 영상';

  return {
    aiDescription: excerpt
      ? `초안: 전사된 영상 내용을 바탕으로 매장 소식을 정리합니다. ${excerpt}`
      : '초안: 전사된 영상 내용을 바탕으로 매장 소식을 정리합니다.',
    aiHashtags: ['MyBiz', '영상콘텐츠', '매장소식'],
    aiTitle: `초안: ${baseTitle}`,
  };
}

export const STT_DISABLED_MESSAGE = DISABLED_MESSAGE;
