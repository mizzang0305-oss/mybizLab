import { handlePublicReservationRequest } from '../../src/server/publicApi.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../_nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  request: Request | { body?: unknown; headers?: unknown; method?: string; rawBody?: unknown; url?: string },
  response?: NodeResponseLike,
) {
  let result: Response;

  if (getRequestMethod(request) !== 'POST') {
    result = new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  } else {
    result = await handlePublicReservationRequest(request);
  }

  await sendNodeResponse(result, response);
  return result;
}
