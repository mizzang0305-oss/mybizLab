export type ServiceIndustry = 'cleaning' | 'hair' | 'installation' | 'wig' | 'interior';
export type HeroVideoIndustry = 'cleaning' | 'hair' | 'installation';
export type ExtendedVisualIndustry = 'wig' | 'interior';

export type HeroChapterId = 'record' | 'confirm' | 'grow';

export interface HeroChapter {
  id: HeroChapterId;
  label: string;
  startsAt: number;
  title: string;
  detail: string;
}

interface PairValidation {
  sameSubject: true;
  sameLocation: true;
  sameCamera: true;
  sameStructure: true;
}

interface BaseIndustryMedia {
  id: ServiceIndustry;
  label: string;
  shortLabel: string;
  business: string;
  service: string;
  visualSourceType: 'ai-generated-staged-image';
  synthetic: true;
  actualCustomer: false;
  disclosureText: string;
  videoDisclosureText: string;
  pairId: string;
  pairValidation: PairValidation;
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
  websiteHero: string;
  websiteLead: string;
  websiteServices: readonly string[];
  tone: string;
}

export interface HeroVideoMedia extends BaseIndustryMedia {
  id: HeroVideoIndustry;
  videoStatus: 'available';
  sourceType: 'licensed-staged-footage';
  desktopVideo: string;
  mobileVideo: string;
  durationSeconds: number;
  chapters: readonly HeroChapter[];
}

export interface StillIndustryMedia extends BaseIndustryMedia {
  id: ExtendedVisualIndustry;
  videoStatus: 'not-available-yet';
  sourceType: 'not-available-yet';
  desktopVideo: null;
  mobileVideo: null;
  durationSeconds: null;
  chapters: readonly [];
  medicalClaim?: false;
  actualProject?: false;
}

export type IndustryMedia = HeroVideoMedia | StillIndustryMedia;

const base = '/media/mybiz-stage2';
const aligned = `${base}/industry-aligned`;
const pairValidation: PairValidation = { sameSubject: true, sameLocation: true, sameCamera: true, sameStructure: true };

