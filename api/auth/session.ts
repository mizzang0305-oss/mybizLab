import { handleAdminSessionRequest } from '../../src/server/adminAuth.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

type AuthRequestLike =
  | Request
  | {
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
    };

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    headers: { allow: 'GET' },
    status: 405,
  });
}

export default async function handler(request: AuthRequestLike, response?: NodeResponseLike) {
  const result = getRequestMethod(request) === 'GET' ? await handleAdminSessionRequest(request) : methodNotAllowed();
  await sendNodeResponse(result, response);
  return result;
}
