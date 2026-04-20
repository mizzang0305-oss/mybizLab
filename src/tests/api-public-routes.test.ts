import { describe, expect, it, vi } from 'vitest';

const publicApiMocks = vi.hoisted(() => ({
  handlePublicInquiryFormRequest: vi.fn(),
  handlePublicInquiryRequest: vi.fn(),
  handlePublicReservationRequest: vi.fn(),
  handlePublicStoreRequest: vi.fn(),
  handlePublicVisitorSessionRequest: vi.fn(),
  handlePublicWaitingRequest: vi.fn(),
}));

vi.mock('../server/publicApi.js', () => publicApiMocks);

import publicHandler from '../../api/public/[resource]';

function okResponse(kind: string) {
  return new Response(JSON.stringify({ ok: true, kind }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

describe('/api/public/[resource]', () => {
  it('routes store requests to the store handler', async () => {
    publicApiMocks.handlePublicStoreRequest.mockResolvedValueOnce(okResponse('store'));

    const response = await publicHandler(
      new Request('https://example.com/api/public/store?slug=golden-coffee', {
        method: 'GET',
      }),
    );

    expect(publicApiMocks.handlePublicStoreRequest).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({ kind: 'store' });
  });

  it('routes inquiry-form requests to the inquiry-form handler', async () => {
    publicApiMocks.handlePublicInquiryFormRequest.mockResolvedValueOnce(okResponse('inquiry-form'));

    const response = await publicHandler(
      new Request('https://example.com/api/public/inquiry-form?storeId=store-live', {
        method: 'GET',
      }),
    );

    expect(publicApiMocks.handlePublicInquiryFormRequest).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({ kind: 'inquiry-form' });
  });

  it('routes visitor-session requests to the visitor-session handler', async () => {
    publicApiMocks.handlePublicVisitorSessionRequest.mockResolvedValueOnce(okResponse('visitor-session'));

    const response = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/visitor-session',
    });

    expect(publicApiMocks.handlePublicVisitorSessionRequest).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({ kind: 'visitor-session' });
  });

  it('routes inquiry, reservation, and waiting writes through the shared function', async () => {
    publicApiMocks.handlePublicInquiryRequest.mockResolvedValueOnce(okResponse('inquiry'));
    publicApiMocks.handlePublicReservationRequest.mockResolvedValueOnce(okResponse('reservation'));
    publicApiMocks.handlePublicWaitingRequest.mockResolvedValueOnce(okResponse('waiting'));

    const inquiryResponse = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/inquiry',
    });
    const reservationResponse = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/reservation',
    });
    const waitingResponse = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/waiting',
    });

    expect(publicApiMocks.handlePublicInquiryRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicReservationRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicWaitingRequest).toHaveBeenCalledTimes(1);
    await expect(inquiryResponse.json()).resolves.toMatchObject({ kind: 'inquiry' });
    await expect(reservationResponse.json()).resolves.toMatchObject({ kind: 'reservation' });
    await expect(waitingResponse.json()).resolves.toMatchObject({ kind: 'waiting' });
  });

  it('returns 405 when the method does not match the public resource', async () => {
    const response = await publicHandler(
      new Request('https://example.com/api/public/reservation', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('returns 404 for unsupported public resources', async () => {
    const response = await publicHandler(
      new Request('https://example.com/api/public/unknown', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Unsupported public endpoint.',
    });
  });
});
