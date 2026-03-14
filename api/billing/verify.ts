import {
  BillingApiStageError,
  callPortOneApi,
  createBillingApiErrorResponse,
  createBillingMethodNotAllowedResponse,
  getBillingEnvStatus,
  logBillingStage,
  parseJsonBody,
  responseJson,
  validateBillingEnv,
} from '../../src/server/billingApiRuntime';

const ENDPOINT = '/api/billing/verify';

function readPaymentId(body: Record<string, unknown>) {
  if (typeof body.paymentId === 'string' && body.paymentId.trim()) {
    return body.paymentId.trim();
  }

  throw new BillingApiStageError({
    stage: 'request-body',
    status: 400,
    code: 'MISSING_PAYMENT_ID',
    message: `paymentId is required for ${ENDPOINT}`,
  });
}

async function handleRequest(request: Request) {
  logBillingStage(ENDPOINT, 'request received', {
    method: request.method,
    url: request.url,
  });

  if (request.method !== 'POST') {
    return createBillingMethodNotAllowedResponse(ENDPOINT);
  }

  try {
    const env = validateBillingEnv(['apiSecret', 'storeId'], ENDPOINT);
    logBillingStage(ENDPOINT, 'env loaded', {
      envStatus: getBillingEnvStatus(env),
    });

    const { body } = await parseJsonBody(request, ENDPOINT, 'request-body', false);
    logBillingStage(ENDPOINT, 'request body parsed', {
      bodyKeys: Object.keys(body),
    });

    const paymentId = readPaymentId(body);
    const targetStoreId =
      typeof body.storeId === 'string' && body.storeId.trim() ? body.storeId.trim() : env.storeId!;

    logBillingStage(ENDPOINT, 'PortOne API call start', {
      path: `/payments/${paymentId}`,
      paymentId,
      storeId: targetStoreId,
    });

    const portoneResponse = await callPortOneApi({
      apiSecret: env.apiSecret!,
      endpoint: ENDPOINT,
      method: 'GET',
      path: `/payments/${encodeURIComponent(paymentId)}`,
      query: {
        storeId: targetStoreId,
      },
      stage: 'portone-api-call',
    });

    logBillingStage(ENDPOINT, 'PortOne API response status', {
      status: portoneResponse.status,
    });

    const payload = {
      ok: true,
      endpoint: ENDPOINT,
      paymentId,
      payment: portoneResponse.data,
      portoneStatus: portoneResponse.status,
      storeId: targetStoreId,
    };

    logBillingStage(ENDPOINT, 'final response', {
      ok: true,
      paymentId,
      status: portoneResponse.status,
    });

    return responseJson(payload, 200);
  } catch (error) {
    if (error instanceof BillingApiStageError) {
      return createBillingApiErrorResponse(ENDPOINT, error);
    }

    return createBillingApiErrorResponse(ENDPOINT, error);
  }
}

export default {
  async fetch(request: Request) {
    return handleRequest(request);
  },
};
