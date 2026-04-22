/**
 * api/health.ts
 * Connected runtime health probe for server-side integrations.
 */

import { readServerEnv } from '../src/server/serverEnv.js';

const HEALTHCHECK_TIMEOUT_MS = 5000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function checkSupabase() {
  const url = readServerEnv('SUPABASE_URL') || readServerEnv('VITE_SUPABASE_URL');
  const serviceKey = readServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = readServerEnv('VITE_SUPABASE_ANON_KEY');

  if (!url) {
    return { ok: false, reason: 'SUPABASE_URL missing' };
  }

  if (!serviceKey) {
    return {
      ok: false,
      reason: 'SUPABASE_SERVICE_ROLE_KEY missing',
      anonConfigured: Boolean(anonKey),
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutResult = Symbol('supabase-health-timeout');
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, HEALTHCHECK_TIMEOUT_MS);
  timeoutId.unref?.();

  try {
    const responseResult = await Promise.race([
      fetch(`${url}/rest/v1/stores?select=store_id&limit=1`, {
        headers: {
          apikey: anonKey || serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: controller.signal,
      }),
      new Promise<typeof timeoutResult>((resolve) => {
        const timeoutRaceId = setTimeout(() => resolve(timeoutResult), HEALTHCHECK_TIMEOUT_MS);
        timeoutRaceId.unref?.();
      }),
    ]);

    if (responseResult === timeoutResult) {
      timedOut = true;
      controller.abort();
      return {
        ok: false,
        reason: `Supabase health check timed out after ${HEALTHCHECK_TIMEOUT_MS}ms`,
      };
    }

    const response = responseResult;

    if (response.ok) {
      const data = (await response.json()) as unknown[];
      return { ok: true, rowCount: data.length, tableExists: true };
    }

    return { ok: false, reason: await response.text(), status: response.status };
  } catch (error) {
    return {
      ok: false,
      reason:
        timedOut
          ? `Supabase health check timed out after ${HEALTHCHECK_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : 'Supabase connectivity check failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkOpenAI() {
  const key = readServerEnv('OPENAI_API_KEY');
  if (!key) {
    return { ok: false, reason: 'OPENAI_API_KEY missing' };
  }

  return { ok: true, model: readServerEnv('OPENAI_MODEL') || 'gpt-4o-mini' };
}

async function checkGemini() {
  const key = readServerEnv('GEMINI_API_KEY');
  if (!key) {
    return { ok: false, reason: 'GEMINI_API_KEY missing' };
  }

  return { ok: true };
}

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return json({ error: 'GET only' }, 405);
  }

  const [supabase, openai, gemini] = await Promise.all([checkSupabase(), checkOpenAI(), checkGemini()]);
  const allOk = supabase.ok;

  return json(
    {
      ok: allOk,
      timestamp: new Date().toISOString(),
      env: {
        VITE_APP_RUNTIME_MODE: readServerEnv('VITE_APP_RUNTIME_MODE') || 'missing (demo default)',
        VITE_DATA_PROVIDER: readServerEnv('VITE_DATA_PROVIDER') || 'missing (local default)',
      },
      services: {
        gemini,
        openai,
        supabase,
      },
    },
    allOk ? 200 : 503,
  );
}
