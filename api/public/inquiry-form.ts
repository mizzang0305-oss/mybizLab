import { handlePublicInquiryFormRequest } from '../../src/server/publicApi';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
  }

  return handlePublicInquiryFormRequest(request);
}
