import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '../../../integrations/supabase/client.js';
import { DATA_PROVIDER, IS_LIVE_RUNTIME } from '../appConfig.js';
import { createId } from '../ids.js';
import { getDatabase, updateDatabase } from '../mockDb.js';
import { PAYMENT_TEST_100_PRODUCT } from '../platformAdminConfig.js';
import { requestPublicApi } from '../publicApiClient.js';
import { normalizeStoreSlug } from '../storeSlug.js';
import {
  generateCaptionFiles as generateSttCaptionFiles,
  generateMediaContentDraft,
  getSttReadiness,
  transcribeMediaAsset,
  type SttEnv,
  type SttProviderAdapter,
} from './sttProvider.js';
import {
  EXTERNAL_SOCIAL_PROVIDER_ENV,
  getExternalSocialProviderReadiness,
  isExternalFoundationProvider,
  type ExternalSocialEnv,
  type ExternalSocialProviderStatus,
} from './externalSocialProvider.js';
import { getYouTubeProviderReadiness, type YouTubeEnv } from './youtubeProvider.js';
import type {
  SocialAccount,
  SocialAccountStatus,
  SocialProvider,
  SocialPublishJob,
  SocialPublishJobStatus,
  SocialPublishProvider,
  SocialPublishSourceType,
  PublicStoreReview,
  ReviewRequestLink,
  ReviewRequestLinkSourceType,
  StoreBlogPost,
  StoreBlogPostSourceType,
  StoreBlogPostStatus,
  StoreMediaAsset,
  StoreMediaAssetStatus,
  StoreMediaAssetType,
  StoreReview,
  StoreReviewStatus,
} from '../../types/models.js';

type ContentServiceOptions = {
  actorProfileId?: string;
  client?: SupabaseClient;
  env?: YouTubeEnv & SttEnv & ExternalSocialEnv;
  sttProviderAdapter?: SttProviderAdapter;
};

type ApproveSocialPublishOptions = ContentServiceOptions & {
  publishAdapter?: (job: SocialPublishJob) => Promise<{
    providerPostId?: string;
    providerUrl?: string;
  }>;
};

export interface SubmitPublicStoreReviewInput {
  body: string;
  contentUsageConsent?: boolean;
  customerId?: string;
  honeypot?: string;
  marketingConsent?: boolean;
  mediaUrl?: string;
  mediaUrls?: string[];
  orderId?: string;
  rating: number;
  reservationId?: string;
  reviewRequestToken?: string;
  reviewerDisplayName?: string;
  source?: ReviewRequestLinkSourceType;
  storeId: string;
  storeSlug?: string;
  title?: string;
  waitingId?: string;
}

export interface CreateReviewRequestLinkInput {
  baseUrl?: string;
  disabledAt?: string;
  expiresAt?: string;
  maxUses?: number;
  sourceId?: string;
  sourceType: ReviewRequestLinkSourceType;
}

export interface CreateStoreBlogPostInput {
  body: string;
  coverImageUrl?: string;
  excerpt?: string;
  mediaUrls?: string[];
  seoDescription?: string;
  seoTitle?: string;
  slug?: string;
  sourceReviewId?: string;
  sourceType: StoreBlogPostSourceType;
  status?: StoreBlogPostStatus;
  tags?: string[];
  title: string;
}

export interface CreateStoreMediaAssetInput {
  aiDescription?: string;
  aiHashtags?: string[];
  aiTitle?: string;
  altText?: string;
  assetType: StoreMediaAssetType;
  captionsSrt?: string;
  captionsVtt?: string;
  durationSeconds?: number;
  status?: StoreMediaAssetStatus;
  storagePath?: string;
  thumbnailUrl?: string;
  transcript?: string;
  url: string;
}

export interface CreateSocialPublishJobInput {
  caption?: string;
  hashtags?: string[];
  provider: SocialPublishProvider;
  sourceId?: string;
  sourceType: SocialPublishSourceType;
  status?: SocialPublishJobStatus;
}

export interface CreateYouTubeUploadJobInput {
  description?: string;
  hashtags?: string[];
  sourceId?: string;
  sourceType: SocialPublishSourceType;
  status?: Extract<SocialPublishJobStatus, 'draft' | 'waiting_approval'>;
  title: string;
}

export interface TranscribeStoreMediaAssetResult {
  asset: StoreMediaAsset;
  message: string;
  updated: boolean;
}

export interface SocialProviderCard {
  copy: string;
  displayName?: string;
  missingEnvNames?: string[];
  provider: SocialProvider;
  providerAccountId?: string;
  requiredScopes?: string[];
  status: SocialAccountStatus | ExternalSocialProviderStatus;
  tokenExpiresAt?: string;
  tokenExpiringSoon?: boolean;
  title: string;
}

export type ContentReadinessProviderKey = SocialProvider | 'stt' | 'payment_test_100';
export type ContentReadinessProviderStatus =
  | 'connected'
  | 'disabled'
  | 'error'
  | 'expired'
  | 'missing_config'
  | 'not_connected'
  | 'ready'
  | 'revoked';
export type ContentReadinessConsentStatus = 'granted' | 'missing' | 'not_required' | 'unknown';
export type ContentReadinessApprovalStatus = 'approved' | 'approval_missing' | 'waiting_approval';
export type ContentReadinessBlockReason =
  | 'approval_missing'
  | 'content_usage_consent_missing'
  | 'customer_impersonation_copy_detected'
  | 'failed'
  | 'missing_env'
  | 'provider_disabled'
  | 'token_not_connected'
  | 'unsafe_copy_detected';

export interface ContentReadinessStats {
  blogDraftCount: number;
  blogPublishedCount: number;
  captionReadyAssetCount: number;
  consentBlockedJobCount: number;
  mediaAssetCount: number;
  pendingReviewCount: number;
  publishedReviewCount: number;
  reviewRequestLinkCount: number;
  socialDraftCount: number;
  socialFailedCount: number;
  socialWaitingApprovalCount: number;
  transcriptReadyAssetCount: number;
}

export interface ContentReadinessProviderCard {
  copy: string;
  displayName?: string;
  missingEnvNames: string[];
  nextAction: string;
  provider: ContentReadinessProviderKey;
  providerAccountId?: string;
  requiredScopes: string[];
  status: ContentReadinessProviderStatus;
  title: string;
  tokenExpiresAt?: string;
  tokenExpiringSoon?: boolean;
}

export interface ContentReadinessApprovalQueueItem {
  approvalStatus: ContentReadinessApprovalStatus;
  consentStatus: ContentReadinessConsentStatus;
  createdAt: string;
  jobId: string;
  nextAction: string;
  provider: SocialPublishProvider;
  sourceTitle: string;
  sourceType: SocialPublishSourceType;
  status: SocialPublishJobStatus;
}

export interface ContentReadinessBlockedQueueItem {
  createdAt: string;
  jobId?: string;
  provider?: SocialPublishProvider | ContentReadinessProviderKey;
  reason: string;
  reasonCode: ContentReadinessBlockReason;
  sourceTitle: string;
  sourceType?: SocialPublishSourceType | 'provider' | 'review';
}

export interface ContentReadinessDashboard {
  approvalQueue: ContentReadinessApprovalQueueItem[];
  blockedQueue: ContentReadinessBlockedQueueItem[];
  providerCards: ContentReadinessProviderCard[];
  safetyCopy: {
    externalPosting: string;
    reviewPolicy: string;
  };
  stats: ContentReadinessStats;
}

const REVIEW_STATUSES: StoreReviewStatus[] = ['pending', 'published', 'hidden', 'reported'];
const REVIEW_REQUEST_SOURCE_TYPES: ReviewRequestLinkSourceType[] = ['store', 'order', 'reservation', 'waiting', 'customer'];
const BLOG_STATUSES: StoreBlogPostStatus[] = ['draft', 'scheduled', 'published', 'archived'];
const MEDIA_ASSET_TYPES: StoreMediaAssetType[] = ['image', 'video'];
const MEDIA_ASSET_STATUSES: StoreMediaAssetStatus[] = ['draft', 'ready', 'published', 'archived'];
const SOCIAL_PROVIDERS: SocialProvider[] = ['youtube', 'tiktok', 'threads', 'naver_blog', 'kakao_share'];
const SOCIAL_PUBLISH_PROVIDERS: SocialPublishProvider[] = [...SOCIAL_PROVIDERS, 'mybiz_blog'];
const SOCIAL_SOURCE_TYPES: SocialPublishSourceType[] = ['review', 'blog_post', 'media', 'manual'];
const SOCIAL_JOB_STATUSES: SocialPublishJobStatus[] = [
  'draft',
  'waiting_approval',
  'queued',
  'publishing',
  'published',
  'failed',
  'canceled',
];
const PUBLIC_REVIEW_COLUMNS = 'review_id,rating,title,body,media_urls,reviewer_display_name,created_at';
const PUBLIC_BLOG_POST_COLUMNS =
  'post_id,store_id,title,slug,excerpt,body,cover_image_url,media_urls,status,published_at,seo_title,seo_description,tags,created_at,updated_at';
const SOCIAL_ACCOUNT_SAFE_COLUMNS =
  'account_id,store_id,provider,provider_account_id,display_name,oauth_status,token_expires_at,scopes,created_at,updated_at';

