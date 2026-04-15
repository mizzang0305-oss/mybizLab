import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';

import { HeroMemoryStoryScene } from '@/shared/components/HeroMemoryStoryScene';
import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import {
  DIAGNOSIS_CORRIDOR_LINK_STATE,
  DIAGNOSIS_CORRIDOR_STEPS,
  getDiagnosisCorridorStepIndex,
} from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 공개 페이지 유입, 문의·예약·웨이팅 캡처, 고객 기억 결합, 다음 액션 도출, 운영 대시보드와 회복 매출까지 하나의 진단 복도로 이어주는 customer-memory revenue system입니다.';

const planLadder = [
  {
    name: 'FREE',
    badge: 'Arrival',
    summary: '공개 페이지 유입과 문의 신호를 가장 빠르게 잡는 시작 단계입니다.',
    details: ['공개 페이지', '문의 수집', '기본 예약 흐름'],
    tone: 'border-white/10 bg-white/[0.03]',
  },
  {
    name: 'PRO',
    badge: 'Memory',
    summary: '예약, 웨이팅, 고객 타임라인을 묶어 고객 기억을 운영 흐름으로 연결합니다.',
    details: ['예약 운영', '고객 기억 결합', '재방문 추적'],
    tone: 'border-orange-300/30 bg-[linear-gradient(180deg,rgba(236,91,19,0.14),rgba(255,255,255,0.04))]',
  },
  {
    name: 'VIP',
    badge: 'Recovery',
    summary: '다음 액션과 회복 매출 루프까지 자동화해 운영 대시보드의 밀도를 높입니다.',
    details: ['실행안 도출', '리마인드 자동화', '회복 매출 리포트'],
    tone: 'border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(255,255,255,0.04))]',
  },
] as const;

const dashboardSignals = [
  { label: '재방문 메시지 회복', value: '+18%' },
  { label: '예약 후속 전환', value: '+12%' },
  { label: '업셀 힌트 반응', value: '+9%' },
] as const;

const continuityBullets = ['공개 페이지 유입', '문의·예약·웨이팅 캡처', '고객 기억 결합', '다음 액션 도출', '운영 대시보드 payoff'] as const;

