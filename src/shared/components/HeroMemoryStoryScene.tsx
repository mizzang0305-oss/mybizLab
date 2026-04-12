import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/shared/components/Icons';

type StoryStageKey = 'arrival' | 'capture' | 'memory' | 'recommend' | 'revenue';

const storyStages = [
  {
    key: 'arrival',
    label: '유입',
    eyebrow: 'PUBLIC PAGE',
    title: '방문자가 공개페이지에 도착합니다',
    description: '첫 방문이 어떤 채널에서 들어왔는지부터 남겨, 다음 행동의 시작점을 만듭니다.',
    note: '지도 · 링크 유입',
  },
  {
    key: 'capture',
    label: '수집',
    eyebrow: 'ACTION CAPTURE',
    title: '문의·예약·웨이팅이 같은 흐름으로 모입니다',
    description: '서로 다른 행동 채널을 따로 흩어두지 않고, 응대에 바로 쓰이는 신호로 연결합니다.',
    note: '문의 / AI 상담 / 예약 / 웨이팅',
  },
  {
    key: 'memory',
    label: '기억',
    eyebrow: 'CUSTOMER MEMORY',
    title: '새 고객은 만들고, 다시 온 고객은 이어 붙입니다',
    description: '행동이 고객 카드와 타임라인으로 이어져 매번 처음 응대하는 운영을 줄입니다.',
    note: '고객 카드 + 타임라인',
  },
  {
    key: 'recommend',
    label: '추천',
    eyebrow: 'NEXT ACTION',
    title: '지금 가장 가까운 다음 행동을 제안합니다',
    description: '재방문 메시지, 예약 유도, 현장 응대 우선순위를 고객 맥락에 맞게 고릅니다.',
    note: '재방문 유도 추천',
  },
  {
    key: 'revenue',
    label: '매출',
    eyebrow: 'REPEAT REVENUE',
    title: '기억은 반복 방문과 객단가로 돌아옵니다',
    description: '놓쳤던 고객 흐름이 다시 이어지면서 단골 매출과 다음 기회가 함께 쌓이기 시작합니다.',
    note: '재방문 · 추가 제안',
  },
] as const;

const actionSignals = [
  { key: 'inquiry', label: '문의', icon: Icons.Message },
  { key: 'reservation', label: '예약', icon: Icons.Reservation },
  { key: 'waiting', label: '웨이팅', icon: Icons.Waiting },
] as const;

const timelinePreview = [
  { label: '공개페이지 방문', detail: '첫 유입 기록' },
  { label: '예약 요청', detail: '주말 브런치 2인' },
] as const;

const revenueBars = [42, 60, 78] as const;

function stageReached(currentStage: StoryStageKey, targetStage: StoryStageKey) {
  return storyStages.findIndex((stage) => stage.key === currentStage) >= storyStages.findIndex((stage) => stage.key === targetStage);
}

function buildFocalMotion(active: boolean, prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return { opacity: 1, scale: 1, y: 0 };
  }

  if (!active) {
    return { opacity: 0.9, scale: 1, y: 0 };
  }

  return {
    opacity: 1,
    scale: [1, 1.012, 1],
    y: [0, -4, 0],
  };
}

