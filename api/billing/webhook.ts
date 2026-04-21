import {
  assertJsonWebhookContentType,
  createBillingWebhookErrorResponse,
  handleBillingWebhook,
} from '../../src/server/billingWebhook.js';
import {
  createBillingMethodNotAllowedResponse,
  getBillingEnvStatus,
  logBillingStage,
  parseJsonBody,
  toRequestHeaders,
  type BillingRequestLike,
  validateBillingEnv,
} from '../../src/server/billingApiRuntime.js';
import { sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

const ENDPOINT = '/api/billing/webhook';

export const config = {
  runtime: 'nodejs',
};

async function handleRequest(request: BillingRequestLike) {
  const headers = toRequestHeaders(request.headers);

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

    assertJsonWebhookContentType(headers);
    const { body, rawBody } = await parseJsonBody(request, ENDPOINT, 'body-parsed', false);
    logBillingStage(ENDPOINT, 'body parsed', {
      bodyKeys: Object.keys(body),
      rawBodyLength: rawBody.length,
    });

    const result = await handleBillingWebhook({
      env,
      rawBody,
      headers,
      logStage: (stage, payload) => logBillingStage(ENDPOINT, stage, payload),
      requestUrl: request.url || ENDPOINT,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    return createBillingWebhookErrorResponse(error);
  }
}

export default async function handler(request: BillingRequestLike, response?: NodeResponseLike) {
  const result = await handleRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
