import { BUSINESS_INFO } from '@/shared/lib/siteConfig';

export type MybiLayoutMode = 'floating' | 'hero';
export type MybiSurfaceMode = 'compact' | 'default' | 'expressive';
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
  quietMode?: boolean;
  routeLabel?: string;
  selectedHighlights?: string[];
  stepIndex: number;
  stepLabel?: string;
  storeLabel?: string;
  surfaceMode?: MybiSurfaceMode;
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

  return `지금 입력 흐름에서 중요하게 보고 있는 축은 ${highlights.join(', ')}입니다.`;
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

function isFormHeavyPath(pathname: string) {
  return (
    pathname === '/onboarding' ||
    pathname === '/billing' ||
    /^\/s\/[^/]+\/(?:inquiry|reservation|waiting)(?:\/|$)/.test(pathname) ||
    /^\/s\/[^/]+\/survey\/[^/]+(?:\/|$)/.test(pathname) ||
    /^\/(?:store\/[^/]+|[^/]+)\/order(?:\/|$)/.test(pathname)
  );
}

export function buildSceneFallback(pathname: string): MybiSceneState {
  if (pathname === '/') {
    return {
      companionMode: 'hero',
      contextSummary: '공개 유입이 들어오면 문의, 예약, 웨이팅, 주문 같은 채널을 따라 고객 기억 축이 형성됩니다.',
      layoutMode: 'hero',
      meaning: '지금 보이는 월드는 MyBiz의 공개 유입, 고객 기억, AI 운영 제안 구조를 한 화면으로 보여주는 메인 엔진입니다.',
      memoryNote: '방문 이력, 문의 내용, 예약 상태, 주문 흐름이 고객 타임라인으로 쌓이고 AI는 그 위에서 요약, 분류, 추천, 리포트를 만듭니다.',
      nextAction: '무료 진단을 시작하면 같은 세계가 MYBI 동반자 모드로 이어지면서 현재 단계에 맞게 반응합니다.',
      planLabel: '무료 진단',
      pulseKey: 0,
      quietMode: false,
      routeLabel: '랜딩 히어로',
      selectedHighlights: ['공개 유입', '고객 기억 축', 'AI 운영 제안'],
      surfaceMode: 'expressive',
      stepIndex: 0,
      stepLabel: '01 스토어 / 공개 유입',
      title: 'MYBI 히어로',
    };
  }

  if (pathname === '/pricing') {
    return {
      companionMode: 'floating-guide',
      contextSummary: '플랜 비교는 단순 가격표가 아니라 어떤 입력 채널과 고객 기억 깊이를 쓸지 결정하는 단계입니다.',
      layoutMode: 'floating',
      meaning: '요금 화면에서는 FREE, PRO, VIP가 고객 입력 채널과 운영 깊이에 따라 어떻게 달라지는지 정리합니다.',
      memoryNote: 'MyBiz는 일반 챗봇이 아니라 고객 기억 축을 기반으로 움직이는 운영 시스템입니다.',
      nextAction: '지금 필요한 채널이 공개 유입인지, 문의·예약·웨이팅인지, 더 깊은 운영 리포트인지 먼저 정해주세요.',
      planLabel: '플랜 비교',
      pulseKey: 0,
      routeLabel: '요금제',
      selectedHighlights: ['공개 유입', '고객 기억 축', '운영 리포트'],
      surfaceMode: 'default',
      stepIndex: 3,
      stepLabel: '04 다음 액션 제안',
      title: 'MYBI 플랜 안내',
    };
  }

  if (isFormHeavyPath(pathname)) {
    return {
      companionMode: 'floating-guide',
      contextSummary: '입력 흐름을 가리지 않게 MYBI가 작은 orb 상태로 대기하고, 필요할 때만 눌러서 도움을 여는 화면입니다.',
      layoutMode: 'floating',
      meaning: 'MYBI는 지금 가리기보다 입력 흐름을 지켜보는 보조 모드로 조용히 대기하고 있습니다.',
      memoryNote: '활성 입력 필드, CTA, 오류 배너를 피해 조용히 옆에 머물다가, 클릭하거나 물어보면 바로 도와드립니다.',
      nextAction: '도움이 필요하면 MYBI를 눌러 대화를 열고, 지금은 입력 흐름을 그대로 이어가면 됩니다.',
      planLabel: '입력 보조',
      pulseKey: 0,
      quietMode: true,
      routeLabel: '입력 / 설정 화면',
      selectedHighlights: ['입력 흐름', 'CTA', '오류 대응'],
      surfaceMode: 'compact',
      stepIndex: 0,
      stepLabel: '01 입력 보조',
      title: 'MYBI 컴팩트',
    };
  }

  return {
    companionMode: 'floating-guide',
    contextSummary: 'MYBI는 현재 화면과 최근 입력을 기준으로 어떤 정보가 고객 기억으로 쌓이는지 설명합니다.',
    layoutMode: 'floating',
    meaning: 'MYBI는 현재 맥락 가까이에서 계속 살아 있는 운영 동반자입니다.',
    memoryNote: '문의, 예약, 웨이팅, 주문이 고객 기억 축을 만들고 AI는 그 위에서 다음 행동을 제안합니다.',
    nextAction: '현재 단계에서 어떤 입력이 쌓이고 다음에 무엇을 해야 하는지 함께 확인해보세요.',
    planLabel: '안내 중',
    pulseKey: 0,
    quietMode: false,
    routeLabel: '공개 화면',
    selectedHighlights: ['고객 기억 축'],
    surfaceMode: 'default',
    stepIndex: 0,
    stepLabel: '01 현재 컨텍스트',
    title: 'MYBI',
  };
}

