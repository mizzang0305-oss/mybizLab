import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/shared/components/Icons';

type HeroStageKey = 'store' | 'data' | 'analysis' | 'result';

interface HeroDiagnosisVisualProps {
  starterPrice: string;
}

const stages: Array<{ key: HeroStageKey; label: string }> = [
  { key: 'store', label: '스토어 확인' },
  { key: 'data', label: '운영 데이터 연결' },
  { key: 'analysis', label: 'AI 분석' },
  { key: 'result', label: '실행안 도출' },
];

const dataNodes = [
  {
    key: 'customers',
    label: '고객',
    icon: Icons.Users,
    className: 'left-[6%] top-[14%] sm:left-[8%] sm:top-[16%]',
  },
  {
    key: 'reservations',
    label: '예약',
    icon: Icons.Reservation,
    className: 'left-[12%] top-[68%] sm:left-[14%] sm:top-[70%]',
  },
  {
    key: 'orders',
    label: '주문',
    icon: Icons.Delivery,
    className: 'right-[8%] top-[18%] sm:right-[10%] sm:top-[16%]',
  },
  {
    key: 'sales',
    label: '매출',
    icon: Icons.Chart,
    className: 'right-[12%] top-[72%] sm:right-[14%] sm:top-[70%]',
  },
] as const;

const analysisBars = [
  { label: '고객', value: 62, accent: 'bg-sky-400' },
  { label: '예약', value: 84, accent: 'bg-orange-400' },
  { label: '매출', value: 71, accent: 'bg-emerald-400' },
] as const;

const resultItems = ['AI 매장 진단 완료', '고객관리 자동화', '리뷰 관리 개선', '예약 전환율 상승'] as const;

const summaryItems = [
  { label: 'Starter 시작가', value: 'price' as const, icon: Icons.Store },
  { label: '운영 분석', value: 'AI 스토어 진단', icon: Icons.AI },
  { label: '데이터 연결', value: '고객 · 예약 · 주문 · 매출', icon: Icons.Chart },
  { label: '실행 제안', value: '운영 개선 액션 추천', icon: Icons.Zap },
] as const;

function getStageIndex(stageKey: HeroStageKey) {
  return stages.findIndex((stage) => stage.key === stageKey);
}

function getResultCardMessage(stage: HeroStageKey) {
  if (stage === 'store') {
    return '매장 기본 정보와 운영 흐름을 준비하고 있습니다.';
  }

  if (stage === 'data') {
    return '고객, 예약, 주문, 매출 신호를 연결해 진단 기반을 만들고 있습니다.';
  }

  if (stage === 'analysis') {
    return 'AI가 운영 패턴을 비교해 우선 개선 포인트를 계산하고 있습니다.';
  }

  return '실행 우선순위가 정리되어 바로 운영 액션으로 이어질 수 있습니다.';
}

