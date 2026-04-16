import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { DiagnosisCinemaStage } from '@/shared/components/DiagnosisCinemaStage';
import { cn } from '@/shared/lib/format';
import {
  DIAGNOSIS_CORRIDOR_STEPS,
  getDiagnosisCorridorStep,
  isDiagnosisCorridorFinalStep,
} from '@/shared/lib/diagnosisCorridor';

const finalPlanTruth = [
  {
    name: 'FREE',
    label: 'public acquisition',
    summary: '공개 스토어를 무료 acquisition 입구로 열고 첫 신호를 붙잡습니다.',
  },
  {
    name: 'PRO',
    label: 'memory operations',
    summary: '문의, 예약, 웨이팅을 고객 기억과 타임라인으로 묶어 운영 흐름으로 연결합니다.',
  },
  {
    name: 'VIP',
    label: 'revenue recovery',
    summary: '다음 액션과 회복 매출 payoff를 더 깊게 운영하는 단계입니다.',
  },
] as const;

const stepSupportCopy = [
  '입장 직후에는 거의 비어 있는 dark stage만 남기고, 얇은 신호 한 줄만 스토어 문맥을 향해 들어오게 했습니다.',
  '문의, 예약, 웨이팅은 무거운 카드가 아니라 가지처럼 갈라지는 신호 채널로만 보여줍니다.',
  '이 단계가 MyBiz의 중심입니다. 세 채널이 하나의 customer memory core와 타임라인 핵으로 결합됩니다.',
  '아직 dashboard는 보이지 않습니다. 기억 코어에서 바로 실행할 액션만 바깥으로 방출됩니다.',
  '먼저 generated store가 떠오르고, 그 위로 operator dashboard payoff가 안착하며 같은 시스템의 결과임을 보여줍니다.',
] as const;

