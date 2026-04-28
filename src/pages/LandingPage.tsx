import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { CinematicServiceWorld } from '@/shared/components/CinematicServiceWorld';
import { Icons } from '@/shared/components/Icons';
import { usePersistentDiagnosisWorldSurface } from '@/shared/components/PersistentDiagnosisWorldShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { CINEMATIC_SCENES } from '@/shared/lib/cinematicScenes';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { PRICING_PLANS, SERVICE_DESCRIPTION, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const META_TITLE = 'MyBiz | 고객 기억을 매출로 바꾸는 고객-메모리 매출 시스템';
const META_DESCRIPTION = SERVICE_DESCRIPTION;

type IconKey = 'AI' | 'Table' | 'Reservation' | 'Message' | 'Dashboard' | 'Chart';

interface Feature {
  desc: string;
  icon: IconKey;
  tag: string;
  title: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'AI',
    title: 'AI 스토어 진단',
    desc: '업종, 운영 방식, 고민을 입력하면 고객 입력 채널과 고객 기억 구조를 기준으로 운영 우선순위를 정리합니다.',
    tag: '무료',
  },
  {
    icon: 'Message',
    title: '문의 수집과 후속 응대',
    desc: '문의 내용을 고객 타임라인에 남기고, 운영자가 다음 액션을 놓치지 않도록 정리합니다.',
    tag: 'PRO+',
  },
  {
    icon: 'Reservation',
    title: '예약·웨이팅 운영',
    desc: '예약과 웨이팅을 따로 보지 않고, 방문 의도와 실제 운영 부담을 함께 판단할 수 있게 연결합니다.',
    tag: 'PRO+',
  },
  {
    icon: 'Table',
    title: 'QR 주문과 현장 입력',
    desc: 'QR 주문도 단순 주문 도구가 아니라 고객 업데이트 채널로 다뤄 고객 기억 축에 합칩니다.',
    tag: 'FREE',
  },
  {
    icon: 'Dashboard',
    title: '고객 기억 축',
    desc: '문의, 예약, 웨이팅, 주문이 고객별 타임라인으로 이어져 반복 방문과 객단가를 높일 판단 근거가 됩니다.',
    tag: '핵심',
  },
  {
    icon: 'Chart',
    title: 'AI 운영 제안',
    desc: '고객 흐름과 운영 신호를 바탕으로 지금 해야 할 다음 행동을 짧고 실용적으로 제안합니다.',
    tag: 'VIP',
  },
];

const STEPS = [
  { num: '01', title: '공개 유입 확보', desc: '공개 페이지로 첫 방문과 첫 관심 신호를 받습니다.' },
  { num: '02', title: '입력 채널 연결', desc: '문의·예약·웨이팅·주문을 실제 고객 입력 채널로 연결합니다.' },
  { num: '03', title: '고객 기억 축 형성', desc: '반복 방문과 운영 판단에 필요한 기억 구조를 고객별로 쌓습니다.' },
];

