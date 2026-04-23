import { resolveServerApiUrl } from './serverApiUrl.js';

type PublicApiMethod = 'GET' | 'POST';

interface PublicApiRequestOptions {
  body?: unknown;
  method?: PublicApiMethod;
  searchParams?: Record<string, string | undefined>;
  timeoutMs?: number;
}

const PUBLIC_API_TIMEOUT_MS = 8000;

function buildPublicApiUrl(path: string, searchParams?: Record<string, string | undefined>) {
  const url = new URL(resolveServerApiUrl(path), typeof window !== 'undefined' ? window.location.origin : undefined);

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString().startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
}

export async function requestPublicApi<T>(path: string, options?: PublicApiRequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? PUBLIC_API_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildPublicApiUrl(path, options?.searchParams), {
      method: options?.method || 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const rawText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (!rawText.trim()) {
      if (!response.ok) {
        throw new Error(`Public API request failed with ${response.status}.`);
      }

      return {} as T;
    }

    if (contentType.includes('text/html') || rawText.trimStart().startsWith('<!doctype html') || rawText.trimStart().startsWith('<html')) {
      throw new Error('Public API returned HTML instead of JSON. Please refresh the page or verify the production deployment routing.');
    }

    let payload: { data?: T; error?: string; message?: string };

    try {
      payload = JSON.parse(rawText) as { data?: T; error?: string; message?: string };
    } catch {
      throw new Error('Public API returned an unreadable response. Please retry after the latest deployment finishes.');
    }

    if (!response.ok) {
      throw new Error(payload.error || payload.message || `Public API request failed with ${response.status}.`);
    }

    return (payload.data ?? (payload as T)) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Public API request timed out. Please try again in a moment.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
