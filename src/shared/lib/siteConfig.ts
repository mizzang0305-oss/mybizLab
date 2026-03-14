export const SITE_NAME = '마이비즈랩';
export const SERVICE_DOMAIN = 'mybiz.ai.kr';
export const SERVICE_TAGLINE = '매장 운영을 AI로 정리하는 구독형 SaaS';
export const SERVICE_DESCRIPTION =
  '마이비즈랩은 공개 스토어, QR 주문, 예약, 고객관리, 매출 분석을 하나의 운영 대시보드로 연결하는 SaaS 플랫폼입니다.';
export const POLICY_UPDATED_AT = '2026년 3월 14일';
export const SUPPORT_PHONE_NUMBER = '032-214-5757';
export const SUBSCRIPTION_START_PATH = '/login?next=/dashboard';

export const BUSINESS_INFO = {
  companyName: '마이비즈랩',
  representative: '이정민',
  businessRegistrationNumber: '741-01-03857',
  ecommerceRegistrationNumber: '2026-인천남동구-0346',
  address: '인천광역시 남동구 만수서로 101, 121-1(만수동, 신한프라자)',
  email: 'mybiz.lab3@gmail.com',
  customerCenter: SUPPORT_PHONE_NUMBER,
} as const;

export const LEGAL_LINKS = [
  { label: '이용약관', href: '/terms' },
  { label: '개인정보처리방침', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

export interface PricingPlan {
  name: 'Starter' | 'Pro' | 'Business';
  priceLabel: string;
  summary: string;
  features: string[];
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Starter',
    priceLabel: '월 29,000원',
    summary: '단일 매장을 빠르게 시작하기 위한 기본 운영 플랜',
    features: ['매장 1개', 'AI 매장 분석', '기본 매출 리포트', 'QR 주문'],
  },
  {
    name: 'Pro',
    priceLabel: '월 79,000원',
    summary: '여러 매장을 운영하며 고객관리와 리포트를 함께 강화하는 플랜',
    features: ['매장 3개', 'AI 매니저', 'AI 리포트', '고객관리', '예약관리'],
    highlighted: true,
  },
  {
    name: 'Business',
    priceLabel: '월 149,000원',
    summary: '브랜드 단위 운영과 자동화를 고려한 확장형 플랜',
    features: ['매장 무제한', 'AI 자동 분석', 'CRM 자동화', '브랜드 관리'],
  },
] as const;
