import type { ServiceVertical } from '@/domain/mybiz/serviceOs';

export type PublicVertical = Exclude<ServiceVertical, 'medical'>;

export interface ExperienceVertical {
  id: PublicVertical;
  label: string;
  business: string;
  service: string;
  before: string;
  after: string;
  portfolio: string;
  tone: string;
  publicV1: boolean;
}

export const EXPERIENCE_VERTICALS: readonly ExperienceVertical[] = [
  {
    id: 'cleaning',
    label: '청소',
    business: '클린 스튜디오',
    service: '입주청소 · 주방',
    before: '기름때와 사용 흔적을 기록',
    after: '작업 범위별 완료 상태를 비교',
    portfolio: '입주 전, 주방이 달라지는 과정',
    tone: '#31545a',
    publicV1: true,
  },
  {
    id: 'hair',
    label: '미용실',
    business: '결 헤어',
    service: '디자이너 지안 · 레이어드 컷',
    before: '시술 전 길이와 고객 요청 기록',
    after: '완성 스타일과 담당자 포트폴리오',
    portfolio: '가벼운 흐름을 살린 레이어드 디자인',
    tone: '#735443',
    publicV1: true,
  },
  {
    id: 'installation',
    label: '설치·수리',
    business: '바른 설치',
    service: '벽걸이 에어컨 점검',
    before: '배관과 설치 위치의 초기 상태',
    after: '설치·작동 체크리스트 완료',
    portfolio: '설치 위치부터 작동 확인까지',
    tone: '#3f5368',
    publicV1: true,
  },
  {
    id: 'wig',
    label: '가발',
    business: '온결 스튜디오',
    service: '부분가발 피팅 · 스타일링',
    before: '피팅 전 형태와 요청 스타일',
    after: '완료 스타일과 관리 안내',
    portfolio: '자연스러운 방향을 찾은 맞춤 피팅',
    tone: '#6b514d',
    publicV1: false,
  },
  {
    id: 'interior',
    label: '인테리어',
    business: '선과 면',
    service: '상업 공간 마감 보수',
    before: '보수 전 하자 범위와 공정 상태',
    after: '마감 완료와 확인 지점 기록',
    portfolio: '운영을 멈추지 않은 야간 마감 보수',
    tone: '#4f5d50',
    publicV1: false,
  },
] as const;

export const SERVICE_LOOP = [
  ['작업', '고객·서비스·담당자를 한 건으로 시작'],
  ['계약', '필요한 업체만 선택'],
  ['증빙', '원본과 Revision을 분리'],
  ['확인', '고객 완료 확인 또는 보완 요청'],
  ['결제', '확인과 별도 상태로 추적'],
  ['성장', '동의·업체 승인 후 콘텐츠 후보'],
] as const;
