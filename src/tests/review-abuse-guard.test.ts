import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { PAYMENT_TEST_100_PRODUCT, FALLBACK_PRICING_PLANS } from '@/shared/lib/platformAdminConfig';
import {
  createReviewRequestLink,
  getContentReadinessDashboard,
  listReviewSubmitAttempts,
  submitPublicStoreReview,
} from '@/shared/lib/services/contentEngineService';

const STORE_ID = 'store_golden_coffee';
const STORE_SLUG = 'golden-coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';

const rateLimitEnv = {
  REVIEW_CAPTCHA_ENABLED: 'false',
  REVIEW_IP_HASH_SALT: 'review-abuse-test-salt-32-bytes',
  REVIEW_RATE_LIMIT_ENABLED: 'true',
  REVIEW_RATE_LIMIT_MAX_ATTEMPTS: '2',
  REVIEW_RATE_LIMIT_WINDOW_SECONDS: '60',
};

const captchaEnv = {
  ...rateLimitEnv,
  REVIEW_CAPTCHA_ENABLED: 'true',
  TURNSTILE_SECRET_KEY: 'turnstile-secret-should-not-leak',
  TURNSTILE_SITE_KEY: 'turnstile-site-key',
};

function reviewInput(body = '실제 방문 후 남기는 정상 리뷰입니다. 직원 안내가 친절했고 다시 방문하고 싶습니다.') {
  return {
    body,
    contentUsageConsent: true,
    honeypot: '',
    marketingConsent: false,
    rating: 5,
    reviewerDisplayName: '방문 고객',
    storeId: STORE_ID,
    storeSlug: STORE_SLUG,
    title: '정상 방문 후기',
  };
}

const requestMeta = {
  ipAddress: '203.0.113.44',
  userAgent: 'Mozilla/5.0 Review Abuse Test',
};

