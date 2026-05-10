import type { SupabaseClient } from '@supabase/supabase-js';

import {
  listSocialPublishJobs,
  listStoreBlogPosts,
  listStoreMediaAssets,
  listStoreReviews,
} from '../shared/lib/services/contentEngineService.js';
import {
  getExternalSocialProviderReadiness,
  type ExternalSocialEnv,
} from '../shared/lib/services/externalSocialProvider.js';
import { getDatabase, updateDatabase } from '../shared/lib/mockDb.js';
import type {
  SocialAccount,
  SocialPublishJob,
  StoreBlogPost,
  StoreMediaAsset,
  StoreReview,
} from '../shared/types/models.js';
import { decryptOAuthToken, getTokenVaultReadiness, type TokenVaultEnv } from './oauthTokenVault.js';
import { getProviderTokenStatus, type ProviderTokenStatus } from './socialAccountTokens.js';

export interface NaverBlogAdapterEnv extends ExternalSocialEnv, TokenVaultEnv {}

export interface NaverBlogAdapterOptions {
  actorProfileId?: string;
  client?: SupabaseClient;
  env?: NaverBlogAdapterEnv;
  now?: Date | (() => Date);
}

export interface NaverBlogReadiness {
  accountConnected: boolean;
  message: string;
  missingEnvNames: string[];
  oauthStatus: ProviderTokenStatus['oauthStatus'];
  publishEnabled: boolean;
  ready: boolean;
  status: 'disabled' | 'missing_config' | 'not_connected' | 'ready' | 'error';
  tokenEncryptionReady: boolean;
}

export interface NaverBlogPayload {
  backlinkUrl?: string;
  categoryNo?: string;
  contents: string;
  openYn: 'Y' | 'N';
  sourceCanonicalUrl?: string;
  tags: string[];
  title: string;
}

export type NaverBlogPayloadSource =
  | {
      blogPost: StoreBlogPost;
      sourceType: 'blog_post';
      storeSlug?: string;
    }
  | {
      review: StoreReview;
      sourceType: 'review';
      storeSlug?: string;
    }
  | {
      mediaAsset: StoreMediaAsset;
      sourceType: 'media';
      storeSlug?: string;
    }
  | {
      sourceType: 'manual';
      storeSlug?: string;
    };

export interface NaverBlogWritePostInput {
  accessToken: string;
  payload: NaverBlogPayload;
}

export interface NaverBlogWritePostResult {
  providerPostId?: string;
  providerUrl?: string;
}

export interface PublishNaverBlogPostOptions extends NaverBlogAdapterOptions {
  writePostAdapter?: (input: NaverBlogWritePostInput) => Promise<NaverBlogWritePostResult> | NaverBlogWritePostResult;
}

const NAVER_BLOG_SAFE_ACCOUNT_COLUMNS =
  'account_id,store_id,provider,provider_account_id,display_name,oauth_status,access_token_encrypted,refresh_token_encrypted,token_expires_at,scopes,created_at,updated_at';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getNow(options?: NaverBlogAdapterOptions) {
  if (typeof options?.now === 'function') {
    return options.now();
  }

  return options?.now || new Date();
}

