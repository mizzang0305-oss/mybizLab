import { Suspense, lazy, startTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { DiagnosisCinemaStage } from '@/shared/components/DiagnosisCinemaStage';
import {
  DIAGNOSIS_CORRIDOR_STEPS,
  getDiagnosisCorridorStep,
  getDiagnosisSceneState,
  isDiagnosisCorridorFinalStep,
} from '@/shared/lib/diagnosisCorridor';

const DiagnosisCinemaWorld = lazy(async () => {
  const module = await import('@/shared/components/DiagnosisCinemaWorld');

  return { default: module.DiagnosisCinemaWorld };
});

export function DiagnosisCinemaShell({
  currentStepIndex,
  forceReducedMotion = false,
  onBack,
  onContinue,
  onEntryTransitionComplete,
  onNext,
  showEntryTransition,
}: {
  currentStepIndex: number;
  forceReducedMotion?: boolean;
  onBack: () => void;
  onContinue: () => void;
  onEntryTransitionComplete?: () => void;
  onNext: () => void;
  showEntryTransition?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const useReducedScene = forceReducedMotion || prefersReducedMotion;
  const activeStep = getDiagnosisCorridorStep(currentStepIndex);
  const isFinalStep = isDiagnosisCorridorFinalStep(currentStepIndex);
  const sceneState = getDiagnosisSceneState(currentStepIndex);

  return (
    <section
      className="relative min-h-[calc(100svh-84px)] overflow-hidden border-b border-white/10 bg-[#02050a]"
      data-diagnosis-shell="cinema"
    >
      <AnimatePresence onExitComplete={() => onEntryTransitionComplete?.()}>
        {showEntryTransition ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[40] flex items-center justify-center bg-[#02050a]/88 px-6 backdrop-blur-xl"
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,91,19,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(96,165,250,0.14),transparent_22%)]" />
            <motion.div
              className="absolute left-[10%] right-[10%] top-1/2 h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.8))]"
              animate={{ scaleX: 1 }}
              initial={{ scaleX: 0.12 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.82, ease: 'easeOut' }}
            />
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,21,0.94),rgba(4,7,12,0.9))] p-5 text-white shadow-[0_36px_120px_-72px_rgba(0,0,0,0.98)]"
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">Diagnosis cinema</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">같은 dark world 안에서 진단이 바로 이어집니다.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                신호가 들어오고, 갈라지고, 압축되고, 스토어와 운영 화면으로 끝나는 MyBiz의 기억 엔진을 한 화면에서 보여줍니다.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-0">
        <Suspense fallback={<DiagnosisCinemaStage renderMode="fallback" stepIndex={currentStepIndex} />}>
          {useReducedScene ? (
            <DiagnosisCinemaStage renderMode="reduced" stepIndex={currentStepIndex} />
          ) : (
            <DiagnosisCinemaWorld stepIndex={currentStepIndex} />
          )}
        </Suspense>
      </div>

      <div className="pointer-events-none relative z-20 flex min-h-[calc(100svh-84px)] flex-col justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="relative">
            <div className="absolute inset-x-0 top-3 h-px bg-white/10" />
            <motion.div
              aria-hidden="true"
              className="absolute left-0 top-3 h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.8))]"
              animate={{ width: `${((currentStepIndex + 1) / DIAGNOSIS_CORRIDOR_STEPS.length) * 100}%` }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            />
            <nav aria-label="진단 단계" className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
              {DIAGNOSIS_CORRIDOR_STEPS.map((step, index) => {
                const active = index === currentStepIndex;

                return (
                  <div key={step.id} className="pt-6 text-left">
                    <div
                      className={[
                        'mb-2 h-2.5 w-2.5 rounded-full border transition',
                        active
                          ? 'border-orange-200/50 bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.9)]'
                          : index < currentStepIndex
                            ? 'border-white/20 bg-white/30'
                            : 'border-white/10 bg-[#07090d]',
                      ].join(' ')}
                    />
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${active ? 'text-orange-100' : 'text-slate-500'}`}>{step.number}</p>
                    <p className={`mt-1 hidden text-xs font-semibold sm:block ${active ? 'text-white' : 'text-slate-400'}`}>{step.label}</p>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[1200px] items-end justify-between gap-6">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto max-w-[18rem] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,20,0.76),rgba(4,7,12,0.52))] px-4 py-4 text-white shadow-[0_28px_90px_-56px_rgba(0,0,0,0.98)] backdrop-blur-xl sm:max-w-[21rem] sm:px-5 sm:py-5"
            initial={{ opacity: 0, y: 14 }}
            key={activeStep.id}
            transition={{ duration: 0.34, ease: 'easeOut' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">
              {activeStep.number} {activeStep.label}
            </p>
            <h1 className="mt-3 break-keep font-display text-[1.95rem] font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-[2.4rem]">
              {activeStep.headlineLines.map((line) => (
                <span key={`${activeStep.id}-${line}`} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-3 break-keep text-sm leading-6 text-slate-300">{activeStep.supportLine}</p>
          </motion.div>

          <div className="pointer-events-auto flex items-center gap-3 self-end">
            <button
              className="btn-secondary border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:border-white/8 disabled:bg-white/[0.02] disabled:text-slate-500"
              data-diagnosis-back="true"
              disabled={currentStepIndex === 0}
              onClick={() =>
                startTransition(() => {
                  onBack();
                })
              }
              type="button"
            >
              이전
            </button>
            <button
              className="btn-primary min-w-[156px]"
              data-diagnosis-next={isFinalStep ? undefined : 'true'}
              data-diagnosis-continue={isFinalStep ? 'true' : undefined}
              onClick={() =>
                startTransition(() => {
                  if (isFinalStep) {
                    onContinue();
                    return;
                  }

                  onNext();
                })
              }
              type="button"
            >
              {isFinalStep ? '계속' : '다음'}
            </button>
          </div>
        </div>
      </div>

      {sceneState.showGeneratedStore ? <span className="hidden" data-diagnosis-store-reveal="true" /> : null}
      {sceneState.showDashboardPayoff ? <span className="hidden" data-diagnosis-dashboard-payoff="true" /> : null}
    </section>
  );
}
