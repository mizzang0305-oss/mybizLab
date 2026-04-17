import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from 'react';
import { motion } from 'motion/react';

type DiagnosisWorldMode = 'landing' | 'onboarding';

interface DiagnosisWorldSceneState {
  mode: DiagnosisWorldMode;
  pulseKey: number;
  stepIndex: number;
}

interface DiagnosisWorldTargetState {
  element: HTMLElement | null;
  mode: DiagnosisWorldMode;
}

interface PersistentDiagnosisWorldContextValue {
  registerTarget: (element: HTMLElement | null, mode: DiagnosisWorldMode) => void;
  updateSceneState: (state: DiagnosisWorldSceneState) => void;
}

interface RectState {
  height: number;
  left: number;
  top: number;
  width: number;
}

const PersistentDiagnosisWorldContext = createContext<PersistentDiagnosisWorldContextValue | null>(null);

const INITIAL_SCENE_STATE: DiagnosisWorldSceneState = {
  mode: 'landing',
  pulseKey: 0,
  stepIndex: 0,
};

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

function useTargetMeasurement(active: boolean, targetElement: HTMLElement | null, setRect: (rect: RectState) => void) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') {
      return;
    }

    let raf = 0;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      if (!targetElement) {
        return;
      }

      setRect(rectFromElement(targetElement));
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
  }, [active, setRect, targetElement]);
}

function useWorldMessenger(
  active: boolean,
  iframeRef: RefObject<HTMLIFrameElement | null>,
  sceneState: DiagnosisWorldSceneState,
  ready: boolean,
) {
  useEffect(() => {
    if (!active || !ready || typeof window === 'undefined') {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'mybiz-world:update',
        payload: sceneState,
      },
      window.location.origin,
    );
  }, [active, iframeRef, ready, sceneState]);
}

export function PersistentDiagnosisWorldProvider({
  active,
  children,
}: PropsWithChildren<{ active: boolean }>) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [targetState, setTargetState] = useState<DiagnosisWorldTargetState>({ element: null, mode: 'landing' });
  const [rect, setRectState] = useState<RectState | null>(null);
  const [ready, setReady] = useState(false);
  const [sceneState, setSceneState] = useState(INITIAL_SCENE_STATE);

  const setRect = useCallback((nextRect: RectState) => {
    setRectState((current) => (sameRect(current, nextRect) ? current : nextRect));
  }, []);

  useTargetMeasurement(active, targetState.element, setRect);
  useWorldMessenger(active, iframeRef, sceneState, ready);

  const contextValue = useMemo<PersistentDiagnosisWorldContextValue>(
    () => ({
      registerTarget(element, mode) {
        setTargetState((current) => (current.element === element && current.mode === mode ? current : { element, mode }));

        if (element) {
          setRect(rectFromElement(element));
        }
      },
      updateSceneState(nextState) {
        setSceneState((current) => {
          if (
            current.mode === nextState.mode &&
            current.stepIndex === nextState.stepIndex &&
            current.pulseKey === nextState.pulseKey
          ) {
            return current;
          }

          return nextState;
        });
      },
    }),
    [],
  );

  const shellMode = targetState.mode;

  return (
    <PersistentDiagnosisWorldContext.Provider value={contextValue}>
      {children}

      {active ? (
        <motion.div
          animate={
            rect
              ? {
                  borderRadius: shellMode === 'landing' ? 0 : 32,
                  height: rect.height,
                  left: rect.left,
                  opacity: 1,
                  top: rect.top,
                  width: rect.width,
                }
              : { opacity: 0 }
          }
          className="pointer-events-none fixed z-30 overflow-hidden bg-[#02050a]"
          data-diagnosis-world-shell={active ? 'active' : 'inactive'}
          initial={false}
          style={{ willChange: 'left, top, width, height, border-radius' }}
          transition={{
            borderRadius: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
            default: { damping: 34, mass: 0.88, stiffness: 300, type: 'spring' },
            opacity: { duration: 0.18, ease: 'easeOut' },
          }}
        >
          <div
            className={[
              'absolute inset-0 transition-[box-shadow,background] duration-500',
              shellMode === 'landing'
                ? 'bg-[#02050a]'
                : 'bg-[linear-gradient(180deg,rgba(4,7,13,0.92),rgba(2,5,10,0.82))] shadow-[0_40px_120px_-54px_rgba(0,0,0,0.92)] ring-1 ring-white/10',
            ].join(' ')}
          />
          <iframe
            ref={iframeRef}
            className="pointer-events-auto absolute inset-0 h-full w-full border-0"
            onLoad={() => setReady(true)}
            src="/neural-world.html"
            title="MyBiz diagnosis world"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.06),transparent_16%),linear-gradient(180deg,rgba(2,5,10,0)_0%,rgba(2,5,10,0.16)_36%,rgba(2,5,10,0.44)_100%)]" />
        </motion.div>
      ) : null}
    </PersistentDiagnosisWorldContext.Provider>
  );
}

export function usePersistentDiagnosisWorldSurface(sceneState: DiagnosisWorldSceneState) {
  const context = useContext(PersistentDiagnosisWorldContext);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!context) {
      return;
    }

    context.registerTarget(targetRef.current, sceneState.mode);
  }, [context, sceneState.mode]);

  useEffect(() => {
    context?.updateSceneState(sceneState);
  }, [context, sceneState]);

  return targetRef;
}
