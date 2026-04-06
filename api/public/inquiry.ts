import { handlePublicInquiryRequest } from '../../src/server/publicApi';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }

  return handlePublicInquiryRequest(request);
}
