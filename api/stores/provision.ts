import { getBillingPlan, isBillingPlanCode, type BillingPlanCode } from '../../src/shared/lib/billingPlans.js';
import { BillingApiStageError, callPortOneApi, validateBillingEnv } from '../../src/server/billingApiRuntime.js';
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

async function verifyProvisionPayment(plan: BillingPlanCode, paymentId: string, requestId?: string) {
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
  if (actualAmount !== null && actualAmount !== expectedAmount) {
    throw new BillingApiStageError({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      details: {
        actualAmount,
        expectedAmount,
        paymentId,
      },
      message: `Payment ${paymentId} amount ${actualAmount} does not match plan ${plan} amount ${expectedAmount}.`,
      stage: 'payment-verify',
      status: 409,
    });
  }

  const customData = readPaymentCustomData(payment);
  const planKey = normalizeNonEmptyString(readNestedRecordValue(customData, ['planKey']));
  if (planKey && planKey !== plan) {
    throw new BillingApiStageError({
      code: 'PAYMENT_PLAN_MISMATCH',
      details: {
        paymentId,
        planKey,
        requestedPlan: plan,
      },
      message: `Payment ${paymentId} was created for plan ${planKey}, not ${plan}.`,
      stage: 'payment-verify',
      status: 409,
    });
  }

  const customRequestId = normalizeNonEmptyString(readNestedRecordValue(customData, ['requestId']));
  if (requestId && customRequestId && customRequestId !== requestId) {
    throw new BillingApiStageError({
      code: 'PAYMENT_REQUEST_MISMATCH',
      details: {
        customRequestId,
        paymentId,
        requestId,
      },
      message: `Payment ${paymentId} does not match onboarding request ${requestId}.`,
      stage: 'payment-verify',
      status: 409,
    });
  }

  return {
    payment,
    paymentStatus,
  };
}

async function markSetupRequestConverted(requestId: string | undefined, storeId: string) {
  const normalizedRequestId = normalizeNonEmptyString(requestId);
  if (!normalizedRequestId) {
    return;
  }

  const adminClient = getSupabaseAdminClient();
  const { error } = await adminClient
    .from('store_setup_requests')
    .update({
      status: 'converted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedRequestId);

  if (error) {
    console.warn('[provision] request status update skipped', {
      error: error.message,
      requestId: normalizedRequestId,
      storeId,
    });
  }
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
      owner_profile_id,
      request_id,
    } = body;

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
    if (plan !== 'free') {
      const verification = await verifyProvisionPayment(plan, payment_id!.trim(), normalizeNonEmptyString(request_id) || undefined);
      verifiedPaymentStatus = verification.paymentStatus;
    }

    const adminClient = getSupabaseAdminClient();

    const { data, error } = await adminClient.rpc('create_store_with_owner', {
      p_store_name: business_name.trim(),
      p_owner_name: owner_name.trim(),
      p_business_number: business_number?.trim() || `BIZ-${Date.now()}`,
      p_phone: phone.trim(),
      p_email: email.trim().toLowerCase(),
      p_address: address.trim(),
      p_business_type: business_type?.trim() || '기타',
      p_requested_slug: requested_slug?.trim() || business_name.trim(),
      p_plan: plan,
      ...(owner_profile_id ? { p_owner_profile_id: owner_profile_id } : {}),
    });

    if (error) {
      console.error('[provision] RPC error:', error);
      result = json(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
        500,
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
    await markSetupRequestConverted(request_id, storeId);

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
    console.error('[provision] unexpected error:', error);
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