describe('public review abuse guard', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('allows the first N store-scoped attempts and blocks N+1 without storing raw IP or user-agent', async () => {
    await submitPublicStoreReview(reviewInput('첫 번째 정상 리뷰입니다. 친절하고 메뉴 설명이 좋았습니다.'), {
      env: rateLimitEnv,
      requestMeta,
    });
    await submitPublicStoreReview(reviewInput('두 번째 정상 리뷰입니다. 매장 분위기가 편안했습니다.'), {
      env: rateLimitEnv,
      requestMeta,
    });

    await expect(
      submitPublicStoreReview(reviewInput('세 번째 반복 제출입니다. 짧은 시간 안에 다시 시도합니다.'), {
        env: rateLimitEnv,
        requestMeta,
      }),
    ).rejects.toThrow('짧은 시간 안에 리뷰 제출이 여러 번 시도되었습니다. 잠시 후 다시 시도해 주세요.');

    const attempts = await listReviewSubmitAttempts(STORE_ID, { actorProfileId: OWNER_PROFILE_ID });
    expect(attempts).toHaveLength(3);
    expect(attempts.filter((attempt) => attempt.outcome === 'allowed')).toHaveLength(2);
    expect(attempts.find((attempt) => attempt.outcome === 'blocked')).toMatchObject({
      reason: 'rate_limit',
    });
    const serialized = JSON.stringify(attempts);
    expect(serialized).not.toContain(requestMeta.ipAddress);
    expect(serialized).not.toContain(requestMeta.userAgent);
  });

  it('records token, honeypot, duplicate, and captcha blocks as safe moderation events', async () => {
    const oneUseLink = await createReviewRequestLink(
      STORE_ID,
      { baseUrl: 'https://mybiz.ai.kr', maxUses: 1, sourceType: 'store' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await submitPublicStoreReview({ ...reviewInput('토큰 첫 사용 정상 리뷰입니다.'), reviewRequestToken: oneUseLink.public_token }, {
      env: rateLimitEnv,
      requestMeta,
    });
    await expect(
      submitPublicStoreReview({ ...reviewInput('토큰 초과 제출입니다.'), reviewRequestToken: oneUseLink.public_token }, {
        env: rateLimitEnv,
        requestMeta: { ipAddress: '203.0.113.45', userAgent: requestMeta.userAgent },
      }),
    ).rejects.toThrow(/usage limit|사용/);

    await expect(
      submitPublicStoreReview({ ...reviewInput('봇 필드가 채워진 제출입니다.'), honeypot: 'bot-filled' }, {
        env: rateLimitEnv,
        requestMeta: { ipAddress: '203.0.113.46', userAgent: requestMeta.userAgent },
      }),
    ).rejects.toThrow(/spam|자동/);

    await submitPublicStoreReview(reviewInput('중복 감지 대상 리뷰입니다. 같은 내용을 다시 제출합니다.'), {
      env: rateLimitEnv,
      requestMeta: { ipAddress: '203.0.113.47', userAgent: requestMeta.userAgent },
    });
    await expect(
      submitPublicStoreReview(reviewInput('중복 감지 대상 리뷰입니다. 같은 내용을 다시 제출합니다.'), {
        env: rateLimitEnv,
        requestMeta: { ipAddress: '203.0.113.47', userAgent: requestMeta.userAgent },
      }),
    ).rejects.toThrow(/이미 접수된 리뷰와 같은 내용/);

    await expect(
      submitPublicStoreReview(reviewInput('captcha 실패 리뷰입니다.'), {
        captchaVerifier: vi.fn(async () => ({ success: false })),
        env: captchaEnv,
        requestMeta: { ipAddress: '203.0.113.48', userAgent: requestMeta.userAgent },
      }),
    ).rejects.toThrow('자동 제출 방지를 확인하지 못했습니다. 다시 시도해 주세요.');

    const dashboard = await getContentReadinessDashboard(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: rateLimitEnv,
    });
    expect(dashboard.stats.reviewSubmitBlockedAttemptCount).toBeGreaterThanOrEqual(4);
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'token_max_uses_exceeded')).toBe(true);
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'honeypot_detected')).toBe(true);
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'duplicate_submit_window')).toBe(true);
    expect(dashboard.blockedQueue.some((item) => item.reasonCode === 'captcha_failed')).toBe(true);
    expect(JSON.stringify(dashboard)).not.toContain('turnstile-secret-should-not-leak');
  });

  it('requires a valid captcha token only when the captcha guard is enabled', async () => {
    await expect(
      submitPublicStoreReview(reviewInput('captcha 비활성 상태에서는 토큰 없이 접수됩니다.'), {
        env: { ...rateLimitEnv, REVIEW_CAPTCHA_ENABLED: 'false' },
        requestMeta: { ipAddress: '203.0.113.49', userAgent: requestMeta.userAgent },
      }),
    ).resolves.toMatchObject({ visibility_status: 'pending' });

    await expect(
      submitPublicStoreReview(reviewInput('captcha 활성 상태에서는 토큰이 필요합니다.'), {
        captchaVerifier: vi.fn(async () => ({ success: true })),
        env: captchaEnv,
        requestMeta: { ipAddress: '203.0.113.50', userAgent: requestMeta.userAgent },
      }),
    ).rejects.toThrow('자동 제출 방지를 확인하지 못했습니다. 다시 시도해 주세요.');

    await expect(
      submitPublicStoreReview({ ...reviewInput('captcha 검증 성공 리뷰입니다.'), captchaToken: 'valid-turnstile-token' }, {
        captchaVerifier: vi.fn(async () => ({ success: true })),
        env: captchaEnv,
        requestMeta: { ipAddress: '203.0.113.51', userAgent: requestMeta.userAgent },
      }),
    ).resolves.toMatchObject({ visibility_status: 'pending' });
  });

  it('keeps pricing, payment test, MYBI, and public review DTO regressions unchanged', async () => {
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
