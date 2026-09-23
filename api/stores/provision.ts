import { createHash } from 'node:crypto';
import { getBillingPlan, isBillingPlanCode, type BillingPlanCode } from '../../src/shared/lib/billingPlans.js';
import { BillingApiStageError, callPortOneApi, validateBillingEnv } from '../../src/server/billingApiRuntime.js';
import { isLaunchGateEnabled } from '../../src/shared/lib/launchGates.js';
import { sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';
import { getSupabaseAdminClient } from '../../src/server/supabaseAdmin.js';

export const config = {
  runtime: 'nodejs',
};

const ENDPOINT = '/api/stores/provision';

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
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readNestedRecordValue(record: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, record);
}

function readNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readPaymentStatus(payment: Record<string, unknown>) {
  return normalizeNonEmptyString(payment.status) || 'UNKNOWN';
}

function readPaymentAmount(payment: Record<string, unknown>) {
  const amountRecord = toRecord(payment.amount);
  return (
    readNumericValue(amountRecord.total) ??
    readNumericValue(amountRecord.amount) ??
    readNumericValue(payment.amount) ??
    null
  );
}

function readPaymentCustomData(payment: Record<string, unknown>) {
  return toRecord(payment.customData);
}

function bearerToken(request: RequestLike) {
  const header = request instanceof Request
    ? request.headers.get('authorization')
    : request.headers instanceof Headers
      ? request.headers.get('authorization')
      : request.headers?.authorization ?? request.headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = typeof value === 'string' ? /^Bearer ([^\s]+)$/i.exec(value.trim()) : null;
  return match?.[1] ?? null;
}

