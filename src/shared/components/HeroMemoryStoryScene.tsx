import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/shared/components/Icons';

type StoryStageKey = 'arrival' | 'capture' | 'memory' | 'recommend' | 'revenue';

const storyStages = [
  {
    key: 'arrival',
    label: '방문자 유입',
    title: '공개페이지에서 첫 방문이 시작됩니다',
    description: '지금 들어온 손님이 어떤 채널로 왔는지부터 남겨, 다음 행동의 출발점을 만듭니다.',
  },
  {
    key: 'capture',
    label: '행동 수집',
    title: '문의·예약·웨이팅이 같은 흐름으로 모입니다',
    description: '서로 다른 행동 채널을 따로 흩어 놓지 않고, 이후 응대에 바로 쓸 수 있는 신호로 모읍니다.',
  },
  {
    key: 'memory',
    label: '고객 기억 생성',
    title: '새 고객은 만들고, 다시 온 고객은 이어 붙입니다',
    description: '누가 무엇을 남겼는지 타임라인으로 연결해, 매번 처음 응대하는 운영을 줄입니다.',
  },
  {
    key: 'recommend',
    label: '다음 행동 추천',
    title: '지금 가장 맞는 다음 행동을 제안합니다',
    description: '기억된 고객 맥락을 바탕으로 재방문 메시지, 예약 유도, 현장 응대 우선순위를 추천합니다.',
  },
  {
    key: 'revenue',
    label: '매출 결과',
    title: '기억은 재방문과 객단가로 돌아옵니다',
    description: '놓쳤던 고객 흐름이 다시 이어지면서 단골 매출과 다음 매출 기회가 함께 쌓이기 시작합니다.',
  },
] as const;

const captureActions = [
  { key: 'inquiry', label: '문의 / AI 상담', icon: Icons.Message },
  { key: 'reservation', label: '예약', icon: Icons.Reservation },
  { key: 'waiting', label: '웨이팅', icon: Icons.Waiting },
] as const;

const timelineItems = [
  { label: '공개페이지 방문', detail: '지도 · 링크 유입 기록' },
  { label: '예약 요청', detail: '주말 브런치 2인' },
  { label: '현장 대기', detail: '12분 대기 후 착석' },
] as const;

const outcomeItems = ['재방문 가능성 상승', '다음 제안 자동 준비', '응대 맥락 유지'] as const;

function getStageIndex(stageKey: StoryStageKey) {
  return storyStages.findIndex((stage) => stage.key === stageKey);
}

function stageReached(currentStage: StoryStageKey, targetStage: StoryStageKey) {
  return getStageIndex(currentStage) >= getStageIndex(targetStage);
}

function focusAnimation(enabled: boolean, prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return { opacity: 1, scale: 1, y: 0 };
  }

  if (!enabled) {
    return { opacity: 0.52, scale: 0.98, y: 0 };
  }

  return {
    opacity: 1,
    scale: [1, 1.015, 1],
    y: [0, -4, 0],
  };
}

