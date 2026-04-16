import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/shared/components/Icons';
import { cn } from '@/shared/lib/format';
import { clampDiagnosisCorridorStepIndex } from '@/shared/lib/diagnosisCorridor';

const stageThemes = [
  {
    glowLeft: '18%',
    glowTop: '16%',
    glowColor: 'rgba(236,91,19,0.2)',
    ambientOpacity: 0.42,
    gridOpacity: 0.12,
    scale: 1,
    shiftX: 0,
    shiftY: 0,
  },
  {
    glowLeft: '24%',
    glowTop: '18%',
    glowColor: 'rgba(236,91,19,0.22)',
    ambientOpacity: 0.48,
    gridOpacity: 0.13,
    scale: 1.02,
    shiftX: -18,
    shiftY: 4,
  },
  {
    glowLeft: '48%',
    glowTop: '24%',
    glowColor: 'rgba(251,146,60,0.26)',
    ambientOpacity: 0.56,
    gridOpacity: 0.14,
    scale: 1.05,
    shiftX: -24,
    shiftY: -10,
  },
  {
    glowLeft: '62%',
    glowTop: '22%',
    glowColor: 'rgba(52,211,153,0.18)',
    ambientOpacity: 0.54,
    gridOpacity: 0.12,
    scale: 1.04,
    shiftX: -14,
    shiftY: -12,
  },
  {
    glowLeft: '74%',
    glowTop: '20%',
    glowColor: 'rgba(96,165,250,0.18)',
    ambientOpacity: 0.6,
    gridOpacity: 0.14,
    scale: 1.08,
    shiftX: -26,
    shiftY: -14,
  },
] as const;

const channelSignals = [
  { label: '문의', left: '49%', top: '23%', Icon: Icons.Message },
  { label: '예약', left: '61%', top: '48%', Icon: Icons.Reservation },
  { label: '웨이팅', left: '49%', top: '74%', Icon: Icons.Waiting },
] as const;

const actionSignals = [
  { label: '리마인드 메시지', left: '78%', top: '24%' },
  { label: '업셀 힌트', left: '87%', top: '48%' },
  { label: '예약 후속 조치', left: '78%', top: '72%' },
] as const;

const publicSignals = ['공개 스토어 유입', '스토어 문맥 확인', '첫 방문 신호'];
const memorySignals = ['문의 기록', '예약 시도', '웨이팅 이력', '재방문 가능성'];
const storeMetrics = [
  { label: 'FREE acquisition', value: '활성' },
  { label: 'capture channels', value: '3' },
  { label: 'memory engine', value: 'ready' },
] as const;
const dashboardMetrics = [
  { label: '리마인드 복구', value: '+18%' },
  { label: '예약 후속 전환', value: '+12%' },
  { label: '업셀 반응', value: '+9%' },
] as const;