export function LandingPage() {
  usePageMeta(META_TITLE, META_DESCRIPTION);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const sceneRefs = useRef<Array<HTMLElement | null>>([]);

  const worldSurfaceRef = usePersistentDiagnosisWorldSurface({
    companionMode: 'hero',
    contextSummary: '문의, 예약, 웨이팅, 주문이 같은 고객 기억 축으로 들어와 AI 운영 제안으로 이어집니다.',
    layoutMode: 'floating',
    meaning: 'MyBiz는 소상공인 매장의 고객 입력 채널을 하나의 고객 기억 구조로 연결하는 시스템입니다.',
    memoryNote: '고객 타임라인이 쌓여야 반복 방문, 객단가, 후속 응대가 모두 더 정확해집니다.',
    nextAction: '무료 진단을 시작하고 현재 매장의 고객 입력 구조를 먼저 확인해보세요.',
    planLabel: '무료 진단',
    pulseKey: 0,
    routeLabel: '메인',
    selectedHighlights: ['공개 유입', '고객 기억 축', 'AI 운영 제안'],
    stepIndex: 0,
    stepLabel: '01 가게 현황 파악',
    title: 'MYBI 동반자',
  });

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) return;
        const nextIndex = Number((visibleEntry.target as HTMLElement).dataset.cinematicSceneIndex || '0');
        setActiveSceneIndex(nextIndex);
      },
      { rootMargin: '-28% 0px -42%', threshold: [0.24, 0.42, 0.64] },
    );

    sceneRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const activeScene = CINEMATIC_SCENES[activeSceneIndex];

  return (
    <main
      className="relative overflow-hidden bg-[#02050a] text-white"
      data-cinematic-home="true"
      data-cinematic-scene={activeScene.id}
      data-landing-mode="hero-engine"
    >
      <section className="relative min-h-screen overflow-hidden" data-mybi-anchor="landing-hero">
        <div ref={worldSurfaceRef} aria-hidden className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(125,211,252,0.08),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(2,5,10,0.08)_0%,rgba(2,5,10,0.14)_48%,rgba(2,5,10,0.76)_100%)]" />
        <div className="pointer-events-none absolute bottom-10 right-4 z-30 hidden w-[min(46vw,40rem)] lg:block xl:right-10">
          <CinematicServiceWorld compact stepIndex={activeSceneIndex} />
        </div>

        <div className="pointer-events-none relative z-40 flex min-h-screen flex-col justify-between px-5 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white backdrop-blur-xl">
              <Icons.Store size={20} />
            </div>
            <div>
              <p className="font-display text-xl font-black tracking-[-0.04em] text-white">MyBiz</p>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-400">고객 기억 기반 매출 시스템</p>
            </div>
          </div>

          <div className="pointer-events-auto max-w-[42rem] space-y-7 pb-4 sm:pb-10 lg:pb-14">
            <div className="space-y-4">
              <span className="inline-block rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-400">
                고객 기억을 매출로 바꾸는 운영 시스템
              </span>
              <h1
                aria-label="고객을 기억하는 AI 디지털 점장"
                className="break-keep font-display text-[2.8rem] font-black leading-[0.92] tracking-[-0.06em] text-white sm:text-[4.2rem]"
              >
                고객을 기억하는
                <br />
                AI 디지털 점장
              </h1>
              <p className="max-w-[32rem] break-keep text-base leading-8 text-slate-300">
                MyBiz는 문의·예약·웨이팅·주문·상담·결제를 고객 기억 축으로 연결해 재방문과 객단가를 높이는 AI 운영 시스템입니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="btn-primary min-w-[220px] rounded-full px-7 py-4 text-base shadow-[0_28px_90px_-40px_rgba(236,91,19,0.8)]"
                state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                to={SUBSCRIPTION_START_PATH}
              >
                공개 스토어 진단 시작
              </Link>
              <Link
                className="rounded-full border border-white/20 bg-white/[0.06] px-6 py-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/[0.12]"
                to="/golden-coffee"
              >
                데모 보기
              </Link>
              <Link
                className="rounded-full border border-white/20 bg-white/[0.04] px-6 py-4 text-sm font-bold text-white/90 backdrop-blur-sm transition hover:bg-white/[0.1]"
                to="/login"
              >
                점주 로그인
              </Link>
            </div>
            <p className="text-xs leading-6 text-slate-500">
              온프레미스·보안 구조는 신뢰를 받치는 레이어입니다. 첫 가치는 고객 기억이 매출 행동으로 바뀌는 데 있습니다.
            </p>
          </div>
        </div>
      </section>

      <div className="bg-[#f6f2ea] text-slate-900">
        <section className="relative overflow-hidden bg-[#02050a] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <p className="text-[11px] font-bold tracking-[0.24em] text-orange-300">실시간 진단 월드</p>
              <h2 className="mt-4 break-keep font-display text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">
                스크롤하면 같은 세계가
                <br />
                고객 기억 시스템으로 변합니다
              </h2>
              <p className="mt-4 max-w-xl break-keep text-sm leading-7 text-slate-300">
                정적인 소개 카드가 아니라, 가게 현황 → 고객 신호 → 고객 기억 → 실행안 → 운영 대시보드가 하나의 월드 안에서 이어지도록 구성했습니다.
              </p>
              <div className="mt-8 space-y-3">
                {CINEMATIC_SCENES.map((scene, index) => (
                  <button
                    key={scene.id}
                    className={[
                      'w-full rounded-3xl border px-5 py-4 text-left transition',
                      index === activeSceneIndex
                        ? 'border-orange-300/44 bg-orange-300/[0.12] text-white shadow-[0_22px_70px_-46px_rgba(251,146,60,0.9)]'
                        : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/18 hover:bg-white/[0.06]',
                    ].join(' ')}
                    data-cinematic-scene-index={index}
                    onClick={() => setActiveSceneIndex(index)}
                    onFocus={() => setActiveSceneIndex(index)}
                    onMouseEnter={() => setActiveSceneIndex(index)}
                    type="button"
                  >
                    <span className="text-[11px] font-bold tracking-[0.22em] text-orange-300">
                      {scene.number} {scene.label}
                    </span>
                    <span className="mt-2 block break-keep text-sm font-semibold leading-6">{scene.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:sticky lg:top-20">
              <CinematicServiceWorld stepIndex={activeSceneIndex} />
            </div>
          </div>
          <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-5">
            {CINEMATIC_SCENES.map((scene, index) => (
              <article
                key={`scroll-${scene.id}`}
                ref={(element) => {
                  sceneRefs.current[index] = element;
                }}
                className="min-h-36 rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-white/90"
                data-cinematic-scene-index={index}
              >
                <p className="text-xs font-bold text-orange-300">{scene.number}</p>
                <h3 className="mt-2 break-keep text-base font-bold">{scene.label}</h3>
                <p className="mt-2 break-keep text-sm leading-6 text-slate-400">{scene.actionCaption}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">운영 흐름</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              유입, 입력, 기억, 액션이 하나로 이어집니다
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.num} className="relative">
                {index < STEPS.length - 1 ? (
                  <div className="absolute left-[calc(50%+3rem)] top-7 hidden h-px w-[calc(100%-6rem)] bg-slate-200 sm:block" />
                ) : null}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ec5b13] font-display text-lg font-black text-white shadow-[0_8px_24px_-6px_rgba(236,91,19,0.4)]">
                    {step.num}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 max-w-[220px] break-keep text-sm leading-6 text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">핵심 기능</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              매장 운영의 사실을 고객 기억 중심으로 묶습니다
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
              MyBiz는 일반 홈페이지 툴이나 챗봇이 아니라, 매장 운영 신호를 고객별로 축적하고 다음 매출 행동으로 바꾸는 구조에 집중합니다.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = Icons[feature.icon];
              return (
                <div
                  key={feature.title}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:shadow-[0_8px_32px_-12px_rgba(236,91,19,0.2)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[#ec5b13]">
                      <Icon size={20} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{feature.tag}</span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">플랜</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              고객 입력 채널과 운영 깊이에 맞춰 선택합니다
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={[
                  'relative overflow-hidden rounded-2xl border p-7 transition',
                  plan.highlighted
                    ? 'border-[#ec5b13] bg-white shadow-[0_20px_60px_-20px_rgba(236,91,19,0.3)]'
                    : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                {plan.highlighted ? (
                  <span className="absolute right-5 top-5 rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold text-orange-600">추천</span>
                ) : null}
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
                <p className="mt-2 font-display text-2xl font-black text-slate-900">{plan.priceLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{plan.summary}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="h-4 w-4 shrink-0 text-[#ec5b13]" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  className={[
                    'mt-6 block w-full rounded-xl py-3 text-center text-sm font-bold transition',
                    plan.highlighted
                      ? 'bg-[#ec5b13] text-white hover:bg-[#d94f0b]'
                      : 'border border-slate-200 bg-white text-slate-800 hover:border-orange-200 hover:text-[#ec5b13]',
                  ].join(' ')}
                  state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                  to={SUBSCRIPTION_START_PATH}
                >
                  진단으로 시작하기
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="break-keep font-display text-3xl font-black text-white sm:text-4xl">
              지금 매장의 고객 기억 구조부터 확인해보세요
            </h2>
            <p className="mt-4 break-keep text-base leading-7 text-slate-400">
              무료 진단으로 공개 유입, 문의, 예약, 웨이팅, 주문 중 무엇이 현재 매장에 가장 중요한지 먼저 정리할 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                className="rounded-full bg-[#ec5b13] px-8 py-4 text-base font-bold text-white shadow-[0_20px_60px_-16px_rgba(236,91,19,0.6)] transition hover:bg-[#d94f0b]"
                state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                to={SUBSCRIPTION_START_PATH}
              >
                무료 AI 진단 시작
              </Link>
              <Link
                className="rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-bold text-white transition hover:bg-white/[0.12]"
                to="/pricing"
              >
                요금제 자세히 보기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
