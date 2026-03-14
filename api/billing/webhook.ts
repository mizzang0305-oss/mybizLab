import {
  createBillingWebhookErrorResponse,
  createMethodNotAllowedResponse,
  handleBillingWebhook,
} from '../../src/server/billingWebhook';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
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
