import { Suspense, lazy, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import DiagnosisCinemaStage from '@/shared/components/DiagnosisCinemaStage';
import {
  DIAGNOSIS_AUTOPLAY_INTRO_VEIL_MS,
  DIAGNOSIS_CORRIDOR_LAST_INDEX,
  DIAGNOSIS_CORRIDOR_STEPS,
  DIAGNOSIS_FINAL_CTA_DELAY_MS,
  DIAGNOSIS_STEP_FLASH_MS,
  DIAGNOSIS_STEP_MORPH_MS,
  getDiagnosisCorridorStep,
  getDiagnosisSceneState,
  getNextDiagnosisCorridorStepIndex,
  isDiagnosisCorridorFinalStep,
} from '@/shared/lib/diagnosisCorridor';

const DiagnosisCinemaWorld = lazy(async () => {
  const module = await import('@/shared/components/DiagnosisCinemaWorld');

  return { default: module.DiagnosisCinemaWorld };
});

function clearTimers(timeoutsRef: MutableRefObject<number[]>) {
  timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
  timeoutsRef.current = [];
}

export function DiagnosisCinemaShell({
  forceReducedMotion = false,
  onContinue,
  onSkip,
  playbackSeed = 0,
  showEntryTransition = false,
  startCompleted = false,
}: {
  forceReducedMotion?: boolean;
  onContinue: () => void;
  onSkip: () => void;
  playbackSeed?: number;
  showEntryTransition?: boolean;
  startCompleted?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const useReducedScene = forceReducedMotion || prefersReducedMotion;
  const timersRef = useRef<number[]>([]);
  const playbackRestartKey = useMemo(() => `${playbackSeed}:${startCompleted ? 'final' : 'play'}`, [playbackSeed, startCompleted]);

  const [currentStepIndex, setCurrentStepIndex] = useState(() => (startCompleted ? DIAGNOSIS_CORRIDOR_LAST_INDEX : 0));
  const [flashSeed, setFlashSeed] = useState(0);
  const [flashVisible, setFlashVisible] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);
  const [isFinalCtaVisible, setIsFinalCtaVisible] = useState(() => startCompleted);
  const [showIntroVeil, setShowIntroVeil] = useState(() => showEntryTransition && !startCompleted);

  useEffect(() => {
    clearTimers(timersRef);

    setCurrentStepIndex(startCompleted ? DIAGNOSIS_CORRIDOR_LAST_INDEX : 0);
    setFlashVisible(false);
    setIsMorphing(false);
    setIsFinalCtaVisible(startCompleted);
    setShowIntroVeil(showEntryTransition && !startCompleted);

    if (!showEntryTransition || startCompleted) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowIntroVeil(false);
    }, DIAGNOSIS_AUTOPLAY_INTRO_VEIL_MS);

    timersRef.current.push(timeout);

    return () => {
      clearTimers(timersRef);
    };
  }, [playbackRestartKey, showEntryTransition, startCompleted]);

  useEffect(() => {
    return () => {
      clearTimers(timersRef);
    };
  }, []);

  const activeStep = getDiagnosisCorridorStep(currentStepIndex);
  const sceneState = getDiagnosisSceneState(currentStepIndex);
  const isFinalStep = isDiagnosisCorridorFinalStep(currentStepIndex);
  const isFrozen = isFinalStep && isFinalCtaVisible;

  function triggerFlash(nextStepIndex: number) {
    setFlashSeed((current) => current + 1);
    setFlashVisible(true);
    setIsMorphing(true);
    setIsFinalCtaVisible(false);

    timersRef.current.push(
      window.setTimeout(() => {
        setFlashVisible(false);
      }, DIAGNOSIS_STEP_FLASH_MS),
    );

    timersRef.current.push(
      window.setTimeout(() => {
        setCurrentStepIndex(nextStepIndex);
      }, Math.round(DIAGNOSIS_STEP_FLASH_MS * 0.45)),
    );

    timersRef.current.push(
      window.setTimeout(() => {
        setIsMorphing(false);
        if (nextStepIndex === DIAGNOSIS_CORRIDOR_LAST_INDEX) {
          setIsFinalCtaVisible(true);
        }
      }, nextStepIndex === DIAGNOSIS_CORRIDOR_LAST_INDEX ? DIAGNOSIS_FINAL_CTA_DELAY_MS : DIAGNOSIS_STEP_MORPH_MS),
    );
  }

  function handlePrimaryAction() {
    if (isMorphing) {
      return;
    }

    if (isFinalStep) {
      if (isFinalCtaVisible) {
        onContinue();
      }
      return;
    }

    clearTimers(timersRef);
    triggerFlash(getNextDiagnosisCorridorStepIndex(currentStepIndex));
  }

  const primaryLabel = isMorphing ? '재구성 중' : isFinalStep ? (isFinalCtaVisible ? '스토어 설정 계속' : '정착 중') : '다음';

  return (
    <section
      className="relative min-h-[calc(100svh-84px)] overflow-hidden border-b border-white/10 bg-[#02050a]"
      data-diagnosis-current-step={activeStep.id}
      data-diagnosis-interaction="manual"
      data-diagnosis-morphing={isMorphing}
      data-diagnosis-shell="cinema"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(129,140,248,0.12),transparent_26%),radial-gradient(circle_at_18%_18%,rgba(96,165,250,0.08),transparent_22%),radial-gradient(circle_at_84%_24%,rgba(255,255,255,0.07),transparent_18%),linear-gradient(180deg,#02050a_0%,#030711_52%,#02050a_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,10,0)_0%,rgba(2,5,10,0.18)_35%,rgba(2,5,10,0.84)_100%)]" />

      <AnimatePresence initial={false}>
        {showIntroVeil ? (
          <motion.div
            key="diagnosis-intro-veil"
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 z-[45] bg-[#02050a]/94 backdrop-blur-xl"
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_18%),radial-gradient(circle_at_52%_48%,rgba(251,146,60,0.18),transparent_12%)]" />
            <motion.div
              animate={{ scale: 1, opacity: 1 }}
              className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/26 bg-orange-300/[0.06]"
              initial={{ scale: 0.56, opacity: 0.2 }}
              transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-1/2 top-[58%] -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-200"
              initial={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, delay: 0.08, ease: 'easeOut' }}
            >
              MyBiz Crystal Network
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {flashVisible ? (
          <motion.div
            key={`diagnosis-flash-${flashSeed}`}
            animate={{ opacity: [0, 1, 0] }}
            className="pointer-events-none absolute inset-0 z-[35] bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.88),rgba(255,255,255,0.08)_18%,rgba(2,5,10,0)_36%)] mix-blend-screen"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.34, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-0">
        <Suspense fallback={<DiagnosisCinemaStage isFrozen={isFrozen} pulseSeed={flashSeed} renderMode="fallback" stepIndex={currentStepIndex} />}>
          {useReducedScene ? (
            <DiagnosisCinemaStage isFrozen={isFrozen} pulseSeed={flashSeed} renderMode="reduced" stepIndex={currentStepIndex} />
          ) : (
            <DiagnosisCinemaWorld isFrozen={isFrozen} pulseSeed={flashSeed} stepIndex={currentStepIndex} />
          )}
        </Suspense>
      </div>

      <div className="pointer-events-none relative z-20 flex min-h-[calc(100svh-84px)] flex-col justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="mx-auto flex w-full max-w-[1320px] items-start justify-between gap-4">
          <div className="max-w-[20rem] flex-1">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-xl">
              {DIAGNOSIS_CORRIDOR_STEPS.map((step, index) => {
                const active = index === currentStepIndex;

                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <div
                      className={[
                        'h-1.5 rounded-full transition-all duration-500',
                        active
                          ? 'w-8 bg-orange-200 shadow-[0_0_24px_rgba(251,146,60,0.78)]'
                          : index < currentStepIndex
                            ? 'w-4 bg-white/55'
                            : 'w-4 bg-white/16',
                      ].join(' ')}
                    />
                    <span className={`text-[10px] font-semibold tracking-[0.18em] ${active ? 'text-white' : 'text-slate-500'}`}>
                      {step.number}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {!isFinalStep ? (
            <button
              className="pointer-events-auto rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/84 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.08]"
              data-diagnosis-skip="true"
              onClick={onSkip}
              type="button"
            >
              건너뛰기
            </button>
          ) : (
            <div className="h-9" />
          )}
        </div>

        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="max-w-[18rem] text-white sm:max-w-[22rem]"
              exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
              initial={{ opacity: 0, y: 18, filter: 'blur(14px)' }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                {activeStep.number} {activeStep.label}
              </p>
              <h1 className="mt-3 break-keep text-balance font-display text-[2rem] font-black leading-[0.94] tracking-[-0.06em] text-white sm:text-[2.9rem]">
                {activeStep.headlineLines.map((line) => (
                  <span key={`${activeStep.id}-${line}`} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              <p className="mt-3 max-w-[26ch] break-keep text-sm leading-6 text-slate-300">{activeStep.supportLine}</p>
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-auto flex items-center justify-start sm:justify-end">
            <button
              className={[
                'rounded-full px-6 py-3 text-sm font-semibold tracking-[0.04em] text-white transition duration-200',
                'shadow-[0_24px_80px_-34px_rgba(251,146,60,0.8)]',
                isMorphing || (isFinalStep && !isFinalCtaVisible)
                  ? 'cursor-not-allowed bg-white/10 text-white/55'
                  : 'bg-[linear-gradient(135deg,#ff8a2b,#ec5b13)] hover:scale-[1.02] hover:shadow-[0_32px_96px_-36px_rgba(251,146,60,0.88)]',
              ].join(' ')}
              data-diagnosis-final-cta={isFinalStep && isFinalCtaVisible}
              data-diagnosis-next={!isFinalStep}
              disabled={isMorphing || (isFinalStep && !isFinalCtaVisible)}
              onClick={handlePrimaryAction}
              type="button"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>

      {sceneState.showGeneratedStore ? <span className="hidden" data-diagnosis-store-reveal="true" /> : null}
      {sceneState.showDashboardPayoff ? <span className="hidden" data-diagnosis-dashboard-payoff="true" /> : null}
    </section>
  );
}
