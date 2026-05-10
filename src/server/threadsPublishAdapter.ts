import type { SupabaseClient } from '@supabase/supabase-js';

import { getDatabase, updateDatabase } from '../shared/lib/mockDb.js';
import { normalizeStoreSlug } from '../shared/lib/storeSlug.js';
import {
  listSocialPublishJobs,
  listStoreBlogPosts,
  listStoreMediaAssets,
  listStoreReviews,
} from '../shared/lib/services/contentEngineService.js';
import {
  EXTERNAL_SOCIAL_PROVIDER_ENV,
  getExternalSocialProviderReadiness,
  type ExternalSocialEnv,
  type ExternalSocialProviderStatus,
} from '../shared/lib/services/externalSocialProvider.js';
import type {
  SocialAccount,
  SocialAccountStatus,
  SocialPublishJob,
  SocialPublishJobStatus,
  StoreBlogPost,
  StoreMediaAsset,
  StoreReview,
} from '../shared/types/models.js';
import { decryptOAuthToken, type TokenVaultEnv } from './oauthTokenVault.js';
import { getProviderTokenStatus, type ProviderTokenStoreOptions } from './socialAccountTokens.js';

export type ThreadsPublishEnv = ExternalSocialEnv & TokenVaultEnv;

export interface ThreadsReadiness {
  accountStatus: SocialAccountStatus;
  enabled: boolean;
  missingEnvNames: string[];
  provider: 'threads';
  ready: boolean;
  requiredScopes: string[];
  status: ExternalSocialProviderStatus | SocialAccountStatus;
  tokenEncryptionReady: boolean;
}

export interface ThreadsPayload {
  altText?: string;
  hashtags: string[];
  mediaUrl?: string;
  sourceUrl?: string;
  text: string;
}

export type ThreadsPayloadSource =
  | {
      canonicalUrl?: string;
      sourceType: 'manual';
    }
  | {
      canonicalUrl?: string;
      post: StoreBlogPost;
      sourceType: 'blog_post';
    }
  | {
      canonicalUrl?: string;
      review: StoreReview;
      sourceType: 'review';
    }
  | {
      asset: StoreMediaAsset;
      canonicalUrl?: string;
      sourceType: 'media';
    };

export type ThreadsPublishAdapter = (input: {
  accessToken: string;
  payload: ThreadsPayload;
  storeId: string;
}) => Promise<{
  providerPostId?: string;
  providerUrl?: string;
}> | {
  providerPostId?: string;
  providerUrl?: string;
};

export interface ThreadsPublishOptions extends ProviderTokenStoreOptions {
  env?: ThreadsPublishEnv;
  publishAdapter?: ThreadsPublishAdapter;
}

const THREADS_PROVIDER = 'threads';
const THREADS_TEXT_LIMIT = 500;
const THREADS_NOT_READY_MESSAGE = 'Threads 게시 기능은 점주 계정 연동과 게시 권한 확인 후 사용할 수 있습니다.';
const THREADS_TOKEN_MESSAGE = 'Threads 계정 토큰을 안전하게 확인할 수 없어 게시를 진행하지 않았습니다.';
const THREADS_ADAPTER_DISABLED_MESSAGE = 'Threads 게시 adapter는 provider 설정 완료 후 사용할 수 있습니다.';
const THREADS_FAKE_SUCCESS_MESSAGE = 'Threads 게시 결과를 확인할 수 없어 published 상태로 처리하지 않았습니다.';

type MutableJobPatch = Partial<
  Pick<
    SocialPublishJob,
    | 'error_code'
    | 'error_message'
    | 'provider_post_id'
    | 'provider_url'
    | 'published_at'
    | 'status'
    | 'updated_at'
  >
>;

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function getNow(options?: ThreadsPublishOptions) {
  if (typeof options?.now === 'function') {
    return options.now();
  }

  return options?.now || new Date();
}

function nowIso(options?: ThreadsPublishOptions) {
  return getNow(options).toISOString();
}