export function describeMybiStep(stepIndex: number): Partial<MybiSceneState> {
  switch (stepIndex) {
    case 0:
      return {
        changedAfterInput: '첫 공개 유입 신호가 들어오면 스토어의 시작점이 잡힙니다.',
        contextSummary: '지금은 스토어와 공개 유입을 확인하는 시작 단계입니다.',
        meaning: '01단계는 스토어와 공개 유입을 점검하는 단계입니다. 무료 유입이 고객 기억 축으로 들어오는 입구를 여는 시간입니다.',
        memoryNote: '아직 고객 기억 축이 짧더라도 첫 유입 경로를 정확히 잡아야 이후 채널 분기와 운영 판단이 선명해집니다.',
        nextAction: '스토어 맥락을 분명히 하고 inquiry, reservation, waiting, order 중 핵심 채널을 먼저 정하세요.',
        stepLabel: '01 스토어 / 공개 유입',
        title: '01 스토어 / 공개 유입',
      };
    case 1:
      return {
        changedAfterInput: '문의, 예약, 웨이팅 같은 채널이 서로 다른 입력 경로로 갈라지기 시작합니다.',
        contextSummary: '지금 단계에서는 각 입력 채널의 역할을 구분하는 것이 중요합니다.',
        meaning: '02단계는 inquiry, reservation, waiting, order 신호를 수집하고 채널별 목적을 구분하는 단계입니다.',
        memoryNote: '같은 고객 접점이라도 채널에 따라 관심도와 긴급도가 달라지고, 그 차이가 이후 기억 결합 품질을 바꿉니다.',
        nextAction: '어떤 채널이 가장 중요한지 먼저 정리하면 다음 제안이 훨씬 정확해집니다.',
        stepLabel: '02 신호 수집',
        title: '02 신호 수집',
      };
    case 2:
      return {
        changedAfterInput: '분산된 신호가 고객 기억 코어 쪽으로 강하게 모이기 시작했습니다.',
        contextSummary: '지금이 MYBI의 시그니처 장면입니다. 흩어진 입력이 고객 기억 축으로 결합됩니다.',
        meaning: '03단계는 고객 기억 결합 단계입니다. 여러 채널과 타임라인이 하나의 고객 기억 축으로 모입니다.',
        memoryNote: '이 단계가 강해야 AI가 단발성 답변이 아니라 다음 매출 행동으로 이어지는 운영 제안을 만들 수 있습니다.',
        nextAction: '가장 강하게 결합된 신호를 기준으로 다음 공개 액션이나 운영 액션을 하나 선택하세요.',
        stepLabel: '03 고객 기억 결합',
        title: '03 고객 기억 결합',
      };
    case 3:
      return {
        changedAfterInput: '기억 축 위에서 다음 액션과 운영 제안이 추출되기 시작했습니다.',
        contextSummary: '지금은 고객 기억 축 위에 AI 제안이 덧입는 단계입니다.',
        meaning: '04단계는 다음 액션 제안 단계입니다. 고객 기억 축을 바탕으로 실행 가능한 운영 제안이 나옵니다.',
        memoryNote: '기억 축이 충분히 쌓여야 추천이 단순한 자동 문구가 아니라 실제 운영 판단으로 연결됩니다.',
        nextAction: '다음 공개 액션, 후속 메시지, 스토어 생성 요청 중 무엇을 먼저 실행할지 고르세요.',
        stepLabel: '04 다음 액션 제안',
        title: '04 다음 액션 제안',
      };
    default:
      return {
        changedAfterInput: '스토어 셸과 운영 대시보드가 하나의 운영 시스템으로 안정되기 시작했습니다.',
        contextSummary: '입력 채널, 고객 기억, 대시보드가 한 구조로 정착되는 단계입니다.',
        meaning: '05단계는 운영 대시보드 payoff입니다. 스토어 셸과 대시보드가 고객 기억 축 위에 정착합니다.',
        memoryNote: '이제 공개 유입, 입력 채널, 고객 타임라인, AI 운영 레이어가 하나의 시스템으로 연결됩니다.',
        nextAction: '생성된 스토어와 대시보드에서 실제 운영 루프를 시작해보세요.',
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
  const quietHelpLine =
    sceneState.surfaceMode === 'compact'
      ? sceneState.companionMode === 'alert'
        ? '지금은 오류를 같이 보되, 입력 흐름을 가리지 않도록 조용히 옆에서 대기하고 있습니다. 필요하면 눌러서 바로 도움을 받아보세요.'
        : '입력 흐름을 가리지 않도록 작은 orb 상태로 대기하고 있습니다. 필요하면 눌러서 바로 도와드릴게요.'
      : null;
  const lines = [
    `MYBI입니다. ${sceneState.title ? `${sceneState.title} 맥락을 같이 보고 있겠습니다.` : '지금 화면 맥락을 같이 보고 있겠습니다.'}`,
    sceneState.contextSummary || sceneState.meaning || '현재 입력 흐름을 기준으로 짧고 정확하게 안내드릴게요.',
    contextLine(sceneState),
    highlightLine(sceneState),
    quietHelpLine,
    sceneState.nextAction ? `바로 이어지는 일은 ${sceneState.nextAction}` : null,
  ].filter(Boolean);

  return lines.join(' ');
}

export function buildGuideReply(question: string, sceneState: MybiSceneState, recentActivity: string[]) {
  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return sceneState.meaning || '현재 단계에서 하는 일을 먼저 짧게 정리해드릴게요.';
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

  if (includesAny(normalized, ['왜', '질문', '필요', '이유'])) {
    return [
      '이 질문을 하는 이유는 입력 하나가 단순한 값이 아니라 고객 기억 축의 품질을 바꾸기 때문입니다.',
      highlightLine(sceneState),
      sceneState.memoryNote,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['다음', 'next', '무엇', '해야', '진행'])) {
    return [
      sceneState.nextAction || '다음 액션을 짧게 정리해드릴게요.',
      sceneState.planLabel ? `${sceneState.planLabel} 기준으로 이어지는 흐름도 함께 보고 있습니다.` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['기억', 'memory', 'timeline', '고객'])) {
    return [
      sceneState.memoryNote || '고객과 타임라인 정보가 고객 기억 축을 만듭니다.',
      sceneState.changedAfterInput,
      highlightLine(sceneState),
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (includesAny(normalized, ['문의', 'inquiry'])) {
    return '문의는 가장 빠르게 관심도를 보여주는 채널입니다. 첫 관심 신호를 고객 기억 축에 남기고 후속 응대의 기준을 만들 수 있습니다.';
  }

  if (includesAny(normalized, ['예약', 'reservation'])) {
    return '예약은 구매 의도가 더 또렷한 채널입니다. 날짜와 인원, 방문 의도를 함께 받아야 다음 운영 판단이 정확해집니다.';
  }

  if (includesAny(normalized, ['웨이팅', 'waiting', '대기'])) {
    return '웨이팅은 현장 수요와 이탈 위험을 동시에 보여주는 채널입니다. 대기 흐름을 고객 기억에 남겨야 반복 방문 설계가 쉬워집니다.';
  }

  if (includesAny(normalized, ['문제', '오류', 'issue', 'error', 'bug'])) {
    if (sceneState.companionMode === 'alert' || sceneState.surfaceMode === 'compact') {
      return [
        '지금은 오류 문구와 현재 단계 기준으로 먼저 원인을 같이 좁혀볼게요.',
        '입력 흐름을 막지 않도록 조용히 대기하다가, 원하시면 문제 제보 탭까지 바로 이어드릴 수 있습니다.',
        sceneState.nextAction,
      ]
        .filter(Boolean)
        .join(' ');
    }

    return '문제 제보 탭에서는 현재 경로, 단계, 최근 액션, 브라우저 오류, 스크린샷 여부를 함께 검토하고 확인 후 직접 보내도록 도와드립니다.';
  }

  return [
    sceneState.contextSummary || sceneState.meaning || '현재 맥락 기준으로 답변드릴게요.',
    contextLine(sceneState),
    recentActivity[0] ? `최근 액션은 "${recentActivity[0]}" 입니다.` : null,
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
    '[방금 반영된 내용]',
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
