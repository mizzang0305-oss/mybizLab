export type CoreIndustry = 'cleaning' | 'hair' | 'installation';

export type HeroChapterId = 'record' | 'confirm' | 'grow';

export interface HeroChapter {
  id: HeroChapterId;
  label: string;
  startsAt: number;
  title: string;
  detail: string;
}

export interface IndustryMedia {
  id: CoreIndustry;
  label: string;
  shortLabel: string;
  business: string;
  service: string;
  sourceType: 'licensed-staged-footage';
  visualSourceType: 'ai-generated-staged-image';
  disclosureText: string;
  pairId: string;
  desktopVideo: string;
  mobileVideo: string;
  desktopPoster: string;
  mobilePoster: string;
  beforeImage: string;
  afterImage: string;
  thumbnail: string;
  beforeAlt: string;
  afterAlt: string;
  beforeLabel: string;
  afterLabel: string;
  portfolioTitle: string;
  websiteLead: string;
  tone: string;
  durationSeconds: number;
  chapters: readonly HeroChapter[];
}

const base = '/media/mybiz-stage2';

export const INDUSTRY_MEDIA: Record<CoreIndustry, IndustryMedia> = {
  cleaning: {
    id: 'cleaning',
    label: '청소',
    shortLabel: '입주·이사·사무실 청소',
    business: '클린 스튜디오',
    service: '욕실 세면대 전문 청소',
    sourceType: 'licensed-staged-footage',
    visualSourceType: 'ai-generated-staged-image',
    disclosureText: 'AI로 제작한 업종 맞춤 전후 예시 · 실제 고객 사례가 아닙니다.',
    pairId: 'cleaning-bathroom-aligned-generated-v2',
    desktopVideo: `${base}/cleaning/hero-desktop.mp4`,
    mobileVideo: `${base}/cleaning/hero-mobile.mp4`,
    desktopPoster: `${base}/industry-aligned/cleaning-after.webp`,
    mobilePoster: `${base}/industry-aligned/cleaning-after.webp`,
    beforeImage: `${base}/industry-aligned/cleaning-before.webp`,
    afterImage: `${base}/industry-aligned/cleaning-after.webp`,
    thumbnail: `${base}/industry-aligned/cleaning-after.webp`,
    beforeAlt: '전문 청소 전 물때와 오염이 남은 같은 욕실 세면대',
    afterAlt: '전문 청소 후 물때를 제거하고 정돈한 같은 욕실 세면대',
    beforeLabel: '물때·오염 제거 전',
    afterLabel: '청소·정돈 완료',
    portfolioTitle: '욕실 세면대를 깨끗하게 바꾼 과정',
    websiteLead: '작업 범위와 전후 기록을 한눈에 보여주는 사례형 구성',
    tone: '#31545a',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '작업 전 상태를 남기고', detail: '같은 세면대의 오염 상태와 작업 범위를 기록합니다.' },
      { id: 'confirm', label: '확인', startsAt: 6.2, title: '고객이 결과를 확인', detail: '완료 확인과 보완 요청을 결제와 분리합니다.' },
      { id: 'grow', label: '성장', startsAt: 9.3, title: '승인된 작업을 사례 후보로', detail: '별도 동의와 업체 검토를 거친 버전만 연결합니다.' },
    ],
  },
  hair: {
    id: 'hair',
    label: '미용실',
    shortLabel: '커트·펌·염색·포트폴리오',
    business: '결 헤어',
    service: '레이어드 보브 커트',
    sourceType: 'licensed-staged-footage',
    visualSourceType: 'ai-generated-staged-image',
    disclosureText: 'AI로 제작한 업종 맞춤 전후 예시 · 실제 고객 사례가 아닙니다.',
    pairId: 'hair-client-aligned-generated-v2',
    desktopVideo: `${base}/hair/hero-desktop.mp4`,
    mobileVideo: `${base}/hair/hero-mobile.mp4`,
    desktopPoster: `${base}/industry-aligned/hair-after.webp`,
    mobilePoster: `${base}/industry-aligned/hair-after.webp`,
    beforeImage: `${base}/industry-aligned/hair-before.webp`,
    afterImage: `${base}/industry-aligned/hair-after.webp`,
    thumbnail: `${base}/industry-aligned/hair-after.webp`,
    beforeAlt: '커트 전 길고 부스스한 같은 성인 고객의 뒷머리',
    afterAlt: '레이어드 보브 커트를 마친 같은 성인 고객의 뒷머리',
    beforeLabel: '커트 전',
    afterLabel: '보브 커트 완료',
    portfolioTitle: '고객의 헤어를 보브 스타일로 완성한 과정',
    websiteLead: '사진 중심 포트폴리오로 담당자의 작업 맥락을 보여주는 구성',
    tone: '#735443',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '이번 스타일을 기록하고', detail: '요청과 작업 과정을 한 건의 이력으로 남깁니다.' },
      { id: 'confirm', label: '확인', startsAt: 6.2, title: '고객 확인까지 한 흐름으로', detail: '완성 확인은 결제 상태와 분명하게 나눕니다.' },
      { id: 'grow', label: '성장', startsAt: 9.3, title: '동의된 스타일을 포트폴리오로', detail: '다음 방문에도 이어지는 브랜드 기록을 준비합니다.' },
    ],
  },
  installation: {
    id: 'installation',
    label: '설치·수리',
    shortLabel: '가전·가구·설비 작업',
    business: '바른 설치',
    service: '거실 벽 선반 설치',
    sourceType: 'licensed-staged-footage',
    visualSourceType: 'ai-generated-staged-image',
    disclosureText: 'AI로 제작한 업종 맞춤 전후 예시 · 실제 고객 사례가 아닙니다.',
    pairId: 'installation-shelf-aligned-generated-v2',
    desktopVideo: `${base}/installation/hero-desktop.mp4`,
    mobileVideo: `${base}/installation/hero-mobile.mp4`,
    desktopPoster: `${base}/industry-aligned/installation-after.webp`,
    mobilePoster: `${base}/industry-aligned/installation-after.webp`,
    beforeImage: `${base}/industry-aligned/installation-before.webp`,
    afterImage: `${base}/industry-aligned/installation-after.webp`,
    thumbnail: `${base}/industry-aligned/installation-after.webp`,
    beforeAlt: '벽 선반 설치 전 부품과 공구가 놓인 같은 거실 벽',
    afterAlt: '수평을 맞춘 벽 선반 설치를 마친 같은 거실 벽',
    beforeLabel: '설치 준비',
    afterLabel: '선반 설치 완료',
    portfolioTitle: '거실 벽 선반을 정확하게 설치한 과정',
    websiteLead: '서비스 범위와 작업 단계를 명확하게 설명하는 완료 기록형 구성',
    tone: '#3f5368',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '작업 위치와 부재를 남기고', detail: '설치 전 준비와 작업 범위를 먼저 기록합니다.' },
      { id: 'confirm', label: '확인', startsAt: 6.2, title: '과정과 결과를 함께 확인', detail: '확인과 보완 요청을 같은 버전에 연결합니다.' },
      { id: 'grow', label: '성장', startsAt: 9.3, title: '완료 기록을 다음 상담 자료로', detail: '검토된 자료만 사례 후보로 준비합니다.' },
    ],
  },
};

export const CORE_INDUSTRIES = Object.keys(INDUSTRY_MEDIA) as CoreIndustry[];

export function isCoreIndustry(value: string): value is CoreIndustry {
  return value in INDUSTRY_MEDIA;
}

export function getIndustryMedia(value: string): IndustryMedia {
  return isCoreIndustry(value) ? INDUSTRY_MEDIA[value] : INDUSTRY_MEDIA.cleaning;
}

export function getChapterAtTime(media: IndustryMedia, currentTime: number): HeroChapter {
  return [...media.chapters].reverse().find((chapter) => currentTime >= chapter.startsAt) ?? media.chapters[0];
}