export function DiagnosisCinemaStage({
  className,
  stepIndex,
  teaser = false,
}: {
  className?: string;
  stepIndex: number;
  teaser?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const safeStepIndex = clampDiagnosisCorridorStepIndex(stepIndex);
  const theme = stageThemes[safeStepIndex];

  const showChannels = safeStepIndex >= 1;
  const showCore = safeStepIndex >= 2;
  const showActions = safeStepIndex >= 3;
  const showFinalReveal = safeStepIndex >= 4;

  const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.86 };
  const chipTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.42 };

  return (
    <motion.div
      className={cn(
        'relative min-h-[44rem] overflow-hidden rounded-[34px] border border-white/10 bg-[#04070d]',
        teaser ? 'h-[34rem] min-h-[34rem] shadow-[0_42px_130px_-86px_rgba(0,0,0,0.98)]' : 'h-full shadow-[0_56px_150px_-90px_rgba(0,0,0,0.98)]',
        className,
      )}
      animate={{
        backgroundColor: '#04070d',
        scale: theme.scale,
        x: theme.shiftX,
        y: theme.shiftY,
      }}
      transition={transition}
    >
      <motion.div
        aria-hidden="true"
        className="absolute -left-[10%] top-[-12%] h-[32rem] w-[32rem] rounded-full blur-3xl"
        animate={{
          left: theme.glowLeft,
          top: theme.glowTop,
          opacity: theme.ambientOpacity,
          backgroundColor: theme.glowColor,
        }}
        transition={transition}
      />
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_84%_18%,rgba(96,165,250,0.16),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(4,7,12,0.18))]"
        animate={{ opacity: theme.ambientOpacity }}
        transition={transition}
      />
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px]"
        animate={{ opacity: theme.gridOpacity }}
        transition={transition}
      />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(2,4,8,0.92))]" />

      <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 1200 760">
        <defs>
          <linearGradient id="diagnosis-arrival" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0)" />
            <stop offset="52%" stopColor="rgba(251,146,60,0.96)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
          </linearGradient>
          <linearGradient id="diagnosis-branch" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.84)" />
          </linearGradient>
          <linearGradient id="diagnosis-merge" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
            <stop offset="55%" stopColor="rgba(251,146,60,0.95)" />
            <stop offset="100%" stopColor="rgba(129,140,248,0.82)" />
          </linearGradient>
          <linearGradient id="diagnosis-action" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.9)" />
          </linearGradient>
        </defs>

        <motion.path
          d="M 42 392 C 192 392, 292 392, 418 392"
          stroke="url(#diagnosis-arrival)"
          strokeLinecap="round"
          strokeWidth="16"
          animate={{ opacity: 0.64 }}
          style={{ filter: 'blur(11px)' }}
          transition={transition}
        />
        <motion.path
          d="M 42 392 C 192 392, 292 392, 418 392"
          stroke="url(#diagnosis-arrival)"
          strokeLinecap="round"
          strokeWidth="3.2"
          animate={{ opacity: 0.98 }}
          transition={transition}
        />

        {[
          'M 418 392 C 510 354, 572 286, 646 212',
          'M 418 392 C 558 392, 648 392, 726 392',
          'M 418 392 C 510 430, 572 500, 646 574',
        ].map((path) => (
          <g key={path}>
            <motion.path
              d={path}
              stroke="url(#diagnosis-branch)"
              strokeLinecap="round"
              strokeWidth="14"
              animate={{ opacity: showChannels ? 0.76 : 0 }}
              style={{ filter: 'blur(9px)' }}
              transition={transition}
            />
            <motion.path
              d={path}
              stroke="url(#diagnosis-branch)"
              strokeLinecap="round"
              strokeWidth="3"
              animate={{ opacity: showChannels ? 0.98 : 0 }}
              transition={transition}
            />
          </g>
        ))}

        {[
          'M 646 212 C 734 252, 770 320, 822 392',
          'M 726 392 C 770 392, 794 392, 822 392',
          'M 646 574 C 734 528, 770 464, 822 392',
        ].map((path) => (
          <g key={path}>
            <motion.path
              d={path}
              stroke="url(#diagnosis-merge)"
              strokeLinecap="round"
              strokeWidth="16"
              animate={{ opacity: showCore ? 0.82 : 0 }}
              style={{ filter: 'blur(10px)' }}
              transition={transition}
            />
            <motion.path
              d={path}
              stroke="url(#diagnosis-merge)"
              strokeLinecap="round"
              strokeWidth="3.2"
              animate={{ opacity: showCore ? 0.98 : 0 }}
              transition={transition}
            />
          </g>
        ))}

        {[
          'M 822 392 C 904 356, 972 288, 1050 216',
          'M 822 392 C 948 392, 1008 392, 1110 406',
          'M 822 392 C 904 430, 968 506, 1040 576',
        ].map((path) => (
          <g key={path}>
            <motion.path
              d={path}
              stroke="url(#diagnosis-action)"
              strokeLinecap="round"
              strokeWidth="12"
              animate={{ opacity: showActions ? 0.82 : 0 }}
              style={{ filter: 'blur(9px)' }}
              transition={transition}
            />
            <motion.path
              d={path}
              stroke="url(#diagnosis-action)"
              strokeLinecap="round"
              strokeWidth="2.8"
              animate={{ opacity: showActions ? 0.98 : 0 }}
              transition={transition}
            />
          </g>
        ))}
      </svg>

      <motion.div
        className="absolute left-[7%] top-[16%] w-[20rem] rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.96),rgba(5,8,13,0.92))] p-5 backdrop-blur-xl"
        animate={{ opacity: safeStepIndex === 0 ? 0.98 : safeStepIndex > 0 ? 0.26 : 0.98, y: safeStepIndex === 0 ? 0 : -10 }}
        transition={transition}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Store context</p>
            <p className="mt-2 text-base font-semibold text-white">공개 스토어가 무료 acquisition 입구가 됩니다.</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-300/10 text-orange-100">
            <Icons.Globe size={16} />
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {publicSignals.map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {channelSignals.map(({ Icon, label, left, top }, index) => (
        <motion.div
          key={label}
          className="absolute flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-xl"
          style={{ left, top }}
          animate={showChannels ? { opacity: 0.98, x: 0, y: 0 } : { opacity: 0, x: 18, y: 0 }}
          transition={{ ...chipTransition, delay: prefersReducedMotion ? 0 : index * 0.05 }}
        >
          <Icon size={12} />
          <span>{label}</span>
        </motion.div>
      ))}

      <motion.div
        aria-hidden="true"
        className="absolute left-[68.5%] top-1/2 h-[148px] w-[148px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/18 bg-orange-300/[0.06]"
        animate={{
          opacity: showCore ? 1 : 0,
          scale: showCore ? 1 : 0.68,
          boxShadow: showCore ? '0 0 92px rgba(251,146,60,0.24)' : '0 0 0 rgba(0,0,0,0)',
        }}
        transition={transition}
      >
        <motion.div
          className="absolute inset-[14px] rounded-full border border-white/12"
          animate={{ rotate: showCore ? 140 : 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 18, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
        />
        <motion.div
          className="absolute inset-[34px] rounded-full border border-white/10"
          animate={{ rotate: showCore ? -180 : 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 14, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
        />
        <motion.div
          className="absolute inset-[52px] rounded-full bg-[linear-gradient(180deg,rgba(251,146,60,0.96),rgba(255,255,255,0.92))]"
          animate={{ opacity: showCore ? 1 : 0 }}
          transition={transition}
        />
      </motion.div>

      <motion.div
        className="absolute left-[59%] top-[56%] w-[18rem] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.98),rgba(5,8,13,0.95))] p-4 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.98)] backdrop-blur-xl"
        animate={{ opacity: showCore ? 1 : 0, y: showCore ? 0 : 26 }}
        transition={transition}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Customer memory</p>
            <p className="mt-2 text-base font-semibold text-white">세 채널이 하나의 고객 기억과 타임라인으로 응축됩니다.</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-orange-100">
            <Icons.Users size={15} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {memorySignals.map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/55" />
              <span className="text-[11px] text-slate-300">{item}</span>
              {index < memorySignals.length - 1 ? <span className="h-px w-3 bg-white/10" /> : null}
            </div>
          ))}
        </div>
      </motion.div>

      {actionSignals.map((signal, index) => (
        <motion.div
          key={signal.label}
          className="absolute rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 backdrop-blur-xl"
          style={{ left: signal.left, top: signal.top }}
          animate={showActions ? { opacity: 0.98, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ ...chipTransition, delay: prefersReducedMotion ? 0 : index * 0.05 }}
        >
          {signal.label}
        </motion.div>
      ))}

      <AnimatePresence>
        {showFinalReveal ? (
          <>
            <motion.div
              key="store-shell"
              data-diagnosis-store-reveal="true"
              className="absolute left-[54%] top-[18%] w-[21rem] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.98),rgba(5,8,13,0.96))] p-5 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.98)] backdrop-blur-xl"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 36, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
              transition={{ duration: 0.52, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Generated store</p>
                  <p className="mt-2 text-base font-semibold text-white">기억 엔진에서 생성된 스토어 셸이 먼저 떠오릅니다.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-300/10 text-orange-100">
                  <Icons.Store size={16} />
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">MyBiz Store</p>
                    <p className="mt-1 text-xs text-slate-400">free acquisition entry</p>
                  </div>
                  <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-100">
                    FREE
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="h-2.5 w-28 rounded-full bg-white/10" />
                  <div className="h-2.5 w-40 rounded-full bg-white/[0.06]" />
                  <div className="grid grid-cols-3 gap-2">
                    {storeMetrics.map((metric) => (
                      <div key={metric.label} className="rounded-[18px] border border-white/8 bg-white/[0.04] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 flex-1 rounded-2xl border border-white/10 bg-white/[0.04]" />
                    <div className="flex h-9 w-28 items-center justify-center rounded-2xl bg-orange-500 text-sm font-semibold text-white">
                      문의 시작
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              key="dashboard-payoff"
              data-diagnosis-dashboard-payoff="true"
              className="absolute right-[4.8%] bottom-[8%] w-[24rem] rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(14,20,29,0.98),rgba(5,9,15,0.96))] p-5 text-white shadow-[0_44px_120px_-62px_rgba(0,0,0,0.98)] backdrop-blur-xl"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dashboard payoff</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">스토어 위에 운영 대시보드 payoff가 마지막 장면처럼 안착합니다.</h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-300/12 text-emerald-100">
                  <Icons.Dashboard size={16} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {dashboardMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>매출 회복 흐름</span>
                  <span>final payoff</span>
                </div>
                <div className="mt-4 flex h-28 items-end gap-3">
                  {[38, 54, 76, 68].map((height) => (
                    <div key={height} className="flex h-full flex-1 items-end rounded-[18px] bg-white/[0.04] p-2">
                      <motion.div
                        className="w-full rounded-full bg-[linear-gradient(180deg,rgba(52,211,153,0.96),rgba(251,146,60,0.72))]"
                        animate={
                          prefersReducedMotion
                            ? { height: `${height}%` }
                            : { height: ['30%', `${height}%`, `${Math.max(42, height - 9)}%`, `${height}%`] }
                        }
                        transition={{ duration: 1.5, delay: 0.15, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
