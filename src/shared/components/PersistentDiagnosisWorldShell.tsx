import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PropsWithChildren,
} from 'react';
import { motion } from 'motion/react';

import {
  buildGuideReply,
  buildMybiMailDraft,
  buildSceneFallback,
  getMybiModeTone,
  normalizeMybiScene,
  type MybiCompanionMode,
  type MybiSceneState,
} from '@/shared/lib/mybiCompanion';

type MybiPanelTab = 'controls' | 'guide' | 'issue';

interface PersistentDiagnosisWorldProviderProps {
  active: boolean;
  pathname: string;
}

interface PersistentDiagnosisWorldContextValue {
  registerTarget: (element: HTMLElement | null) => void;
  updateSceneState: (state: MybiSceneState) => void;
}

interface RectState {
  height: number;
  left: number;
  top: number;
  width: number;
}

const PersistentDiagnosisWorldContext = createContext<PersistentDiagnosisWorldContextValue | null>(null);
const FLOATING_PADDING = 20;
const MAX_RECENT_ACTIVITY = 6;
const THEME_COUNT = 3;

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

function buildViewportRect() {
  if (typeof window === 'undefined') return null;
  return { height: window.innerHeight, left: 0, top: 0, width: window.innerWidth } satisfies RectState;
}

function pickLabel(element: HTMLElement | null) {
  if (!element) return null;
  const explicit = element.dataset.mybiAction || element.getAttribute('aria-label');
  if (explicit) return explicit.trim();
  const text = element.innerText.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 80) : null;
}

function getFloatingRect(targetElement: HTMLElement | null) {
  const viewport = buildViewportRect();
  if (!viewport) return null;

  const size = clamp(viewport.width * (viewport.width < 720 ? 0.42 : 0.22), viewport.width < 720 ? 168 : 220, viewport.width < 720 ? 236 : 340);
  const anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-mybi-anchor]'));
  const sourceElements = anchors.length ? anchors : [targetElement].filter((element): element is HTMLElement => Boolean(element));
  const anchor = sourceElements
    .map((element) => ({ element, rect: rectFromElement(element) }))
    .filter(({ rect }) => intersectionArea(rect, viewport) > rect.width * rect.height * 0.12)
    .sort((a, b) => {
      const focusA = Math.abs(a.rect.top + a.rect.height * 0.3 - viewport.height * 0.35);
      const focusB = Math.abs(b.rect.top + b.rect.height * 0.3 - viewport.height * 0.35);
      return focusA - focusB;
    })[0]?.rect || viewport;

  const avoidRects = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-mybi-avoid], button, [role="button"], input, textarea, select, a.btn-primary, a.btn-secondary',
    ),
  )
    .map((element) => rectFromElement(element))
    .filter((rect) => rect.width > 52 && rect.height > 28 && intersectionArea(rect, viewport) > rect.width * rect.height * 0.12);

  const candidates = [
    { left: anchor.left + anchor.width - size * 0.18, top: anchor.top - size * 0.08 },
    { left: anchor.left + anchor.width + 22, top: anchor.top + anchor.height * 0.08 },
    { left: anchor.left - size - 22, top: anchor.top + anchor.height * 0.12 },
  ].map((candidate) => ({
    height: size,
    left: clamp(candidate.left, FLOATING_PADDING, viewport.width - size - FLOATING_PADDING),
    top: clamp(candidate.top, FLOATING_PADDING, viewport.height - size - FLOATING_PADDING),
    width: size,
  }));

  return candidates.reduce(
    (best, candidate) => {
      const score = avoidRects.reduce((total, avoidRect) => total + intersectionArea(candidate, avoidRect), 0);
      return !best || score < best.score ? { rect: candidate, score } : best;
    },
    null as { rect: RectState; score: number } | null,
  )?.rect || candidates[0];
}

function postToWorld(iframe: HTMLIFrameElement | null, type: string, payload: unknown) {
  if (!iframe?.contentWindow || typeof window === 'undefined') return;
  iframe.contentWindow.postMessage({ type, payload }, window.location.origin);
}

