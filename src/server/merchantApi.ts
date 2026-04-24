import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

export type MerchantRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      rawBody?: unknown;
      url?: string;
    };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    status,
  });
}

function getHeaderValue(headers: Headers | Record<string, string | string[] | undefined> | undefined, key: string) {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(key) || undefined;
  }

  const matchedKey = Object.keys(headers).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  if (!matchedKey) {
    return undefined;
  }

  const value = headers[matchedKey];
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function getBearerToken(request: MerchantRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  const matched = authorization?.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

function isSchemaCompatError(error?: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('could not find the column')
  );
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function parseJsonBody<T>(request: MerchantRequestLike): Promise<T> {
  if (request instanceof Request) {
    return (await request.json()) as T;
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T;
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as T;
  }

  if (typeof request.rawBody === 'string') {
    return JSON.parse(request.rawBody) as T;
  }

  throw new Error('JSON body is required.');
}

async function assertMerchantStoreAccess(
  request: MerchantRequestLike,
  storeId: string,
): Promise<{ adminClient: SupabaseClient } | { error: Response }> {
  const token = getBearerToken(request);
  if (!token) {
    return { error: json({ ok: false, error: 'Authorization bearer token is required.' }, 401) };
  }

  const adminClient = getSupabaseAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return {
      error: json({ ok: false, error: `Supabase auth validation failed: ${authError?.message || 'No user found.'}` }, 401),
    };
  }

  const repository = createSupabaseRepository(adminClient);
  const resolvedAccess = await repository.resolveStoreAccess({
    fallbackEmail: authData.user.email || 'ops@mybiz.ai.kr',
    fallbackFullName: (authData.user.user_metadata?.full_name as string | undefined) || authData.user.email || '운영 관리자',
    fallbackProfileId: authData.user.id,
    requestedEmail: authData.user.email || undefined,
    requestedFullName: authData.user.user_metadata?.full_name as string | undefined,
  });

  if (!resolvedAccess?.accessibleStores.some((store) => store.id === storeId)) {
    return { error: json({ ok: false, error: 'The authenticated merchant does not have access to this store.' }, 403) };
  }

  return { adminClient };
}

async function assertOrderBelongsToStore(client: SupabaseClient, storeId: string, orderId: string): Promise<boolean> {
  let result = await client.from('orders').select('*').eq('order_id', orderId).eq('store_id', storeId).maybeSingle();
  if (result.error && isSchemaCompatError(result.error)) {
    result = await client.from('orders').select('*').eq('id', orderId).eq('store_id', storeId).maybeSingle();
  }

  if (result.error) {
    throw new Error(`Failed to validate merchant order: ${result.error.message}`);
  }

  return Boolean(result.data);
}

export async function handleMerchantOrderEventRequest(request: MerchantRequestLike): Promise<Response> {
  try {
    const body = await parseJsonBody<{
      amount?: number;
      orderId?: string;
      paymentId?: string;
      raw?: Record<string, unknown>;
      status?: string;
      storeId?: string;
    }>(request);

    const storeId = normalizeText(body.storeId);
    const orderId = normalizeText(body.orderId);
    const paymentId = normalizeText(body.paymentId);
    const raw = toRecord(body.raw);
    const status = normalizeText(body.status) || 'pending';

    if (!storeId || !orderId || !paymentId) {
      return json({ ok: false, error: 'storeId, orderId, and paymentId are required.' }, 400);
    }

    const access = await assertMerchantStoreAccess(request, storeId);
    if ('error' in access) {
      return access.error;
    }

    const orderBelongsToStore = await assertOrderBelongsToStore(access.adminClient, storeId, orderId);
    if (!orderBelongsToStore) {
      return json({ ok: false, error: 'Order does not belong to this store.' }, 403);
    }

    const { error } = await access.adminClient.from('payment_events').insert({
      amount: normalizeNumber(body.amount),
      created_at: new Date().toISOString(),
      event_id: paymentId,
      order_id: orderId,
      provider: 'mybiz',
      raw,
      status,
      user_id: null,
    });

    if (error) {
      throw new Error(`Failed to persist merchant order event: ${error.message}`);
    }

    return json({
      ok: true,
      data: {
        orderId,
        paymentId,
        status,
      },
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown merchant API error.',
      },
      500,
    );
  }
}
