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

import consultationFormHandler from '../../api/public/consultation-form';
import consultationHandler from '../../api/public/consultation';
import inquiryFormHandler from '../../api/public/inquiry-form';
import inquiryHandler from '../../api/public/inquiry';
import orderPaymentCheckoutHandler from '../../api/public/order-payment-checkout';
import orderPaymentVerifyHandler from '../../api/public/order-payment-verify';
import orderHandler from '../../api/public/order';
import reservationHandler from '../../api/public/reservation';
import storeHandler from '../../api/public/store';
import visitorSessionHandler from '../../api/public/visitor-session';
import waitingHandler from '../../api/public/waiting';

function okResponse(kind: string) {
  return new Response(JSON.stringify({ ok: true, kind }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

describe('/api/public explicit route handlers', () => {
  it('routes store, inquiry-form, and consultation-form GET requests to their handlers', async () => {
    publicApiMocks.handlePublicStoreRequest.mockResolvedValueOnce(okResponse('store'));
    publicApiMocks.handlePublicInquiryFormRequest.mockResolvedValueOnce(okResponse('inquiry-form'));
    publicApiMocks.handlePublicConsultationFormRequest.mockResolvedValueOnce(okResponse('consultation-form'));

    const storeResponse = await storeHandler(
      new Request('https://example.com/api/public/store?slug=golden-coffee', {
        method: 'GET',
      }),
    );
    const inquiryFormResponse = await inquiryFormHandler(
      new Request('https://example.com/api/public/inquiry-form?storeId=store-live', {
        method: 'GET',
      }),
    );
    const consultationFormResponse = await consultationFormHandler(
      new Request('https://example.com/api/public/consultation-form?storeId=store-live', {
        method: 'GET',
      }),
    );

    expect(publicApiMocks.handlePublicStoreRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicInquiryFormRequest).toHaveBeenCalledTimes(1);
    expect(publicApiMocks.handlePublicConsultationFormRequest).toHaveBeenCalledTimes(1);
    await expect(storeResponse.json()).resolves.toMatchObject({ kind: 'store' });
    await expect(inquiryFormResponse.json()).resolves.toMatchObject({ kind: 'inquiry-form' });
    await expect(consultationFormResponse.json()).resolves.toMatchObject({ kind: 'consultation-form' });
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

    const visitorSessionResponse = await visitorSessionHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/visitor-session',
    });
    const inquiryResponse = await inquiryHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/inquiry',
    });
    const consultationResponse = await consultationHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/consultation',
    });
    const reservationResponse = await reservationHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/reservation',
    });
    const waitingResponse = await waitingHandler({
      body: { storeId: 'store-live' },
      method: 'POST',
      url: '/api/public/waiting',
    });
    const orderResponse = await orderHandler({
      body: { storeSlug: 'golden-coffee' },
      method: 'POST',
      url: '/api/public/order',
    });
    const orderPaymentCheckoutResponse = await orderPaymentCheckoutHandler({
      body: { orderId: 'order_001', storeSlug: 'golden-coffee' },
      method: 'POST',
      url: '/api/public/order-payment-checkout',
    });
    const orderPaymentVerifyResponse = await orderPaymentVerifyHandler({
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

  it('returns 405 when a method does not match the explicit public endpoint', async () => {
    const storeResponse = await storeHandler(
      new Request('https://example.com/api/public/store?slug=golden-coffee', {
        method: 'POST',
      }),
    );
    const inquiryResponse = await inquiryHandler(
      new Request('https://example.com/api/public/inquiry', {
        method: 'GET',
      }),
    );
    const orderPaymentVerifyResponse = await orderPaymentVerifyHandler(
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
