import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import vercelConfig from '../../vercel.json';
import { StoreHomePage } from '@/modules/table-order/public-home-page';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { resetDatabase } from '@/shared/lib/mockDb';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicStore } from '@/shared/lib/services/mvpService';
import {
  buildKakaoSharePayload,
  getKakaoShareReadiness,
  listKakaoShareEvents,
  recordKakaoShareEvent,
  resetKakaoShareEvents,
} from '@/shared/lib/kakaoShare';
import { KakaoShareButton } from '@/shared/components/KakaoShareButton';

const readyKakaoEnv = {
  KAKAO_JAVASCRIPT_KEY: 'public-kakao-js-key',
  KAKAO_SHARE_ENABLED: 'true',
};

let mockStorePublicContext: Awaited<ReturnType<typeof createStoreContext>>;

vi.mock('@/app/layouts/StorePublicLayout', async () => ({
  useStorePublicContext: () => mockStorePublicContext,
}));

async function createStoreContext() {
  const publicStore = await getPublicStore('golden-coffee');
  if (!publicStore) {
    throw new Error('Expected golden-coffee public store fixture.');
  }

  return {
    publicBasePath: '/golden-coffee',
    publicStore,
    publicStoreQueryKey: queryKeys.publicStoreBySlug('golden-coffee'),
  };
}

async function renderPublicPage(element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries: ['/golden-coffee'] }, element),
    ),
  );
}

