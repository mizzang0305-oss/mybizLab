import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase, getDatabase, updateDatabase } from '@/shared/lib/mockDb';
import {
  approveSocialPublishJob,
  createSocialPublishJob,
  createStoreBlogPost,
  listSocialPublishJobs,
  submitPublicStoreReview,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import { saveProviderTokens } from '@/server/socialAccountTokens';
import {
  createNaverBlogPayload,
  getNaverBlogReadiness,
  mapNaverError,
  publishNaverBlogPost,
} from '@/server/naverBlogAdapter';

const STORE_ID = 'store_golden_coffee';
const STORE_SLUG = 'golden-coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';

const readyEnv = {
  NAVER_BLOG_WRITE_ENABLED: 'true',
  NAVER_CLIENT_ID: 'naver-client-id',
  NAVER_CLIENT_SECRET: 'naver-client-secret-should-not-leak',
  NAVER_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/naver/oauth/callback',
  TOKEN_ENCRYPTION_KEY: 'naver-writepost-token-key-0123456789',
};

let blogPostSequence = 0;

async function connectNaverAccount() {
  await saveProviderTokens(
    STORE_ID,
    'naver_blog',
    {
      accessToken: 'naver-access-token-should-not-leak',
      displayName: 'Golden Naver Blog',
      expiresAt: '2026-06-01T00:00:00.000Z',
      providerAccountId: 'golden-blog',
      refreshToken: 'naver-refresh-token-should-not-leak',
      scopes: ['blog.write'],
    },
    {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
    },
  );
}

async function createApprovedNaverBlogJob() {
  blogPostSequence += 1;
  const post = await createStoreBlogPost(
    STORE_ID,
    {
      body: '<h1>Spring menu</h1><script>alert("x")</script><p onclick="steal()">Fresh latte for neighbors</p><a href="javascript:alert(1)">bad</a> customer_id=abc order_id=ord token=secret',
      sourceType: 'manual',
      status: 'published',
      tags: ['spring', '<script>tag</script>'],
      title: `Golden Coffee Spring ${blogPostSequence} <b>bad</b>`,
    },
    { actorProfileId: OWNER_PROFILE_ID },
  );
  const job = await createSocialPublishJob(
    STORE_ID,
    {
      caption: '점주가 직접 준비한 네이버 블로그 게시 문안입니다.',
      provider: 'naver_blog',
      sourceId: post.post_id,
      sourceType: 'blog_post',
      status: 'waiting_approval',
    },
    { actorProfileId: OWNER_PROFILE_ID },
  );
  return {
    job: await approveSocialPublishJob(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
    }),
    post,
  };
}

