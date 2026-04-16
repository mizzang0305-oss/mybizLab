import { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { DiagnosisCinemaStage } from '@/shared/components/DiagnosisCinemaStage';
import {
  DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS,
  DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS,
  DIAGNOSIS_CORRIDOR_LAST_INDEX,
  DIAGNOSIS_CORRIDOR_STEPS,
  getDiagnosisCorridorStep,
  getDiagnosisSceneState,
} from '@/shared/lib/diagnosisCorridor';

const DiagnosisCinemaWorld = lazy(async () => {
  const module = await import('@/shared/components/DiagnosisCinemaWorld');

  return { default: module.DiagnosisCinemaWorld };
});

type DiagnosisCinemaPlaybackState = 'intro' | 'playing' | 'complete';

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
  const [currentStepIndex, setCurrentStepIndex] = useState(() => (startCompleted ? DIAGNOSIS_CORRIDOR_LAST_INDEX : 0));
  const [playbackState, setPlaybackState] = useState<DiagnosisCinemaPlaybackState>(() =>
    startCompleted ? 'complete' : showEntryTransition ? 'intro' : 'playing',
  );
  const [replayCount, setReplayCount] = useState(0);
  const activeStep = getDiagnosisCorridorStep(currentStepIndex);
  const sceneState = getDiagnosisSceneState(currentStepIndex);
  const showFinalControls = playbackState === 'complete';
  const playbackRestartKey = `${playbackSeed}:${replayCount}`;

  useEffect(() => {
    if (startCompleted) {
      setCurrentStepIndex(DIAGNOSIS_CORRIDOR_LAST_INDEX);
      setPlaybackState('complete');
      return;
    }

    setCurrentStepIndex(0);
    setPlaybackState(showEntryTransition ? 'intro' : 'playing');
  }, [playbackRestartKey, showEntryTransition, startCompleted]);

  useEffect(() => {
    if (startCompleted || showEntryTransition) {
      return;
    }

    setPlaybackState('playing');

    const timeouts: number[] = [];
    let elapsedMs = 0;

    for (let index = 0; index < DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS.length - 1; index += 1) {
      elapsedMs += DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[index];
      const nextStepIndex = index + 1;

      timeouts.push(
        window.setTimeout(() => {
          setCurrentStepIndex(nextStepIndex);
        }, elapsedMs),
      );
    }

    timeouts.push(
      window.setTimeout(() => {
        setCurrentStepIndex(DIAGNOSIS_CORRIDOR_LAST_INDEX);
        setPlaybackState('complete');
      }, DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [playbackRestartKey, showEntryTransition, startCompleted]);

  return (
    <section
      className="relative min-h-[calc(100svh-84px)] overflow-hidden border-b border-white/10 bg-[#02050a]"
      data-diagnosis-autoplay="true"
      data-diagnosis-autoplay-state={playbackState}
      data-diagnosis-current-step={activeStep.id}
      data-diagnosis-shell="cinema"
    >
      <AnimatePresence initial={false}>
        {showEntryTransition ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[40] flex items-center justify-center bg-[#02050a]/92 backdrop-blur-xl"
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(236,91,19,0.18),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(96,165,250,0.14),transparent_22%)]" />
            <motion.div
              className="absolute left-[14%] right-[14%] top-1/2 h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.82))]"
              initial={{ scaleX: 0.18 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
              animate={{ scaleX: 1 }}
            />
            <motion.p
              className="relative text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-100"
              initial={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, delay: 0.06, ease: 'easeOut' }}
              animate={{ opacity: 1, y: 0 }}
            >
              MyBiz Diagnosis Cinema
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-0">
        <Suspense fallback={<DiagnosisCinemaStage renderMode="fallback" stepIndex={currentStepIndex} />}>
          {useReducedScene ? (
            <DiagnosisCinemaStage isFrozen={showFinalControls} renderMode="reduced" stepIndex={currentStepIndex} />
          ) : (
            <DiagnosisCinemaWorld isFrozen={showFinalControls} stepIndex={currentStepIndex} />
          )}
        </Suspense>
      </div>

      <div className="pointer-events-none relative z-20 flex min-h-[calc(100svh-84px)] flex-col justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="mx-auto flex w-full max-w-[1200px] items-start justify-between gap-4">
          <div className="max-w-[28rem] flex-1">
            <div className="relative pt-3">
              <div className="absolute inset-x-0 top-3 h-px bg-white/10" />
              <motion.div
                aria-hidden="true"
                className="absolute left-0 top-3 h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.8))]"
                animate={{ width: `${((currentStepIndex + 1) / DIAGNOSIS_CORRIDOR_STEPS.length) * 100}%` }}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              />
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {DIAGNOSIS_CORRIDOR_STEPS.map((step, index) => {
                  const active = index === currentStepIndex;

                  return (
                    <div key={step.id} aria-label={`${step.number} ${step.label}`} className="pt-5 text-left">
                      <div
                        className={[
                          'mb-2 h-2 w-2 rounded-full border transition',
                          active
                            ? 'border-orange-200/50 bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.9)]'
                            : index < currentStepIndex
                              ? 'border-white/20 bg-white/30'
                              : 'border-white/10 bg-[#07090d]',
                        ].join(' ')}
                      />
                      <p className={`text-[10px] font-semibold tracking-[0.18em] ${active ? 'text-orange-100' : 'text-slate-500'}`}>
                        {step.number}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!showFinalControls ? (
            <button
              className="pointer-events-auto rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/88 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.08]"
              data-diagnosis-skip="true"
              onClick={onSkip}
              type="button"
            >
              건너뛰고 바로 시작
            </button>
          ) : (
            <div className="h-9" />
          )}
        </div>

        <div className="mx-auto flex w-full max-w-[1200px] items-end justify-between gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="max-w-[17rem] text-white sm:max-w-[19rem]"
              initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
              exit={{ opacity: 0, y: -14, filter: 'blur(10px)' }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                {activeStep.number} {activeStep.label}
              </p>
              <h1 className="mt-3 break-keep text-balance font-display text-[2rem] font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-[2.7rem]">
                {activeStep.headlineLines.map((line) => (
                  <span key={`${activeStep.id}-${line}`} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              <p className="mt-3 break-keep text-sm leading-6 text-slate-300">{activeStep.supportLine}</p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showFinalControls ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto flex items-center gap-3 self-end"
                initial={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
              >
                <button
                  className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/88 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.08]"
                  data-diagnosis-replay="true"
                  onClick={() => {
                    setReplayCount((current) => current + 1);
                  }}
                  type="button"
                >
                  다시 보기
                </button>
                <button className="btn-primary" data-diagnosis-final-cta="true" onClick={onContinue} type="button">
                  스토어 설정 계속
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {sceneState.showGeneratedStore ? <span className="hidden" data-diagnosis-store-reveal="true" /> : null}
      {sceneState.showDashboardPayoff ? <span className="hidden" data-diagnosis-dashboard-payoff="true" /> : null}
    </section>
  );
}
