import { beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import {
  getDashboardSnapshot,
  getPublicInquiryForm,
  getPublicStoreById,
  listCustomers,
  listInquiries,
  submitPublicInquiry,
  updateInquiryRecord,
} from '@/shared/lib/services/mvpService';

describe('crm inquiry flow', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('captures a public inquiry, creates a CRM contact, and reflects it in the dashboard', async () => {
    const beforeConsultations = getDashboardSnapshot('store_mint_bbq', { range: 'weekly' }).totals.consultations;
    const inquiryForm = await getPublicInquiryForm('store_mint_bbq');
    expect(inquiryForm?.summary.totalCount).toBeGreaterThan(0);

    const result = await submitPublicInquiry({
      storeId: 'store_mint_bbq',
      customerName: 'Demo Lead',
      phone: '010-9999-0000',
      email: 'lead@example.com',
      category: 'group_booking',
      requestedVisitDate: '2026-03-28',
      message: '12인 저녁 모임 가능 여부와 세트 메뉴 구성을 알고 싶습니다.',
      marketingOptIn: true,
    });

    expect(result.inquiry?.status).toBe('new');
    expect(result.customer?.phone).toBe('010-9999-0000');
    expect(result.inquiry.customer_id).toBe(result.customer.id);
    expect(result.inquiry.conversation_session_id).toBeTruthy();
    expect(result.inquiry.visitor_session_id).toBeTruthy();

    const inquiries = await listInquiries('store_mint_bbq');
    expect(inquiries[0]?.customer_name).toBe('Demo Lead');

    const customers = await listCustomers('store_mint_bbq');
    expect(customers.some((customer) => customer.phone === '010-9999-0000')).toBe(true);

    const publicStore = await getPublicStoreById('store_mint_bbq');
    expect(publicStore?.inquirySummary.totalCount).toBe((inquiryForm?.summary.totalCount || 0) + 1);

    const afterConsultations = getDashboardSnapshot('store_mint_bbq', { range: 'weekly' }).totals.consultations;
    expect(afterConsultations).toBe(beforeConsultations + 1);

    const database = getDatabase();
    expect(
      database.conversation_sessions.some(
        (session) =>
          session.store_id === 'store_mint_bbq' &&
          session.customer_id === result.customer.id &&
          session.inquiry_id === result.inquiry.id,
      ),
    ).toBe(true);
    expect(
      database.conversation_messages.some(
        (message) =>
          message.store_id === 'store_mint_bbq' &&
          message.inquiry_id === result.inquiry.id &&
          message.customer_id === result.customer.id,
      ),
    ).toBe(true);
    expect(
      database.visitor_sessions.some(
        (session) =>
          session.store_id === 'store_mint_bbq' &&
          session.inquiry_id === result.inquiry.id &&
          session.customer_id === result.customer.id,
      ),
    ).toBe(true);
    expect(
      database.customer_timeline_events.filter(
        (event) => event.store_id === 'store_mint_bbq' && event.customer_id === result.customer.id,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: 'inquiry_captured' }),
        expect.objectContaining({ event_type: 'conversation_started' }),
        expect.objectContaining({ event_type: 'conversation_message' }),
      ]),
    );
  });

  it('lets the owner update inquiry status, tags, and memo from CRM', async () => {
    const updated = await updateInquiryRecord('store_golden_coffee', 'inquiry_golden_group', {
      status: 'completed',
      tags: ['VIP', 'weekend', 'callback'],
      memo: 'Confirmed and closed after phone follow-up.',
    });

    expect(updated?.status).toBe('completed');
    expect(updated?.tags).toEqual(['VIP', 'weekend', 'callback']);
    expect(updated?.memo).toContain('Confirmed');
  });
});
