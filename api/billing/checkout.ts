import {
  BillingApiStageError,
  createBillingApiErrorResponse,
  getBillingEnvStatus,
  logBillingStage,
  parseJsonBody,
  responseJson,
  validateBillingEnv,
} from '../../src/server/billingApiRuntime';
import { getBillingPlan, isBillingPlanCode } from '../../src/shared/lib/billingPlans';

const ENDPOINT = '/api/billing/checkout';

function resolveBaseUrl(request: Request) {
  const configuredBaseUrl = process.env.VITE_APP_BASE_URL;

  if (typeof configuredBaseUrl === 'string' && configuredBaseUrl.trim()) {
    return configuredBaseUrl.trim().replace(/\/$/, '');
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}

async function handleRequest(request: Request) {
  try {
    logBillingStage(ENDPOINT, 'request received', {
      method: request.method,
      url: request.url,
    });

    if (request.method !== 'POST') {
      return responseJson(
        {
          ok: false,
          message: 'Checkout endpoint. Use POST.',
        },
        405,
        { allow: 'POST' },
      );
    }

    const env = validateBillingEnv(['apiSecret', 'storeId', 'channelKey'], ENDPOINT);
    logBillingStage(ENDPOINT, 'env loaded', {
      envStatus: getBillingEnvStatus(env),
    });

    const { body } = await parseJsonBody(request, ENDPOINT, 'request-body', false);
    logBillingStage(ENDPOINT, 'request body parsed', {
      bodyKeys: Object.keys(body),
    });

    const requestedPlan = body.plan;

    if (!isBillingPlanCode(requestedPlan)) {
      throw new BillingApiStageError({
        stage: 'request-body',
        status: 400,
        code: 'INVALID_PLAN',
        message: 'Checkout requires plan to be one of starter, pro, business.',
        details: {
          receivedPlan: requestedPlan ?? null,
        },
      });
    }

    const billingPlan = getBillingPlan(requestedPlan);
    const baseUrl = resolveBaseUrl(request);
    const paymentId = `subscription-${requestedPlan}-${crypto.randomUUID()}`;
    const checkoutPayload = {
      channelKey: env.channelKey!,
      currency: 'KRW' as const,
      customData: {
        initiatedAt: new Date().toISOString(),
        plan: requestedPlan,
        source: 'pricing-page',
      },
      noticeUrls: baseUrl ? [`${baseUrl}/api/billing/webhook`] : undefined,
      orderName: billingPlan.orderName,
      payMethod: 'CARD' as const,
      paymentId,
      plan: requestedPlan,
      storeId: env.storeId!,
      totalAmount: billingPlan.amount,
    };

    logBillingStage(ENDPOINT, 'checkout payload built', {
      amount: billingPlan.amount,
      orderName: billingPlan.orderName,
      paymentId,
      plan: requestedPlan,
    });

    const payload = {
      checkout: checkoutPayload,
      endpoint: ENDPOINT,
      ok: true,
      plan: requestedPlan,
    };

    logBillingStage(ENDPOINT, 'final response', {
      ok: true,
      paymentId,
      plan: requestedPlan,
    });

    return responseJson(payload, 200);
  } catch (error) {
    return createBillingApiErrorResponse(ENDPOINT, error);
  }
}

export default {
  async fetch(request: Request) {
    return handleRequest(request);
  },
};
