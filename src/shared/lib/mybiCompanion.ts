import { BUSINESS_INFO } from '@/shared/lib/siteConfig';

export type MybiLayoutMode = 'floating' | 'hero';
export type MybiCompanionMode =
  | 'alert'
  | 'floating-guide'
  | 'hero'
  | 'listening'
  | 'speaking'
  | 'thinking';

export interface MybiSceneState {
  changedAfterInput?: string;
  companionMode: MybiCompanionMode;
  contextSummary?: string;
  layoutMode: MybiLayoutMode;
  meaning?: string;
  memoryNote?: string;
  nextAction?: string;
  planLabel?: string;
  pulseKey: number;
  routeLabel?: string;
  selectedHighlights?: string[];
  stepIndex: number;
  stepLabel?: string;
  storeLabel?: string;
  title?: string;
}

export interface MybiMailDraftInput {
  browserErrors: string[];
  note: string;
  pathname: string;
  recentActivity: string[];
  reporterEmail: string;
  sceneState: MybiSceneState;
  screenshotName: string | null;
}

function uniqueHighlights(items: string[] | undefined) {
  return [...new Set((items || []).map((item) => item.trim()).filter(Boolean))];
}

function includesAny(question: string, keywords: string[]) {
  return keywords.some((keyword) => question.includes(keyword));
}

function highlightLine(sceneState: MybiSceneState) {
  const highlights = uniqueHighlights(sceneState.selectedHighlights);
  if (!highlights.length) {
    return null;
  }

  return `지금 입력 흐름에서 중요한 축은 ${highlights.join(', ')}입니다.`;
}

