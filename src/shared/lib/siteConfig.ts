export const SITE_NAME = 'MyBiz';
export const SERVICE_DOMAIN = 'mybiz.ai.kr';
export const SERVICE_TAGLINE = 'AI 디지털 점장 — 소상공인 매장 운영 자동화';
export const SERVICE_DESCRIPTION =
  'MyBiz는 문의·예약·대기·주문을 한 곳에서 관리하고, AI가 고객 패턴을 분석해 매출을 끌어올리는 소상공인 AI 운영 플랫폼입니다. QR 주문, 고객 CRM, AI 리포트를 무료로 시작하세요.';
export const POLICY_UPDATED_AT = '2026년 3월 14일';
export const SUPPORT_PHONE_NUMBER = '032-214-5757';
export const SUBSCRIPTION_START_PATH = '/onboarding';

export const BUSINESS_INFO = {
  companyName: '마이비즈랩',
  representative: '이정민',
  businessRegistrationNumber: '741-01-03857',
  ecommerceRegistrationNumber: '2026-인천남동구-0346',
  address: '인천광역시 남동구 만수서로 101, 121-1(만수동, 현대프라자)',
  email: 'mybiz.lab3@gmail.com',
  customerCenter: SUPPORT_PHONE_NUMBER,
} as const;

export const LEGAL_LINKS = [
  { label: '이용약관', href: '/terms' },
  { label: '개인정보처리방침', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

export interface PricingPlan {
  name: 'FREE' | 'PRO' | 'VIP';
  priceLabel: string;
  summary: string;
  features: string[];
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'FREE',
    priceLabel: '무료',
    summary: '공개 스토어로 첫 유입과 기본 신호를 모으는 시작 플랜',
    features: ['공개 스토어 생성', '기본 유입 캡처', '기초 운영 진단'],
  },
  {
    name: 'PRO',
    priceLabel: '월 79,000원',
    summary: '문의·예약·웨이팅을 고객 기억과 운영 액션으로 연결하는 추천 플랜',
    features: ['고객 기억 인프라', '예약·웨이팅 운영', 'AI 액션 제안'],
    highlighted: true,
  },
  {
    name: 'VIP',
    priceLabel: '월 149,000원',
    summary: '반복 매출 루프와 운영 자동화를 깊게 확장하는 상위 플랜',
    features: ['고급 리포트', '확장 운영 자동화', '브랜드 맞춤 지원'],
  },
] as const;
