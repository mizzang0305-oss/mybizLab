import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';

import {
  buildGuideReply,
  buildMybiConversationIntro,
  buildMybiMailDraft,
  buildSceneFallback,
  getMybiModeTone,
  normalizeMybiScene,
  type MybiCompanionMode,
  type MybiSceneState,
} from '@/shared/lib/mybiCompanion';
import { sendMybiMessage, type MybiChatMessage } from '@/shared/lib/mybiChatClient';

type MybiPanelTab = 'controls' | 'guide' | 'issue';
type MybiMessageRole = 'assistant' | 'user';

interface PersistentDiagnosisWorldProviderProps {
  active: boolean;
  pathname: string;
}

interface PersistentDiagnosisWorldContextValue {
  registerTarget: (element: HTMLElement | null) => void;
  updateSceneState: (state: MybiSceneState) => void;
}

interface ConversationMessage {
  content: string;
  id: string;
  role: MybiMessageRole;
}

interface PointState {
  left: number;
  top: number;
}

interface RectState {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface FloatingRectInput {
  focusedElement: HTMLElement | null;
  manualHome: PointState | null;
  targetElement: HTMLElement | null;
}

interface FloatingRectResult {
  rect: RectState;
}

const PersistentDiagnosisWorldContext = createContext<PersistentDiagnosisWorldContextValue | null>(null);
const FLOATING_PADDING = 18;
const FLOATING_PANEL_GAP = 18;
const MAX_RECENT_ACTIVITY = 6;
const MOBILE_PANEL_BREAKPOINT = 900;
const THEME_COUNT = 3;
const DRAG_THRESHOLD = 10;
const FLOATING_RIGHT_SWIM_RATIO = 0.76;
const FLOATING_TOP_SWIM_RATIO = 0.2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.5;
}

function rectFromElement(element: HTMLElement): RectState {
  const { height, left, top, width } = element.getBoundingClientRect();
  return { height, left, top, width };
}

function sameRect(current: RectState | null, next: RectState) {
  if (!current) return false;

  return (
    nearlyEqual(current.left, next.left) &&
    nearlyEqual(current.top, next.top) &&
    nearlyEqual(current.width, next.width) &&
    nearlyEqual(current.height, next.height)
  );
}

function intersectionArea(a: RectState, b: RectState) {
  const width = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return width * height;
}

function rectCenterDistance(a: RectState, b: RectState) {
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

function buildViewportRect() {
  if (typeof window === 'undefined') return null;
  return { height: window.innerHeight, left: 0, top: 0, width: window.innerWidth } satisfies RectState;
}

function expandRect(rect: RectState, padding: number): RectState {
  return {
    height: rect.height + padding * 2,
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
  };
}

function getViewportTopInset() {
  if (typeof document === 'undefined') return FLOATING_PADDING;
  const header = document.querySelector<HTMLElement>('header');
  if (!header) return FLOATING_PADDING;
  const rect = rectFromElement(header);
  if (rect.height < 24 || rect.top > 16) return FLOATING_PADDING;
  return Math.max(FLOATING_PADDING, rect.top + rect.height + 12);
}

function pickLabel(element: HTMLElement | null) {
  if (!element) return null;
  const explicit =
    element.dataset.mybiAction ||
    element.dataset.mybiAnchor ||
    element.getAttribute('aria-label') ||
    element.getAttribute('placeholder');
  if (explicit) return explicit.trim();
  const text = element.innerText.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 80) : null;
}

function buildSafeZone(viewport: RectState, size: number) {
  return {
    maxLeft: Math.max(FLOATING_PADDING, viewport.width - size - FLOATING_PADDING),
    maxTop: Math.max(getViewportTopInset(), viewport.height - size - FLOATING_PADDING),
    minLeft: FLOATING_PADDING,
    minTop: getViewportTopInset(),
  };
}

function clampRectToSafeZone(rect: RectState, safeZone: ReturnType<typeof buildSafeZone>) {
  return {
    ...rect,
    left: clamp(rect.left, safeZone.minLeft, safeZone.maxLeft),
    top: clamp(rect.top, safeZone.minTop, safeZone.maxTop),
  };
}

function uniqueRects(rects: RectState[]) {
  return rects.filter(
    (rect, index) =>
      rects.findIndex(
        (candidate) =>
          nearlyEqual(candidate.left, rect.left) &&
          nearlyEqual(candidate.top, rect.top) &&
          nearlyEqual(candidate.width, rect.width) &&
          nearlyEqual(candidate.height, rect.height),
      ) === index,
  );
}

function collectAvoidRects(viewport: RectState, focusedElement: HTMLElement | null) {
  const focusedRect =
    focusedElement && focusedElement.isConnected ? expandRect(rectFromElement(focusedElement), 28) : null;

  const avoidRects = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-mybi-avoid], [data-mybi-important="true"], button, [role="button"], input, textarea, select, a.btn-primary, a.btn-secondary',
    ),
  )
    .filter((element) => !element.closest('[data-mybi-panel="open"]'))
    .map((element) => rectFromElement(element))
    .filter((rect) => rect.width > 44 && rect.height > 24 && intersectionArea(rect, viewport) > rect.width * rect.height * 0.1);

  return {
    avoidRects: focusedRect ? [focusedRect, ...avoidRects] : avoidRects,
    focusedRect,
  };
}

