import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { CinematicServiceWorld } from '@/shared/components/CinematicServiceWorld';
import {
  CONNECTED_SERVICE_CARDS,
  CONSULTATION_PROGRESS_LABELS,
  CONSULTATION_STORY_STEPS,
} from '@/shared/lib/cinematicScenes';

const toneClasses: Record<'blue' | 'green' | 'orange' | 'purple', { dot: string; glow: string; panel: string; text: string }> = {
  blue: {
    dot: 'bg-sky-300',
    glow: 'shadow-[0_0_32px_rgba(125,211,252,0.72)]',
    panel: 'border-sky-300/20 bg-sky-300/[0.08]',
    text: 'text-sky-100',
  },
  green: {
    dot: 'bg-emerald-300',
    glow: 'shadow-[0_0_32px_rgba(110,231,183,0.62)]',
    panel: 'border-emerald-300/20 bg-emerald-300/[0.08]',
    text: 'text-emerald-100',
  },
  orange: {
    dot: 'bg-orange-300',
    glow: 'shadow-[0_0_34px_rgba(251,146,60,0.75)]',
    panel: 'border-orange-300/22 bg-orange-300/[0.1]',
    text: 'text-orange-100',
  },
  purple: {
    dot: 'bg-violet-300',
    glow: 'shadow-[0_0_34px_rgba(167,139,250,0.7)]',
    panel: 'border-violet-300/22 bg-violet-300/[0.1]',
    text: 'text-violet-100',
  },
};

