import {
  createCheckoutErrorResponse,
  createCheckoutMethodNotAllowedResponse,
  handleCheckoutRequest,
} from './_billingCheckout.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../_nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  request: Request | { body?: unknown; headers?: unknown; method?: string; rawBody?: unknown; url?: string },
  response?: NodeResponseLike,
) {
  let result: Response;

  try {
    if (getRequestMethod(request) !== 'POST') {
      result = createCheckoutMethodNotAllowedResponse();
    } else {
      result = await handleCheckoutRequest(request);
    }
  } catch (error) {
    result = createCheckoutErrorResponse(error);
  }

  await sendNodeResponse(result, response);
  return result;
}
