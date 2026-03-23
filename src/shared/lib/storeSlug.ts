import { DEV_STORE_ROUTE_PREFIX, PUBLIC_SERVICE_ORIGIN } from '@/shared/lib/appConfig';

export const RESERVED_STORE_SLUGS = [
  'admin',
  'api',
  'login',
  'onboarding',
  'dashboard',
  'pricing',
  'terms',
  'privacy',
  'refund',
  'store',
] as const;

export function normalizeStoreSlug(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{Script=Hangul}a-z0-9\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'store';
}

export function isReservedSlug(slug: string) {
  return RESERVED_STORE_SLUGS.includes(normalizeStoreSlug(slug) as (typeof RESERVED_STORE_SLUGS)[number]);
}

export function slugifyStoreName(name: string) {
  return normalizeStoreSlug(name);
}

export function ensureUniqueStoreSlug(candidate: string, existingSlugs: string[]) {
  const existing = new Set(existingSlugs.map((slug) => normalizeStoreSlug(slug)));
  let base = normalizeStoreSlug(candidate);

  if (isReservedSlug(base)) {
    base = `${base}-store`;
  }

  let unique = base;
  let suffix = 2;

  while (existing.has(unique) || isReservedSlug(unique)) {
    unique = `${base}-${suffix}`;
    suffix += 1;
  }

  return unique;
}

export function buildStoreUrl(slug: string) {
  return `${PUBLIC_SERVICE_ORIGIN}/${normalizeStoreSlug(slug)}`;
}

export function buildStorePath(slug: string, section?: 'menu' | 'order' | 'home') {
  const normalizedSlug = normalizeStoreSlug(slug);
  const basePath = DEV_STORE_ROUTE_PREFIX ? `${DEV_STORE_ROUTE_PREFIX}/${normalizedSlug}` : `/${normalizedSlug}`;

  if (!section || section === 'home') {
    return basePath;
  }

  return `${basePath}/${section}`;
}

export function buildStoreIdPath(storeId: string, section?: 'menu' | 'order' | 'home') {
  const normalizedStoreId = encodeURIComponent(storeId.trim());
  const basePath = `/store/${normalizedStoreId}`;

  if (!section || section === 'home') {
    return basePath;
  }

  return `${basePath}/${section}`;
}