export function ConsultationAnalysisPanel({
  children,
  currentProgressIndex,
}: {
  children: ReactNode;
  currentProgressIndex: number;
}) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#050b14] p-4 text-white shadow-[0_24px_90px_-58px_rgba(15,23,42,0.95)] sm:p-5"
      data-consultation-panel="analysis"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(251,146,60,0.16),transparent_24%),radial-gradient(circle_at_90%_12%,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_34%)]" />
      <div className="relative z-10 space-y-5">
        <div>
          <p className="text-[11px] font-black tracking-[0.22em] text-orange-300">MyBiz</p>
          <h2 aria-label="AI 분석 및 상담" className="mt-3 break-keep font-display text-3xl font-black tracking-[-0.05em] text-white">
            <span className="text-orange-300">AI</span> 분석 및 상담
          </h2>
          <p className="mt-3 break-keep text-sm leading-7 text-slate-300">
            상담 흐름 속에서 우리 가게의 현재 상태를 읽고, 다음 액션을 제안합니다.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4" aria-label="상담 진행 상황">
          <p className="text-xs font-bold text-slate-300">상담 진행 상황</p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {CONSULTATION_PROGRESS_LABELS.map((label, index) => {
              const active = index <= currentProgressIndex;
              return (
                <div key={label} className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={[
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black',
                        active ? 'border-orange-300/50 bg-orange-300/20 text-orange-100' : 'border-white/12 bg-white/[0.04] text-slate-500',
                      ].join(' ')}
                    >
                      {index + 1}
                    </span>
                    {index < CONSULTATION_PROGRESS_LABELS.length - 1 ? (
                      <span className={active ? 'h-px flex-1 bg-orange-300/46' : 'h-px flex-1 bg-white/10'} />
                    ) : null}
                  </div>
                  <p className={['mt-2 break-keep text-[10px] font-semibold leading-4', active ? 'text-slate-100' : 'text-slate-500'].join(' ')}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/18 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-xs font-bold text-slate-100">
              사장
            </span>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-slate-100">
              최근 매출이 정체되어 고민이에요. 고객 방문은 있는데, 재방문이 적은 것 같아요.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-400 text-xs font-black text-white shadow-[0_0_28px_rgba(251,146,60,0.62)]">
              AI
            </span>
            <div className="rounded-2xl border border-orange-300/18 bg-orange-300/[0.08] px-4 py-3 text-sm leading-6 text-orange-50">
              현재 데이터를 분석하고 있어요. 잠시만 기다려 주세요.
              <motion.span
                animate={{ opacity: reducedMotion ? 0.65 : [0.3, 1, 0.3] }}
                className="ml-2 inline-flex gap-1 align-middle"
                transition={{ duration: 1.4, repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY }}
              >
                <span>·</span>
                <span>·</span>
                <span>·</span>
              </motion.span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-sky-300/16 bg-sky-300/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-sky-100">AI 분석 요약</p>
            <span className="rounded-full border border-sky-200/20 bg-sky-200/10 px-2 py-0.5 text-[10px] font-bold text-sky-100">
              실시간 분석 중
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['고객 유입', '+12.4%', 'text-sky-100'],
              ['재방문율', '-18.7%', 'text-orange-200'],
              ['객단가', '+8.3%', 'text-emerald-200'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] font-semibold text-slate-400">{label}</p>
                <p className={`mt-1 font-display text-2xl font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-orange-300/18 bg-orange-300/[0.07] p-4">
          <p className="text-xs font-bold text-orange-100">핵심 인사이트</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
            <li>신규 유입은 증가했지만 재방문율이 낮습니다.</li>
            <li>고객 기억 데이터에서 만족 포인트는 ‘맛’, 아쉬움은 ‘웨이팅’이에요.</li>
            <li>재방문 유도를 위한 맞춤 혜택/메시지 전략이 필요합니다.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-300">추천 액션</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {['웨이팅 최적화', '단골 혜택 캠페인', '메뉴 추천 고도화'].map((action) => (
              <button
                key={action}
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-left text-xs font-bold text-white transition hover:border-orange-300/36 hover:bg-orange-300/[0.1] focus:outline-none focus:ring-2 focus:ring-orange-300/60"
                type="button"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/12 bg-white/[0.035] p-3">
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-300/60"
              placeholder="무엇이든 물어보세요…"
              readOnly
            />
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300/70"
              type="button"
            >
              전송
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['재방문을 늘리려면?', '메뉴 구성을 점검할까?', '마케팅 예산은?'].map((prompt) => (
              <button key={prompt} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-300" type="button">
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-3" data-consultation-live-form="true">
          {children}
        </div>
      </div>
    </section>
  );
}

export function ConsultationStoryPath({ activeIndex = 1 }: { activeIndex?: number }) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <section
      className="relative min-h-[46rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#02050a] p-5 text-white shadow-[0_24px_90px_-58px_rgba(15,23,42,0.95)]"
      data-consultation-story-path="center"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_54%_8%,rgba(96,165,250,0.18),transparent_22%),radial-gradient(circle_at_42%_52%,rgba(251,146,60,0.16),transparent_27%),linear-gradient(180deg,#03101e_0%,#02050a_100%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(115deg,rgba(96,165,250,0.08),transparent_32%,rgba(251,146,60,0.1)_50%,transparent_72%)]" />
      <svg aria-hidden className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 100 140">
        <motion.path
          animate={{ pathLength: reducedMotion ? 1 : [0.76, 1, 0.86] }}
          d="M50 6 C18 26, 80 38, 48 56 C18 76, 82 86, 50 104 C28 118, 56 130, 50 136"
          stroke="url(#consultation-story-glow)"
          strokeLinecap="round"
          strokeWidth="1.1"
          transition={{ duration: 6, ease: 'easeInOut', repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY }}
        />
        <defs>
          <linearGradient id="consultation-story-glow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(96,165,250,0.86)" />
            <stop offset="52%" stopColor="rgba(251,146,60,0.9)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0.8)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10">
        <p className="text-[11px] font-black tracking-[0.22em] text-orange-300">고객 기억 스토리</p>
        <h2 className="mt-3 break-keep font-display text-2xl font-black leading-tight tracking-[-0.04em]">
          고객 행동이 운영 개선과 매출 인사이트로 흐릅니다
        </h2>
      </div>

      <div className="relative z-10 mt-8 space-y-5">
        {CONSULTATION_STORY_STEPS.map((step, index) => {
          const active = index <= activeIndex + 1;
          const tone = toneClasses[step.tone];
          return (
            <motion.article
              key={step.label}
              animate={{ opacity: active ? 1 : 0.46, x: reducedMotion ? 0 : index % 2 === 0 ? [0, 4, 0] : [0, -4, 0] }}
              className={[
                'relative flex gap-3 rounded-3xl border p-4 backdrop-blur-xl',
                tone.panel,
                active ? 'shadow-[0_18px_60px_-44px_rgba(251,146,60,0.75)]' : '',
              ].join(' ')}
              transition={{ duration: reducedMotion ? 0.16 : 4.6 + index * 0.12, repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY }}
            >
              <span className={['mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-slate-950', tone.dot, active ? tone.glow : ''].join(' ')}>
                {index + 1}
              </span>
              <div>
                <h3 className={['text-base font-black', tone.text].join(' ')}>{step.label}</h3>
                <p className="mt-1 break-keep text-sm leading-6 text-slate-300">{step.caption}</p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

export function ConnectedServicesBoard({ activeStepIndex = 1 }: { activeStepIndex?: number }) {
  return (
    <aside
      className="space-y-4 rounded-[2rem] border border-white/10 bg-[#050b14] p-4 text-white shadow-[0_24px_90px_-58px_rgba(15,23,42,0.95)]"
      data-connected-services-board="right"
      data-mybi-avoid
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="break-keep text-sm leading-6 text-slate-300">
            우리 가게의 모든 서비스가 MyBiz 하나로 연결됩니다.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
          실시간 동기화 중
        </span>
      </div>

      <CinematicServiceWorld className="min-h-[20rem]" compact stepIndex={activeStepIndex} />

      <div className="grid gap-3 sm:grid-cols-2">
        {CONNECTED_SERVICE_CARDS.map((card, index) => {
          const tone = toneClasses[card.tone];
          const active = index % 4 === activeStepIndex % 4 || card.title === '고객 기억';
          return (
            <article
              key={card.title}
              className={[
                'rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:border-orange-300/40',
                active ? tone.panel : 'border-white/10 bg-white/[0.04]',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-white">{card.title}</h3>
                  <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{card.metric}</p>
                </div>
                <span className={['mt-1 h-2.5 w-2.5 rounded-full', tone.dot].join(' ')} />
              </div>
              <p className="mt-2 min-h-10 break-keep text-xs leading-5 text-slate-400">{card.detail}</p>
              <button
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-white/[0.08]"
                type="button"
              >
                {card.action}
              </button>
            </article>
          );
        })}
      </div>

      <div className="rounded-3xl border border-emerald-300/18 bg-emerald-300/[0.08] p-4">
        <div className="flex flex-wrap gap-3 text-[11px] font-bold text-emerald-100">
          <span>연결된 서비스 9개</span>
          <span>데이터 파이프라인 정상</span>
          <span>보안 상태 안전</span>
        </div>
      </div>
    </aside>
  );
}
