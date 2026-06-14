import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import {
  approveSocialPublishJob,
  convertReviewToBlogDraft,
  createReviewRequestLink,
  createSocialPublishJob,
  createStoreBlogPost,
  createStoreMediaAsset,
  generateCaptionDraft,
  generateTranscriptDraft,
  getPublicStoreBlogPost,
  listReviewRequestLinks,
  listPublicStoreBlogPosts,
  listPublicStoreReviews,
  listSocialProviderCards,
  listStoreReviews,
  publishStoreBlogPost,
  submitPublicStoreReview,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';

const STORE_ID = 'store_golden_coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';

async function createPendingReview(overrides: Partial<Parameters<typeof submitPublicStoreReview>[0]> = {}) {
  return submitPublicStoreReview({
    body: '직원이 메뉴를 친절하게 설명해 주고 매장 분위기도 편안했습니다.',
    contentUsageConsent: true,
    honeypot: '',
    marketingConsent: true,
    mediaUrl: 'https://example.com/review-photo.jpg',
    rating: 5,
    reviewerDisplayName: '방문 고객',
    storeId: STORE_ID,
    storeSlug: 'golden-coffee',
    title: '따뜻한 방문 경험',
    ...overrides,
  });
}

describe('store content engine service', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('creates public reviews as pending, saves consent fields, and only exposes published reviews publicly', async () => {
    const review = await createPendingReview();

    expect(review.visibility_status).toBe('pending');
    expect(review.marketing_consent).toBe(true);
    expect(review.content_usage_consent).toBe(true);
    expect(review.media_urls).toEqual(['https://example.com/review-photo.jpg']);

    await expect(listPublicStoreReviews(STORE_ID)).resolves.not.toContainEqual(
      expect.objectContaining({ review_id: review.review_id }),
    );

    const published = await updateStoreReviewStatus(STORE_ID, review.review_id, 'published', {
      actorProfileId: OWNER_PROFILE_ID,
    });
    const publicReviews = await listPublicStoreReviews(STORE_ID);
    const publicReview = publicReviews.find((entry) => entry.review_id === review.review_id) as unknown as Record<string, unknown>;

    expect(published.visibility_status).toBe('published');
    expect(publicReviews).toContainEqual(expect.objectContaining({ review_id: review.review_id }));
    expect(publicReview).toEqual(
      expect.objectContaining({
        body: review.body,
        created_at: review.created_at,
        media_urls: review.media_urls,
        rating: review.rating,
        review_id: review.review_id,
        reviewer_display_name: review.reviewer_display_name,
        title: review.title,
      }),
    );
    expect(publicReview).not.toHaveProperty('store_id');
    expect(publicReview).not.toHaveProperty('customer_id');
    expect(publicReview).not.toHaveProperty('order_id');
    expect(publicReview).not.toHaveProperty('reservation_id');
    expect(publicReview).not.toHaveProperty('marketing_consent');
    expect(publicReview).not.toHaveProperty('content_usage_consent');
    expect(publicReview).not.toHaveProperty('visibility_status');
    expect(publicReview).not.toHaveProperty('keywords');
    expect(publicReview).not.toHaveProperty('ai_summary');

    await updateStoreReviewStatus(STORE_ID, review.review_id, 'hidden', {
      actorProfileId: OWNER_PROFILE_ID,
    });
    await expect(listPublicStoreReviews(STORE_ID)).resolves.not.toContainEqual(
      expect.objectContaining({ review_id: review.review_id }),
    );
  });

  it('creates review request links and stores them in the merchant store scope', async () => {
    const defaultLink = await createReviewRequestLink(
      STORE_ID,
      { baseUrl: 'https://mybiz.ai.kr', sourceType: 'store' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const orderLink = await createReviewRequestLink(
      STORE_ID,
      { baseUrl: 'https://mybiz.ai.kr', sourceId: 'order_completed_1', sourceType: 'order' },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect(defaultLink.public_token).toBeTruthy();
    expect(defaultLink.url).toBe(`https://mybiz.ai.kr/s/golden-coffee/review?r=${defaultLink.public_token}`);
    expect(orderLink.public_token).toBeTruthy();
    expect(orderLink.url).toBe(`https://mybiz.ai.kr/s/golden-coffee/review?r=${orderLink.public_token}`);
    expect(orderLink.url).not.toContain('order_completed_1');
    expect(orderLink.usage_count).toBe(0);
    expect(orderLink.submission_count).toBe(0);

    await expect(listReviewRequestLinks(STORE_ID, { actorProfileId: OWNER_PROFILE_ID })).resolves.toContainEqual(
      expect.objectContaining({ link_id: orderLink.link_id, store_id: STORE_ID }),
    );
    await expect(
      createReviewRequestLink(
        STORE_ID,
        { baseUrl: 'https://mybiz.ai.kr', sourceId: 'order_completed_1', sourceType: 'order' },
        { actorProfileId: OTHER_PROFILE_ID },
      ),
    ).rejects.toThrow(/store member/i);
    await expect(
      createReviewRequestLink(
        'store_mint_bbq',
        { baseUrl: 'https://mybiz.ai.kr', sourceId: 'order_completed_1', sourceType: 'order' },
        { actorProfileId: OTHER_PROFILE_ID },
      ),
    ).rejects.toThrow(/source/i);
  });

  it('resolves review request public tokens safely and records successful token use', async () => {
    const link = await createReviewRequestLink(
      STORE_ID,
      { baseUrl: 'https://mybiz.ai.kr', sourceId: 'order_completed_1', sourceType: 'order' },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    const review = await createPendingReview({ reviewRequestToken: link.public_token });

    expect(review.visibility_status).toBe('pending');
    expect(review.order_id).toBe('order_completed_1');
    expect(review.customer_id).toBe('customer_hana');

    const links = await listReviewRequestLinks(STORE_ID, { actorProfileId: OWNER_PROFILE_ID });
    expect(links.find((entry) => entry.link_id === link.link_id)).toEqual(
      expect.objectContaining({
        last_used_at: expect.any(String),
        submission_count: 1,
        usage_count: 1,
      }),
    );
  });

  it('rejects unsafe review request token reuse states and wrong-store tokens', async () => {
    const activeLink = await createReviewRequestLink(
      STORE_ID,
      { baseUrl: 'https://mybiz.ai.kr', sourceId: 'order_completed_1', sourceType: 'order' },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await expect(
      createPendingReview({
        reviewRequestToken: activeLink.public_token,
        storeId: 'store_mint_bbq',
        storeSlug: 'mint-izakaya',
      }),
    ).rejects.toThrow(/token/i);

    const expiredLink = await createReviewRequestLink(
      STORE_ID,
      {
        baseUrl: 'https://mybiz.ai.kr',
        expiresAt: '2020-01-01T00:00:00.000Z',
        sourceType: 'store',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await expect(createPendingReview({ reviewRequestToken: expiredLink.public_token })).rejects.toThrow(/expired/i);

    const disabledLink = await createReviewRequestLink(
      STORE_ID,
      {
        baseUrl: 'https://mybiz.ai.kr',
        disabledAt: '2026-01-01T00:00:00.000Z',
        sourceType: 'store',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await expect(createPendingReview({ reviewRequestToken: disabledLink.public_token })).rejects.toThrow(/disabled/i);

    const oneUseLink = await createReviewRequestLink(
      STORE_ID,
      {
        baseUrl: 'https://mybiz.ai.kr',
        maxUses: 1,
        sourceType: 'store',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    await createPendingReview({ reviewRequestToken: oneUseLink.public_token });
    await expect(createPendingReview({ reviewRequestToken: oneUseLink.public_token })).rejects.toThrow(/usage limit/i);
  });

  it('rejects invalid, bot, corrupted, and cross-store review actions', async () => {
    await expect(createPendingReview({ rating: 6 })).rejects.toThrow(/rating/i);
    await expect(createPendingReview({ honeypot: 'bot-filled' })).rejects.toThrow(/spam/i);
    await expect(createPendingReview({ body: '!!!!!!!!!!!!!!!!!' })).rejects.toThrow(/review body/i);
    await expect(createPendingReview({ storeSlug: 'mint-izakaya' })).rejects.toThrow(/store slug/i);
    await expect(createPendingReview({ orderId: 'missing_order', source: 'order' })).rejects.toThrow(/source/i);
    await expect(
      createPendingReview({
        orderId: 'order_completed_1',
        source: 'order',
        storeId: 'store_mint_bbq',
        storeSlug: 'mint-izakaya',
      }),
    ).rejects.toThrow(/source/i);

    const review = await createPendingReview();
    await expect(
      updateStoreReviewStatus(STORE_ID, review.review_id, 'published', {
        actorProfileId: OTHER_PROFILE_ID,
      }),
    ).rejects.toThrow(/store member/i);
  });

  it('links valid review request source records without exposing them publicly before approval', async () => {
    const review = await createPendingReview({ orderId: 'order_completed_1', source: 'order' });

    expect(review.visibility_status).toBe('pending');
    expect(review.order_id).toBe('order_completed_1');
    expect(review.customer_id).toBe('customer_hana');
    await expect(listPublicStoreReviews(STORE_ID)).resolves.not.toContainEqual(
      expect.objectContaining({ review_id: review.review_id }),
    );
  });

  it('rejects dangerous content URL schemes before storing merchant or customer content', async () => {
    await expect(createPendingReview({ mediaUrl: 'javascript:alert(1)' })).rejects.toThrow(/url/i);

    await expect(
      createStoreBlogPost(
        STORE_ID,
        {
          body: 'Blog content for URL validation.',
          coverImageUrl: 'data:image/svg+xml,<svg></svg>',
          sourceType: 'manual',
          status: 'draft',
          title: 'URL validation',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/url/i);

    await expect(
      createStoreMediaAsset(
        STORE_ID,
        {
          assetType: 'image',
          url: 'data:text/html,<script>alert(1)</script>',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/url/i);
  });

  it('converts an approved real review to a privacy-safe blog draft and publishes only published posts', async () => {
    const review = await createPendingReview({
      body: '친구와 방문했는데 커피 향이 좋고 좌석 간격이 넓어서 오래 머물기 좋았습니다.',
    });
    await updateStoreReviewStatus(STORE_ID, review.review_id, 'published', {
      actorProfileId: OWNER_PROFILE_ID,
    });

    const draft = await convertReviewToBlogDraft(STORE_ID, review.review_id, {
      actorProfileId: OWNER_PROFILE_ID,
    });

    expect(draft.status).toBe('draft');
    expect(draft.source_type).toBe('review');
    expect(draft.source_review_id).toBe(review.review_id);
    expect(draft.body).toContain('개인정보');
    expect(draft.body).not.toContain('"');

    await expect(listPublicStoreBlogPosts(STORE_ID)).resolves.not.toContainEqual(
      expect.objectContaining({ post_id: draft.post_id }),
    );

    const published = await publishStoreBlogPost(STORE_ID, draft.post_id, {
      actorProfileId: OWNER_PROFILE_ID,
    });

    expect(published.status).toBe('published');
    await expect(listPublicStoreBlogPosts(STORE_ID)).resolves.toContainEqual(
      expect.objectContaining({ post_id: draft.post_id }),
    );
    await expect(getPublicStoreBlogPost(STORE_ID, draft.slug)).resolves.toMatchObject({
      post_id: draft.post_id,
      status: 'published',
    });
  });

  it('validates blog slug uniqueness per store', async () => {
    await createStoreBlogPost(
      STORE_ID,
      {
        body: '첫 번째 블로그 글입니다.',
        slug: 'spring-update',
        sourceType: 'manual',
        status: 'draft',
        title: '봄 소식',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    await expect(
      createStoreBlogPost(
        STORE_ID,
        {
          body: '두 번째 블로그 글입니다.',
          slug: 'spring-update',
          sourceType: 'manual',
          status: 'draft',
          title: '봄 소식 복사본',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/slug/i);
  });

  it('registers media URLs and returns honest deterministic caption and transcript fallback drafts', async () => {
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        aiDescription: '매장 입구와 시그니처 메뉴를 보여주는 짧은 영상',
        altText: '골든커피 입구 영상',
        assetType: 'video',
        durationSeconds: 18,
        status: 'draft',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        url: 'https://example.com/store-video.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect(asset.asset_type).toBe('video');
    expect(asset.duration_seconds).toBe(18);

    const caption = await generateCaptionDraft(asset);
    const transcript = await generateTranscriptDraft(asset);

    expect(caption.title).toContain('골든커피 입구 영상');
    expect(caption.hashtags).toContain('MyBiz');
    expect(transcript.transcript).toContain('음성 분석 설정');
  });

  it('keeps external social publishing disabled unless connected and blocks review reuse without consent plus merchant approval', async () => {
    const providers = await listSocialProviderCards(STORE_ID);
    expect(providers.find((provider) => provider.provider === 'youtube')).toMatchObject({
      status: 'disabled',
    });

    const noConsentReview = await createPendingReview({ contentUsageConsent: false });
    await updateStoreReviewStatus(STORE_ID, noConsentReview.review_id, 'published', {
      actorProfileId: OWNER_PROFILE_ID,
    });

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '고객 후기를 소개합니다.',
          provider: 'threads',
          sourceId: noConsentReview.review_id,
          sourceType: 'review',
          status: 'draft',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/consent/i);

    const review = await createPendingReview({ contentUsageConsent: true });
    await updateStoreReviewStatus(STORE_ID, review.review_id, 'published', {
      actorProfileId: OWNER_PROFILE_ID,
    });
    const job = await createSocialPublishJob(
      STORE_ID,
      {
        caption: '고객 후기를 바탕으로 매장 소식을 준비합니다.',
        provider: 'threads',
        sourceId: review.review_id,
        sourceType: 'review',
        status: 'draft',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const publishAdapter = vi.fn();
    const approved = await approveSocialPublishJob(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      publishAdapter,
    });

    expect(approved.status).toBe('waiting_approval');
    expect(approved.error_code).toBe('provider_not_connected');
    expect(publishAdapter).not.toHaveBeenCalled();

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '잘못된 게시자',
          provider: 'naver_review' as never,
          sourceType: 'manual',
          status: 'draft',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/provider/i);
  });

  it('keeps dashboard review listing store scoped', async () => {
    const goldenReview = await createPendingReview();
    await createPendingReview({ storeId: 'store_mint_bbq', storeSlug: 'mint-izakaya', title: '다른 매장 후기' });

    const reviews = await listStoreReviews(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
    });

    expect(reviews).toContainEqual(expect.objectContaining({ review_id: goldenReview.review_id }));
    expect(reviews).not.toContainEqual(expect.objectContaining({ store_id: 'store_mint_bbq' }));
  });

  it('keeps optional content links compatible with legacy live schema key names', () => {
    const migrationSql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations_archive',
        'pre_baseline_20260614',
        '20260509_store_content_engine_mvp.sql',
      ),
      'utf8',
    );

    expect(migrationSql).toContain('store_id uuid not null references public.stores(store_id)');
    expect(migrationSql).not.toMatch(/references public\.(customers|orders|reservations|profiles)\(id\)/);
    expect(migrationSql).toContain('customer_id uuid null');
    expect(migrationSql).toContain('order_id uuid null');
    expect(migrationSql).toContain('reservation_id uuid null');
    expect(migrationSql).toContain('author_profile_id uuid null');
    expect(migrationSql).toContain('uploaded_by uuid null');
    expect(migrationSql).toContain('approved_by uuid null');
  });

  it('adds a non-destructive review request link table migration', () => {
    const migrationSql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations_archive',
        'pre_baseline_20260614',
        '20260510_review_request_links.sql',
      ),
      'utf8',
    );

    expect(migrationSql).toContain('create table if not exists public.review_request_links');
    expect(migrationSql).toContain('create index if not exists review_request_links_store_created_idx');
    expect(migrationSql).toContain('alter table public.review_request_links enable row level security');
    expect(migrationSql).not.toMatch(/drop table|truncate|delete from/i);
  });

  it('adds non-destructive public review safety hardening migration', () => {
    const migrationSql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations_archive',
        'pre_baseline_20260614',
        '20260511_review_public_safety_hardening.sql',
      ),
      'utf8',
    );

    expect(migrationSql).toContain('add column if not exists public_token');
    expect(migrationSql).toContain('create unique index if not exists review_request_links_public_token_idx');
    expect(migrationSql).toContain('drop policy if exists "store_reviews_public_read_published"');
    expect(migrationSql).toContain('store_reviews_member_access');
    expect(migrationSql).toContain('review_request_links_member_access');
    expect(migrationSql).not.toMatch(/drop table|truncate|delete from/i);
  });

  it('keeps live public and social account queries on safe explicit column lists', () => {
    const serviceSource = readFileSync(
      join(process.cwd(), 'src', 'shared', 'lib', 'services', 'contentEngineService.ts'),
      'utf8',
    );

    expect(serviceSource).toContain('PUBLIC_REVIEW_COLUMNS');
    expect(serviceSource).toContain('PUBLIC_BLOG_POST_COLUMNS');
    expect(serviceSource).toContain('SOCIAL_ACCOUNT_SAFE_COLUMNS');
    expect(serviceSource).not.toContain("from('social_accounts').select('*')");
  });
});