function getFloatingRect({ focusedElement, manualHome, targetElement }: FloatingRectInput): FloatingRectResult | null {
  const viewport = buildViewportRect();
  if (!viewport) return null;

  const size = clamp(
    viewport.width * (viewport.width < 720 ? 0.28 : 0.16),
    viewport.width < 720 ? 132 : 184,
    viewport.width < 720 ? 184 : 272,
  );
  const safeZone = buildSafeZone(viewport, size);
  const anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-mybi-anchor]'));
  const sourceElements = anchors.length ? anchors : [targetElement].filter((element): element is HTMLElement => Boolean(element));
  const { avoidRects, focusedRect } = collectAvoidRects(viewport, focusedElement);
  const swimLane = clampRectToSafeZone(
    {
      height: size,
      left: viewport.width * FLOATING_RIGHT_SWIM_RATIO - size / 2,
      top: viewport.height * FLOATING_TOP_SWIM_RATIO - size / 2,
      width: size,
    },
    safeZone,
  );
  const topSwimZone = clampRectToSafeZone(
    {
      height: size,
      left: viewport.width * 0.62 - size / 2,
      top: viewport.height * 0.16 - size / 2,
      width: size,
    },
    safeZone,
  );

  const anchorRect =
    sourceElements
      .map((element) => rectFromElement(element))
      .filter((rect) => intersectionArea(rect, viewport) > rect.width * rect.height * 0.12)
      .sort((a, b) => {
        if (focusedRect) {
          return rectCenterDistance(a, focusedRect) - rectCenterDistance(b, focusedRect);
        }
        const pivot = viewport.height * 0.42;
        return Math.abs(a.top + a.height * 0.35 - pivot) - Math.abs(b.top + b.height * 0.35 - pivot);
      })[0] || viewport;

  const preferred = manualHome
    ? clampRectToSafeZone({ height: size, left: manualHome.left, top: manualHome.top, width: size }, safeZone)
    : clampRectToSafeZone(
        {
          height: size,
          left: Math.max(anchorRect.left + anchorRect.width - size * 0.1, swimLane.left),
          top: Math.min(anchorRect.top - size * 0.2, swimLane.top),
          width: size,
        },
        safeZone,
      );

  const ambientCandidates = [
    preferred,
    swimLane,
    topSwimZone,
    { ...swimLane, left: swimLane.left + 22, top: swimLane.top + 10 },
    { ...swimLane, left: swimLane.left - 18, top: swimLane.top + 18 },
    { ...swimLane, left: swimLane.left + 12, top: swimLane.top - 14 },
    { ...topSwimZone, left: topSwimZone.left + 26, top: topSwimZone.top + 12 },
    { ...topSwimZone, left: topSwimZone.left - 20, top: topSwimZone.top + 18 },
  ];

  const contextualCandidates = [
    ...ambientCandidates,
    { ...preferred, left: preferred.left + 34, top: preferred.top - 22 },
    { ...preferred, left: preferred.left - 42, top: preferred.top + 16 },
    { ...preferred, left: preferred.left + 14, top: preferred.top + 36 },
    {
      height: size,
      left: anchorRect.left + anchorRect.width + 18,
      top: anchorRect.top + anchorRect.height * 0.08,
      width: size,
    },
    {
      height: size,
      left: anchorRect.left - size - 18,
      top: anchorRect.top + anchorRect.height * 0.08,
      width: size,
    },
    {
      height: size,
      left: anchorRect.left + anchorRect.width - size * 0.22,
      top: anchorRect.top + anchorRect.height - size * 0.32,
      width: size,
    },
    {
      height: size,
      left: viewport.width * (viewport.width < MOBILE_PANEL_BREAKPOINT ? 0.56 : 0.72) - size / 2,
      top: viewport.height * 0.42 - size / 2,
      width: size,
    },
  ];

  const candidateRects = uniqueRects(
    (manualHome || focusedRect ? contextualCandidates : ambientCandidates).map((candidate) =>
      clampRectToSafeZone(candidate, safeZone),
    ),
  );

  const scored = candidateRects.map((candidate) => {
    const overlapPenalty = avoidRects.reduce((total, avoidRect) => total + intersectionArea(candidate, avoidRect), 0);
    const focusedPenalty = focusedRect ? intersectionArea(candidate, focusedRect) * 12 : 0;
    const preferredPenalty = rectCenterDistance(candidate, preferred) * (manualHome ? 0.55 : 0.22);
    const anchorPenalty = rectCenterDistance(candidate, anchorRect) * 0.08;
    const directFocusHit = focusedRect && intersectionArea(candidate, focusedRect) > 0 ? 200_000 : 0;
    const swimLanePenalty = manualHome ? 0 : rectCenterDistance(candidate, swimLane) * 0.18;
    const topSwimPenalty = manualHome ? 0 : rectCenterDistance(candidate, topSwimZone) * 0.2;
    const leftDriftPenalty =
      manualHome ? 0 : Math.max(0, viewport.width * 0.6 - (candidate.left + candidate.width / 2)) * 0.9;
    const lowerBandPenalty = manualHome ? 0 : Math.max(0, candidate.top - viewport.height * 0.28) * 0.8;

    return {
      rect: candidate,
      score:
        overlapPenalty +
        focusedPenalty +
        preferredPenalty +
        anchorPenalty +
        directFocusHit +
        swimLanePenalty +
        topSwimPenalty +
        leftDriftPenalty +
        lowerBandPenalty,
    };
  });

  return scored.sort((a, b) => a.score - b.score)[0] || null;
}

function postToWorld(iframe: HTMLIFrameElement | null, type: string, payload: unknown) {
  if (!iframe?.contentWindow || typeof window === 'undefined') return;
  iframe.contentWindow.postMessage({ type, payload }, window.location.origin);
}

function createMessage(id: string, role: MybiMessageRole, content: string): ConversationMessage {
  return { content, id, role };
}

