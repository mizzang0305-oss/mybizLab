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
  layoutMode: MybiLayoutMode;
  meaning?: string;
  memoryNote?: string;
  nextAction?: string;
  pulseKey: number;
  stepIndex: number;
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

export function buildSceneFallback(pathname: string): MybiSceneState {
  if (pathname === '/') {
    return {
      companionMode: 'hero',
      layoutMode: 'hero',
      meaning: 'MYBI turns public acquisition into a customer-memory revenue system.',
      memoryNote: 'Public page traffic becomes signals, then inquiry, reservation, and waiting become memory inputs.',
      nextAction: 'Start the public store diagnosis to keep the same world alive as a floating companion.',
      pulseKey: 0,
      stepIndex: 0,
      title: 'MYBI Hero',
    };
  }

  if (pathname === '/pricing') {
    return {
      companionMode: 'floating-guide',
      layoutMode: 'floating',
      meaning: 'Pricing is where capture depth, memory depth, and AI operating layers are selected.',
      memoryNote: 'MyBiz is not a generic chatbot. It is acquisition, capture, memory spine, and operating action.',
      nextAction: 'Compare which plan matches your capture channels and memory depth.',
      pulseKey: 0,
      stepIndex: 3,
      title: 'MYBI Pricing Guide',
    };
  }

  return {
    companionMode: 'floating-guide',
    layoutMode: 'floating',
    meaning: 'MYBI stays near the current context and keeps the live runtime world active.',
    memoryNote: 'Customers plus timeline form the core memory spine. AI sits on top as summary, classification, recommendation, and report.',
    nextAction: 'Follow the current step and check what input will become memory next.',
    pulseKey: 0,
    stepIndex: 0,
    title: 'MYBI',
  };
}

export function describeMybiStep(stepIndex: number) {
  switch (stepIndex) {
    case 0:
      return {
        changedAfterInput: 'The first public arrival signal has been captured.',
        meaning: 'Step 01 is store and public arrival. Acquisition starts here.',
        memoryNote: 'The memory spine is still sparse, so MYBI watches where the first signal lands.',
        nextAction: 'Confirm the store context so inquiry, reservation, and waiting can branch correctly.',
        title: '01 Store / Public Arrival',
      };
    case 1:
      return {
        changedAfterInput: 'Inquiry, reservation, and waiting have started branching into separate input channels.',
        meaning: 'Step 02 organizes capture channels and intent weight.',
        memoryNote: 'Each channel carries a different intent signal, so the later merge logic changes too.',
        nextAction: 'Decide which channel matters most for this store right now.',
        title: '02 Channel Capture',
      };
    case 2:
      return {
        changedAfterInput: 'Distributed signals are pulling inward toward the customer-memory core.',
        meaning: 'Step 03 is the signature memory merge beat.',
        memoryNote: 'Customers plus timeline form the operating memory spine. AI sits above that spine.',
        nextAction: 'Use the strongest merged signal to identify the next operating action.',
        title: '03 Memory Merge',
      };
    case 3:
      return {
        changedAfterInput: 'The next action layer is extracting recommendations from the merged memory.',
        meaning: 'Step 04 translates memory into recommendation and operating action.',
        memoryNote: 'AI becomes useful only after the memory spine has enough signal density.',
        nextAction: 'Lock the next public action, operating message, or request step.',
        title: '04 Next Action',
      };
    default:
      return {
        changedAfterInput: 'The store shell and dashboard payoff are settling into place.',
        meaning: 'Step 05 is the dashboard payoff and operating handoff.',
        memoryNote: 'Input, memory spine, and operating view are now visible as one system.',
        nextAction: 'Open the created store or dashboard and continue the operating loop.',
        title: '05 Dashboard Payoff',
      };
  }
}

export function normalizeMybiScene(pathname: string, sceneState: MybiSceneState): MybiSceneState {
  const fallback = buildSceneFallback(pathname);
  const stepInfo = describeMybiStep(sceneState.stepIndex);

  return {
    ...fallback,
    ...stepInfo,
    ...sceneState,
    changedAfterInput: sceneState.changedAfterInput || stepInfo.changedAfterInput || fallback.changedAfterInput,
    meaning: sceneState.meaning || stepInfo.meaning || fallback.meaning,
    memoryNote: sceneState.memoryNote || stepInfo.memoryNote || fallback.memoryNote,
    nextAction: sceneState.nextAction || stepInfo.nextAction || fallback.nextAction,
    title: sceneState.title || stepInfo.title || fallback.title,
  };
}