function contextLine(sceneState: MybiSceneState) {
  const parts = [
    sceneState.routeLabel ? `화면: ${sceneState.routeLabel}` : null,
    sceneState.stepLabel ? `단계: ${sceneState.stepLabel}` : null,
    sceneState.storeLabel ? `스토어: ${sceneState.storeLabel}` : null,
    sceneState.planLabel ? `플랜: ${sceneState.planLabel}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : null;
}

export function buildSceneFallback(pathname: string): MybiSceneState {
  if (pathname === '/') {
    return {
      companionMode: 'hero',
      contextSummary: '공개 유입이 들어오면 inquiry, reservation, waiting 같은 입력 채널로 이어지고 그 신호가 고객 기억 축으로 쌓입니다.',
      layoutMode: 'hero',
      meaning: '지금 보이는 세계는 MyBiz의 공개 유입, 고객 기억, AI 운영 제안 구조를 한 장면으로 보여주는 메인 엔진입니다.',
      memoryNote: '고객과 타임라인이 고객 기억 축을 만들고, AI는 그 위에서 요약, 분류, 추천, 리포트를 얹습니다.',
      nextAction: '공개 스토어 진단을 시작하면 같은 세계가 계속 살아 있는 상태로 MYBI 동반자로 이어집니다.',
      planLabel: '진단 전',
      pulseKey: 0,
      routeLabel: '랜딩 히어로',
      selectedHighlights: ['공개 유입', '고객 기억 축', 'AI 운영 레이어'],
      stepIndex: 0,
      stepLabel: '01 스토어 / 공개 유입',
      title: 'MYBI 히어로',
    };
  }

  if (pathname === '/pricing') {
    return {
      companionMode: 'floating-guide',
      contextSummary: '플랜 비교에서는 유입 채널의 깊이, 고객 기억 축의 밀도, AI 운영 레이어의 범위를 함께 판단합니다.',
      layoutMode: 'floating',
      meaning: '요금제 화면은 어떤 채널과 어떤 운영 깊이를 선택할지 정리하는 단계입니다.',
      memoryNote: 'MyBiz는 일반 챗봇이 아니라 공개 유입, 입력 채널, 고객 기억 축, 운영 액션이 이어지는 시스템입니다.',
      nextAction: '현재 스토어에 필요한 입력 채널과 기억 축 깊이에 맞는 플랜을 고르세요.',
      planLabel: '플랜 비교',
      pulseKey: 0,
      routeLabel: '요금제',
      selectedHighlights: ['공개 유입', '고객 기억 축', '운영 리포트'],
      stepIndex: 3,
      stepLabel: '04 다음 액션 제안',
      title: 'MYBI 플랜 안내',
    };
  }

  return {
    companionMode: 'floating-guide',
    contextSummary: 'MYBI는 현재 화면의 입력과 반응을 따라다니며, 무엇이 고객 기억으로 쌓이는지 계속 설명합니다.',
    layoutMode: 'floating',
    meaning: 'MYBI는 현재 맥락 근처를 떠다니며 살아 있는 neural world를 유지합니다.',
    memoryNote: '고객과 타임라인이 핵심 기억 축을 만들고, AI는 그 위에서 요약과 추천을 수행합니다.',
    nextAction: '현재 단계에서 어떤 입력이 고객 기억으로 바뀌는지 확인해 보세요.',
    planLabel: '안내 중',
    pulseKey: 0,
    routeLabel: '공개 화면',
    selectedHighlights: ['고객 기억 축'],
    stepIndex: 0,
    stepLabel: '01 현재 컨텍스트',
    title: 'MYBI',
  };
}

export function describeMybiStep(stepIndex: number): Partial<MybiSceneState> {
  switch (stepIndex) {
    case 0:
      return {
        changedAfterInput: '첫 공개 유입 신호가 들어와 MYBI가 스토어의 시작점을 붙잡았습니다.',
        contextSummary: '지금은 스토어와 공개 유입이 연결되는 시작 단계입니다.',
        meaning: '01단계는 스토어와 공개 유입을 확인하는 단계입니다. 무료 유입이 고객 기억 축으로 들어오는 입구를 여는 순간입니다.',
        memoryNote: '아직 고객 기억 축은 성기지만, 첫 신호가 어떤 채널로 들어오는지 확인하면 이후 분기 품질이 달라집니다.',
        nextAction: '스토어 맥락을 분명히 잡아 inquiry, reservation, waiting이 올바르게 갈라지게 하세요.',
        stepLabel: '01 스토어 / 공개 유입',
        title: '01 스토어 / 공개 유입',
      };
    case 1:
      return {
        changedAfterInput: '문의, 예약, 대기 신호가 서로 다른 입력 채널로 갈라지기 시작했습니다.',
        contextSummary: '지금 단계에서는 각 입력 채널의 의도 차이를 드러냅니다.',
        meaning: '02단계는 inquiry, reservation, waiting 신호를 수집하고 채널별 의도를 구분하는 단계입니다.',
        memoryNote: '같은 고객 접점이라도 문의와 예약, 대기는 의도와 긴급도가 달라서 이후 기억 결합 구조가 달라집니다.',
        nextAction: '현재 스토어에서 어떤 채널이 가장 중요한지 정리하면 이후 제안의 정확도가 올라갑니다.',
        stepLabel: '02 신호 수집',
        title: '02 신호 수집',
      };
    case 2:
      return {
        changedAfterInput: '퍼져 있던 신호가 고객 기억 코어 안으로 강하게 수렴하고 있습니다.',
        contextSummary: '지금이 MYBI의 시그니처 장면이며, 분산된 입력이 고객 기억 축으로 합쳐집니다.',
        meaning: '03단계는 고객 기억 결합 단계입니다. 여러 입력 채널과 타임라인이 하나의 기억 축으로 묶입니다.',
        memoryNote: '고객과 타임라인이 이 단계에서 가장 선명한 운영 기억으로 바뀌며, AI는 그 위에서만 의미 있는 추천을 할 수 있습니다.',
        nextAction: '가장 강하게 합쳐진 신호를 기준으로 다음 운영 액션을 뽑아내면 됩니다.',
        stepLabel: '03 고객 기억 결합',
        title: '03 고객 기억 결합',
      };
    case 3:
      return {
        changedAfterInput: '결합된 기억에서 다음 액션과 운영 제안이 추출되기 시작했습니다.',
        contextSummary: '지금은 고객 기억 축 위에 AI 제안이 얹히는 단계입니다.',
        meaning: '04단계는 다음 액션 제안 단계입니다. 기억 축에서 실행안, 추천, 메시지가 뽑혀 나옵니다.',
        memoryNote: '기억 축이 충분히 만들어져야만 AI가 표면적인 답이 아니라 운영 가능한 제안을 줄 수 있습니다.',
        nextAction: '다음 공개 액션, 운영 메시지, 생성 요청 중 무엇을 먼저 실행할지 고르세요.',
        stepLabel: '04 다음 액션 제안',
        title: '04 다음 액션 제안',
      };
    default:
      return {
        changedAfterInput: '스토어 쉘과 운영 대시보드가 안정적으로 자리 잡으며 payoff가 완성되고 있습니다.',
        contextSummary: '입력, 고객 기억, 운영 화면이 하나의 시스템으로 정착하는 단계입니다.',
        meaning: '05단계는 운영 대시보드 payoff입니다. 스토어 쉘과 대시보드가 고객 기억 축 위에 정착합니다.',
        memoryNote: '이제 공개 유입, 입력 채널, 고객 기억 축, AI 운영 레이어가 하나의 구조로 연결됩니다.',
        nextAction: '생성된 스토어나 대시보드를 열고 실제 운영 루프를 이어가세요.',
        stepLabel: '05 운영 대시보드',
        title: '05 운영 대시보드',
      };
  }
}

export function normalizeMybiScene(pathname: string, sceneState: MybiSceneState): MybiSceneState {
  const fallback = buildSceneFallback(pathname);
  const stepInfo = describeMybiStep(sceneState.stepIndex);
  const mergedHighlights = uniqueHighlights([
    ...uniqueHighlights(fallback.selectedHighlights),
    ...uniqueHighlights(stepInfo.selectedHighlights),
    ...uniqueHighlights(sceneState.selectedHighlights),
  ]);

  return {
    ...fallback,
    ...stepInfo,
    ...sceneState,
    changedAfterInput: sceneState.changedAfterInput || stepInfo.changedAfterInput || fallback.changedAfterInput,
    contextSummary: sceneState.contextSummary || stepInfo.contextSummary || fallback.contextSummary,
    meaning: sceneState.meaning || stepInfo.meaning || fallback.meaning,
    memoryNote: sceneState.memoryNote || stepInfo.memoryNote || fallback.memoryNote,
    nextAction: sceneState.nextAction || stepInfo.nextAction || fallback.nextAction,
    routeLabel: sceneState.routeLabel || fallback.routeLabel,
    selectedHighlights: mergedHighlights,
    stepLabel: sceneState.stepLabel || stepInfo.stepLabel || fallback.stepLabel,
    title: sceneState.title || stepInfo.title || fallback.title,
  };
}

export function buildMybiConversationIntro(sceneState: MybiSceneState) {
  const lines = [
    `MYBI입니다. ${sceneState.title ? `${sceneState.title} 흐름을 같이 붙잡고 있겠습니다.` : '지금 보고 있는 흐름을 같이 붙잡고 있겠습니다.'}`,
    sceneState.contextSummary || sceneState.meaning || '현재 입력 맥락을 기준으로 안내드릴게요.',
    contextLine(sceneState),
    highlightLine(sceneState),
    sceneState.nextAction ? `바로 이어질 일은 ${sceneState.nextAction}` : null,
  ].filter(Boolean);

  return lines.join(' ');
}

export function buildGuideReply(question: string, sceneState: MybiSceneState, recentActivity: string[]) {
  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return sceneState.meaning || '현재 단계의 의미부터 차분히 짚어드릴게요.';
  }

  if (includesAny(normalized, ['지금 단계', '현재 단계', 'step', '이 단계'])) {
    return [
      sceneState.meaning,
      sceneState.changedAfterInput ? `방금 반영된 변화는 ${sceneState.changedAfterInput}` : null,
      sceneState.contextSummary,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['왜', '이 질문', '왜 묻', '필요', '이유'])) {
    return [
      '이 질문을 하는 이유는 입력 하나가 단순 폼 값이 아니라 고객 기억 축의 품질을 바꾸기 때문입니다.',
      highlightLine(sceneState),
      sceneState.memoryNote,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['다음', 'next', '무엇', '뭐 하면', '해야', '진행'])) {
    return [
      sceneState.nextAction || '다음 액션을 정리해 드릴게요.',
      sceneState.planLabel ? `${sceneState.planLabel} 기준으로 이어지는 흐름도 함께 보고 있습니다.` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['기억', 'memory', 'timeline', '고객'])) {
    return [
      sceneState.memoryNote || '고객과 타임라인이 고객 기억 축을 만듭니다.',
      sceneState.changedAfterInput,
      highlightLine(sceneState),
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['문의', 'inquiry'])) {
    return '문의는 가장 빠르게 의도를 드러내는 채널입니다. 초기 관심 신호를 고객 기억 축에 기록해 이후 예약 전환과 운영 응대를 정교하게 만듭니다.';
  }

  if (includesAny(normalized, ['예약', 'reservation'])) {
    return '예약은 구매 의도가 가장 진한 채널이라 타임라인 정확도와 실행 우선순위를 함께 끌어올립니다.';
  }

  if (includesAny(normalized, ['대기', 'waiting'])) {
    return '대기 신호는 미뤄진 수요를 보여줍니다. 놓친 타이밍이 매출 손실로 이어지는 지점을 찾는 데 중요합니다.';
  }

  if (includesAny(normalized, ['문제', '오류', 'issue', 'error', 'bug'])) {
    return '문제 제보 탭에서 현재 경로, 단계, 최근 액션, 브라우저 오류, 스크린샷을 함께 검토한 뒤 초안을 열 수 있습니다. 자동 전송은 하지 않습니다.';
  }

  return [
    sceneState.contextSummary || sceneState.meaning || '현재 맥락을 기준으로 답변드릴게요.',
    contextLine(sceneState),
    recentActivity[0] ? `최근 사용자가 건드린 항목은 "${recentActivity[0]}"입니다.` : null,
    highlightLine(sceneState),
    sceneState.nextAction,
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildMybiMailDraft({
  browserErrors,
  note,
  pathname,
  recentActivity,
  reporterEmail,
  sceneState,
  screenshotName,
}: MybiMailDraftInput) {
  const subject = `[MYBI 문제 제보] ${sceneState.title || '현재 단계'} / ${pathname}`;
  const body = [
    'MYBI 문제 제보 초안',
    '',
    `현재 경로: ${pathname}`,
    `현재 화면: ${sceneState.routeLabel || '확인 중'}`,
    `현재 단계: ${sceneState.stepLabel || `${sceneState.stepIndex + 1}단계`}`,
    `모드: ${sceneState.companionMode}`,
    `스토어: ${sceneState.storeLabel || '미확인'}`,
    `플랜: ${sceneState.planLabel || '미확인'}`,
    `최근 액션: ${recentActivity[0] || '없음'}`,
    `회신 이메일: ${reporterEmail || '미입력'}`,
    `스크린샷: ${screenshotName || '첨부 없음'}`,
    '',
    '[이 단계에서 하는 일]',
    sceneState.meaning || '없음',
    '',
    '[고객 기억 축 메모]',
    sceneState.memoryNote || '없음',
    '',
    '[방금 바뀐 내용]',
    sceneState.changedAfterInput || '없음',
    '',
    '[다음 액션]',
    sceneState.nextAction || '없음',
    '',
    '[선택 하이라이트]',
    uniqueHighlights(sceneState.selectedHighlights).join(', ') || '없음',
    '',
    '[브라우저 오류 요약]',
    browserErrors.length ? browserErrors.join('\n') : '없음',
    '',
    '[사용자 메모]',
    note || '없음',
  ].join('\n');

  return {
    body,
    href: `mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    subject,
  };
}

