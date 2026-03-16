import type { ComponentType } from 'react';

import { Icons } from '@/shared/components/Icons';
import type { FeatureKey } from '@/shared/types/models';

export type FeatureStatus = 'active' | 'coming_soon';

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  route: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  highlights: string[];
  status: FeatureStatus;
  statusLabel: string;
  showInExplorer?: boolean;
}

export interface AdminNavigationItem {
  label: string;
  route: string;
  icon: ComponentType<{ className?: string; size?: number }>;
}

export const featureDefinitions: FeatureDefinition[] = [
  {
    key: 'ai_manager',
    label: 'AI 점장',
    description: '오늘 매출과 주문 흐름, 인기 메뉴와 운영 힌트를 한눈에 보여주는 AI 운영 요약입니다.',
    route: '/dashboard/ai-manager',
    icon: Icons.AI,
    highlights: ['오늘 매출과 주문 수', '인기 메뉴 / 부진 메뉴', 'AI 요약 카드'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'ai_business_report',
    label: 'AI 비즈니스 리포트',
    description: '일간·주간 운영 리포트를 생성하고 누적 리포트 이력을 확인합니다.',
    route: '/dashboard/ai-reports',
    icon: Icons.Chart,
    highlights: ['일간 리포트', '주간 리포트', '리포트 이력'],
    status: 'active',
    statusLabel: '활성',
    showInExplorer: false,
  },
  {
    key: 'customer_management',
    label: '고객 관리',
    description: '고객 목록과 방문 횟수, 연락처, 최근 주문 이력을 운영 흐름에 맞게 관리합니다.',
    route: '/dashboard/customers',
    icon: Icons.Users,
    highlights: ['고객 목록', '방문 수', '연락처'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'reservation_management',
    label: '예약 관리',
    description: '예약 리스트와 예약 상태를 시간 순서대로 확인하고 빠르게 변경합니다.',
    route: '/dashboard/reservations',
    icon: Icons.Reservation,
    highlights: ['예약 리스트', '상태 변경', '시간 / 인원 관리'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'schedule_management',
    label: '일정 관리',
    description: '직원 근무와 운영 태스크를 일정 단위로 등록하고 전체 일정을 관리합니다.',
    route: '/dashboard/schedules',
    icon: Icons.Clock,
    highlights: ['일정 목록', '새 일정 버튼', '메모 관리'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'surveys',
    label: '설문조사',
    description: '설문 항목과 응답 수를 기준으로 고객 피드백 수집 현황을 관리합니다.',
    route: '/dashboard/surveys',
    icon: Icons.Survey,
    highlights: ['설문 항목', '응답 수', '새 설문 버튼'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'brand_management',
    label: '브랜드 관리',
    description: '로고, 브랜드 컬러, 소개 문구와 공개 스토어에 노출될 브랜드 자산을 관리합니다.',
    route: '/dashboard/brand',
    icon: Icons.Brand,
    highlights: ['로고', '브랜드 컬러', '브랜드 소개'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'sales_analysis',
    label: '매출 분석',
    description: '일 / 주 / 월 기준 매출 요약과 총매출, 주문 수를 빠르게 집계합니다.',
    route: '/dashboard/sales',
    icon: Icons.Chart,
    highlights: ['일 / 주 / 월 요약', '총매출', '주문 수'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'order_management',
    label: '주문 관리',
    description: '주문 목록, 상태, 메뉴 구성, 결제 상태를 운영 화면에서 통합 관리합니다.',
    route: '/dashboard/orders',
    icon: Icons.Delivery,
    highlights: ['주문 목록', '상태', '금액'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'waiting_board',
    label: '웨이팅보드',
    description: '대기 등록, 호출, 착석까지 이어지는 현장 흐름을 실시간으로 관리합니다.',
    route: '/dashboard/waiting',
    icon: Icons.Waiting,
    highlights: ['대기 리스트', '호출 상태', '착석 처리'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'contracts',
    label: '전자계약',
    description: '계약 항목, 상태, 파일 placeholder와 메타데이터를 스토어 단위로 관리합니다.',
    route: '/dashboard/contracts',
    icon: Icons.Contract,
    highlights: ['계약 항목', '상태', '파일 placeholder'],
    status: 'active',
    statusLabel: '활성',
  },
  {
    key: 'table_order',
    label: 'QR 테이블오더',
    description: '스토어 slug 기반 공개 주문 진입과 메뉴 보기, 주문 생성 흐름을 운영합니다.',
    route: '/dashboard/table-order',
    icon: Icons.Table,
    highlights: ['공개 스토어 진입', '메뉴 보기', '주문 생성 흐름'],
    status: 'active',
    statusLabel: '활성',
  },
];

export const appExplorerDefinitions = featureDefinitions.filter((feature) => feature.showInExplorer !== false);

export const adminNavigation: AdminNavigationItem[] = [
  { label: '스토어 현황', route: '/dashboard', icon: Icons.Dashboard },
  { label: 'AI 점장', route: '/dashboard/ai-manager', icon: Icons.AI },
  { label: '고객 관리', route: '/dashboard/customers', icon: Icons.Users },
  { label: '예약 관리', route: '/dashboard/reservations', icon: Icons.Reservation },
  { label: '주문 관리', route: '/dashboard/orders', icon: Icons.Delivery },
  { label: '웨이팅보드', route: '/dashboard/waiting', icon: Icons.Waiting },
  { label: '매출 분석', route: '/dashboard/sales', icon: Icons.Chart },
  { label: 'AI 운영 리포트', route: '/dashboard/ai-reports', icon: Icons.AI },
  { label: '테이블오더', route: '/dashboard/table-order', icon: Icons.Table },
  { label: '브랜드 설정', route: '/dashboard/brand', icon: Icons.Brand },
];

export function resolveAdminNavigation(pathname: string) {
  return [...adminNavigation]
    .sort((left, right) => right.route.length - left.route.length)
    .find((item) => pathname === item.route || pathname.startsWith(`${item.route}/`));
}