const PROVIDER_COPY: Record<SocialProvider, { copy: string; title: string }> = {
  kakao_share: {
    copy: EXTERNAL_SOCIAL_PROVIDER_ENV.kakao_share.message,
    title: 'Kakao',
  },
  naver_blog: {
    copy: EXTERNAL_SOCIAL_PROVIDER_ENV.naver_blog.message,
    title: 'Naver Blog',
  },
  threads: {
    copy: EXTERNAL_SOCIAL_PROVIDER_ENV.threads.message,
    title: 'Threads',
  },
  tiktok: {
    copy: 'TikTok 게시 기능은 계정 연동과 플랫폼 심사 후 사용할 수 있습니다.',
    title: 'TikTok',
  },
  youtube: {
    copy: 'YouTube 영상 업로드와 자막 등록은 계정 연동과 업로드 설정 완료 후 사용할 수 있습니다.',
    title: 'YouTube',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function isSupabaseContentEnabled(options?: ContentServiceOptions) {
  return Boolean(options?.client) || (DATA_PROVIDER === 'supabase' && Boolean(supabase));
}

function getContentClient(options?: ContentServiceOptions) {
  return options?.client || supabase;
}

function assertEnumValue<TValue extends string>(value: TValue, values: readonly TValue[], label: string) {
  if (!values.includes(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function assertStoreExists(storeId: string) {
  if (!getDatabase().stores.some((store) => store.id === storeId)) {
    throw new Error('Store not found.');
  }
}

function assertStoreSlugMatches(storeId: string, storeSlug?: string) {
  const normalizedSlug = normalizeStoreSlug(normalizeText(storeSlug));
  if (!normalizedSlug) {
    return;
  }

  const store = getDatabase().stores.find((candidate) => candidate.id === storeId);
  if (!store || normalizeStoreSlug(store.slug) !== normalizedSlug) {
    throw new Error('Store slug does not match store id.');
  }
}

function assertDemoStoreMember(storeId: string, actorProfileId?: string) {
  if (!actorProfileId) {
    return;
  }

  const database = getDatabase();
  const hasMembership = database.store_members.some(
    (member) => member.store_id === storeId && member.profile_id === actorProfileId,
  );

  if (!hasMembership) {
    throw new Error('A store member is required to manage this content.');
  }
}

function normalizeReviewBody(body: string) {
  const normalized = body.trim().replace(/\s+/g, ' ');

  if (normalized.length < 5 || normalized.length > 2000) {
    throw new Error('Review body must be between 5 and 2000 characters.');
  }

  const compact = normalized.replace(/\s/g, '');
  const uniqueCharacters = new Set([...compact]);
  const hasReadableCharacter = /[\p{Script=Hangul}\p{L}\p{N}]/u.test(compact);

  if (!hasReadableCharacter || (compact.length >= 8 && uniqueCharacters.size <= 2)) {
    throw new Error('Review body looks corrupted.');
  }

  return normalized;
}

function normalizeSafeHttpUrl(value: unknown, label: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${label} URL is required.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label} URL must be a valid http or https URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} URL must use http or https.`);
  }

  return parsed.toString();
}

function normalizeOptionalSafeHttpUrl(value: unknown, label: string) {
  const normalized = normalizeText(value);
  return normalized ? normalizeSafeHttpUrl(normalized, label) : undefined;
}

function normalizeSafeHttpUrls(values: unknown[], label: string, limit = 5) {
  const urls: string[] = [];
  for (const value of values) {
    const normalized = normalizeOptionalSafeHttpUrl(value, label);
    if (normalized) {
      urls.push(normalized);
    }

    if (urls.length >= limit) {
      break;
    }
  }

  return urls;
}

function normalizeReviewInput(input: SubmitPublicStoreReviewInput) {
  if (normalizeText(input.honeypot)) {
    throw new Error('Review spam check failed.');
  }

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('Review rating must be between 1 and 5.');
  }

  const body = normalizeReviewBody(input.body);
  const mediaUrls = normalizeSafeHttpUrls(
    [...(input.mediaUrls || []), ...(input.mediaUrl ? [input.mediaUrl] : [])],
    'Review media',
  );

  return {
    body,
    mediaUrls,
    title: toOptionalText(input.title)?.slice(0, 120),
  };
}

function mapReviewRow(row: Record<string, unknown>): StoreReview {
  return {
    review_id: normalizeText(row.review_id || row.id),
    store_id: normalizeText(row.store_id),
    customer_id: toOptionalText(row.customer_id),
    order_id: toOptionalText(row.order_id),
    reservation_id: toOptionalText(row.reservation_id),
    rating: Number(row.rating) || 0,
    title: toOptionalText(row.title),
    body: normalizeText(row.body),
    media_urls: toStringArray(row.media_urls),
    reviewer_display_name: toOptionalText(row.reviewer_display_name),
    marketing_consent: row.marketing_consent === true,
    content_usage_consent: row.content_usage_consent === true,
    visibility_status: REVIEW_STATUSES.includes(row.visibility_status as StoreReviewStatus)
      ? (row.visibility_status as StoreReviewStatus)
      : 'pending',
    sentiment: toOptionalText(row.sentiment),
    keywords: toStringArray(row.keywords),
    ai_summary: toOptionalText(row.ai_summary),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

export function toPublicStoreReviewDto(review: StoreReview | Record<string, unknown>): PublicStoreReview {
  const row = review as Record<string, unknown>;

  return {
    review_id: normalizeText(row.review_id || row.id),
    rating: Number(row.rating) || 0,
    title: toOptionalText(row.title),
    body: normalizeText(row.body),
    media_urls: normalizeSafePublicMediaUrls(row.media_urls),
    reviewer_display_name: toOptionalText(row.reviewer_display_name),
    created_at: normalizeText(row.created_at) || nowIso(),
  };
}

function normalizeSafePublicMediaUrls(value: unknown) {
  return toStringArray(value).filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function mapReviewRequestLinkRow(row: Record<string, unknown>): ReviewRequestLink {
  const sourceType = normalizeText(row.source_type) as ReviewRequestLinkSourceType;
  const maxUses = row.max_uses === null || row.max_uses === undefined ? undefined : Number(row.max_uses);

  return {
    link_id: normalizeText(row.link_id || row.id),
    store_id: normalizeText(row.store_id),
    created_by: toOptionalText(row.created_by),
    source_type: REVIEW_REQUEST_SOURCE_TYPES.includes(sourceType) ? sourceType : 'store',
    source_id: toOptionalText(row.source_id),
    public_token: toOptionalText(row.public_token),
    expires_at: toOptionalText(row.expires_at),
    disabled_at: toOptionalText(row.disabled_at),
    max_uses: Number.isFinite(maxUses) && maxUses ? maxUses : undefined,
    url: normalizeText(row.url),
    usage_count: Number(row.usage_count) || 0,
    submission_count: Number(row.submission_count) || 0,
    last_used_at: toOptionalText(row.last_used_at),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function mapBlogPostRow(row: Record<string, unknown>): StoreBlogPost {
  return {
    post_id: normalizeText(row.post_id || row.id),
    store_id: normalizeText(row.store_id),
    author_profile_id: toOptionalText(row.author_profile_id),
    source_type: normalizeText(row.source_type) as StoreBlogPostSourceType,
    source_review_id: toOptionalText(row.source_review_id),
    title: normalizeText(row.title),
    slug: normalizeStoreSlug(normalizeText(row.slug)),
    excerpt: toOptionalText(row.excerpt),
    body: normalizeText(row.body),
    cover_image_url: toOptionalText(row.cover_image_url),
    media_urls: toStringArray(row.media_urls),
    status: BLOG_STATUSES.includes(row.status as StoreBlogPostStatus) ? (row.status as StoreBlogPostStatus) : 'draft',
    published_at: toOptionalText(row.published_at),
    seo_title: toOptionalText(row.seo_title),
    seo_description: toOptionalText(row.seo_description),
    tags: toStringArray(row.tags),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function mapMediaAssetRow(row: Record<string, unknown>): StoreMediaAsset {
  return {
    asset_id: normalizeText(row.asset_id || row.id),
    store_id: normalizeText(row.store_id),
    uploaded_by: toOptionalText(row.uploaded_by),
    asset_type: MEDIA_ASSET_TYPES.includes(row.asset_type as StoreMediaAssetType)
      ? (row.asset_type as StoreMediaAssetType)
      : 'image',
    url: normalizeText(row.url),
    storage_path: toOptionalText(row.storage_path),
    thumbnail_url: toOptionalText(row.thumbnail_url),
    alt_text: toOptionalText(row.alt_text),
    duration_seconds: row.duration_seconds === null || row.duration_seconds === undefined ? undefined : Number(row.duration_seconds),
    transcript: toOptionalText(row.transcript),
    captions_vtt: toOptionalText(row.captions_vtt),
    captions_srt: toOptionalText(row.captions_srt),
    ai_title: toOptionalText(row.ai_title),
    ai_description: toOptionalText(row.ai_description),
    ai_hashtags: toStringArray(row.ai_hashtags),
    status: MEDIA_ASSET_STATUSES.includes(row.status as StoreMediaAssetStatus)
      ? (row.status as StoreMediaAssetStatus)
      : 'draft',
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function mapSocialAccountRow(row: Record<string, unknown>): SocialAccount {
  return {
    account_id: normalizeText(row.account_id || row.id),
    store_id: normalizeText(row.store_id),
    provider: normalizeText(row.provider) as SocialProvider,
    provider_account_id: toOptionalText(row.provider_account_id),
    display_name: toOptionalText(row.display_name),
    oauth_status: normalizeText(row.oauth_status) as SocialAccountStatus,
    scopes: toStringArray(row.scopes),
    token_expires_at: toOptionalText(row.token_expires_at),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function isTokenExpired(expiresAt?: string, now: Date = new Date()) {
  if (!expiresAt) return false;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= now.getTime();
}

function isTokenExpiringSoon(expiresAt?: string, now: Date = new Date(), windowMs = 60 * 60 * 1000) {
  if (!expiresAt || isTokenExpired(expiresAt, now)) return false;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs - now.getTime() <= windowMs;
}

function resolveSocialAccountStatus(account?: SocialAccount) {
  if (!account) return undefined;
  if (account.oauth_status === 'connected' && isTokenExpired(account.token_expires_at)) {
    return 'expired' as const;
  }

  return account.oauth_status;
}

function mapSocialPublishJobRow(row: Record<string, unknown>): SocialPublishJob {
  return {
    job_id: normalizeText(row.job_id || row.id),
    store_id: normalizeText(row.store_id),
    provider: normalizeText(row.provider) as SocialPublishProvider,
    source_type: normalizeText(row.source_type) as SocialPublishSourceType,
    source_id: toOptionalText(row.source_id),
    caption: toOptionalText(row.caption),
    hashtags: toStringArray(row.hashtags),
    status: SOCIAL_JOB_STATUSES.includes(row.status as SocialPublishJobStatus)
      ? (row.status as SocialPublishJobStatus)
      : 'draft',
    provider_post_id: toOptionalText(row.provider_post_id),
    provider_url: toOptionalText(row.provider_url),
    error_code: toOptionalText(row.error_code),
    error_message: toOptionalText(row.error_message),
    approved_by: toOptionalText(row.approved_by),
    approved_at: toOptionalText(row.approved_at),
    published_at: toOptionalText(row.published_at),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function getExistingBlogSlugs(storeId: string) {
  return new Set(getDatabase().store_blog_posts.filter((post) => post.store_id === storeId).map((post) => post.slug));
}

async function assertSupabaseBlogSlugAvailable(storeId: string, slug: string, options?: ContentServiceOptions) {
  const client = getContentClient(options);
  if (!client) {
    return;
  }

  const { data, error } = await client
    .from('store_blog_posts')
    .select('post_id')
    .eq('store_id', storeId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate blog slug: ${error.message}`);
  }

  if (data) {
    throw new Error('Blog slug must be unique per store.');
  }
}

function assertBlogSlugAvailable(storeId: string, slug: string) {
  if (getExistingBlogSlugs(storeId).has(slug)) {
    throw new Error('Blog slug must be unique per store.');
  }
}

function buildUniqueBlogSlug(storeId: string, title: string) {
  const existing = getExistingBlogSlugs(storeId);
  const base = normalizeStoreSlug(title || 'store-post');
  let candidate = base;
  let suffix = 2;

  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function sortNewestFirst<T extends { created_at: string }>(items: T[]) {
  return items.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function getStoreById(storeId: string) {
  return getDatabase().stores.find((store) => store.id === storeId);
}

function normalizeReviewRequestBaseUrl(baseUrl?: string) {
  const normalized = normalizeText(baseUrl) || 'https://mybiz.ai.kr';

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Review request base URL must use http or https.');
    }

    return parsed.origin;
  } catch {
    throw new Error('Review request base URL must be a valid http or https URL.');
  }
}

function getReviewSourceId(sourceType: ReviewRequestLinkSourceType, sourceId?: string) {
  const normalized = normalizeText(sourceId);
  if (sourceType === 'store') {
    return undefined;
  }

  if (!normalized) {
    throw new Error('Review request source is required.');
  }

  return normalized;
}

function createReviewRequestPublicToken() {
  const randomValue =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : createId('review_request_token');

  return `rr_${randomValue.replace(/[^a-zA-Z0-9]/g, '').slice(0, 48)}`;
}

function normalizeOptionalIsoDate(value: unknown, label: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return parsed.toISOString();
}

function normalizeOptionalMaxUses(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error('Review request max uses must be a positive integer.');
  }

  return normalized;
}

