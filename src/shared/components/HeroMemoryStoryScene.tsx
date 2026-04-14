import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/shared/components/Icons';

export type DiagnosisHeroStepId = 'store-check' | 'operations-connect' | 'customer-flow-diagnosis' | 'action-plan';

const sourceSignals = [
  { label: '공개 유입', icon: Icons.Globe },
  { label: '문의/상담', icon: Icons.Message },
  { label: '예약', icon: Icons.Reservation },
  { label: '웨이팅', icon: Icons.Waiting },
] as const;

const heroStageContent: Record<
  DiagnosisHeroStepId,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  'store-check': {
    eyebrow: 'STORE CHECK',
    title: '매장과 운영 문맥을 먼저 확인합니다',
    description: '업종, 피크 타임, 현장 대기 강도를 먼저 이해해야 어떤 고객 기억이 필요한지 정확해집니다.',
  },
  'operations-connect': {
    eyebrow: 'OPERATIONS CONNECT',
    title: '운영 신호를 한 흐름으로 연결합니다',
    description: '공개 유입, 문의, 예약, 웨이팅이 같은 고객 흐름으로 들어와야 다음 타임라인이 또렷해집니다.',
  },
  'customer-flow-diagnosis': {
    eyebrow: 'CUSTOMER FLOW',
    title: '고객 카드와 타임라인으로 병목을 읽습니다',
    description: '같은 고객의 이력이 이어지면 어디에서 전환이 끊겼는지, 누가 다시 올 가능성이 높은지 보입니다.',
  },
  'action-plan': {
    eyebrow: 'ACTION PLAN',
    title: '다음 행동과 매출 기회를 실행안으로 남깁니다',
    description: '재방문 타깃, 업셀 힌트, 운영자 추천이 남아야 고객 기억이 실제 매출로 이어집니다.',
  },
};