function sanitizePlainText(value: unknown) {
  return normalizeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, ' ')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, ' ')
    .replace(/javascript:/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:customer_id|order_id|reservation_id|review_request_token|token)\s*[:=]\s*[^\s#]+/gi, '[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, '[redacted-phone]')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeHashtag(value: unknown) {
  const normalized = sanitizePlainText(value).replace(/^#+/, '');
  if (!normalized || /(?:customer_id|order_id|reservation_id|review_request_token|token|\[redacted)/i.test(normalized)) {
    return '';
  }

  return normalized.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 40);
}

function buildHashtags(...groups: Array<string[] | undefined>) {
  return uniqueStrings(groups.flatMap((group) => group || []).map(sanitizeHashtag)).slice(0, 8);
}

function isSafeHttpUrl(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function appendSourceUrl(parts: string[], sourceUrl?: string) {
  const safeUrl = isSafeHttpUrl(sourceUrl);
  if (safeUrl) {
    parts.push(safeUrl);
  }
}

function clipText(text: string, limit = THREADS_TEXT_LIMIT) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 1).trim()}…`;
}

function buildText(parts: Array<string | undefined>, hashtags: string[], sourceUrl?: string) {
  const cleanedParts = parts.map(sanitizePlainText).filter(Boolean);
  appendSourceUrl(cleanedParts, sourceUrl);
  const hashtagLine = hashtags.map((hashtag) => `#${hashtag}`).join(' ');
  const text = [cleanedParts.join('\n\n'), hashtagLine].filter(Boolean).join('\n\n');
  assertNoCustomerImpersonationCopy(text);
  return clipText(text);
}

function assertThreadsJob(job: SocialPublishJob) {
  if (job.provider !== THREADS_PROVIDER) {
    throw new Error('Threads publish adapter only supports threads jobs.');
  }
}

function assertNoCustomerImpersonationCopy(caption?: string | null) {
  const normalized = normalizeText(caption);
  if (!normalized) {
    return;
  }

  const customerVoicePatterns = [
    /제가\s*(방문|다녀|먹|마셔|구매|이용|써|가봤|갔)/i,
    /제가\s*먹어봤는데요/i,
    /내가\s*직접\s*가봤/i,
    /방문했는데요/i,
    /내돈내산/i,
    /I\s+(visited|bought|tried|ate|went)/i,
    /my\s+(visit|review|experience)/i,
  ];

  if (customerVoicePatterns.some((pattern) => pattern.test(normalized))) {
    throw new Error('Customer impersonation copy is not allowed. 고객 대신 작성하는 문구는 사용할 수 없습니다.');
  }
}

function createSafeCanonicalUrl(storeId: string, sourceType: ThreadsPayloadSource['sourceType'], slug?: string) {
  const store = getDatabase().stores.find((candidate) => candidate.id === storeId);
  const storeSlug = normalizeStoreSlug(store?.slug || '');
  if (!storeSlug) {
    return undefined;
  }

  if (sourceType === 'blog_post' && slug) {
    return `https://mybiz.ai.kr/s/${storeSlug}/blog/${normalizeStoreSlug(slug)}`;
  }

  if (sourceType === 'review') {
    return `https://mybiz.ai.kr/s/${storeSlug}/reviews`;
  }

  if (sourceType === 'media') {
    return `https://mybiz.ai.kr/s/${storeSlug}/media`;
  }

  return `https://mybiz.ai.kr/s/${storeSlug}`;
}

function assertSourceMatchesJob(job: SocialPublishJob, source: ThreadsPayloadSource) {
  if (job.source_type !== source.sourceType) {
    throw new Error('Threads payload source type does not match the social publish job.');
  }
}

function assertReviewReusable(review: StoreReview) {
  if (!review.content_usage_consent) {
    throw new Error('Customer content usage consent is required before external reuse.');
  }

  if (review.visibility_status !== 'published') {
    throw new Error('Published review approval is required before external reuse.');
  }
}

function assertBlogPostReusable(post: StoreBlogPost) {
  if (post.status !== 'published') {
    throw new Error('Published blog post is required before Threads publishing.');
  }
}

function assertMediaReusable(asset: StoreMediaAsset) {
  if (asset.status !== 'ready' && asset.status !== 'published') {
    throw new Error('Media asset must be ready before Threads publishing.');
  }
}

