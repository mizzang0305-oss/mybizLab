import { describe, expect, it, vi } from 'vitest';

const publicApiMocks = vi.hoisted(() => ({
  handlePublicConsultationFormRequest: vi.fn(),
  handlePublicConsultationRequest: vi.fn(),
  handlePublicInquiryFormRequest: vi.fn(),
  handlePublicInquiryRequest: vi.fn(),
  handlePublicOrderPaymentCheckoutRequest: vi.fn(),
  handlePublicOrderPaymentVerifyRequest: vi.fn(),
  handlePublicOrderRequest: vi.fn(),
  handlePublicReservationRequest: vi.fn(),
  handlePublicStoreRequest: vi.fn(),
  handlePublicVisitorSessionRequest: vi.fn(),
  handlePublicWaitingRequest: vi.fn(),
}));

vi.mock('../server/publicApi.js', () => publicApiMocks);

import publicHandler from '../../api/public';

function okResponse(kind: string) {
  return new Response(JSON.stringify({ ok: true, kind }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

describe('/api/public routed handler', () => {
  it('routes store, inquiry-form, and consultation-form GET requests to their handlers', async () => {
    publicApiMocks.handlePublicStoreRequest.mockImplementation(async () => okResponse('store'));
    publicApiMocks.handlePublicInquiryFormRequest.mockResolvedValueOnce(okResponse('inquiry-form'));
    publicApiMocks.handlePublicConsultationFormRequest.mockResolvedValueOnce(okResponse('consultation-form'));

    const storeResponse = await publicHandler(
      new Request('https://example.com/api/public/store?slug=golden-coffee', {
        method: 'GET',
      }),
    );
    const inquiryFormResponse = await publicHandler(
      new Request('https://example.com/api/public/inquiry-form?storeId=store-live', {
        method: 'GET',
      }),
    );
    const consultationFormResponse = await publicHandler(
      new Request('https://example.com/api/public/consultation-form?storeId=store-live', {
        method: 'GET',
      }),
    );
    const rewrittenStoreResponse = await publicHandler(
      new Request('https://example.com/api/public?resource=store&slug=golden-coffee', {
        method: 'GET',
      }),
    );

    expect(publicApiMocks.handlePublicStoreRequest).toHaveBeenCalledTimes(2);
    expect(publicApiMocks.handlePublicInquiryFormRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicConsultationFormRequest).toHaveBeenCalledTimes(1);
    await expect(storeResponse.json()).resolves.toMatchObject({ kind: 'store' });
    await expect(inquiryFormResponse.json()).resolves.toMatchObject({ kind: 'inquiry-form' });
    await expect(consultationFormResponse.json()).resolves.toMatchObject({ kind: 'consultation-form' });
    await expect(rewrittenStoreResponse.json()).resolves.toMatchObject({ kind: 'store' });
  });

  it('routes visitor-session, inquiry, consultation, reservation, waiting, and order POST requests to their handlers', async () => {
    publicApiMocks.handlePublicVisitorSessionRequest.mockResolvedValueOnce(okResponse('visitor-session'));
    publicApiMocks.handlePublicInquiryRequest.mockResolvedValueOnce(okResponse('inquiry'));
    publicApiMocks.handlePublicConsultationRequest.mockResolvedValueOnce(okResponse('consultation'));
    publicApiMocks.handlePublicReservationRequest.mockResolvedValueOnce(okResponse('reservation'));
    publicApiMocks.handlePublicWaitingRequest.mockResolvedValueOnce(okResponse('waiting'));
    publicApiMocks.handlePublicOrderRequest.mockResolvedValueOnce(okResponse('order'));
    publicApiMocks.handlePublicOrderPaymentCheckoutRequest.mockResolvedValueOnce(okResponse('order-payment-checkout'));
    publicApiMocks.handlePublicOrderPaymentVerifyRequest.mockResolvedValueOnce(okResponse('order-payment-verify'));

    const visitorSessionResponse = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/visitor-session',
    });
    const inquiryResponse = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/inquiry',
    });
    const consultationResponse = await publicHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/consultation',
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
    const orderResponse = await publicHandler({
      body: { storeSlug: 'golden-coffee' },
      method: 'POST',
      url: '/api/public/order',
    });
    const orderPaymentCheckoutResponse = await publicHandler({
      body: { orderId: 'order_001', storeSlug: 'golden-coffee' },
      method: 'POST',
      url: '/api/public/order-payment-checkout',
    });
    const orderPaymentVerifyResponse = await publicHandler({
      body: { orderId: 'order_001', paymentId: 'payment_001', storeSlug: 'golden-coffee' },
      method: 'POST',
      url: '/api/public/order-payment-verify',
    });

    expect(publicApiMocks.handlePublicVisitorSessionRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicInquiryRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicConsultationRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicReservationRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicWaitingRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicOrderRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicOrderPaymentCheckoutRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicOrderPaymentVerifyRequest).toHaveBeenCalledTimes(1);
    await expect(visitorSessionResponse.json()).resolves.toMatchObject({ kind: 'visitor-session' });
    await expect(inquiryResponse.json()).resolves.toMatchObject({ kind: 'inquiry' });
    await expect(consultationResponse.json()).resolves.toMatchObject({ kind: 'consultation' });
    await expect(reservationResponse.json()).resolves.toMatchObject({ kind: 'reservation' });
    await expect(waitingResponse.json()).resolves.toMatchObject({ kind: 'waiting' });
    await expect(orderResponse.json()).resolves.toMatchObject({ kind: 'order' });
    await expect(orderPaymentCheckoutResponse.json()).resolves.toMatchObject({ kind: 'order-payment-checkout' });
    await expect(orderPaymentVerifyResponse.json()).resolves.toMatchObject({ kind: 'order-payment-verify' });
  });

  it('returns 405 when a method does not match the routed public endpoint', async () => {
    const storeResponse = await publicHandler(
      new Request('https://example.com/api/public/store?slug=golden-coffee', {
        method: 'POST',
      }),
    );
    const inquiryResponse = await publicHandler(
      new Request('https://example.com/api/public/inquiry', {
        method: 'GET',
      }),
    );
    const orderPaymentVerifyResponse = await publicHandler(
      new Request('https://example.com/api/public/order-payment-verify', {
        method: 'GET',
      }),
    );

    expect(storeResponse.status).toBe(405);
    expect(storeResponse.headers.get('allow')).toBe('GET');
    expect(inquiryResponse.status).toBe(405);
    expect(inquiryResponse.headers.get('allow')).toBe('POST');
    expect(orderPaymentVerifyResponse.status).toBe(405);
    expect(orderPaymentVerifyResponse.headers.get('allow')).toBe('POST');
  });
});
