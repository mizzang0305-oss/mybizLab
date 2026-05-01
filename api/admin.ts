import { handlePlatformAdminRequest, type PlatformAdminRequestLike } from '../src/server/platformAdminApi.js';
import { sendNodeResponse, type NodeResponseLike } from '../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: PlatformAdminRequestLike, response?: NodeResponseLike) {
  const result = await handlePlatformAdminRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
