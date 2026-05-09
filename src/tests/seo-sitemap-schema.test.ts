import { beforeEach, describe, expect, it } from 'vitest';

import seoHandler from '../../api/seo';
import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import {
  buildBlogPostingJsonLd,
  buildRobotsTxt,
  buildStoreLocalBusinessJsonLd,
  buildStoreReviewJsonLd,
  canonicalUrl,
  sanitizeSeoText,
} from '@/shared/lib/seo';
import { createReviewRequestLink } from '@/shared/lib/services/contentEngineService';

const BASE_URL = 'https://mybiz.ai.kr';

async function readText(response: Response) {
  return response.text();
}

describe('SEO sitemap, robots, and schema safety', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('serves the global sitemap with public routes and only published store content', async () => {
    updateDatabase((database) => {
      database.store_blog_posts.push(
        {
          post_id: 'blog_archived_seo_test',
          store_id: 'store_golden_coffee',
          author_profile_id: 'profile_golden_owner',
          source_type: 'manual',
          title: 'Archived blog should not be indexed',
          slug: 'archived-private-post',
          excerpt: 'hidden',
          body: 'hidden',
          media_urls: [],
          status: 'archived',
          tags: [],
          created_at: '2026-05-10T00:00:00.000Z',
          updated_at: '2026-05-10T00:00:00.000Z',
        },
        {
          post_id: 'blog_draft_seo_test',
          store_id: 'store_golden_coffee',
          author_profile_id: 'profile_golden_owner',
          source_type: 'manual',
          title: 'Draft blog should not be indexed',
          slug: 'draft-private-post',
          excerpt: 'hidden',
          body: 'hidden',
          media_urls: [],
          status: 'draft',
          tags: [],
          created_at: '2026-05-10T00:00:00.000Z',
          updated_at: '2026-05-10T00:00:00.000Z',
        },
      );
      database.store_reviews.push(
        {
          review_id: 'review_hidden_seo_test',
          store_id: 'store_golden_coffee',
          rating: 5,
          title: 'Hidden review',
          body: 'Hidden review body',
          media_urls: [],
          reviewer_display_name: 'Hidden',
          marketing_consent: false,
          content_usage_consent: false,
          visibility_status: 'hidden',
          keywords: [],
          created_at: '2026-05-10T00:00:00.000Z',
          updated_at: '2026-05-10T00:00:00.000Z',
        },
        {
          review_id: 'review_reported_seo_test',
          store_id: 'store_golden_coffee',
          rating: 1,
          title: 'Reported review',
          body: 'Reported review body',
          media_urls: [],
          reviewer_display_name: 'Reported',
          marketing_consent: false,
          content_usage_consent: false,
          visibility_status: 'reported',
          keywords: [],
          created_at: '2026-05-10T00:00:00.000Z',
          updated_at: '2026-05-10T00:00:00.000Z',
        },
      );
    });

    const response = await seoHandler(new Request(`${BASE_URL}/sitemap.xml`));
    const xml = await readText(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/features</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/pricing</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/faq</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/trust</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/cases</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/about</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/contact</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/golden-coffee</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/golden-coffee/blog</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/golden-coffee/blog/golden-weekly-update</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/s/golden-coffee/review</loc>');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/dashboard');
    expect(xml).not.toContain('/demo/dashboard');
    expect(xml).not.toContain('/login');
    expect(xml).not.toContain('/onboarding');
    expect(xml).not.toContain('archived-private-post');
    expect(xml).not.toContain('draft-private-post');
    expect(xml).not.toContain('review_hidden_seo_test');
    expect(xml).not.toContain('review_reported_seo_test');
    expect(xml).not.toContain('?r=');
    expect(xml).not.toContain('public_token');
  });

  it('serves a store sitemap without token, private, draft, or admin URLs', async () => {
    const tokenLink = await createReviewRequestLink(
      'store_golden_coffee',
      { baseUrl: BASE_URL, sourceType: 'store' },
      { actorProfileId: 'profile_golden_owner' },
    );

    const response = await seoHandler(new Request(`${BASE_URL}/api/seo?resource=store-sitemap&storeSlug=golden-coffee`));
    const xml = await readText(response);

    expect(response.status).toBe(200);
    expect(xml).toContain('<loc>https://mybiz.ai.kr/golden-coffee</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/golden-coffee/blog</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/golden-coffee/blog/golden-weekly-update</loc>');
    expect(xml).toContain('<loc>https://mybiz.ai.kr/s/golden-coffee/review</loc>');
    expect(xml).not.toContain(tokenLink.public_token || 'missing-token');
    expect(xml).not.toContain('?r=');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/dashboard');
  });

  it('serves robots.txt with crawl boundaries and a production sitemap URL', async () => {
    const response = await seoHandler(new Request(`${BASE_URL}/robots.txt`));
    const text = await readText(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain('Allow: /');
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Disallow: /dashboard');
    expect(text).toContain('Disallow: /api/admin');
    expect(text).toContain('Disallow: /demo/dashboard');
    expect(text).toContain('Disallow: /login');
    expect(text).toContain('Disallow: /onboarding');
    expect(text).toContain('Disallow: /*?r=');
    expect(text).toContain('Sitemap: https://mybiz.ai.kr/sitemap.xml');
    expect(text).not.toContain('localhost');
    expect(text).not.toContain('127.0.0.1');
  });

  it('builds safe canonical URLs, LocalBusiness, BlogPosting, and Review JSON-LD without internal fields', () => {
    const store = {
      id: 'store_golden_coffee',
      name: '골든커피 <script>alert(1)</script>',
      slug: 'golden-coffee',
      description: '커피와 고객 기억을 연결하는 매장입니다.',
      logo_url: 'https://example.com/store.jpg',
      phone: '032-214-5757',
      address: '인천 남동구',
      business_type: 'cafe',
      updated_at: '2026-05-10T00:00:00.000Z',
    };
    const publishedReview = {
      review_id: 'review_public',
      rating: 5,
      title: '좋은 방문',
      body: '직원이 친절했습니다.',
      media_urls: [],
      reviewer_display_name: '',
      created_at: '2026-05-10T00:00:00.000Z',
    };
    const blogPost = {
      post_id: 'blog_public',
      store_id: 'store_golden_coffee',
      source_type: 'manual' as const,
      title: '봄 소식 <script>alert(1)</script>',
      slug: 'spring-news',
      excerpt: '새로운 매장 소식입니다.',
      body: '본문 전체를 JSON-LD에 과도하게 넣지 않습니다.',
      cover_image_url: 'https://example.com/blog.jpg',
      media_urls: [],
      status: 'published' as const,
      published_at: '2026-05-09T00:00:00.000Z',
      tags: [],
      created_at: '2026-05-09T00:00:00.000Z',
      updated_at: '2026-05-10T00:00:00.000Z',
    };

    expect(canonicalUrl('/golden-coffee', 'http://localhost:3000')).toBe('https://mybiz.ai.kr/golden-coffee');
    expect(sanitizeSeoText('<script>alert(1)</script>????', 'fallback')).toBe('fallback');

    const localBusiness = buildStoreLocalBusinessJsonLd({ baseUrl: BASE_URL, reviews: [publishedReview], store });
    const blogSchema = buildBlogPostingJsonLd({ baseUrl: BASE_URL, post: blogPost, store });
    const reviewSchema = buildStoreReviewJsonLd({ baseUrl: BASE_URL, reviews: [publishedReview], store });
    const serialized = JSON.stringify([localBusiness, blogSchema, reviewSchema]);

    expect(localBusiness).toMatchObject({
      '@type': 'LocalBusiness',
      name: '골든커피',
      url: 'https://mybiz.ai.kr/golden-coffee',
    });
    expect(localBusiness).not.toHaveProperty('aggregateRating');
    expect(blogSchema).toMatchObject({
      '@type': 'BlogPosting',
      headline: '봄 소식',
      mainEntityOfPage: 'https://mybiz.ai.kr/golden-coffee/blog/spring-news',
    });
    expect(reviewSchema).toMatchObject({
      '@type': 'ItemList',
      itemListElement: [
        expect.objectContaining({
          reviewBody: '직원이 친절했습니다.',
          author: { '@type': 'Person', name: '고객' },
        }),
      ],
    });
    expect(serialized).not.toContain('customer_id');
    expect(serialized).not.toContain('order_id');
    expect(serialized).not.toContain('reservation_id');
    expect(serialized).not.toContain('public_token');
    expect(serialized).not.toContain('<script>');
    expect(serialized).not.toContain('????');
  });

  it('does not create fake aggregate rating until enough published reviews exist', () => {
    const store = {
      id: 'store_golden_coffee',
      name: '골든커피',
      slug: 'golden-coffee',
      description: '커피 매장',
      updated_at: '2026-05-10T00:00:00.000Z',
    };
    const reviews = [5, 4, 5].map((rating, index) => ({
      review_id: `review_${index}`,
      rating,
      title: '방문 후기',
      body: '실제 공개 리뷰입니다.',
      media_urls: [],
      reviewer_display_name: '방문 고객',
      created_at: '2026-05-10T00:00:00.000Z',
    }));

    expect(buildStoreLocalBusinessJsonLd({ baseUrl: BASE_URL, reviews: [], store })).not.toHaveProperty('aggregateRating');
    expect(buildStoreLocalBusinessJsonLd({ baseUrl: BASE_URL, reviews: reviews.slice(0, 2), store })).not.toHaveProperty('aggregateRating');
    expect(buildStoreLocalBusinessJsonLd({ baseUrl: BASE_URL, reviews, store })).toMatchObject({
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.7,
        reviewCount: 3,
      },
    });
  });

  it('builds robots text from localhost input without leaking localhost', () => {
    const text = buildRobotsTxt('http://localhost:3000');

    expect(text).toContain('Sitemap: https://mybiz.ai.kr/sitemap.xml');
    expect(text).not.toContain('localhost');
  });
});