function nowIso(options?: NaverBlogAdapterOptions) {
  return getNow(options).toISOString();
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

function mapSocialAccount(row: Record<string, unknown>): SocialAccount {
  return {
    access_token_encrypted: normalizeText(row.access_token_encrypted) || undefined,
    account_id: normalizeText(row.account_id || row.id),
    created_at: normalizeText(row.created_at) || new Date().toISOString(),
    display_name: normalizeText(row.display_name) || undefined,
    oauth_status: (normalizeText(row.oauth_status) || 'not_connected') as SocialAccount['oauth_status'],
    provider: 'naver_blog',
    provider_account_id: normalizeText(row.provider_account_id) || undefined,
    refresh_token_encrypted: normalizeText(row.refresh_token_encrypted) || undefined,
    scopes: toStringArray(row.scopes),
    store_id: normalizeText(row.store_id),
    token_expires_at: normalizeText(row.token_expires_at) || undefined,
    updated_at: normalizeText(row.updated_at || row.created_at) || new Date().toISOString(),
  };
}

function mapSocialPublishJob(row: Record<string, unknown>): SocialPublishJob {
  return {
    approved_at: normalizeText(row.approved_at) || undefined,
    approved_by: normalizeText(row.approved_by) || undefined,
    caption: normalizeText(row.caption) || undefined,
    created_at: normalizeText(row.created_at) || new Date().toISOString(),
    error_code: normalizeText(row.error_code) || undefined,
    error_message: normalizeText(row.error_message) || undefined,
    hashtags: toStringArray(row.hashtags),
    job_id: normalizeText(row.job_id || row.id),
    provider: normalizeText(row.provider) as SocialPublishJob['provider'],
    provider_post_id: normalizeText(row.provider_post_id) || undefined,
    provider_url: normalizeText(row.provider_url) || undefined,
    published_at: normalizeText(row.published_at) || undefined,
    source_id: normalizeText(row.source_id) || undefined,
    source_type: normalizeText(row.source_type) as SocialPublishJob['source_type'],
    status: normalizeText(row.status) as SocialPublishJob['status'],
    store_id: normalizeText(row.store_id),
    updated_at: normalizeText(row.updated_at || row.created_at) || new Date().toISOString(),
  };
}

function sanitizeTitle(value: string) {
  return normalizeText(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).slice(0, 120);
}

function redactPrivateIdentifiers(value: string) {
  return value
    .replace(/\b(customer_id|order_id|reservation_id|review_request_token|token)\s*=\s*["']?[^"'\s<>&]+["']?/gi, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, '[redacted]');
}

function sanitizeHtml(value: string) {
  return redactPrivateIdentifiers(value)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
    .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeTags(tags: string[] = []) {
  return [...new Set(tags.map((tag) => sanitizeTitle(tag).replace(/^#/, '')).filter(Boolean))].slice(0, 10);
}

function detectCustomerImpersonationCopy(value: string) {
  return /(제가\s*(방문|먹어|가봤|사봤|이용|주문)|내가\s*직접\s*(가봤|먹어|방문)|I\s+(visited|tried|ate|went|bought))/i.test(
    value,
  );
}

function buildPublicBaseUrl(storeSlug?: string) {
  const normalizedStoreSlug = normalizeText(storeSlug);
  return normalizedStoreSlug ? `https://mybiz.ai.kr/s/${encodeURIComponent(normalizedStoreSlug)}` : undefined;
}

function buildCanonicalUrl(source: NaverBlogPayloadSource) {
  const baseUrl = buildPublicBaseUrl(source.storeSlug);
  if (!baseUrl) {
    return undefined;
  }

  if (source.sourceType === 'blog_post') {
    return `${baseUrl}/blog/${encodeURIComponent(source.blogPost.slug)}`;
  }

  if (source.sourceType === 'review') {
    return `${baseUrl}#reviews`;
  }

  if (source.sourceType === 'media') {
    return source.mediaAsset.url;
  }

  return baseUrl;
}

function appendBacklink(contents: string, source: NaverBlogPayloadSource) {
  const canonicalUrl = buildCanonicalUrl(source);
  if (!canonicalUrl) {
    return contents;
  }

  return `${contents}\n\n<p>MyBiz 매장 콘텐츠 원문: <a href="${canonicalUrl}" rel="noopener noreferrer">${canonicalUrl}</a></p>`;
}

export function createNaverBlogPayload(job: SocialPublishJob, source: NaverBlogPayloadSource): NaverBlogPayload {
  const title =
    source.sourceType === 'blog_post'
      ? source.blogPost.title
      : source.sourceType === 'review'
        ? '고객 후기를 바탕으로 전하는 매장 소식'
        : source.sourceType === 'media'
          ? source.mediaAsset.ai_title || source.mediaAsset.alt_text || '매장 미디어 소식'
          : job.caption || 'MyBiz 매장 소식';
  const body =
    source.sourceType === 'blog_post'
      ? source.blogPost.body
      : source.sourceType === 'review'
        ? `고객님이 남겨주신 후기를 바탕으로 매장 소식을 전합니다.\n\n${source.review.body}`
        : source.sourceType === 'media'
          ? `${source.mediaAsset.ai_description || source.mediaAsset.alt_text || '매장 미디어를 소개합니다.'}\n\n${source.mediaAsset.url}`
          : job.caption || '';
  const candidateContents = appendBacklink(sanitizeHtml(body), source);
  if (detectCustomerImpersonationCopy(`${title}\n${candidateContents}\n${job.caption || ''}`)) {
    throw new Error('Customer impersonation copy is not allowed for Naver Blog publishing.');
  }

  return {
    backlinkUrl: buildPublicBaseUrl(source.storeSlug),
    contents: candidateContents,
    openYn: 'Y',
    sourceCanonicalUrl: buildCanonicalUrl(source),
    tags: sanitizeTags(source.sourceType === 'blog_post' ? source.blogPost.tags : job.hashtags),
    title: sanitizeTitle(title) || 'MyBiz 매장 소식',
  };
}

export function mapNaverError(_error: unknown) {
  return {
    errorCode: 'naver_blog_publish_failed',
    errorMessage: '네이버 블로그 발행에 실패했습니다. 계정 연결과 게시 설정을 확인해 주세요.',
  };
}

export async function getNaverBlogReadiness(
  storeId: string,
  options?: NaverBlogAdapterOptions,
): Promise<NaverBlogReadiness> {
  const vaultReadiness = getTokenVaultReadiness(options?.env);
  let tokenStatus: ProviderTokenStatus;
  try {
    tokenStatus = await getProviderTokenStatus(storeId, 'naver_blog', options);
  } catch (error) {
    if (/store member/i.test(error instanceof Error ? error.message : String(error))) {
      throw error;
    }
    tokenStatus = {
      missingEnvNames: vaultReadiness.ready ? [] : ['TOKEN_ENCRYPTION_KEY'],
      oauthStatus: 'not_connected',
      provider: 'naver_blog',
      scopes: [],
      tokenEncryptionReady: vaultReadiness.ready,
      tokenExpired: false,
      tokenExpiringSoon: false,
    };
  }
  const providerReadiness = getExternalSocialProviderReadiness('naver_blog', options?.env, {
    accountStatus: tokenStatus.oauthStatus,
  });
  const missingEnvNames = [...new Set([...providerReadiness.missingEnvNames, ...tokenStatus.missingEnvNames])];
  const accountConnected = tokenStatus.oauthStatus === 'connected';
  const ready = providerReadiness.publishReady && vaultReadiness.ready && accountConnected;
  const status: NaverBlogReadiness['status'] = ready
    ? 'ready'
    : missingEnvNames.length
      ? 'missing_config'
      : !providerReadiness.enabled
        ? 'disabled'
        : !accountConnected
          ? 'not_connected'
          : 'error';

  return {
    accountConnected,
    message: ready
      ? '네이버 블로그 글쓰기는 네이버 계정 연결과 게시 설정이 완료되었습니다.'
      : '네이버 블로그 글쓰기는 네이버 계정 연결과 게시 설정이 완료된 뒤 사용할 수 있습니다.',
    missingEnvNames,
    oauthStatus: tokenStatus.oauthStatus,
    publishEnabled: providerReadiness.enabled,
    ready,
    status,
    tokenEncryptionReady: vaultReadiness.ready,
  };
}

async function loadNaverAccountWithToken(storeId: string, options?: NaverBlogAdapterOptions) {
  if (options?.client) {
    const { data, error } = await options.client
      .from('social_accounts')
      .select(NAVER_BLOG_SAFE_ACCOUNT_COLUMNS)
      .eq('store_id', storeId)
      .eq('provider', 'naver_blog')
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load Naver Blog account: ${error.message}`);
    }

    return data ? mapSocialAccount(data as Record<string, unknown>) : null;
  }

  const account = getDatabase().social_accounts.find((entry) => entry.store_id === storeId && entry.provider === 'naver_blog');
  return account ? mapSocialAccount(account as unknown as Record<string, unknown>) : null;
}

async function findNaverJob(storeId: string, jobId: string, options?: NaverBlogAdapterOptions) {
  const job = (await listSocialPublishJobs(storeId, options)).find((candidate) => candidate.job_id === jobId);
  if (!job || job.provider !== 'naver_blog') {
    throw new Error('Naver Blog publish job not found.');
  }

  return job;
}

async function patchNaverJob(
  storeId: string,
  jobId: string,
  patch: Partial<SocialPublishJob>,
  options?: NaverBlogAdapterOptions,
) {
  const updatePayload = {
    approved_at: patch.approved_at ?? undefined,
    approved_by: patch.approved_by ?? undefined,
    error_code: patch.error_code ?? null,
    error_message: patch.error_message ?? null,
    provider_post_id: patch.provider_post_id ?? null,
    provider_url: patch.provider_url ?? null,
    published_at: patch.published_at ?? null,
    status: patch.status,
    updated_at: patch.updated_at || nowIso(options),
  };

  if (options?.client) {
    const { data, error } = await options.client
      .from('social_publish_jobs')
      .update(updatePayload)
      .eq('store_id', storeId)
      .eq('job_id', jobId)
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to update Naver Blog publish job: ${error.message}`);
    }

    return mapSocialPublishJob(data as Record<string, unknown>);
  }

  let updated: SocialPublishJob | null = null;
  updateDatabase((database) => {
    database.social_publish_jobs = database.social_publish_jobs.map((job) => {
      if (job.store_id !== storeId || job.job_id !== jobId) {
        return job;
      }

      updated = {
        ...job,
        ...patch,
        updated_at: patch.updated_at || updatePayload.updated_at,
      };
      return updated;
    });
  });

  if (!updated) {
    throw new Error('Naver Blog publish job not found.');
  }

  return updated;
}

async function loadPayloadSource(storeId: string, job: SocialPublishJob, options?: NaverBlogAdapterOptions) {
  const storeSlug = await resolveStoreSlug(storeId, options);
  if (job.source_type === 'blog_post') {
    const blogPost = (await listStoreBlogPosts(storeId, options)).find((post) => post.post_id === job.source_id);
    if (!blogPost || blogPost.status !== 'published') {
      throw new Error('Published blog post is required before Naver Blog publishing.');
    }

    return { blogPost, sourceType: 'blog_post' as const, storeSlug };
  }

  if (job.source_type === 'review') {
    const review = (await listStoreReviews(storeId, options)).find((candidate) => candidate.review_id === job.source_id);
    if (!review || review.visibility_status !== 'published' || !review.content_usage_consent) {
      throw new Error('Customer content usage consent and published review status are required before Naver Blog publishing.');
    }

    return { review, sourceType: 'review' as const, storeSlug };
  }

  if (job.source_type === 'media') {
    const mediaAsset = (await listStoreMediaAssets(storeId, options)).find((asset) => asset.asset_id === job.source_id);
    if (!mediaAsset || (mediaAsset.status !== 'ready' && mediaAsset.status !== 'published')) {
      throw new Error('Ready media asset is required before Naver Blog publishing.');
    }

    return { mediaAsset, sourceType: 'media' as const, storeSlug };
  }

  return { sourceType: 'manual' as const, storeSlug };
}

async function resolveStoreSlug(storeId: string, options?: NaverBlogAdapterOptions) {
  if (options?.client) {
    const { data, error } = await options.client.from('stores').select('slug').eq('store_id', storeId).maybeSingle();
    if (error) {
      return undefined;
    }

    return normalizeText((data as { slug?: string } | null)?.slug) || undefined;
  }

  return getDatabase().stores.find((store) => (store.store_id || store.id) === storeId)?.slug;
}

function assertApprovedForPublish(job: SocialPublishJob) {
  if (!job.approved_at || !job.approved_by) {
    throw new Error('Merchant approval is required before Naver Blog publishing.');
  }

  if (job.status !== 'queued' && job.status !== 'waiting_approval') {
    throw new Error('Naver Blog publish job must be approved and ready before publishing.');
  }
}

function validateNaverPublishResult(result: NaverBlogWritePostResult) {
  const providerPostId = normalizeText(result.providerPostId);
  const providerUrl = normalizeText(result.providerUrl);
  if (!providerPostId || !/^https:\/\//i.test(providerUrl)) {
    throw new Error('Naver Blog writePost did not return a valid post id and URL.');
  }

  return { providerPostId, providerUrl };
}

export async function publishNaverBlogPost(
  storeId: string,
  jobId: string,
  options?: PublishNaverBlogPostOptions,
) {
  const job = await findNaverJob(storeId, jobId, options);
  assertApprovedForPublish(job);

  const readiness = await getNaverBlogReadiness(storeId, options);
  if (!readiness.ready) {
    return patchNaverJob(
      storeId,
      jobId,
      {
        error_code: 'naver_blog_not_ready',
        error_message: readiness.message,
        status: job.status,
      },
      options,
    );
  }

  const account = await loadNaverAccountWithToken(storeId, options);
  if (!account?.access_token_encrypted) {
    return patchNaverJob(
      storeId,
      jobId,
      {
        error_code: 'naver_blog_not_ready',
        error_message: '네이버 블로그 계정 토큰 연결이 필요합니다.',
        status: job.status,
      },
      options,
    );
  }

  if (!options?.writePostAdapter) {
    return patchNaverJob(
      storeId,
      jobId,
      {
        error_code: 'naver_blog_adapter_disabled',
        error_message: '네이버 블로그 발행 adapter가 아직 설정되지 않았습니다.',
        status: job.status,
      },
      options,
    );
  }

  const payloadSource = await loadPayloadSource(storeId, job, options);
  const payload = createNaverBlogPayload(job, payloadSource);
  const accessToken = decryptOAuthToken(account.access_token_encrypted, { env: options?.env });
  await patchNaverJob(
    storeId,
    jobId,
    {
      error_code: undefined,
      error_message: undefined,
      status: 'publishing',
    },
    options,
  );

  try {
    const result = validateNaverPublishResult(await options.writePostAdapter({ accessToken, payload }));
    const timestamp = nowIso(options);
    return patchNaverJob(
      storeId,
      jobId,
      {
        error_code: undefined,
        error_message: undefined,
        provider_post_id: result.providerPostId,
        provider_url: result.providerUrl,
        published_at: timestamp,
        status: 'published',
        updated_at: timestamp,
      },
      options,
    );
  } catch (error) {
    const mapped = mapNaverError(error);
    return patchNaverJob(
      storeId,
      jobId,
      {
        error_code: mapped.errorCode,
        error_message: mapped.errorMessage,
        provider_post_id: undefined,
        provider_url: undefined,
        status: 'failed',
      },
      options,
    );
  }
}
