import {
  callPortOneApi,
  createBillingApiErrorResponse,
  getBillingEnvStatus,
  logBillingStage,
  parseJsonBody,
  responseJson,
  validateBillingEnv,
} from '../../src/server/billingApiRuntime';

const ENDPOINT = '/api/billing/checkout';

function pickStoreId(body: Record<string, unknown>, fallbackStoreId: string) {
  const storeId = typeof body.storeId === 'string' && body.storeId.trim() ? body.storeId.trim() : fallbackStoreId;

  return storeId;
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

    const { body } = await parseJsonBody(request, ENDPOINT, 'request-body', true);
    logBillingStage(ENDPOINT, 'request body parsed', {
      bodyKeys: Object.keys(body),
    });

    const targetStoreId = pickStoreId(body, env.storeId!);
    const requestBody = JSON.stringify({
      size: 1,
      storeId: targetStoreId,
    });

    logBillingStage(ENDPOINT, 'PortOne API call start', {
      path: '/payments-by-cursor',
      storeId: targetStoreId,
    });

    const portoneResponse = await callPortOneApi({
      apiSecret: env.apiSecret!,
      endpoint: ENDPOINT,
      method: 'GET',
      path: '/payments-by-cursor',
      query: {
        requestBody,
      },
      stage: 'portone-api-call',
    });

    logBillingStage(ENDPOINT, 'PortOne API response status', {
      status: portoneResponse.status,
    });

    const payload = {
      ok: true,
      endpoint: ENDPOINT,
      checkout: {
        channelKey: env.channelKey,
        storeId: targetStoreId,
      },
      probeStatus: portoneResponse.status,
      probe: portoneResponse.data,
    };

    logBillingStage(ENDPOINT, 'final response', {
      ok: true,
      probeStatus: portoneResponse.status,
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
