import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';

import { HeroMemoryStoryScene, type DiagnosisHeroStepId } from '@/shared/components/HeroMemoryStoryScene';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 공개페이지 유입부터 문의·예약·웨이팅 수집, 고객 기억 결합, 실행안 도출, 반복 매출 회수까지를 한 흐름으로 연결하는 고객 기억 기반 매출 시스템입니다.';

const diagnosisFilmSteps = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    title: '방문자가 공개페이지에 도착합니다',
    detail: '공개페이지로 들어온 첫 유입은 어떤 매장인지, 어떤 운영 문맥에서 행동이 시작되는지부터 보여줍니다.',
  },
  {
    id: 'signal-capture',
    number: '02',
    label: '신호 수집',
    title: '문의·예약·웨이팅이 같은 흐름으로 모입니다',
    detail: '흩어진 행동 채널을 따로 두지 않고 하나의 고객 흐름으로 받아야 이후의 고객 기억이 정확해집니다.',
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    title: '새 고객은 만들고, 다시 온 고객은 이어 붙입니다',
    detail: '문의, 예약, 웨이팅 이력이 한 고객 카드와 타임라인으로 묶일 때 비로소 반복 방문과 병목이 보이기 시작합니다.',
  },
  {
    id: 'action-plan',
    number: '04',
    label: '실행안 도출',
    title: '지금 가장 가까운 다음 행동을 제안합니다',
    detail: '재방문 메시지, 업셀 제안, 예약 후속처럼 운영자가 바로 실행할 수 있는 다음 행동이 이 단계에서 정리됩니다.',
  },
  {
    id: 'revenue-recovery',
    number: '05',
    label: '매출 회수',
    title: '기억은 반복 방문과 객단가로 돌아옵니다',
    detail: '고객 기억이 남아야 다시 방문할 손님과 추가 제안을 구분할 수 있고, 그 결과가 단골 매출로 회수됩니다.',
  },
] as const;

const planLadder = [
  {
    name: 'FREE',
    tone: 'border-white/10 bg-white/[0.03]',
    badge: 'Acquisition',
    title: '공개 유입을 시작하고 첫 행동을 받는 단계',
    summary: '공개페이지, 기본 문의, 기본 웨이팅으로 고객이 남기는 첫 신호를 모읍니다.',
    features: ['공개페이지', '기본 문의', '기본 웨이팅'],
  },
  {
    name: 'PRO',
    tone: 'border-orange-300/30 bg-[linear-gradient(180deg,rgba(236,91,19,0.12),rgba(255,255,255,0.05))]',
    badge: 'Operations',
    title: '예약 운영과 고객 타임라인을 붙이는 단계',
    summary: '예약, 고객 카드, 타임라인으로 누가 다시 왔는지와 어디서 전환이 끊기는지를 운영 화면에서 읽습니다.',
    features: ['예약', '고객 CRM', '고객 타임라인'],
  },
  {
    name: 'VIP',
    tone: 'border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(255,255,255,0.04))]',
    badge: 'Growth',
    title: '고객 기억을 다음 행동과 반복 매출로 연결하는 단계',
    summary: '고객 기억, 재방문 자동화, AI 리포트로 재방문과 업셀 기회를 반복 가능한 루프로 바꿉니다.',
    features: ['고객 기억', '재방문 자동화', 'AI 리포트'],
  },
] as const;

