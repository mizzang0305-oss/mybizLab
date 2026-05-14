import { DEFAULT_PUBLIC_BASE_URL, safeImageUrl, sanitizeSeoText } from './seo';
import { readPublicEnv } from './publicEnv';
import type { StoreReviewStatus } from '../types/models';

export type KakaoShareSourceType = 'blog_list' | 'blog_post' | 'review' | 'store';
export type KakaoShareEventStatus = 'failed' | 'share_started';
export type KakaoShareReadinessStatus = 'disabled' | 'ready';
export type KakaoShareBlockReason = 'internal_url' | 'invalid_url' | 'review_not_published' | 'token_url';

export interface KakaoShareEnv {
  KAKAO_JAVASCRIPT_KEY?: string;
  KAKAO_SHARE_ENABLED?: string;
  KAKAO_TEMPLATE_ID?: string;
  VITE_KAKAO_JAVASCRIPT_KEY?: string;
  VITE_KAKAO_SHARE_ENABLED?: string;
  VITE_KAKAO_TEMPLATE_ID?: string;
}

export interface KakaoShareReadiness {
  javascriptKey?: string;
  missingEnvNames: string[];
  optionalEnvNames: string[];
  ready: boolean;
  status: KakaoShareReadinessStatus;
}

export interface KakaoShareInput {
  description?: string;
  imageUrl?: string;
  reviewStatus?: StoreReviewStatus;
  sourceId?: string;
  sourceType: KakaoShareSourceType;
  title: string;
  webUrl: string;
}

export interface KakaoSharePayload {
  buttons: Array<{
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
    title: string;
  }>;
  content: {
    description: string;
    imageUrl?: string;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
    title: string;
  };
  objectType: 'feed';
}

export type KakaoSharePayloadResult =
  | {
      payload: KakaoSharePayload;
      reasonCode?: undefined;
      shareable: true;
      webUrl: string;
    }
  | {
      message: string;
      payload?: undefined;
      reasonCode: KakaoShareBlockReason;
      shareable: false;
      webUrl?: undefined;
    };

export interface KakaoShareEvent {
  clickedAt: string;
  errorMessage?: string;
  provider: 'kakao_share';
  sourceId?: string;
  sourceType: KakaoShareSourceType;
  status: KakaoShareEventStatus;
}

type ParsedShareUrlResult =
  | {
      parsed: URL;
      reasonCode?: undefined;
    }
  | {
      parsed?: undefined;
      reasonCode: Extract<KakaoShareBlockReason, 'invalid_url'>;
    };

type SanitizedShareUrlResult =
  | {
      ok: true;
      webUrl: string;
    }
  | {
      ok: false;
      reasonCode: KakaoShareBlockReason;
    };

const KAKAO_SDK_URL = 'https://developers.kakao.com/sdk/js/kakao.min.js';
const REQUIRED_ENV_NAMES = ['KAKAO_JAVASCRIPT_KEY', 'KAKAO_SHARE_ENABLED'] as const;
const OPTIONAL_ENV_NAMES = ['KAKAO_TEMPLATE_ID'] as const;
const INTERNAL_PATH_PREFIXES = [
  '/admin',
  '/admin-login',
  '/api',
  '/dashboard',
  '/demo/dashboard',
  '/login',
  '/onboarding',
];
const shareEvents: KakaoShareEvent[] = [];

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function normalizeFlag(value: unknown) {
  return normalizeText(value).toLowerCase() === 'true';
}

function readDefaultKakaoEnv(): KakaoShareEnv {
  return {
    KAKAO_JAVASCRIPT_KEY: readPublicEnv(['VITE_KAKAO_JAVASCRIPT_KEY', 'KAKAO_JAVASCRIPT_KEY']),
    KAKAO_SHARE_ENABLED: readPublicEnv(['VITE_KAKAO_SHARE_ENABLED', 'KAKAO_SHARE_ENABLED']),
    KAKAO_TEMPLATE_ID: readPublicEnv(['VITE_KAKAO_TEMPLATE_ID', 'KAKAO_TEMPLATE_ID']),
  };
}

function resolveEnvValue(env: KakaoShareEnv, safeName: keyof KakaoShareEnv, viteName: keyof KakaoShareEnv) {
  return normalizeText(env[safeName]) || normalizeText(env[viteName]);
}

