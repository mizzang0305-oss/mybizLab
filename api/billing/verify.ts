import { handleBillingVerifyRequest } from '../../src/server/billingVerify.js';
import type { BillingRequestLike } from '../../src/server/billingApiRuntime.js';
import { sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: BillingRequestLike, response?: NodeResponseLike) {
  const result = await handleBillingVerifyRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
