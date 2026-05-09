import type { SupabaseClient } from '@supabase/supabase-js';

import { getDatabase } from '../shared/lib/mockDb.js';
import {
  buildRobotsTxt,
  buildSitemapXml,
  buildStaticSitemapEntries,
  buildStoreSitemapEntries,
  resolvePublicBaseUrl,
  sanitizeSeoText,
  safeImageUrl,
  type SeoStoreSummary,
} from '../shared/lib/seo.js';
import { toPublicStoreReviewDto } from '../shared/lib/services/contentEngineService.js';
import type { PublicStoreReview, StoreBlogPost } from '../shared/types/models.js';

type SeoRequestLike = Request | { headers?: unknown; method?: string; url?: string };

interface SeoSnapshot {
  postsByStore: Map<string, StoreBlogPost[]>;
  reviewsByStore: Map<string, PublicStoreReview[]>;
  stores: SeoStoreSummary[];
}

const PUBLIC_BLOG_POST_COLUMNS =
  'post_id,store_id,title,slug,excerpt,body,cover_image_url,media_urls,status,published_at,seo_title,seo_description,tags,created_at,updated_at';
const PUBLIC_REVIEW_COLUMNS = 'review_id,rating,title,body,media_urls,reviewer_display_name,created_at,store_id';
const PUBLIC_STORE_PAGE_COLUMNS =
  'store_id,slug,brand_name,logo_url,description,business_type,phone,address,homepage_visible,public_status,updated_at';

function responseText(body: string, contentType: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'cache-control': 'public, max-age=300, s-maxage=900',
      'content-type': contentType,
    },
  });
}

function getRequestUrl(request: SeoRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';
  const host =
    request.headers instanceof Headers
      ? request.headers.get('host')
      : request.headers && typeof request.headers === 'object' && 'host' in request.headers
        ? String((request.headers as { host?: unknown }).host || '')
        : '';

  return new URL(rawUrl, host ? `https://${host}` : 'https://mybiz.ai.kr');
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeBlogPostRow(row: Record<string, unknown>): StoreBlogPost {
  return {
    post_id: sanitizeSeoText(row.post_id || row.id, 'post'),
    store_id: sanitizeSeoText(row.store_id, ''),
    author_profile_id: undefined,
    source_type: 'manual',
    title: sanitizeSeoText(row.title, '매장 소식', 140),
    slug: sanitizeSeoText(row.slug, 'post', 120),
    excerpt: sanitizeSeoText(row.excerpt, '', 180) || undefined,
    body: sanitizeSeoText(row.body, '', 280),
    cover_image_url: safeImageUrl(row.cover_image_url),
    media_urls: toStringArray(row.media_urls).filter((url) => Boolean(safeImageUrl(url))),
    status: row.status === 'published' ? 'published' : 'draft',
    published_at: sanitizeSeoText(row.published_at, '') || undefined,
    seo_title: sanitizeSeoText(row.seo_title, '', 110) || undefined,
    seo_description: sanitizeSeoText(row.seo_description, '', 180) || undefined,
    tags: toStringArray(row.tags).map((tag) => sanitizeSeoText(tag, '', 40)).filter(Boolean),
    created_at: sanitizeSeoText(row.created_at, '') || new Date().toISOString(),
    updated_at: sanitizeSeoText(row.updated_at, '') || sanitizeSeoText(row.published_at, '') || new Date().toISOString(),
  };
}

function normalizeStorePageRow(row: Record<string, unknown>): SeoStoreSummary | null {
  const slug = sanitizeSeoText(row.slug, '', 120);
  const storeId = sanitizeSeoText(row.store_id, '', 80);

  if (!slug || !storeId || row.public_status === 'private' || row.homepage_visible === false) {
    return null;
  }

  return {
    id: storeId,
    slug,
    name: sanitizeSeoText(row.brand_name || row.name, 'MyBiz 매장', 120),
    description: sanitizeSeoText(row.description, '', 180),
    logo_url: safeImageUrl(row.logo_url),
    business_type: sanitizeSeoText(row.business_type, '', 80) || undefined,
    phone: sanitizeSeoText(row.phone, '', 40) || undefined,
    address: sanitizeSeoText(row.address, '', 160) || undefined,
    updated_at: sanitizeSeoText(row.updated_at, '') || undefined,
  };
}

function groupByStore<T extends { store_id: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const current = grouped.get(item.store_id) || [];
    current.push(item);
    grouped.set(item.store_id, current);
  });
  return grouped;
}

function emptySnapshot(): SeoSnapshot {
  return {
    postsByStore: new Map(),
    reviewsByStore: new Map(),
    stores: [],
  };
}

function loadDemoSeoSnapshot(): SeoSnapshot {
  try {
    const database = getDatabase();
    const stores = database.store_public_pages
      .map((page) =>
        normalizeStorePageRow({
          ...page,
          brand_name: page.brand_name,
          logo_url: page.logo_url,
        }),
      )
      .filter((store): store is SeoStoreSummary => Boolean(store));
    const publicStoreIds = new Set(stores.map((store) => store.id));
    const posts = database.store_blog_posts
      .filter((post) => post.status === 'published' && publicStoreIds.has(post.store_id))
      .map((post) => normalizeBlogPostRow(post as unknown as Record<string, unknown>))
      .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
    const reviews = database.store_reviews
      .filter((review) => review.visibility_status === 'published' && publicStoreIds.has(review.store_id))
      .map((review) => ({
        ...toPublicStoreReviewDto(review),
        store_id: review.store_id,
      }));

    return {
      postsByStore: groupByStore(posts),
      reviewsByStore: groupByStore(reviews),
      stores,
    };
  } catch {
    return emptySnapshot();
  }
}

