import {
  handleRobotsRequest,
  handleSitemapRequest,
  handleStoreSitemapRequest,
} from '../src/server/seoRoutes.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../src/server/nodeResponse.js';
import { getSupabaseAdminClient } from '../src/server/supabaseAdmin.js';
import { config, methodNotAllowed, type PublicRequestLike } from './public/_shared.js';

function getRequestUrl(request: PublicRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';
  return new URL(rawUrl, 'https://mybiz.ai.kr');
}

function getSeoResource(request: PublicRequestLike) {
  const url = getRequestUrl(request);
  const resource = url.searchParams.get('resource')?.trim();

  if (resource) {
    return resource;
  }

  if (url.pathname.endsWith('/robots.txt')) {
    return 'robots';
  }

  if (url.pathname.endsWith('/sitemap.xml') && url.pathname.startsWith('/s/')) {
    return 'store-sitemap';
  }

  return 'sitemap';
}

function getStoreSlug(request: PublicRequestLike) {
  const url = getRequestUrl(request);
  const explicitSlug = url.searchParams.get('storeSlug')?.trim();
  if (explicitSlug) {
    return explicitSlug;
  }

  const storeSitemapMatch = url.pathname.match(/^\/s\/([^/]+)\/sitemap\.xml$/);
  return storeSitemapMatch?.[1];
}

function getOptionalAdminClient() {
  try {
    return getSupabaseAdminClient();
  } catch {
    return undefined;
  }
}

async function routeSeoRequest(request: PublicRequestLike) {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed('GET');
  }

  const client = getOptionalAdminClient();
  const resource = getSeoResource(request);

  if (resource === 'robots') {
    return handleRobotsRequest(request);
  }

  if (resource === 'store-sitemap') {
    return handleStoreSitemapRequest(request, {
      client,
      storeSlug: getStoreSlug(request),
    });
  }

  return handleSitemapRequest(request, { client });
}

export { config };

export default async function handler(request: PublicRequestLike, response?: NodeResponseLike) {
  const result = await routeSeoRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
