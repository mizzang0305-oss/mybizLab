import type { MotionValue } from 'motion/react';
import { AnimatePresence, motion, useReducedMotion, useTransform } from 'motion/react';

import { Icons } from '@/shared/components/Icons';
import type { DiagnosisCorridorStepId } from '@/shared/lib/diagnosisCorridor';

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
  activeStep: DiagnosisCorridorStepId;
  activeStepIndex: number;
  progress: MotionValue<number>;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const fieldDrift = useTransform(progress, (value) => (prefersReducedMotion ? 0 : value * -18));
  const fieldScale = useTransform(progress, (value) => 1 + value * 0.035);
  const ambientOpacity = useTransform(progress, (value) => 0.32 + value * 0.36);

  const arrivalDraw = useTransform(progress, (value) => (prefersReducedMotion ? 1 : rangeProgress(value, 0.01, 0.17)));
  const arrivalGlow = useTransform(progress, (value) => (prefersReducedMotion ? 0.9 : 0.28 + rangeProgress(value, 0.02, 0.18) * 0.72));
  const storePanelOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 0 ? 0.96 : 0;
    }

    const enter = rangeProgress(value, 0.04, 0.18);
    const fade = rangeProgress(value, 0.26, 0.42);
    return clamp(enter * (1 - fade * 0.36), 0, 0.96);
  });
  const storePanelY = useTransform(progress, (value) => 24 - rangeProgress(value, 0.04, 0.18) * 24);

  const splitDraw = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 1 ? 1 : 0) : rangeProgress(value, 0.16, 0.38)));
  const splitOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 1 ? 0.96 : 0;
    }

    const enter = rangeProgress(value, 0.18, 0.34);
    const soften = rangeProgress(value, 0.48, 0.6);
    return clamp(enter * (1 - soften * 0.3), 0, 0.96);
  });

  const mergeDraw = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 2 ? 1 : 0) : rangeProgress(value, 0.36, 0.6)));
  const mergeOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 0.98 : 0;
    }

    return clamp(rangeProgress(value, 0.38, 0.58), 0, 0.98);
  });
  const coreOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 1 : 0;
    }

    return clamp(rangeProgress(value, 0.4, 0.58), 0, 1);
  });
  const coreScale = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 1 : 0.68;
    }

    return 0.68 + rangeProgress(value, 0.42, 0.6) * 0.32;
  });
  const orbitRotate = useTransform(progress, (value) => (prefersReducedMotion ? 14 : 14 + value * 110));
  const memoryPanelOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 2 ? 1 : 0;
    }

    const enter = rangeProgress(value, 0.44, 0.62);
    const soften = rangeProgress(value, 0.82, 1);
    return clamp(enter * (1 - soften * 0.55), 0, 1);
  });
  const memoryPanelY = useTransform(progress, (value) => 28 - rangeProgress(value, 0.44, 0.62) * 28);

  const actionDraw = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 3 ? 1 : 0) : rangeProgress(value, 0.58, 0.82)));
  const actionOpacity = useTransform(progress, (value) => {
    if (prefersReducedMotion) {
      return activeStepIndex >= 3 ? 1 : 0;
    }

    return clamp(rangeProgress(value, 0.62, 0.8), 0, 1);
  });

  const dashboardReveal = useTransform(progress, (value) => (prefersReducedMotion ? (activeStepIndex >= 4 ? 1 : 0) : rangeProgress(value, 0.8, 1)));
  const dashboardLift = useTransform(progress, (value) => 40 - rangeProgress(value, 0.82, 1) * 40);
  const dashboardScale = useTransform(progress, (value) => 0.94 + rangeProgress(value, 0.82, 1) * 0.06);

  return (
    <div className="relative w-full" data-hero-step={activeStep}>
      <div className="relative h-[57svh] min-h-[420px] overflow-hidden rounded-[38px] border border-white/10 bg-[linear-gradient(180deg,rgba(3,6,11,0.98),rgba(4,8,13,0.96))] shadow-[0_50px_150px_-90px_rgba(0,0,0,0.98)] sm:h-[62svh] lg:h-[calc(100vh-190px)] lg:min-h-[560px] lg:max-h-[760px]">
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ opacity: ambientOpacity, scale: fieldScale, y: fieldDrift }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,91,19,0.15),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(129,140,248,0.18),transparent_20%),radial-gradient(circle_at_56%_52%,rgba(56,189,248,0.1),transparent_22%)]" />
          <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(1,4,8,0.86))]" />
        </motion.div>

        <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 1200 760">
          <defs>
            <linearGradient id="corridor-arrival" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0)" />
              <stop offset="48%" stopColor="rgba(251,146,60,0.96)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
            </linearGradient>
            <linearGradient id="corridor-branch-warm" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.82)" />
            </linearGradient>
            <linearGradient id="corridor-branch-cool" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0.92)" />
              <stop offset="100%" stopColor="rgba(96,165,250,0.84)" />
            </linearGradient>
            <linearGradient id="corridor-merge" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
              <stop offset="55%" stopColor="rgba(251,146,60,0.95)" />
              <stop offset="100%" stopColor="rgba(129,140,248,0.82)" />
            </linearGradient>
            <linearGradient id="corridor-action" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0.9)" />
            </linearGradient>
          </defs>

          <motion.path
            d="M 30 390 C 190 390, 286 390, 404 390"
            stroke="url(#corridor-arrival)"
            strokeLinecap="round"
            strokeWidth="18"
            style={{ opacity: arrivalGlow, pathLength: arrivalDraw, filter: 'blur(12px)' }}
          />
          <motion.path
            d="M 30 390 C 190 390, 286 390, 404 390"
            stroke="url(#corridor-arrival)"
            strokeLinecap="round"
            strokeWidth="3.2"
            style={{ opacity: arrivalGlow, pathLength: arrivalDraw }}
          />

          {[
            { d: 'M 404 390 C 500 352, 560 288, 620 214', stroke: 'url(#corridor-branch-warm)' },
            { d: 'M 404 390 C 542 390, 628 390, 714 390', stroke: 'url(#corridor-branch-cool)' },
            { d: 'M 404 390 C 500 432, 560 500, 620 572', stroke: 'url(#corridor-branch-warm)' },
          ].map((path) => (
            <g key={path.d}>
              <motion.path
                d={path.d}
                stroke={path.stroke}
                strokeLinecap="round"
                strokeWidth="16"
                style={{ opacity: splitOpacity, pathLength: splitDraw, filter: 'blur(10px)' }}
              />
              <motion.path
                d={path.d}
                stroke={path.stroke}
                strokeLinecap="round"
                strokeWidth="3.2"
                style={{ opacity: splitOpacity, pathLength: splitDraw }}
              />
            </g>
          ))}

          {[
            { d: 'M 620 214 C 710 258, 744 320, 798 390' },
            { d: 'M 714 390 C 756 390, 782 390, 798 390' },
            { d: 'M 620 572 C 710 524, 744 462, 798 390' },
          ].map((path) => (
            <g key={path.d}>
              <motion.path
                d={path.d}
                stroke="url(#corridor-merge)"
                strokeLinecap="round"
                strokeWidth="18"
                style={{ opacity: mergeOpacity, pathLength: mergeDraw, filter: 'blur(12px)' }}
              />
              <motion.path
                d={path.d}
                stroke="url(#corridor-merge)"
                strokeLinecap="round"
                strokeWidth="3.4"
                style={{ opacity: mergeOpacity, pathLength: mergeDraw }}
              />
            </g>
          ))}

          {[
            'M 798 390 C 892 360, 946 298, 1032 226',
            'M 798 390 C 916 390, 974 392, 1088 402',
            'M 798 390 C 884 424, 940 504, 1018 576',
          ].map((path) => (
            <g key={path}>
              <motion.path
                d={path}
                stroke="url(#corridor-action)"
                strokeLinecap="round"
                strokeWidth="14"
                style={{ opacity: actionOpacity, pathLength: actionDraw, filter: 'blur(10px)' }}
              />
              <motion.path
                d={path}
                stroke="url(#corridor-action)"
                strokeLinecap="round"
                strokeWidth="3"
                style={{ opacity: actionOpacity, pathLength: actionDraw }}
              />
            </g>
          ))}
        </svg>

        <motion.div
          className="absolute left-[4.5%] top-[16%] w-[min(24rem,44vw)] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,16,24,0.96),rgba(4,8,13,0.9))] p-5 backdrop-blur-xl"
          style={{ opacity: storePanelOpacity, y: storePanelY }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Public Arrival</p>
              <p className="mt-2 text-base font-semibold text-white">공개 페이지에서 첫 신호가 들어옵니다</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-300/10 text-orange-100">
              <Icons.Globe size={16} />
            </div>
          </div>
          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>스토어 공개 화면</span>
              <span>entry</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="h-2 w-20 rounded-full bg-white/10" />
              <div className="h-2 w-32 rounded-full bg-white/6" />
              <div className="flex gap-2">
                <div className="h-9 flex-1 rounded-2xl border border-white/10 bg-white/[0.04]" />
                <div className="h-9 w-20 rounded-2xl border border-orange-300/30 bg-orange-300/10" />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="absolute inset-0">
          {[
            { label: '문의', x: '50%', y: '22%' },
            { label: '예약', x: '61%', y: '47%' },
            { label: '웨이팅', x: '50%', y: '73%' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="absolute rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-xl"
              animate={
                activeStepIndex >= 1 && activeStepIndex < 4
                  ? { opacity: 0.96, x: 0, y: 0 }
                  : activeStepIndex >= 4
                    ? { opacity: 0.22, x: 0, y: 0 }
                    : { opacity: 0, x: 18, y: 0 }
              }
              style={{ left: item.x, top: item.y }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.34, delay: prefersReducedMotion ? 0 : index * 0.05, ease: 'easeOut' }}
            >
              {item.label}
            </motion.div>
          ))}
        </div>

        <motion.div
          aria-hidden="true"
          className="absolute left-[66.2%] top-1/2 h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/20 bg-orange-300/[0.06]"
          style={{
            opacity: coreOpacity,
            scale: coreScale,
            boxShadow: '0 0 82px rgba(251,146,60,0.18)',
          }}
        >
          <motion.div
            className="absolute inset-[14px] rounded-full border border-white/12"
            style={{ rotate: orbitRotate }}
          />
          <motion.div
            className="absolute inset-[30px] rounded-full border border-white/10"
            style={{ rotate: useTransform(orbitRotate, (value) => -value * 1.28) }}
          />
          <motion.div
            className="absolute inset-[48px] rounded-full bg-[linear-gradient(180deg,rgba(251,146,60,0.96),rgba(255,255,255,0.92))]"
            style={{ opacity: coreOpacity }}
          />
        </motion.div>

        <motion.div
          className="absolute left-[58%] top-[54%] w-[min(18rem,34vw)] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.98),rgba(5,8,13,0.95))] p-4 shadow-[0_28px_70px_-48px_rgba(0,0,0,0.98)] backdrop-blur-xl"
          style={{ opacity: memoryPanelOpacity, y: memoryPanelY }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Customer Memory</p>
              <p className="mt-2 text-base font-semibold text-white">한 고객의 기억 타임라인이 만들어집니다</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-orange-100">
              <Icons.Users size={15} />
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {['공개 페이지 유입', '문의 응답', '예약 시도', '재방문 가능성'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="absolute inset-0">
          {[
            { label: '리마인드 메시지', x: '77%', y: '23%' },
            { label: '업셀 힌트', x: '85%', y: '47%' },
            { label: '예약 후속 조치', x: '77%', y: '72%' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="absolute rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 backdrop-blur-xl"
              animate={
                activeStepIndex === 3
                  ? { opacity: 0.98, y: 0 }
                  : activeStepIndex >= 4
                    ? { opacity: 0.22, y: 0 }
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
          {activeStep === 'operations-dashboard' ? (
            <motion.div
              key="diagnosis-dashboard"
              data-diagnosis-dashboard="true"
              className="absolute right-[4.8%] bottom-[8%] w-[min(28rem,43vw)] rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(14,20,29,0.98),rgba(5,9,15,0.96))] p-5 text-white shadow-[0_44px_120px_-62px_rgba(0,0,0,0.98)] backdrop-blur-xl"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ y: dashboardLift, scale: dashboardScale }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Operations Dashboard</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">같은 코어가 운영 대시보드로 올라옵니다</h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-300/12 text-emerald-100">
                  <Icons.Dashboard size={16} />
                </div>
              </div>

              <motion.div className="mt-5 grid gap-3 sm:grid-cols-3" style={{ opacity: dashboardReveal }}>
                {[
                  { label: '재방문 메시지', value: '+18%' },
                  { label: '예약 회복', value: '+12%' },
                  { label: '업셀 전환', value: '+9%' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </motion.div>

              <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>회복 매출 추이</span>
                  <span>final reveal</span>
                </div>
                <div className="mt-4 flex h-28 items-end gap-3">
                  {[38, 58, 82, 74].map((height, index) => (
                    <div key={height} className="flex h-full flex-1 items-end rounded-[18px] bg-white/[0.04] p-2">
                      <motion.div
                        data-revenue-bar="true"
                        className="w-full rounded-full bg-[linear-gradient(180deg,rgba(52,211,153,0.96),rgba(251,146,60,0.72))]"
                        animate={
                          prefersReducedMotion
                            ? { height: `${height}%` }
                            : { height: [`32%`, `${height}%`, `${Math.max(42, height - 10)}%`, `${height}%`] }
                        }
                        transition={{
                          duration: 1.6,
                          delay: index * 0.08,
                          repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
                          ease: 'easeInOut',
                        }}
                        style={{ opacity: dashboardReveal }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <motion.div className="mt-4 flex flex-wrap gap-2" style={{ opacity: dashboardReveal }}>
                {['다음 액션 우선순위', '회복 고객 리스트', '예약 후속 자동화'].map((item) => (
                  <span
                    key={item}
                    className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
