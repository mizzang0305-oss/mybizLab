import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import {
  approveSocialPublishJob,
  createSocialPublishJob,
  createStoreBlogPost,
  createStoreMediaAsset,
  listSocialPublishJobs,
  publishStoreBlogPost,
  submitPublicStoreReview,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import { getYouTubeProviderReadiness } from '@/shared/lib/services/youtubeProvider';
import { saveProviderTokens } from '@/server/socialAccountTokens';
import {
  createThreadsPayload,
  getThreadsReadiness,
  publishThreadsPost,
} from '@/server/threadsPublishAdapter';

const STORE_ID = 'store_golden_coffee';
const OTHER_STORE_ID = 'store_mint_bakery';
const STORE_SLUG = 'golden-coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';

const tokenEnv = {
  TOKEN_ENCRYPTION_KEY: 'threads-token-vault-test-key-0123456789',
};

const threadsReadyEnv = {
  ...tokenEnv,
  THREADS_CLIENT_ID: 'threads-client-id',
  THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak',
  THREADS_PUBLISH_ENABLED: 'true',
  THREADS_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/threads/oauth/callback',
};

async function connectThreadsAccount() {
  await saveProviderTokens(
    STORE_ID,
    'threads',
    {
      accessToken: 'raw-threads-access-token-should-not-leak',
      displayName: 'Golden Threads',
      expiresAt: '2026-05-12T00:00:00.000Z',
      providerAccountId: 'threads-profile-1',
      refreshToken: 'raw-threads-refresh-token-should-not-leak',
      scopes: ['threads_basic', 'threads_content_publish'],
    },
    { actorProfileId: OWNER_PROFILE_ID, env: tokenEnv },
  );
}

async function createApprovedThreadsJob(caption = '고객님이 남겨주신 후기를 바탕으로 매장 소식을 전합니다.') {
  const job = await createSocialPublishJob(
    STORE_ID,
    {
      caption,
      provider: 'threads',
      sourceType: 'manual',
      status: 'draft',
    },
    { actorProfileId: OWNER_PROFILE_ID },
  );

  return approveSocialPublishJob(STORE_ID, job.job_id, {
    actorProfileId: OWNER_PROFILE_ID,
    env: threadsReadyEnv,
  });
}

describe('Threads publish adapter foundation', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('reports readiness with safe env names and requires the token vault plus a connected account', async () => {
    const missing = await getThreadsReadiness(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak' },
    });

    expect(missing.ready).toBe(false);
    expect(missing.status).toBe('disabled');
    expect(missing.missingEnvNames).toEqual(
      expect.arrayContaining(['THREADS_CLIENT_ID', 'THREADS_PUBLISH_ENABLED', 'TOKEN_ENCRYPTION_KEY']),
    );
    expect(JSON.stringify(missing)).not.toContain('threads-secret-should-not-leak');

    const disconnected = await getThreadsReadiness(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: threadsReadyEnv,
    });
    expect(disconnected.ready).toBe(false);
    expect(disconnected.status).toBe('not_connected');

    await connectThreadsAccount();
    const ready = await getThreadsReadiness(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: threadsReadyEnv,
    });
    expect(ready).toMatchObject({
      accountStatus: 'connected',
      ready: true,
      status: 'ready',
    });
    expect(JSON.stringify(ready)).not.toContain('raw-threads-access-token');
  });

  it('keeps THREADS_PUBLISH_ENABLED=false from making any external call', async () => {
    await connectThreadsAccount();
    const approved = await createApprovedThreadsJob('방문 고객의 후기를 바탕으로 매장 소식을 전합니다.');
    const publishAdapter = vi.fn().mockResolvedValue({
      providerPostId: 'threads-post-1',
      providerUrl: 'https://www.threads.net/@golden/post/1',
    });

    const result = await publishThreadsPost(STORE_ID, approved.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { ...threadsReadyEnv, THREADS_PUBLISH_ENABLED: 'false' },
      publishAdapter,
    });

    expect(result.status).not.toBe('published');
    expect(result.error_code).toBe('threads_not_ready');
    expect(result.provider_url).toBeUndefined();
    expect(publishAdapter).not.toHaveBeenCalled();
  });

  it('requires merchant approval before publishing', async () => {
    await connectThreadsAccount();
    const draft = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '점주가 직접 작성한 Threads 소식입니다.',
        provider: 'threads',
        sourceType: 'manual',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    await expect(
      publishThreadsPost(STORE_ID, draft.job_id, {
        actorProfileId: OWNER_PROFILE_ID,
        env: threadsReadyEnv,
        publishAdapter: vi.fn(),
      }),
    ).rejects.toThrow(/approval/i);
  });

  it('sanitizes payload text, preserves safe media metadata, and rejects customer impersonation copy', async () => {
    const media = await createStoreMediaAsset(
      STORE_ID,
      {
        aiDescription: '<script>alert(1)</script>오늘 로스팅한 원두 소개 onclick="x"',
        aiHashtags: ['#golden', 'token=private'],
        aiTitle: '봄 시즌 원두',
        altText: '로스팅 원두 이미지',
        assetType: 'image',
        status: 'ready',
        url: 'https://cdn.example.com/beans.jpg',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const job = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '새 원두 입고 소식 customer_id=secret order_id=order-1',
        hashtags: ['#coffee', 'review_request_token=abc'],
        provider: 'threads',
        sourceId: media.asset_id,
        sourceType: 'media',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    const payload = createThreadsPayload(job, { asset: media, canonicalUrl: 'https://mybiz.ai.kr/s/golden-coffee/media/beans', sourceType: 'media' });
    expect(payload.text).toContain('새 원두 입고 소식');
    expect(payload.text).toContain('https://mybiz.ai.kr/s/golden-coffee/media/beans');
    expect(payload.text).not.toContain('customer_id');
    expect(payload.text).not.toContain('order_id');
    expect(payload.text).not.toContain('script');
    expect(payload.hashtags).toEqual(['coffee', 'golden']);
    expect(payload.hashtags).not.toContain('private');
    expect(payload.mediaUrl).toBe('https://cdn.example.com/beans.jpg');
    expect(payload.altText).toBe('로스팅 원두 이미지');

    expect(() =>
      createThreadsPayload(
        {
          ...job,
          caption: '제가 방문했는데요, 정말 좋았습니다.',
          source_id: undefined,
          source_type: 'manual',
        },
        { sourceType: 'manual' },
      ),
    ).toThrow(/impersonation|고객 대신/i);
  });

  it('rejects review reuse without consent and builds approved review payload in merchant voice', async () => {
    const rawReview = await submitPublicStoreReview({
      body: '직접 남긴 좋은 후기입니다.',
      contentUsageConsent: false,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
    });
    await updateStoreReviewStatus(STORE_ID, rawReview.review_id, 'published', { actorProfileId: OWNER_PROFILE_ID });

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '고객님이 남겨주신 후기를 소개합니다.',
          provider: 'threads',
          sourceId: rawReview.review_id,
          sourceType: 'review',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/consent/i);

    const consentedReview = await submitPublicStoreReview({
      body: '직원이 친절했고 다시 방문하고 싶다는 후기입니다.',
      contentUsageConsent: true,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
      title: '따뜻한 후기',
    });
    const publishedReview = await updateStoreReviewStatus(STORE_ID, consentedReview.review_id, 'published', {
      actorProfileId: OWNER_PROFILE_ID,
    });
    const job = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '고객님이 남겨주신 후기를 소개합니다.',
        provider: 'threads',
        sourceId: consentedReview.review_id,
        sourceType: 'review',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    const payload = createThreadsPayload(job, {
      canonicalUrl: 'https://mybiz.ai.kr/s/golden-coffee/reviews',
      review: publishedReview,
      sourceType: 'review',
    });

    expect(payload.text).toContain('고객님이 남겨주신 후기를 소개합니다.');
    expect(payload.text).toContain('직원이 친절했고');
    expect(payload.text).not.toContain('제가 방문');
  });

  it('stores provider_url only for a successful mocked publish and rejects fake success', async () => {
    await connectThreadsAccount();
    const approved = await createApprovedThreadsJob('점주가 직접 작성한 Threads 소식입니다.');
    const publishAdapter = vi.fn().mockResolvedValue({
      providerPostId: 'threads-post-1',
      providerUrl: 'https://www.threads.net/@golden/post/1',
    });

    const published = await publishThreadsPost(STORE_ID, approved.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: threadsReadyEnv,
      publishAdapter,
    });

    expect(published).toMatchObject({
      provider_post_id: 'threads-post-1',
      provider_url: 'https://www.threads.net/@golden/post/1',
      status: 'published',
    });
    expect(publishAdapter).toHaveBeenCalledOnce();
    expect(JSON.stringify(published)).not.toContain('raw-threads-access-token');

    const fakeJob = await createApprovedThreadsJob('또 다른 점주 작성 Threads 소식입니다.');
    const fakeResult = await publishThreadsPost(STORE_ID, fakeJob.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: threadsReadyEnv,
      publishAdapter: vi.fn().mockResolvedValue({ providerPostId: '', providerUrl: '' }),
    });
    expect(fakeResult.status).toBe('failed');
    expect(fakeResult.error_code).toBe('threads_fake_success_blocked');
    expect(fakeResult.provider_url).toBeUndefined();
  });

  it('marks failed publishes with safe Korean errors and never stores token or secret material', async () => {
    await connectThreadsAccount();
    const approved = await createApprovedThreadsJob('점주 승인된 Threads 게시 문안입니다.');

    const failed = await publishThreadsPost(STORE_ID, approved.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: threadsReadyEnv,
      publishAdapter: vi.fn().mockRejectedValue(new Error('provider failed with raw-threads-access-token-should-not-leak')),
    });

    expect(failed.status).toBe('failed');
    expect(failed.error_code).toBe('threads_publish_failed');
    expect(failed.error_message).toContain('Threads 게시에 실패했습니다.');
    expect(JSON.stringify(failed)).not.toContain('raw-threads-access-token');
    expect(JSON.stringify(failed)).not.toContain(threadsReadyEnv.THREADS_CLIENT_SECRET);
  });

  it('prevents other stores or platform-only users from publishing merchant jobs', async () => {
    await connectThreadsAccount();
    const approved = await createApprovedThreadsJob();

    await expect(
      publishThreadsPost(OTHER_STORE_ID, approved.job_id, {
        actorProfileId: OTHER_PROFILE_ID,
        env: threadsReadyEnv,
        publishAdapter: vi.fn(),
      }),
    ).rejects.toThrow(/not found|store member/i);

    await expect(
      publishThreadsPost(STORE_ID, approved.job_id, {
        actorProfileId: 'profile_platform_admin',
        env: threadsReadyEnv,
        publishAdapter: vi.fn(),
      }),
    ).rejects.toThrow(/store member/i);
  });

  it('keeps pricing, MYBI, review safety, and other provider gates unchanged', async () => {
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'free')).toMatchObject({
      cta_href: '/onboarding?plan=free',
      price_amount: 0,
    });
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'pro')?.price_amount).toBe(79000);
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'vip')?.price_amount).toBe(149000);
    expect(PAYMENT_TEST_100_PRODUCT).toMatchObject({
      amount: 100,
      grants_entitlement: false,
      is_visible_public: false,
      product_code: 'payment_test_100',
    });
    expect(ENABLE_MYBI_COMPANION).toBe(false);
    expect(getYouTubeProviderReadiness({ YOUTUBE_UPLOAD_ENABLED: 'false' }).uploadReady).toBe(false);

    const publicReview = await submitPublicStoreReview({
      body: '공개 DTO에 내부 동의 필드가 없어야 합니다.',
      contentUsageConsent: true,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
    });
    await updateStoreReviewStatus(STORE_ID, publicReview.review_id, 'published', { actorProfileId: OWNER_PROFILE_ID });
    expect(publicReview).toHaveProperty('content_usage_consent', true);

    const storedJobs = await listSocialPublishJobs(STORE_ID, { actorProfileId: OWNER_PROFILE_ID });
    expect(storedJobs.every((job) => !job.provider_url || job.status === 'published')).toBe(true);
  });

  it('creates a blog-post Threads payload from a published MyBiz blog source', async () => {
    const draft = await createStoreBlogPost(
      STORE_ID,
      {
        body: '<p>이번 주 신메뉴와 매장 소식을 정리했습니다.</p><script>alert(1)</script>',
        excerpt: '이번 주 매장 소식',
        sourceType: 'manual',
        status: 'draft',
        tags: ['news', '<script>bad</script>'],
        title: '봄 신메뉴 안내',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const publishedPost = await publishStoreBlogPost(STORE_ID, draft.post_id, { actorProfileId: OWNER_PROFILE_ID });
    const job = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '블로그에 정리한 매장 소식을 Threads로 소개합니다.',
        provider: 'threads',
        sourceId: publishedPost.post_id,
        sourceType: 'blog_post',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    const payload = createThreadsPayload(job, {
      canonicalUrl: 'https://mybiz.ai.kr/s/golden-coffee/blog/spring-menu',
      post: publishedPost,
      sourceType: 'blog_post',
    });

    expect(payload.text).toContain('봄 신메뉴 안내');
    expect(payload.text).toContain('https://mybiz.ai.kr/s/golden-coffee/blog/spring-menu');
    expect(payload.text).not.toContain('<script>');
    expect(payload.hashtags).toContain('news');
  });
});
