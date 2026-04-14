import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { HeroMemoryStoryScene, type DiagnosisHeroStepId } from '@/shared/components/HeroMemoryStoryScene';
import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 공개페이지 유입부터 문의·예약·웨이팅 수집, 고객 타임라인 진단, 다음 행동 추천까지를 한 흐름으로 연결하는 고객 기억 기반 매출 운영 시스템입니다.';

const diagnosisSteps = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    summary: '매장 유형과 운영 리듬을 먼저 파악합니다.',
  },
  {
    id: 'operations-connect',
    number: '02',
    label: '운영 데이터 연결',
    summary: '공개 유입과 문의·예약·웨이팅을 한 흐름으로 모읍니다.',
  },
  {
    id: 'customer-flow-diagnosis',
    number: '03',
    label: '고객 흐름 진단',
    summary: '고객 카드와 타임라인으로 병목과 재방문 신호를 읽습니다.',
  },
  {
    id: 'action-plan',
    number: '04',
    label: '실행안 도출',
    summary: '다음 행동, 재방문 타깃, 업셀 기회를 정리합니다.',
  },
] as const;

type DiagnosisStepId = (typeof diagnosisSteps)[number]['id'];

const planLadder = [
  {
    name: 'FREE',
    tone: 'border-white/10 bg-white/[0.03]',
    badge: 'Acquisition',
    title: '공개 유입을 바로 시작하는 무료 출발선',
    summary: '매장 소개, 기본 문의, 기본 웨이팅으로 손님이 남길 첫 행동을 받습니다.',
    features: ['공개페이지', '기본 문의', '기본 웨이팅'],
    outcome: '아직 CRM을 쓰지 않아도, 유입과 첫 행동을 모으는 이유가 생깁니다.',
  },
  {
    name: 'PRO',
    tone: 'border-orange-300/30 bg-[linear-gradient(180deg,rgba(236,91,19,0.12),rgba(255,255,255,0.05))]',
    badge: 'Operations',
    title: '예약과 고객 CRM을 붙여 운영을 정리하는 단계',
    summary: '예약, 고객 카드, 고객 타임라인으로 반복 방문 고객을 놓치지 않는 운영 체계를 만듭니다.',
    features: ['예약', '고객 CRM', '고객 타임라인'],
    outcome: '누가 다시 왔는지 보이기 시작하면서 응대 품질과 전환율이 함께 올라갑니다.',
  },
  {
    name: 'VIP',
    tone: 'border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(255,255,255,0.04))]',
    badge: 'Growth',
    title: '고객 기억과 재방문 자동화로 매출을 키우는 단계',
    summary: '고객 기억, 재방문 자동화, AI 리포트로 다음 액션을 계속 실행 가능한 성장 루프로 바꿉니다.',
    features: ['고객 기억', '재방문 자동화', 'AI 리포트'],
    outcome: '단골 매출과 객단가를 만드는 운영 루틴이 매장 안에 자리 잡습니다.',
  },
] as const;

const stepSectionIds = diagnosisSteps.map((step) => step.id);

function getSectionTone(active: boolean) {
  return active
    ? 'border-orange-300/24 bg-[linear-gradient(180deg,rgba(236,91,19,0.12),rgba(255,255,255,0.04))] shadow-[0_36px_120px_-72px_rgba(236,91,19,0.5)]'
    : 'border-white/10 bg-white/[0.03]';
}

