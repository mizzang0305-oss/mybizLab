import type { MotionKind } from './motionRuntime';

export interface MotionCatalogItem {
  id: string;
  kind: MotionKind;
  name: string;
  description: string;
  useCases: readonly string[];
  poster: string;
  video: string;
  version: '0.1.0';
  origin: 'original-local-pilot';
  release: 'candidate';
  priceLabel: '적용 범위 확인 후 견적';
}
// Build-time snapshot, not a claimed live MINZ DESIGN FACTORY connection.
// Promote only after exact-app Preview, license and media provenance review.
export const MOTION_CATALOG: readonly MotionCatalogItem[] = [
  {
    id: 'soft-spotlight', kind: 'spotlight', name: 'Soft Spotlight',
    description: '소개 카드 위로 은은한 빛이 따라옵니다. 콘텐츠는 모션 없이도 모두 읽을 수 있습니다.',
    useCases: ['브랜드 소개', 'SaaS 랜딩', '서비스 카드'],
    poster: '/media/motion/soft-spotlight.webp', video: '/media/motion/soft-spotlight.mp4',
    version: '0.1.0', origin: 'original-local-pilot', release: 'candidate', priceLabel: '적용 범위 확인 후 견적',
  },
  {
    id: 'magnetic-cta', kind: 'magnetic', name: 'Magnetic CTA',
    description: '클릭 영역을 움직이지 않고 버튼의 글자만 반응시킵니다. 마우스와 키보드로 체험하세요.',
    useCases: ['홈페이지 문의', '랜딩 CTA', '브랜드 캠페인'],
    poster: '/media/motion/magnetic-cta.webp', video: '/media/motion/magnetic-cta.mp4',
    version: '0.1.0', origin: 'original-local-pilot', release: 'candidate', priceLabel: '적용 범위 확인 후 견적',
  },
  {
    id: 'editorial-reveal', kind: 'reveal', name: 'Editorial Reveal',
    description: '짧은 문장을 차례대로 드러냅니다. 자동 반복 없이 고객이 재생을 선택합니다.',
    useCases: ['메인 카피', '브랜드 스토리', '제품 소개'],
    poster: '/media/motion/editorial-reveal.webp', video: '/media/motion/editorial-reveal.mp4',
    version: '0.1.0', origin: 'original-local-pilot', release: 'candidate', priceLabel: '적용 범위 확인 후 견적',
  },
];

export function getMotionSelectionSummary(id: string | undefined): string {
  const motion = MOTION_CATALOG.find((item) => item.id === id);
  return motion ? `홈페이지 구축 / ${motion.name} / ${motion.id}@${motion.version}` : '';
}