export function buildReviewRequestUrl({
  baseUrl,
  publicToken,
  sourceId,
  sourceType,
  storeSlug,
}: {
  baseUrl?: string;
  publicToken?: string;
  sourceId?: string;
  sourceType: ReviewRequestLinkSourceType;
  storeSlug: string;
}) {
  assertEnumValue(sourceType, REVIEW_REQUEST_SOURCE_TYPES, 'review request source');
  const url = new URL(`/s/${encodeURIComponent(normalizeStoreSlug(storeSlug))}/review`, normalizeReviewRequestBaseUrl(baseUrl));
  const normalizedPublicToken = normalizeText(publicToken);
  if (normalizedPublicToken) {
    url.searchParams.set('r', normalizedPublicToken);
    return url.toString();
  }

  const normalizedSourceId = getReviewSourceId(sourceType, sourceId);

  if (sourceType === 'order' && normalizedSourceId) {
    url.searchParams.set('source', 'order');
    url.searchParams.set('orderId', normalizedSourceId);
  }

  if (sourceType === 'reservation' && normalizedSourceId) {
    url.searchParams.set('source', 'reservation');
    url.searchParams.set('reservationId', normalizedSourceId);
  }

  if (sourceType === 'waiting' && normalizedSourceId) {
    url.searchParams.set('source', 'waiting');
    url.searchParams.set('waitingId', normalizedSourceId);
  }

  if (sourceType === 'customer' && normalizedSourceId) {
    url.searchParams.set('source', 'customer');
    url.searchParams.set('customerId', normalizedSourceId);
  }

  return url.toString();
}

function inferReviewSourceType(input: SubmitPublicStoreReviewInput): ReviewRequestLinkSourceType {
  const explicitSource = normalizeText(input.source);
  if (explicitSource) {
    assertEnumValue(explicitSource as ReviewRequestLinkSourceType, REVIEW_REQUEST_SOURCE_TYPES, 'review request source');
    return explicitSource as ReviewRequestLinkSourceType;
  }

  if (normalizeText(input.orderId)) {
    return 'order';
  }

  if (normalizeText(input.reservationId)) {
    return 'reservation';
  }

  if (normalizeText(input.waitingId)) {
    return 'waiting';
  }

  if (normalizeText(input.customerId)) {
    return 'customer';
  }

  return 'store';
}

function getInputReviewSourceId(input: SubmitPublicStoreReviewInput, sourceType: ReviewRequestLinkSourceType) {
  switch (sourceType) {
    case 'customer':
      return normalizeText(input.customerId);
    case 'order':
      return normalizeText(input.orderId);
    case 'reservation':
      return normalizeText(input.reservationId);
    case 'waiting':
      return normalizeText(input.waitingId);
    case 'store':
      return '';
  }
}

function resolveDemoReviewSource(
  storeId: string,
  sourceType: ReviewRequestLinkSourceType,
  sourceId?: string,
): { customerId?: string; orderId?: string; reservationId?: string } {
  if (sourceType === 'store') {
    return {};
  }

  const normalizedSourceId = getReviewSourceId(sourceType, sourceId);
  const database = getDatabase();

  if (sourceType === 'order') {
    const order = database.orders.find((candidate) => candidate.id === normalizedSourceId && candidate.store_id === storeId);
    if (!order) {
      throw new Error('Review request source is invalid or outside this store.');
    }

    return { customerId: order.customer_id, orderId: order.id };
  }

  if (sourceType === 'reservation') {
    const reservation = database.reservations.find(
      (candidate) => candidate.id === normalizedSourceId && candidate.store_id === storeId,
    );
    if (!reservation) {
      throw new Error('Review request source is invalid or outside this store.');
    }

    return { customerId: reservation.customer_id, reservationId: reservation.id };
  }

  if (sourceType === 'waiting') {
    const waiting = database.waiting_entries.find(
      (candidate) => candidate.id === normalizedSourceId && candidate.store_id === storeId,
    );
    if (!waiting) {
      throw new Error('Review request source is invalid or outside this store.');
    }

    return { customerId: waiting.customer_id };
  }

  const customer = database.customers.find((candidate) => candidate.id === normalizedSourceId && candidate.store_id === storeId);
  if (!customer) {
    throw new Error('Review request source is invalid or outside this store.');
  }

  return { customerId: customer.id };
}

async function resolveSupabaseReviewSource(
  client: SupabaseClient,
  storeId: string,
  sourceType: ReviewRequestLinkSourceType,
  sourceId?: string,
) {
  if (sourceType === 'store') {
    return {};
  }

  const normalizedSourceId = getReviewSourceId(sourceType, sourceId);
  const tableBySource: Record<Exclude<ReviewRequestLinkSourceType, 'store'>, string> = {
    customer: 'customers',
    order: 'orders',
    reservation: 'reservations',
    waiting: 'waiting_entries',
  };
  const idColumnsBySource: Record<Exclude<ReviewRequestLinkSourceType, 'store'>, string[]> = {
    customer: ['id', 'customer_id'],
    order: ['id', 'order_id'],
    reservation: ['id', 'reservation_id'],
    waiting: ['id', 'waiting_id'],
  };
  const table = tableBySource[sourceType];
  let lastError: { message?: string } | null = null;
  let data: Record<string, unknown> | null = null;
  let sawSuccessfulQuery = false;

  for (const idColumn of idColumnsBySource[sourceType]) {
    const { data: candidate, error } = await client
      .from(table)
      .select(`${idColumn},customer_id,store_id`)
      .eq('store_id', storeId)
      .eq(idColumn, normalizedSourceId)
      .maybeSingle();

    if (error) {
      lastError = error;
      continue;
    }

    sawSuccessfulQuery = true;
    data = (candidate as Record<string, unknown> | null) || null;
    if (data) {
      break;
    }
  }

  if (!data) {
    if (!sawSuccessfulQuery && lastError) {
      throw new Error(`Failed to validate review request source: ${lastError.message}`);
    }

    throw new Error('Review request source is invalid or outside this store.');
  }

  return {
    customerId: sourceType === 'customer' ? normalizedSourceId : toOptionalText(data.customer_id),
    orderId: sourceType === 'order' ? normalizedSourceId : undefined,
    reservationId: sourceType === 'reservation' ? normalizedSourceId : undefined,
  };
}

type ResolvedReviewSource = {
  customerId?: string;
  orderId?: string;
  requestLinkId?: string;
  requestLinkSubmissionCount?: number;
  requestLinkUsageCount?: number;
  reservationId?: string;
};

function assertReviewRequestLinkUsable(link: ReviewRequestLink) {
  if (link.disabled_at) {
    throw new Error('Review request token is disabled.');
  }

  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) {
    throw new Error('Review request token is expired.');
  }

  if (link.max_uses && link.usage_count >= link.max_uses) {
    throw new Error('Review request token usage limit has been reached.');
  }
}

function resolveDemoReviewRequestToken(input: SubmitPublicStoreReviewInput): ResolvedReviewSource | null {
  const token = normalizeText(input.reviewRequestToken);
  if (!token) {
    return null;
  }

  const link = getDatabase().review_request_links.find((candidate) => candidate.public_token === token);
  if (!link) {
    throw new Error('Review request token is invalid.');
  }

  if (link.store_id !== input.storeId) {
    throw new Error('Review request token does not match this store.');
  }

  assertReviewRequestLinkUsable(link);
  return {
    ...resolveDemoReviewSource(link.store_id, link.source_type, link.source_id),
    requestLinkId: link.link_id,
    requestLinkSubmissionCount: link.submission_count,
    requestLinkUsageCount: link.usage_count,
  };
}