export function createThreadsPayload(job: SocialPublishJob, source: ThreadsPayloadSource): ThreadsPayload {
  assertThreadsJob(job);
  assertSourceMatchesJob(job, source);
  assertNoCustomerImpersonationCopy(job.caption);

  if (source.sourceType === 'manual') {
    const hashtags = buildHashtags(job.hashtags);
    return {
      hashtags,
      sourceUrl: isSafeHttpUrl(source.canonicalUrl),
      text: buildText([job.caption], hashtags, source.canonicalUrl),
    };
  }

  if (source.sourceType === 'blog_post') {
    assertBlogPostReusable(source.post);
    const hashtags = buildHashtags(job.hashtags, source.post.tags);
    const sourceUrl = isSafeHttpUrl(source.canonicalUrl);
    return {
      hashtags,
      sourceUrl,
      text: buildText([job.caption, source.post.title, source.post.excerpt || source.post.body], hashtags, sourceUrl),
    };
  }

  if (source.sourceType === 'review') {
    assertReviewReusable(source.review);
    const hashtags = buildHashtags(job.hashtags, source.review.keywords);
    const sourceUrl = isSafeHttpUrl(source.canonicalUrl);
    return {
      hashtags,
      mediaUrl: isSafeHttpUrl(source.review.media_urls[0]),
      sourceUrl,
      text: buildText([job.caption, source.review.title, source.review.body], hashtags, sourceUrl),
    };
  }

  assertMediaReusable(source.asset);
  const hashtags = buildHashtags(job.hashtags, source.asset.ai_hashtags);
  const sourceUrl = isSafeHttpUrl(source.canonicalUrl);
  return {
    altText: sanitizePlainText(source.asset.alt_text),
    hashtags,
    mediaUrl: isSafeHttpUrl(source.asset.url),
    sourceUrl,
    text: buildText(
      [job.caption, source.asset.ai_title, source.asset.ai_description || source.asset.transcript],
      hashtags,
      sourceUrl,
    ),
  };
}

export async function getThreadsReadiness(storeId: string, options?: ThreadsPublishOptions): Promise<ThreadsReadiness> {
  const tokenStatus = await getProviderTokenStatus(storeId, THREADS_PROVIDER, options);
  const providerReadiness = getExternalSocialProviderReadiness(THREADS_PROVIDER, options?.env, {
    accountStatus: tokenStatus.oauthStatus,
  });
  const missingEnvNames = uniqueStrings([...providerReadiness.missingEnvNames, ...tokenStatus.missingEnvNames]);
  const ready =
    providerReadiness.status === 'ready' &&
    tokenStatus.oauthStatus === 'connected' &&
    tokenStatus.tokenEncryptionReady &&
    missingEnvNames.length === 0;

  return {
    accountStatus: tokenStatus.oauthStatus,
    enabled: providerReadiness.enabled,
    missingEnvNames,
    provider: THREADS_PROVIDER,
    ready,
    requiredScopes: EXTERNAL_SOCIAL_PROVIDER_ENV.threads.requiredScopes.slice(),
    status: providerReadiness.status,
    tokenEncryptionReady: tokenStatus.tokenEncryptionReady,
  };
}

function mapAccountRow(row: Record<string, unknown>): SocialAccount {
  return {
    access_token_encrypted: normalizeText(row.access_token_encrypted) || undefined,
    account_id: normalizeText(row.account_id || row.id),
    created_at: normalizeText(row.created_at) || new Date().toISOString(),
    display_name: normalizeText(row.display_name) || undefined,
    oauth_status: (normalizeText(row.oauth_status) || 'not_connected') as SocialAccountStatus,
    provider: THREADS_PROVIDER,
    provider_account_id: normalizeText(row.provider_account_id) || undefined,
    refresh_token_encrypted: normalizeText(row.refresh_token_encrypted) || undefined,
    scopes: Array.isArray(row.scopes) ? row.scopes.map((scope) => normalizeText(scope)).filter(Boolean) : [],
    store_id: normalizeText(row.store_id),
    token_expires_at: normalizeText(row.token_expires_at) || undefined,
    updated_at: normalizeText(row.updated_at || row.created_at) || new Date().toISOString(),
  };
}

