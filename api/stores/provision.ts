import { createHash, timingSafeEqual } from 'node:crypto';
import { sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';
import { getSupabaseAdminClient } from '../../src/server/supabaseAdmin.js';
import { isReservedSlug } from '../../src/shared/lib/storeSlug.js';

export const config = {
  runtime: 'nodejs',
};

interface ProvisionRequestBody {
  address: string;
  business_name: string;
  business_number: string;
  business_type: string;
  email: string;
  owner_name: string;
  owner_profile_id?: string;
  payment_verified?: boolean;
  payment_id?: string;
  phone: string;
  plan?: 'free' | 'pro' | 'vip';
  request_id?: string;
  requested_slug: string;
}

type RequestLike =
  | Request
  | {
      body?: unknown;
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      rawBody?: unknown;
      text?: () => Promise<string>;
      url?: string;
    };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function bearerToken(request: RequestLike) {
  const header = request instanceof Request
    ? request.headers.get('authorization')
    : request.headers instanceof Headers
      ? request.headers.get('authorization')
      : request.headers?.authorization ?? request.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' ? /^Bearer ([^\s]+)$/i.exec(value.trim())?.[1] ?? null : null;
}

function provisioningHash(body: ProvisionRequestBody) {
  const fields = [
    body.business_name, body.owner_name, body.business_number, body.phone,
    body.email.toLowerCase(), body.address, body.business_type,
    body.requested_slug || body.business_name, 'free', null,
  ];
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

function equalSha256(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function releaseDecision(actorId: string, requestKey: string, payloadHash: string): 'ALLOW' | 'HOLD' | 'DENY' {
  if (process.env.MYBIZ_PROVISIONING_MODE !== 'CANARY') return 'HOLD';
  const configuredActor = process.env.MYBIZ_PROVISIONING_CANARY_AUTH_USER_ID;
  const configuredKeyHash = process.env.MYBIZ_PROVISIONING_CANARY_REQUEST_KEY_SHA256;
  const configuredPayloadHash = process.env.MYBIZ_PROVISIONING_CANARY_PAYLOAD_SHA256;
  const expiresAt = process.env.MYBIZ_PROVISIONING_CANARY_EXPIRES_AT;
  if (!configuredActor || !/^[0-9a-f-]{36}$/i.test(configuredActor)
    || !configuredKeyHash || !/^[0-9a-f]{64}$/.test(configuredKeyHash)
    || !configuredPayloadHash || !/^[0-9a-f]{64}$/.test(configuredPayloadHash)
    || !expiresAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expiresAt)
    || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    return 'HOLD';
  }
  const requestKeyHash = createHash('sha256').update(requestKey).digest('hex');
  return actorId.toLowerCase() === configuredActor.toLowerCase()
    && equalSha256(requestKeyHash, configuredKeyHash)
    && equalSha256(payloadHash, configuredPayloadHash)
    ? 'ALLOW' : 'DENY';
}

async function readJsonBody(request: RequestLike) {
  if (request instanceof Request) {
    return request.json() as Promise<ProvisionRequestBody>;
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as ProvisionRequestBody;
  }

  if (typeof request.rawBody === 'string') {
    return JSON.parse(request.rawBody) as ProvisionRequestBody;
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as ProvisionRequestBody;
  }

  if (typeof request.text === 'function') {
    return JSON.parse(await request.text()) as ProvisionRequestBody;
  }

  return {} as ProvisionRequestBody;
}

export default async function handler(request: RequestLike, response?: NodeResponseLike) {
  let result: Response;

  if ((request.method || 'GET').toUpperCase() !== 'POST') {
    result = json({ error: 'Method not allowed' }, 405);
    await sendNodeResponse(result, response);
    return result;
  }

  try {
    const token = bearerToken(request);
    if (!token) {
      result = json({ ok: false, code: 'AUTHENTICATION_REQUIRED', error: 'A valid bearer token is required.' }, 401);
      await sendNodeResponse(result, response);
      return result;
    }
    const adminClient = getSupabaseAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user?.id) {
      result = json({ ok: false, code: 'INVALID_AUTH_SESSION', error: 'The authenticated session is invalid.' }, 401);
      await sendNodeResponse(result, response);
      return result;
    }
    let body: ProvisionRequestBody;
    try {
      body = await readJsonBody(request);
    } catch {
      result = json({ ok: false, code: 'INVALID_JSON', error: 'A JSON request body is required.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      result = json({ ok: false, code: 'INVALID_REQUEST_BODY', error: 'A JSON object is required.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }

    const {
      business_name,
      owner_name,
      business_number,
      phone,
      email,
      address,
      business_type,
      requested_slug,
      payment_id,
      plan = 'free',
      request_id,
    } = body;

    if (body.owner_profile_id !== undefined || body.payment_verified !== undefined) {
      result = json({ ok: false, code: 'CLIENT_ACTOR_ASSERTION_DENIED', error: 'Actor and payment status are server-verified.' }, 403);
      await sendNodeResponse(result, response);
      return result;
    }
    const requestKey = normalizeNonEmptyString(request_id);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestKey)) {
      result = json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'A stable request identifier is required.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }
    if (plan !== 'free') {
      result = json({ ok: false, code: 'PAID_PROVISIONING_HOLD', error: 'Paid provisioning requires a separate release.' }, 403);
      await sendNodeResponse(result, response);
      return result;
    }
    if (payment_id !== undefined) {
      result = json({ ok: false, code: 'FREE_PAYMENT_CONTEXT_DENIED', error: 'Free provisioning cannot consume a payment receipt.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }
    const missing = ['business_name', 'owner_name', 'phone', 'email', 'address'].filter(
      (key) => !normalizeNonEmptyString(body[key as keyof ProvisionRequestBody]),
    );

    if (missing.length) {
      result = json({ ok: false, error: `Missing required fields: ${missing.join(', ')}` }, 400);
      await sendNodeResponse(result, response);
      return result;
    }

    if ([business_number, business_type, requested_slug].some(
      (value) => value !== undefined && typeof value !== 'string',
    )) {
      result = json({ ok: false, code: 'INVALID_PROVISIONING_FIELD', error: 'Optional fields must be strings.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }
    const normalizedBody: ProvisionRequestBody = {
      address: address.trim(), business_name: business_name.trim(),
      business_number: business_number?.trim() || `BIZ-${requestKey}`,
      business_type: business_type?.trim() || '기타', email: email.trim().toLowerCase(),
      owner_name: owner_name.trim(), phone: phone.trim(),
      requested_slug: requested_slug?.trim() || business_name.trim(), plan: 'free',
    };
    if (Object.values(normalizedBody).some((value) => typeof value === 'string' && value.length > 2048)) {
      result = json({ ok: false, code: 'PROVISIONING_FIELD_TOO_LONG', error: 'A request field is too long.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }
    if (isReservedSlug(normalizedBody.requested_slug)) {
      result = json({ ok: false, code: 'RESERVED_STORE_SLUG', error: 'The requested store slug is reserved.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }
    const requestHash = provisioningHash(normalizedBody);
    const decision = releaseDecision(authData.user.id, requestKey, requestHash);
    if (decision !== 'ALLOW') {
      result = decision === 'HOLD'
        ? json({ ok: false, code: 'PROVISIONING_HOLD', error: 'Store provisioning is temporarily unavailable.' }, 503)
        : json({ ok: false, code: 'PROVISIONING_CANARY_DENIED', error: 'Store provisioning is unavailable for this request.' }, 403);
      await sendNodeResponse(result, response);
      return result;
    }
    const { data, error } = await adminClient.rpc('provision_store_from_verified_actor', {
      p_auth_user_id: authData.user.id,
      p_request_key: requestKey,
      p_request_hash: requestHash,
      p_store_name: normalizedBody.business_name,
      p_owner_name: normalizedBody.owner_name,
      p_business_number: normalizedBody.business_number,
      p_phone: normalizedBody.phone,
      p_email: normalizedBody.email,
      p_address: normalizedBody.address,
      p_business_type: normalizedBody.business_type,
      p_requested_slug: normalizedBody.requested_slug,
      p_plan: 'free', p_payment_id: null, p_payment_amount: null, p_payment_currency: null,
    });

    if (error) {
      console.error('[provision] RPC rejected', { code: error.code });
      if (error.code === 'PGRST202' || error.code === '42883') {
        result = json({ ok: false, code: 'PROVISIONING_NOT_AVAILABLE', error: 'Store provisioning is on hold until the server-only RPC is available.' }, 503);
        await sendNodeResponse(result, response);
        return result;
      }
      result = json(
        { ok: false, error: 'Store provisioning was not completed.', code: error.code },
        error.code === '23505' ? 409 : error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500,
      );
      await sendNodeResponse(result, response);
      return result;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.store_id && !row?.id) {
      result = json({ ok: false, error: 'Provision RPC did not return a store identifier.' }, 500);
      await sendNodeResponse(result, response);
      return result;
    }

    const storeId = row.store_id ?? row.id;
    const slug = row.slug ?? normalizedBody.requested_slug;

    result = json({
      ok: true,
      store: {
        id: storeId,
        store_id: storeId,
        slug,
        name: normalizedBody.business_name,
        plan: 'free',
      },
      payment: null,
    });
    await sendNodeResponse(result, response);
    return result;
  } catch {
    console.error('[provision] request rejected', { code: 'PROVISION_FAILED' });
    result = json(
      {
        ok: false,
        code: 'PROVISION_FAILED',
        error: '스토어 생성 중 오류가 발생했습니다.',
      },
      500,
    );
    await sendNodeResponse(result, response);
    return result;
  }
}