async function resolveSupabaseReviewRequestToken(
  client: SupabaseClient,
  input: SubmitPublicStoreReviewInput,
): Promise<ResolvedReviewSource | null> {
  const token = normalizeText(input.reviewRequestToken);
  if (!token) {
    return null;
  }

  const { data, error } = await client
    .from('review_request_links')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate review request token: ${error.message}`);
  }

  if (!data) {
    throw new Error('Review request token is invalid.');
  }

  const link = mapReviewRequestLinkRow(data as Record<string, unknown>);
  if (link.store_id !== input.storeId) {
    throw new Error('Review request token does not match this store.');
  }

  assertReviewRequestLinkUsable(link);
  return {
    ...(await resolveSupabaseReviewSource(client, input.storeId, link.source_type, link.source_id)),
    requestLinkId: link.link_id,
    requestLinkSubmissionCount: link.submission_count,
    requestLinkUsageCount: link.usage_count,
  };
}

async function resolveReviewSource(input: SubmitPublicStoreReviewInput, options?: ContentServiceOptions) {
  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const tokenSource = await resolveSupabaseReviewRequestToken(client, input);
    if (tokenSource) {
      return tokenSource;
    }

    const sourceType = inferReviewSourceType(input);
    const sourceId = getInputReviewSourceId(input, sourceType);
    return resolveSupabaseReviewSource(client, input.storeId, sourceType, sourceId);
  }

  const tokenSource = resolveDemoReviewRequestToken(input);
  if (tokenSource) {
    return tokenSource;
  }

  const sourceType = inferReviewSourceType(input);
  const sourceId = getInputReviewSourceId(input, sourceType);
  return resolveDemoReviewSource(input.storeId, sourceType, sourceId);
}

async function getSupabaseStoreSlug(storeId: string, options?: ContentServiceOptions) {
  const client = getContentClient(options);
  if (!client) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await client.from('stores').select('slug').eq('store_id', storeId).maybeSingle();
  if (error) {
    throw new Error(`Failed to load store slug: ${error.message}`);
  }

  const slug = normalizeStoreSlug(normalizeText((data as Record<string, unknown> | null)?.slug));
  if (!slug) {
    throw new Error('Store not found.');
  }

  return slug;
}

export async function createReviewRequestLink(
  storeId: string,
  input: CreateReviewRequestLinkInput,
  options?: ContentServiceOptions,
) {
  const sourceType = input.sourceType;
  assertEnumValue(sourceType, REVIEW_REQUEST_SOURCE_TYPES, 'review request source');
  const sourceId = getReviewSourceId(sourceType, input.sourceId);
  const publicToken = createReviewRequestPublicToken();
  const expiresAt = normalizeOptionalIsoDate(input.expiresAt, 'Review request expiration');
  const disabledAt = normalizeOptionalIsoDate(input.disabledAt, 'Review request disabled timestamp');
  const maxUses = normalizeOptionalMaxUses(input.maxUses);
  const timestamp = nowIso();

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    await resolveSupabaseReviewSource(client, storeId, sourceType, sourceId);
    const slug = await getSupabaseStoreSlug(storeId, options);
    const url = buildReviewRequestUrl({
      baseUrl: input.baseUrl,
      publicToken,
      sourceId,
      sourceType,
      storeSlug: slug,
    });
    const { data, error } = await client
      .from('review_request_links')
      .insert({
        created_by: options?.actorProfileId || null,
        disabled_at: disabledAt || null,
        expires_at: expiresAt || null,
        max_uses: maxUses || null,
        public_token: publicToken,
        source_id: sourceId || null,
        source_type: sourceType,
        store_id: storeId,
        url,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create review request link: ${error.message}`);
    }

    return mapReviewRequestLinkRow(data as Record<string, unknown>);
  }

  assertStoreExists(storeId);
  assertDemoStoreMember(storeId, options?.actorProfileId);
  resolveDemoReviewSource(storeId, sourceType, sourceId);
  const store = getStoreById(storeId);
  if (!store) {
    throw new Error('Store not found.');
  }

  const link: ReviewRequestLink = {
    link_id: createId('review_request_link'),
    store_id: storeId,
    created_by: options?.actorProfileId,
    source_type: sourceType,
    source_id: sourceId,
    public_token: publicToken,
    expires_at: expiresAt,
    disabled_at: disabledAt,
    max_uses: maxUses,
    url: buildReviewRequestUrl({
      baseUrl: input.baseUrl,
      publicToken,
      sourceId,
      sourceType,
      storeSlug: store.slug,
    }),
    usage_count: 0,
    submission_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };

  updateDatabase((database) => {
    database.review_request_links.unshift(link);
  });

  return link;
}

export async function listReviewRequestLinks(storeId: string, options?: ContentServiceOptions) {
  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('review_request_links')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list review request links: ${error.message}`);
    }

    return (data || []).map((row) => mapReviewRequestLinkRow(row as Record<string, unknown>));
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  return sortNewestFirst(getDatabase().review_request_links.filter((link) => link.store_id === storeId));
}

async function recordReviewRequestTokenUse(storeId: string, source: ResolvedReviewSource, timestamp: string, options?: ContentServiceOptions) {
  if (!source.requestLinkId) {
    return;
  }

  const nextUsageCount = (source.requestLinkUsageCount || 0) + 1;
  const nextSubmissionCount = (source.requestLinkSubmissionCount || 0) + 1;

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return;
    }

    const { error } = await client
      .from('review_request_links')
      .update({
        last_used_at: timestamp,
        submission_count: nextSubmissionCount,
        updated_at: timestamp,
        usage_count: nextUsageCount,
      })
      .eq('store_id', storeId)
      .eq('link_id', source.requestLinkId);

    if (error) {
      console.warn('[content-engine] Failed to record review request link usage.', {
        linkId: source.requestLinkId,
        storeId,
      });
    }
  }
}

function applyDemoReviewRequestTokenUse(
  database: ReturnType<typeof getDatabase>,
  storeId: string,
  source: ResolvedReviewSource,
  timestamp: string,
) {
  if (!source.requestLinkId) {
    return;
  }

  database.review_request_links = database.review_request_links.map((link) => {
    if (link.store_id !== storeId || link.link_id !== source.requestLinkId) {
      return link;
    }

    return {
      ...link,
      last_used_at: timestamp,
      submission_count: (source.requestLinkSubmissionCount || link.submission_count || 0) + 1,
      updated_at: timestamp,
      usage_count: (source.requestLinkUsageCount || link.usage_count || 0) + 1,
    };
  });
}

export async function submitPublicStoreReview(input: SubmitPublicStoreReviewInput, options?: ContentServiceOptions) {
  if (!options?.client && IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<StoreReview>('/api/public/review', {
      body: input,
      method: 'POST',
      timeoutMs: 12000,
    });
  }

  const normalized = normalizeReviewInput(input);
  const timestamp = nowIso();

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const source = await resolveReviewSource(input, options);
    const { data, error } = await client
      .from('store_reviews')
      .insert({
        body: normalized.body,
        content_usage_consent: input.contentUsageConsent === true,
        customer_id: source.customerId || null,
        keywords: [],
        marketing_consent: input.marketingConsent === true,
        media_urls: normalized.mediaUrls,
        order_id: source.orderId || null,
        rating: input.rating,
        reservation_id: source.reservationId || null,
        reviewer_display_name: normalizeText(input.reviewerDisplayName) || null,
        store_id: input.storeId,
        title: normalized.title || null,
        visibility_status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to submit review: ${error.message}`);
    }

    await recordReviewRequestTokenUse(input.storeId, source, timestamp, options);
    return mapReviewRow(data as Record<string, unknown>);
  }

  assertStoreExists(input.storeId);
  assertStoreSlugMatches(input.storeId, input.storeSlug);
  const source = await resolveReviewSource(input);
  const review: StoreReview = {
    review_id: createId('store_review'),
    store_id: input.storeId,
    customer_id: toOptionalText(source.customerId),
    order_id: toOptionalText(source.orderId),
    reservation_id: toOptionalText(source.reservationId),
    rating: input.rating,
    title: normalized.title,
    body: normalized.body,
    media_urls: normalized.mediaUrls,
    reviewer_display_name: toOptionalText(input.reviewerDisplayName),
    marketing_consent: input.marketingConsent === true,
    content_usage_consent: input.contentUsageConsent === true,
    visibility_status: 'pending',
    keywords: [],
    created_at: timestamp,
    updated_at: timestamp,
  };

  updateDatabase((database) => {
    database.store_reviews.unshift(review);
    applyDemoReviewRequestTokenUse(database, input.storeId, source, timestamp);
  });

  return review;
}

export async function listStoreReviews(
  storeId: string,
  options?: ContentServiceOptions & { status?: StoreReviewStatus },
) {
  assertEnumValue(options?.status || 'pending', REVIEW_STATUSES, 'review status');

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    let query = client.from('store_reviews').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    if (options?.status) {
      query = query.eq('visibility_status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list reviews: ${error.message}`);
    }

    return (data || []).map((row) => mapReviewRow(row as Record<string, unknown>));
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  const reviews = getDatabase().store_reviews.filter(
    (review) => review.store_id === storeId && (!options?.status || review.visibility_status === options.status),
  );
  return sortNewestFirst(reviews);
}

export async function listPublicStoreReviews(
  storeId: string,
  options?: ContentServiceOptions & { storeSlug?: string },
): Promise<PublicStoreReview[]> {
  if (!options?.client && IS_LIVE_RUNTIME && typeof window !== 'undefined' && options?.storeSlug) {
    return requestPublicApi<PublicStoreReview[]>(
      `/api/public/review?storeSlug=${encodeURIComponent(normalizeStoreSlug(options.storeSlug))}`,
      {
        method: 'GET',
        timeoutMs: 12000,
      },
    );
  }

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('store_reviews')
      .select(PUBLIC_REVIEW_COLUMNS)
      .eq('store_id', storeId)
      .eq('visibility_status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list public reviews: ${error.message}`);
    }

    return (data || []).map((row) => toPublicStoreReviewDto(row as Record<string, unknown>));
  }

  return sortNewestFirst(
    getDatabase()
      .store_reviews
      .filter((review) => review.store_id === storeId && review.visibility_status === 'published')
      .map((review) => toPublicStoreReviewDto(review)),
  );
}