describe('Kakao Share SDK user-initiated button', () => {
  beforeEach(async () => {
    resetDatabase();
    resetKakaoShareEvents();
    mockStorePublicContext = await createStoreContext();
  });

  it('reports readiness from safe env names and disables sharing when env is missing or off', () => {
    const missing = getKakaoShareReadiness({
      KAKAO_JAVASCRIPT_KEY: 'public-key-should-not-leak',
      KAKAO_SHARE_ENABLED: 'false',
    });
    expect(missing.ready).toBe(false);
    expect(missing.status).toBe('disabled');
    expect(missing.missingEnvNames).toContain('KAKAO_SHARE_ENABLED');
    expect(JSON.stringify(missing)).not.toContain('public-key-should-not-leak');

    const noKey = getKakaoShareReadiness({ KAKAO_SHARE_ENABLED: 'true' });
    expect(noKey.ready).toBe(false);
    expect(noKey.missingEnvNames).toContain('KAKAO_JAVASCRIPT_KEY');

    const ready = getKakaoShareReadiness(readyKakaoEnv);
    expect(ready).toMatchObject({
      ready: true,
      status: 'ready',
    });
  });

  it('renders the share button disabled or enabled according to Kakao readiness', () => {
    const baseProps = {
      description: '골든커피 매장 소식입니다.',
      imageUrl: 'https://example.com/store.jpg',
      sourceId: 'store_golden_coffee',
      sourceType: 'store' as const,
      title: '골든커피',
      webUrl: 'https://mybiz.ai.kr/golden-coffee',
    };

    const disabledHtml = renderToStaticMarkup(
      createElement(KakaoShareButton, {
        ...baseProps,
        env: { KAKAO_SHARE_ENABLED: 'false' },
      }),
    );
    expect(disabledHtml).toContain('disabled=""');
    expect(disabledHtml).toContain('KAKAO_JAVASCRIPT_KEY');
    expect(disabledHtml).toContain('카카오 공유는 사용자가 직접 공유하는 방식으로 제공됩니다.');

    const enabledHtml = renderToStaticMarkup(
      createElement(KakaoShareButton, {
        ...baseProps,
        env: readyKakaoEnv,
      }),
    );
    expect(enabledHtml).toContain('카카오톡 공유');
    expect(enabledHtml).not.toContain('disabled=""');
    expect(enabledHtml).not.toContain('public-kakao-js-key');
  });

  it('renders a Kakao Share button on the public store page without exposing internal URLs', async () => {
    const html = await renderPublicPage(createElement(StoreHomePage));

    expect(html).toContain('매장 카카오톡 공유');
    expect(html).toContain('카카오 공유는 사용자가 직접 공유하는 방식으로 제공됩니다.');
    expect(html).not.toContain('/dashboard');
    expect(html).not.toContain('/admin');
    expect(html).not.toContain('?r=');
  });

  it('builds safe store and blog share payloads while excluding token or internal URLs', () => {
    const blogPayload = buildKakaoSharePayload({
      description: '이번 주 매장 소식입니다.',
      imageUrl: 'https://example.com/blog.jpg',
      sourceId: 'blog_golden_published_1',
      sourceType: 'blog_post',
      title: '이번 주 골든커피 소식',
      webUrl: 'https://mybiz.ai.kr/golden-coffee/blog/golden-weekly-update?r=token-should-drop&next=/dashboard',
    });

    expect(blogPayload.shareable).toBe(true);
    expect(blogPayload.payload?.content.link.webUrl).toBe('https://mybiz.ai.kr/golden-coffee/blog/golden-weekly-update');
    expect(JSON.stringify(blogPayload)).not.toContain('token-should-drop');
    expect(JSON.stringify(blogPayload)).not.toContain('/dashboard');

    const internalPayload = buildKakaoSharePayload({
      description: '관리자 페이지는 공유하면 안 됩니다.',
      sourceId: 'admin',
      sourceType: 'store',
      title: '관리자',
      webUrl: 'https://mybiz.ai.kr/dashboard/content/social',
    });
    expect(internalPayload.shareable).toBe(false);
    expect(internalPayload.reasonCode).toBe('internal_url');
  });

  it('allows only published safe review sharing and blocks token review request URLs', () => {
    const publishedReview = buildKakaoSharePayload({
      description: '커피 향이 좋고 직원이 친절했다는 공개 리뷰입니다.',
      imageUrl: 'https://example.com/review.jpg',
      reviewStatus: 'published',
      sourceId: 'review_golden_published_1',
      sourceType: 'review',
      title: '다시 방문하고 싶은 카페',
      webUrl: 'https://mybiz.ai.kr/s/golden-coffee/review#review_golden_published_1',
    });
    expect(publishedReview.shareable).toBe(true);

    const pendingReview = buildKakaoSharePayload({
      description: '승인 전 리뷰입니다.',
      reviewStatus: 'pending',
      sourceId: 'review_pending',
      sourceType: 'review',
      title: '승인 전 리뷰',
      webUrl: 'https://mybiz.ai.kr/s/golden-coffee/review#review_pending',
    });
    expect(pendingReview.shareable).toBe(false);
    expect(pendingReview.reasonCode).toBe('review_not_published');

    const tokenReviewRequest = buildKakaoSharePayload({
      description: '토큰 리뷰 요청 URL은 공유하지 않습니다.',
      reviewStatus: 'published',
      sourceId: 'review_request',
      sourceType: 'review',
      title: '리뷰 요청',
      webUrl: 'https://mybiz.ai.kr/s/golden-coffee/review?r=secret-token',
    });
    expect(tokenReviewRequest.shareable).toBe(false);
    expect(tokenReviewRequest.reasonCode).toBe('token_url');
  });

  it('records only share_started or failed analytics and never fake delivered success', () => {
    recordKakaoShareEvent({
      sourceId: 'store_golden_coffee',
      sourceType: 'store',
      status: 'share_started',
    });
    recordKakaoShareEvent({
      errorMessage: 'SDK load failed',
      sourceId: 'store_golden_coffee',
      sourceType: 'store',
      status: 'failed',
    });

    expect(listKakaoShareEvents()).toEqual([
      expect.objectContaining({ provider: 'kakao_share', status: 'share_started' }),
      expect.objectContaining({ provider: 'kakao_share', status: 'failed' }),
    ]);
    expect(JSON.stringify(listKakaoShareEvents())).not.toContain('delivered');
    expect(JSON.stringify(listKakaoShareEvents())).not.toContain('provider_url');
  });

  it('does not add Kakao Message friend API, auto chat routes, or regress core pricing flags', () => {
    const routeText = JSON.stringify(vercelConfig.routes);
    const sourceText = [
      'src/shared/components/KakaoShareButton.tsx',
      'src/shared/lib/kakaoShare.ts',
    ]
      .map((filePath) => readFileSync(join(process.cwd(), filePath), 'utf8'))
      .join('\n');

    expect(routeText).not.toMatch(/kakao.*friend|talk\/friends|message\/send/i);
    expect(sourceText).not.toMatch(/friends|sendCustom|sendScrap|chatroom|delivered/i);
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
