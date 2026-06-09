import { describe, expect, it } from 'vitest';

import {
  LEAD_CAPTURE_STATUSES,
  buildLeadMemorySeedSummary,
  createLeadCaptureSnapshot,
  maskLeadContact,
  transitionLeadStatus,
  type LeadCapture,
} from '@/domain/mybiz/leadCapture';

const baseLead: LeadCapture = {
  addressSummary: '서울 마포구 합정동',
  businessType: '카페',
  consentFlags: {
    marketingContact: false,
    ownerReview: true,
    privacyPolicy: true,
  },
  contactEmailMasked: 'owner@***.kr',
  contactName: '김대표',
  contactPhoneMasked: '010-****-1234',
  createdAt: '2026-06-09T09:00:00.000Z',
  currentCustomerManagement: '종이 쿠폰과 기억에 의존',
  currentInquiryFlow: '인스타 DM과 전화가 섞임',
  currentReservationFlow: '전화 예약만 받음',
  dataReadiness: 'medium',
  desiredOutcome: '재방문 고객을 놓치지 않고 VIP 후보를 분류',
  leadId: 'lead_001',
  mainConcern: '문의가 여러 채널에 흩어져 응대 누락이 생김',
  memorySeedSummary: '카페 / 문의 분산 / 재방문 VIP 후보 분류',
  nextAction: '파일럿 상담 일정 잡기',
  ownerNote: '평일 오후 통화 선호',
  pilotFitScore: 82,
  source: 'onboarding',
  status: 'new',
  storeName: '합정 브루잉',
};

describe('lead capture domain', () => {
  it('keeps the owner-reviewed status set explicit', () => {
    expect(LEAD_CAPTURE_STATUSES).toEqual([
      'new',
      'needs_review',
      'contacted',
      'pilot_candidate',
      'setup_in_progress',
      'converted',
      'rejected',
      'archived',
    ]);
  });

  it('masks contact values before they are used by tests or screens', () => {
    expect(maskLeadContact({ email: 'owner@mybiz.ai.kr', phone: '010-1234-5678' })).toEqual({
      email: 'o***r@mybiz.ai.kr',
      phone: '010-****-5678',
    });
  });

  it('builds customer memory seed copy from merchant pain and desired outcome', () => {
    expect(buildLeadMemorySeedSummary(baseLead)).toBe(
      '카페 매장 합정 브루잉은 문의가 여러 채널에 흩어져 응대 누락이 생김 문제를 해결하고 재방문 고객을 놓치지 않고 VIP 후보를 분류하려는 고객 기억 seed 후보입니다.',
    );
  });

  it('transitions status inside the owner-review boundary without changing contact masks', () => {
    const transitioned = transitionLeadStatus(baseLead, 'pilot_candidate', {
      nextAction: '파일럿 후보로 표시',
      ownerNote: '상담 후 2주 파일럿 제안',
    });

    expect(transitioned).toMatchObject({
      contactEmailMasked: baseLead.contactEmailMasked,
      contactPhoneMasked: baseLead.contactPhoneMasked,
      nextAction: '파일럿 후보로 표시',
      ownerNote: '상담 후 2주 파일럿 제안',
      status: 'pilot_candidate',
    });
  });

  it('creates immutable snapshots for mock console state', () => {
    const snapshot = createLeadCaptureSnapshot([baseLead]);
    snapshot[0].status = 'converted';

    expect(baseLead.status).toBe('new');
  });
});