export function HeroMemoryStoryScene() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [stageIndex, setStageIndex] = useState(prefersReducedMotion ? storyStages.length - 1 : 0);
  const currentStage = storyStages[stageIndex]?.key ?? 'revenue';

  useEffect(() => {
    if (prefersReducedMotion) {
      setStageIndex(storyStages.length - 1);
      return;
    }

    const intervalId = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % storyStages.length);
    }, 2600);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  return (
    <div className="relative mx-auto w-full max-w-[640px] [perspective:1800px]">
      <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400">
        {storyStages.map((stage, index) => {
          const active = index === stageIndex;
          const reached = index < stageIndex;

          return (
            <div
              key={stage.key}
              className={[
                'rounded-full border px-3 py-2 transition',
                active
                  ? 'border-white/20 bg-white/12 text-white'
                  : reached
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                    : 'border-white/8 bg-white/[0.03] text-slate-500',
              ].join(' ')}
            >
              {String(index + 1).padStart(2, '0')} {stage.label}
            </div>
          );
        })}
      </div>

      <div className="relative min-h-[440px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,20,0.98),rgba(7,9,13,0.98))] p-5 shadow-[0_40px_120px_-48px_rgba(0,0,0,0.85)] sm:min-h-[500px] sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(74,222,128,0.12),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(99,102,241,0.16),transparent_22%),radial-gradient(circle_at_52%_58%,rgba(236,91,19,0.14),transparent_32%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px]" />

        <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 680 500">
          <motion.path
            d="M 128 142 C 188 150, 248 190, 322 208"
            stroke="rgba(148, 163, 184, 0.48)"
            strokeDasharray="7 8"
            strokeLinecap="round"
            strokeWidth="2.5"
            animate={prefersReducedMotion ? { opacity: 0.55, pathLength: 1 } : { opacity: stageReached(currentStage, 'capture') ? 0.75 : 0.2, pathLength: stageReached(currentStage, 'capture') ? 1 : 0.3 }}
            transition={{ duration: 1 }}
          />
          <motion.path
            d="M 172 348 C 240 332, 260 294, 332 268"
            stroke="rgba(148, 163, 184, 0.42)"
            strokeDasharray="7 8"
            strokeLinecap="round"
            strokeWidth="2.5"
            animate={prefersReducedMotion ? { opacity: 0.55, pathLength: 1 } : { opacity: stageReached(currentStage, 'memory') ? 0.75 : 0.18, pathLength: stageReached(currentStage, 'memory') ? 1 : 0.3 }}
            transition={{ duration: 1, delay: 0.08 }}
          />
          <motion.path
            d="M 392 228 C 460 220, 500 198, 552 168"
            stroke="rgba(251, 191, 36, 0.55)"
            strokeDasharray="10 10"
            strokeLinecap="round"
            strokeWidth="3"
            animate={prefersReducedMotion ? { opacity: 0.7, pathLength: 1 } : { opacity: stageReached(currentStage, 'recommend') ? [0.25, 0.8, 0.25] : 0.14, pathLength: stageReached(currentStage, 'recommend') ? 1 : 0.35 }}
            transition={{
              duration: 1.25,
              opacity: {
                duration: 2.4,
                repeat: prefersReducedMotion || !stageReached(currentStage, 'recommend') ? 0 : Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              },
            }}
          />
          <motion.path
            d="M 562 232 C 586 276, 590 310, 560 348"
            stroke="rgba(74, 222, 128, 0.56)"
            strokeDasharray="9 9"
            strokeLinecap="round"
            strokeWidth="3"
            animate={prefersReducedMotion ? { opacity: 0.7, pathLength: 1 } : { opacity: stageReached(currentStage, 'revenue') ? [0.22, 0.82, 0.22] : 0.14, pathLength: stageReached(currentStage, 'revenue') ? 1 : 0.28 }}
            transition={{
              duration: 1.2,
              delay: 0.12,
              opacity: {
                duration: 2.2,
                repeat: prefersReducedMotion || !stageReached(currentStage, 'revenue') ? 0 : Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              },
            }}
          />
        </svg>

        <motion.div
          className="absolute left-3 top-12 z-10 w-[220px] rounded-[30px] border border-white/12 bg-white/[0.05] p-4 text-white shadow-[0_28px_50px_-34px_rgba(15,23,42,0.92)] backdrop-blur-md sm:left-5 sm:w-[242px]"
          style={{ transform: 'translateZ(64px) rotateY(-7deg) rotateX(2deg)' }}
          animate={focusAnimation(currentStage === 'arrival', prefersReducedMotion)}
          transition={{ duration: 0.75, ease: 'easeOut', repeat: prefersReducedMotion || currentStage !== 'arrival' ? 0 : Number.POSITIVE_INFINITY, repeatType: 'mirror' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">PUBLIC PAGE</p>
              <p className="mt-1 text-lg font-semibold">첫 방문자 유입</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-200">
              <Icons.Globe size={18} />
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-slate-950/40 p-3">
            <div className="flex items-center gap-3">
              <motion.div
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200"
                animate={prefersReducedMotion ? { scale: 1 } : currentStage === 'arrival' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 1.6, repeat: prefersReducedMotion || currentStage !== 'arrival' ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
              >
                <Icons.Users size={18} />
              </motion.div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">성수점 브런치랩</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">지도 검색 후 공개페이지 방문 · 오전 11:42</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-8 left-3 z-10 w-[242px] rounded-[30px] border border-white/10 bg-white/[0.04] p-4 text-white shadow-[0_28px_50px_-36px_rgba(2,6,23,0.95)] backdrop-blur-md sm:left-6 sm:w-[258px]"
          style={{ transform: 'translateZ(36px) rotateY(-6deg) rotateX(2deg)' }}
          animate={focusAnimation(currentStage === 'capture', prefersReducedMotion)}
          transition={{ duration: 0.75, ease: 'easeOut', repeat: prefersReducedMotion || currentStage !== 'capture' ? 0 : Number.POSITIVE_INFINITY, repeatType: 'mirror' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">CAPTURE</p>
              <p className="mt-1 text-base font-semibold">행동 수집 채널</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-300">FREE 시작점</span>
          </div>

          <div className="mt-4 space-y-2">
            {captureActions.map((action) => {
              const Icon = action.icon;
              const active = currentStage === 'capture';
              const reached = stageReached(currentStage, 'capture');

              return (
                <motion.div
                  key={action.key}
                  className={[
                    'flex items-center gap-3 rounded-2xl border px-3 py-3 transition',
                    reached ? 'border-white/10 bg-white/[0.06]' : 'border-white/6 bg-white/[0.03] text-slate-500',
                  ].join(' ')}
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1, x: 0 }
                      : {
                          opacity: reached ? 1 : 0.45,
                          x: active ? [0, 3, 0] : 0,
                        }
                  }
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-slate-200">
                    <Icon size={16} />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="absolute left-[47%] top-[47%] z-20 w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(21,26,34,0.96),rgba(9,12,18,0.96))] p-5 text-white shadow-[0_36px_80px_-40px_rgba(0,0,0,0.95)] backdrop-blur-md sm:w-[326px] sm:p-6"
          style={{ transform: 'translateZ(92px) rotateX(5deg)' }}
          animate={focusAnimation(currentStage === 'memory', prefersReducedMotion)}
          transition={{ duration: 0.75, ease: 'easeOut', repeat: prefersReducedMotion || currentStage !== 'memory' ? 0 : Number.POSITIVE_INFINITY, repeatType: 'mirror' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">CUSTOMER MEMORY</p>
              <p className="mt-1 text-xl font-semibold">한 고객으로 연결된 기록</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/16 text-orange-200">
              <Icons.Users size={18} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[24px] border border-white/8 bg-white/[0.05] px-4 py-3">
            <div>
              <p className="text-base font-semibold">김서연 고객</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">이전 방문 2회 · 브런치 선호 · 예약 후 대기 이력 있음</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
              {stageReached(currentStage, 'memory') ? '매칭 완료' : '대기'}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {timelineItems.map((item, index) => (
              <motion.div
                key={item.label}
                className={[
                  'flex items-start gap-3 rounded-2xl px-3 py-3 transition',
                  stageReached(currentStage, 'memory') ? 'bg-white/[0.06] text-white' : 'bg-white/[0.03] text-slate-500',
                ].join(' ')}
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : {
                        opacity: stageReached(currentStage, 'memory') ? (index === 2 && currentStage === 'memory' ? [0.75, 1, 0.75] : 1) : 0.45,
                      }
                }
                transition={{ duration: 0.6, delay: index * 0.06 }}
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-300" />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="absolute right-3 top-14 z-10 w-[228px] rounded-[30px] border border-white/10 bg-white/[0.05] p-4 text-white shadow-[0_28px_50px_-34px_rgba(2,6,23,0.9)] backdrop-blur-md sm:right-6 sm:w-[244px]"
          style={{ transform: 'translateZ(56px) rotateY(7deg) rotateX(2deg)' }}
          animate={focusAnimation(currentStage === 'recommend', prefersReducedMotion)}
          transition={{ duration: 0.75, ease: 'easeOut', repeat: prefersReducedMotion || currentStage !== 'recommend' ? 0 : Number.POSITIVE_INFINITY, repeatType: 'mirror' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">NEXT ACTION</p>
              <p className="mt-1 text-base font-semibold">다음 행동 추천</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
              <Icons.Zap size={18} />
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-slate-950/38 p-4">
            <p className="text-lg font-semibold">7일 뒤 재방문 메시지</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">예약과 현장 대기 이력이 함께 있어, 다음 주 점심 시간 재방문 유도가 가장 가깝습니다.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1">재방문 유도</span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1">단골 전환</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-8 right-3 z-10 w-[220px] rounded-[30px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(17,24,22,0.96),rgba(10,14,13,0.98))] p-4 text-white shadow-[0_28px_50px_-34px_rgba(4,120,87,0.42)] backdrop-blur-md sm:right-6 sm:w-[236px]"
          style={{ transform: 'translateZ(44px) rotateY(6deg)' }}
          animate={focusAnimation(currentStage === 'revenue', prefersReducedMotion)}
          transition={{ duration: 0.75, ease: 'easeOut', repeat: prefersReducedMotion || currentStage !== 'revenue' ? 0 : Number.POSITIVE_INFINITY, repeatType: 'mirror' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/70">REVENUE OUTCOME</p>
              <p className="mt-1 text-base font-semibold">반복 방문의 시작</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200">
              <Icons.Chart size={18} />
            </div>
          </div>

          <div className="mt-4 flex items-end gap-2">
            {[44, 62, 78].map((height, index) => (
              <div key={height} className="flex h-20 flex-1 items-end rounded-2xl bg-white/[0.05] p-2">
                <motion.div
                  className="w-full rounded-full bg-[linear-gradient(180deg,rgba(16,185,129,0.95),rgba(74,222,128,0.65))]"
                  animate={
                    prefersReducedMotion
                      ? { height: `${height}%` }
                      : {
                          height: stageReached(currentStage, 'revenue') ? [`36%`, `${height}%`, `${Math.max(40, height - 8)}%`, `${height}%`] : '28%',
                        }
                  }
                  transition={{ duration: 1.2, delay: index * 0.08, repeat: prefersReducedMotion || !stageReached(currentStage, 'revenue') ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 text-sm text-emerald-50/90">
            {outcomeItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="absolute inset-x-6 bottom-4 z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage}
              className="rounded-[26px] border border-white/10 bg-black/30 px-4 py-3 text-white backdrop-blur-md"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {storyStages[stageIndex]?.label}
              </p>
              <p className="mt-1 text-sm font-semibold sm:text-base">{storyStages[stageIndex]?.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">{storyStages[stageIndex]?.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
