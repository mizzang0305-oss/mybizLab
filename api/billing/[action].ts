import {
  createCheckoutErrorResponse,
  createCheckoutMethodNotAllowedResponse,
  handleCheckoutRequest,
} from '../../src/server/billingCheckout.js';
import { handleBillingVerifyRequest } from '../../src/server/billingVerify.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

type BillingRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: unknown;
      method?: string;
      rawBody?: unknown;
      url?: string;
    };

function getPathname(request: BillingRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';

  try {
    return new URL(rawUrl, 'https://mybiz.ai.kr').pathname;
  } catch {
    return '/';
  }
}

function notFound() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'Unsupported billing endpoint.',
    }),
    {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

async function routeBillingRequest(request: BillingRequestLike) {
  const pathname = getPathname(request);
  const action = pathname.split('/').filter(Boolean).at(-1) || '';

  switch (action) {
    case 'checkout':
      try {
        if (getRequestMethod(request) !== 'POST') {
          return createCheckoutMethodNotAllowedResponse();
        }

        return await handleCheckoutRequest(request);
      } catch (error) {
        return createCheckoutErrorResponse(error);
      }
    case 'verify':
      return handleBillingVerifyRequest(request as Request);
    default:
      return notFound();
  }
}

export default async function handler(request: BillingRequestLike, response?: NodeResponseLike) {
  const result = await routeBillingRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