export const INDUSTRY_MEDIA: Record<ServiceIndustry, IndustryMedia> = {
  cleaning: {
    id: 'cleaning',
    label: '청소',
    shortLabel: '소파·패브릭 전문 청소',
    business: '클린 스튜디오',
    service: '소파 패브릭 클리닝',
    videoStatus: 'available',
    sourceType: 'licensed-staged-footage',
    visualSourceType: 'ai-generated-staged-image',
    synthetic: true,
    actualCustomer: false,
    disclosureText: 'AI 생성 청소 연출 예시 · 실제 고객 사례가 아닙니다.',
    videoDisclosureText: '라이선스 공정 참고 영상 · 실제 고객 작업이 아닙니다.',
    pairId: 'cleaning-sofa-generated-v3',
    pairValidation,
    desktopVideo: `${base}/cleaning/hero-desktop.mp4`,
    mobileVideo: `${base}/cleaning/hero-mobile.mp4`,
    desktopPoster: `${aligned}/cleaning-sofa-after-v3.webp`,
    mobilePoster: `${aligned}/cleaning-sofa-after-v3.webp`,
    beforeImage: `${aligned}/cleaning-sofa-before-v3.webp`,
    afterImage: `${aligned}/cleaning-sofa-after-v3.webp`,
    thumbnail: `${aligned}/cleaning-sofa-after-v3.webp`,
    beforeAlt: '패브릭 클리닝 전 생활 얼룩이 남은 같은 베이지색 소파',
    afterAlt: '패브릭 클리닝을 마쳐 표면이 정돈된 같은 베이지색 소파',
    beforeLabel: '클리닝 전',
    afterLabel: '패브릭 정돈 완료',
    portfolioTitle: '같은 소파의 생활 얼룩을 정돈한 패브릭 클리닝',
    websiteHero: '생활 공간의 패브릭을 깔끔하게',
    websiteLead: '작업 범위와 같은 대상의 전후 기록을 한눈에 보여주는 사례형 구성',
    websiteServices: ['소파 클리닝', '패브릭 케어', '방문 작업 기록'],
    tone: '#31545a',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '소파의 작업 전 상태를 남기고', detail: '같은 패브릭의 오염 상태와 작업 범위를 기록합니다.' },
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
    videoStatus: 'available',
    sourceType: 'licensed-staged-footage',
    visualSourceType: 'ai-generated-staged-image',
    synthetic: true,
    actualCustomer: false,
    disclosureText: 'AI 생성 헤어 연출 예시 · 실제 고객 사례가 아닙니다.',
    videoDisclosureText: '라이선스 커트 공정 참고 영상 · 실제 고객 작업이 아닙니다.',
    pairId: 'hair-bob-generated-v3',
    pairValidation,
    desktopVideo: `${base}/hair/hero-desktop.mp4`,
    mobileVideo: `${base}/hair/hero-mobile.mp4`,
    desktopPoster: `${aligned}/hair-after.webp`,
    mobilePoster: `${aligned}/hair-after.webp`,
    beforeImage: `${aligned}/hair-before.webp`,
    afterImage: `${aligned}/hair-after.webp`,
    thumbnail: `${aligned}/hair-after.webp`,
    beforeAlt: '커트 전 긴 머리를 한 같은 성인 모델의 뒷모습',
    afterAlt: '레이어드 보브 커트를 마친 같은 성인 모델의 뒷모습',
    beforeLabel: '커트 전 스타일',
    afterLabel: '보브 커트 완료',
    portfolioTitle: '긴 머리를 레이어드 보브로 완성한 스타일 기록',
    websiteHero: '원하는 분위기를 완성하는 헤어 디자인',
    websiteLead: '스타일 포트폴리오와 담당자의 작업 맥락을 보여주는 구성',
    websiteServices: ['디자인 커트', '컬러·펌', '스타일 포트폴리오'],
    tone: '#735443',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '이번 스타일을 기록하고', detail: '요청과 커트 공정을 한 건의 이력으로 남깁니다.' },
      { id: 'confirm', label: '확인', startsAt: 6.2, title: '고객 확인까지 한 흐름으로', detail: '완성 확인은 결제 상태와 분명하게 나눕니다.' },
      { id: 'grow', label: '성장', startsAt: 9.3, title: '동의된 스타일을 포트폴리오로', detail: '다음 방문에도 이어지는 브랜드 기록을 준비합니다.' },
    ],
  },
  installation: {
    id: 'installation',
    label: '설치·수리',
    shortLabel: '가전·가구·설비 작업',
    business: '바른 설치',
    service: '맞춤 벽 선반 제작·설치',
    videoStatus: 'available',
    sourceType: 'licensed-staged-footage',
    visualSourceType: 'ai-generated-staged-image',
    synthetic: true,
    actualCustomer: false,
    disclosureText: 'AI 생성 설치 연출 예시 · 실제 고객 사례가 아닙니다.',
    videoDisclosureText: '라이선스 목재 가공 참고 영상 · 실제 고객 작업이 아닙니다.',
    pairId: 'installation-shelf-generated-v3',
    pairValidation,
    desktopVideo: `${base}/installation/hero-desktop.mp4`,
    mobileVideo: `${base}/installation/hero-mobile.mp4`,
    desktopPoster: `${aligned}/installation-after.webp`,
    mobilePoster: `${aligned}/installation-after.webp`,
    beforeImage: `${aligned}/installation-before.webp`,
    afterImage: `${aligned}/installation-after.webp`,
    thumbnail: `${aligned}/installation-after.webp`,
    beforeAlt: '맞춤 선반 설치 전 부품과 공구가 놓인 같은 거실 벽',
    afterAlt: '맞춤 벽 선반 설치를 마친 같은 거실 벽',
    beforeLabel: '제작·설치 준비',
    afterLabel: '선반 설치 완료',
    portfolioTitle: '맞춤 제작한 거실 벽 선반의 설치 완료 기록',
    websiteHero: '제작부터 설치까지 정확하게',
    websiteLead: '제작 공정과 설치 결과를 함께 설명하는 완료 작업 기록형 구성',
    websiteServices: ['맞춤 선반 제작', '가구 설치', '현장 마감 확인'],
    tone: '#3f5368',
    durationSeconds: 12,
    chapters: [
      { id: 'record', label: '기록', startsAt: 0, title: '목재 가공과 설치 준비를 남기고', detail: '선반 제작 공정과 작업 범위를 먼저 기록합니다.' },
      { id: 'confirm', label: '확인', startsAt: 6.2, title: '과정과 결과를 함께 확인', detail: '확인과 보완 요청을 같은 버전에 연결합니다.' },
      { id: 'grow', label: '성장', startsAt: 9.3, title: '완료 기록을 다음 상담 자료로', detail: '검토된 자료만 사례 후보로 준비합니다.' },
    ],
  },
  wig: {
    id: 'wig',
    label: '가발·두피',
    shortLabel: '부분가발·맞춤가발·스타일 피팅',
    business: 'Atelier Hair Piece',
    service: '맞춤 부분가발 피팅',
    videoStatus: 'not-available-yet',
    sourceType: 'not-available-yet',
    visualSourceType: 'ai-generated-staged-image',
    synthetic: true,
    actualCustomer: false,
    medicalClaim: false,
    disclosureText: 'AI 생성 가발 피팅 예시 · 치료 결과가 아닙니다.',
    videoDisclosureText: '전용 영상 준비 중 · 다른 업종 영상을 재사용하지 않습니다.',
    pairId: 'wig-fitting-generated-v1',
    pairValidation,
    desktopVideo: null,
    mobileVideo: null,
    desktopPoster: `${aligned}/wig-after-v1.webp`,
    mobilePoster: `${aligned}/wig-after-v1.webp`,
    beforeImage: `${aligned}/wig-before-v1.webp`,
    afterImage: `${aligned}/wig-after-v1.webp`,
    thumbnail: `${aligned}/wig-after-v1.webp`,
    beforeAlt: '맞춤 가발 피팅 전 같은 성인 모델의 뒷머리',
    afterAlt: '맞춤 부분가발 피팅을 마친 같은 성인 모델의 뒷머리',
    beforeLabel: '착용 전 스타일',
    afterLabel: '맞춤 가발 피팅 완료',
    portfolioTitle: '스타일에 맞춰 자연스럽게 완성한 맞춤 가발 피팅',
    websiteHero: '자연스러운 스타일을 위한 맞춤 가발 피팅',
    websiteLead: '비의료적 피팅 과정과 스타일 전후를 존중 있게 보여주는 포트폴리오 구성',
    websiteServices: ['부분가발', '맞춤가발', '스타일 피팅'],
    tone: '#665447',
    durationSeconds: null,
    chapters: [],
  },
  interior: {
    id: 'interior',
    label: '인테리어',
    shortLabel: '거실 리뉴얼·부분 인테리어·마감',
    business: 'Layer Space',
    service: '거실 부분 인테리어',
    videoStatus: 'not-available-yet',
    sourceType: 'not-available-yet',
    visualSourceType: 'ai-generated-staged-image',
    synthetic: true,
    actualCustomer: false,
    actualProject: false,
    disclosureText: 'AI 생성 인테리어 연출 예시 · 실제 시공 사례가 아닙니다.',
    videoDisclosureText: '전용 영상 준비 중 · 다른 업종 영상을 재사용하지 않습니다.',
    pairId: 'interior-livingroom-generated-v1',
    pairValidation,
    desktopVideo: null,
    mobileVideo: null,
    desktopPoster: `${aligned}/interior-after-v1.webp`,
    mobilePoster: `${aligned}/interior-after-v1.webp`,
    beforeImage: `${aligned}/interior-before-v1.webp`,
    afterImage: `${aligned}/interior-after-v1.webp`,
    thumbnail: `${aligned}/interior-after-v1.webp`,
    beforeAlt: '거실 리뉴얼 전 같은 구조와 창문을 가진 공간',
    afterAlt: '거실 리뉴얼을 마친 같은 구조와 창문을 가진 공간',
    beforeLabel: '리뉴얼 전 공간',
    afterLabel: '공간 리뉴얼 완료',
    portfolioTitle: '기존 공간의 분위기를 바꾼 거실 리뉴얼',
    websiteHero: '기존 공간을 더 쓰기 좋은 공간으로',
    websiteLead: '동일 공간의 전후와 마감 범위를 명확히 보여주는 리뉴얼 사례 구성',
    websiteServices: ['거실 리뉴얼', '부분 인테리어', '마감 시공'],
    tone: '#53604f',
    durationSeconds: null,
    chapters: [],
  },
};

export const SERVICE_INDUSTRIES: ServiceIndustry[] = ['cleaning', 'hair', 'installation', 'wig', 'interior'];
export const HERO_VIDEO_INDUSTRIES: HeroVideoIndustry[] = ['cleaning', 'hair', 'installation'];

export function isServiceIndustry(value: string): value is ServiceIndustry {
  return value in INDUSTRY_MEDIA;
}

export function getIndustryMedia(value: string): IndustryMedia {
  return isServiceIndustry(value) ? INDUSTRY_MEDIA[value] : INDUSTRY_MEDIA.cleaning;
}

export function hasHeroVideo(media: IndustryMedia): media is HeroVideoMedia {
  return media.videoStatus === 'available';
}

export function getChapterAtTime(media: HeroVideoMedia, currentTime: number): HeroChapter {
  return [...media.chapters].reverse().find((chapter) => currentTime >= chapter.startsAt) ?? media.chapters[0];
}
