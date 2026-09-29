import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';

import healthHandler from '../../api/health';

async function requestHealthOverHttp(method: 'GET' | 'POST' = 'GET') {
  const server = createServer((request, response) => {
    void healthHandler(request as unknown as Request, response).catch((error: unknown) => {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : 'Health handler failed');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a local HTTP port');
    }

    return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const client = httpRequest(
        { hostname: '127.0.0.1', port: address.port, path: '/api/health', method },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString()) });
          });
          response.on('error', reject);
        },
      );
      client.setTimeout(1500, () => client.destroy(new Error('Health HTTP response did not terminate')));
      client.on('error', reject);
      client.end();
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

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

  it('terminates an actual HTTP response when credentials are missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await requestHealthOverHttp();

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ok: false,
      services: { supabase: { ok: false, reason: 'SUPABASE_SERVICE_ROLE_KEY missing' } },
    });
  });

  it('terminates an actual HTTP response with the Supabase read result', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-key';
    globalThis.fetch = vi.fn().mockResolvedValue(Response.json([{ store_id: 'synthetic-store' }])) as typeof fetch;

    const response = await requestHealthOverHttp();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      services: { supabase: { ok: true, rowCount: 1, tableExists: true } },
    });
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/stores?select=store_id&limit=1');
    expect(init?.method).toBeUndefined();
  });

  it('terminates an actual HTTP 405 response', async () => {
    const response = await requestHealthOverHttp('POST');

    expect(response.status).toBe(405);
    expect(response.body).toEqual({ error: 'GET only' });
  });

  it('does not return an ignored Web Response after writing a Node response', async () => {
    const end = vi.fn();

    const result = await healthHandler(new Request('https://example.com/api/health', { method: 'POST' }), {
      end,
      setHeader: vi.fn(),
      statusCode: 200,
    });

    expect(result).toBeUndefined();
    expect(end).toHaveBeenCalledOnce();
  });
});
