import type { PublicStoreReview, StoreBlogPost } from '../types/models';

export const DEFAULT_PUBLIC_BASE_URL = 'https://mybiz.ai.kr';
const MIN_AGGREGATE_REVIEW_COUNT = 3;

type JsonLdObject = Record<string, unknown>;

export interface SeoStoreSummary {
  address?: string;
  business_type?: string;
  description?: string;
  id: string;
  logo_url?: string;
  name: string;
  phone?: string;
  slug: string;
  updated_at?: string;
}

export interface SitemapEntry {
  changefreq?: 'daily' | 'weekly' | 'monthly';
  lastmod?: string;
  loc: string;
  priority?: number;
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function stripControlCharacters(value: string) {
  return [...value].map((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
}

export function resolvePublicBaseUrl(baseUrl?: string) {
  const candidate = normalizeText(baseUrl);

  try {
    const parsed = new URL(candidate || DEFAULT_PUBLIC_BASE_URL);
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local')
    ) {
      return DEFAULT_PUBLIC_BASE_URL;
    }

    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_BASE_URL;
  }
}

export function canonicalUrl(path: string, baseUrl?: string) {
  const url = new URL(path || '/', resolvePublicBaseUrl(baseUrl));
  url.hash = '';
  url.search = '';

  return url.toString().replace(/\/$/, url.pathname === '/' ? '/' : '');
}

export function sanitizeSeoText(value: unknown, fallback = '', maxLength = 180) {
  const htmlStripped = normalizeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const stripped = stripControlCharacters(htmlStripped)
    .replace(/(?:\?|\uFFFD){3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const safe = stripped || fallback;
  return safe.length > maxLength ? `${safe.slice(0, maxLength - 1).trim()}…` : safe;
}

export function safeImageUrl(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function escapeXml(value: unknown) {
  return normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatLastmod(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function buildSitemapXml(entries: SitemapEntry[]) {
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.loc, entry])).values()];
  const urls = uniqueEntries
    .map((entry) => {
      const lastmod = formatLastmod(entry.lastmod);
      return [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : '',
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
        entry.priority ? `    <priority>${entry.priority.toFixed(1)}</priority>` : '',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobotsTxt(baseUrl?: string) {
  const origin = resolvePublicBaseUrl(baseUrl);

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /api/admin',
    'Disallow: /demo/dashboard',
    'Disallow: /login',
    'Disallow: /admin-login',
    'Disallow: /onboarding',
    'Disallow: /api/',
    'Disallow: /*?r=',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function storePath(store: Pick<SeoStoreSummary, 'slug'>) {
  return `/${encodeURIComponent(store.slug)}`;
}

export function buildStaticSitemapEntries(baseUrl?: string): SitemapEntry[] {
  return [
    { loc: canonicalUrl('/', baseUrl), changefreq: 'weekly', priority: 1 },
    { loc: canonicalUrl('/features', baseUrl), changefreq: 'monthly', priority: 0.8 },
    { loc: canonicalUrl('/pricing', baseUrl), changefreq: 'monthly', priority: 0.8 },
    { loc: canonicalUrl('/faq', baseUrl), changefreq: 'monthly', priority: 0.7 },
    { loc: canonicalUrl('/trust', baseUrl), changefreq: 'monthly', priority: 0.7 },
    { loc: canonicalUrl('/cases', baseUrl), changefreq: 'monthly', priority: 0.7 },
    { loc: canonicalUrl('/about', baseUrl), changefreq: 'monthly', priority: 0.6 },
    { loc: canonicalUrl('/contact', baseUrl), changefreq: 'monthly', priority: 0.6 },
  ];
}

export function buildStoreSitemapEntries({
  baseUrl,
  posts,
  reviews,
  store,
}: {
  baseUrl?: string;
  posts: StoreBlogPost[];
  reviews: PublicStoreReview[];
  store: SeoStoreSummary;
}): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    {
      loc: canonicalUrl(storePath(store), baseUrl),
      lastmod: store.updated_at,
      changefreq: 'weekly',
      priority: 0.8,
    },
  ];

  if (posts.length) {
    entries.push({
      loc: canonicalUrl(`${storePath(store)}/blog`, baseUrl),
      lastmod: posts[0]?.updated_at || posts[0]?.published_at,
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  posts.forEach((post) => {
    entries.push({
      loc: canonicalUrl(`${storePath(store)}/blog/${encodeURIComponent(post.slug)}`, baseUrl),
      lastmod: post.updated_at || post.published_at,
      changefreq: 'monthly',
      priority: 0.6,
    });
  });

  if (reviews.length) {
    entries.push({
      loc: canonicalUrl(`/s/${encodeURIComponent(store.slug)}/review`, baseUrl),
      lastmod: reviews[0]?.created_at,
      changefreq: 'weekly',
      priority: 0.5,
    });
  }

  return entries;
}

export function buildStoreSeoTitle(store: Pick<SeoStoreSummary, 'name'>, suffix = 'MyBiz') {
  return sanitizeSeoText(`${store.name} | ${suffix}`, 'MyBiz 매장');
}

export function buildStoreSeoDescription(store: Pick<SeoStoreSummary, 'description' | 'name'>) {
  return sanitizeSeoText(
    store.description,
    `${sanitizeSeoText(store.name, '매장')}의 공개 매장 정보, 블로그 소식, 실제 고객 리뷰를 확인하세요.`,
  );
}

export function buildStoreLocalBusinessJsonLd({
  baseUrl,
  reviews,
  store,
}: {
  baseUrl?: string;
  reviews?: PublicStoreReview[];
  store: SeoStoreSummary;
}): JsonLdObject {
  const safeReviews = reviews?.filter((review) => review.rating >= 1 && review.rating <= 5) || [];
  const schema: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: sanitizeSeoText(store.name, 'MyBiz 매장', 120),
    description: buildStoreSeoDescription(store),
    url: canonicalUrl(storePath(store), baseUrl),
  };
  const image = safeImageUrl(store.logo_url);

  if (image) {
    schema.image = image;
  }

  if (store.phone) {
    schema.telephone = sanitizeSeoText(store.phone, '', 40);
  }

  if (store.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: sanitizeSeoText(store.address, '', 160),
    };
  }

  if (safeReviews.length >= MIN_AGGREGATE_REVIEW_COUNT) {
    const ratingValue = Number(
      (safeReviews.reduce((sum, review) => sum + review.rating, 0) / safeReviews.length).toFixed(1),
    );
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount: safeReviews.length,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

export function buildBlogPostingJsonLd({
  baseUrl,
  post,
  store,
}: {
  baseUrl?: string;
  post: StoreBlogPost;
  store: SeoStoreSummary;
}): JsonLdObject {
  const url = canonicalUrl(`${storePath(store)}/blog/${encodeURIComponent(post.slug)}`, baseUrl);
  const image = safeImageUrl(post.cover_image_url) || safeImageUrl(post.media_urls[0]) || safeImageUrl(store.logo_url);

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: sanitizeSeoText(post.seo_title || post.title, '매장 소식', 110),
    description: sanitizeSeoText(post.seo_description || post.excerpt || post.body, buildStoreSeoDescription(store), 180),
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: {
      '@type': 'Organization',
      name: sanitizeSeoText(store.name, 'MyBiz 매장', 120),
    },
    publisher: {
      '@type': 'Organization',
      name: sanitizeSeoText(store.name, 'MyBiz 매장', 120),
    },
    image,
    mainEntityOfPage: url,
    url,
  };
}

export function buildStoreReviewJsonLd({
  baseUrl,
  reviews,
  store,
}: {
  baseUrl?: string;
  reviews: PublicStoreReview[];
  store: SeoStoreSummary;
}): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${sanitizeSeoText(store.name, '매장', 80)} 공개 리뷰`,
    url: canonicalUrl(`/s/${encodeURIComponent(store.slug)}/review`, baseUrl),
    itemListElement: reviews.map((review, index) => ({
      '@type': 'Review',
      position: index + 1,
      name: sanitizeSeoText(review.title, '방문 리뷰', 100),
      reviewBody: sanitizeSeoText(review.body, '', 240),
      datePublished: review.created_at,
      author: {
        '@type': 'Person',
        name: sanitizeSeoText(review.reviewer_display_name, '고객', 80),
      },
      itemReviewed: {
        '@type': 'LocalBusiness',
        name: sanitizeSeoText(store.name, 'MyBiz 매장', 120),
        url: canonicalUrl(storePath(store), baseUrl),
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    })),
  };
}
