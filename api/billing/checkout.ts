import {
  createCheckoutErrorResponse,
  createCheckoutMethodNotAllowedResponse,
  handleCheckoutRequest,
} from '../../src/server/billingCheckout.js';
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
      text?: () => Promise<string>;
      url?: string;
    };

export default async function handler(request: BillingRequestLike, response?: NodeResponseLike) {
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
