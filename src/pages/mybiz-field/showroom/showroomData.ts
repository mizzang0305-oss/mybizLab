import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Boxes,
  ClipboardSignature,
  Files,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  ReceiptText,
  RefreshCw,
  Sparkles,
  UsersRound,
  Workflow,
} from 'lucide-react';

export type ShowroomTemplateId =
  | 'contract-payment'
  | 'content-automation'
  | 'crm-workflow'
  | 'erp-wms'
  | 'api-automation'
  | 'ai-agent';

export interface ShowroomTemplate {
  buildLevel: '기본형' | '확장형' | '맞춤 구축';
  consultationLabel: '이 템플릿으로 상담하기';
  deliveryMode: string;
  deliveryTime: string;
  demoDisclosure: string;
  demoLabel: '직접 체험';
  extensions: readonly string[];
  features: readonly string[];
  icon: LucideIcon;
  id: ShowroomTemplateId;
  industries: readonly string[];
  label: string;
  maintenance: string;
  problem: string;
  shortLabel: string;
}

export const SHOWROOM_TEMPLATES: readonly ShowroomTemplate[] = [
  {
    buildLevel: '맞춤 구축',
    consultationLabel: '이 템플릿으로 상담하기',
    deliveryMode: '반응형 웹 + 관리자 화면 + 연동 설계',
    deliveryTime: '핵심 범위 기준 4~8주',
    demoDisclosure: '구성 예시입니다. 실제 전자서명과 결제는 실행되지 않습니다.',
    demoLabel: '직접 체험',
    extensions: ['본인인증', '세금계산서·회계 연동', '계약 만료 알림'],
    features: ['모바일 계약', '서명 준비 상태', '결제 링크 준비', '관리자 검토', '알림 이력'],
    icon: ClipboardSignature,
    id: 'contract-payment',
    industries: ['교육·컨설팅', '서비스업', 'B2B 영업'],
    label: '계약·결제 자동화 패키지',
    maintenance: '운영 모니터링과 정책 변경 대응 가능',
    problem: '견적, 계약, 결제 확인이 서로 다른 도구에 흩어져 진행 상황과 책임 구간을 놓치는 문제를 해결합니다.',
    shortLabel: '계약 + 결제',
  },
  {
    buildLevel: '확장형',
    consultationLabel: '이 템플릿으로 상담하기',
    deliveryMode: '콘텐츠 워크플로 + 채널별 어댑터',
    deliveryTime: '핵심 범위 기준 3~7주',
    demoDisclosure: '데모에서는 초안과 승인 대기만 표시하며 외부 채널 게시를 실행하지 않습니다.',
    demoLabel: '직접 체험',
    extensions: ['예약 발행', '브랜드 톤 가이드', '성과 리포트'],
    features: ['콘텐츠 입력', 'AI 초안', '채널별 변환', '승인 큐', '콘텐츠 이력'],
    icon: Megaphone,
    id: 'content-automation',
    industries: ['브랜드·커머스', '전문 서비스', '콘텐츠 팀'],
    label: 'SNS·콘텐츠 운영 패키지',
    maintenance: '채널 정책과 API 변경 대응 가능',
    problem: '한 번 만든 소재를 채널마다 다시 쓰고 검토 상태를 메신저로 추적하는 반복 업무를 한 흐름으로 정리합니다.',
    shortLabel: 'SNS / 콘텐츠',
  },
  {
    buildLevel: '기본형',
    consultationLabel: '이 템플릿으로 상담하기',
    deliveryMode: 'CRM 파이프라인 + 담당자 업무 화면',
    deliveryTime: '핵심 범위 기준 3~6주',
    demoDisclosure: '합성 리드로 상태 이동만 체험하는 로컬 데모입니다.',
    demoLabel: '직접 체험',
    extensions: ['상담 일정', '고객 이력', '후속 알림'],
    features: ['신규 문의', '상담', '견적', '계약', '작업', '완료', '사후관리'],
    icon: UsersRound,
    id: 'crm-workflow',
    industries: ['학원·교육', '시공·수리', '전문 서비스'],
    label: '고객·업무관리 패키지',
    maintenance: '파이프라인과 권한 정책 조정 가능',
    problem: '문의부터 완료 후 관리까지 담당자마다 다른 방식으로 기록해 고객과 다음 행동을 놓치는 문제를 해결합니다.',
    shortLabel: 'CRM / 업무관리',
  },
  {
    buildLevel: '맞춤 구축',
    consultationLabel: '이 템플릿으로 상담하기',
    deliveryMode: '회사 전용 ERP/WMS 웹 시스템',
    deliveryTime: '핵심 범위 기준 8~16주',
    demoDisclosure: '데모의 모든 주문·재고·거래처 값은 익명 합성 데이터입니다.',
    demoLabel: '직접 체험',
    extensions: ['회계 연동', '바코드·PDA', '구매 분석'],
    features: ['주문', '매출', '입금', '재고', '출고', '거래처', '구매 분석'],
    icon: Boxes,
    id: 'erp-wms',
    industries: ['유통·물류', '제조', '다점포 운영'],
    label: 'ERP·WMS 내부 시스템',
    maintenance: '업무 규칙과 조직 변화에 맞춘 운영 지원 가능',
    problem: '엑셀과 수기 장부 사이에서 주문, 재고, 출고 기준이 달라져 재확인하는 내부 업무를 회사 전용 화면으로 바꿉니다.',
    shortLabel: 'ERP / WMS',
  },
  {
    buildLevel: '확장형',
    consultationLabel: '이 템플릿으로 상담하기',
    deliveryMode: '검증 파이프라인 + API/Worker',
    deliveryTime: '핵심 범위 기준 4~10주',
    demoDisclosure: '합성 파일 처리 흐름 데모이며 ERP나 외부 API에는 전송하지 않습니다.',
    demoLabel: '직접 체험',
    extensions: ['스케줄 실행', '재처리 큐', '운영 알림'],
    features: ['파일 입력', '데이터 검증', '외부 API 어댑터', '반복 처리', '예외 확인'],
    icon: Workflow,
    id: 'api-automation',
    industries: ['백오피스', '영업 운영', '데이터 팀'],
    label: 'API·업무 자동화 패키지',
    maintenance: '연동처 스펙 변경과 예외 규칙 대응 가능',
    problem: '파일 확인, 복사, 시스템 입력, 재검증을 매번 사람이 반복하는 흐름을 검증 가능한 자동 처리로 전환합니다.',
    shortLabel: 'API / 자동화',
  },
  {
    buildLevel: '맞춤 구축',
    consultationLabel: '이 템플릿으로 상담하기',
    deliveryMode: '사내 지식 검색 + 승인형 Agent',
    deliveryTime: '핵심 범위 기준 5~12주',
    demoDisclosure: '사전 작성된 합성 답변 데모입니다. 실제 외부 AI 호출이나 업무 실행은 없습니다.',
    demoLabel: '직접 체험',
    extensions: ['문서 권한', '평가 데이터셋', '승인 후 실행 어댑터'],
    features: ['자료 검색', '사내 질문', '판단 지원', '문서 작성', '데이터 분석', 'Owner 승인'],
    icon: Bot,
    id: 'ai-agent',
    industries: ['경영지원', '운영 조직', '지식 업무팀'],
    label: 'AI 업무 도구·Agent',
    maintenance: '지식 업데이트와 평가 기준 운영 가능',
    problem: '자료를 찾고 판단 근거를 정리한 뒤 반복 문서를 만드는 시간을 줄이되, 중요한 실행은 사람이 승인하도록 설계합니다.',
    shortLabel: 'AI 업무 도구',
  },
] as const;