export function PersistentDiagnosisWorldProvider({
  active,
  children,
  pathname,
}: PropsWithChildren<PersistentDiagnosisWorldProviderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const responseTimersRef = useRef<number[]>([]);
  const activityRef = useRef<string[]>([]);
  const manualThemeAtRef = useRef(0);
  const messageIndexRef = useRef(0);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const dragStateRef = useRef<{
    initialRect: RectState;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [rect, setRectState] = useState<RectState | null>(null);
  const [manualHome, setManualHome] = useState<PointState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<MybiPanelTab>('guide');
  const [sceneState, setSceneState] = useState<MybiSceneState>(() => buildSceneFallback(pathname));
  const [modeOverride, setModeOverride] = useState<MybiCompanionMode | null>(null);
  const [conversationInput, setConversationInput] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    const initialScene = buildSceneFallback(pathname);
    return [createMessage('intro-0', 'assistant', buildMybiConversationIntro(initialScene))];
  });
  const [isResponding, setIsResponding] = useState(false);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [browserErrors, setBrowserErrors] = useState<string[]>([]);
  const [reporterEmail, setReporterEmail] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [issueConfirmed, setIssueConfirmed] = useState(false);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [density, setDensity] = useState(100);
  const [paused, setPaused] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_PANEL_BREAKPOINT || window.innerHeight < 760 : false,
  );

  const setRect = useCallback((nextRect: RectState) => {
    setRectState((current) => (sameRect(current, nextRect) ? current : nextRect));
  }, []);

  const clearResponseTimers = useCallback(() => {
    if (typeof window === 'undefined') return;
    responseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    responseTimersRef.current = [];
  }, []);

  const nextMessageId = useCallback(() => {
    messageIndexRef.current += 1;
    return `mybi-${messageIndexRef.current}`;
  }, []);

  const pushRecentActivity = useCallback((activity: string | null) => {
    if (!activity) return;
    const nextItems = [activity, ...activityRef.current.filter((item) => item !== activity)].slice(0, MAX_RECENT_ACTIVITY);
    activityRef.current = nextItems;
    setRecentActivity(nextItems);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const nextScene = buildSceneFallback(pathname);
    setSceneState(nextScene);
    setMessages((current) => {
      const intro = createMessage(`intro-${messageIndexRef.current}`, 'assistant', buildMybiConversationIntro(nextScene));
      return current.length ? [intro, ...current.filter((message) => !message.id.startsWith('intro-'))] : [intro];
    });
    setPanelOpen(false);
    setPanelTab('guide');
    setConversationInput('');
    setModeOverride(null);
    setIsResponding(false);
    setIssueConfirmed(false);
    if (pathname === '/') {
      setManualHome(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (!panelOpen) {
      setModeOverride(null);
    }
  }, [panelOpen]);

  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      clearResponseTimers();
    },
    [clearResponseTimers],
  );

  const resolvedScene = useMemo(
    () =>
      normalizeMybiScene(pathname, {
        ...sceneState,
        companionMode:
          modeOverride ||
          (panelOpen
            ? panelTab === 'issue'
              ? 'alert'
              : panelTab === 'controls'
                ? 'speaking'
                : conversationInput.trim()
                  ? 'speaking'
                  : 'listening'
            : sceneState.companionMode),
      }),
    [conversationInput, modeOverride, panelOpen, panelTab, pathname, sceneState],
  );

  const tone = getMybiModeTone(resolvedScene.companionMode);
  const shouldMountWorld = active && (resolvedScene.layoutMode === 'hero' || panelOpen);
  const allowShellDrift =
    resolvedScene.layoutMode === 'floating' &&
    !isDragging &&
    !panelOpen &&
    !hovered &&
    !prefersReducedMotion;
  const allowInnerBreathing =
    resolvedScene.layoutMode !== 'hero' &&
    !panelOpen &&
    !hovered &&
    !prefersReducedMotion;

  useEffect(() => {
    const introContent = buildMybiConversationIntro(resolvedScene);
    setMessages((current) => {
      if (!current.length) {
        return [createMessage(`intro-${messageIndexRef.current}`, 'assistant', introContent)];
      }

      const [first, ...rest] = current;
      if (!first.id.startsWith('intro-')) {
        return [createMessage(`intro-${messageIndexRef.current}`, 'assistant', introContent), ...current];
      }

      if (first.content === introContent) {
        return current;
      }

      return [{ ...first, content: introContent }, ...rest];
    });
  }, [resolvedScene]);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    let raf = 0;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      if (resolvedScene.layoutMode === 'hero') {
        if (targetElement) setRect(rectFromElement(targetElement));
        return;
      }

      if (dragStateRef.current?.moved) {
        return;
      }

      const viewport = buildViewportRect();
      const focusRect =
        focusedElement && focusedElement.isConnected ? expandRect(rectFromElement(focusedElement), 28) : null;

      if (viewport && focusRect && rect && !manualHome) {
        const currentCenterX = rect.left + rect.width / 2;
        const currentSafelyFloating =
          intersectionArea(rect, focusRect) === 0 &&
          rect.top < viewport.height * 0.34 &&
          currentCenterX > viewport.width * 0.46;

        if (currentSafelyFloating) {
          return;
        }
      }

      const nextRect = getFloatingRect({ focusedElement, manualHome, targetElement });
      if (nextRect) {
        setRect(nextRect.rect);
      }
    };

    const requestMeasure = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };

    requestMeasure();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(requestMeasure);
      if (targetElement) observer.observe(targetElement);
      if (focusedElement && focusedElement.isConnected) observer.observe(focusedElement);
    }
    window.addEventListener('resize', requestMeasure);
    window.addEventListener('scroll', requestMeasure, true);

    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('scroll', requestMeasure, true);
    };
  }, [active, focusedElement, manualHome, rect, resolvedScene.layoutMode, setRect, targetElement]);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const handleClick = (event: MouseEvent) =>
      pushRecentActivity(pickLabel(event.target instanceof HTMLElement ? event.target : null));
    const handleError = (event: ErrorEvent) =>
      setBrowserErrors((current) => [event.message || '알 수 없는 브라우저 오류', ...current].slice(0, 5));
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || '처리되지 않은 오류');
      setBrowserErrors((current) => [reason, ...current].slice(0, 5));
    };
    const handleFocusIn = (event: FocusEvent) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      setFocusedElement(element);
      pushRecentActivity(pickLabel(element) || '입력 필드');
    };
    const handleFocusOut = () => {
      if (typeof window === 'undefined') return;
      window.setTimeout(() => {
        setFocusedElement(document.activeElement instanceof HTMLElement ? document.activeElement : null);
      }, 0);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [active, pushRecentActivity]);

  useEffect(() => {
    if (!shouldMountWorld) {
      setReady(false);
    }
  }, [shouldMountWorld]);

  useEffect(() => {
    if (!active || !ready) return;
    postToWorld(iframeRef.current, 'mybi-world:update', resolvedScene);
  }, [active, ready, resolvedScene]);

  useEffect(() => {
    if (!active || !ready) return;
    postToWorld(iframeRef.current, 'mybi-world:command', {
      command: 'setRenderProfile',
      lowPower: compactViewport,
      reducedMotion: Boolean(prefersReducedMotion),
    });
  }, [active, compactViewport, prefersReducedMotion, ready]);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || resolvedScene.layoutMode !== 'floating' || prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      if (Date.now() - manualThemeAtRef.current < 45_000) return;
      setThemeIndex((current) => {
        const next = (current + 1) % THEME_COUNT;
        postToWorld(iframeRef.current, 'mybi-world:command', { command: 'setTheme', themeIndex: next });
        return next;
      });
    }, 28_000);
    return () => window.clearInterval(interval);
  }, [active, prefersReducedMotion, resolvedScene.layoutMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportState = () => {
      setCompactViewport(window.innerWidth < MOBILE_PANEL_BREAKPOINT || window.innerHeight < 760);
    };

    updateViewportState();
    window.addEventListener('resize', updateViewportState);

    return () => {
      window.removeEventListener('resize', updateViewportState);
    };
  }, []);

  const runTimedMode = useCallback((nextMode: MybiCompanionMode, durationMs: number) => {
    if (typeof window === 'undefined') return;
    setModeOverride(nextMode);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setModeOverride(null);
      timerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const updateDrag = (pointerId: number, clientX: number, clientY: number) => {
      const dragState = dragStateRef.current;
      const viewport = buildViewportRect();
      if (!dragState || dragState.pointerId !== pointerId || !viewport) return;

      const deltaX = clientX - dragState.startX;
      const deltaY = clientY - dragState.startY;
      const movedEnough = Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD;

      if (!movedEnough && !dragState.moved) {
        return;
      }

      if (!dragState.moved) {
        dragState.moved = true;
        setIsDragging(true);
        setPanelOpen(false);
        pushRecentActivity('MYBI 위치 이동 시작');
      }

      const safeZone = buildSafeZone(viewport, dragState.initialRect.width);
      setRect({
        ...dragState.initialRect,
        left: clamp(dragState.initialRect.left + deltaX, safeZone.minLeft, safeZone.maxLeft),
        top: clamp(dragState.initialRect.top + deltaY, safeZone.minTop, safeZone.maxTop),
      });
    };

    const finishDrag = (pointerId: number) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== pointerId) return;

      if (dragState.moved && rect) {
        setManualHome({ left: rect.left, top: rect.top });
        pushRecentActivity('MYBI 위치를 새 자리로 옮김');
      } else {
        setPanelOpen((current) => !current);
        setPanelTab('guide');
        pushRecentActivity('MYBI 대화 열기');
        runTimedMode('listening', 1_000);
      }

      dragStateRef.current = null;
      setIsDragging(false);
    };

    const handlePointerMove = (event: PointerEvent) => updateDrag(event.pointerId, event.clientX, event.clientY);
    const handlePointerFinish = (event: PointerEvent) => finishDrag(event.pointerId);
    const handleMouseMove = (event: MouseEvent) => updateDrag(-1, event.clientX, event.clientY);
    const handleMouseFinish = () => finishDrag(-1);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerFinish);
    window.addEventListener('pointercancel', handlePointerFinish);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseFinish);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerFinish);
      window.removeEventListener('pointercancel', handlePointerFinish);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseFinish);
    };
  }, [active, pushRecentActivity, rect, runTimedMode, setRect]);

  const sendCommand = useCallback(
    (command: string, payload: Record<string, unknown> = {}, pulseMode = true) => {
      postToWorld(iframeRef.current, 'mybi-world:command', { command, ...payload });
      if (command === 'pulse' && pulseMode) runTimedMode('speaking', 1_100);
    },
    [runTimedMode],
  );

  const streamAssistantReply = useCallback(
    (content: string) => {
      setIsResponding(false);
      const messageId = nextMessageId();
      const characters = [...content];
      setMessages((current) => [...current, createMessage(messageId, 'assistant', '')]);
      sendCommand('pulse');
      runTimedMode('speaking', 1_600);

      if (typeof window === 'undefined') {
        setMessages((current) =>
          current.map((message) => (message.id === messageId ? { ...message, content } : message)),
        );
        return;
      }

      let index = 0;
      const typingTimer = window.setInterval(() => {
        index = Math.min(characters.length, index + Math.max(1, Math.ceil(characters.length / 26)));
        const partial = characters.slice(0, index).join('');
        setMessages((current) =>
          current.map((message) => (message.id === messageId ? { ...message, content: partial } : message)),
        );

        if (index >= characters.length) {
          window.clearInterval(typingTimer);
          responseTimersRef.current = responseTimersRef.current.filter((timer) => timer !== typingTimer);
          sendCommand('pulse');
        }
      }, 24);

      responseTimersRef.current.push(typingTimer);
    },
    [nextMessageId, runTimedMode, sendCommand],
  );

  const submitConversation = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isResponding) return;

      clearResponseTimers();
      pushRecentActivity(`질문: ${trimmed}`);

      // 새 user 메시지 추가
      const userMsg = createMessage(nextMessageId(), 'user', trimmed);
      const nextHistory = [...messagesRef.current, userMsg];
      messagesRef.current = nextHistory;
      setMessages(nextHistory);
      setConversationInput('');
      setPanelOpen(true);
      setPanelTab('guide');
      setIsResponding(true);
      runTimedMode('thinking', 720);
      const requestMessages: MybiChatMessage[] = nextHistory.slice(-10).map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      }));
      const requestSceneContext = [
        resolvedScene.routeLabel ? `화면: ${resolvedScene.routeLabel}` : null,
        resolvedScene.stepLabel ? `단계: ${resolvedScene.stepLabel}` : null,
        resolvedScene.contextSummary,
      ]
        .filter(Boolean)
        .join(' / ');

      if (typeof window === 'undefined') {
        setIsResponding(false);
        streamAssistantReply(buildGuideReply(trimmed, resolvedScene, activityRef.current));
        return;
      }

      void (async () => {
        try {
          const reply = await sendMybiMessage(requestMessages, requestSceneContext);
          streamAssistantReply(reply);
        } catch {
          streamAssistantReply(buildGuideReply(trimmed, resolvedScene, activityRef.current));
        }
      })();
    },
    [clearResponseTimers, isResponding, nextMessageId, pushRecentActivity, resolvedScene, runTimedMode, streamAssistantReply],
  );

  const handleConversationSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitConversation(conversationInput);
    },
    [conversationInput, submitConversation],
  );

  const mailDraft = useMemo(
    () =>
      buildMybiMailDraft({
        browserErrors,
        note: issueNote,
        pathname,
        recentActivity,
        reporterEmail,
        sceneState: resolvedScene,
        screenshotName,
      }),
    [browserErrors, issueNote, pathname, recentActivity, reporterEmail, resolvedScene, screenshotName],
  );

  const panelStyle = useMemo(() => {
    if (!rect || typeof window === 'undefined') return null;

    if (window.innerWidth < MOBILE_PANEL_BREAKPOINT) {
      return {
        left: 16,
        top: Math.max(16, window.innerHeight - 396),
        width: window.innerWidth - 32,
      };
    }

    const width = Math.min(344, window.innerWidth - 32);
    const height = 396;
    const focusRect =
      focusedElement && focusedElement.isConnected ? expandRect(rectFromElement(focusedElement), 24) : null;
    const leftSpace = rect.left - FLOATING_PANEL_GAP;
    const rightSpace = window.innerWidth - (rect.left + rect.width) - FLOATING_PANEL_GAP;
    let placeLeft = leftSpace > rightSpace;

    if (focusRect) {
      const leftCandidate = {
        height,
        left: clamp(rect.left - width - FLOATING_PANEL_GAP, 16, window.innerWidth - width - 16),
        top: clamp(rect.top + 8, 16, window.innerHeight - height - 16),
        width,
      };
      const rightCandidate = {
        height,
        left: clamp(rect.left + rect.width + FLOATING_PANEL_GAP, 16, window.innerWidth - width - 16),
        top: clamp(rect.top + 8, 16, window.innerHeight - height - 16),
        width,
      };
      placeLeft = intersectionArea(rightCandidate, focusRect) > intersectionArea(leftCandidate, focusRect);
    }

    const left = placeLeft
      ? clamp(rect.left - width - FLOATING_PANEL_GAP, 16, window.innerWidth - width - 16)
      : clamp(rect.left + rect.width + FLOATING_PANEL_GAP, 16, window.innerWidth - width - 16);

    return {
      left,
      top: clamp(rect.top + 10, 16, window.innerHeight - height - 16),
      width,
    };
  }, [focusedElement, rect]);

  const beginDrag = useCallback(
    (pointerId: number, startX: number, startY: number) => {
      if (resolvedScene.layoutMode !== 'floating' || !rect || dragStateRef.current) return;
      dragStateRef.current = {
        initialRect: rect,
        moved: false,
        pointerId,
        startX,
        startY,
      };
      runTimedMode('listening', 420);
    },
    [rect, resolvedScene.layoutMode, runTimedMode],
  );

  const handleTriggerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      beginDrag(event.pointerId, event.clientX, event.clientY);
    },
    [beginDrag],
  );

  const handleTriggerMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      beginDrag(-1, event.clientX, event.clientY);
    },
    [beginDrag],
  );

  const quickActions = useMemo(
    () => [
      { label: '지금 단계 설명', prompt: '지금 단계 설명' },
      { label: '왜 이 질문을 하나요?', prompt: '왜 이 질문을 하나요?' },
      { label: '다음에 무엇을 하면 되나요?', prompt: '다음에 무엇을 하면 되나요?' },
      { label: '문제 제보', prompt: '문제 제보', tab: 'issue' as const },
    ],
    [],
  );

  const contextValue = useMemo<PersistentDiagnosisWorldContextValue>(
    () => ({
      registerTarget(element) {
        setTargetElement(element);
        if (element && resolvedScene.layoutMode === 'hero') setRect(rectFromElement(element));
      },
      updateSceneState(nextState) {
        setSceneState((current) => {
          const next = normalizeMybiScene(pathname, nextState);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      },
    }),
    [pathname, resolvedScene.layoutMode, setRect],
  );

  return (
    <PersistentDiagnosisWorldContext.Provider value={contextValue}>
      {children}

      {active ? (
        <>
          <motion.div
            animate={
              rect
                ? {
                    borderRadius: resolvedScene.layoutMode === 'hero' ? 0 : 36,
                    height: rect.height,
                    left: rect.left,
                    opacity: 1,
                    top: rect.top,
                    width: rect.width,
                    x: allowShellDrift ? [0, 8, -6, 0] : 0,
                    y: allowShellDrift ? [0, -8, 4, 0] : 0,
                  }
                : { opacity: 0 }
            }
            className={`fixed overflow-visible ${resolvedScene.layoutMode === 'hero' ? 'z-20' : 'z-[55]'}`}
            data-mybi-shell="active"
            initial={false}
            onHoverEnd={() => setHovered(false)}
            onHoverStart={() => setHovered(true)}
            style={{ willChange: 'left, top, width, height, border-radius, transform' }}
            transition={{
              borderRadius: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
              default: { damping: 32, mass: 0.92, stiffness: 280, type: 'spring' },
              opacity: { duration: 0.18, ease: 'easeOut' },
              x: allowShellDrift ? { duration: 18, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' } : { duration: 0.18 },
              y: allowShellDrift ? { duration: 19, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' } : { duration: 0.18 },
            }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
              <motion.div
                animate={
                  !allowInnerBreathing
                    ? { rotate: 0, scale: 1 }
                    : { rotate: [0, 1.3, -1.1, 0], scale: [1, 1.014, 0.992, 1] }
                }
                className={[
                  'relative h-full w-full overflow-hidden border bg-[#02050a]',
                  hovered && resolvedScene.layoutMode === 'floating' ? 'border-white/18' : 'border-white/10',
                  tone.shellGlow,
                ].join(' ')}
                transition={
                  !allowInnerBreathing
                    ? { duration: 0.2 }
                    : { duration: 14, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }
                }
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(125,211,252,0.16),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_18%),linear-gradient(180deg,rgba(4,7,13,0.92),rgba(2,5,10,0.82))]" />
                {shouldMountWorld ? (
                  <iframe
                    ref={iframeRef}
                    className="absolute inset-0 h-full w-full border-0"
                    onLoad={() => setReady(true)}
                    src="/neural-world.html"
                    title="MYBI neural companion"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[radial-gradient(circle_at_48%_38%,rgba(125,211,252,0.18),transparent_20%),radial-gradient(circle_at_62%_58%,rgba(236,91,19,0.16),transparent_24%),linear-gradient(180deg,rgba(2,5,10,0.28),rgba(2,5,10,0.52))]"
                    data-mybi-world="standby"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_34%,rgba(255,255,255,0.06),transparent_16%),linear-gradient(180deg,rgba(2,5,10,0)_0%,rgba(2,5,10,0.12)_44%,rgba(2,5,10,0.38)_100%)]" />
              </motion.div>
            </div>

            {resolvedScene.layoutMode === 'floating' ? (
              <>
                <button
                  aria-label="MYBI 대화 열기 또는 위치 이동"
                  className="absolute left-3 top-3 z-[56] rounded-full border border-white/14 bg-[#07101c]/84 px-3 py-2 text-left text-white shadow-[0_20px_60px_-38px_rgba(0,0,0,0.92)] backdrop-blur-xl transition hover:border-white/24 hover:bg-[#0a1627]/88"
                  data-mybi-trigger="orb-handle"
                  onMouseDown={handleTriggerMouseDown}
                  onPointerDown={handleTriggerPointerDown}
                  type="button"
                >
                  <p className="text-[10px] font-semibold tracking-[0.24em] text-slate-300">MYBI</p>
                  <p className="mt-1 text-[11px] font-semibold text-white">{isDragging ? '이동 중' : panelOpen ? '닫기' : '열기 · 이동'}</p>
                </button>

                <div className="pointer-events-none absolute right-3 top-3 z-[56] flex items-center gap-2">
                  <div className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.18em] backdrop-blur ${tone.chip}`}>
                    {tone.label}
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[56] flex items-end justify-between gap-3">
                  <div className="max-w-[72%] rounded-full border border-white/10 bg-[#050b14]/70 px-3 py-1.5 text-[11px] leading-5 text-slate-200 backdrop-blur">
                    {resolvedScene.stepLabel || '현재 단계'}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] text-slate-300 backdrop-blur">
                    {resolvedScene.routeLabel || '현재 화면'}
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>

          {panelOpen && panelStyle ? (
            <motion.aside
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                className={`fixed z-[60] max-h-[396px] overflow-hidden rounded-[28px] border border-white/12 bg-[#06111d]/92 text-white backdrop-blur-2xl ${tone.panelGlow}`}
              data-mybi-panel="open"
              initial={{ opacity: 0, scale: 0.94, x: 12, y: 10 }}
              style={panelStyle}
              transition={{ damping: 30, stiffness: 260, type: 'spring' }}
            >
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.24em] text-slate-400">MYBI</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{resolvedScene.title || 'MYBI'}</h2>
                    <p className="mt-1 text-sm text-slate-300">{resolvedScene.routeLabel || '현재 화면'}</p>
                  </div>
                  <button
                    className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
                    onClick={() => setPanelOpen(false)}
                    type="button"
                  >
                    닫기
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  {(['guide', 'controls', 'issue'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                        panelTab === tab
                          ? 'bg-white text-slate-950'
                          : 'border border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]',
                      ].join(' ')}
                      onClick={() => {
                        setPanelTab(tab);
                        if (tab === 'issue') setModeOverride('alert');
                        if (tab === 'guide') runTimedMode('listening', 1_000);
                        if (tab === 'controls') setModeOverride(null);
                      }}
                      type="button"
                    >
                      {tab === 'guide' ? '안내' : tab === 'controls' ? '조작' : '문제 제보'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[344px] space-y-4 overflow-y-auto px-5 py-4">
                {panelTab === 'guide' ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">이 단계에서 하는 일</span>
                        {resolvedScene.stepLabel ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                            {resolvedScene.stepLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-100">{resolvedScene.meaning}</p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{resolvedScene.memoryNote}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((action) => (
                        <button
                          key={action.label}
                          className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                          onClick={() => {
                            if (action.tab === 'issue') {
                              setPanelTab('issue');
                              setIssueConfirmed(false);
                              setMessages((current) => [
                                ...current,
                                createMessage(nextMessageId(), 'assistant', '문제 제보 초안을 같이 정리하겠습니다. 내용 확인 후 직접 보내실 수 있어요.'),
                              ]);
                              runTimedMode('alert', 1_400);
                              return;
                            }
                            submitConversation(action.prompt);
                          }}
                          type="button"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {messages.slice(-6).map((message) => (
                        <div
                          key={message.id}
                          className={[
                            'rounded-3xl px-4 py-3 text-sm leading-7',
                            message.role === 'assistant'
                              ? 'border border-white/10 bg-white/[0.04] text-slate-100'
                              : 'ml-auto max-w-[92%] bg-cyan-300/[0.12] text-cyan-50',
                          ].join(' ')}
                        >
                          <p className="mb-1 text-[10px] font-semibold tracking-[0.2em] text-slate-400">
                            {message.role === 'assistant' ? 'MYBI' : '사용자'}
                          </p>
                          <p>{message.content || '...'}</p>
                        </div>
                      ))}
                      {isResponding ? (
                        <div className="rounded-3xl border border-cyan-200/15 bg-cyan-200/[0.06] px-4 py-3 text-sm leading-7 text-cyan-50">
                          <p className="mb-1 text-[10px] font-semibold tracking-[0.2em] text-cyan-200/80">MYBI</p>
                          <p>답변 정리 중...</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-200">
                      <p className="text-xs font-semibold tracking-[0.22em] text-slate-400">AI 운영 분석</p>
                      <p className="mt-2">{resolvedScene.memoryNote}</p>
                      <p className="mt-3 text-slate-300">다음 액션: {resolvedScene.nextAction}</p>
                      <p className="mt-2 text-slate-400">최근 액션: {recentActivity[0] || '아직 기록된 최근 액션이 없습니다.'}</p>
                    </div>

                    <form className="space-y-3" onSubmit={handleConversationSubmit}>
                      <label className="block">
                        <span className="text-xs font-semibold tracking-[0.22em] text-slate-400">MYBI에게 직접 묻기</span>
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/30"
                          onBlur={() => setModeOverride(null)}
                          onChange={(event) => setConversationInput(event.target.value)}
                          onFocus={() => setModeOverride('listening')}
                          placeholder="지금 단계 의미, 왜 이 질문을 하는지, 다음 액션, inquiry/reservation/waiting 차이를 물어보세요."
                          value={conversationInput}
                        />
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs leading-6 text-slate-400">
                          {resolvedScene.storeLabel ? `${resolvedScene.storeLabel} 기준으로 답변합니다.` : '현재 화면 맥락 기준으로 답변합니다.'}
                        </p>
                        <button
                          className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={isResponding || !conversationInput.trim()}
                          type="submit"
                        >
                          {isResponding ? '응답 중...' : '보내기'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {panelTab === 'controls' ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]"
                        onClick={() => sendCommand('nextFormation')}
                        type="button"
                      >
                        <p className="text-sm font-semibold text-white">형태 변환</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">현재 장면을 다음 formation으로 부드럽게 넘깁니다.</p>
                      </button>
                      <button
                        className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]"
                        onClick={() => {
                          setPaused((current) => !current);
                          sendCommand('togglePause', {}, false);
                        }}
                        type="button"
                      >
                        <p className="text-sm font-semibold text-white">{paused ? '재생' : '정지'}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">세계 시간을 멈추거나 다시 흐르게 만듭니다.</p>
                      </button>
                      <button
                        className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]"
                        onClick={() => sendCommand('resetScene', {}, false)}
                        type="button"
                      >
                        <p className="text-sm font-semibold text-white">원위치</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">카메라와 반응 상태를 기본값으로 정리합니다.</p>
                      </button>
                      <button
                        className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]"
                        onClick={() => {
                          setAutoRotate((current) => {
                            const next = !current;
                            sendCommand('setAutoRotate', { enabled: next }, false);
                            return next;
                          });
                        }}
                        type="button"
                      >
                        <p className="text-sm font-semibold text-white">{autoRotate ? '자동 회전 끄기' : '자동 회전 켜기'}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">사용자 입력이 끝나면 다시 천천히 회전하도록 유지합니다.</p>
                      </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">색감 전환</p>
                        <span className="text-xs text-slate-400">테마 {themeIndex + 1}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {Array.from({ length: THEME_COUNT }, (_, index) => (
                          <button
                            aria-label={`테마 ${index + 1}`}
                            key={index}
                            className={[
                              'h-9 w-9 rounded-full border transition',
                              themeIndex === index ? 'border-white bg-white/80' : 'border-white/14 bg-white/[0.08]',
                            ].join(' ')}
                            onClick={() => {
                              manualThemeAtRef.current = Date.now();
                              setThemeIndex(index);
                              sendCommand('setTheme', { themeIndex: index }, false);
                            }}
                            type="button"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">밀도</p>
                        <span className="text-xs text-slate-400">{density}%</span>
                      </div>
                      <input
                        className="mt-4 h-2 w-full accent-cyan-300"
                        max={140}
                        min={60}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setDensity(next);
                          sendCommand('setDensity', { density: next }, false);
                        }}
                        type="range"
                        value={density}
                      />
                    </div>

                    <button
                      className="w-full rounded-3xl border border-cyan-200/18 bg-cyan-300/[0.08] px-4 py-4 text-left transition hover:bg-cyan-300/[0.12]"
                      onClick={() => sendCommand('pulse')}
                      type="button"
                    >
                      <p className="text-sm font-semibold text-cyan-50">지금 반응시키기</p>
                      <p className="mt-1 text-xs leading-6 text-cyan-100/80">현재 단계 강조와 함께 bloom, sparkle, pulse를 즉시 한 번 더 실행합니다.</p>
                    </button>
                  </div>
                ) : null}

                {panelTab === 'issue' ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-orange-200/16 bg-orange-300/[0.08] p-4">
                      <p className="text-xs font-semibold tracking-[0.22em] text-orange-100">보내기 전 검토</p>
                      <p className="mt-3 text-sm leading-7 text-orange-50">
                        현재 경로, 단계, 최근 액션, 브라우저 오류 요약을 초안으로 묶어드리지만 자동 전송은 하지 않습니다. 확인 후 직접 메일 초안을 열어 주세요.
                      </p>
                    </div>

                    <label className="block">
                      <span className="text-xs font-semibold tracking-[0.22em] text-slate-400">회신 받을 이메일</span>
                      <input
                        className="mt-2 w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-200/30"
                        onChange={(event) => {
                          setReporterEmail(event.target.value);
                          setIssueConfirmed(false);
                        }}
                        placeholder="답변 받을 이메일을 남겨 주세요."
                        type="email"
                        value={reporterEmail}
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold tracking-[0.22em] text-slate-400">선택 스크린샷</span>
                      <input
                        accept="image/*"
                        className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-950"
                        onChange={(event) => {
                          setScreenshotName(event.target.files?.[0]?.name || null);
                          setIssueConfirmed(false);
                        }}
                        type="file"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold tracking-[0.22em] text-slate-400">문제 메모</span>
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-200/30"
                        onChange={(event) => {
                          setIssueNote(event.target.value);
                          setIssueConfirmed(false);
                        }}
                        placeholder="무슨 문제가 있었는지, 바로 직전에 무엇을 했는지 적어 주세요."
                        value={issueNote}
                      />
                    </label>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-100">
                      <p><span className="font-semibold text-white">현재 경로:</span> {pathname}</p>
                      <p><span className="font-semibold text-white">현재 단계:</span> {resolvedScene.stepLabel || `${resolvedScene.stepIndex + 1}단계`}</p>
                      <p><span className="font-semibold text-white">최근 액션:</span> {recentActivity[0] || '없음'}</p>
                      <p><span className="font-semibold text-white">브라우저 오류:</span> {browserErrors.length ? browserErrors.join(' / ') : '없음'}</p>
                      <p><span className="font-semibold text-white">스크린샷:</span> {screenshotName || '첨부 없음'}</p>
                    </div>

                    <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-200">
                      <input
                        checked={issueConfirmed}
                        className="mt-1 h-4 w-4 accent-orange-300"
                        onChange={(event) => setIssueConfirmed(event.target.checked)}
                        type="checkbox"
                      />
                      <span>초안 내용을 확인했고, 자동 전송이 아닌 메일 초안을 직접 여는 방식이라는 점을 이해했습니다.</span>
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-full border border-white/14 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                        onClick={() => navigator.clipboard?.writeText(mailDraft.body)}
                        type="button"
                      >
                        요약 복사
                      </button>
                      <button
                        className={[
                          'rounded-full px-4 py-2 text-xs font-semibold',
                          issueConfirmed ? 'bg-white text-slate-950' : 'cursor-not-allowed bg-white/20 text-slate-400',
                        ].join(' ')}
                        disabled={!issueConfirmed}
                        onClick={() => {
                          if (!issueConfirmed || typeof window === 'undefined') return;
                          pushRecentActivity('MYBI 문제 제보 메일 초안 열기');
                          window.location.href = mailDraft.href;
                        }}
                        type="button"
                      >
                        메일 초안 열기
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.aside>
          ) : null}
        </>
      ) : null}
    </PersistentDiagnosisWorldContext.Provider>
  );
}

export function usePersistentDiagnosisWorldSurface(sceneState: MybiSceneState) {
  const context = useContext(PersistentDiagnosisWorldContext);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!context) return;
    context.registerTarget(targetRef.current);
    return () => context.registerTarget(null);
  }, [context]);

  useEffect(() => {
    context?.updateSceneState(sceneState);
  }, [context, sceneState]);

  return targetRef;
}