export function HeroMemoryStoryScene({ activeStep }: { activeStep: DiagnosisHeroStepId }) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const currentStage = heroStageContent[activeStep];

  return (
    <div className="relative mx-auto w-full max-w-[620px]" data-hero-step={activeStep}>
      <div className="relative min-h-[390px] overflow-hidden rounded-[38px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,19,0.98),rgba(7,9,13,0.98))] p-4 shadow-[0_36px_110px_-52px_rgba(0,0,0,0.92)] sm:min-h-[430px] sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,91,19,0.12),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.12),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
        <div className="absolute inset-0 opacity-12 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]" />

        <motion.div
          aria-hidden="true"
          className="absolute left-5 top-12 h-[186px] w-[164px] rounded-[30px] border border-white/6 bg-white/[0.02] backdrop-blur-[16px] sm:left-7 sm:top-14 sm:h-[210px] sm:w-[184px]"
          animate={
            prefersReducedMotion
              ? { opacity: 0.1, scale: 0.98 }
              : {
                  opacity: activeStep === 'store-check' ? 0.18 : 0.08,
                  scale: activeStep === 'store-check' ? 1 : 0.98,
                }
          }
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ filter: 'blur(1.8px)' }}
        >
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-200/50" />
              <span className="h-px flex-1 rounded-full bg-white/10" />
            </div>
            <div className="mt-5 h-11 w-11 rounded-2xl bg-white/[0.04]" />
            <div className="mt-6 space-y-2.5">
              <div className="h-2.5 rounded-full bg-white/[0.06]" />
              <div className="h-2.5 w-[72%] rounded-full bg-white/[0.04]" />
              <div className="h-2.5 w-[58%] rounded-full bg-white/[0.03]" />
            </div>
          </div>
        </motion.div>

        <motion.div
          aria-hidden="true"
          className="absolute bottom-11 right-5 h-[172px] w-[188px] rounded-[30px] border border-white/6 bg-white/[0.02] backdrop-blur-[16px] sm:bottom-12 sm:right-7 sm:h-[196px] sm:w-[212px]"
          animate={
            prefersReducedMotion
              ? { opacity: 0.1, scale: 0.98 }
              : {
                  opacity: activeStep === 'action-plan' ? 0.18 : 0.08,
                  scale: activeStep === 'action-plan' ? 1 : 0.975,
                }
          }
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ filter: 'blur(1.8px)' }}
        >
          <div className="p-4">
            <div className="ml-auto h-8 w-8 rounded-2xl border border-white/8 bg-white/[0.03]" />
            <div className="mt-5 flex items-end gap-2">
              {[44, 62, 76].map((height) => (
                <div key={height} className="flex h-20 flex-1 items-end rounded-[18px] bg-white/[0.04] p-2">
                  <div className="w-full rounded-full bg-white/[0.08]" style={{ height: `${height}%` }} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="absolute inset-x-4 top-[72px] z-20 sm:inset-x-0 sm:top-[84px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              className="mx-auto w-full max-w-[356px] rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(18,23,31,0.98),rgba(8,11,16,0.98))] p-5 text-white shadow-[0_40px_90px_-46px_rgba(0,0,0,0.98)] sm:max-w-[382px] sm:p-6"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12, scale: 0.985 }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{currentStage.eyebrow}</p>
                  <h3 className="mt-3 text-[1.34rem] font-semibold leading-[1.3] text-white sm:text-[1.48rem]">{currentStage.title}</h3>
                </div>
                <motion.div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-orange-100"
                  animate={
                    prefersReducedMotion
                      ? { scale: 1, borderColor: 'rgba(255,255,255,0.1)' }
                      : {
                          scale: [1, 1.06, 1],
                          borderColor: ['rgba(255,255,255,0.1)', 'rgba(251,191,36,0.32)', 'rgba(255,255,255,0.1)'],
                        }
                  }
                  transition={{ duration: 1.7, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                >
                  {activeStep === 'store-check' ? <Icons.Store size={18} /> : null}
                  {activeStep === 'operations-connect' ? <Icons.Globe size={18} /> : null}
                  {activeStep === 'customer-flow-diagnosis' ? <Icons.Users size={18} /> : null}
                  {activeStep === 'action-plan' ? <Icons.Zap size={18} /> : null}
                </motion.div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-[15px]">{currentStage.description}</p>

              {activeStep === 'store-check' ? (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-300/12 text-orange-100">
                      <Icons.Store size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">성수 브런치랩</p>
                      <p className="mt-1 text-xs text-slate-400">브런치 카페 · 주말 웨이팅 강한 매장</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {['점심 피크 운영', '지도/링크 유입 중심'].map((item) => (
                      <div key={item} className="rounded-[18px] bg-white/[0.04] px-3 py-2 text-xs text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeStep === 'operations-connect' ? (
                <div className="mt-5 space-y-3">
                  {sourceSignals.map((signal, index) => {
                    const Icon = signal.icon;

                    return (
                      <motion.div
                        key={signal.label}
                        className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-3"
                        initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.28, delay: prefersReducedMotion ? 0 : index * 0.05 }}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-200">
                          <Icon size={15} />
                        </div>
                        <span className="text-sm font-medium text-slate-100">{signal.label}</span>
                      </motion.div>
                    );
                  })}
                </div>
              ) : null}

              {activeStep === 'customer-flow-diagnosis' ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3">
                    <p className="text-base font-semibold text-white">김서연 고객</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">문의 → 예약 → 웨이팅 이력이 한 카드에 연결됨</p>
                  </div>

                  {[
                    { label: '문의 남김', detail: '주말 브런치 문의' },
                    { label: '예약 시도', detail: '토요일 12:30 · 2인' },
                    { label: '현장 방문', detail: '10분 대기 후 착석' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3 rounded-[20px] bg-white/[0.04] px-3 py-3">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-300" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeStep === 'action-plan' ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-[24px] border border-emerald-300/14 bg-emerald-300/8 px-4 py-4">
                    <p className="text-sm font-semibold text-white">주말 브런치 재방문 메시지 발송</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">문의 후 미예약 고객에게 주말 예약 가능 시간과 세트 업셀을 함께 제안합니다.</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {['재방문 타깃', '업셀 힌트', '운영자 메모'].map((item) => (
                      <div key={item} className="rounded-[18px] bg-white/[0.04] px-3 py-3 text-xs leading-5 text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-end gap-2">
                    {[42, 60, 78].map((height, index) => (
                      <div key={height} className="flex h-20 flex-1 items-end rounded-[20px] bg-white/[0.05] p-2">
                        <motion.div
                          className="w-full rounded-full bg-[linear-gradient(180deg,rgba(16,185,129,0.95),rgba(74,222,128,0.62))]"
                          animate={
                            prefersReducedMotion
                              ? { height: `${height}%` }
                              : { height: [`36%`, `${height}%`, `${Math.max(40, height - 7)}%`, `${height}%`] }
                          }
                          transition={{ duration: 1.35, delay: index * 0.08, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