export function getMybiModeTone(mode: MybiCompanionMode) {
  switch (mode) {
    case 'listening':
      return {
        chip: 'border-cyan-200/30 bg-cyan-300/12 text-cyan-100',
        label: '듣는 중',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(96,165,250,0.7)]',
        shellGlow: 'shadow-[0_28px_90px_-48px_rgba(96,165,250,0.78)] ring-cyan-200/16',
      };
    case 'thinking':
      return {
        chip: 'border-violet-200/30 bg-violet-300/12 text-violet-100',
        label: '생각 중',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(168,85,247,0.74)]',
        shellGlow: 'shadow-[0_32px_110px_-52px_rgba(124,58,237,0.82)] ring-violet-200/18',
      };
    case 'speaking':
      return {
        chip: 'border-fuchsia-200/30 bg-fuchsia-300/12 text-fuchsia-100',
        label: '말하는 중',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(232,121,249,0.72)]',
        shellGlow: 'shadow-[0_30px_96px_-48px_rgba(217,70,239,0.78)] ring-fuchsia-200/16',
      };
    case 'alert':
      return {
        chip: 'border-orange-200/40 bg-orange-300/14 text-orange-50',
        label: '알림',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(251,146,60,0.78)]',
        shellGlow: 'shadow-[0_32px_110px_-50px_rgba(249,115,22,0.82)] ring-orange-200/24',
      };
    case 'hero':
      return {
        chip: 'border-white/18 bg-white/[0.08] text-white',
        label: '히어로',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(255,255,255,0.3)]',
        shellGlow: 'shadow-[0_24px_70px_-44px_rgba(255,255,255,0.2)] ring-white/10',
      };
    default:
      return {
        chip: 'border-white/14 bg-white/[0.06] text-white',
        label: '대기 중',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(96,165,250,0.42)]',
        shellGlow: 'shadow-[0_26px_86px_-48px_rgba(148,163,184,0.68)] ring-white/12',
      };
  }
}
