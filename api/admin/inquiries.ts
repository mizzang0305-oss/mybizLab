import {
  handleAdminInquiriesRequest,
  type CustomerMemoryRequestLike,
} from '../../src/server/mybiz/services/customerMemoryApi.js';
import { sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: CustomerMemoryRequestLike, response?: NodeResponseLike) {
  const result = await handleAdminInquiriesRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
