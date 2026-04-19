/**
 * api/health.ts
 * 연결 상태 체크 엔드포인트
 * mybiz.ai.kr/api/health 로 접속해서 확인
 */

import { readServerEnv } from '../src/server/serverEnv.js';

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

  if (!url) return { ok: false, reason: 'SUPABASE_URL 미설정' };
  if (!serviceKey) return { ok: false, reason: 'SUPABASE_SERVICE_ROLE_KEY 미설정' };

  try {
    const res = await fetch(`${url}/rest/v1/stores?select=store_id&limit=1`, {
      headers: {
        apikey: anonKey || serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (res.ok) {
      const data = await res.json() as unknown[];
      return { ok: true, tableExists: true, rowCount: data.length };
    }

    return { ok: false, status: res.status, reason: await res.text() };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '연결 실패' };
  }
}

async function checkOpenAI() {
  const key = readServerEnv('OPENAI_API_KEY');
  if (!key) return { ok: false, reason: 'OPENAI_API_KEY 미설정' };
  return { ok: true, model: readServerEnv('OPENAI_MODEL') || 'gpt-4o-mini' };
}

async function checkGemini() {
  const key = readServerEnv('GEMINI_API_KEY');
  if (!key) return { ok: false, reason: 'GEMINI_API_KEY 미설정' };
  return { ok: true };
}

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return json({ error: 'GET only' }, 405);
  }

  const [supabase, openai, gemini] = await Promise.all([
    checkSupabase(),
    checkOpenAI(),
    checkGemini(),
  ]);

  const allOk = supabase.ok;

  return json({
    ok: allOk,
    timestamp: new Date().toISOString(),
    env: {
      VITE_DATA_PROVIDER: readServerEnv('VITE_DATA_PROVIDER') || '미설정 (local)',
      VITE_APP_RUNTIME_MODE: readServerEnv('VITE_APP_RUNTIME_MODE') || '미설정 (demo)',
    },
    services: {
      supabase,
      openai,
      gemini,
    },
  }, allOk ? 200 : 503);
}