export async function updateStoreReviewStatus(
  storeId: string,
  reviewId: string,
  status: StoreReviewStatus,
  options?: ContentServiceOptions,
) {
  assertEnumValue(status, REVIEW_STATUSES, 'review status');

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_reviews')
      .update({ updated_at: nowIso(), visibility_status: status })
      .eq('store_id', storeId)
      .eq('review_id', reviewId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update review status: ${error.message}`);
    }

    return mapReviewRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  let nextReview: StoreReview | null = null;
  updateDatabase((database) => {
    database.store_reviews = database.store_reviews.map((review) => {
      if (review.store_id !== storeId || review.review_id !== reviewId) {
        return review;
      }

      nextReview = {
        ...review,
        updated_at: nowIso(),
        visibility_status: status,
      };
      return nextReview;
    });
  });

  if (!nextReview) {
    throw new Error('Review not found.');
  }

  return nextReview;
}

export function generateBlogDraftFromReview(review: StoreReview) {
  const title = review.title?.trim() || '고객이 남긴 따뜻한 후기';
  const safeName = review.reviewer_display_name?.trim() || '방문 고객';

  return {
    body:
      `${safeName}의 실제 방문 후기를 바탕으로 매장의 분위기와 장점을 정리합니다.\n\n` +
      '리뷰 내용은 직접 인용하지 않고, 고객 개인정보를 노출하지 않으며, 매장 경험과 운영 강점 중심으로 소개합니다.\n\n' +
      `핵심 요약: ${review.ai_summary || review.body.slice(0, 140)}`,
    excerpt: '최근 방문 고객의 후기를 바탕으로 매장의 분위기와 장점을 소개합니다.',
    tags: ['후기', '고객경험'],
    title,
  };
}

export async function createStoreBlogPost(
  storeId: string,
  input: CreateStoreBlogPostInput,
  options?: ContentServiceOptions,
) {
  const slug = normalizeStoreSlug(input.slug || input.title);
  const timestamp = nowIso();
  const status = input.status || 'draft';
  assertEnumValue(input.sourceType, ['manual', 'review', 'ai', 'video', 'campaign'], 'blog source type');
  assertEnumValue(status, BLOG_STATUSES, 'blog status');
  const coverImageUrl = normalizeOptionalSafeHttpUrl(input.coverImageUrl, 'Blog cover image');
  const mediaUrls = normalizeSafeHttpUrls(input.mediaUrls || [], 'Blog media');

  if (isSupabaseContentEnabled(options)) {
    await assertSupabaseBlogSlugAvailable(storeId, slug, options);
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_blog_posts')
      .insert({
        author_profile_id: options?.actorProfileId || null,
        body: input.body.trim(),
        cover_image_url: coverImageUrl || null,
        excerpt: input.excerpt?.trim() || null,
        media_urls: mediaUrls,
        published_at: status === 'published' ? timestamp : null,
        seo_description: input.seoDescription?.trim() || null,
        seo_title: input.seoTitle?.trim() || null,
        slug,
        source_review_id: input.sourceReviewId || null,
        source_type: input.sourceType,
        status,
        store_id: storeId,
        tags: input.tags || [],
        title: input.title.trim(),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create blog post: ${error.message}`);
    }

    return mapBlogPostRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  assertBlogSlugAvailable(storeId, slug);
  const post: StoreBlogPost = {
    post_id: createId('store_blog_post'),
    store_id: storeId,
    author_profile_id: options?.actorProfileId,
    source_type: input.sourceType,
    source_review_id: toOptionalText(input.sourceReviewId),
    title: input.title.trim(),
    slug,
    excerpt: toOptionalText(input.excerpt),
    body: input.body.trim(),
    cover_image_url: coverImageUrl,
    media_urls: mediaUrls,
    status,
    published_at: status === 'published' ? timestamp : undefined,
    seo_title: toOptionalText(input.seoTitle),
    seo_description: toOptionalText(input.seoDescription),
    tags: input.tags || [],
    created_at: timestamp,
    updated_at: timestamp,
  };

  updateDatabase((database) => {
    database.store_blog_posts.unshift(post);
  });

  return post;
}

export async function convertReviewToBlogDraft(storeId: string, reviewId: string, options?: ContentServiceOptions) {
  const reviews = await listStoreReviews(storeId, options);
  const review = reviews.find((candidate) => candidate.review_id === reviewId);
  if (!review) {
    throw new Error('Review not found.');
  }

  if (review.visibility_status !== 'published') {
    throw new Error('Only approved published reviews can become blog drafts.');
  }

  const draft = generateBlogDraftFromReview(review);
  const slug = isSupabaseContentEnabled(options)
    ? normalizeStoreSlug(`${draft.title}-${Date.now()}`)
    : buildUniqueBlogSlug(storeId, draft.title);

  return createStoreBlogPost(
    storeId,
    {
      body: draft.body,
      excerpt: draft.excerpt,
      mediaUrls: review.media_urls,
      slug,
      sourceReviewId: review.review_id,
      sourceType: 'review',
      status: 'draft',
      tags: draft.tags,
      title: draft.title,
    },
    options,
  );
}

export async function publishStoreBlogPost(storeId: string, postId: string, options?: ContentServiceOptions) {
  const timestamp = nowIso();

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_blog_posts')
      .update({ published_at: timestamp, status: 'published', updated_at: timestamp })
      .eq('store_id', storeId)
      .eq('post_id', postId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to publish blog post: ${error.message}`);
    }

    return mapBlogPostRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  let nextPost: StoreBlogPost | null = null;
  updateDatabase((database) => {
    database.store_blog_posts = database.store_blog_posts.map((post) => {
      if (post.store_id !== storeId || post.post_id !== postId) {
        return post;
      }

      nextPost = {
        ...post,
        published_at: timestamp,
        status: 'published',
        updated_at: timestamp,
      };
      return nextPost;
    });
  });

  if (!nextPost) {
    throw new Error('Blog post not found.');
  }

  return nextPost;
}

export async function archiveStoreBlogPost(storeId: string, postId: string, options?: ContentServiceOptions) {
  const timestamp = nowIso();

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_blog_posts')
      .update({ status: 'archived', updated_at: timestamp })
      .eq('store_id', storeId)
      .eq('post_id', postId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to archive blog post: ${error.message}`);
    }

    return mapBlogPostRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  let nextPost: StoreBlogPost | null = null;
  updateDatabase((database) => {
    database.store_blog_posts = database.store_blog_posts.map((post) => {
      if (post.store_id !== storeId || post.post_id !== postId) {
        return post;
      }

      nextPost = {
        ...post,
        status: 'archived',
        updated_at: timestamp,
      };
      return nextPost;
    });
  });

  if (!nextPost) {
    throw new Error('Blog post not found.');
  }

  return nextPost;
}

export async function listStoreBlogPosts(
  storeId: string,
  options?: ContentServiceOptions & { status?: StoreBlogPostStatus },
) {
  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    let query = client.from('store_blog_posts').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list blog posts: ${error.message}`);
    }

    return (data || []).map((row) => mapBlogPostRow(row as Record<string, unknown>));
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  return sortNewestFirst(
    getDatabase().store_blog_posts.filter((post) => post.store_id === storeId && (!options?.status || post.status === options.status)),
  );
}

export async function listPublicStoreBlogPosts(storeId: string, options?: ContentServiceOptions) {
  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('store_blog_posts')
      .select(PUBLIC_BLOG_POST_COLUMNS)
      .eq('store_id', storeId)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list public blog posts: ${error.message}`);
    }

    return (data || []).map((row) => mapBlogPostRow(row as Record<string, unknown>));
  }

  return getDatabase()
    .store_blog_posts
    .filter((post) => post.store_id === storeId && post.status === 'published')
    .sort((left, right) => (right.published_at || right.created_at).localeCompare(left.published_at || left.created_at));
}

export async function getPublicStoreBlogPost(storeId: string, slug: string, options?: ContentServiceOptions) {
  const normalizedSlug = normalizeStoreSlug(slug);

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from('store_blog_posts')
      .select(PUBLIC_BLOG_POST_COLUMNS)
      .eq('store_id', storeId)
      .eq('slug', normalizedSlug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load blog post: ${error.message}`);
    }

    return data ? mapBlogPostRow(data as Record<string, unknown>) : null;
  }

  return (
    getDatabase().store_blog_posts.find(
      (post) => post.store_id === storeId && post.slug === normalizedSlug && post.status === 'published',
    ) || null
  );
}

export async function createStoreMediaAsset(
  storeId: string,
  input: CreateStoreMediaAssetInput,
  options?: ContentServiceOptions,
) {
  assertEnumValue(input.assetType, MEDIA_ASSET_TYPES, 'media asset type');
  const status = input.status || 'draft';
  assertEnumValue(status, MEDIA_ASSET_STATUSES, 'media asset status');
  const timestamp = nowIso();
  const assetUrl = normalizeSafeHttpUrl(input.url, 'Media asset');
  const thumbnailUrl = normalizeOptionalSafeHttpUrl(input.thumbnailUrl, 'Media thumbnail');

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_media_assets')
      .insert({
        ai_description: input.aiDescription?.trim() || null,
        ai_hashtags: input.aiHashtags || [],
        ai_title: input.aiTitle?.trim() || null,
        alt_text: input.altText?.trim() || null,
        asset_type: input.assetType,
        captions_srt: input.captionsSrt || null,
        captions_vtt: input.captionsVtt || null,
        duration_seconds: input.durationSeconds || null,
        status,
        storage_path: input.storagePath || null,
        store_id: storeId,
        thumbnail_url: thumbnailUrl || null,
        transcript: input.transcript || null,
        uploaded_by: options?.actorProfileId || null,
        url: assetUrl,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create media asset: ${error.message}`);
    }

    return mapMediaAssetRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  const asset: StoreMediaAsset = {
    asset_id: createId('store_media_asset'),
    store_id: storeId,
    uploaded_by: options?.actorProfileId,
    asset_type: input.assetType,
    url: assetUrl,
    storage_path: toOptionalText(input.storagePath),
    thumbnail_url: thumbnailUrl,
    alt_text: toOptionalText(input.altText),
    duration_seconds: input.durationSeconds,
    transcript: toOptionalText(input.transcript),
    captions_vtt: toOptionalText(input.captionsVtt),
    captions_srt: toOptionalText(input.captionsSrt),
    ai_title: toOptionalText(input.aiTitle),
    ai_description: toOptionalText(input.aiDescription),
    ai_hashtags: input.aiHashtags || [],
    status,
    created_at: timestamp,
    updated_at: timestamp,
  };

  updateDatabase((database) => {
    database.store_media_assets.unshift(asset);
  });

  return asset;
}

export async function listStoreMediaAssets(
  storeId: string,
  options?: ContentServiceOptions & { status?: StoreMediaAssetStatus },
) {
  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    let query = client.from('store_media_assets').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list media assets: ${error.message}`);
    }

    return (data || []).map((row) => mapMediaAssetRow(row as Record<string, unknown>));
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  return sortNewestFirst(
    getDatabase().store_media_assets.filter(
      (asset) => asset.store_id === storeId && (!options?.status || asset.status === options.status),
    ),
  );
}

async function getStoreMediaAsset(storeId: string, assetId: string, options?: ContentServiceOptions) {
  const normalizedAssetId = normalizeText(assetId);
  if (!normalizedAssetId) {
    throw new Error('Media asset id is required.');
  }

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_media_assets')
      .select('*')
      .eq('store_id', storeId)
      .eq('asset_id', normalizedAssetId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load media asset: ${error.message}`);
    }

    return data ? mapMediaAssetRow(data as Record<string, unknown>) : null;
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  return getDatabase().store_media_assets.find((asset) => asset.store_id === storeId && asset.asset_id === normalizedAssetId) || null;
}

