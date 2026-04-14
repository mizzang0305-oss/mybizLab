import type { MotionValue } from 'motion/react';
import { AnimatePresence, motion, useReducedMotion, useTransform } from 'motion/react';

import { Icons } from '@/shared/components/Icons';

export type DiagnosisHeroStepId =
  | 'store-check'
  | 'signal-capture'
  | 'memory-merge'
  | 'action-plan'
  | 'revenue-recovery';

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function rangeProgress(value: number, start: number, end: number) {
  if (value <= start) {
    return 0;
  }

  if (value >= end) {
    return 1;
  }

  return (value - start) / (end - start);
}

export function HeroMemoryStoryScene({
  activeStep,
  activeStepIndex,
  progress,
}: {
  activeStep: DiagnosisHeroStepId;
  activeStepIndex: number;
  progress: MotionValue<number>;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const arrivalDraw = useTransform(progress, (value) => (prefersReducedMotion ? 1 : rangeProgress(value, 0.02, 0.18)));
  const arrivalGlow = useTransform(progress, (value) => (prefersReducedMotion ? 0.7 : 0.18 + rangeProgress(value, 0.03, 0.18) * 0.72));
  const splitDraw = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 1 ? 1 : 0) : rangeProgress(value, 0.18, 0.38)));
  const splitOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 1 ? 0.92 : 0;
    }

    const enter = rangeProgress(value, 0.18, 0.34);
    const fade = rangeProgress(value, 0.48, 0.62);
    return clamp(enter * (1 - fade * 0.76), 0, 0.92);
  });
  const mergeDraw = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 2 ? 1 : 0) : rangeProgress(value, 0.38, 0.6)));
  const mergeOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 0.95 : 0;
    }

    return clamp(rangeProgress(value, 0.4, 0.58), 0, 0.95);
  });
  const coreOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 1 : 0;
    }

    return clamp(rangeProgress(value, 0.42, 0.58), 0, 1);
  });
  const coreScale = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 1 : 0.72;
    }

    return 0.72 + rangeProgress(value, 0.44, 0.6) * 0.28;
  });
  const cardOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 1 : 0;
    }

    return clamp(rangeProgress(value, 0.48, 0.62), 0, 1);
  });
  const cardY = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 0 : 24;
    }

    return 30 - rangeProgress(value, 0.48, 0.62) * 30;
  });
  const actionDraw = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 3 ? 1 : 0) : rangeProgress(value, 0.62, 0.82)));
  const actionOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 3 ? 1 : 0;
    }

    return clamp(rangeProgress(value, 0.66, 0.82), 0, 1);
  });
  const dashboardReveal = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 4 ? 1 : 0) : rangeProgress(value, 0.82, 1)));
  const arrivalBadgeOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 0 ? 0.7 : 0;
    }

    return clamp(rangeProgress(value, 0.06, 0.18) * (1 - rangeProgress(value, 0.24, 0.38) * 0.45), 0, 0.76);
  });
  const arrivalBadgeY = useTransform(progress, (value) => 12 - rangeProgress(value, 0.06, 0.18) * 12);

  return (
    <div className="relative w-full" data-hero-step={activeStep}>
      <div className="relative h-[50svh] min-h-[360px] overflow-hidden rounded-[42px] border border-white/10 bg-[linear-gradient(180deg,rgba(4,6,10,0.98),rgba(6,9,15,0.98))] shadow-[0_50px_140px_-82px_rgba(0,0,0,0.98)] sm:h-[56svh] sm:min-h-[420px] lg:h-[calc(100vh-220px)] lg:min-h-[520px] lg:max-h-[700px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,91,19,0.08),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(129,140,248,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent)]" />
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:46px_46px]" />

        <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 960 640">
          <defs>
            <linearGradient id="arrival-glow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0)" />
              <stop offset="45%" stopColor="rgba(251,146,60,0.96)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
            </linearGradient>
            <linearGradient id="branch-warm" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.84)" />
            </linearGradient>
            <linearGradient id="branch-cool" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0.92)" />
              <stop offset="100%" stopColor="rgba(129,140,248,0.82)" />
            </linearGradient>
            <linearGradient id="merge-glow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
              <stop offset="55%" stopColor="rgba(251,146,60,0.95)" />
              <stop offset="100%" stopColor="rgba(129,140,248,0.8)" />
            </linearGradient>
            <linearGradient id="action-glow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.88)" />
            </linearGradient>
          </defs>

          <motion.path
            d="M 10 320 C 120 320, 208 320, 316 320"
            stroke="url(#arrival-glow)"
            strokeLinecap="round"
            strokeWidth="12"
            style={{ opacity: arrivalGlow, pathLength: arrivalDraw, filter: 'blur(10px)' }}
          />
          <motion.path
            d="M 10 320 C 120 320, 208 320, 316 320"
            stroke="url(#arrival-glow)"
            strokeLinecap="round"
            strokeWidth="2.8"
            style={{ opacity: arrivalGlow, pathLength: arrivalDraw }}
          />

          {[
            {
              d: 'M 316 320 C 372 300, 430 252, 476 192',
              stroke: 'url(#branch-warm)',
            },
            {
              d: 'M 316 320 C 398 320, 462 320, 532 320',
              stroke: 'url(#branch-cool)',
            },
            {
              d: 'M 316 320 C 372 344, 430 394, 476 448',
              stroke: 'url(#branch-warm)',
            },
          ].map((path) => (
            <g key={path.d}>
              <motion.path
                d={path.d}
                stroke={path.stroke}
                strokeLinecap="round"
                strokeWidth="10"
                style={{ opacity: splitOpacity, pathLength: splitDraw, filter: 'blur(8px)' }}
              />
              <motion.path
                d={path.d}
                stroke={path.stroke}
                strokeLinecap="round"
                strokeWidth="2.4"
                style={{ opacity: splitOpacity, pathLength: splitDraw }}
              />
            </g>
          ))}

          {[
            { d: 'M 476 192 C 544 224, 574 272, 624 320' },
            { d: 'M 532 320 C 578 320, 598 320, 624 320' },
            { d: 'M 476 448 C 544 420, 574 368, 624 320' },
          ].map((path) => (
            <g key={path.d}>
              <motion.path
                d={path.d}
                stroke="url(#merge-glow)"
                strokeLinecap="round"
                strokeWidth="12"
                style={{ opacity: mergeOpacity, pathLength: mergeDraw, filter: 'blur(10px)' }}
              />
              <motion.path
                d={path.d}
                stroke="url(#merge-glow)"
                strokeLinecap="round"
                strokeWidth="2.8"
                style={{ opacity: mergeOpacity, pathLength: mergeDraw }}
              />
            </g>
          ))}

          <g>
            <motion.path
              d="M 624 320 C 704 316, 744 278, 816 240"
              stroke="url(#action-glow)"
              strokeLinecap="round"
              strokeWidth="10"
              style={{ opacity: actionOpacity, pathLength: actionDraw, filter: 'blur(8px)' }}
            />
            <motion.path
              d="M 624 320 C 704 316, 744 278, 816 240"
              stroke="url(#action-glow)"
              strokeLinecap="round"
              strokeWidth="2.4"
              style={{ opacity: actionOpacity, pathLength: actionDraw }}
            />
          </g>
        </svg>

        <motion.div
          className="absolute left-[6%] top-[46%] h-[3px] w-[18%] rounded-full bg-white/0 shadow-[0_0_0_rgba(251,146,60,0)]"
          style={{ opacity: arrivalGlow }}
        />

        <motion.div
          aria-hidden="true"
          className="absolute left-[13%] top-[34%] rounded-full border border-orange-300/14 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-[10px]"
          style={{ opacity: arrivalBadgeOpacity, y: arrivalBadgeY }}
        >
          공개페이지 도착
        </motion.div>

        <div className="absolute inset-0">
          {[
            { label: '문의', x: '51%', y: '25%' },
            { label: '예약', x: '58%', y: '48%' },
            { label: '웨이팅', x: '51%', y: '71%' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="absolute rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-[12px]"
              animate={
                activeStepIndex >= 1 && activeStepIndex < 3
                  ? { opacity: 0.96, x: 0 }
                  : activeStepIndex >= 3
                    ? { opacity: 0.18, x: 0 }
                    : { opacity: 0, x: 18 }
              }
              style={{ left: item.x, top: item.y }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.32, delay: prefersReducedMotion ? 0 : index * 0.04, ease: 'easeOut' }}
            >
              {item.label}
            </motion.div>
          ))}
        </div>

        <motion.div
          aria-hidden="true"
          className="absolute left-[60.5%] top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/22 bg-orange-300/6"
          style={{ opacity: coreOpacity, scale: coreScale, boxShadow: '0 0 60px rgba(251,146,60,0.18)' }}
        >
          <motion.div
            className="absolute inset-[16px] rounded-full border border-white/12"
            style={{ rotate: useTransform(progress, (value) => (prefersReducedMotion ? 12 : value * 80)) }}
          />
          <motion.div
            className="absolute inset-[30px] rounded-full bg-[linear-gradient(180deg,rgba(251,146,60,0.92),rgba(255,255,255,0.88))]"
            style={{ opacity: coreOpacity }}
          />
        </motion.div>

        <motion.div
          className="absolute left-[55%] top-[54%] w-[230px] rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(16,21,30,0.96),rgba(8,11,16,0.95))] p-4 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.98)] sm:w-[254px]"
          style={{ opacity: cardOpacity, x: 0, y: cardY }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">김서연 고객</p>
              <p className="mt-1 text-[11px] text-slate-400">브런치 선호 · 다시 온 고객 매칭</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.05] text-orange-100">
              <Icons.Users size={15} />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              '공개페이지 방문',
              '문의 남김',
              '예약 시도',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="absolute inset-0">
          {[
            { label: '재방문 메시지', x: '73%', y: '24%' },
            { label: '업셀 제안', x: '78%', y: '40%' },
            { label: '예약 후속', x: '72%', y: '56%' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="absolute rounded-full border border-emerald-300/18 bg-emerald-300/9 px-3 py-1.5 text-[11px] font-medium text-emerald-100 backdrop-blur-[12px]"
              animate={
                activeStepIndex === 3
                  ? { opacity: 0.96, y: 0 }
                  : activeStepIndex >= 4
                    ? { opacity: 0.16, y: 0 }
                    : { opacity: 0, y: 18 }
              }
              style={{ left: item.x, top: item.y }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.34, delay: prefersReducedMotion ? 0 : index * 0.05, ease: 'easeOut' }}
            >
              {item.label}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {activeStep === 'revenue-recovery' ? (
            <motion.div
              data-diagnosis-dashboard="true"
              className="absolute right-[5.2%] bottom-[10%] w-[290px] rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(18,23,31,0.98),rgba(8,11,16,0.96))] p-5 text-white shadow-[0_40px_120px_-62px_rgba(0,0,0,0.98)] sm:w-[324px]"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 14, scale: 0.98 }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Repeat Revenue</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">기억은 단골 매출로 돌아옵니다</h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-300/12 text-emerald-100">
                  <Icons.Chart size={16} />
                </div>
              </div>

              <div className="mt-5 flex items-end gap-2.5">
                {[46, 66, 84].map((height, index) => (
                  <div key={height} className="flex h-24 flex-1 items-end rounded-[20px] bg-white/[0.05] p-2">
                    <motion.div
                      data-revenue-bar="true"
                      className="w-full rounded-full bg-[linear-gradient(180deg,rgba(16,185,129,0.95),rgba(74,222,128,0.62))]"
                      animate={
                        prefersReducedMotion
                          ? { height: `${height}%` }
                          : { height: [`34%`, `${height}%`, `${Math.max(40, height - 8)}%`, `${height}%`] }
                      }
                      transition={{ duration: 1.4, delay: index * 0.08, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                      style={{ opacity: dashboardReveal }}
                    />
                  </div>
                ))}
              </div>

              <motion.div className="mt-4 grid gap-3 sm:grid-cols-3" style={{ opacity: dashboardReveal }}>
                {[
                  { label: '재방문', value: '+18%' },
                  { label: '예약 전환', value: '+12%' },
                  { label: '업셀', value: '+9%' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] bg-white/[0.04] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
