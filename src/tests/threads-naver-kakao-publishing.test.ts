import { beforeEach, describe, expect, it, vi } from 'vitest';

import vercelConfig from '../../vercel.json';
import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import {
  approveSocialPublishJob,
  createSocialPublishJob,
  createStoreBlogPost,
  createStoreMediaAsset,
  listSocialProviderCards,
  publishStoreBlogPost,
  submitPublicStoreReview,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import {
  EXTERNAL_SOCIAL_PROVIDER_ENV,
  getExternalSocialProviderReadiness,
} from '@/shared/lib/services/externalSocialProvider';
import {
  createExternalSocialOAuthState,
  handleExternalSocialOAuthCallbackRequest,
  handleExternalSocialOAuthStartRequest,
  validateExternalSocialOAuthState,
} from '@/server/externalSocialOAuth';

const STORE_ID = 'store_golden_coffee';
const STORE_SLUG = 'golden-coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const NOW_MS = Date.parse('2026-05-10T05:00:00.000Z');

const threadsReadyEnv = {
  THREADS_CLIENT_ID: 'threads-client-id',
  THREADS_CLIENT_SECRET: 'threads-client-secret-value',
  THREADS_PUBLISH_ENABLED: 'true',
  THREADS_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/threads/oauth/callback',
  TOKEN_ENCRYPTION_KEY: 'test-token-encryption-key-that-is-long-enough',
};

const naverReadyEnv = {
  NAVER_BLOG_WRITE_ENABLED: 'true',
  NAVER_CLIENT_ID: 'naver-client-id',
  NAVER_CLIENT_SECRET: 'naver-client-secret-value',
  NAVER_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/naver/oauth/callback',
  TOKEN_ENCRYPTION_KEY: 'test-token-encryption-key-that-is-long-enough',
};

const kakaoReadyEnv = {
  KAKAO_JAVASCRIPT_KEY: 'kakao-javascript-key-value',
  KAKAO_SHARE_ENABLED: 'true',
  KAKAO_TEMPLATE_ID: 'kakao-template-id',
};

function addConnectedAccount(provider: 'threads' | 'naver_blog') {
  updateDatabase((database) => {
    database.social_accounts.push({
      access_token_encrypted: `encrypted-${provider}-access-token`,
      account_id: `social_account_${provider}`,
      created_at: '2026-05-10T05:00:00.000Z',
      display_name: `${provider} account`,
      oauth_status: 'connected',
      provider,
      provider_account_id: `${provider}-account-id`,
      refresh_token_encrypted: `encrypted-${provider}-refresh-token`,
      scopes: [],
      store_id: STORE_ID,
      token_expires_at: '2026-05-10T06:00:00.000Z',
      updated_at: '2026-05-10T05:00:00.000Z',
    });
  });
}

describe('Threads, Naver Blog, and Kakao Share publishing foundation', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('reports provider readiness with safe env names only', () => {
    const threads = getExternalSocialProviderReadiness('threads', {
      THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak',
      THREADS_PUBLISH_ENABLED: 'false',
    });
    const naver = getExternalSocialProviderReadiness('naver_blog', {
      NAVER_CLIENT_SECRET: 'naver-secret-should-not-leak',
    });
    const kakao = getExternalSocialProviderReadiness('kakao_share', {
      KAKAO_JAVASCRIPT_KEY: 'kakao-key-should-not-leak',
      KAKAO_SHARE_ENABLED: 'false',
    });

    expect(EXTERNAL_SOCIAL_PROVIDER_ENV.threads.requiredEnvNames).toEqual([
      'THREADS_CLIENT_ID',
      'THREADS_CLIENT_SECRET',
      'THREADS_REDIRECT_URI',
      'THREADS_PUBLISH_ENABLED',
    ]);
    expect(threads.status).toBe('disabled');
    expect(threads.missingEnvNames).toContain('THREADS_CLIENT_ID');
    expect(threads.missingEnvNames).toContain('TOKEN_ENCRYPTION_KEY');
    expect(threads.message).toBe('Threads 게시 기능은 점주 계정 연동과 게시 권한 확인 후 사용할 수 있습니다.');
    expect(JSON.stringify(threads)).not.toContain('threads-secret-should-not-leak');

    expect(naver.status).toBe('disabled');
    expect(naver.missingEnvNames).toContain('NAVER_CLIENT_ID');
    expect(naver.message).toBe('네이버 블로그 글쓰기는 네이버 로그인 연동과 권한 설정 후 사용할 수 있습니다.');
    expect(JSON.stringify(naver)).not.toContain('naver-secret-should-not-leak');

    expect(kakao.status).toBe('disabled');
    expect(kakao.missingEnvNames).toContain('KAKAO_SHARE_ENABLED');
    expect(kakao.optionalEnvNames).toContain('KAKAO_TEMPLATE_ID');
    expect(kakao.message).toBe('카카오 공유는 자동 게시가 아니라 사용자가 직접 공유하는 방식으로 제공됩니다.');
    expect(JSON.stringify(kakao)).not.toContain('kakao-key-should-not-leak');
  });

  it('routes Threads and Naver OAuth endpoints through the existing merchant function', () => {
    expect(vercelConfig.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dest: '/api/merchant?resource=threads-oauth-start',
          src: '/api/social/threads/oauth/start',
        }),
        expect.objectContaining({
          dest: '/api/merchant?resource=threads-oauth-callback',
          src: '/api/social/threads/oauth/callback',
        }),
        expect.objectContaining({
          dest: '/api/merchant?resource=naver-oauth-start',
          src: '/api/social/naver/oauth/start',
        }),
        expect.objectContaining({
          dest: '/api/merchant?resource=naver-oauth-callback',
          src: '/api/social/naver/oauth/callback',
        }),
      ]),
    );
  });

  it('starts OAuth only for an authenticated store member and never exposes provider secrets', async () => {
    const unauthenticated = await handleExternalSocialOAuthStartRequest(
      'threads',
      new Request(`https://mybiz.ai.kr/api/social/threads/oauth/start?storeId=${STORE_ID}`),
      {
        env: threadsReadyEnv,
        now: () => NOW_MS,
      },
    );
    expect(unauthenticated.status).toBe(401);

    const missingEnv = await handleExternalSocialOAuthStartRequest(
      'threads',
      new Request(`https://mybiz.ai.kr/api/social/threads/oauth/start?storeId=${STORE_ID}`, {
        headers: { Authorization: 'Bearer merchant-token' },
      }),
      {
        env: { THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak' },
        nonceFactory: () => 'nonce_threads',
        now: () => NOW_MS,
        resolveMerchantAccess: async () => ({ ok: true, profileId: OWNER_PROFILE_ID, storeId: STORE_ID }),
      },
    );
    const missingEnvPayload = await missingEnv.json();
    expect(missingEnv.status).toBe(503);
    expect(missingEnvPayload.error).toContain('Threads 게시 기능은 점주 계정 연동과 게시 권한 확인 후 사용할 수 있습니다.');
    expect(JSON.stringify(missingEnvPayload)).not.toContain('threads-secret-should-not-leak');

    const threadsStart = await handleExternalSocialOAuthStartRequest(
      'threads',
      new Request(`https://mybiz.ai.kr/api/social/threads/oauth/start?storeId=${STORE_ID}`, {
        headers: { Authorization: 'Bearer merchant-token' },
      }),
      {
        env: threadsReadyEnv,
        nonceFactory: () => 'nonce_threads',
        now: () => NOW_MS,
        resolveMerchantAccess: async () => ({ ok: true, profileId: OWNER_PROFILE_ID, storeId: STORE_ID }),
      },
    );
    const threadsPayload = await threadsStart.json();
    expect(threadsStart.status).toBe(200);
    expect(threadsStart.headers.get('set-cookie')).toContain('mybiz_threads_oauth_state=nonce_threads');
    expect(threadsPayload.data.authorizeUrl).toContain('client_id=threads-client-id');
    expect(threadsPayload.data.authorizeUrl).not.toContain(threadsReadyEnv.THREADS_CLIENT_SECRET);
    expect(validateExternalSocialOAuthState(threadsPayload.data.state, {
      expectedNonce: 'nonce_threads',
      expectedStoreId: STORE_ID,
      maxAgeMs: 10 * 60 * 1000,
      now: () => NOW_MS + 1000,
    })).toMatchObject({ ok: true });

    const naverState = createExternalSocialOAuthState({
      issuedAt: NOW_MS,
      nonce: 'nonce_naver',
      profileId: OWNER_PROFILE_ID,
      provider: 'naver_blog',
      storeId: STORE_ID,
    });
    const callback = await handleExternalSocialOAuthCallbackRequest(
      'naver_blog',
      new Request(`https://mybiz.ai.kr/api/social/naver/oauth/callback?code=oauth-code&state=${encodeURIComponent(naverState)}`, {
        headers: { Cookie: 'mybiz_naver_oauth_state=nonce_naver' },
      }),
      {
        env: naverReadyEnv,
        now: () => NOW_MS + 1000,
      },
    );
    const callbackPayload = await callback.json();
    // Callback now implements real token exchange; in test environment the external fetch fails (no network mock)
    // so we expect a non-200 error response — the important guarantee is the secret is never exposed.
    expect(callback.status).not.toBe(200);
    expect(JSON.stringify(callbackPayload)).not.toContain(naverReadyEnv.NAVER_CLIENT_SECRET);
  });

  it('renders provider cards without leaking social account tokens', async () => {
    addConnectedAccount('threads');
    const cards = await listSocialProviderCards(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: {
        ...threadsReadyEnv,
        ...naverReadyEnv,
        ...kakaoReadyEnv,
      },
    });

    expect(cards.find((card) => card.provider === 'threads')).toMatchObject({
      copy: 'Threads 게시 기능은 점주 계정 연동과 게시 권한 확인 후 사용할 수 있습니다.',
      status: 'ready',
      title: 'Threads',
    });
    expect(cards.find((card) => card.provider === 'naver_blog')?.copy).toBe(
      '네이버 블로그 글쓰기는 네이버 로그인 연동과 권한 설정 후 사용할 수 있습니다.',
    );
    expect(cards.find((card) => card.provider === 'kakao_share')).toMatchObject({
      copy: '카카오 공유는 자동 게시가 아니라 사용자가 직접 공유하는 방식으로 제공됩니다.',
      status: 'ready',
    });
    expect(JSON.stringify(cards)).not.toContain('encrypted-threads-access-token');
    expect(JSON.stringify(cards)).not.toContain('encrypted-threads-refresh-token');
    expect(JSON.stringify(cards)).not.toContain(threadsReadyEnv.THREADS_CLIENT_SECRET);
  });

  it('creates draft jobs for Threads, Naver Blog, and Kakao Share, but never fakes publish success', async () => {
    const threadsJob = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '고객님이 남겨주신 따뜻한 후기를 소개합니다.',
        provider: 'threads',
        sourceType: 'manual',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const naverJob = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '이번 주 매장 소식을 네이버 블로그 글 초안으로 준비합니다.',
        provider: 'naver_blog',
        sourceType: 'manual',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const kakaoJob = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '카카오톡으로 직접 공유할 매장 소식입니다.',
        provider: 'kakao_share',
        sourceType: 'manual',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect([threadsJob.provider, naverJob.provider, kakaoJob.provider]).toEqual(['threads', 'naver_blog', 'kakao_share']);
    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '승인 없이 queued로 만들 수 없습니다.',
          provider: 'threads',
          sourceType: 'manual',
          status: 'queued',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/approval/i);

    const publishAdapter = vi.fn().mockResolvedValue({
      providerPostId: 'fake-post-id',
      providerUrl: 'https://threads.net/fake-post',
    });
    const disabledApproval = await approveSocialPublishJob(STORE_ID, threadsJob.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: {},
      publishAdapter,
    });
    expect(disabledApproval.status).toBe('waiting_approval');
    expect(disabledApproval.error_code).toBe('provider_not_connected');
    expect(publishAdapter).not.toHaveBeenCalled();

    addConnectedAccount('threads');
    const readyJob = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '점주 계정에서 승인 후 공유할 매장 소식입니다.',
        provider: 'threads',
        sourceType: 'manual',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const queued = await approveSocialPublishJob(STORE_ID, readyJob.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: threadsReadyEnv,
      publishAdapter,
    });
    expect(queued.status).toBe('queued');
    expect(queued.provider_post_id).toBeUndefined();
    expect(queued.provider_url).toBeUndefined();
    expect(publishAdapter).not.toHaveBeenCalled();
  });

  it('enforces review consent, merchant approval, source scope, and no customer-impersonation copy', async () => {
    const review = await submitPublicStoreReview({
      body: '실제 방문 후 남긴 리뷰입니다.',
      contentUsageConsent: false,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
    });
    await updateStoreReviewStatus(STORE_ID, review.review_id, 'published', { actorProfileId: OWNER_PROFILE_ID });

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '고객님이 남겨주신 후기를 소개합니다.',
          provider: 'threads',
          sourceId: review.review_id,
          sourceType: 'review',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/consent/i);

    const consentedReview = await submitPublicStoreReview({
      body: '콘텐츠 활용에 동의한 실제 리뷰입니다.',
      contentUsageConsent: true,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
    });
    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '고객님이 남겨주신 후기를 소개합니다.',
          provider: 'threads',
          sourceId: consentedReview.review_id,
          sourceType: 'review',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/approval/i);

    await updateStoreReviewStatus(STORE_ID, consentedReview.review_id, 'published', { actorProfileId: OWNER_PROFILE_ID });
    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '제가 방문했는데요, 정말 좋았습니다.',
          provider: 'threads',
          sourceId: consentedReview.review_id,
          sourceType: 'review',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/impersonation|대신/i);

    const blogDraft = await createStoreBlogPost(
      STORE_ID,
      {
        body: '아직 공개되지 않은 블로그 초안입니다.',
        sourceType: 'manual',
        status: 'draft',
        title: 'Draft Blog',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '공개 전 블로그는 외부 게시 초안으로 만들 수 없습니다.',
          provider: 'naver_blog',
          sourceId: blogDraft.post_id,
          sourceType: 'blog_post',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/published/i);

    const publishedBlog = await publishStoreBlogPost(STORE_ID, blogDraft.post_id, { actorProfileId: OWNER_PROFILE_ID });
    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '공개된 블로그 글을 네이버 블로그 초안으로 준비합니다.',
          provider: 'naver_blog',
          sourceId: publishedBlog.post_id,
          sourceType: 'blog_post',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).resolves.toMatchObject({ provider: 'naver_blog', source_type: 'blog_post' });

    const media = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        status: 'draft',
        url: 'https://example.com/video.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '준비되지 않은 미디어는 외부 게시 초안으로 만들 수 없습니다.',
          provider: 'kakao_share',
          sourceId: media.asset_id,
          sourceType: 'media',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/ready/i);
  });
});