async function readThreadsAccount(storeId: string, options?: ThreadsPublishOptions) {
  if (options?.client) {
    const { data, error } = await options.client
      .from('social_accounts')
      .select(
        'account_id,store_id,provider,provider_account_id,display_name,oauth_status,access_token_encrypted,refresh_token_encrypted,token_expires_at,scopes,created_at,updated_at',
      )
      .eq('store_id', storeId)
      .eq('provider', THREADS_PROVIDER)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load Threads account: ${error.message}`);
    }

    return data ? mapAccountRow(data as Record<string, unknown>) : null;
  }

  const account = getDatabase().social_accounts.find((entry) => entry.store_id === storeId && entry.provider === THREADS_PROVIDER);
  return account ? mapAccountRow(account as unknown as Record<string, unknown>) : null;
}

function toDbPatch(patch: MutableJobPatch) {
  return {
    error_code: patch.error_code ?? null,
    error_message: patch.error_message ?? null,
    provider_post_id: patch.provider_post_id ?? null,
    provider_url: patch.provider_url ?? null,
    published_at: patch.published_at ?? null,
    status: patch.status,
    updated_at: patch.updated_at,
  };
}

async function updateSocialPublishJob(
  storeId: string,
  job: SocialPublishJob,
  patch: MutableJobPatch,
  options?: ThreadsPublishOptions,
) {
  const nextJob: SocialPublishJob = {
    ...job,
    ...patch,
    updated_at: patch.updated_at || nowIso(options),
  };

  if (options?.client) {
    const { error } = await (options.client as SupabaseClient)
      .from('social_publish_jobs')
      .update(toDbPatch(nextJob))
      .eq('store_id', storeId)
      .eq('job_id', job.job_id);
    if (error) {
      throw new Error(`Failed to update Threads publish job: ${error.message}`);
    }
    const jobs = await listSocialPublishJobs(storeId, options);
    return jobs.find((candidate) => candidate.job_id === job.job_id) || nextJob;
  }

  updateDatabase((database) => {
    database.social_publish_jobs = database.social_publish_jobs.map((candidate) => {
      if (candidate.store_id !== storeId || candidate.job_id !== job.job_id) {
        return candidate;
      }

      return nextJob;
    });
  });

  return nextJob;
}

function assertApprovedForPublish(job: SocialPublishJob) {
  if (!job.approved_by || !job.approved_at) {
    throw new Error('Merchant approval is required before Threads publishing.');
  }

  const allowedStatuses: SocialPublishJobStatus[] = ['queued', 'waiting_approval'];
  if (!allowedStatuses.includes(job.status)) {
    throw new Error('Threads publish job must be approved before publishing.');
  }
}

async function loadPayloadSource(job: SocialPublishJob, options?: ThreadsPublishOptions): Promise<ThreadsPayloadSource> {
  if (job.source_type === 'manual') {
    return {
      canonicalUrl: createSafeCanonicalUrl(job.store_id, 'manual'),
      sourceType: 'manual',
    };
  }

  if (!job.source_id) {
    throw new Error('Source id is required before Threads publishing.');
  }

  if (job.source_type === 'blog_post') {
    const posts = await listStoreBlogPosts(job.store_id, options);
    const post = posts.find((candidate) => candidate.post_id === job.source_id);
    if (!post) {
      throw new Error('Blog post source was not found for Threads publishing.');
    }

    return {
      canonicalUrl: createSafeCanonicalUrl(job.store_id, 'blog_post', post.slug),
      post,
      sourceType: 'blog_post',
    };
  }

  if (job.source_type === 'review') {
    const reviews = await listStoreReviews(job.store_id, options);
    const review = reviews.find((candidate) => candidate.review_id === job.source_id);
    if (!review) {
      throw new Error('Review source was not found for Threads publishing.');
    }

    return {
      canonicalUrl: createSafeCanonicalUrl(job.store_id, 'review'),
      review,
      sourceType: 'review',
    };
  }

  const assets = await listStoreMediaAssets(job.store_id, options);
  const asset = assets.find((candidate) => candidate.asset_id === job.source_id);
  if (!asset) {
    throw new Error('Media source was not found for Threads publishing.');
  }

  return {
    asset,
    canonicalUrl: createSafeCanonicalUrl(job.store_id, 'media'),
    sourceType: 'media',
  };
}

function normalizeProviderUrl(value: unknown) {
  const safeUrl = isSafeHttpUrl(value);
  if (!safeUrl || !safeUrl.includes('threads.net')) {
    return undefined;
  }

  return safeUrl;
}

function redactSensitiveText(value: string) {
  return value
    .replace(/raw-[a-z0-9_-]*token[a-z0-9_-]*/gi, '[redacted-token]')
    .replace(/(access|refresh|client)_?token\s*[:=]\s*[^\s]+/gi, '$1_token=[redacted]')
    .replace(/THREADS_CLIENT_SECRET\s*[:=]\s*[^\s]+/gi, 'THREADS_CLIENT_SECRET=[redacted]')
    .replace(/threads-secret-[^\s]+/gi, '[redacted-secret]');
}

export function mapThreadsError(error: unknown) {
  if (error instanceof Error && /fake success|provider url|provider post/i.test(error.message)) {
    return {
      code: 'threads_fake_success_blocked',
      message: THREADS_FAKE_SUCCESS_MESSAGE,
    };
  }

  const rawMessage = error instanceof Error ? error.message : normalizeText(error);
  const safeDetail = redactSensitiveText(rawMessage).slice(0, 140);
  return {
    code: 'threads_publish_failed',
    message: safeDetail
      ? `Threads 게시에 실패했습니다. provider 설정과 계정 권한을 확인하세요. (${safeDetail})`
      : 'Threads 게시에 실패했습니다. provider 설정과 계정 권한을 확인하세요.',
  };
}

export async function publishThreadsPost(storeId: string, jobId: string, options?: ThreadsPublishOptions) {
  const jobs = await listSocialPublishJobs(storeId, options);
  const job = jobs.find((candidate) => candidate.job_id === jobId);
  if (!job) {
    throw new Error('Threads publish job not found.');
  }

  assertThreadsJob(job);
  assertApprovedForPublish(job);

  const readiness = await getThreadsReadiness(storeId, options);
  if (!readiness.ready) {
    return updateSocialPublishJob(
      storeId,
      job,
      {
        error_code: 'threads_not_ready',
        error_message: THREADS_NOT_READY_MESSAGE,
        provider_post_id: undefined,
        provider_url: undefined,
        status: job.status,
        updated_at: nowIso(options),
      },
      options,
    );
  }

  if (!options?.publishAdapter) {
    return updateSocialPublishJob(
      storeId,
      job,
      {
        error_code: 'threads_adapter_disabled',
        error_message: THREADS_ADAPTER_DISABLED_MESSAGE,
        provider_post_id: undefined,
        provider_url: undefined,
        status: job.status,
        updated_at: nowIso(options),
      },
      options,
    );
  }

  const account = await readThreadsAccount(storeId, options);
  if (!account?.access_token_encrypted) {
    return updateSocialPublishJob(
      storeId,
      job,
      {
        error_code: 'threads_token_missing',
        error_message: THREADS_TOKEN_MESSAGE,
        provider_post_id: undefined,
        provider_url: undefined,
        status: job.status,
        updated_at: nowIso(options),
      },
      options,
    );
  }

  const source = await loadPayloadSource(job, options);
  const payload = createThreadsPayload(job, source);

  let accessToken: string;
  try {
    accessToken = decryptOAuthToken(account.access_token_encrypted, { env: options?.env });
  } catch {
    return updateSocialPublishJob(
      storeId,
      job,
      {
        error_code: 'threads_token_decrypt_failed',
        error_message: THREADS_TOKEN_MESSAGE,
        provider_post_id: undefined,
        provider_url: undefined,
        status: 'failed',
        updated_at: nowIso(options),
      },
      options,
    );
  }

  const publishingJob = await updateSocialPublishJob(
    storeId,
    job,
    {
      error_code: undefined,
      error_message: undefined,
      provider_post_id: undefined,
      provider_url: undefined,
      status: 'publishing',
      updated_at: nowIso(options),
    },
    options,
  );

  try {
    const result = await options.publishAdapter({
      accessToken,
      payload,
      storeId,
    });
    const providerPostId = normalizeText(result.providerPostId);
    const providerUrl = normalizeProviderUrl(result.providerUrl);
    if (!providerPostId || !providerUrl) {
      throw new Error('fake success: provider post id and provider url are required');
    }

    return updateSocialPublishJob(
      storeId,
      publishingJob,
      {
        error_code: undefined,
        error_message: undefined,
        provider_post_id: providerPostId,
        provider_url: providerUrl,
        published_at: nowIso(options),
        status: 'published',
        updated_at: nowIso(options),
      },
      options,
    );
  } catch (error) {
    const safeError = mapThreadsError(error);
    return updateSocialPublishJob(
      storeId,
      publishingJob,
      {
        error_code: safeError.code,
        error_message: safeError.message,
        provider_post_id: undefined,
        provider_url: undefined,
        status: 'failed',
        updated_at: nowIso(options),
      },
      options,
    );
  }
}