export function HeroDiagnosisVisual({ starterPrice }: HeroDiagnosisVisualProps) {
  const prefersReducedMotion = useReducedMotion();
  const [stageIndex, setStageIndex] = useState(prefersReducedMotion ? 3 : 0);
  const currentStage = stages[stageIndex]?.key ?? 'result';

  useEffect(() => {
    if (prefersReducedMotion) {
      setStageIndex(3);
      return;
    }

    const intervalId = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % stages.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.08] p-5 shadow-[0_28px_70px_-35px_rgba(15,23,42,0.55)] backdrop-blur-md sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.07),_rgba(255,255,255,0))]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative">
        <div className="flex flex-wrap gap-2">
          {stages.map((stage, index) => {
            const isActive = index === stageIndex;
            const isCompleted = index < stageIndex;

            return (
              <div
                key={stage.key}
                className={[
                  'rounded-full border px-3 py-2 text-[11px] font-semibold tracking-[0.16em] transition sm:text-xs',
                  isActive
                    ? 'border-orange-300 bg-orange-100 text-orange-900'
                    : isCompleted
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                      : 'border-white/15 bg-white/[0.08] text-slate-300',
                ].join(' ')}
              >
                {String(index + 1).padStart(2, '0')} {stage.label}
              </div>
            );
          })}
        </div>

        <div className="relative mt-5 min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/75 px-4 py-4 sm:min-h-[360px] sm:px-5 sm:py-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(236,91,19,0.2),_transparent_35%),radial-gradient(circle_at_20%_20%,_rgba(59,130,246,0.18),_transparent_28%)]" />

          <div className="absolute inset-0">
            <svg className="h-full w-full" viewBox="0 0 600 380" fill="none" preserveAspectRatio="none">
              {[
                { x1: 126, y1: 86, x2: 302, y2: 188 },
                { x1: 130, y1: 294, x2: 302, y2: 188 },
                { x1: 490, y1: 96, x2: 302, y2: 188 },
                { x1: 484, y1: 292, x2: 302, y2: 188 },
                { x1: 190, y1: 188, x2: 302, y2: 188 },
                { x1: 332, y1: 188, x2: 452, y2: 212 },
              ].map((line, index) => (
                <motion.line
                  key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
                  stroke={index === 5 ? 'rgba(251,146,60,0.9)' : 'rgba(148,163,184,0.52)'}
                  strokeDasharray={index === 5 ? '10 8' : '6 8'}
                  strokeLinecap="round"
                  strokeWidth={index === 5 ? 3 : 2}
                  x1={line.x1}
                  x2={line.x2}
                  y1={line.y1}
                  y2={line.y2}
                  initial={prefersReducedMotion ? false : { pathLength: 0.2, opacity: 0.15 }}
                  animate={
                    prefersReducedMotion
                      ? { pathLength: 1, opacity: 0.6 }
                      : {
                          pathLength: getStageIndex(currentStage) >= 1 || index >= 4 ? 1 : 0.2,
                          opacity: getStageIndex(currentStage) >= 1 || index >= 4 ? [0.25, 0.8, 0.25] : 0.12,
                        }
                  }
                  transition={{
                    duration: 1.2,
                    delay: index * 0.08,
                    opacity: {
                      duration: 2.6,
                      repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
                      ease: 'easeInOut',
                    },
                  }}
                />
              ))}
            </svg>
          </div>

          {dataNodes.map((node, index) => {
            const Icon = node.icon;

            return (
              <motion.div
                key={node.key}
                className={`absolute ${node.className}`}
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88, y: 10 }}
                animate={
                  prefersReducedMotion
                    ? { opacity: 1, scale: 1 }
                    : {
                        opacity: currentStage === 'store' ? 0.35 : 1,
                        scale: currentStage === 'store' ? 0.94 : [1, 1.04, 1],
                        y: currentStage === 'store' ? 8 : [0, -4, 0],
                      }
                }
                transition={{
                  duration: 0.8,
                  delay: 0.18 * index,
                  repeat: prefersReducedMotion || currentStage === 'store' ? 0 : Number.POSITIVE_INFINITY,
                  repeatType: 'mirror',
                }}
              >
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.85)] backdrop-blur">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-orange-200">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">DATA</p>
                    <p className="text-sm font-semibold">{node.label}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}

          <motion.div
            className="absolute left-[50%] top-[52%] z-10 -translate-x-1/2 -translate-y-1/2"
            animate={
              prefersReducedMotion
                ? { scale: 1 }
                : {
                    scale: currentStage === 'analysis' ? [1, 1.05, 1] : [1, 1.02, 1],
                  }
            }
            transition={{ duration: 2.4, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          >
            <motion.div
              className="absolute inset-[-18px] rounded-full border border-orange-300/35"
              animate={prefersReducedMotion ? { opacity: 0.35, scale: 1 } : { opacity: [0.18, 0.55, 0.18], scale: [0.92, 1.1, 1.18] }}
              transition={{ duration: 2.2, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-[-34px] rounded-full border border-sky-300/20"
              animate={prefersReducedMotion ? { opacity: 0.22, scale: 1 } : { opacity: [0.1, 0.28, 0.1], scale: [0.9, 1.16, 1.3] }}
              transition={{ duration: 2.8, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeOut', delay: 0.15 }}
            />
            <div className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(236,91,19,0.94),rgba(124,58,237,0.75))] shadow-[0_20px_55px_-24px_rgba(236,91,19,0.9)]">
              <Icons.AI size={34} />
            </div>
            <div className="mt-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI CORE</p>
              <p className="mt-1 text-sm font-semibold text-white">운영 패턴 분석</p>
            </div>
          </motion.div>

          <motion.div
                className="absolute left-[8%] top-[44%] z-10 w-[152px] rounded-[24px] border border-white/10 bg-white/[0.12] p-4 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.85)] backdrop-blur sm:w-[168px]"
            initial={prefersReducedMotion ? false : { opacity: 0, x: -18 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1, x: 0 }
                : {
                    opacity: currentStage === 'store' ? 1 : 0.9,
                    x: 0,
                    y: currentStage === 'store' ? [0, -4, 0] : 0,
                  }
            }
            transition={{ duration: 0.75, y: { duration: 2.6, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' } }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              <Icons.Store size={20} />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">MY STORE</p>
            <p className="mt-1 text-base font-semibold">성수 브런치랩</p>
            <p className="mt-2 text-sm leading-5 text-slate-300">예약 흐름과 재방문 관리가 핵심 과제로 잡혀 있습니다.</p>
          </motion.div>

          <motion.div
            className="absolute bottom-[12%] left-[46%] z-10 w-[180px] -translate-x-1/2 rounded-[24px] border border-white/10 bg-white/[0.1] p-4 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.85)] backdrop-blur sm:w-[208px]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1, y: 0 }
                : {
                    opacity: getStageIndex(currentStage) >= 2 ? 1 : 0.22,
                    y: 0,
                    scale: getStageIndex(currentStage) >= 2 ? [1, 1.01, 1] : 0.96,
                  }
            }
            transition={{ duration: 0.8, scale: { duration: 2.2, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' } }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">ANALYSIS GRAPH</p>
                <p className="mt-1 text-sm font-semibold text-white">운영 신호 스코어</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">실시간</span>
            </div>

            <div className="mt-4 flex items-end gap-2">
              {analysisBars.map((bar, index) => (
                <div key={bar.label} className="flex flex-1 flex-col gap-2">
                  <div className="flex h-24 items-end rounded-2xl bg-white/5 px-2 py-2">
                    <motion.div
                      className={`w-full rounded-full ${bar.accent}`}
                      animate={
                        prefersReducedMotion
                          ? { height: `${bar.value}%` }
                          : {
                              height: currentStage === 'analysis' || currentStage === 'result' ? [`42%`, `${bar.value}%`, `${Math.max(48, bar.value - 10)}%`, `${bar.value}%`] : '34%',
                            }
                      }
                      transition={{
                        duration: 1.3,
                        delay: index * 0.12,
                        repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
                        repeatDelay: 0.35,
                        ease: 'easeInOut',
                      }}
                    />
                  </div>
                  <p className="text-center text-[11px] font-medium text-slate-400">{bar.label}</p>
                </div>
              ))}
            </div>

            <motion.div
              className="absolute left-3 right-3 top-16 h-10 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
              animate={prefersReducedMotion ? { x: 0, opacity: 0 } : { x: ['-105%', '115%'], opacity: [0, 0.55, 0] }}
              transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', repeatDelay: 0.4 }}
            />
          </motion.div>

          <div className="absolute right-[5%] top-[42%] z-10 w-[204px] sm:right-[6%] sm:top-[36%] sm:w-[228px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStage}
                className="rounded-[26px] border border-orange-200/40 bg-white p-5 text-slate-900 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.7)]"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">RESULT CARD</p>
                    <p className="mt-1 text-lg font-black">
                      {currentStage === 'result' ? 'AI 매장 진단 완료' : currentStage === 'analysis' ? 'AI 분석 진행 중' : '진단 준비 중'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <Icons.Check size={20} />
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-500">{getResultCardMessage(currentStage)}</p>

                <div className="mt-4 space-y-2.5">
                  {resultItems.map((item, index) => (
                    <motion.div
                      key={item}
                      className={[
                        'flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-medium',
                        currentStage === 'result' && index > 0 ? 'bg-orange-50 text-orange-900' : 'bg-slate-50 text-slate-700',
                      ].join(' ')}
                      initial={prefersReducedMotion ? false : { opacity: 0.55, x: 10 }}
                      animate={
                        prefersReducedMotion
                          ? { opacity: 1, x: 0 }
                          : {
                              opacity: currentStage === 'result' ? 1 : index === 0 ? 0.92 : 0.55,
                              x: 0,
                            }
                      }
                      transition={{ duration: 0.35, delay: index * 0.06 }}
                    >
                      <span>{item}</span>
                      <span className="text-xs font-semibold text-slate-400">{index === 0 ? '완료' : currentStage === 'result' ? '추천' : '대기'}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {summaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-orange-200">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-semibold">{item.value === 'price' ? starterPrice : item.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
