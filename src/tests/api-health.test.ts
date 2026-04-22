import { afterEach, describe, expect, it, vi } from 'vitest';

import healthHandler from '../../api/health';

describe('/api/health', () => {
  const originalEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_APP_RUNTIME_MODE: process.env.VITE_APP_RUNTIME_MODE,
    VITE_DATA_PROVIDER: process.env.VITE_DATA_PROVIDER,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  };
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a fast 503 when server-only Supabase credentials are missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const response = await healthHandler(
      new Request('https://example.com/api/health', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      services: {
        gemini: { ok: false, reason: 'GEMINI_API_KEY missing' },
        openai: { ok: false, reason: 'OPENAI_API_KEY missing' },
        supabase: {
          anonConfigured: true,
          ok: false,
          reason: 'SUPABASE_SERVICE_ROLE_KEY missing',
        },
      },
    });
  });

  it('returns a timeout reason instead of hanging when Supabase is slow', async () => {
    vi.useFakeTimers();

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.GEMINI_API_KEY = 'gemini-key';

    globalThis.fetch = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const rejectWithTimeout = () => {
            const timeoutError = new Error('The operation was aborted due to timeout');
            timeoutError.name = 'TimeoutError';
            reject(timeoutError);
          };

          if (init?.signal?.aborted) {
            rejectWithTimeout();
            return;
          }

          init?.signal?.addEventListener('abort', rejectWithTimeout, { once: true });
        }),
    ) as typeof fetch;

    const responsePromise = healthHandler(
      new Request('https://example.com/api/health', {
        method: 'GET',
      }),
    );
    await vi.advanceTimersByTimeAsync(5000);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      services: {
        gemini: { ok: true },
        openai: { model: 'gpt-4o-mini', ok: true },
        supabase: {
          ok: false,
          reason: 'Supabase health check timed out after 5000ms',
        },
      },
    });
  });
});
