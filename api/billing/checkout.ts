import {
  createCheckoutErrorResponse,
  createCheckoutMethodNotAllowedResponse,
  handleCheckoutRequest,
} from '../../src/server/billingCheckout';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return createCheckoutMethodNotAllowedResponse();
  }

  try {
    return await handleCheckoutRequest(request);
  } catch (error) {
    return createCheckoutErrorResponse(error);
  }
}