export async function transcribeStoreMediaAsset(
  storeId: string,
  assetId: string,
  options?: ContentServiceOptions,
): Promise<TranscribeStoreMediaAssetResult> {
  const asset = await getStoreMediaAsset(storeId, assetId, options);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  const transcription = await transcribeMediaAsset(asset, {
    env: options?.env,
    providerAdapter: options?.sttProviderAdapter,
  });

  if (!transcription.ok) {
    return {
      asset,
      message: transcription.message,
      updated: false,
    };
  }

  const captions = generateSttCaptionFiles(transcription.transcript);
  const draft = generateMediaContentDraft(transcription.transcript, asset);
  const timestamp = nowIso();
  const updatePayload = {
    ai_description: draft.aiDescription,
    ai_hashtags: draft.aiHashtags,
    ai_title: draft.aiTitle,
    captions_srt: captions.srt || null,
    captions_vtt: captions.vtt || null,
    transcript: transcription.transcript.text,
    updated_at: timestamp,
  };

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('store_media_assets')
      .update(updatePayload)
      .eq('store_id', storeId)
      .eq('asset_id', asset.asset_id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update media asset transcript: ${error.message}`);
    }

    return {
      asset: mapMediaAssetRow(data as Record<string, unknown>),
      message: transcription.message,
      updated: true,
    };
  }

  let updatedAsset: StoreMediaAsset | null = null;
  updateDatabase((database) => {
    database.store_media_assets = database.store_media_assets.map((entry) => {
      if (entry.store_id !== storeId || entry.asset_id !== asset.asset_id) {
        return entry;
      }

      updatedAsset = {
        ...entry,
        ai_description: updatePayload.ai_description,
        ai_hashtags: updatePayload.ai_hashtags,
        ai_title: updatePayload.ai_title,
        captions_srt: captions.srt,
        captions_vtt: captions.vtt,
        transcript: transcription.transcript.text,
        updated_at: timestamp,
      };
      return updatedAsset;
    });
  });

  return {
    asset: updatedAsset || {
      ...asset,
      ai_description: updatePayload.ai_description,
      ai_hashtags: updatePayload.ai_hashtags,
      ai_title: updatePayload.ai_title,
      captions_srt: captions.srt,
      captions_vtt: captions.vtt,
      transcript: transcription.transcript.text,
      updated_at: timestamp,
    },
    message: transcription.message,
    updated: true,
  };
}

export async function generateCaptionDraft(mediaAsset: StoreMediaAsset) {
  const title = mediaAsset.ai_title || mediaAsset.alt_text || (mediaAsset.asset_type === 'video' ? '매장 영상 초안' : '매장 이미지 초안');
  const description =
    mediaAsset.ai_description ||
    '등록된 매장 미디어를 바탕으로 고객에게 보여줄 소개 문구 초안을 준비했습니다. 실제 고객 발언이나 후기는 새로 만들지 않습니다.';

  return {
    description,
    hashtags: mediaAsset.ai_hashtags.length ? mediaAsset.ai_hashtags : ['MyBiz', '매장소식', '고객경험'],
    title,
  };
}

export async function generateTranscriptDraft(mediaAsset: StoreMediaAsset) {
  if (mediaAsset.transcript?.trim()) {
    return {
      transcript: mediaAsset.transcript,
    };
  }

  return {
    transcript: getSttReadiness().message,
  };
}

export async function generateSocialCaptionDraft(source: StoreReview | StoreBlogPost | StoreMediaAsset | { title?: string; body?: string }) {
  const title =
    'title' in source && source.title
      ? source.title
      : 'ai_title' in source && source.ai_title
        ? source.ai_title
        : '매장 소식';

  return {
    caption: `${title}을 바탕으로 점주 계정에서 승인 후 공유할 수 있는 소개글 초안입니다. 고객 후기를 대신 작성하지 않습니다.`,
    hashtags: ['MyBiz', '매장소식', '고객경험'],
  };
}

export function isExternalProvider(provider: SocialPublishProvider) {
  return provider !== 'mybiz_blog';
}

async function getReviewForReuse(storeId: string, reviewId: string, options?: ContentServiceOptions) {
  const reviews = await listStoreReviews(storeId, options);
  return reviews.find((review) => review.review_id === reviewId) || null;
}

async function getBlogPostForExternalPublish(storeId: string, postId: string, options?: ContentServiceOptions) {
  const posts = await listStoreBlogPosts(storeId, options);
  return posts.find((post) => post.post_id === postId) || null;
}

async function getMediaAssetForExternalPublish(storeId: string, assetId: string, options?: ContentServiceOptions) {
  const assets = await listStoreMediaAssets(storeId, options);
  return assets.find((asset) => asset.asset_id === assetId) || null;
}

function assertNoCustomerImpersonationCopy(caption?: string | null) {
  const normalized = normalizeText(caption);
  if (!normalized) {
    return;
  }

  const customerVoicePatterns = [
    /제가\s*(방문|다녀|먹|마셔|구매|이용|써|가봤|갔)/i,
    /방문했는데요/i,
    /내돈내산/i,
    /I\s+(visited|bought|tried|ate|went)/i,
    /my\s+(visit|review|experience)/i,
  ];

  if (customerVoicePatterns.some((pattern) => pattern.test(normalized))) {
    throw new Error('Customer impersonation copy is not allowed. 고객 대신 작성하는 문구는 사용할 수 없습니다.');
  }
}

async function assertSocialPublishSourceAllowed(input: CreateSocialPublishJobInput, storeId: string, options?: ContentServiceOptions) {
  if (!isExternalProvider(input.provider)) {
    return;
  }

  assertNoCustomerImpersonationCopy(input.caption);

  if (input.sourceType === 'manual') {
    return;
  }

  if (!input.sourceId) {
    throw new Error('Source id is required before external publishing.');
  }

  if (input.sourceType === 'review') {
    const review = await getReviewForReuse(storeId, input.sourceId, options);
    if (!review) {
      throw new Error('Review not found.');
    }

    if (!review.content_usage_consent) {
      throw new Error('Customer content usage consent is required before external reuse.');
    }

    if (review.visibility_status !== 'published') {
      throw new Error('Merchant approval is required before external review reuse.');
    }

    return;
  }

  if (input.sourceType === 'blog_post') {
    const post = await getBlogPostForExternalPublish(storeId, input.sourceId, options);
    if (!post) {
      throw new Error('Blog post not found.');
    }

    if (post.status !== 'published') {
      throw new Error('Published blog post is required before external publishing.');
    }

    return;
  }

  if (input.sourceType === 'media') {
    const asset = await getMediaAssetForExternalPublish(storeId, input.sourceId, options);
    if (!asset) {
      throw new Error('Media asset not found.');
    }

    if (asset.status !== 'ready' && asset.status !== 'published') {
      throw new Error('Media asset must be ready before external publishing.');
    }
  }
}

export async function listSocialProviderCards(storeId: string, options?: ContentServiceOptions): Promise<SocialProviderCard[]> {
  let accounts: SocialAccount[] = [];

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (client) {
      const { data, error } = await client.from('social_accounts').select(SOCIAL_ACCOUNT_SAFE_COLUMNS).eq('store_id', storeId);
      if (error) {
        throw new Error(`Failed to list social accounts: ${error.message}`);
      }
      accounts = (data || []).map((row) => mapSocialAccountRow(row as Record<string, unknown>));
    }
  } else {
    assertDemoStoreMember(storeId, options?.actorProfileId);
    accounts = getDatabase().social_accounts
      .filter((account) => account.store_id === storeId)
      .map((account) => mapSocialAccountRow(account as unknown as Record<string, unknown>));
  }

  return SOCIAL_PROVIDERS.map((provider) => {
    const account =
      accounts.find((entry) => entry.provider === provider && entry.oauth_status === 'connected') ||
      accounts.find((entry) => entry.provider === provider);
    const accountStatus = resolveSocialAccountStatus(account);
    const youtubeReadiness = provider === 'youtube' ? getYouTubeProviderReadiness(options?.env) : null;
    const externalReadiness = isExternalFoundationProvider(provider)
      ? getExternalSocialProviderReadiness(provider, options?.env, { accountStatus })
      : null;
    const status: SocialProviderCard['status'] = externalReadiness
      ? accountStatus === 'expired' || accountStatus === 'revoked'
        ? accountStatus
        : externalReadiness.status
      : youtubeReadiness
        ? accountStatus === 'connected'
          ? 'connected'
          : accountStatus || (youtubeReadiness.oauthReady ? 'not_connected' : 'disabled')
        : accountStatus === 'connected'
          ? 'connected'
          : accountStatus || 'disabled';

    return {
      displayName: account?.display_name,
      missingEnvNames: externalReadiness?.missingEnvNames || youtubeReadiness?.missingOAuthEnvNames,
      provider,
      providerAccountId: account?.provider_account_id,
      requiredScopes: externalReadiness?.requiredScopes,
      status,
      tokenExpiresAt: account?.token_expires_at,
      tokenExpiringSoon: status === 'connected' && isTokenExpiringSoon(account?.token_expires_at),
      ...PROVIDER_COPY[provider],
    };
  });
}

function formatYouTubeUploadCaption(input: CreateYouTubeUploadJobInput) {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const hashtags = (input.hashtags || [])
    .map((hashtag) => normalizeText(hashtag).replace(/^#/, ''))
    .filter(Boolean)
    .map((hashtag) => `#${hashtag}`);

  return [title, description, hashtags.join(' ')].filter(Boolean).join('\n\n');
}

export async function createYouTubeUploadJob(
  storeId: string,
  input: CreateYouTubeUploadJobInput,
  options?: ContentServiceOptions,
) {
  const status = input.status || 'draft';
  if (status !== 'draft' && status !== 'waiting_approval') {
    throw new Error('YouTube upload jobs must start as draft or waiting_approval.');
  }

  return createSocialPublishJob(
    storeId,
    {
      caption: formatYouTubeUploadCaption(input),
      hashtags: input.hashtags || [],
      provider: 'youtube',
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      status,
    },
    options,
  );
}

export async function createSocialPublishJob(
  storeId: string,
  input: CreateSocialPublishJobInput,
  options?: ContentServiceOptions,
) {
  assertEnumValue(input.provider, SOCIAL_PUBLISH_PROVIDERS, 'provider');
  assertEnumValue(input.sourceType, SOCIAL_SOURCE_TYPES, 'source type');
  const status = input.status || 'draft';
  assertEnumValue(status, SOCIAL_JOB_STATUSES, 'social publish job status');
  if (isExternalProvider(input.provider) && ['queued', 'publishing', 'published'].includes(status)) {
    throw new Error('Merchant approval is required before an external publish job can be queued.');
  }
  await assertSocialPublishSourceAllowed(input, storeId, options);
  const timestamp = nowIso();

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await client
      .from('social_publish_jobs')
      .insert({
        caption: input.caption?.trim() || null,
        hashtags: input.hashtags || [],
        provider: input.provider,
        source_id: input.sourceId || null,
        source_type: input.sourceType,
        status,
        store_id: storeId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create social publish job: ${error.message}`);
    }

    return mapSocialPublishJobRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  const job: SocialPublishJob = {
    job_id: createId('social_publish_job'),
    store_id: storeId,
    provider: input.provider,
    source_type: input.sourceType,
    source_id: toOptionalText(input.sourceId),
    caption: toOptionalText(input.caption),
    hashtags: input.hashtags || [],
    status,
    created_at: timestamp,
    updated_at: timestamp,
  };

  updateDatabase((database) => {
    database.social_publish_jobs.unshift(job);
  });

  return job;
}

async function getSocialPublishReadiness(storeId: string, provider: SocialPublishProvider, options?: ContentServiceOptions) {
  if (provider === 'mybiz_blog') {
    return {
      errorCode: undefined,
      errorMessage: undefined,
      ready: true,
    };
  }

  const cards = await listSocialProviderCards(storeId, options);
  const card = cards.find((entry) => entry.provider === provider);

  if (isExternalFoundationProvider(provider)) {
    if (card?.status !== 'ready') {
      return {
        errorCode: 'provider_not_connected',
        errorMessage: '외부 채널 게시 기능은 계정 연동과 점주 승인 후 사용할 수 있습니다.',
        ready: false,
      };
    }

    return {
      errorCode: undefined,
      errorMessage: undefined,
      ready: true,
    };
  }

  if (card?.status !== 'connected') {
    return {
      errorCode: 'provider_not_connected',
      errorMessage: provider === 'youtube' ? 'YouTube 계정 연동이 필요합니다.' : 'Provider is not connected or enabled.',
      ready: false,
    };
  }

  if (provider === 'youtube') {
    const readiness = getYouTubeProviderReadiness(options?.env);
    if (!readiness.uploadReady) {
      return {
        errorCode: 'youtube_upload_not_configured',
        errorMessage: 'YouTube 업로드 설정이 아직 완료되지 않았습니다.',
        ready: false,
      };
    }
  }

  return {
    errorCode: undefined,
    errorMessage: undefined,
    ready: true,
  };
}

export async function approveSocialPublishJob(
  storeId: string,
  jobId: string,
  options?: ApproveSocialPublishOptions,
) {
  const timestamp = nowIso();

  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      throw new Error('Supabase client is not configured.');
    }

    const { data: currentData, error: currentError } = await client
      .from('social_publish_jobs')
      .select('*')
      .eq('store_id', storeId)
      .eq('job_id', jobId)
      .single();

    if (currentError) {
      throw new Error(`Failed to load social publish job: ${currentError.message}`);
    }

    const currentJob = mapSocialPublishJobRow(currentData as Record<string, unknown>);
    const publishReadiness = await getSocialPublishReadiness(storeId, currentJob.provider, options);
    const nextStatus: SocialPublishJobStatus = publishReadiness.ready ? 'queued' : 'waiting_approval';
    const updatePayload = {
      approved_at: timestamp,
      approved_by: options?.actorProfileId || null,
      error_code: publishReadiness.errorCode || null,
      error_message: publishReadiness.errorMessage || null,
      status: nextStatus,
      updated_at: timestamp,
    };
    const { data, error } = await client
      .from('social_publish_jobs')
      .update(updatePayload)
      .eq('store_id', storeId)
      .eq('job_id', jobId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to approve social publish job: ${error.message}`);
    }

    return mapSocialPublishJobRow(data as Record<string, unknown>);
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  const database = getDatabase();
  const currentJob = database.social_publish_jobs.find((job) => job.store_id === storeId && job.job_id === jobId);
  if (!currentJob) {
    throw new Error('Social publish job not found.');
  }

  const publishReadiness = await getSocialPublishReadiness(storeId, currentJob.provider, options);
  let nextJob: SocialPublishJob = {
    ...currentJob,
    approved_at: timestamp,
    approved_by: options?.actorProfileId,
    error_code: publishReadiness.errorCode,
    error_message: publishReadiness.errorMessage,
    status: publishReadiness.ready ? 'queued' : 'waiting_approval',
    updated_at: timestamp,
  };

  updateDatabase((nextDatabase) => {
    nextDatabase.social_publish_jobs = nextDatabase.social_publish_jobs.map((job) => {
      if (job.store_id !== storeId || job.job_id !== jobId) {
        return job;
      }

      return nextJob;
    });
  });

  if (nextJob.status === 'queued' && options?.publishAdapter && nextJob.provider === 'mybiz_blog') {
    const publishResult = await options.publishAdapter(nextJob);
    nextJob = {
      ...nextJob,
      provider_post_id: publishResult.providerPostId,
      provider_url: publishResult.providerUrl,
    };
  }

  return nextJob;
}

export async function listSocialPublishJobs(storeId: string, options?: ContentServiceOptions) {
  if (isSupabaseContentEnabled(options)) {
    const client = getContentClient(options);
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('social_publish_jobs')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list social publish jobs: ${error.message}`);
    }

    return (data || []).map((row) => mapSocialPublishJobRow(row as Record<string, unknown>));
  }

  assertDemoStoreMember(storeId, options?.actorProfileId);
  return sortNewestFirst(getDatabase().social_publish_jobs.filter((job) => job.store_id === storeId));
}

function normalizeReadinessStatus(input: {
  configured: boolean;
  connected?: boolean;
  enabled?: boolean;
  error?: boolean;
  ready?: boolean;
}): ContentReadinessProviderStatus {
  if (input.error) {
    return 'error';
  }

  if (!input.configured) {
    return 'missing_config';
  }

  if (input.connected) {
    return 'connected';
  }

  if (input.ready) {
    return 'ready';
  }

  return input.enabled === false ? 'disabled' : 'ready';
}

function getProviderNextAction(card: ContentReadinessProviderCard) {
  if (card.status === 'missing_config') {
    return `환경 설정 대기: ${card.missingEnvNames.join(', ')}`;
  }

  if (card.status === 'connected') {
    return card.tokenExpiringSoon
      ? '계정 연결은 확인되었습니다. 토큰 만료가 가까워 갱신 준비 상태를 확인하세요.'
      : '계정 연결은 확인되었습니다. 점주 승인 큐와 콘텐츠 동의 상태를 확인하세요.';
  }

  if (card.status === 'not_connected') {
    return '계정 토큰 연결이 필요합니다. 토큰 암호화 설정 완료 후 연결을 진행하세요.';
  }

  if (card.status === 'expired') {
    return '계정 토큰이 만료되었습니다. 토큰 갱신 foundation이 준비되면 다시 연결하세요.';
  }

  if (card.status === 'revoked') {
    return '계정 연결이 폐기되었습니다. 다시 연결하기 전에는 외부 게시 큐로 이동할 수 없습니다.';
  }

  if (card.status === 'ready') {
    return card.provider === 'kakao_share'
      ? 'SDK 설정이 준비되었습니다. 사용자가 직접 공유하는 흐름만 제공합니다.'
      : '제공자 설정은 준비되었습니다. 계정 연결과 점주 승인을 완료하세요.';
  }

  if (card.status === 'error') {
    return '오류 내용을 확인하고 provider 설정을 점검하세요.';
  }

  return '기능이 비활성화되어 있습니다. 외부 게시 호출은 실행되지 않습니다.';
}

function hasCaption(asset: StoreMediaAsset) {
  return Boolean(asset.captions_srt?.trim() || asset.captions_vtt?.trim());
}

function hasTranscript(asset: StoreMediaAsset) {
  return Boolean(asset.transcript?.trim());
}

function getReviewTitle(review: StoreReview) {
  return review.title?.trim() || review.body?.trim().slice(0, 48) || '고객 리뷰';
}

function getSourceTitle(
  job: SocialPublishJob,
  lookups: {
    assets: Map<string, StoreMediaAsset>;
    posts: Map<string, StoreBlogPost>;
    reviews: Map<string, StoreReview>;
  },
) {
  if (!job.source_id) {
    return job.caption?.trim().slice(0, 48) || '수동 문안';
  }

  if (job.source_type === 'review') {
    const review = lookups.reviews.get(job.source_id);
    return review ? getReviewTitle(review) : '리뷰 소스 확인 필요';
  }

  if (job.source_type === 'blog_post') {
    return lookups.posts.get(job.source_id)?.title || '블로그 소스 확인 필요';
  }

  if (job.source_type === 'media') {
    const asset = lookups.assets.get(job.source_id);
    return asset?.ai_title || asset?.alt_text || asset?.url || '미디어 소스 확인 필요';
  }

  return job.caption?.trim().slice(0, 48) || '수동 문안';
}

function getConsentStatus(job: SocialPublishJob, reviewLookup: Map<string, StoreReview>): ContentReadinessConsentStatus {
  if (job.source_type !== 'review') {
    return 'not_required';
  }

  const review = job.source_id ? reviewLookup.get(job.source_id) : null;
  if (!review) {
    return 'unknown';
  }

  return review.content_usage_consent ? 'granted' : 'missing';
}

function getApprovalStatus(job: SocialPublishJob): ContentReadinessApprovalStatus {
  if (job.approved_at && job.approved_by) {
    return 'approved';
  }

  return job.status === 'waiting_approval' ? 'waiting_approval' : 'approval_missing';
}

function detectUnsafeCopy(caption?: string | null): ContentReadinessBlockReason | null {
  const normalized = normalizeText(caption);
  if (!normalized) {
    return null;
  }

  const customerVoicePatterns = [
    /제가\s*(방문|다녀|먹|마셔|구매|이용|써|가봤|갔)/i,
    /방문했는데요/i,
    /내돈내산/i,
    /I\s+(visited|bought|tried|ate|went)/i,
    /my\s+(visit|review|experience)/i,
  ];
  if (customerVoicePatterns.some((pattern) => pattern.test(normalized))) {
    return 'customer_impersonation_copy_detected';
  }

  return /대신\s*(작성|등록)|자동\s*등록|리뷰\s*대행/i.test(normalized) ? 'unsafe_copy_detected' : null;
}

function getProviderBlockReason(status?: SocialAccountStatus | ExternalSocialProviderStatus) {
  if (status === 'not_connected') {
    return 'token_not_connected' as const;
  }

  if (status === 'disabled' || status === 'error') {
    return 'provider_disabled' as const;
  }

  return null;
}

function buildProviderCards(
  socialCards: SocialProviderCard[],
  options?: ContentServiceOptions,
): ContentReadinessProviderCard[] {
  const socialCardByProvider = new Map(socialCards.map((card) => [card.provider, card]));
  const youtube = getYouTubeProviderReadiness(options?.env);
  const youtubeSocialCard = socialCardByProvider.get('youtube');
  const youtubeStatus = normalizeReadinessStatus({
    configured: youtube.missingOAuthEnvNames.length === 0 && youtube.uploadEnabled,
    connected: youtubeSocialCard?.status === 'connected',
    enabled: youtube.oauthEnabled || youtube.uploadEnabled,
    ready: youtube.uploadReady,
  });
  const providerCards: ContentReadinessProviderCard[] = [
    {
      copy: youtube.disabledMessage,
      displayName: youtubeSocialCard?.displayName,
      missingEnvNames: [...new Set(youtube.missingOAuthEnvNames.concat(youtube.uploadEnabled ? [] : ['YOUTUBE_UPLOAD_ENABLED']))],
      nextAction: '',
      provider: 'youtube',
      providerAccountId: youtubeSocialCard?.providerAccountId,
      requiredScopes: youtube.requiredScopes,
      status:
        youtubeSocialCard?.status === 'expired' || youtubeSocialCard?.status === 'revoked' || youtubeSocialCard?.status === 'not_connected'
          ? youtubeSocialCard.status
          : youtubeStatus,
      title: 'YouTube',
      tokenExpiresAt: youtubeSocialCard?.tokenExpiresAt,
      tokenExpiringSoon: youtubeSocialCard?.tokenExpiringSoon,
    },
  ];

  (['threads', 'naver_blog', 'kakao_share'] as const).forEach((provider) => {
    const baseCard = socialCardByProvider.get(provider);
    const readiness = getExternalSocialProviderReadiness(provider, options?.env, {
      accountStatus: baseCard?.status,
    });
    const status = normalizeReadinessStatus({
      configured: readiness.missingEnvNames.length === 0,
      connected: readiness.status === 'connected',
      enabled: readiness.enabled,
      ready: readiness.status === 'ready',
    });
    providerCards.push({
      copy: readiness.message,
      displayName: baseCard?.displayName,
      missingEnvNames: readiness.missingEnvNames,
      nextAction: '',
      provider,
      providerAccountId: baseCard?.providerAccountId,
      requiredScopes: readiness.requiredScopes,
      status:
        baseCard?.status === 'expired' || baseCard?.status === 'revoked' || baseCard?.status === 'not_connected'
          ? baseCard.status
          : status,
      title: readiness.title,
      tokenExpiresAt: baseCard?.tokenExpiresAt,
      tokenExpiringSoon: baseCard?.tokenExpiringSoon,
    });
  });

  const stt = getSttReadiness(options?.env);
  providerCards.push({
    copy: stt.message,
    missingEnvNames: stt.missingEnvNames,
    nextAction: '',
    provider: 'stt',
    requiredScopes: [],
    status: normalizeReadinessStatus({
      configured: stt.missingEnvNames.length === 0,
      enabled: stt.enabled,
      ready: stt.ready,
    }),
    title: 'STT provider',
  });

  const paymentTestReady =
    PAYMENT_TEST_100_PRODUCT.amount === 100 &&
    PAYMENT_TEST_100_PRODUCT.grants_entitlement === false &&
    PAYMENT_TEST_100_PRODUCT.is_visible_public === false;
  providerCards.push({
    copy: 'PortOne 100원 테스트 상품은 참고 상태로만 표시되며 콘텐츠 게시 흐름과 연결하지 않습니다.',
    missingEnvNames: [],
    nextAction: '',
    provider: 'payment_test_100',
    requiredScopes: [],
    status: paymentTestReady ? 'ready' : 'error',
    title: 'PortOne payment test',
  });

  return providerCards.map((card) => ({
    ...card,
    nextAction: getProviderNextAction(card),
  }));
}

function buildApprovalQueue(
  jobs: SocialPublishJob[],
  lookups: {
    assets: Map<string, StoreMediaAsset>;
    posts: Map<string, StoreBlogPost>;
    reviews: Map<string, StoreReview>;
  },
): ContentReadinessApprovalQueueItem[] {
  return jobs
    .filter((job) => job.status === 'draft' || job.status === 'waiting_approval')
    .map((job) => {
      const consentStatus = getConsentStatus(job, lookups.reviews);
      const approvalStatus = getApprovalStatus(job);
      return {
        approvalStatus,
        consentStatus,
        createdAt: job.created_at,
        jobId: job.job_id,
        nextAction:
          consentStatus === 'missing'
            ? '고객 콘텐츠 활용 동의가 필요합니다.'
            : approvalStatus === 'approval_missing'
              ? '점주가 문안을 검토하고 승인해야 합니다.'
              : 'provider 설정을 확인한 뒤 게시 실행은 별도 단계에서 진행합니다.',
        provider: job.provider,
        sourceTitle: getSourceTitle(job, lookups),
        sourceType: job.source_type,
        status: job.status,
      };
    });
}

function buildBlockedQueue(
  input: {
    jobs: SocialPublishJob[];
    lookups: {
      assets: Map<string, StoreMediaAsset>;
      posts: Map<string, StoreBlogPost>;
      reviews: Map<string, StoreReview>;
    };
    providerCards: ContentReadinessProviderCard[];
    reviews: StoreReview[];
    socialCards: SocialProviderCard[];
  },
): ContentReadinessBlockedQueueItem[] {
  const blocked: ContentReadinessBlockedQueueItem[] = [];
  const providerStatus = new Map(input.socialCards.map((card) => [card.provider, card.status]));
  const readinessByProvider = new Map(input.providerCards.map((card) => [card.provider, card]));

  input.reviews
    .filter((review) => review.visibility_status === 'published' && !review.content_usage_consent)
    .forEach((review) => {
      blocked.push({
        createdAt: review.created_at,
        reason: '고객 콘텐츠 활용 동의가 없어 외부 채널 소개 초안으로 사용할 수 없습니다.',
        reasonCode: 'content_usage_consent_missing',
        sourceTitle: getReviewTitle(review),
        sourceType: 'review',
      });
    });

  input.jobs.forEach((job) => {
    const sourceTitle = getSourceTitle(job, input.lookups);
    const unsafeCopyReason = detectUnsafeCopy(job.caption);
    const consentStatus = getConsentStatus(job, input.lookups.reviews);
    const directProviderStatus = providerStatus.get(job.provider as SocialProvider);
    const providerBlock = getProviderBlockReason(directProviderStatus);
    const readiness = readinessByProvider.get(job.provider as ContentReadinessProviderKey);

    if (job.status === 'failed') {
      blocked.push({
        createdAt: job.created_at,
        jobId: job.job_id,
        provider: job.provider,
        reason: job.error_message || '게시 작업이 실패 상태입니다. 실제 외부 게시 성공으로 표시하지 않습니다.',
        reasonCode: 'failed',
        sourceTitle,
        sourceType: job.source_type,
      });
    }

    if (consentStatus === 'missing') {
      blocked.push({
        createdAt: job.created_at,
        jobId: job.job_id,
        provider: job.provider,
        reason: '고객 콘텐츠 활용 동의가 필요합니다.',
        reasonCode: 'content_usage_consent_missing',
        sourceTitle,
        sourceType: job.source_type,
      });
    }

    if (unsafeCopyReason) {
      blocked.push({
        createdAt: job.created_at,
        jobId: job.job_id,
        provider: job.provider,
        reason:
          unsafeCopyReason === 'customer_impersonation_copy_detected'
            ? '고객인 척 작성한 문구가 감지되었습니다.'
            : '외부 리뷰 대행 또는 자동 등록처럼 보이는 문구가 감지되었습니다.',
        reasonCode: unsafeCopyReason,
        sourceTitle,
        sourceType: job.source_type,
      });
    }

    if (!job.approved_at && (job.status === 'draft' || job.status === 'waiting_approval')) {
      blocked.push({
        createdAt: job.created_at,
        jobId: job.job_id,
        provider: job.provider,
        reason: '점주 승인 전에는 queued/publishing/published 상태로 전환할 수 없습니다.',
        reasonCode: 'approval_missing',
        sourceTitle,
        sourceType: job.source_type,
      });
    }

    if (isExternalProvider(job.provider) && providerBlock) {
      blocked.push({
        createdAt: job.created_at,
        jobId: job.job_id,
        provider: job.provider,
        reason:
          providerBlock === 'token_not_connected'
            ? '계정 토큰 연결이 완료되지 않았습니다.'
            : 'provider가 비활성 상태라 외부 게시 큐로 이동할 수 없습니다.',
        reasonCode: providerBlock,
        sourceTitle,
        sourceType: job.source_type,
      });
    }

    if (readiness?.missingEnvNames.length) {
      blocked.push({
        createdAt: job.created_at,
        jobId: job.job_id,
        provider: job.provider,
        reason: `필수 환경 설정이 필요합니다: ${readiness.missingEnvNames.join(', ')}`,
        reasonCode: 'missing_env',
        sourceTitle,
        sourceType: job.source_type,
      });
    }
  });

  return blocked.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getContentReadinessDashboard(
  storeId: string,
  options?: ContentServiceOptions,
): Promise<ContentReadinessDashboard> {
  const [reviewLinks, reviews, posts, assets, socialCards, jobs] = await Promise.all([
    listReviewRequestLinks(storeId, options),
    listStoreReviews(storeId, options),
    listStoreBlogPosts(storeId, options),
    listStoreMediaAssets(storeId, options),
    listSocialProviderCards(storeId, options),
    listSocialPublishJobs(storeId, options),
  ]);
  const lookups = {
    assets: new Map(assets.map((asset) => [asset.asset_id, asset])),
    posts: new Map(posts.map((post) => [post.post_id, post])),
    reviews: new Map(reviews.map((review) => [review.review_id, review])),
  };
  const providerCards = buildProviderCards(socialCards, options);
  const publishedReviewsWithoutConsent = reviews.filter(
    (review) => review.visibility_status === 'published' && !review.content_usage_consent,
  );

  return {
    approvalQueue: buildApprovalQueue(jobs, lookups),
    blockedQueue: buildBlockedQueue({
      jobs,
      lookups,
      providerCards,
      reviews,
      socialCards,
    }),
    providerCards,
    safetyCopy: {
      externalPosting: '외부 채널 게시 기능은 계정 연동, 고객 동의, 점주 승인, 제공자 설정이 모두 완료된 뒤 사용할 수 있습니다.',
      reviewPolicy: '외부 플랫폼 리뷰를 대신 작성하거나 자동 등록하지 않습니다.',
    },
    stats: {
      blogDraftCount: posts.filter((post) => post.status === 'draft').length,
      blogPublishedCount: posts.filter((post) => post.status === 'published').length,
      captionReadyAssetCount: assets.filter((asset) => hasCaption(asset)).length,
      consentBlockedJobCount: publishedReviewsWithoutConsent.length,
      mediaAssetCount: assets.length,
      pendingReviewCount: reviews.filter((review) => review.visibility_status === 'pending').length,
      publishedReviewCount: reviews.filter((review) => review.visibility_status === 'published').length,
      reviewRequestLinkCount: reviewLinks.length,
      socialDraftCount: jobs.filter((job) => job.status === 'draft').length,
      socialFailedCount: jobs.filter((job) => job.status === 'failed').length,
      socialWaitingApprovalCount: jobs.filter((job) => job.status === 'waiting_approval').length,
      transcriptReadyAssetCount: assets.filter((asset) => hasTranscript(asset)).length,
    },
  };
}