export function LandingPage() {
  const corridorRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  usePageMeta('마이비즈랩', landingDescription);

  const { scrollYProgress } = useScroll({
    target: corridorRef,
    offset: ['start start', 'end end'],
  });

  const sharedProgress = useSpring(
    scrollYProgress,
    prefersReducedMotion ? { stiffness: 320, damping: 42 } : { stiffness: 170, damping: 28, mass: 0.28 },
  );
  const railFillWidth = useTransform(sharedProgress, [0, 1], ['0%', '100%']);
  const railPulseLeft = useTransform(sharedProgress, [0, 1], ['0%', '100%']);
  const stageHaloX = useTransform(sharedProgress, [0, 1], ['18%', '76%']);
  const stageHaloOpacity = useTransform(sharedProgress, [0, 0.4, 1], [0.34, 0.56, 0.4]);
  const ctaOpacity = useTransform(sharedProgress, [0, 0.4, 1], [0.78, 0.9, 1]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const nextIndex = getDiagnosisCorridorStepIndex(value);
    setActiveStepIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  const activeStep = DIAGNOSIS_CORRIDOR_STEPS[activeStepIndex] ?? DIAGNOSIS_CORRIDOR_STEPS[0];

  return (
    <div data-corridor-shell="continuous" className="relative overflow-x-clip bg-[#03050a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(236,91,19,0.12),transparent_28%),radial-gradient(circle_at_84%_12%,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,#02050a_0%,#05080e_38%,#04070c_100%)]" />
        <div className="absolute inset-0 opacity-12 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <section ref={corridorRef} className="relative border-b border-white/10">
        <div className="sticky top-[78px] z-20 h-[calc(100svh-78px)] overflow-hidden lg:top-[84px] lg:h-[calc(100vh-84px)]">
          <div className="page-shell relative flex h-full flex-col py-5 sm:py-6 lg:py-8">
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[8%] top-[10%] h-[36rem] rounded-full bg-[radial-gradient(circle,rgba(236,91,19,0.18),rgba(99,102,241,0.12),transparent_72%)] blur-3xl"
              style={{ left: stageHaloX, opacity: stageHaloOpacity }}
            />

            <div className="relative mb-8 sm:mb-10">
              <div className="absolute left-0 right-0 top-[16px] h-px bg-white/10" />
              <motion.div
                aria-hidden="true"
                className="absolute left-0 top-[16px] h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(129,140,248,0.8))]"
                style={{ width: railFillWidth }}
              />
              <motion.div
                aria-hidden="true"
                className="absolute top-[16px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/40 bg-orange-300 shadow-[0_0_28px_rgba(251,146,60,0.95)]"
                style={{ left: railPulseLeft }}
              />

              <nav aria-label="진단 복도 단계" className="relative grid grid-cols-5 gap-2 sm:gap-3">
                {DIAGNOSIS_CORRIDOR_STEPS.map((step, index) => {
                  const active = index === activeStepIndex;
                  const reached = index < activeStepIndex;

                  return (
                    <a
                      key={step.id}
                      aria-current={active ? 'step' : undefined}
                      className="group rounded-[20px] px-1.5 pt-7 pb-1 text-left transition sm:px-2"
                      href={`#${step.id}`}
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
                    </a>
                  );
                })}
              </nav>
            </div>

            <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] lg:gap-12 xl:gap-18">
              <div className="max-w-[34rem] space-y-7">
                <div className="space-y-5">
                  <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                    Customer-memory revenue system
                  </span>
                  <h1 className="max-w-[12.6ch] font-display text-[2.45rem] font-black leading-[1.02] tracking-[-0.05em] text-white [text-wrap:balance] sm:text-[3.2rem] lg:text-[3.95rem]">
                    공개 페이지에서 받은 신호를 고객 기억으로 묶어 다음 매출로 전환합니다
                  </h1>
                  <p className="max-w-[31rem] text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                    MyBiz는 공개 페이지 유입부터 문의, 예약, 웨이팅 캡처를 같은 레일에 올리고, 고객 기억 결합과 다음 액션 도출을 거쳐
                    마지막에만 운영 대시보드 payoff를 보여주는 매출 회복 시스템입니다.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep.id}
                    className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_-62px_rgba(0,0,0,0.98)] backdrop-blur-xl"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-300/10 font-display text-xl font-black text-orange-100">
                        {activeStep.number}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{activeStep.label}</p>
                          <p className="mt-2 text-xl font-semibold text-white">{activeStep.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{activeStep.detail}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeStep.highlights.map((item) => (
                            <span
                              key={item}
                              className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <motion.div className="space-y-4" style={{ opacity: ctaOpacity }}>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link className="btn-primary min-w-[190px]" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                      무료 공개페이지 시작
                    </Link>
                    <Link
                      className="btn-secondary min-w-[190px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                      to="/login"
                    >
                      운영 화면 보기
                    </Link>
                  </div>
                  <p className="text-sm leading-6 text-slate-400">
                    클릭하면 같은 어두운 진단 셸을 유지한 채 스토어 시작 패널로 이어집니다. 더 이상 다른 사이트로 점프하는 느낌이 나지 않도록
                    온보딩도 같은 세계 안에서 이어집니다.
                  </p>
                </motion.div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
                  {continuityBullets.map((item) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-300/85" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <HeroMemoryStoryScene activeStep={activeStep.id} activeStepIndex={activeStepIndex} progress={sharedProgress} />
            </div>
          </div>
        </div>

        <div className="-mt-[calc(100svh-78px)] lg:-mt-[calc(100vh-84px)]">
          {DIAGNOSIS_CORRIDOR_STEPS.map((step) => (
            <div key={step.id} className="h-[76svh] scroll-mt-28 sm:h-[82svh] lg:h-[92vh]" id={step.id} />
          ))}
        </div>
      </section>

      <section className="relative border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(236,91,19,0.08),transparent_24%),radial-gradient(circle_at_82%_28%,rgba(16,185,129,0.08),transparent_22%)]" />
        <div className="page-shell relative py-16 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Dashboard payoff
              </span>
              <h2 className="max-w-[13ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.8rem]">
                운영 대시보드는 같은 메모리 시스템에서만 마지막에 떠오릅니다
              </h2>
              <p className="text-base leading-7 text-slate-300">
                공개 페이지에서 시작한 신호, 고객 기억, 다음 액션이 한 번 더 끊기지 않고 대시보드까지 이어집니다. 그래서 대시보드가 별도 기능이
                아니라 회복 매출의 최종 장면으로 보입니다.
              </p>
              <div className="space-y-3">
                {dashboardSignals.map((signal) => (
                  <div key={signal.label} className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4">
                    <span className="text-sm font-medium text-slate-200">{signal.label}</span>
                    <span className="text-lg font-semibold text-white">{signal.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.96),rgba(5,9,14,0.94))] p-5 shadow-[0_42px_110px_-74px_rgba(0,0,0,0.98)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Same world proof</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">고객 기억이 운영 판단으로 수렴되는 화면</h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-orange-100">
                  <Icons.Dashboard size={16} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">회복 우선순위</p>
                    <span className="text-xs text-slate-500">today</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      '웨이팅 이탈 고객에게 다시 방문 메시지 발송',
                      '예약 시도 후 미완료 고객에게 즉시 후속 연락',
                      '업셀 반응이 높았던 고객군에 한정 메뉴 재제안',
                    ].map((item, index) => (
                      <div key={item} className="flex gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3">
                        <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-300/12 text-xs font-bold text-orange-100">
                          0{index + 1}
                        </span>
                        <p className="text-sm leading-6 text-slate-200">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">회복 매출 흐름</p>
                    <div className="mt-4 flex h-28 items-end gap-3">
                      {[32, 54, 76, 68].map((height) => (
                        <div key={height} className="flex h-full flex-1 items-end rounded-[18px] bg-white/[0.04] p-2">
                          <div
                            className="w-full rounded-full bg-[linear-gradient(180deg,rgba(52,211,153,0.96),rgba(251,146,60,0.7))]"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">대시보드에 올라오는 핵심 루프</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['공개 유입', '고객 기억', '실행안', '회복 매출', '재방문 판단'].map((item) => (
                        <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/10">
        <div className="page-shell relative py-16 sm:py-20">
          <div className="max-w-[46rem] space-y-4">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              FREE / PRO / VIP
            </span>
            <h2 className="max-w-[14ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.75rem]">
              공개 유입에서 고객 기억, 실행안, 회복 매출까지 같은 사다리로 확장됩니다
            </h2>
            <p className="text-base leading-7 text-slate-300">
              FREE는 유입과 첫 신호를 붙이고, PRO는 고객 기억을 운영으로 연결하며, VIP는 실행안과 회복 매출 루프를 더 깊게 돌립니다. 아래 단계도
              같은 dark world 안에서 이어집니다.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {planLadder.map((plan) => (
              <article key={plan.name} className={`flex h-full flex-col rounded-[32px] border p-6 ${plan.tone}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{plan.badge}</p>
                    <h3 className="mt-2 font-display text-[2rem] font-black tracking-[-0.04em] text-white">{plan.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200">
                    {plan.name === 'FREE' ? '유입 시작' : plan.name === 'PRO' ? '기억 확장' : '회복 매출'}
                  </span>
                </div>

                <p className="mt-6 text-lg font-semibold leading-8 text-white">{plan.summary}</p>
                <div className="mt-6 space-y-3">
                  {plan.details.map((detail) => (
                    <div key={detail} className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="page-shell relative py-16 sm:py-20">
          <div className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,26,0.94),rgba(5,9,14,0.92))] px-6 py-8 shadow-[0_40px_120px_-72px_rgba(0,0,0,0.98)] sm:px-8 sm:py-10 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.75fr)] lg:items-center">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-100">
                  Continuity CTA
                </span>
                <h2 className="max-w-[15ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.7rem]">
                  진단 복도는 여기서 끝나지 않고 같은 셸로 스토어 시작 패널까지 이어집니다
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-300">
                  무료 공개페이지 시작을 누르면 같은 dark shell과 glow language를 유지한 채 온보딩으로 넘어갑니다. 이후에도 스토어 생성, 결제, 승인,
                  대시보드 진입까지 같은 맥락으로 이어집니다.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link className="btn-primary min-w-[190px]" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                    무료 공개페이지 시작
                  </Link>
                  <Link
                    className="btn-secondary min-w-[190px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    to="/pricing"
                  >
                    플랜 비교 보기
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-white">연결이 유지되는 이유</p>
                <div className="mt-4 space-y-3">
                  {[
                    '같은 dark world와 rail 언어를 onboarding에서도 그대로 유지합니다.',
                    '대시보드는 corridor final step에서만 떠오르고, 이후 proof section이 같은 배경 위에서 이어집니다.',
                    'FREE / PRO / VIP와 마지막 CTA까지 별도 랜딩 페이지처럼 끊기지 않도록 동일한 시각 시스템을 유지합니다.',
                  ].map((item) => (
                    <div key={item} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