export function getKakaoShareReadiness(env: KakaoShareEnv = readDefaultKakaoEnv()): KakaoShareReadiness {
  const javascriptKey = resolveEnvValue(env, 'KAKAO_JAVASCRIPT_KEY', 'VITE_KAKAO_JAVASCRIPT_KEY');
  const enabled = normalizeFlag(resolveEnvValue(env, 'KAKAO_SHARE_ENABLED', 'VITE_KAKAO_SHARE_ENABLED'));
  const missingEnvNames = [
    !javascriptKey ? REQUIRED_ENV_NAMES[0] : '',
    !enabled ? REQUIRED_ENV_NAMES[1] : '',
  ].filter(Boolean);
  const ready = missingEnvNames.length === 0;

  return {
    javascriptKey: ready ? javascriptKey : undefined,
    missingEnvNames,
    optionalEnvNames: [...OPTIONAL_ENV_NAMES],
    ready,
    status: ready ? 'ready' : 'disabled',
  };
}

function parseShareUrl(value: string): ParsedShareUrlResult {
  try {
    const parsed = new URL(value, DEFAULT_PUBLIC_BASE_URL);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { reasonCode: 'invalid_url' as const };
    }

    return { parsed };
  } catch {
    return { reasonCode: 'invalid_url' as const };
  }
}

function sanitizeShareUrl(value: string, sourceType: KakaoShareSourceType): SanitizedShareUrlResult {
  const parsedResult = parseShareUrl(value);
  if (!parsedResult.parsed) {
    return {
      ok: false,
      reasonCode: parsedResult.reasonCode,
    };
  }

  const parsed = parsedResult.parsed;
  const pathname = parsed.pathname.toLowerCase();
  if (INTERNAL_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return {
      ok: false,
      reasonCode: 'internal_url',
    };
  }

  if (sourceType === 'review' && parsed.searchParams.has('r')) {
    return {
      ok: false,
      reasonCode: 'token_url',
    };
  }

  if (parsed.searchParams.has('public_token')) {
    return {
      ok: false,
      reasonCode: 'token_url',
    };
  }

  parsed.search = '';
  return {
    ok: true,
    webUrl: parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '/' : ''),
  };
}

function getBlockMessage(reasonCode: KakaoShareBlockReason) {
  if (reasonCode === 'internal_url') {
    return '관리자, 대시보드, 로그인 같은 내부 URL은 카카오 공유에 사용할 수 없습니다.';
  }

  if (reasonCode === 'token_url') {
    return '리뷰 요청 토큰이 포함된 URL은 카카오 공유에 사용할 수 없습니다.';
  }

  if (reasonCode === 'review_not_published') {
    return '공개 승인된 리뷰만 카카오 공유에 사용할 수 있습니다.';
  }

  return '공유 URL을 안전하게 확인할 수 없습니다.';
}

export function buildKakaoSharePayload(input: KakaoShareInput): KakaoSharePayloadResult {
  if (input.sourceType === 'review' && input.reviewStatus !== 'published') {
    return {
      message: getBlockMessage('review_not_published'),
      reasonCode: 'review_not_published',
      shareable: false,
    };
  }

  const urlResult = sanitizeShareUrl(input.webUrl, input.sourceType);
  if (!urlResult.ok) {
    return {
      message: getBlockMessage(urlResult.reasonCode),
      reasonCode: urlResult.reasonCode,
      shareable: false,
    };
  }

  const title = sanitizeSeoText(input.title, 'MyBiz 매장', 80);
  const description = sanitizeSeoText(input.description, 'MyBiz에서 공개된 매장 콘텐츠입니다.', 120);
  const imageUrl = safeImageUrl(input.imageUrl);
  const link = {
    mobileWebUrl: urlResult.webUrl,
    webUrl: urlResult.webUrl,
  };

  return {
    payload: {
      buttons: [
        {
          link,
          title: '자세히 보기',
        },
      ],
      content: {
        description,
        ...(imageUrl ? { imageUrl } : {}),
        link,
        title,
      },
      objectType: 'feed',
    },
    shareable: true,
    webUrl: urlResult.webUrl,
  };
}

export function recordKakaoShareEvent(input: {
  errorMessage?: string;
  sourceId?: string;
  sourceType: KakaoShareSourceType;
  status: KakaoShareEventStatus;
}) {
  const event: KakaoShareEvent = {
    clickedAt: new Date().toISOString(),
    errorMessage: input.status === 'failed' ? sanitizeSeoText(input.errorMessage, 'Kakao SDK share failed.', 120) : undefined,
    provider: 'kakao_share',
    sourceId: normalizeText(input.sourceId) || undefined,
    sourceType: input.sourceType,
    status: input.status,
  };
  shareEvents.push(event);
  return event;
}

export function listKakaoShareEvents() {
  return shareEvents.slice();
}

export function resetKakaoShareEvents() {
  shareEvents.length = 0;
}

export function getKakaoSdkUrl() {
  return KAKAO_SDK_URL;
}
