import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestPublicApi } from '@/shared/lib/publicApiClient';

describe('requestPublicApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the API payload data when the request succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    ) as typeof fetch;

    await expect(requestPublicApi<{ ok: boolean }>('/api/public/store')).resolves.toEqual({ ok: true });
  });

  it('throws a clear error when the public API returns HTML instead of JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('<!doctype html><html><body>Auth required</body></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 200,
      }),
    ) as typeof fetch;

    await expect(requestPublicApi('/api/public/store')).rejects.toThrow(
      'Public API returned HTML instead of JSON. Please refresh the page or verify the production deployment routing.',
    );
  });

  it('throws a clear timeout error when the request never resolves', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const request = requestPublicApi('/api/public/store');
    const assertion = expect(request).rejects.toThrow('Public API request timed out. Please try again in a moment.');

    await vi.advanceTimersByTimeAsync(8000);

    await assertion;
  });

  it('respects a custom timeout for slower mutation requests', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const request = requestPublicApi('/api/public/inquiry', { method: 'POST', timeoutMs: 20000 });
    const assertion = expect(request).rejects.toThrow('Public API request timed out. Please try again in a moment.');

    await vi.advanceTimersByTimeAsync(19999);
    await Promise.resolve();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    await assertion;
  });
});
