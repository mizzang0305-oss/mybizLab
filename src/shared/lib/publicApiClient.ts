import { PUBLIC_SERVICE_ORIGIN } from '@/shared/lib/appConfig';

type PublicApiMethod = 'GET' | 'POST';

interface PublicApiRequestOptions {
  body?: unknown;
  method?: PublicApiMethod;
  searchParams?: Record<string, string | undefined>;
}

function buildPublicApiUrl(path: string, searchParams?: Record<string, string | undefined>) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : PUBLIC_SERVICE_ORIGIN;
  const url = new URL(path, baseUrl);

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    url.searchParams.set(key, value);
  });

  if (typeof window !== 'undefined') {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}

export async function requestPublicApi<T>(path: string, options?: PublicApiRequestOptions): Promise<T> {
  const response = await fetch(buildPublicApiUrl(path, options?.searchParams), {
    method: options?.method || 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const rawText = await response.text();
  const payload = rawText ? (JSON.parse(rawText) as { data?: T; error?: string; message?: string }) : {};

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Public API request failed with ${response.status}.`);
  }

  return (payload.data ?? (payload as T)) as T;
}
