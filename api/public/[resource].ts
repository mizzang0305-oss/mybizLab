import {
  handlePublicConsultationFormRequest,
  handlePublicConsultationRequest,
  handlePublicInquiryFormRequest,
  handlePublicInquiryRequest,
  handlePublicReservationRequest,
  handlePublicStoreRequest,
  handlePublicVisitorSessionRequest,
  handlePublicWaitingRequest,
} from '../../src/server/publicApi.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';
import { config, methodNotAllowed, type PublicRequestLike } from './_shared.js';

function getPathname(request: PublicRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';

  try {
    return new URL(rawUrl, 'https://mybiz.ai.kr').pathname;
  } catch {
    return '/';
  }
}

function notFound() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'Unsupported public endpoint.',
    }),
    {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

async function routePublicRequest(request: PublicRequestLike) {
  const method = getRequestMethod(request);
  const pathname = getPathname(request);
  const resource = pathname.split('/').filter(Boolean).at(-1) || '';

  switch (resource) {
    case 'store':
      return method === 'GET' ? handlePublicStoreRequest(request) : methodNotAllowed('GET');
    case 'inquiry-form':
      return method === 'GET' ? handlePublicInquiryFormRequest(request) : methodNotAllowed('GET');
    case 'consultation-form':
      return method === 'GET' ? handlePublicConsultationFormRequest(request) : methodNotAllowed('GET');
    case 'visitor-session':
      return method === 'POST' ? handlePublicVisitorSessionRequest(request) : methodNotAllowed('POST');
    case 'inquiry':
      return method === 'POST' ? handlePublicInquiryRequest(request) : methodNotAllowed('POST');
    case 'consultation':
      return method === 'POST' ? handlePublicConsultationRequest(request) : methodNotAllowed('POST');
    case 'reservation':
      return method === 'POST' ? handlePublicReservationRequest(request) : methodNotAllowed('POST');
    case 'waiting':
      return method === 'POST' ? handlePublicWaitingRequest(request) : methodNotAllowed('POST');
    default:
      return notFound();
  }
}

export default async function handler(request: PublicRequestLike, response?: NodeResponseLike) {
  const result = await routePublicRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
