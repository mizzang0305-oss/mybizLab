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
    service: '패브릭 의자 클리닝 시연',
    sourceType: 'licensed-staged-footage',
    disclosureText: '사용권을 확인한 연출 영상 · 실제 고객 사례가 아닙니다.',
    pairId: 'cleaning-sofa-cc-by-sa-4',
    desktopVideo: `${base}/cleaning/hero-desktop.mp4`,
    mobileVideo: `${base}/cleaning/hero-mobile.mp4`,
    desktopPoster: `${base}/cleaning/poster-desktop.webp`,
    mobilePoster: `${base}/cleaning/poster-mobile.webp`,
    beforeImage: `${base}/cleaning/before.webp`,
    afterImage: `${base}/cleaning/after.webp`,
    thumbnail: `${base}/cleaning/thumbnail.webp`,
    beforeAlt: '클리닝 작업을 시작하기 전 같은 패브릭 의자의 표면',
    afterAlt: '같은 의자 표면을 브러시로 정리한 직후의 상태',
    beforeLabel: '브러시 작업 전',
    afterLabel: '같은 면 작업 후',
    portfolioTitle: '패브릭 의자를 정리한 과정',
    websiteLead: '작업 범위와 전후 기록을 한눈에 보여주는 사례형 구성',
    tone: '#31545a',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '작업 전 상태를 남기고', detail: '같은 의자의 표면과 작업 범위를 기록합니다.' },
      { id: 'confirm', label: '확인', startsAt: 6.2, title: '고객이 결과를 확인', detail: '완료 확인과 보완 요청을 결제와 분리합니다.' },
      { id: 'grow', label: '성장', startsAt: 9.3, title: '승인된 작업을 사례 후보로', detail: '별도 동의와 업체 검토를 거친 버전만 연결합니다.' },
    ],
  },
  hair: {
    id: 'hair',
    label: '미용실',
    shortLabel: '커트·펌·염색·포트폴리오',
    business: '결 헤어',
    service: '스타일링 연습 모델 시연',
    sourceType: 'licensed-staged-footage',
    disclosureText: '사용권을 확인한 연습 모델 영상 · 실제 고객 사례가 아닙니다.',
    pairId: 'hair-practice-model-cc-by-4',
    desktopVideo: `${base}/hair/hero-desktop.mp4`,
    mobileVideo: `${base}/hair/hero-mobile.mp4`,
    desktopPoster: `${base}/hair/poster-desktop.webp`,
    mobilePoster: `${base}/hair/poster-mobile.webp`,
    beforeImage: `${base}/hair/before.webp`,
    afterImage: `${base}/hair/after.webp`,
    thumbnail: `${base}/hair/thumbnail.webp`,
    beforeAlt: '스타일링을 시작하기 전 같은 연습 모델의 머리',
    afterAlt: '같은 연습 모델의 머리를 손과 빗으로 정돈한 상태',
    beforeLabel: '정돈 전',
    afterLabel: '스타일링 후',
    portfolioTitle: '결과와 과정을 함께 남긴 스타일링',
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
    service: '맞춤 선반 가공 시연',
    sourceType: 'licensed-staged-footage',
    disclosureText: '사용권을 확인한 목공 작업 영상 · 실제 고객 사례가 아닙니다.',
    pairId: 'installation-shelf-prep-cc-by-sa-4',
    desktopVideo: `${base}/installation/hero-desktop.mp4`,
    mobileVideo: `${base}/installation/hero-mobile.mp4`,
    desktopPoster: `${base}/installation/poster-desktop.webp`,
    mobilePoster: `${base}/installation/poster-mobile.webp`,
    beforeImage: `${base}/installation/before.webp`,
    afterImage: `${base}/installation/after.webp`,
    thumbnail: `${base}/installation/thumbnail.webp`,
    beforeAlt: '같은 작업대에서 맞춤 선반 목재를 가공하기 전 상태',
    afterAlt: '같은 작업대에서 절단 위치를 맞춰 가공한 직후 상태',
    beforeLabel: '가공 전',
    afterLabel: '같은 부재 가공 후',
    portfolioTitle: '현장 설치 전, 맞춤 부재를 준비한 과정',
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