async function loadSupabaseSeoSnapshot(client: SupabaseClient): Promise<SeoSnapshot> {
  const { data: storeRows, error: storeError } = await client
    .from('store_public_pages')
    .select(PUBLIC_STORE_PAGE_COLUMNS)
    .eq('homepage_visible', true)
    .eq('public_status', 'public');

  if (storeError) {
    throw new Error(`Failed to load public store pages for SEO: ${storeError.message}`);
  }

  const stores = ((storeRows || []) as Record<string, unknown>[])
    .map((row) => normalizeStorePageRow(row))
    .filter((store): store is SeoStoreSummary => Boolean(store));
  const storeIds = stores.map((store) => store.id);

  if (!storeIds.length) {
    return emptySnapshot();
  }

  const [{ data: postRows, error: postError }, { data: reviewRows, error: reviewError }] = await Promise.all([
    client
      .from('store_blog_posts')
      .select(PUBLIC_BLOG_POST_COLUMNS)
      .in('store_id', storeIds)
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
    client
      .from('store_reviews')
      .select(PUBLIC_REVIEW_COLUMNS)
      .in('store_id', storeIds)
      .eq('visibility_status', 'published')
      .order('created_at', { ascending: false }),
  ]);

  if (postError) {
    throw new Error(`Failed to load public blog posts for SEO: ${postError.message}`);
  }

  if (reviewError) {
    throw new Error(`Failed to load public reviews for SEO: ${reviewError.message}`);
  }

  const posts = ((postRows || []) as Record<string, unknown>[]).map((row) => normalizeBlogPostRow(row));
  const reviews = ((reviewRows || []) as Record<string, unknown>[]).map((row) => ({
    ...toPublicStoreReviewDto(row),
    store_id: sanitizeSeoText(row.store_id, ''),
  }));

  return {
    postsByStore: groupByStore(posts),
    reviewsByStore: groupByStore(reviews),
    stores,
  };
}

export async function loadSeoSnapshot(options?: { client?: SupabaseClient }) {
  if (options?.client) {
    try {
      return await loadSupabaseSeoSnapshot(options.client);
    } catch {
      return loadDemoSeoSnapshot();
    }
  }

  return loadDemoSeoSnapshot();
}

export async function buildGlobalSitemapXml(options?: { baseUrl?: string; client?: SupabaseClient }) {
  const baseUrl = resolvePublicBaseUrl(options?.baseUrl);
  const snapshot = await loadSeoSnapshot({ client: options?.client });
  const entries = [
    ...buildStaticSitemapEntries(baseUrl),
    ...snapshot.stores.flatMap((store) =>
      buildStoreSitemapEntries({
        baseUrl,
        posts: snapshot.postsByStore.get(store.id) || [],
        reviews: snapshot.reviewsByStore.get(store.id) || [],
        store,
      }),
    ),
  ];

  return buildSitemapXml(entries);
}

export async function buildStoreSitemapXml(
  storeSlug: string,
  options?: { baseUrl?: string; client?: SupabaseClient },
) {
  const baseUrl = resolvePublicBaseUrl(options?.baseUrl);
  const snapshot = await loadSeoSnapshot({ client: options?.client });
  const store = snapshot.stores.find((candidate) => candidate.slug === sanitizeSeoText(storeSlug, '', 120));

  if (!store) {
    return null;
  }

  return buildSitemapXml(
    buildStoreSitemapEntries({
      baseUrl,
      posts: snapshot.postsByStore.get(store.id) || [],
      reviews: snapshot.reviewsByStore.get(store.id) || [],
      store,
    }),
  );
}

export async function handleSitemapRequest(request: SeoRequestLike, options?: { client?: SupabaseClient }) {
  const url = getRequestUrl(request);
  const xml = await buildGlobalSitemapXml({ baseUrl: url.origin, client: options?.client });

  return responseText(xml, 'application/xml; charset=utf-8');
}

export async function handleStoreSitemapRequest(
  request: SeoRequestLike,
  options?: { client?: SupabaseClient; storeSlug?: string },
) {
  const url = getRequestUrl(request);
  const storeSlug = sanitizeSeoText(options?.storeSlug || url.searchParams.get('storeSlug'), '', 120);
  const xml = storeSlug ? await buildStoreSitemapXml(storeSlug, { baseUrl: url.origin, client: options?.client }) : null;

  if (!xml) {
    return responseText(buildSitemapXml([]), 'application/xml; charset=utf-8', 404);
  }

  return responseText(xml, 'application/xml; charset=utf-8');
}

export async function handleRobotsRequest(request: SeoRequestLike) {
  const url = getRequestUrl(request);

  return responseText(buildRobotsTxt(url.origin), 'text/plain; charset=utf-8');
}
