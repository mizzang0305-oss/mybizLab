import { Link } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePersistentDiagnosisWorldSurface } from '@/shared/components/PersistentDiagnosisWorldShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const META_TITLE = 'MyBiz | AI 디지털 점장 — 소상공인 매장 운영 자동화';
const META_DESCRIPTION =
  '문의·예약·대기·주문을 한 곳에서 관리하고, AI가 고객 패턴을 분석해 매출을 자동으로 끌어올립니다. 소상공인을 위한 AI 디지털 점장, MyBiz.';

type IconKey = 'AI' | 'Table' | 'Reservation' | 'Message' | 'Dashboard' | 'Chart';

interface Feature {
  icon: IconKey;
  title: string;
  desc: string;
  tag: string;
}

const FEATURES: Feature[] = [
  { icon: 'AI', title: 'AI 매장 진단', desc: '업종·지역·고민을 입력하면 AI가 운영 점수, 핵심 병목, 즉시 실행 액션을 분석해 제안합니다.', tag: '무료' },
  { icon: 'Table', title: 'QR 테이블 주문', desc: '키오스크 없이 QR 코드 하나로 테이블 주문 접수. 고객 스마트폰으로 바로 주문합니다.', tag: '전 플랜' },
  { icon: 'Reservation', title: '예약·대기 관리', desc: '예약 캘린더와 웨이팅 대기열을 한 화면에서 관리합니다. 노쇼 알림도 자동으로 처리합니다.', tag: 'PRO+' },
  { icon: 'Message', title: '문의·상담 통합', desc: '카카오·전화·직접 문의를 한 곳에서 받고 AI가 답변 초안을 자동으로 작성합니다.', tag: 'PRO+' },
  { icon: 'Dashboard', title: '고객 기억 CRM', desc: '방문 이력, 주문 패턴, 선호 메뉴가 고객별로 자동 축적됩니다. 단골 전략을 AI가 제안합니다.', tag: 'PRO+' },
  { icon: 'Chart', title: 'AI 운영 리포트', desc: '매출 흐름, 인기 메뉴, 고객 이탈 포인트를 AI가 주간 리포트로 정리해 드립니다.', tag: 'PRO+' },
];

const STEPS = [
  { num: '01', title: 'AI 진단', desc: '업종·고민 입력하면 AI가 운영 전략 분석' },
  { num: '02', title: '스토어 생성', desc: '기본 정보 입력 후 QR·예약 페이지 즉시 생성' },
  { num: '03', title: '운영 시작', desc: '대시보드에서 주문·예약·고객·매출 한 번에 관리' },
];

interface Plan {
  name: string;
  price: string;
  highlight: boolean;
  desc: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: 'FREE', price: '월 29,000원', highlight: false,
    desc: '첫 매장을 빠르게 시작하는 기본 플랜',
    features: ['QR 테이블 주문', 'AI 매장 진단', '기본 매출 분석', '주문 관리'],
  },
  {
    name: 'PRO', price: '월 79,000원', highlight: true,
    desc: '고객 관리와 예약 운영까지 함께 보는 추천 플랜',
    features: ['FREE 전체 포함', '고객 기억 CRM', '예약·대기 관리', '문의 통합', 'AI 운영 리포트'],
  },
  {
    name: 'VIP', price: '월 149,000원', highlight: false,
    desc: '멀티 매장 운영과 자동화를 확장하는 상위 플랜',
    features: ['PRO 전체 포함', '멀티 매장 (최대 10개)', '브랜드 커스텀', '전담 지원'],
  },
];

