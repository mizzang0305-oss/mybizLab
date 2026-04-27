import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '@/shared/components/StatusBadge';
import { adminNavigation, featureDefinitions } from '@/shared/lib/moduleCatalog';
import {
  getMerchantStatusLabel,
  getOrderNextAction,
  getOrderStatusLabel,
  getPaymentStatusLabel,
  getReservationNextAction,
  getWaitingNextAction,
} from '@/shared/lib/merchantOperations';

describe('merchant UX labels', () => {
  it('keeps raw operational statuses Korean-only for merchants', () => {
    expect(getMerchantStatusLabel('Unknown')).toBe('고객 정보 없음');
    expect(getMerchantStatusLabel('Pending')).toBe('결제 대기');
    expect(getMerchantStatusLabel('Completed')).toBe('결제 완료');
    expect(getMerchantStatusLabel('Failed')).toBe('처리 실패');

    const html = renderToStaticMarkup(createElement(StatusBadge, { status: 'Pending' }));

    expect(html).toContain('결제 대기');
    expect(html).not.toContain('Pending');
  });

  it('separates order progress from payment progress', () => {
    expect(getOrderStatusLabel('pending')).toBe('접수 대기');
    expect(getOrderStatusLabel('completed')).toBe('주문 완료');
    expect(getPaymentStatusLabel('pending')).toBe('결제 대기');
    expect(getPaymentStatusLabel('paid')).toBe('결제 완료');
  });

  it('returns one clear next action for order, reservation, and waiting flows', () => {
    expect(getOrderNextAction({ status: 'pending', payment_status: 'pending' }).label).toBe('주문 접수');
    expect(getOrderNextAction({ status: 'ready', payment_status: 'pending' }).label).toBe('결제 확인 필요');
    expect(getOrderNextAction({ status: 'ready', payment_status: 'paid' }).label).toBe('주문 완료 처리');
    expect(getReservationNextAction('booked')?.label).toBe('착석 처리');
    expect(getWaitingNextAction('waiting')?.label).toBe('고객 호출');
  });

  it('uses operational navigation labels that match customer-memory language', () => {
    const customerFeature = featureDefinitions.find((feature) => feature.key === 'customer_management');
    const waitingNav = adminNavigation.find((item) => item.route === '/dashboard/waiting');

    expect(customerFeature?.label).toBe('고객 기억 관리');
    expect(customerFeature?.highlights).toContain('상담 / 문의');
    expect(waitingNav?.label).toBe('웨이팅 관리');
  });
});