export function DiagnosisCinemaShell({
  currentStepIndex,
  onBack,
  onContinue,
  onEntryTransitionComplete,
  onNext,
  showEntryTransition,
}: {
  currentStepIndex: number;
  onBack: () => void;
  onContinue: () => void;
  onEntryTransitionComplete?: () => void;
  onNext: () => void;
  showEntryTransition?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const activeStep = getDiagnosisCorridorStep(currentStepIndex);
  const isFinalStep = isDiagnosisCorridorFinalStep(currentStepIndex);

  return (
    <section className="relative min-h-[calc(100svh-84px)] overflow-hidden border-b border-white/10 bg-[#02050a]" data-diagnosis-shell="cinema">
      <AnimatePresence
        onExitComplete={() => {
          onEntryTransitionComplete?.();
        }}
      >
        {showEntryTransition ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[40] flex items-center justify-center bg-[#02050a]/86 px-6 backdrop-blur-xl"
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,91,19,0.16),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(96,165,250,0.16),transparent_22%)]" />
            <motion.div
              aria-hidden="true"
              className="absolute left-[12%] right-[12%] top-1/2 h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.8))]"
              initial={{ scaleX: 0.12 }}
              animate={{ scaleX: 1 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.div
              className="relative w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.96),rgba(4,8,13,0.94))] p-6 text-white shadow-[0_36px_120px_-72px_rgba(0,0,0,0.98)]"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">Diagnosis cinema</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">같은 dark world 안에서 진단 시네마가 바로 열립니다.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                signal enters, splits, condenses, customer memory로 결합된 뒤 생성된 스토어와 dashboard payoff가 마지막 장면으로 등장합니다.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(236,91,19,0.12),transparent_28%),radial-gradient(circle_at_84%_10%,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,#02050a_0%,#04070d_36%,#03050a_100%)]"
        animate={{ opacity: isFinalStep ? 0.92 : 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 opacity-12 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="page-shell relative flex min-h-[calc(100svh-84px)] flex-col py-6 sm:py-8">
        <div className="relative mb-8 sm:mb-10">
          <div className="absolute left-0 right-0 top-[16px] h-px bg-white/10" />
          <motion.div
            aria-hidden="true"
            className="absolute left-0 top-[16px] h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.8))]"
            animate={{ width: `${((currentStepIndex + 1) / DIAGNOSIS_CORRIDOR_STEPS.length) * 100}%` }}
            transition={{ duration: 0.64, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute top-[16px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/40 bg-orange-300 shadow-[0_0_28px_rgba(251,146,60,0.95)]"
            animate={{ left: `${((currentStepIndex + 1) / DIAGNOSIS_CORRIDOR_STEPS.length) * 100}%` }}
            transition={{ duration: 0.64, ease: [0.22, 1, 0.36, 1] }}
          />

          <nav aria-label="진단 단계" className="relative grid grid-cols-5 gap-2 sm:gap-3">
            {DIAGNOSIS_CORRIDOR_STEPS.map((step, index) => {
              const active = index === currentStepIndex;
              const reached = index < currentStepIndex;

              return (
                <button
                  key={step.id}
                  aria-current={active ? 'step' : undefined}
                  className="rounded-[20px] px-1.5 pb-1 pt-7 text-left transition sm:px-2"
                  disabled
                  type="button"
                >
                  <div
                    className={[
                      'mb-2 h-2.5 w-2.5 rounded-full border transition',
                      active
                        ? 'border-orange-200/50 bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.85)]'
                        : reached
                          ? 'border-white/25 bg-white/30'
                          : 'border-white/10 bg-[#07090d]',
                    ].join(' ')}
                  />
                  <p className={['text-[10px] font-semibold uppercase tracking-[0.18em] transition', active ? 'text-orange-100' : 'text-slate-500'].join(' ')}>
                    {step.number}
                  </p>
                  <p className={['mt-1 text-sm font-semibold leading-5 transition', active ? 'text-white' : 'text-slate-300'].join(' ')}>
                    {step.label}
                  </p>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(18rem,0.74fr)_minmax(0,1.26fr)] lg:items-stretch lg:gap-12">
          <div className="relative z-10 flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                Customer-memory revenue system
              </span>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.34, ease: 'easeOut' }}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {activeStep.number} {activeStep.label}
                  </p>
                  <h1 className="mt-4 max-w-[11ch] text-balance font-display text-[2.5rem] font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-[3rem] lg:text-[3.6rem]">
                    {activeStep.title}
                  </h1>
                  <p className="mt-4 max-w-[31rem] text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">{activeStep.detail}</p>
                </motion.div>
              </AnimatePresence>

              <div className="flex flex-wrap gap-2">
                {activeStep.highlights.map((item) => (
                  <motion.span
                    key={`${activeStep.id}-${item}`}
                    className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  >
                    {item}
                  </motion.span>
                ))}
              </div>

              <motion.div
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_80px_-62px_rgba(0,0,0,0.98)] backdrop-blur-xl"
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, ease: 'easeOut' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current diagnosis support</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{stepSupportCopy[currentStepIndex]}</p>
              </motion.div>
            </div>

            <div className="space-y-5">
              {isFinalStep ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {finalPlanTruth.map((plan) => (
                    <div
                      key={plan.name}
                      className={cn(
                        'rounded-[24px] border px-4 py-4 backdrop-blur-xl',
                        plan.name === 'FREE' && 'border-white/10 bg-white/[0.04]',
                        plan.name === 'PRO' && 'border-orange-300/30 bg-orange-300/[0.08]',
                        plan.name === 'VIP' && 'border-emerald-300/20 bg-emerald-300/[0.08]',
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{plan.label}</p>
                      <p className="mt-2 text-2xl font-black text-white">{plan.name}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{plan.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="btn-secondary min-w-[160px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:border-white/8 disabled:bg-white/[0.02] disabled:text-slate-500"
                  data-diagnosis-back="true"
                  disabled={currentStepIndex === 0}
                  onClick={onBack}
                  type="button"
                >
                  이전
                </button>
                {isFinalStep ? (
                  <button className="btn-primary min-w-[210px]" data-diagnosis-continue="true" onClick={onContinue} type="button">
                    스토어 설정 계속
                  </button>
                ) : (
                  <button className="btn-primary min-w-[210px]" data-diagnosis-next="true" onClick={onNext} type="button">
                    다음 단계
                  </button>
                )}
              </div>

              <p className="text-sm leading-6 text-slate-400">
                매 클릭마다 full-screen background field, luminous rail, signal geometry, text panel, store/dashboard reveal이 같은 상태 기계로 다시 조합됩니다.
              </p>
            </div>
          </div>

          <DiagnosisCinemaStage className="min-h-[34rem] lg:min-h-full" stepIndex={currentStepIndex} />
        </div>
      </div>
    </section>
  );
}
