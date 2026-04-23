import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export type PublicRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: unknown;
      method?: string;
      rawBody?: unknown;
      url?: string;
    };

export function methodNotAllowed(allow: 'GET' | 'POST') {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow },
  });
}

export function createPublicRouteHandler(
  allow: 'GET' | 'POST',
  handleRequest: (request: PublicRequestLike) => Promise<Response>,
) {
  return async function handler(request: PublicRequestLike, response?: NodeResponseLike) {
    const result = getRequestMethod(request) === allow ? await handleRequest(request) : methodNotAllowed(allow);
    await sendNodeResponse(result, response);
    return result;
  };
}
