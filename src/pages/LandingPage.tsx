import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';

import { CinematicServiceWorld } from '@/shared/components/CinematicServiceWorld';
import { Icons } from '@/shared/components/Icons';
import { usePersistentDiagnosisWorldSurface } from '@/shared/components/PersistentDiagnosisWorldShell';
import { ServiceOrbitWorld } from '@/shared/components/ServiceOrbitWorld';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import {
  CINEMATIC_SCENES,
  PRODUCT_STORY_PANELS,
  type HomepageServiceNodeLabel,
} from '@/shared/lib/cinematicScenes';
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

const TRUST_CHIPS = ['20,000+ 사장님이 선택', '99.9% 안정적 서비스', '24/7 AI 운영 지원'] as const;
const HERO_FOCUS_SEQUENCE: HomepageServiceNodeLabel[][] = [
  ['공개 스토어', '문의'],
  ['예약', '웨이팅'],
  ['QR 주문', '결제'],
  ['고객 기억', '점주 운영 화면'],
];

const DEMO_PREVIEW_ITEMS = [
  {
    body: '고객이 메뉴와 매장 정보를 보고 문의·예약·웨이팅·QR 주문을 시작하는 첫 화면입니다.',
    cta: '공개 스토어 보기',
    title: '공개 스토어',
    to: '/mybiz-live-cafe',
  },
  {
    body: '점주가 오늘 예약, 웨이팅, 주문, 고객 기억 상태를 한눈에 확인하는 운영 화면입니다.',
    cta: '점주 화면 미리보기',
    title: '점주 운영 대시보드',
    to: '/login',
  },
  {
    body: 'AI가 가게 현황을 읽고 재방문, 웨이팅, 메뉴 구성 액션을 제안하는 상담 흐름입니다.',
    cta: 'AI 상담 데모',
    title: 'AI 상담 화면',
    to: SUBSCRIPTION_START_PATH,
  },
] as const;

