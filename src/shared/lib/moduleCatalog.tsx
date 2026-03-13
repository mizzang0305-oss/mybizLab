import type { ComponentType } from 'react';

import { Icons } from '@/shared/components/Icons';
import type { FeatureKey } from '@/shared/types/models';

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  route: string;
  icon: ComponentType<{ className?: string; size?: number }>;
}

export const featureDefinitions: FeatureDefinition[] = [
  {
    key: 'ai_manager',
    label: 'AI 점장',
    description: '오늘 운영 데이터를 기반으로 AI 조언과 핵심 지표를 봅니다.',
    route: '/dashboard/ai-manager',
    icon: Icons.AI,
  },
  {
    key: 'ai_business_report',
    label: 'AI 리포트',
    description: '일간/주간 운영 리포트를 생성하고 기록합니다.',
    route: '/dashboard/ai-reports',
    icon: Icons.Chart,
  },
  {
    key: 'customer_management',
    label: '고객 관리',
    description: '단골, 방문 횟수, 수신 동의와 주문 이력을 관리합니다.',
    route: '/dashboard/customers',
    icon: Icons.Users,
  },
  {
    key: 'reservation_management',
    label: '예약 관리',
    description: '예약 등록과 상태 변경을 운영 흐름에 맞게 처리합니다.',
    route: '/dashboard/reservations',
    icon: Icons.Reservation,
  },
  {
    key: 'schedule_management',
    label: '일정 관리',
    description: '직원 일정과 작업 일정을 리스트/주간 보기로 관리합니다.',
    route: '/dashboard/schedules',
    icon: Icons.Clock,
  },
  {
    key: 'surveys',
    label: '설문 조사',
    description: '설문 문항과 응답 통계를 스토어 기준으로 관리합니다.',
    route: '/dashboard/surveys',
    icon: Icons.Survey,
  },
  {
    key: 'brand_management',
    label: '브랜드 관리',
    description: '브랜드 컬러, 소개 문구, 로고 URL을 저장합니다.',
    route: '/dashboard/brand',
    icon: Icons.Brand,
  },
  {
    key: 'sales_analysis',
    label: '매출 분석',
    description: '일/주/월 집계와 채널 비중을 빠르게 확인합니다.',
    route: '/dashboard/sales',
    icon: Icons.Chart,
  },
  {
    key: 'order_management',
    label: '주문 관리',
    description: '주문 상태 변경과 상세 내역, 채널별 운영 현황을 봅니다.',
    route: '/dashboard/orders',
    icon: Icons.Delivery,
  },
  {
    key: 'waiting_board',
    label: '웨이팅보드',
    description: '대기 등록, 호출, 착석까지 현장 흐름을 관리합니다.',
    route: '/dashboard/waiting',
    icon: Icons.Waiting,
  },
  {
    key: 'contracts',
    label: '전자계약',
    description: '계약 메타데이터와 파일 URL을 보관합니다.',
    route: '/dashboard/contracts',
    icon: Icons.Contract,
  },
  {
    key: 'table_order',
    label: '테이블 오더',
    description: 'QR 주문, 테이블 관리, 주방 티켓 흐름을 연결합니다.',
    route: '/dashboard/table-order',
    icon: Icons.Table,
  },
];

export const adminNavigation = [
  { label: '개요', route: '/dashboard', icon: Icons.Dashboard },
  ...featureDefinitions.map(({ label, route, icon }) => ({ label, route, icon })),
  { label: '주방 보드', route: '/dashboard/kitchen', icon: Icons.Kitchen },
];