export function LandingPage() {
  usePageMeta(META_TITLE, META_DESCRIPTION);

  const worldSurfaceRef = usePersistentDiagnosisWorldSurface({
    companionMode: 'hero',
    contextSummary: '문의, 예약, 대기, 주문 데이터가 쌓이면 AI가 고객 패턴을 분석해 다음 운영 액션을 제안합니다.',
    layoutMode: 'hero',
    meaning: 'MyBiz는 소상공인 매장의 모든 고객 접점을 한 곳에 모아 AI 운영 제안으로 이어주는 플랫폼입니다.',
    memoryNote: '방문 이력, 주문 패턴, 문의 내용이 고객 기억으로 쌓이고, AI는 그 위에서 재방문 전략과 매출 분석을 제공합니다.',
    nextAction: '무료로 매장 AI 진단을 시작하고 맞춤 운영 전략을 확인하세요.',
    planLabel: '무료 진단', pulseKey: 0, routeLabel: '메인',
    selectedHighlights: ['AI 매장 분석', '고객 기억 CRM', 'QR 주문'],
    stepIndex: 0, stepLabel: '01 매장 등록', title: 'AI 디지털 점장',
  });

  return (
    <main className="relative overflow-hidden bg-[#02050a] text-white" data-landing-mode="hero-engine">

      {/* ── 히어로 ── */}
      <section className="relative min-h-screen overflow-hidden" data-mybi-anchor="landing-hero">
        <div ref={worldSurfaceRef} aria-hidden className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(125,211,252,0.08),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(2,5,10,0.08)_0%,rgba(2,5,10,0.14)_48%,rgba(2,5,10,0.76)_100%)]" />

        <div className="pointer-events-none relative z-40 flex min-h-screen flex-col justify-between px-5 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white backdrop-blur-xl">
              <Icons.Store size={20} />
            </div>
            <div>
              <p className="font-display text-xl font-black tracking-[-0.04em] text-white">MyBiz</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">AI 디지털 점장</p>
            </div>
          </div>

          <div className="pointer-events-auto max-w-[36rem] space-y-7 pb-4 sm:pb-10 lg:pb-14">
            <div className="space-y-4">
              <span className="inline-block rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-400">
                소상공인을 위한 AI 운영 플랫폼
              </span>
              <h1 className="break-keep font-display text-[2.8rem] font-black leading-[0.92] tracking-[-0.06em] text-white sm:text-[4.2rem]">
                사장님 대신<br />AI가 매장을<br />운영합니다
              </h1>
              <p className="max-w-[28rem] break-keep text-base leading-8 text-slate-300">
                문의·예약·대기·주문을 한 곳에서 관리하고,
                AI가 고객 패턴을 분석해 매출을 끌어올립니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="btn-primary min-w-[200px] rounded-full px-7 py-4 text-base shadow-[0_28px_90px_-40px_rgba(236,91,19,0.8)]"
                state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                to={SUBSCRIPTION_START_PATH}
              >
                무료 AI 진단 시작
              </Link>
              <Link
                className="rounded-full border border-white/20 bg-white/[0.06] px-6 py-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/[0.12]"
                to="/pricing"
              >
                요금제 보기
              </Link>
            </div>
            <p className="text-xs text-slate-500">신용카드 불필요 · 무료 AI 진단 후 결정 · 언제든 해지 가능</p>
          </div>
        </div>
      </section>

      {/* ── 밝은 영역 ── */}
      <div className="bg-[#f6f2ea] text-slate-900">

        {/* 3단계 */}
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">3분이면 시작</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              복잡한 설치 없이 지금 바로 시작합니다
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+3rem)] top-7 hidden h-px w-[calc(100%-6rem)] bg-slate-200 sm:block" />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ec5b13] font-display text-lg font-black text-white shadow-[0_8px_24px_-6px_rgba(236,91,19,0.4)]">
                    {step.num}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 max-w-[180px] break-keep text-sm leading-6 text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 소개 */}
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">주요 기능</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              매장 운영에 필요한 모든 것
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
              별도 하드웨어 없이, QR 하나로 시작합니다.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = Icons[f.icon];
              return (
                <div
                  key={f.title}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:shadow-[0_8px_32px_-12px_rgba(236,91,19,0.2)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[#ec5b13]">
                      <Icon size={20} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{f.tag}</span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 요금제 */}
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">요금제</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              매장 규모에 맞게 시작하세요
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={[
                  'relative overflow-hidden rounded-2xl border p-7 transition',
                  plan.highlight
                    ? 'border-[#ec5b13] bg-white shadow-[0_20px_60px_-20px_rgba(236,91,19,0.3)]'
                    : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                {plan.highlight && (
                  <span className="absolute right-5 top-5 rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold text-orange-600">추천</span>
                )}
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
                <p className="mt-2 font-display text-2xl font-black text-slate-900">{plan.price}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{plan.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="h-4 w-4 shrink-0 text-[#ec5b13]" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  className={[
                    'mt-6 block w-full rounded-xl py-3 text-center text-sm font-bold transition',
                    plan.highlight
                      ? 'bg-[#ec5b13] text-white hover:bg-[#d94f0b]'
                      : 'border border-slate-200 bg-white text-slate-800 hover:border-orange-200 hover:text-[#ec5b13]',
                  ].join(' ')}
                  state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                  to={SUBSCRIPTION_START_PATH}
                >
                  시작하기
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            모든 플랜에 무료 AI 진단 포함 · 부가세 별도 · 연간 결제 시 2개월 무료
          </p>
        </section>

        {/* 최하단 CTA */}
        <section className="bg-slate-950 px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="break-keep font-display text-3xl font-black text-white sm:text-4xl">
              지금 바로 무료로 시작하세요
            </h2>
            <p className="mt-4 break-keep text-base leading-7 text-slate-400">
              AI 진단에 5분이면 충분합니다. 신용카드 없이 무료로 시작하고, 필요할 때 업그레이드하세요.
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
                to="/login"
              >
                관리자 로그인
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
