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

export const featureDefinitions: FeatureDefinition[] = [
  {
    key: 'ai_manager',
    label: 'AI 점장',
    description: '오늘 운영 데이터를 기반으로 핵심 지표와 AI 요약을 확인합니다.',
    route: '/dashboard/ai-manager',
    icon: Icons.AI,
    highlights: ['오늘 매출과 주문수', '인기 메뉴 및 부진 메뉴', 'AI 요약 카드'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'ai_business_report',
    label: 'AI 리포트',
    description: '일간/주간 리포트를 생성하고 저장합니다.',
    route: '/dashboard/ai-reports',
    icon: Icons.Chart,
    highlights: ['일간 리포트', '주간 리포트', '리포트 이력'],
    status: 'active',
    statusLabel: '활성화',
    showInExplorer: false,
  },
  {
    key: 'customer_management',
    label: '고객관리',
    description: '고객 목록, 방문수, 단골 여부와 주문 이력을 관리합니다.',
    route: '/dashboard/customers',
    icon: Icons.Users,
    highlights: ['고객 목록', '방문수', '단골 여부'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'reservation_management',
    label: '예약관리',
    description: '예약 등록과 상태 변경을 운영 흐름에 맞게 처리합니다.',
    route: '/dashboard/reservations',
    icon: Icons.Reservation,
    highlights: ['예약 리스트', '상태 변경', '인원 및 시간 관리'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'schedule_management',
    label: '일정관리',
    description: '직원 일정과 작업 일정을 리스트로 운영합니다.',
    route: '/dashboard/schedules',
    icon: Icons.Clock,
    highlights: ['일정 목록', '일정 생성 버튼', '담당자 메모'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'surveys',
    label: '설문조사',
    description: '설문 생성과 응답 통계를 스토어 기준으로 관리합니다.',
    route: '/dashboard/surveys',
    icon: Icons.Survey,
    highlights: ['설문 제목', '응답 수', '새 설문 버튼'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'brand_management',
    label: '브랜드관리',
    description: '로고, 브랜드 컬러, 소개 문구를 저장하고 미리봅니다.',
    route: '/dashboard/brand',
    icon: Icons.Brand,
    highlights: ['로고', '브랜드 컬러', '소개 문구'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'sales_analysis',
    label: '매출분석',
    description: '일/주/월 요약과 총매출, 주문수를 빠르게 확인합니다.',
    route: '/dashboard/sales',
    icon: Icons.Chart,
    highlights: ['일/주/월 요약', '총매출', '주문수'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'order_management',
    label: '주문관리',
    description: '주문 상태와 금액, 메뉴 구성을 운영 화면에서 관리합니다.',
    route: '/dashboard/orders',
    icon: Icons.Delivery,
    highlights: ['주문 목록', '상태', '금액'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'waiting_board',
    label: '웨이팅보드',
    description: '대기 등록, 호출, 착석까지 현장 흐름을 관리합니다.',
    route: '/dashboard/waiting',
    icon: Icons.Waiting,
    highlights: ['대기 리스트', '호출 상태', '착석 처리'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'contracts',
    label: '계약관리',
    description: '계약 상태와 파일 placeholder를 포함한 계약 메타데이터를 관리합니다.',
    route: '/dashboard/contracts',
    icon: Icons.Contract,
    highlights: ['계약 제목', '상태', '파일 placeholder'],
    status: 'active',
    statusLabel: '활성화',
  },
  {
    key: 'table_order',
    label: '테이블오더',
    description: 'store slug 기반 공개 주문 진입과 주방 연결 흐름을 유지합니다.',
    route: '/dashboard/table-order',
    icon: Icons.Table,
    highlights: ['공개 스토어 진입', '메뉴 보기', '주문 생성 흐름'],
    status: 'active',
    statusLabel: '활성화',
  },
];

export const appExplorerDefinitions = featureDefinitions.filter((feature) => feature.showInExplorer !== false);

export const adminNavigation = [
  { label: '개요', route: '/dashboard', icon: Icons.Dashboard },
  ...featureDefinitions.map(({ label, route, icon }) => ({ label, route, icon })),
  { label: '주방보드', route: '/dashboard/kitchen', icon: Icons.Kitchen },
];