// Version labels this MyBiz showroom selection contract, not a Factory export.
export const SHOWROOM_TEMPLATE_SELECTION_VERSION = 'showroom-v1';

export function getTemplateSelectionSummary(id: ShowroomTemplateId | undefined): string {
  const template = SHOWROOM_TEMPLATES.find((item) => item.id === id);
  return template
    ? `개발 템플릿 / ${template.label} / ${template.id}@${SHOWROOM_TEMPLATE_SELECTION_VERSION}`
    : '';
}

export const SYSTEM_STORY = [
  { detail: '웹, 전화, 소개로 들어온 요구를 한 구조로 정리합니다.', icon: MessageSquareText, id: 'inquiry', title: '고객 문의' },
  { detail: '범위와 조건을 확인 가능한 계약 단계로 연결합니다.', icon: ClipboardSignature, id: 'contract', title: '전자계약' },
  { detail: '요청과 상태를 분리해 대금 흐름을 추적합니다.', icon: ReceiptText, id: 'payment', title: '결제' },
  { detail: '반복 입력은 자동화하고 예외만 사람이 봅니다.', icon: RefreshCw, id: 'automation', title: '업무 자동화' },
  { detail: '고객, 담당자, 다음 행동을 한 화면에서 봅니다.', icon: UsersRound, id: 'crm', title: '고객관리' },
  { detail: '승인된 자료만 채널별 자산 후보로 준비합니다.', icon: Files, id: 'content', title: '콘텐츠 준비' },
  { detail: '운영 데이터를 요약하고 판단 근거를 제시합니다.', icon: Sparkles, id: 'analysis', title: '데이터·AI 분석' },
  { detail: '권한, 예외, 승인과 결과를 운영자가 통제합니다.', icon: LayoutDashboard, id: 'control-center', title: 'Owner Control Center' },
] as const;

export const ANONYMIZED_SHOWROOM_CASES = [
  {
    disclosure: '업종만 공개한 익명 구현 경험',
    outcome: '주문·재고·출고의 같은 기준을 한 화면에서 검토하는 운영 구조',
    problem: '엑셀 파일마다 주문과 재고 기준이 달라 반복 대조가 필요함',
    system: '식자재 유통 업무용 ERP/WMS와 예외 검토 흐름',
    title: '유통사 ERP/WMS',
  },
  {
    disclosure: '기능 범위만 공개한 익명 구현 경험',
    outcome: '고객과 운영자가 같은 계약·대금 상태를 확인하는 흐름',
    problem: '계약 파일, 서명 상태, 결제 확인이 서로 다른 채널에 분산됨',
    system: '모바일 계약과 링크결제 준비 상태를 잇는 관리자 시스템',
    title: '계약·결제 운영 시스템',
  },
  {
    disclosure: '아키텍처 목적만 공개한 익명 구현 경험',
    outcome: '중요 실행 전 Owner approval을 남기는 중앙 운영 방식',
    problem: '여러 자동화 작업의 상태와 실패 원인을 한곳에서 보기 어려움',
    system: 'Worker 상태, 예외, 승인 대기를 모은 AI 운영 Control Center',
    title: '승인형 자동화 Control Center',
  },
] as const;
