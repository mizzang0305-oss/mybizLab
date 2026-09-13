export const SITE_NAME = 'MyBiz';
export const SERVICE_DOMAIN = 'mybiz.ai.kr';
export const SERVICE_TAGLINE = '작업부터 다음 고객까지 연결하는 Service OS';
export const SERVICE_DESCRIPTION =
  'MyBiz는 청소, 미용, 설치·수리처럼 완료 증빙이 중요한 서비스업의 작업 등록, 선택형 계약, 전후 증빙, 고객 확인, 결제 추적과 승인형 콘텐츠 성장을 연결하는 Service OS입니다.';
export const POLICY_UPDATED_AT = '2026년 3월 14일';
export const SUPPORT_PHONE_NUMBER = '032-214-5757';
export const SUBSCRIPTION_START_PATH = '/onboarding?plan=free';

export const BUSINESS_INFO = {
  companyName: '마이비즈랩',
  representative: '이정민',
  businessRegistrationNumber: '741-01-03857',
  ecommerceRegistrationNumber: '2026-인천남동구-0346',
  address: '인천광역시 남동구 만수서로 101, 121-1',
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
    summary: '월 소량의 현장 작업으로 증빙과 고객 확인 흐름을 직접 검증하는 플랜',
    features: ['현장 작업 5건', 'Before / After 증빙', '고객 확인 링크', '기본 증빙 내보내기'],
  },
  {
    name: 'PRO',
    priceLabel: '월 49,000원',
    summary: '현장 작업부터 고객 확인과 결제 요청까지 하나로 운영하는 추천 플랜',
    features: ['작업·고객 관리', 'Revision / 승인 이력', '결제 요청 연결', '전자계약 옵션', '콘텐츠 초안 생성'],
    highlighted: true,
  },
  {
    name: 'VIP',
    priceLabel: '월 99,000원',
    summary: '콘텐츠 제작과 채널 운영까지 연결해 작업 자체를 다음 고객 획득 자산으로 만드는 플랜',
    features: ['AI 블로그·영상 제작', 'SNS 게시 연동', 'API / Webhook', '브랜드 템플릿', '고급 Audit / Export'],
  },
] as const;