export function DemoPreviewModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#02050a]/86 px-4 py-6 text-white backdrop-blur-2xl"
      data-demo-modal="homepage"
      role="dialog"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(251,146,60,0.22),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(96,165,250,0.2),transparent_30%)]" />
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#06101d]/94 p-5 shadow-[0_40px_140px_-64px_rgba(0,0,0,0.95)] sm:p-7"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.24em] text-orange-300">LIVE PREVIEW</p>
            <h2 className="mt-2 break-keep font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              MyBiz 데모 보기
            </h2>
            <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-slate-300">
              공개 스토어에서 고객 신호가 들어오고, 점주 화면과 고객 기억으로 이어지는 흐름을 짧게 확인해 보세요.
            </p>
          </div>
          <button
            className="self-start rounded-2xl border border-white/14 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-orange-300/70"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {DEMO_PREVIEW_ITEMS.map((item, index) => (
            <article
              key={item.title}
              className="rounded-[1.5rem] border border-white/12 bg-white/[0.055] p-5 shadow-[0_24px_80px_-58px_rgba(0,0,0,0.95)]"
            >
              <p className="text-[11px] font-black tracking-[0.18em] text-orange-300">0{index + 1}</p>
              <h3 className="mt-3 break-keep text-lg font-black text-white">{item.title}</h3>
              <p className="mt-2 break-keep text-sm leading-6 text-slate-300">{item.body}</p>
              <Link
                className="mt-5 inline-flex rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300/70"
                onClick={onClose}
                state={item.to === SUBSCRIPTION_START_PATH ? DIAGNOSIS_CORRIDOR_LINK_STATE : undefined}
                to={item.to}
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-emerald-300/18 bg-emerald-300/[0.08] p-4">
          <p className="break-keep text-sm font-bold leading-6 text-emerald-100">
            데모는 실제 결제나 실매장 데이터를 변경하지 않는 미리보기입니다.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function ProductStoryFlow() {
  return (
    <section
      className="relative overflow-hidden bg-[#02050a] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      data-product-story-flow="connected-panels"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_32%,rgba(251,146,60,0.12),transparent_24%),radial-gradient(circle_at_78%_50%,rgba(96,165,250,0.14),transparent_28%),linear-gradient(180deg,#02050a_0%,#07101d_52%,#02050a_100%)]" />
      <div className="pointer-events-none absolute left-[10%] right-[10%] top-1/2 hidden h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent md:block" />
      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-300">운영 흐름</p>
          <h2 className="mt-3 break-keep font-display text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            공개 스토어에서 고객 기억, 운영 액션까지 한 흐름으로 이어집니다
          </h2>
          <p className="mt-4 break-keep text-sm leading-7 text-slate-300">
            고객이 만나는 접점, 점주가 처리하는 운영 화면, 다시 방문을 만드는 고객 기억이 하나의 매출 루프로 연결됩니다.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PRODUCT_STORY_PANELS.map((panel, index) => (
            <article
              key={panel.title}
              className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.055] p-5 shadow-[0_24px_90px_-62px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
              {index < PRODUCT_STORY_PANELS.length - 1 ? (
                <div className="absolute -right-4 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-orange-300/36 bg-orange-300/16 text-orange-100 lg:flex">
                  →
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black tracking-[0.18em] text-orange-300">0{index + 1}</p>
                  <h3 className="mt-2 break-keep text-lg font-black text-white">{panel.title}</h3>
                  <p className="mt-2 break-keep text-sm leading-6 text-slate-300">{panel.body}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-bold text-slate-200">
                  {panel.metric}
                </span>
              </div>

              {panel.type === 'storefront' ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-[0.85fr_1fr] lg:grid-cols-1 xl:grid-cols-[0.85fr_1fr]">
                  <div className="rounded-[1.5rem] border border-white/12 bg-white/[0.08] p-3">
                    <div className="rounded-[1.1rem] bg-slate-100 p-3 text-slate-950">
                      <p className="text-xs font-black">모닝브루 커피</p>
                      <div className="mt-3 h-24 rounded-xl bg-[radial-gradient(circle_at_28%_24%,rgba(251,146,60,0.44),transparent_32%),linear-gradient(135deg,#3b2a1e,#111827)]" />
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
                        <span className="rounded-lg bg-orange-500 px-2 py-2 text-center text-white">예약하기</span>
                        <span className="rounded-lg bg-slate-200 px-2 py-2 text-center text-slate-700">웨이팅 등록</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {panel.highlights.map((item) => (
                      <button key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-left text-sm font-bold text-white" type="button">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {panel.type === 'dashboard' ? (
                <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-slate-950/66 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['예약', '128'],
                      ['웨이팅', '32'],
                      ['주문', '245'],
                      ['매출', '3,450,000원'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                        <p className="text-[11px] text-slate-400">{label}</p>
                        <p className="mt-1 font-display text-xl font-black text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-24 rounded-2xl border border-sky-300/14 bg-[linear-gradient(160deg,rgba(96,165,250,0.16),rgba(251,146,60,0.08))] p-3">
                    <div className="mt-10 h-10 rounded-full bg-[linear-gradient(90deg,rgba(96,165,250,0.2),rgba(96,165,250,0.72),rgba(251,146,60,0.8))]" />
                  </div>
                </div>
              ) : null}

              {panel.type === 'customer-memory' ? (
                <div className="mt-5 rounded-[1.5rem] border border-orange-300/18 bg-orange-300/[0.08] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-sky-200 font-black text-slate-950">
                      김
                    </div>
                    <div>
                      <p className="font-black text-white">김지연님</p>
                      <p className="text-xs text-slate-400">최근 방문 3일 전 · 방문 12회</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {panel.highlights.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {['재방문 유도 메시지 발송', '맞춤 쿠폰 제공', '선호 메뉴 추천 알림'].map((item) => (
                      <button key={item} className="rounded-2xl bg-white/[0.08] px-3 py-3 text-left text-xs font-bold text-orange-50" type="button">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  usePageMeta(META_TITLE, META_DESCRIPTION);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [autoHeroIndex, setAutoHeroIndex] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const [heroFocus, setHeroFocus] = useState<HomepageServiceNodeLabel[] | null>(null);
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
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setAutoHeroIndex((current) => (current + 1) % HERO_FOCUS_SEQUENCE.length);
    }, 3_800);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!demoOpen || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDemoOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [demoOpen]);

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
  const activeHeroFocus = heroFocus ?? HERO_FOCUS_SEQUENCE[autoHeroIndex];

  return (
    <main
      className="relative overflow-hidden bg-[#02050a] text-white [overflow-wrap:normal] [word-break:keep-all]"
      data-auto-hero-scene={autoHeroIndex}
      data-cinematic-home="true"
      data-cinematic-scene={activeScene.id}
      data-landing-mode="hero-engine"
    >
      <section className="relative min-h-screen overflow-hidden px-5 py-5 sm:px-8 sm:py-7 lg:px-10" data-mybi-anchor="landing-hero">
        <div ref={worldSurfaceRef} aria-hidden className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(251,146,60,0.18),transparent_24%),radial-gradient(circle_at_72%_18%,rgba(96,165,250,0.2),transparent_25%),radial-gradient(circle_at_72%_72%,rgba(167,139,250,0.12),transparent_28%),linear-gradient(180deg,rgba(2,5,10,0.05)_0%,rgba(2,5,10,0.32)_58%,rgba(2,5,10,0.9)_100%)]" />
        <div className="pointer-events-none absolute inset-x-[-10%] bottom-[8%] h-40 rotate-[-6deg] bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.2),rgba(251,146,60,0.28),transparent)] blur-sm" />

        <div className="relative z-40 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[96rem] flex-col">
          <header className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 font-display text-xl font-black text-white shadow-[0_0_28px_rgba(251,146,60,0.42)]">
                M
              </div>
              <p className="font-display text-xl font-black tracking-[-0.04em] text-white">MyBiz</p>
            </div>
            <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 lg:flex" aria-label="주요 메뉴">
              <a className="transition hover:text-white" href="#services">서비스</a>
              <a className="transition hover:text-white" href="#features">기능</a>
              <Link className="transition hover:text-white" to="/pricing">요금제</Link>
              <a className="transition hover:text-white" href="#story">고객 사례</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link className="hidden rounded-2xl border border-white/12 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08] sm:inline-flex" to="/login">
                점주 로그인
              </Link>
              <Link
                className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-[0_18px_52px_-28px_rgba(251,146,60,0.75)] transition hover:bg-orange-400"
                state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                to={SUBSCRIPTION_START_PATH}
              >
                시작하기
              </Link>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.88fr_1.12fr] lg:py-10 xl:gap-14">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-[11px] font-black tracking-[0.22em] text-orange-300">
                AI 운영 플랫폼, MyBiz
              </span>
              <h1
                aria-label="매장을 이해하고, 고객을 기억하고, 운영을 움직이는 AI"
                className="break-keep font-display text-[2.95rem] font-black leading-[0.98] tracking-[-0.065em] text-white sm:text-[4.55rem]"
              >
                매장을 이해하고,
                <br />
                고객을 기억하고,
                <br />
                운영을 움직이는 <span className="text-orange-400">AI</span>
              </h1>
              <p className="max-w-[38rem] break-keep text-base leading-8 text-slate-300 sm:text-lg">
                공개 스토어, 문의, 예약, 웨이팅, QR 주문, 결제, 고객 기억, 점주 운영 화면을 하나의 흐름으로 연결합니다.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  className="rounded-2xl bg-orange-500 px-7 py-4 text-base font-black text-white shadow-[0_28px_90px_-42px_rgba(251,146,60,0.86)] transition hover:-translate-y-0.5 hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300/70"
                  onBlur={() => setHeroFocus(null)}
                  onFocus={() => setHeroFocus(['공개 스토어', '문의', '예약', '웨이팅', 'QR 주문'])}
                  onMouseEnter={() => setHeroFocus(['공개 스토어', '문의', '예약', '웨이팅', 'QR 주문'])}
                  onMouseLeave={() => setHeroFocus(null)}
                  state={DIAGNOSIS_CORRIDOR_LINK_STATE}
                  to={SUBSCRIPTION_START_PATH}
                >
                  공개 스토어 시작하기
                </Link>
                <button
                  className="rounded-2xl border border-white/18 bg-white/[0.055] px-6 py-4 text-sm font-bold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-sky-300/60"
                  data-demo-trigger="homepage"
                  onBlur={() => setHeroFocus(null)}
                  onClick={() => setDemoOpen(true)}
                  onFocus={() => setHeroFocus(['점주 운영 화면', '고객 기억'])}
                  onMouseEnter={() => setHeroFocus(['점주 운영 화면', '고객 기억'])}
                  onMouseLeave={() => setHeroFocus(null)}
                  type="button"
                >
                  데모 보기
                </button>
                <Link
                  className="rounded-2xl border border-white/18 bg-white/[0.035] px-6 py-4 text-sm font-bold text-white/90 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-slate-300/60"
                  onBlur={() => setHeroFocus(null)}
                  onFocus={() => setHeroFocus(['점주 운영 화면'])}
                  onMouseEnter={() => setHeroFocus(['점주 운영 화면'])}
                  onMouseLeave={() => setHeroFocus(null)}
                  to="/login"
                >
                  점주 로그인
                </Link>
              </div>

              <div className="flex flex-wrap gap-3 pt-3">
                {TRUST_CHIPS.map((chip) => (
                  <span key={chip} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-bold text-slate-200 backdrop-blur">
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <ServiceOrbitWorld highlightLabels={activeHeroFocus} />
          </div>
        </div>
      </section>

      <DemoPreviewModal onClose={() => setDemoOpen(false)} open={demoOpen} />

      <div className="bg-[#f6f2ea] text-slate-900">
        <ProductStoryFlow />

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
