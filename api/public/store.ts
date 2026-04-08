import { handlePublicStoreRequest } from '../../src/server/publicApi.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../_nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  request: Request | { headers?: unknown; method?: string; url?: string },
  response?: NodeResponseLike,
) {
  let result: Response;

  if (getRequestMethod(request) !== 'GET') {
    result = new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
  } else {
    result = await handlePublicStoreRequest(request);
  }

  await sendNodeResponse(result, response);
  return result;
}