export function PersistentDiagnosisWorldProvider({
  active,
  children,
  pathname,
}: PropsWithChildren<PersistentDiagnosisWorldProviderProps>) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const activityRef = useRef<string[]>([]);
  const manualThemeAtRef = useRef(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [rect, setRectState] = useState<RectState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<MybiPanelTab>('guide');
  const [sceneState, setSceneState] = useState<MybiSceneState>(() => buildSceneFallback(pathname));
  const [modeOverride, setModeOverride] = useState<MybiCompanionMode | null>(null);
  const [guideInput, setGuideInput] = useState('');
  const [guideReply, setGuideReply] = useState('');
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [browserErrors, setBrowserErrors] = useState<string[]>([]);
  const [reporterEmail, setReporterEmail] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [density, setDensity] = useState(100);
  const [paused, setPaused] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hovered, setHovered] = useState(false);

  const setRect = useCallback((nextRect: RectState) => {
    setRectState((current) => (sameRect(current, nextRect) ? current : nextRect));
  }, []);

  const pushRecentActivity = useCallback((activity: string | null) => {
    if (!activity) return;
    const nextItems = [activity, ...activityRef.current.filter((item) => item !== activity)].slice(0, MAX_RECENT_ACTIVITY);
    activityRef.current = nextItems;
    setRecentActivity(nextItems);
  }, []);

  useEffect(() => {
    setSceneState(buildSceneFallback(pathname));
    setPanelOpen(false);
    setPanelTab('guide');
    setGuideInput('');
    setGuideReply('');
    setModeOverride(null);
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
    },
    [],
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
                : 'listening'
            : sceneState.companionMode),
      }),
    [modeOverride, panelOpen, panelTab, pathname, sceneState],
  );

  const tone = getMybiModeTone(resolvedScene.companionMode);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    let raf = 0;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      if (resolvedScene.layoutMode === 'hero') {
        if (targetElement) setRect(rectFromElement(targetElement));
        return;
      }
      const nextRect = getFloatingRect(targetElement);
      if (nextRect) setRect(nextRect);
    };
    const requestMeasure = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };

    requestMeasure();
    if (typeof ResizeObserver !== 'undefined' && targetElement) {
      observer = new ResizeObserver(requestMeasure);
      observer.observe(targetElement);
    }
    window.addEventListener('resize', requestMeasure);
    window.addEventListener('scroll', requestMeasure, true);

    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('scroll', requestMeasure, true);
    };
  }, [active, resolvedScene.layoutMode, setRect, targetElement]);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const handleClick = (event: MouseEvent) => pushRecentActivity(pickLabel(event.target instanceof HTMLElement ? event.target : null));
    const handleError = (event: ErrorEvent) => setBrowserErrors((current) => [event.message || 'Unknown browser error', ...current].slice(0, 5));
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled rejection');
      setBrowserErrors((current) => [reason, ...current].slice(0, 5));
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [active, pushRecentActivity]);

  useEffect(() => {
    if (!active || !ready) return;
    postToWorld(iframeRef.current, 'mybi-world:update', resolvedScene);
  }, [active, ready, resolvedScene]);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || resolvedScene.layoutMode !== 'floating') return;
    const interval = window.setInterval(() => {
      if (Date.now() - manualThemeAtRef.current < 45_000) return;
      setThemeIndex((current) => {
        const next = (current + 1) % THEME_COUNT;
        postToWorld(iframeRef.current, 'mybi-world:command', { command: 'setTheme', themeIndex: next });
        return next;
      });
    }, 28_000);
    return () => window.clearInterval(interval);
  }, [active, resolvedScene.layoutMode]);

  const runTimedMode = useCallback((nextMode: MybiCompanionMode, durationMs: number) => {
    if (typeof window === 'undefined') return;
    setModeOverride(nextMode);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setModeOverride(null);
      timerRef.current = null;
    }, durationMs);
  }, []);

  const sendCommand = useCallback(
    (command: string, payload: Record<string, unknown> = {}) => {
      postToWorld(iframeRef.current, 'mybi-world:command', { command, ...payload });
      if (command === 'pulse') runTimedMode('speaking', 1000);
    },
    [runTimedMode],
  );

  const handleGuideSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!guideInput.trim()) return;
      pushRecentActivity(`MYBI asked: ${guideInput.trim()}`);
      setPanelOpen(true);
      setPanelTab('guide');
      setGuideReply('');
      setModeOverride('thinking');
      sendCommand('pulse');

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          setGuideReply(buildGuideReply(guideInput, resolvedScene, activityRef.current));
          runTimedMode('speaking', 1800);
          sendCommand('pulse');
        }, 680);
      }
    },
    [guideInput, pushRecentActivity, resolvedScene, runTimedMode, sendCommand],
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
    if (window.innerWidth < 900) {
      return { left: 16, top: Math.max(16, window.innerHeight - 456), width: window.innerWidth - 32 };
    }

    const width = Math.min(360, window.innerWidth - 32);
    const placeLeft = rect.left > window.innerWidth * 0.56;
    const left = placeLeft ? rect.left - width - 18 : rect.left + rect.width + 18;
    return {
      left: clamp(left, 16, window.innerWidth - width - 16),
      top: clamp(rect.top + 12, 16, window.innerHeight - 428),
      width,
    };
  }, [rect]);

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
                  }
                : { opacity: 0 }
            }
            className={`fixed overflow-hidden ${resolvedScene.layoutMode === 'hero' ? 'z-20' : 'z-[55]'}`}
            data-mybi-shell="active"
            initial={false}
            onHoverEnd={() => setHovered(false)}
            onHoverStart={() => setHovered(true)}
            style={{ willChange: 'left, top, width, height, border-radius' }}
            transition={{
              borderRadius: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
              default: { damping: 32, mass: 0.92, stiffness: 280, type: 'spring' },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
          >
            <motion.div
              animate={
                resolvedScene.layoutMode === 'hero'
                  ? { rotate: 0, scale: 1, x: 0, y: 0 }
                  : { rotate: [0, 1.4, -1.1, 0], scale: [1, 1.015, 0.99, 1], x: [0, 9, -7, 0], y: [0, -11, 7, 0] }
              }
              className={[
                'relative h-full w-full overflow-hidden border bg-[#02050a]',
                hovered && resolvedScene.layoutMode === 'floating' ? 'border-white/18' : 'border-white/10',
                tone.shellGlow,
              ].join(' ')}
              transition={
                resolvedScene.layoutMode === 'hero'
                  ? { duration: 0.2 }
                  : { duration: 17, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }
              }
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(125,211,252,0.16),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_18%),linear-gradient(180deg,rgba(4,7,13,0.92),rgba(2,5,10,0.82))]" />
              <iframe
                ref={iframeRef}
                className="absolute inset-0 h-full w-full border-0"
                onLoad={() => setReady(true)}
                src="/neural-world.html"
                title="MYBI neural companion"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_34%,rgba(255,255,255,0.06),transparent_16%),linear-gradient(180deg,rgba(2,5,10,0)_0%,rgba(2,5,10,0.12)_44%,rgba(2,5,10,0.38)_100%)]" />

              {resolvedScene.layoutMode === 'floating' ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 py-4">
                  <div className="rounded-full border border-white/14 bg-[#050b14]/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-200 backdrop-blur">
                    MYBI
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] backdrop-blur ${tone.chip}`}>
                    {tone.label}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>

          {resolvedScene.layoutMode === 'floating' && rect ? (
            <motion.button
              animate={{ opacity: 1, scale: panelOpen ? 1.02 : 1, x: 0, y: 0 }}
              className="fixed z-[58] rounded-full border border-white/14 bg-[#07101c]/84 px-4 py-2 text-left text-white shadow-[0_20px_60px_-38px_rgba(0,0,0,0.92)] backdrop-blur-xl"
              data-mybi-trigger="open-panel"
              initial={{ opacity: 0, scale: 0.92, x: 6, y: 4 }}
              onClick={() => {
                setPanelOpen((current) => !current);
                setPanelTab('guide');
                runTimedMode('listening', 1400);
              }}
              style={{
                left: clamp(rect.left + rect.width - 132, 12, (typeof window !== 'undefined' ? window.innerWidth : 360) - 148),
                top: clamp(rect.top + rect.height - 56, 12, (typeof window !== 'undefined' ? window.innerHeight : 640) - 56),
              }}
              transition={{ damping: 28, stiffness: 250, type: 'spring' }}
              type="button"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Operating companion</p>
              <p className="mt-1 text-sm font-semibold">{panelOpen ? 'MYBI panel close' : 'MYBI panel open'}</p>
            </motion.button>
          ) : null}

          {panelOpen && panelStyle ? (
            <motion.aside
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              className={`fixed z-[60] max-h-[420px] overflow-hidden rounded-[28px] border border-white/12 bg-[#06111d]/92 text-white backdrop-blur-2xl ${tone.panelGlow}`}
              data-mybi-panel="open"
              initial={{ opacity: 0, scale: 0.94, x: 12, y: 10 }}
              style={panelStyle}
              transition={{ damping: 30, stiffness: 260, type: 'spring' }}
            >
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">MYBI</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{resolvedScene.title || 'MYBI companion'}</h2>
                  </div>
                  <button className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]" onClick={() => setPanelOpen(false)} type="button">
                    Close
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  {(['guide', 'controls', 'issue'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                        panelTab === tab ? 'bg-white text-slate-950' : 'border border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]',
                      ].join(' ')}
                      onClick={() => {
                        setPanelTab(tab);
                        if (tab === 'issue') setModeOverride('alert');
                        if (tab === 'guide') runTimedMode('listening', 1400);
                        if (tab === 'controls') setModeOverride(null);
                      }}
                      type="button"
                    >
                      {tab === 'guide' ? 'Guide' : tab === 'controls' ? 'Controls' : 'Issue'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[328px] space-y-4 overflow-y-auto px-5 py-4">
                {panelTab === 'guide' ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">What this step means</p>
                      <p className="mt-3 text-sm leading-7 text-slate-100">{resolvedScene.meaning}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Memory spine</p>
                      <p className="mt-3 text-sm leading-7 text-slate-100">{resolvedScene.memoryNote}</p>
                    </div>
                    <form className="space-y-3" onSubmit={handleGuideSubmit}>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Ask MYBI</span>
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/30"
                          onBlur={() => setModeOverride(null)}
                          onChange={(event) => {
                            setGuideInput(event.target.value);
                            setModeOverride(event.target.value.trim() ? 'speaking' : 'listening');
                          }}
                          onFocus={() => setModeOverride('listening')}
                          placeholder="이 단계의 의미, 다음 액션, inquiry/reservation/waiting 차이를 물어보세요."
                          value={guideInput}
                        />
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs leading-6 text-slate-400">최근 맥락: {recentActivity[0] || '아직 기록된 최근 액션이 없습니다.'}</p>
                        <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950" type="submit">
                          Ask
                        </button>
                      </div>
                    </form>
                    {guideReply ? <div className="rounded-3xl border border-white/10 bg-cyan-300/[0.08] p-4 text-sm leading-7 text-cyan-50">{guideReply}</div> : null}
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Next action</p>
                      <p className="mt-3 text-sm leading-7 text-slate-100">{resolvedScene.nextAction}</p>
                    </div>
                  </div>
                ) : null}

                {panelTab === 'controls' ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]" onClick={() => sendCommand('nextFormation')} type="button">
                        <p className="text-sm font-semibold text-white">Morph</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">다음 포메이션으로 이동합니다.</p>
                      </button>
                      <button className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]" onClick={() => {
                        setPaused((current) => !current);
                        sendCommand('togglePause');
                      }} type="button">
                        <p className="text-sm font-semibold text-white">{paused ? 'Play' : 'Freeze'}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">월드 시간을 멈추거나 다시 흐르게 합니다.</p>
                      </button>
                      <button className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]" onClick={() => sendCommand('resetScene')} type="button">
                        <p className="text-sm font-semibold text-white">Reset</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">카메라와 움직임 기준점을 재정렬합니다.</p>
                      </button>
                      <button className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]" onClick={() => {
                        setAutoRotate((current) => {
                          const next = !current;
                          sendCommand('setAutoRotate', { enabled: next });
                          return next;
                        });
                      }} type="button">
                        <p className="text-sm font-semibold text-white">{autoRotate ? 'AutoRotate on' : 'AutoRotate off'}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">사용자 입력 후에도 서서히 다시 회전합니다.</p>
                      </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Palette</p>
                        <span className="text-xs text-slate-400">theme {themeIndex + 1}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {Array.from({ length: THEME_COUNT }, (_, index) => (
                          <button
                            key={index}
                            className={['h-9 w-9 rounded-full border transition', themeIndex === index ? 'border-white bg-white/80' : 'border-white/14 bg-white/[0.08]'].join(' ')}
                            onClick={() => {
                              manualThemeAtRef.current = Date.now();
                              setThemeIndex(index);
                              sendCommand('setTheme', { themeIndex: index });
                            }}
                            type="button"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Density</p>
                        <span className="text-xs text-slate-400">{density}%</span>
                      </div>
                      <input className="mt-4 h-2 w-full accent-cyan-300" max={140} min={60} onChange={(event) => {
                        const next = Number(event.target.value);
                        setDensity(next);
                        sendCommand('setDensity', { density: next });
                      }} type="range" value={density} />
                    </div>

                    <button className="w-full rounded-3xl border border-cyan-200/18 bg-cyan-300/[0.08] px-4 py-4 text-left transition hover:bg-cyan-300/[0.12]" onClick={() => sendCommand('pulse')} type="button">
                      <p className="text-sm font-semibold text-cyan-50">Pulse now</p>
                      <p className="mt-1 text-xs leading-6 text-cyan-100/80">현재 단계 강조와 함께 bloom / sparkle 반응을 한번 더 보냅니다.</p>
                    </button>
                  </div>
                ) : null}

                {panelTab === 'issue' ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-orange-200/16 bg-orange-300/[0.08] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-100">Review before send</p>
                      <p className="mt-3 text-sm leading-7 text-orange-50">MYBI는 현재 route, 최근 액션, 브라우저 오류 요약을 초안으로 묶어주지만 자동 발송하지 않습니다. 내용을 확인한 뒤 메일 초안을 직접 여는 방식입니다.</p>
                    </div>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Reporter email</span>
                      <input className="mt-2 w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-200/30" onChange={(event) => setReporterEmail(event.target.value)} placeholder="reply 받을 이메일" type="email" value={reporterEmail} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Optional screenshot</span>
                      <input accept="image/*" className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-950" onChange={(event) => setScreenshotName(event.target.files?.[0]?.name || null)} type="file" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Issue note</span>
                      <textarea className="mt-2 min-h-24 w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-200/30" onChange={(event) => setIssueNote(event.target.value)} placeholder="무슨 문제가 있었는지, 바로 전에 어떤 작업을 했는지 적어주세요." value={issueNote} />
                    </label>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-100">
                      <p><span className="font-semibold text-white">Route:</span> {pathname}</p>
                      <p><span className="font-semibold text-white">Recent action:</span> {recentActivity[0] || '없음'}</p>
                      <p><span className="font-semibold text-white">Browser errors:</span> {browserErrors.length ? browserErrors.join(' / ') : '없음'}</p>
                      <p><span className="font-semibold text-white">Screenshot:</span> {screenshotName || '첨부 안 함'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button className="rounded-full border border-white/14 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]" onClick={() => navigator.clipboard?.writeText(mailDraft.body)} type="button">
                        Copy summary
                      </button>
                      <a className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950" href={mailDraft.href} onClick={() => pushRecentActivity('MYBI issue mail draft opened')}>
                        Open mail draft
                      </a>
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
