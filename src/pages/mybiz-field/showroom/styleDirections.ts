// MyBiz-owned Preview presentation of two version-pinned Factory metadata
// references. No Factory component source, third-party media, or live sync.
export const STYLE_DIRECTIONS = [
  {
    id: 'quiet-editorial', version: '0.1.0', name: 'Quiet Editorial',
    referenceId: 'dna_minz_mind_001',
    description: '콘텐츠 한 가지에 시선을 모으고, 여백과 차분한 리듬으로 읽기 쉽게 구성합니다.',
    sample: '스토리·포트폴리오 중심 홈페이지',
  },
  {
    id: 'ops-precision', version: '0.1.0', name: 'Ops Precision',
    referenceId: 'dna_minz_jarvis_ops_001',
    description: '상태·근거·다음 행동을 명료하게 구분하는 운영형 화면 방향입니다.',
    sample: '업무 시스템·관리자 화면',
  },
] as const;

export type StyleDirectionId = (typeof STYLE_DIRECTIONS)[number]['id'];

export function getStyleDirectionSummary(id: StyleDirectionId | undefined) {
  const direction = STYLE_DIRECTIONS.find((item) => item.id === id);
  return direction ? `디자인 방향 / ${direction.name} / ${direction.id}@${direction.version} (내부 검토)` : '';
}
