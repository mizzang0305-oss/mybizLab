export const LEAD_CAPTURE_STATUSES = [
  'new',
  'needs_review',
  'contacted',
  'pilot_candidate',
  'setup_in_progress',
  'converted',
  'rejected',
  'archived',
] as const;

export type LeadCaptureStatus = (typeof LEAD_CAPTURE_STATUSES)[number];
export type LeadCaptureSource = 'onboarding' | 'pricing' | 'manual' | 'referral';
export type LeadCaptureDataReadiness = 'low' | 'medium' | 'high';

export interface LeadCaptureConsentFlags {
  marketingContact: boolean;
  ownerReview: boolean;
  privacyPolicy: boolean;
}

export interface LeadCapture {
  addressSummary: string;
  businessType: string;
  consentFlags: LeadCaptureConsentFlags;
  contactEmailMasked: string;
  contactName: string;
  contactPhoneMasked: string;
  createdAt: string;
  currentCustomerManagement: string;
  currentInquiryFlow: string;
  currentReservationFlow: string;
  dataReadiness: LeadCaptureDataReadiness;
  desiredOutcome: string;
  leadId: string;
  mainConcern: string;
  memorySeedSummary: string;
  nextAction: string;
  ownerNote: string;
  pilotFitScore: number;
  source: LeadCaptureSource;
  status: LeadCaptureStatus;
  storeName: string;
}

export interface LeadCaptureTransitionPatch {
  nextAction?: string;
  ownerNote?: string;
}

export function maskLeadContact(input: { email?: string | null; phone?: string | null }) {
  const phoneDigits = (input.phone || '').replace(/\D/g, '');
  const phone = phoneDigits.length >= 8
    ? `${phoneDigits.slice(0, 3)}-****-${phoneDigits.slice(-4)}`
    : '';

  const [localPart, domain] = (input.email || '').split('@');
  const email = localPart && domain
    ? `${localPart.slice(0, 1)}***${localPart.slice(-1)}@${domain}`
    : '';

  return {
    email,
    phone,
  };
}

export function buildLeadMemorySeedSummary(lead: Pick<LeadCapture, 'businessType' | 'desiredOutcome' | 'mainConcern' | 'storeName'>) {
  return `${lead.businessType} 매장 ${lead.storeName}은 ${lead.mainConcern} 문제를 해결하고 ${lead.desiredOutcome}하려는 고객 기억 seed 후보입니다.`;
}

export function transitionLeadStatus(
  lead: LeadCapture,
  status: LeadCaptureStatus,
  patch: LeadCaptureTransitionPatch = {},
): LeadCapture {
  return {
    ...lead,
    nextAction: patch.nextAction ?? lead.nextAction,
    ownerNote: patch.ownerNote ?? lead.ownerNote,
    status,
  };
}

export function createLeadCaptureSnapshot(leads: LeadCapture[]) {
  return leads.map((lead) => ({
    ...lead,
    consentFlags: { ...lead.consentFlags },
  }));
}

export const MOCK_LEAD_CAPTURES: LeadCapture[] = [
  {
    addressSummary: '서울 마포구 합정동',
    businessType: '카페',
    consentFlags: {
      marketingContact: false,
      ownerReview: true,
      privacyPolicy: true,
    },
    contactEmailMasked: 'o***r@mybiz.ai.kr',
    contactName: '김대표',
    contactPhoneMasked: '010-****-5678',
    createdAt: '2026-06-09T09:00:00.000Z',
    currentCustomerManagement: '종이 쿠폰과 단골 기억에 의존',
    currentInquiryFlow: '인스타 DM과 전화 문의가 섞여 있음',
    currentReservationFlow: '전화 예약만 수기로 기록',
    dataReadiness: 'medium',
    desiredOutcome: '재방문 고객을 놓치지 않고 VIP 후보를 분류',
    leadId: 'lead_hapjeong_brewing',
    mainConcern: '문의가 여러 채널에 흩어져 응대 누락이 생김',
    memorySeedSummary: '카페 / 문의 분산 / 재방문 VIP 후보 분류',
    nextAction: '파일럿 상담 일정 잡기',
    ownerNote: '평일 오후 통화 선호',
    pilotFitScore: 82,
    source: 'onboarding',
    status: 'new',
    storeName: '합정 브루잉',
  },
  {
    addressSummary: '부산 해운대구 중동',
    businessType: '네일샵',
    consentFlags: {
      marketingContact: false,
      ownerReview: true,
      privacyPolicy: true,
    },
    contactEmailMasked: 'n***l@example.kr',
    contactName: '박원장',
    contactPhoneMasked: '010-****-2190',
    createdAt: '2026-06-08T13:30:00.000Z',
    currentCustomerManagement: '카카오톡 채팅방과 수기 메모',
    currentInquiryFlow: '예약 문의와 시술 상담이 같은 채널에 쌓임',
    currentReservationFlow: '구글 캘린더와 문자로 이중 관리',
    dataReadiness: 'high',
    desiredOutcome: '재방문 주기와 선호 시술을 기억해 예약률을 높임',
    leadId: 'lead_hyundae_nail',
    mainConcern: '단골별 선호와 재방문 주기를 계속 놓침',
    memorySeedSummary: '네일샵 / 재방문 주기 / 선호 시술 기억',
    nextAction: '관리자 검토 후 세팅',
    ownerNote: 'VIP 관리 기능에 관심',
    pilotFitScore: 91,
    source: 'pricing',
    status: 'pilot_candidate',
    storeName: '해운대 네일라운지',
  },
  {
    addressSummary: '대전 유성구 봉명동',
    businessType: '분식',
    consentFlags: {
      marketingContact: false,
      ownerReview: true,
      privacyPolicy: true,
    },
    contactEmailMasked: 's***p@example.kr',
    contactName: '이점주',
    contactPhoneMasked: '010-****-8841',
    createdAt: '2026-06-07T08:20:00.000Z',
    currentCustomerManagement: '별도 관리 없음',
    currentInquiryFlow: '전화와 네이버 톡톡',
    currentReservationFlow: '예약 없음, 단체 주문만 전화 접수',
    dataReadiness: 'low',
    desiredOutcome: '단체 주문 고객과 재주문 가능성을 분리',
    leadId: 'lead_yuseong_snack',
    mainConcern: '점심 피크 시간 문의와 주문이 한 번에 몰림',
    memorySeedSummary: '분식 / 단체 주문 / 재주문 후보',
    nextAction: '운영 고민 정리 후 재검토',
    ownerNote: 'POS 연동 전까지 수기 흐름 확인 필요',
    pilotFitScore: 63,
    source: 'referral',
    status: 'needs_review',
    storeName: '유성 김밥상회',
  },
];
