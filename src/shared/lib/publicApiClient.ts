import { resolveServerApiUrl } from '@/shared/lib/serverApiUrl';

type PublicApiMethod = 'GET' | 'POST';

interface PublicApiRequestOptions {
  body?: unknown;
  method?: PublicApiMethod;
  searchParams?: Record<string, string | undefined>;
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
  const timeout = setTimeout(() => controller.abort(), PUBLIC_API_TIMEOUT_MS);

  try {
    const response = await fetch(buildPublicApiUrl(path, options?.searchParams), {
      method: options?.method || 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const rawText = await response.text();
    const payload = rawText ? (JSON.parse(rawText) as { data?: T; error?: string; message?: string }) : {};

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