describe('Naver Blog writePost adapter foundation', () => {
  beforeEach(() => {
    resetDatabase();
    blogPostSequence = 0;
  });

  it('reports readiness with safe env names and requires enabled env, vault, and connected account', async () => {
    const missingEnv = await getNaverBlogReadiness(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { NAVER_CLIENT_SECRET: 'naver-secret-should-not-leak' },
    });

    expect(missingEnv.ready).toBe(false);
    expect(missingEnv.missingEnvNames).toEqual(
      expect.arrayContaining(['NAVER_CLIENT_ID', 'NAVER_REDIRECT_URI', 'NAVER_BLOG_WRITE_ENABLED', 'TOKEN_ENCRYPTION_KEY']),
    );
    expect(JSON.stringify(missingEnv)).not.toContain('naver-secret-should-not-leak');

    const disabled = await getNaverBlogReadiness(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { ...readyEnv, NAVER_BLOG_WRITE_ENABLED: 'false' },
    });
    expect(disabled.ready).toBe(false);
    expect(disabled.publishEnabled).toBe(false);

    const notConnected = await getNaverBlogReadiness(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
    });
    expect(notConnected.ready).toBe(false);
    expect(notConnected.oauthStatus).toBe('not_connected');

    await connectNaverAccount();
    await expect(
      getNaverBlogReadiness(STORE_ID, {
        actorProfileId: OWNER_PROFILE_ID,
        env: readyEnv,
      }),
    ).resolves.toMatchObject({
      missingEnvNames: [],
      oauthStatus: 'connected',
      publishEnabled: true,
      ready: true,
    });
  });

  it('creates a sanitized blog_post payload with backlink and no private identifiers', async () => {
    const { job, post } = await createApprovedNaverBlogJob();
    const payload = createNaverBlogPayload(job, {
      blogPost: post,
      sourceType: 'blog_post',
      storeSlug: STORE_SLUG,
    });
    const serialized = JSON.stringify(payload);

    expect(payload.title).toBe('Golden Coffee Spring 1 bad');
    expect(payload.contents).toContain('Fresh latte for neighbors');
    expect(payload.contents).toContain(`https://mybiz.ai.kr/s/${STORE_SLUG}/blog/${post.slug}`);
    expect(payload.tags).toEqual(['spring', 'tag']);
    expect(serialized).not.toMatch(/script|onclick|javascript:/i);
    expect(serialized).not.toMatch(/customer_id|order_id|token=|secret/i);
  });

  it('blocks unapproved jobs, disabled providers, missing tokens, other stores, and customer impersonation copy', async () => {
    const post = await createStoreBlogPost(
      STORE_ID,
      { body: '승인 전 게시할 수 없는 글입니다.', sourceType: 'manual', status: 'published', title: '승인 전 글' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const unapproved = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '점주 승인 전 문안입니다.',
        provider: 'naver_blog',
        sourceId: post.post_id,
        sourceType: 'blog_post',
        status: 'waiting_approval',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    await expect(
      publishNaverBlogPost(STORE_ID, unapproved.job_id, {
        actorProfileId: OWNER_PROFILE_ID,
        env: readyEnv,
        writePostAdapter: async () => ({ providerPostId: '1', providerUrl: 'https://blog.naver.com/golden/1' }),
      }),
    ).rejects.toThrow(/approval/i);

    await connectNaverAccount();
    const { job } = await createApprovedNaverBlogJob();
    const disabledAdapter = vi.fn();
    const disabled = await publishNaverBlogPost(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { ...readyEnv, NAVER_BLOG_WRITE_ENABLED: 'false' },
      writePostAdapter: disabledAdapter,
    });
    expect(disabledAdapter).not.toHaveBeenCalled();
    expect(disabled).toMatchObject({
      error_code: 'naver_blog_not_ready',
      status: 'queued',
    });

    updateDatabase((database) => {
      database.social_accounts = database.social_accounts.filter((account) => account.provider !== 'naver_blog');
    });
    const missingTokenAdapter = vi.fn();
    const missingToken = await publishNaverBlogPost(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
      writePostAdapter: missingTokenAdapter,
    });
    expect(missingTokenAdapter).not.toHaveBeenCalled();
    expect(missingToken).toMatchObject({
      error_code: 'naver_blog_not_ready',
      status: 'queued',
    });

    await expect(
      publishNaverBlogPost(STORE_ID, job.job_id, {
        actorProfileId: OTHER_PROFILE_ID,
        env: readyEnv,
        writePostAdapter: async () => ({ providerPostId: '1', providerUrl: 'https://blog.naver.com/golden/1' }),
      }),
    ).rejects.toThrow(/store member/i);

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '제가 방문했는데요 정말 좋았어요',
          provider: 'naver_blog',
          sourceType: 'manual',
          status: 'draft',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/Customer impersonation/i);
  });

  it('marks a successful adapter result as published only when the provider returns a real post id and URL', async () => {
    await connectNaverAccount();
    const { job } = await createApprovedNaverBlogJob();
    const writePostAdapter = vi.fn().mockResolvedValue({
      providerPostId: 'naver-log-100',
      providerUrl: 'https://blog.naver.com/golden-blog/223456789',
    });

    const published = await publishNaverBlogPost(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
      writePostAdapter,
    });

    expect(writePostAdapter).toHaveBeenCalledTimes(1);
    expect(writePostAdapter.mock.calls[0][0].accessToken).toBe('naver-access-token-should-not-leak');
    expect(JSON.stringify(writePostAdapter.mock.calls[0][0].payload)).not.toContain('naver-access-token-should-not-leak');
    expect(published).toMatchObject({
      provider: 'naver_blog',
      provider_post_id: 'naver-log-100',
      provider_url: 'https://blog.naver.com/golden-blog/223456789',
      status: 'published',
    });

    const stored = (await listSocialPublishJobs(STORE_ID, { actorProfileId: OWNER_PROFILE_ID })).find(
      (candidate) => candidate.job_id === job.job_id,
    );
    expect(stored).toMatchObject({
      provider_post_id: 'naver-log-100',
      status: 'published',
    });
    expect(JSON.stringify(stored)).not.toContain('naver-access-token-should-not-leak');
  });

  it('marks failed adapter results with safe Korean errors and never fakes publish success', async () => {
    await connectNaverAccount();
    const { job } = await createApprovedNaverBlogJob();
    const failed = await publishNaverBlogPost(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
      writePostAdapter: async () => {
        throw new Error('Naver failed with token=naver-access-token-should-not-leak and NAVER_CLIENT_SECRET=secret');
      },
    });

    expect(failed).toMatchObject({
      error_code: 'naver_blog_publish_failed',
      status: 'failed',
    });
    expect(failed.error_message).toContain('네이버 블로그 발행에 실패했습니다.');
    expect(JSON.stringify(failed)).not.toContain('naver-access-token-should-not-leak');
    expect(JSON.stringify(failed)).not.toContain('NAVER_CLIENT_SECRET=secret');

    await connectNaverAccount();
    const second = await createApprovedNaverBlogJob();
    const fakeSuccess = await publishNaverBlogPost(STORE_ID, second.job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyEnv,
      writePostAdapter: async () => ({ providerPostId: '', providerUrl: '' }),
    });
    expect(fakeSuccess).toMatchObject({
      error_code: 'naver_blog_publish_failed',
      status: 'failed',
    });
    expect(fakeSuccess.provider_url).toBeUndefined();
  });

  it('keeps review consent, token, pricing, payment, MYBI, and other social gates intact', async () => {
    const review = await submitPublicStoreReview({
      body: '동의 없는 리뷰입니다.',
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
          caption: '고객 후기를 바탕으로 소개합니다.',
          provider: 'naver_blog',
          sourceId: review.review_id,
          sourceType: 'review',
          status: 'draft',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/consent/i);

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
    expect(mapNaverError(new Error('access_token=abc refresh_token=def client_secret=ghi')).errorMessage).not.toMatch(
      /access_token|refresh_token|client_secret|abc|def|ghi/i,
    );
    expect(getDatabase().social_publish_jobs.some((candidate) => candidate.provider === 'threads' && candidate.status === 'published')).toBe(
      false,
    );
  });
});