export function HeroMemoryStoryScene() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [stageIndex, setStageIndex] = useState(prefersReducedMotion ? storyStages.length - 1 : 0);
  const currentStage = storyStages[stageIndex] ?? storyStages[storyStages.length - 1];

  useEffect(() => {
    if (prefersReducedMotion) {
      setStageIndex(storyStages.length - 1);
      return;
    }

    const intervalId = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % storyStages.length);
    }, 2800);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  return (
    <div className="relative mx-auto w-full max-w-[600px]">
      <div className="mb-4 grid grid-cols-5 gap-2 sm:mb-5 sm:gap-3">
        {storyStages.map((stage, index) => {
          const active = index === stageIndex;
          const reached = index < stageIndex;

          return (
            <div key={stage.key} className="min-w-0">
              <div
                className={[
                  'h-[2px] rounded-full transition',
                  active ? 'bg-white/70' : reached ? 'bg-white/30' : 'bg-white/10',
                ].join(' ')}
              />
              <p className={['mt-2 text-[10px] font-medium tracking-[0.12em] transition', active ? 'text-slate-300' : 'text-slate-500'].join(' ')}>
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="relative min-h-[350px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,19,0.98),rgba(7,9,13,0.98))] p-4 shadow-[0_36px_110px_-52px_rgba(0,0,0,0.92)] sm:min-h-[410px] sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,91,19,0.12),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.12),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
        <div className="absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]" />

        <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 620 420">
          <motion.path
            d="M 112 126 C 184 162, 244 180, 308 206"
            stroke="rgba(148,163,184,0.22)"
            strokeDasharray="8 10"
            strokeLinecap="round"
            strokeWidth="2.4"
            animate={
              prefersReducedMotion
                ? { opacity: 0.28, pathLength: 1 }
                : {
                    opacity: stageReached(currentStage.key, 'capture') ? [0.18, 0.36, 0.18] : 0.14,
                    pathLength: stageReached(currentStage.key, 'capture') ? 1 : 0.45,
                  }
            }
            transition={{
              duration: 1,
              opacity: {
                duration: 2.4,
                repeat: prefersReducedMotion || !stageReached(currentStage.key, 'capture') ? 0 : Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              },
            }}
          />
          <motion.path
            d="M 316 216 C 388 226, 448 248, 506 298"
            stroke="rgba(74,222,128,0.22)"
            strokeDasharray="8 10"
            strokeLinecap="round"
            strokeWidth="2.4"
            animate={
              prefersReducedMotion
                ? { opacity: 0.3, pathLength: 1 }
                : {
                    opacity: stageReached(currentStage.key, 'recommend') ? [0.16, 0.42, 0.16] : 0.12,
                    pathLength: stageReached(currentStage.key, 'recommend') ? 1 : 0.38,
                  }
            }
            transition={{
              duration: 1.1,
              delay: 0.08,
              opacity: {
                duration: 2.3,
                repeat: prefersReducedMotion || !stageReached(currentStage.key, 'recommend') ? 0 : Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              },
            }}
          />
        </svg>

        <motion.div
          className="absolute left-4 top-16 z-10 w-[132px] rounded-[26px] border border-white/8 bg-white/[0.03] p-3 text-white/70 backdrop-blur-[10px] sm:left-6 sm:top-18 sm:w-[148px]"
          animate={prefersReducedMotion ? { opacity: 0.34, y: 0 } : { opacity: [0.24, 0.36, 0.24], y: [0, -2, 0] }}
          transition={{ duration: 4.2, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          style={{ filter: 'blur(1.6px)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">START</p>
          <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-300">
            <Icons.Globe size={16} />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-300">공개 유입</p>
        </motion.div>

        <motion.div
          className="absolute bottom-10 right-4 z-10 w-[146px] rounded-[26px] border border-white/8 bg-white/[0.03] p-3 text-white/70 backdrop-blur-[10px] sm:bottom-12 sm:right-6 sm:w-[162px]"
          animate={prefersReducedMotion ? { opacity: 0.34, y: 0 } : { opacity: [0.24, 0.36, 0.24], y: [0, 2, 0] }}
          transition={{ duration: 4.4, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: 0.18 }}
          style={{ filter: 'blur(1.6px)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">OUTCOME</p>
          <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-300">
            <Icons.Chart size={16} />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-300">반복 매출</p>
        </motion.div>

        <div className="absolute inset-x-4 top-[72px] z-20 sm:inset-x-0 sm:top-[82px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage.key}
              className="mx-auto w-full max-w-[338px] rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(18,23,31,0.98),rgba(8,11,16,0.98))] p-5 text-white shadow-[0_40px_90px_-46px_rgba(0,0,0,0.98)] sm:max-w-[360px] sm:p-6"
              animate={buildFocalMotion(true, prefersReducedMotion)}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12, scale: 0.985 }}
              transition={{
                duration: 0.5,
                ease: 'easeOut',
                scale: {
                  duration: 2.4,
                  repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                },
                y: {
                  duration: 2.4,
                  repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                },
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{currentStage.eyebrow}</p>
                  <h3 className="mt-3 text-[1.35rem] font-semibold leading-[1.3] text-white sm:text-[1.45rem]">{currentStage.title}</h3>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-orange-100">
                  {currentStage.key === 'arrival' ? <Icons.Globe size={18} /> : null}
                  {currentStage.key === 'capture' ? <Icons.Message size={18} /> : null}
                  {currentStage.key === 'memory' ? <Icons.Users size={18} /> : null}
                  {currentStage.key === 'recommend' ? <Icons.Zap size={18} /> : null}
                  {currentStage.key === 'revenue' ? <Icons.Chart size={18} /> : null}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-[15px]">{currentStage.description}</p>

              {currentStage.key === 'arrival' ? (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200">
                      <Icons.Store size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">성수 브런치랩</p>
                      <p className="mt-1 text-xs text-slate-400">{currentStage.note}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStage.key === 'capture' ? (
                <div className="mt-5 grid gap-2">
                  {actionSignals.map((signal) => {
                    const Icon = signal.icon;

                    return (
                      <div key={signal.key} className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-200">
                          <Icon size={15} />
                        </div>
                        <span className="text-sm font-medium text-slate-100">{signal.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {currentStage.key === 'memory' ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3">
                    <p className="text-base font-semibold text-white">김서연 고객</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">브런치 선호 · 재방문 이력 2회</p>
                  </div>

                  {timelinePreview.map((item) => (
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

              {currentStage.key === 'recommend' ? (
                <div className="mt-5 rounded-[24px] border border-sky-300/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4">
                  <p className="text-sm font-semibold text-white">다음 주 점심 시간 재방문 유도</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">예약과 현장 대기 이력이 있어, 지금은 재방문 메시지가 가장 가깝습니다.</p>
                </div>
              ) : null}

              {currentStage.key === 'revenue' ? (
                <div className="mt-5">
                  <div className="flex items-end gap-2">
                    {revenueBars.map((height, index) => (
                      <div key={height} className="flex h-20 flex-1 items-end rounded-[20px] bg-white/[0.05] p-2">
                        <motion.div
                          className="w-full rounded-full bg-[linear-gradient(180deg,rgba(16,185,129,0.95),rgba(74,222,128,0.62))]"
                          animate={
                            prefersReducedMotion
                              ? { height: `${height}%` }
                              : {
                                  height: [`36%`, `${height}%`, `${Math.max(40, height - 7)}%`, `${height}%`],
                                }
                          }
                          transition={{ duration: 1.35, delay: index * 0.08, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-300">재방문과 다음 제안이 연결되면서, 단골 매출 루프가 만들어지기 시작합니다.</p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
