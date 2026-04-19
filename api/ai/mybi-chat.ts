import { handleMybiChatRequest } from '../../src/server/mybiChat.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../_nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  request: Request | { headers?: unknown; method?: string; url?: string },
  response?: NodeResponseLike,
) {
  let result: Response;

  if (getRequestMethod(request) !== 'POST') {
    result = new Response(
      JSON.stringify(
        {
          code: 'METHOD_NOT_ALLOWED',
          ok: false,
          stage: 'method-check',
        },
        null,
        2,
      ),
      {
        headers: {
          allow: 'POST',
          'content-type': 'application/json; charset=utf-8',
        },
        status: 405,
      },
    );
  } else {
    result = await handleMybiChatRequest(request as Request);
  }

  await sendNodeResponse(result, response);
  return result;
}
