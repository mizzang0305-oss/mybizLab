import {
  handleMerchantOrderEventRequest,
  type MerchantRequestLike,
} from '../src/server/merchantApi.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

function notFound() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'Unsupported merchant endpoint.',
    }),
    {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow: 'POST' },
  });
}

function getResource(request: MerchantRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';

  try {
    const url = new URL(rawUrl, 'https://mybiz.ai.kr');
    const resource = url.searchParams.get('resource')?.trim();
    if (resource) {
      return resource;
    }

    return url.pathname.split('/').filter(Boolean).at(-1) || '';
  } catch {
    return '';
  }
}

async function routeMerchantRequest(request: MerchantRequestLike): Promise<Response> {
  const method = getRequestMethod(request);
  const resource = getResource(request);

  switch (resource) {
    case 'order-event':
      return method === 'POST' ? handleMerchantOrderEventRequest(request) : methodNotAllowed();
    default:
      return notFound();
  }
}

export default async function handler(request: MerchantRequestLike, response?: NodeResponseLike): Promise<Response> {
  const result = await routeMerchantRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