function provisioningHash(body: ProvisionRequestBody) {
  const fields = [
    body.business_name, body.owner_name, body.business_number, body.phone,
    body.email?.toLowerCase(), body.address, body.business_type,
    body.requested_slug || body.business_name, body.plan || 'free', body.payment_id || null,
  ].map((field) => typeof field === 'string' ? field.trim() : field);
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

async function verifyProvisionPayment(plan: BillingPlanCode, paymentId: string, requestId: string, actorId: string) {
  const env = validateBillingEnv(['apiSecret', 'storeId'], ENDPOINT, 'payment-verify-env');
  const paymentResponse = await callPortOneApi({
    apiSecret: env.apiSecret!,
    endpoint: ENDPOINT,
    method: 'GET',
    path: `/payments/${encodeURIComponent(paymentId)}`,
    query: {
      storeId: env.storeId!,
    },
    stage: 'payment-verify',
  });

  const payment = toRecord(paymentResponse.data);
  const paymentStatus = readPaymentStatus(payment);
  if (paymentStatus !== 'PAID') {
    throw new BillingApiStageError({
      code: 'PAYMENT_NOT_COMPLETED',
      details: {
        paymentId,
        paymentStatus,
      },
      message: `Payment ${paymentId} is not completed. Current status: ${paymentStatus}`,
      stage: 'payment-verify',
      status: 409,
    });
  }

  const expectedAmount = getBillingPlan(plan).amount;
  const actualAmount = readPaymentAmount(payment);
  if (actualAmount !== expectedAmount || payment.currency !== 'KRW' || payment.id !== paymentId) {
    throw new BillingApiStageError({
      code: 'PAYMENT_CONTEXT_MISMATCH',
      details: {
        actualAmount,
        expectedAmount,
        paymentId,
      },
      message: 'Payment amount, currency, or identifier does not match the requested subscription.',
      stage: 'payment-verify',
      status: 409,
    });
  }

  const customData = readPaymentCustomData(payment);
  const planKey = normalizeNonEmptyString(readNestedRecordValue(customData, ['planKey']));
  const customRequestId = normalizeNonEmptyString(readNestedRecordValue(customData, ['requestId']));
  const paymentActor = normalizeNonEmptyString(readNestedRecordValue(customData, ['actorId']));
  if (planKey !== plan || customRequestId !== requestId || paymentActor !== actorId
    || customData.grantsEntitlement !== true
    || customData.productType !== 'subscription'
    || customData.sessionId !== paymentId
    || !normalizeNonEmptyString(customData.productCode)) {
    throw new BillingApiStageError({
      code: 'PAYMENT_BINDING_MISMATCH',
      message: 'Payment is not bound to this authenticated applicant, request, and subscription plan.',
      stage: 'payment-verify',
      status: 409,
    });
  }

  return {
    amount: actualAmount,
    payment,
    paymentStatus,
  };
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
    const body = await readJsonBody(request);

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

    if (!isBillingPlanCode(plan)) {
      result = json({ ok: false, error: `Unsupported plan: ${String(plan)}` }, 400);
      await sendNodeResponse(result, response);
      return result;
    }

    const missing = ['business_name', 'owner_name', 'phone', 'email', 'address'].filter(
      (key) => !body[key as keyof ProvisionRequestBody]?.toString().trim(),
    );

    if (missing.length) {
      result = json({ ok: false, error: `Missing required fields: ${missing.join(', ')}` }, 400);
      await sendNodeResponse(result, response);
      return result;
    }

    if (plan !== 'free' && !isLaunchGateEnabled('selfServePaidLaunchEnabled')) {
      result = json({ ok: false, code: 'PAID_PROVISIONING_HOLD', error: 'Paid provisioning requires a separate launch approval.' }, 403);
      await sendNodeResponse(result, response);
      return result;
    }
    if (plan === 'free' && normalizeNonEmptyString(payment_id)) {
      result = json({ ok: false, code: 'FREE_PAYMENT_CONTEXT_DENIED', error: 'Free provisioning cannot consume a payment receipt.' }, 400);
      await sendNodeResponse(result, response);
      return result;
    }

    if (plan !== 'free' && !normalizeNonEmptyString(payment_id)) {
      result = json(
        {
          ok: false,
          code: 'PAYMENT_VERIFICATION_REQUIRED',
          error: 'payment_id is required before provisioning paid onboarding stores.',
        },
        400,
      );
      await sendNodeResponse(result, response);
      return result;
    }

    let verifiedPaymentStatus: string | undefined;
    let verifiedPaymentAmount: number | null = null;
    if (plan !== 'free') {
      const verification = await verifyProvisionPayment(plan, payment_id!.trim(), requestKey, authData.user.id);
      verifiedPaymentStatus = verification.paymentStatus;
      verifiedPaymentAmount = verification.amount;
    }

    const { data, error } = await adminClient.rpc('provision_store_from_verified_actor', {
      p_auth_user_id: authData.user.id,
      p_request_key: requestKey,
      p_request_hash: provisioningHash(body),
      p_store_name: business_name.trim(),
      p_owner_name: owner_name.trim(),
      p_business_number: business_number?.trim() || `BIZ-${Date.now()}`,
      p_phone: phone.trim(),
      p_email: email.trim().toLowerCase(),
      p_address: address.trim(),
      p_business_type: business_type?.trim() || '기타',
      p_requested_slug: requested_slug?.trim() || business_name.trim(),
      p_plan: plan,
      p_payment_id: plan === 'free' ? null : payment_id!.trim(),
      p_payment_amount: verifiedPaymentAmount,
      p_payment_currency: plan === 'free' ? null : 'KRW',
    });

    if (error) {
      console.error('[provision] RPC rejected', { code: error.code, message: error.message });
      result = json(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
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
    const slug = row.slug ?? requested_slug;
    // The transaction receipt, subscription and membership are committed by
    // the RPC. A public setup request is not claimed merely from a client ID.

    result = json({
      ok: true,
      store: {
        id: storeId,
        store_id: storeId,
        slug,
        name: business_name,
        plan,
      },
      payment: verifiedPaymentStatus
        ? {
            status: verifiedPaymentStatus,
          }
        : null,
    });
    await sendNodeResponse(result, response);
    return result;
  } catch (error) {
    console.error('[provision] request rejected', {
      code: error instanceof BillingApiStageError ? error.code : 'PROVISION_FAILED',
    });
    result = json(
      {
        ok: false,
        code: error instanceof BillingApiStageError ? error.code : 'PROVISION_FAILED',
        error: error instanceof Error ? error.message : '스토어 생성 중 오류가 발생했습니다.',
        details: error instanceof BillingApiStageError ? error.details : undefined,
      },
      error instanceof BillingApiStageError ? error.status : 500,
    );
    await sendNodeResponse(result, response);
    return result;
  }
}