export function buildGuideReply(question: string, sceneState: MybiSceneState, recentActivity: string[]) {
  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return sceneState.meaning || 'Check the current step first.';
  }

  if (normalized.includes('inquiry')) {
    return 'Inquiry is the earliest intent-rich channel after public acquisition. MYBI pushes that signal into the memory spine.';
  }

  if (normalized.includes('reservation')) {
    return 'Reservation carries stronger purchase intent, so it sharpens timeline accuracy and operating recommendations.';
  }

  if (normalized.includes('waiting')) {
    return 'Waiting signals show delayed demand. They matter because lost timing often becomes lost revenue.';
  }

  if (normalized.includes('memory') || normalized.includes('timeline') || normalized.includes('customer')) {
    return sceneState.memoryNote || 'Customers plus timeline form the core memory spine.';
  }

  if (normalized.includes('next') || normalized.includes('action')) {
    return sceneState.nextAction || 'Continue to the next operating action.';
  }

  if (normalized.includes('changed')) {
    return sceneState.changedAfterInput || 'MYBI is already reshaping the world around the latest input.';
  }

  if (normalized.includes('issue') || normalized.includes('error') || normalized.includes('problem')) {
    return 'Open the issue tab to review route, recent action, browser errors, and an optional screenshot before sending.';
  }

  return [
    sceneState.meaning || 'MYBI is summarizing the current context.',
    recentActivity[0] ? `Latest visible action: "${recentActivity[0]}".` : null,
    sceneState.nextAction || 'Move to the next action.',
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
  const subject = `[MYBI] ${sceneState.title || 'Companion issue'} / ${pathname}`;
  const body = [
    'MYBI issue review',
    '',
    `Route: ${pathname}`,
    `Mode: ${sceneState.companionMode}`,
    `Step: ${sceneState.stepIndex + 1}`,
    `Title: ${sceneState.title || 'MYBI'}`,
    `Recent action: ${recentActivity[0] || 'none'}`,
    `Reporter email: ${reporterEmail || 'not provided'}`,
    `Screenshot: ${screenshotName || 'not attached'}`,
    '',
    'What this step means:',
    sceneState.meaning || 'n/a',
    '',
    'What changed:',
    sceneState.changedAfterInput || 'n/a',
    '',
    'Next action:',
    sceneState.nextAction || 'n/a',
    '',
    'Browser errors:',
    browserErrors.length ? browserErrors.join('\n') : 'none',
    '',
    'User note:',
    note || 'none',
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
        label: 'Listening',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(96,165,250,0.7)]',
        shellGlow: 'shadow-[0_28px_90px_-48px_rgba(96,165,250,0.78)] ring-cyan-200/16',
      };
    case 'thinking':
      return {
        chip: 'border-violet-200/30 bg-violet-300/12 text-violet-100',
        label: 'Thinking',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(168,85,247,0.74)]',
        shellGlow: 'shadow-[0_32px_110px_-52px_rgba(124,58,237,0.82)] ring-violet-200/18',
      };
    case 'speaking':
      return {
        chip: 'border-fuchsia-200/30 bg-fuchsia-300/12 text-fuchsia-100',
        label: 'Speaking',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(232,121,249,0.72)]',
        shellGlow: 'shadow-[0_30px_96px_-48px_rgba(217,70,239,0.78)] ring-fuchsia-200/16',
      };
    case 'alert':
      return {
        chip: 'border-orange-200/40 bg-orange-300/14 text-orange-50',
        label: 'Alert',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(251,146,60,0.78)]',
        shellGlow: 'shadow-[0_32px_110px_-50px_rgba(249,115,22,0.82)] ring-orange-200/24',
      };
    case 'hero':
      return {
        chip: 'border-white/18 bg-white/[0.08] text-white',
        label: 'Hero',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(255,255,255,0.3)]',
        shellGlow: 'shadow-[0_24px_70px_-44px_rgba(255,255,255,0.2)] ring-white/10',
      };
    default:
      return {
        chip: 'border-white/14 bg-white/[0.06] text-white',
        label: 'Floating Guide',
        panelGlow: 'shadow-[0_34px_100px_-58px_rgba(96,165,250,0.42)]',
        shellGlow: 'shadow-[0_26px_86px_-48px_rgba(148,163,184,0.68)] ring-white/12',
      };
  }
}
