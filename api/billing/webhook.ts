import {
  createBillingWebhookErrorResponse,
  createMethodNotAllowedResponse,
  handleBillingWebhook,
} from '../../src/server/billingWebhook';

async function handleRequest(request: Request) {
  if (request.method !== 'POST') {
    return createMethodNotAllowedResponse();
  }

  try {
    const rawBody = await request.text();
    const result = await handleBillingWebhook({
      rawBody,
      headers: request.headers,
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
