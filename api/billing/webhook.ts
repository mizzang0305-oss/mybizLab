import {
  createBillingWebhookErrorResponse,
  handleBillingWebhook,
} from '../../src/server/billingWebhook';
import {
  createBillingMethodNotAllowedResponse,
  getBillingEnvStatus,
  logBillingStage,
  validateBillingEnv,
} from '../../src/server/billingApiRuntime';

const ENDPOINT = '/api/billing/webhook';

async function handleRequest(request: Request) {
  logBillingStage(ENDPOINT, 'request received', {
    method: request.method,
    url: request.url,
  });

  if (request.method !== 'POST') {
    return createBillingMethodNotAllowedResponse(ENDPOINT);
  }

  try {
    const env = validateBillingEnv(['webhookSecret'], ENDPOINT);
    logBillingStage(ENDPOINT, 'env loaded', {
      envStatus: getBillingEnvStatus(env),
    });

    const rawBody = await request.text();
    logBillingStage(ENDPOINT, 'body parsed', {
      rawBodyLength: rawBody.length,
    });

    const result = await handleBillingWebhook({
      env,
      rawBody,
      headers: request.headers,
      logStage: (stage, payload) => logBillingStage(ENDPOINT, stage, payload),
      requestUrl: request.url,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    return createBillingWebhookErrorResponse(error);
  }
}

export default {
  async fetch(request: Request) {
    return handleRequest(request);
  },
};
