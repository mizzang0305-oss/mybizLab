import {
  handlePublicConsultationFormRequest,
  handlePublicConsultationRequest,
  handlePublicInquiryFormRequest,
  handlePublicInquiryRequest,
  handlePublicOrderPaymentCheckoutRequest,
  handlePublicOrderPaymentVerifyRequest,
  handlePublicOrderRequest,
  handlePublicReservationRequest,
  handlePublicStoreRequest,
  handlePublicVisitorSessionRequest,
  handlePublicWaitingRequest,
} from '../src/server/publicApi.js';
import { getRequestMethod, sendNodeResponse, type NodeResponseLike } from '../src/server/nodeResponse.js';
import { config, methodNotAllowed, type PublicRequestLike } from './public/_shared.js';

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

function getResource(request: PublicRequestLike) {
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

async function routePublicRequest(request: PublicRequestLike) {
  const method = getRequestMethod(request);
  const resource = getResource(request);

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
    case 'order':
      return method === 'POST' ? handlePublicOrderRequest(request) : methodNotAllowed('POST');
    case 'order-payment-checkout':
      return method === 'POST' ? handlePublicOrderPaymentCheckoutRequest(request) : methodNotAllowed('POST');
    case 'order-payment-verify':
      return method === 'POST' ? handlePublicOrderPaymentVerifyRequest(request) : methodNotAllowed('POST');
    case 'reservation':
      return method === 'POST' ? handlePublicReservationRequest(request) : methodNotAllowed('POST');
    case 'waiting':
      return method === 'POST' ? handlePublicWaitingRequest(request) : methodNotAllowed('POST');
    default:
      return notFound();
  }
}

export { config };

export default async function handler(request: PublicRequestLike, response?: NodeResponseLike) {
  const result = await routePublicRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