export function LandingPage() {
  const [activeStep, setActiveStep] = useState<DiagnosisStepId>(diagnosisSteps[0].id);

  usePageMeta('마이비즈랩', landingDescription);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash.replace('#', '') as DiagnosisStepId;
    if (stepSectionIds.includes(hash)) {
      setActiveStep(hash);
    }

    const sections = stepSectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement);

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (!visibleEntries.length) {
          return;
        }

        visibleEntries.sort((left, right) => {
          if (right.intersectionRatio !== left.intersectionRatio) {
            return right.intersectionRatio - left.intersectionRatio;
          }

          return Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top);
        });

        const nextStep = visibleEntries[0]?.target.id as DiagnosisStepId | undefined;
        if (nextStep && stepSectionIds.includes(nextStep)) {
          setActiveStep(nextStep);
        }
      },
      {
        rootMargin: '-24% 0px -46% 0px',
        threshold: [0.2, 0.4, 0.65],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const activeDiagnosisStep = useMemo(
    () => diagnosisSteps.find((step) => step.id === activeStep) ?? diagnosisSteps[0],
    [activeStep],
  );

  return (
    <div className="overflow-x-clip bg-[#07090d] text-white">
      <div className="border-b border-white/10 bg-[#07090d]/92 backdrop-blur-xl lg:sticky lg:top-[83px] lg:z-30">
        <div className="page-shell py-3">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav aria-label="진단 플로우" className="flex min-w-max items-center gap-2.5 lg:gap-3">
              {diagnosisSteps.map((step) => {
                const active = step.id === activeStep;

                return (
                  <a
                    key={step.id}
                    aria-current={active ? 'step' : undefined}
                    className={[
                      'group rounded-full border px-4 py-2.5 text-left transition',
                      active
                        ? 'border-orange-300/30 bg-orange-300/10 text-white shadow-[0_14px_50px_-26px_rgba(236,91,19,0.65)]'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/14 hover:bg-white/[0.05] hover:text-slate-200',
                    ].join(' ')}
                    href={`#${step.id}`}
                    onClick={() => setActiveStep(step.id)}
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition group-[aria-current=step]:text-orange-100">
                      {step.number}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">{step.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(236,91,19,0.16),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(59,130,246,0.12),transparent_22%),linear-gradient(180deg,#080a0f_0%,#0b0f15_48%,#07090d_100%)]" />
        <div className="absolute inset-0 opacity-14 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

        <div className="page-shell relative py-12 sm:py-16 lg:py-18">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-18 xl:gap-24">
            <div className="max-w-[39rem] space-y-9 sm:space-y-10">
              <div className="space-y-6 sm:space-y-7">
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                  고객을 기억하는 매장 시스템
                </span>
                <h1 className="max-w-[12.4ch] font-display text-[2.5rem] font-black leading-[1.05] tracking-[-0.05em] text-white [word-break:keep-all] [text-wrap:balance] sm:text-[3.2rem] lg:max-w-[11.4ch] lg:text-[4rem]">
                  <span className="block lg:whitespace-nowrap">고객 흐름을 진단해</span>
                  <span className="mt-1.5 block lg:whitespace-nowrap">다음 단골 매출</span>
                  <span className="mt-1.5 block lg:whitespace-nowrap">행동을 찾으세요</span>
                </h1>
                <p className="max-w-[34rem] text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                  스토어 확인부터 운영 데이터 연결, 고객 흐름 진단, 실행안 도출까지. MyBiz는 공개 유입과 고객 기억을 하나의 운영 루프로 연결합니다.
                </p>
              </div>

              <div className="flex flex-col gap-3.5 sm:flex-row">
                <Link className="btn-primary min-w-[180px]" to={SUBSCRIPTION_START_PATH}>
                  무료 공개페이지 시작
                </Link>
                <Link
                  className="btn-secondary min-w-[180px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  to="/login"
                >
                  운영 데모 보기
                </Link>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_90px_-70px_rgba(0,0,0,0.95)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">현재 진단 단계</p>
                <div className="mt-4 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-300/12 font-display text-xl font-black text-orange-100">
                    {activeDiagnosisStep.number}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{activeDiagnosisStep.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{activeDiagnosisStep.summary}</p>
                  </div>
                </div>
              </div>
            </div>

            <HeroMemoryStoryScene activeStep={activeStep as DiagnosisHeroStepId} />
          </div>
        </div>
      </section>

      <section
        className="relative scroll-mt-32 border-b border-white/10 bg-[#0b0f15] lg:scroll-mt-[10rem]"
        id="store-check"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(236,91,19,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className={`rounded-[36px] border p-6 sm:p-8 lg:p-10 ${getSectionTone(activeStep === 'store-check')}`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-14">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  01 스토어 확인
                </span>
                <h2 className="max-w-[12ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
                  매장 문맥이 보여야, 필요한 고객 기억도 보입니다
                </h2>
                <p className="max-w-[34rem] text-base leading-7 text-slate-300">
                  업종, 피크 타임, 예약형 운영인지 현장형 운영인지에 따라 어떤 공개페이지를 열고 어떤 고객 기억을 남겨야 할지가 달라집니다.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                <article className="rounded-[28px] border border-white/10 bg-[#0b1118] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-300/14 text-orange-100">
                      <Icons.Store size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">성수 브런치랩</p>
                      <p className="mt-1 text-sm text-slate-400">브런치 카페 · 주말 웨이팅 강한 매장</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {['지도/링크 유입', '점심 피크', '주말 대기', '재방문 손님 존재'].map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: '운영 방식', value: '예약 + 현장 혼합' },
                      { label: '피크 타임', value: '토-일 11:30-14:00' },
                      { label: '고객 기억 포인트', value: '브런치 선호 / 재방문' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[22px] bg-white/[0.04] px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-100">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">운영 리듬</p>
                    <div className="mt-4 space-y-3">
                      {['네이버 지도에서 첫 유입이 많습니다.', '점심 직전 문의와 예약이 함께 몰립니다.', '주말 현장 대기가 단골 인지 기회가 됩니다.'].map((item) => (
                        <div key={item} className="flex items-start gap-3">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-300" />
                          <p className="text-sm leading-6 text-slate-200">{item}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">왜 먼저 보나</p>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      같은 고객 기억이라도 어떤 매장인지 모르면 남겨야 할 맥락이 흐려집니다. MyBiz는 여기서부터 매출 루프를 맞춥니다.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative scroll-mt-32 border-b border-white/10 bg-[#0d1219] lg:scroll-mt-[10rem]"
        id="operations-connect"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className={`rounded-[36px] border p-6 sm:p-8 lg:p-10 ${getSectionTone(activeStep === 'operations-connect')}`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  02 운영 데이터 연결
                </span>
                <h2 className="max-w-[13ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
                  공개 유입과 운영 신호가 한 고객 흐름으로 들어옵니다
                </h2>
                <p className="max-w-[34rem] text-base leading-7 text-slate-300">
                  공개페이지, 문의, 예약, 웨이팅을 따로 쌓아두지 않고 같은 고객 흐름으로 모아야 이후의 타임라인과 다음 행동이 정확해집니다.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { icon: Icons.Globe, title: '공개페이지 유입', detail: '지도 / 링크 / QR' },
                    { icon: Icons.Message, title: '문의 · AI 상담', detail: '질문 / 메뉴 문의 / 상담' },
                    { icon: Icons.Reservation, title: '예약', detail: '시간 / 인원 / 요청사항' },
                    { icon: Icons.Waiting, title: '웨이팅', detail: '현장 방문 / 대기 접수' },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <article key={item.title} className="rounded-[28px] border border-white/10 bg-[#0b1118] p-5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-orange-100">
                          <Icon size={18} />
                        </div>
                        <p className="mt-5 text-base font-semibold text-white">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
                      </article>
                    );
                  })}
                </div>

                <article className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Signal Merge</p>
                      <p className="mt-2 text-xl font-semibold text-white">모든 신호가 한 고객 흐름으로 합류합니다</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-300/8 px-4 py-2 text-sm font-medium text-emerald-100">
                      <Icons.Users size={16} />
                      고객 타임라인 생성 준비
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    {['유입 채널', '행동 유형', '연락 단서', '현장 상태'].map((item) => (
                      <div key={item} className="rounded-[22px] bg-white/[0.04] px-4 py-4 text-sm text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative scroll-mt-32 border-b border-white/10 bg-[#0b1017] lg:scroll-mt-[10rem]"
        id="customer-flow-diagnosis"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(236,91,19,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className={`rounded-[36px] border p-6 sm:p-8 lg:p-10 ${getSectionTone(activeStep === 'customer-flow-diagnosis')}`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  03 고객 흐름 진단
                </span>
                <h2 className="max-w-[13ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
                  고객 카드와 타임라인이 운영 병목과 재방문 신호를 보여줍니다
                </h2>
                <p className="max-w-[34rem] text-base leading-7 text-slate-300">
                  같은 고객의 문의, 예약, 웨이팅 이력이 이어져야 어디에서 전환이 끊겼는지, 누가 다시 올 가능성이 높은지 판단할 수 있습니다.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
                <article className="rounded-[30px] border border-white/10 bg-[#0b1118] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">김서연 고객</p>
                      <p className="mt-1 text-sm text-slate-400">브런치 선호 · 최근 30일 2회 방문</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
                      재방문 가능성 높음
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      { label: '공개페이지 방문', detail: '네이버 지도 유입' },
                      { label: '문의 남김', detail: '주말 브런치 가능 여부 문의' },
                      { label: '예약 요청', detail: '토요일 12:30 · 2인' },
                      { label: '현장 웨이팅', detail: '10분 대기 후 착석' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-start gap-3 rounded-[22px] bg-white/[0.04] px-4 py-3">
                        <span className="mt-2 h-2 w-2 rounded-full bg-orange-300" />
                        <div>
                          <p className="text-sm font-medium text-slate-100">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">진단 포인트</p>
                    <div className="mt-4 space-y-3">
                      {[
                        '주말 점심 고객은 문의 이후 예약 전환까지 시간이 짧습니다.',
                        '현장 웨이팅 경험이 있어도 재방문 저항은 낮습니다.',
                        '브런치 세트 업셀 반응이 높은 고객군입니다.',
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-300" />
                          <p className="text-sm leading-6 text-slate-200">{item}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">보이는 병목</p>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      예약 직전 이탈, 현장 대기 후 재유입, 문의 후 미응답 같은 병목이 타임라인에서 드러나야 다음 행동이 구체적으로 나옵니다.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative scroll-mt-32 border-b border-white/10 bg-[#0a0f15] lg:scroll-mt-[10rem]"
        id="action-plan"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_0%,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className={`rounded-[36px] border p-6 sm:p-8 lg:p-10 ${getSectionTone(activeStep === 'action-plan')}`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  04 실행안 도출
                </span>
                <h2 className="max-w-[13ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
                  다음 행동이 보이면, 재방문과 객단가가 함께 움직입니다
                </h2>
                <p className="max-w-[34rem] text-base leading-7 text-slate-300">
                  고객 흐름 진단이 끝나면 MyBiz는 누구에게 어떤 메시지를 보내고, 어떤 예약을 유도하고, 어떤 업셀을 제안할지까지 운영자가 바로 실행할 수 있게 정리합니다.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                <article className="rounded-[30px] border border-white/10 bg-[#0b1118] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next Action</p>
                      <p className="mt-2 text-xl font-semibold text-white">주말 브런치 재방문 메시지 발송</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/12 text-emerald-100">
                      <Icons.Zap size={18} />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: '재방문 타깃', value: '최근 14일 문의 후 미예약 고객' },
                      { label: '업셀 힌트', value: '브런치 세트 + 시즌 음료' },
                      { label: '운영자 메모', value: '주말 점심 전 문자 발송 권장' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[22px] bg-white/[0.04] px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-100">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[24px] border border-emerald-300/16 bg-emerald-300/7 px-4 py-4">
                    <p className="text-sm font-semibold text-white">예상 매출 영향</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">재방문 유도와 세트 업셀을 같이 실행하면, 단골 매출과 객단가가 동시에 움직일 가능성이 높습니다.</p>
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">실행 우선순위</p>
                    <div className="mt-4 space-y-3">
                      {['문의 후 미예약 고객 리마인드', '주말 예약 가능 시간 강조', '브런치 세트 업셀 제안'].map((item, index) => (
                        <div key={item} className="flex items-center gap-3 rounded-[20px] bg-white/[0.04] px-4 py-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-300/12 text-xs font-semibold text-orange-100">
                            {index + 1}
                          </span>
                          <p className="text-sm text-slate-100">{item}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">운영자에게 남는 것</p>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      막연한 리포트가 아니라, 오늘 바로 실행할 대상과 제안이 남아야 고객 기억이 실제 매출로 이어집니다.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#07090d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(236,91,19,0.12),transparent_24%)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className="max-w-[46rem] space-y-4">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              플랜 사다리
            </span>
            <h2 className="max-w-[14ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
              FREE로 유입을 시작하고, PRO와 VIP로 운영과 재방문 매출을 확장합니다
            </h2>
            <p className="text-base leading-7 text-slate-300">
              무료 공개페이지로 시작하고, 고객 흐름이 보이기 시작하면 예약 운영, 고객 기억, 재방문 자동화까지 자연스럽게 올라가는 구조입니다.
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
                    {plan.name === 'FREE' ? '지금 시작' : plan.name === 'PRO' ? '운영 확장' : '성장 자동화'}
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

                <p className="mt-6 border-t border-white/8 pt-4 text-sm leading-7 text-slate-300">{plan.outcome}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
