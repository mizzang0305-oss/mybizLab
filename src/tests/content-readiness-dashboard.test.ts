import { describe, expect, it, beforeEach } from 'vitest';
import { matchRoutes } from 'react-router-dom';

import { appRoutes } from '@/app/router';
import { resetDatabase } from '@/shared/lib/mockDb';
import {
  approveSocialPublishJob,
  createSocialPublishJob,
  createStoreBlogPost,
  createStoreMediaAsset,
  createReviewRequestLink,
  getContentReadinessDashboard,
  submitPublicStoreReview,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';

const STORE_ID = 'store_golden_coffee';
const STORE_SLUG = 'golden-coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';

const readyExternalEnv = {
  KAKAO_JAVASCRIPT_KEY: 'kakao-key-should-not-leak',
  KAKAO_SHARE_ENABLED: 'true',
  NAVER_BLOG_WRITE_ENABLED: 'true',
  NAVER_CLIENT_ID: 'naver-client',
  NAVER_CLIENT_SECRET: 'naver-secret-should-not-leak',
  NAVER_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/naver/oauth/callback',
  STT_ALLOWED_MIME_TYPES: 'video/mp4,audio/mpeg',
  STT_ENABLED: 'true',
  STT_MAX_DURATION_SECONDS: '90',
  STT_PROVIDER: 'openai',
  THREADS_CLIENT_ID: 'threads-client',
  THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak',
  THREADS_PUBLISH_ENABLED: 'true',
  THREADS_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/threads/oauth/callback',
  TOKEN_ENCRYPTION_KEY: 'token-secret-should-not-leak',
  YOUTUBE_CLIENT_ID: 'youtube-client',
  YOUTUBE_CLIENT_SECRET: 'youtube-secret-should-not-leak',
  YOUTUBE_OAUTH_ENABLED: 'true',
  YOUTUBE_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/youtube/oauth/callback',
  YOUTUBE_UPLOAD_ENABLED: 'true',
};

describe('content readiness dashboard', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('registers a merchant-only content status route', () => {
    expect(matchRoutes(appRoutes, '/dashboard/content/status')?.map(({ route }) => route.path)).toContain('content/status');
  });

  it('summarizes content spread readiness without leaking provider secrets', async () => {
    const baseline = await getContentReadinessDashboard(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyExternalEnv,
    });
    await createReviewRequestLink(
      STORE_ID,
      { baseUrl: 'https://mybiz.ai.kr', sourceType: 'store' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const consentMissingReview = await submitPublicStoreReview({
      body: '동의 없이 남긴 실제 리뷰입니다.',
      contentUsageConsent: false,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
    });
    await updateStoreReviewStatus(STORE_ID, consentMissingReview.review_id, 'published', { actorProfileId: OWNER_PROFILE_ID });
    const pendingReview = await submitPublicStoreReview({
      body: '승인 대기 중인 실제 리뷰입니다.',
      contentUsageConsent: true,
      rating: 4,
      storeId: STORE_ID,
      storeSlug: STORE_SLUG,
    });
    await createStoreBlogPost(
      STORE_ID,
      { body: '상태판 테스트 초안입니다.', sourceType: 'manual', status: 'draft', title: '상태판 블로그 초안' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const publishedBlog = await createStoreBlogPost(
      STORE_ID,
      { body: '게시된 상태판 테스트 글입니다.', sourceType: 'manual', status: 'published', title: '상태판 게시 글' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        captionsVtt: 'WEBVTT\n\n00:00.000 --> 00:01.000\n안녕하세요',
        status: 'ready',
        transcript: '안녕하세요',
        url: 'https://example.com/ready.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await createStoreMediaAsset(
      STORE_ID,
      { assetType: 'image', status: 'draft', url: 'https://example.com/photo.jpg' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await createSocialPublishJob(
      STORE_ID,
      {
        caption: '점주가 직접 준비한 승인 대기 문안입니다.',
        provider: 'threads',
        sourceId: publishedBlog.post_id,
        sourceType: 'blog_post',
        status: 'waiting_approval',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await createSocialPublishJob(
      STORE_ID,
      {
        caption: '실패 큐에 보여줄 문안입니다.',
        provider: 'kakao_share',
        sourceType: 'manual',
        status: 'failed',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    const dashboard = await getContentReadinessDashboard(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: readyExternalEnv,
    });

    expect(dashboard.stats).toMatchObject({
      blogDraftCount: baseline.stats.blogDraftCount + 1,
      blogPublishedCount: baseline.stats.blogPublishedCount + 1,
      captionReadyAssetCount: baseline.stats.captionReadyAssetCount + 1,
      consentBlockedJobCount: baseline.stats.consentBlockedJobCount + 1,
      mediaAssetCount: baseline.stats.mediaAssetCount + 2,
      pendingReviewCount: baseline.stats.pendingReviewCount + 1,
      publishedReviewCount: baseline.stats.publishedReviewCount + 1,
      reviewRequestLinkCount: baseline.stats.reviewRequestLinkCount + 1,
      socialFailedCount: baseline.stats.socialFailedCount + 1,
      socialWaitingApprovalCount: baseline.stats.socialWaitingApprovalCount + 1,
      transcriptReadyAssetCount: baseline.stats.transcriptReadyAssetCount + 1,
    });
    expect(dashboard.providerCards.map((card) => card.provider)).toEqual([
      'youtube',
      'threads',
      'naver_blog',
      'kakao_share',
      'stt',
      'payment_test_100',
    ]);
    expect(dashboard.approvalQueue).toContainEqual(expect.objectContaining({
      approvalStatus: 'waiting_approval',
      consentStatus: 'not_required',
      provider: 'threads',
      sourceTitle: '상태판 게시 글',
      sourceType: 'blog_post',
    }));
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'content_usage_consent_missing')).toBe(true);
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'failed')).toBe(true);

    const serialized = JSON.stringify(dashboard);
    expect(serialized).not.toContain('should-not-leak');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain(pendingReview.review_id);
  });

  it('shows safe missing env names and keeps external publish jobs out of queued when providers are disabled', async () => {
    const draft = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '비활성 provider 승인 테스트입니다.',
        provider: 'threads',
        sourceType: 'manual',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const approved = await approveSocialPublishJob(STORE_ID, draft.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak' },
      publishAdapter: async () => ({ providerPostId: 'fake', providerUrl: 'https://threads.net/fake' }),
    });
    const dashboard = await getContentReadinessDashboard(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { THREADS_CLIENT_SECRET: 'threads-secret-should-not-leak' },
    });

    expect(approved.status).toBe('waiting_approval');
    expect(approved.provider_url).toBeUndefined();
    expect(dashboard.providerCards.find((card) => card.provider === 'threads')).toMatchObject({
      missingEnvNames: expect.arrayContaining(['THREADS_CLIENT_ID', 'TOKEN_ENCRYPTION_KEY']),
      status: 'missing_config',
    });
    expect(JSON.stringify(dashboard)).not.toContain('threads-secret-should-not-leak');
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'provider_disabled')).toBe(true);
  });

  it('rejects another store member and preserves pricing, payment test, MYBI, review, YouTube, STT, and social gates', async () => {
    await expect(
      getContentReadinessDashboard(STORE_ID, {
        actorProfileId: OTHER_PROFILE_ID,
      }),
    ).rejects.toThrow(/store member/i);

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
  });
});