export function LandingPage() {
  const filmRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  usePageMeta('마이비즈랩', landingDescription);

  const { scrollYProgress } = useScroll({
    target: filmRef,
    offset: ['start start', 'end end'],
  });

  const sharedProgress = useSpring(scrollYProgress, prefersReducedMotion ? { stiffness: 320, damping: 42 } : { stiffness: 170, damping: 28, mass: 0.28 });
  const railFillWidth = useTransform(sharedProgress, [0, 1], ['0%', '100%']);
  const railPulseLeft = useTransform(sharedProgress, [0, 1], ['0%', '100%']);
  const ctaOpacity = useTransform(sharedProgress, [0, 0.48, 1], [0.74, 0.88, 1]);
  const proofOpacity = useTransform(sharedProgress, [0, 0.5, 1], [0.3, 0.55, 0.82]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const nextIndex = value >= 0.82 ? 4 : value >= 0.62 ? 3 : value >= 0.38 ? 2 : value >= 0.18 ? 1 : 0;
    setActiveStepIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash.replace('#', '');
    const hashIndex = diagnosisFilmSteps.findIndex((step) => step.id === hash);

    if (hashIndex >= 0) {
      setActiveStepIndex(hashIndex);
    }
  }, []);

  const activeStep = useMemo(() => diagnosisFilmSteps[activeStepIndex] ?? diagnosisFilmSteps[0], [activeStepIndex]);

  return (
    <div className="overflow-x-clip bg-[#04060a] text-white">
      <section ref={filmRef} className="relative border-b border-white/10 bg-[#04060a]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(236,91,19,0.14),transparent_22%),radial-gradient(circle_at_82%_14%,rgba(59,130,246,0.12),transparent_20%),linear-gradient(180deg,#03050a_0%,#06090f_42%,#04060a_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-12 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />

        <div className="sticky top-[80px] z-20 h-[calc(100svh-80px)] overflow-hidden lg:top-[84px] lg:h-[calc(100vh-84px)]">
          <div className="page-shell flex h-full flex-col py-5 sm:py-6 lg:py-8">
            <div className="relative mb-7 sm:mb-8">
              <div className="absolute left-0 right-0 top-[15px] h-px bg-white/10" />
              <motion.div
                aria-hidden="true"
                className="absolute left-0 top-[15px] h-px bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.9),rgba(129,140,248,0.75))]"
                style={{ width: railFillWidth }}
              />
              <motion.div
                aria-hidden="true"
                className="absolute top-[15px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/40 bg-orange-300 shadow-[0_0_26px_rgba(251,146,60,0.95)]"
                style={{ left: railPulseLeft }}
              />

              <nav aria-label="진단 플로우" className="relative grid grid-cols-5 gap-2 sm:gap-3">
                {diagnosisFilmSteps.map((step, index) => {
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
                              ? 'border-white/20 bg-white/30'
                              : 'border-white/10 bg-[#07090d]',
                        ].join(' ')}
                      />
                      <p className={['text-[10px] font-semibold uppercase tracking-[0.18em] transition', active ? 'text-orange-100' : 'text-slate-500'].join(' ')}>
                        {step.number}
                      </p>
                      <p className={['mt-1 text-sm font-semibold leading-5 transition', active ? 'text-white' : 'text-slate-300'].join(' ')}>{step.label}</p>
                    </a>
                  );
                })}
              </nav>
            </div>

            <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-12 xl:gap-18">
              <div className="max-w-[37rem] space-y-7 sm:space-y-8">
                <div className="space-y-6">
                  <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                    고객을 기억하는 매장 시스템
                  </span>
                  <h1 className="max-w-[13.5ch] font-display text-[2.4rem] font-black leading-[1.05] tracking-[-0.05em] text-white [word-break:keep-all] [text-wrap:balance] sm:text-[3rem] lg:max-w-[14.6ch] lg:text-[3.66rem]">
                    <span className="block lg:whitespace-nowrap">문의·예약·웨이팅을</span>
                    <span className="mt-1.5 block lg:whitespace-nowrap">한 고객 기억으로 묶어</span>
                    <span className="mt-1.5 block lg:whitespace-nowrap">단골 매출로 바꾸세요</span>
                  </h1>
                  <p className="max-w-[33rem] text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                    무료 공개페이지로 유입을 받고, 문의·AI 상담·예약·웨이팅을 고객 타임라인에 연결해 다음 행동까지 추천합니다.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep.id}
                    className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_26px_90px_-72px_rgba(0,0,0,0.95)]"
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-300/10 font-display text-xl font-black text-orange-100">
                        {activeStep.number}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">현재 진단 단계</p>
                        <p className="mt-2 text-xl font-semibold text-white">{activeStep.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{activeStep.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <motion.div className="flex flex-col gap-3.5 sm:flex-row" style={{ opacity: ctaOpacity }}>
                  <Link className="btn-primary min-w-[180px]" to={SUBSCRIPTION_START_PATH}>
                    무료 공개페이지 시작
                  </Link>
                  <Link
                    className="btn-secondary min-w-[180px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    to="/login"
                  >
                    운영 데모 보기
                  </Link>
                </motion.div>

                <motion.div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400" style={{ opacity: proofOpacity }}>
                  {['공개 유입', '문의/AI상담', '예약', '웨이팅', '고객 타임라인'].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-300/85" />
                      {item}
                    </span>
                  ))}
                </motion.div>
              </div>

              <HeroMemoryStoryScene
                activeStep={activeStep.id as DiagnosisHeroStepId}
                activeStepIndex={activeStepIndex}
                progress={sharedProgress}
              />
            </div>
          </div>
        </div>

        <div className="-mt-[calc(100svh-80px)] lg:-mt-[calc(100vh-84px)]">
          {diagnosisFilmSteps.map((step) => (
            <div key={step.id} className="h-[48vh] sm:h-[52vh] lg:h-[60vh]" id={step.id} />
          ))}
        </div>
      </section>

      <section className="relative border-b border-white/10 bg-[#06090d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(236,91,19,0.1),transparent_24%)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className="max-w-[44rem] space-y-4">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              플랜 사다리
            </span>
            <h2 className="max-w-[14ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
              FREE로 유입을 만들고, PRO와 VIP로 고객 기억과 반복 매출을 확장합니다
            </h2>
            <p className="text-base leading-7 text-slate-300">
              공개 유입부터 시작하고, 고객 신호가 쌓일수록 예약 운영, 고객 기억, 재방문 실행안까지 자연스럽게 연결되는 구조입니다.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {planLadder.map((plan) => (
              <article key={plan.name} className={`flex h-full flex-col rounded-[32px] border p-6 ${plan.tone}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{plan.badge}</p>
                    <h3 className="mt-2 font-display text-[2rem] font-black tracking-[-0.04em] text-white">{plan.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200">
                    {plan.name === 'FREE' ? '유입 시작' : plan.name === 'PRO' ? '운영 연결' : '매출 확장'}
                  </span>
                </div>

                <p className="mt-6 text-xl font-semibold leading-8 text-white">{plan.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{plan.summary}</p>

                <div className="mt-6 space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
