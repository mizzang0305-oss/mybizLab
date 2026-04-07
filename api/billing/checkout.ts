import {
  createCheckoutErrorResponse,
  createCheckoutMethodNotAllowedResponse,
  handleCheckoutRequest,
} from '../../src/server/billingCheckout';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request) {
  try {
    if (request.method !== 'POST') {
      return createCheckoutMethodNotAllowedResponse();
    }

    return await handleCheckoutRequest(request);
  } catch (error) {
    return createCheckoutErrorResponse(error);
  }
}
