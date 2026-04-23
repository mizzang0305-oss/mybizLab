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
});
