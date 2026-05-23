import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformHomepageContent } from '@/shared/lib/services/platformAdminContentService';
import { SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';

const fallbackFlow = ['공개 스토어', '문의', '예약', '웨이팅', 'QR 주문', '고객 기억', '운영 액션'];
const fallbackFeatureCards = ['공개 스토어', 'AI 상담', '예약·웨이팅', 'QR 주문', '고객 프로필', '운영 대시보드'];

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : fallback;
}

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal(options?: { threshold?: number; once?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const { threshold = 0.12, once = true } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, visible };
}

// ─── Mouse parallax hook ──────────────────────────────────────────────────────
function useMouseParallax(strength = 18) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      setOffset({ x: dx * strength, y: dy * strength });
    }
    function onLeave() { setOffset({ x: 0, y: 0 }); }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);

  return { containerRef, offset };
}

// ─── Scroll progress hook ─────────────────────────────────────────────────────
function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

// ─── Reveal wrapper component ─────────────────────────────────────────────────
function Reveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'none';
  as?: React.ElementType;
}) {
  const { ref, visible } = useReveal();
  const dirClass = direction === 'left' ? 'reveal-left' : direction === 'right' ? 'reveal-right' : direction === 'up' ? 'reveal-up' : '';
  return (
    <Tag
      ref={ref}
      className={`reveal-ready ${dirClass} ${visible ? 'in-view' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}

// ─── Floating orb decoration ──────────────────────────────────────────────────
function Orbs({ dark = true }: { dark?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={`orb-a absolute -left-[20%] -top-[10%] h-[55vw] w-[55vw] rounded-full blur-[120px] ${
          dark ? 'bg-orange-500/[0.12]' : 'bg-orange-400/[0.18]'
        }`}
      />
      <div
        className={`orb-b absolute -bottom-[15%] right-[5%] h-[45vw] w-[45vw] rounded-full blur-[100px] ${
          dark ? 'bg-blue-500/[0.1]' : 'bg-orange-300/[0.12]'
        }`}
      />
      <div
        className={`orb-c absolute left-[45%] top-[30%] h-[30vw] w-[30vw] rounded-full blur-[90px] ${
          dark ? 'bg-violet-500/[0.07]' : 'bg-amber-300/[0.14]'
        }`}
      />
    </div>
  );
}

// ─── Scroll progress bar ──────────────────────────────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      aria-hidden
      className="fixed left-0 top-0 z-[100] h-[2px] transition-all duration-100"
      style={{
        width: `${progress * 100}%`,
        background: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)',
      }}
    />
  );
}

// ─── Demo modal ───────────────────────────────────────────────────────────────
export function DemoPreviewModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  if (!open) return null;

  const demoItems = [
    {
      body: '고객이 메뉴와 매장 정보를 보고 문의·예약·웨이팅·QR 주문을 시작하는 공개 접점입니다.',
      cta: '공개 스토어 보기',
      title: '공개 스토어',
      to: '/mybiz-live-cafe',
    },
    {
      body: '사장님이 오늘의 문의, 예약, 웨이팅, 주문, 고객 기억 상태를 확인하는 운영 화면입니다.',
      cta: '데모 대시보드 보기',
      title: '점주 운영 화면',
      to: '/demo/dashboard',
    },
    {
      body: 'AI 상담이 고객 맥락을 읽고 사장님이 다시 볼 수 있는 고객 기억 흐름으로 이어집니다.',
      cta: 'AI 상담 데모',
      title: 'AI 상담',
      to: '/onboarding?plan=free',
    },
  ];

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#02050a]/86 px-4 py-6 text-white backdrop-blur-2xl"
      data-demo-modal="homepage"
      role="dialog"
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#06101d]/94 p-5 shadow-[0_40px_140px_-64px_rgba(0,0,0,0.95)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.24em] text-orange-300">MYBIZ DEMO</p>
            <h2 className="mt-2 break-keep font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              MyBiz 데모 보기
            </h2>
            <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-slate-300">
              공개 스토어에서 고객 신호가 들어오고, 점주 운영 화면과 고객 기억으로 이어지는 흐름을 빠르게 확인해 보세요.
            </p>
          </div>
          <button
            className="self-start rounded-2xl border border-white/14 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/[0.1]"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {demoItems.map((item, index) => (
            <article className="rounded-[1.5rem] border border-white/12 bg-white/[0.055] p-5" key={item.title}>
              <p className="text-[11px] font-black tracking-[0.18em] text-orange-300">0{index + 1}</p>
              <h3 className="mt-3 break-keep text-lg font-black text-white">{item.title}</h3>
              <p className="mt-2 break-keep text-sm leading-6 text-slate-300">{item.body}</p>
              <Link
                className="mt-5 inline-flex rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-400"
                onClick={onClose}
                to={item.to}
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const scrollProgress = useScrollProgress();
  const { containerRef: heroRef, offset: mouseOffset } = useMouseParallax(20);

  const homepageQuery = useQuery({
    queryKey: queryKeys.publicPlatformHomepage,
    queryFn: getPublicPlatformHomepageContent,
  });
  const homepage = homepageQuery.data;
  const settings = homepage?.settings;
  const sections = homepage?.sections || [];
  const hero = sections.find((s) => s.section_type === 'hero') || sections[0];
  const flowSection = sections.find((s) => s.section_type === 'customer_memory_flow');
  const featureSection = sections.find((s) => s.section_type === 'features');
  const finalCta = sections.find((s) => s.section_type === 'final_cta');
  const flowSteps = useMemo(() => readStringArray(flowSection?.payload.steps, fallbackFlow), [flowSection]);
  const featureCards = useMemo(
    () => readStringArray(featureSection?.payload.cards, fallbackFeatureCards),
    [featureSection],
  );

  usePageMeta(
    settings?.seo_title || 'MyBiz | 고객 기억 기반 매출 AI SaaS',
    settings?.seo_description || SERVICE_DESCRIPTION,
  );

  // Background hue shift based on scroll
  const bgHue = Math.round(scrollProgress * 24); // 0° → 24° shift
  const dynamicBg = `hsl(${220 + bgHue}deg 96% 2.5%)`;

  return (
    <main
      className="overflow-hidden"
      data-cinematic-home="true"
      data-landing-mode="hero-engine"
      style={{ backgroundColor: dynamicBg, transition: 'background-color 0.5s ease' }}
    >
      <ProgressBar progress={scrollProgress} />

      {/* ══════════════════════════════════════════════════════════════════
          HERO — full-bleed dark with orbiting nodes + mouse parallax
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen overflow-hidden bg-[#02050a] px-5 py-20 text-white sm:px-8 lg:px-10 lg:py-28">
        <Orbs dark />

        {/* Fine grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1fr]">
          {/* Left: headline */}
          <div>
            <Reveal direction="up" delay={0}>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-orange-400">
                {hero?.eyebrow || 'AI 운영 플랫폼, MyBiz'}
              </p>
            </Reveal>
            <Reveal direction="up" delay={60}>
              <h1 className="mt-4 break-keep font-display text-5xl font-black leading-[1.07] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                <span className="shimmer-text">{hero?.title?.split(' ').slice(0, 2).join(' ') || '고객을 기억하는'}</span>
                {' '}
                <span className="text-white">{hero?.title?.split(' ').slice(2).join(' ') || '매장이 더 많이 팝니다'}</span>
              </h1>
            </Reveal>
            <Reveal direction="up" delay={120}>
              <p className="mt-5 max-w-xl break-keep text-base leading-8 text-slate-300 sm:text-lg">
                {hero?.subtitle || '문의·예약·웨이팅·주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.'}
              </p>
            </Reveal>
            <Reveal direction="up" delay={180}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="group relative overflow-hidden rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white shadow-[0_0_40px_rgba(249,115,22,0.45)] transition-all duration-300 hover:bg-orange-400 hover:shadow-[0_0_60px_rgba(249,115,22,0.65)] active:scale-95"
                  to={hero?.cta_href || settings?.primary_cta_href || '/onboarding?plan=free'}
                >
                  <span className="relative z-10">{hero?.cta_label || settings?.primary_cta_label || '무료로 시작하기'}</span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </Link>
                <Link
                  className="rounded-2xl border border-white/14 bg-white/[0.06] px-6 py-3 text-sm font-bold text-slate-100 backdrop-blur-sm transition hover:bg-white/[0.1]"
                  to="/features"
                >
                  기능 살펴보기
                </Link>
                <button
                  className="rounded-2xl border border-white/14 bg-white/[0.06] px-6 py-3 text-sm font-bold text-slate-100 backdrop-blur-sm transition hover:bg-white/[0.1]"
                  data-demo-trigger="homepage"
                  onClick={() => setDemoOpen(true)}
                  type="button"
                >
                  데모 보기
                </button>
              </div>
            </Reveal>
            <Reveal direction="up" delay={240}>
              <div className="mt-6 flex flex-wrap gap-2">
                {['공개 스토어', '고객 기억', '운영 대시보드'].map((chip) => (
                  <span
                    className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-bold text-slate-300 backdrop-blur-sm"
                    key={chip}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right: orbit hero with mouse parallax */}
          <div
            className="mybiz-hero-orbit relative min-h-[32rem]"
            data-cinematic-world="service-memory"
            data-service-orbit-world="hero"
            ref={heroRef}
          >
            {/* Outer slow ring */}
            <div
              className="orbit-ring-slow pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-400/10"
              style={{ transform: `translate(calc(-50% + ${mouseOffset.x * 0.4}px), calc(-50% + ${mouseOffset.y * 0.4}px)) rotate(0deg)` }}
            />
            {/* Mid ring */}
            <div
              className="orbit-ring-med pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/15"
              style={{ transform: `translate(calc(-50% + ${mouseOffset.x * 0.2}px), calc(-50% + ${mouseOffset.y * 0.2}px)) rotate(0deg)` }}
            />

            {/* Light trails */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
              <span className="mybiz-light-trail left-[12%] top-[26%]" />
              <span className="mybiz-light-trail animation-delay-700 left-[58%] top-[62%]" />
              <span className="mybiz-light-trail animation-delay-1400 left-[72%] top-[28%]" />
              <span className="mybiz-light-trail animation-delay-700 left-[30%] top-[72%]" style={{ opacity: 0.4 }} />
            </div>

            {/* Center glow */}
            <div
              className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
              style={{
                background: 'radial-gradient(circle, rgba(251,146,60,0.32), rgba(96,165,250,0.12) 60%, transparent)',
                transform: `translate(calc(-50% + ${mouseOffset.x * 0.6}px), calc(-50% + ${mouseOffset.y * 0.6}px))`,
                transition: 'transform 0.15s ease-out',
              }}
            />

            {/* Core orb */}
            <div
              className="mybiz-memory-core absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-orange-300/40 bg-orange-400/15 shadow-[0_0_80px_rgba(251,146,60,0.38)]"
              style={{
                transform: `translate(calc(-50% + ${mouseOffset.x * 1.2}px), calc(-50% + ${mouseOffset.y * 1.2}px))`,
                transition: 'transform 0.12s ease-out',
              }}
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-500 text-3xl font-black shadow-[0_0_40px_rgba(249,115,22,0.6)]">
                M
              </div>
            </div>

            {/* Orbit nodes — positioned around the core */}
            {flowSteps.slice(0, 8).map((step, index) => {
              const total = Math.min(flowSteps.length, 8);
              const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
              const radius = 185;
              const baseX = Math.cos(angle) * radius;
              const baseY = Math.sin(angle) * radius;
              const parallaxFactor = 0.8 + (index % 3) * 0.15;
              return (
                <div
                  className="mybiz-orbit-node absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/14 bg-slate-950/88 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur-sm"
                  key={step}
                  style={{
                    transform: `translate(
                      calc(-50% + ${baseX + mouseOffset.x * parallaxFactor}px),
                      calc(-50% + ${baseY + mouseOffset.y * parallaxFactor}px)
                    )`,
                    transition: 'transform 0.12s ease-out',
                    animationDelay: `${(index * 0.6).toFixed(1)}s`,
                  }}
                >
                  {step}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 animate-bounce flex-col items-center gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">스크롤</span>
          <svg className="text-slate-600" fill="none" height="16" viewBox="0 0 16 16" width="16">
            <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FLOW — 3-step connected panels, scale-up on scroll
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden bg-[#02050a] px-5 py-20 text-white sm:px-8 lg:px-10"
        data-product-story-flow="connected-panels"
        id="services"
      >
        <Orbs dark />

        {/* Faint horizontal rule that connects sections */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(251,146,60,0.25) 30%, rgba(96,165,250,0.2) 70%, transparent)' }}
        />

        <div className="relative mx-auto max-w-7xl">
          <Reveal direction="up">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-400">운영 흐름</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black sm:text-4xl lg:text-5xl">
              공개 접점부터 고객 기억,{' '}
              <br className="hidden lg:block" />
              운영 액션까지{' '}
              <span className="shimmer-text">하나로 이어집니다</span>
            </h2>
          </Reveal>

          <div className="stagger-children mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                num: '01',
                title: '공개 스토어 / 고객 접점',
                body: '문의하기, 예약하기, 웨이팅, QR 주문으로 고객 행동이 자연스럽게 시작됩니다.',
                icon: '🏪',
              },
              {
                num: '02',
                title: '점주 운영 대시보드',
                body: '예약, 웨이팅, 주문, 알림을 한 화면에서 빠르게 확인합니다.',
                icon: '📊',
              },
              {
                num: '03',
                title: '고객 기억 / 반복 매출 엔진',
                body: '고객명, 방문 횟수, 선호 메뉴, 추천 액션이 운영 근거로 쌓입니다.',
                icon: '🧠',
              },
            ].map((item) => (
              <article
                className="reveal-ready reveal-up feature-card-hover group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm transition-all duration-500"
                key={item.num}
              >
                {/* Inner glow on hover */}
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-orange-500/0 to-blue-500/0 opacity-0 transition-opacity duration-500 group-hover:from-orange-500/[0.06] group-hover:to-blue-500/[0.04] group-hover:opacity-100" />
                <p className="text-[11px] font-black tracking-[0.2em] text-orange-400">{item.num}</p>
                <div className="mt-3 text-3xl">{item.icon}</div>
                <h3 className="mt-3 break-keep text-xl font-black text-white">{item.title}</h3>
                <p className="mt-3 break-keep text-sm leading-7 text-slate-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEATURES — light section, staggered card scale-up
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#f6f2ea] px-5 py-20 sm:px-8 lg:px-10" id="features">
        <Orbs dark={false} />

        <div className="relative mx-auto max-w-7xl">
          <Reveal direction="up">
            <p className="eyebrow">핵심 기능</p>
            <h2 className="mt-3 break-keep font-display text-4xl font-black text-slate-950 lg:text-5xl">
              {featureSection?.title || (
                <>
                  작은 매장의{' '}
                  <span className="text-orange-600">반복 매출</span>을
                  {' '}만드는 운영 기능
                </>
              )}
            </h2>
          </Reveal>

          <div className="stagger-children mt-10 grid gap-4 md:grid-cols-3">
            {featureCards.map((card, i) => (
              <article
                className="reveal-ready reveal-up feature-card-hover group section-card cursor-default p-6 transition-all duration-500 hover:-translate-y-1.5 hover:border-orange-200"
                key={card}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `hsl(${24 + i * 12}deg 96% 50%)` }}
                >
                  <Icons.Check size={18} />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">{card}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  고객 입력을 고객 기억과 운영 액션으로 연결합니다.
                </p>
                {/* Reveal underline */}
                <div
                  className="mt-4 h-0.5 w-0 rounded-full bg-orange-400 transition-all duration-500 group-hover:w-full"
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          CASES — mid section, slide from sides
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white px-5 py-20 sm:px-8 lg:px-10" id="cases">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(249,115,22,0.06),transparent)]" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal direction="left">
            <div className="rounded-[2.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-orange-50/40 p-8 lg:p-12">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="eyebrow">고객 사례</p>
                  <h2 className="mt-3 break-keep font-display text-3xl font-black text-slate-950 lg:text-4xl">
                    매장 운영 데이터를{' '}
                    <br className="hidden lg:block" />
                    고객 기억으로 바꾸는 방향에 집중합니다
                  </h2>
                  <p className="mt-4 max-w-2xl break-keep text-sm leading-7 text-slate-600">
                    문의, 예약, 웨이팅, 주문이 각각 흩어지지 않고 한 고객의 맥락으로 보이면 사장님의 다음 액션도 더 빠르게 정해집니다.
                  </p>
                </div>
                <div className="flex items-center">
                  <Link
                    className="group relative overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 px-6 py-3 text-sm font-black text-orange-700 transition hover:bg-orange-100"
                    to="/cases"
                  >
                    고객 사례 보기 →
                  </Link>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200/70 pt-8">
                {[
                  ['재방문율', '+34%', '고객 기억 활성화 후 평균'],
                  ['운영 응대 시간', '-52%', '문의·예약 자동화 도입 후'],
                  ['객단가', '+18%', '추천 메뉴 엔진 가동 매장'],
                ].map(([label, value, note]) => (
                  <Reveal delay={0} direction="up" key={label}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <p className="mt-1 font-display text-3xl font-black text-orange-600 lg:text-4xl">{value}</p>
                    <p className="mt-1 text-xs text-slate-500">{note}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FINAL CTA — dramatic dark close
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#02050a] px-5 py-24 text-white sm:px-8 lg:px-10" id="resources">
        <Orbs dark />

        {/* Big background text */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <p className="select-none text-[22vw] font-black text-white/[0.025] leading-none tracking-tighter">
            MYBIZ
          </p>
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <Reveal direction="up">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-orange-400">
              {finalCta?.eyebrow || '시작하기'}
            </p>
            <h2 className="mt-4 break-keep font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {finalCta?.title || (
                <>
                  우리 가게의{' '}
                  <span className="shimmer-text">고객 기억 구조</span>
                  부터{' '}
                  <br className="hidden sm:block" />
                  확인해 보세요
                </>
              )}
            </h2>
            <p className="mx-auto mt-5 max-w-xl break-keep text-base leading-8 text-slate-400">
              {finalCta?.subtitle || '결제 전에 고객 접점과 운영 흐름을 먼저 정리할 수 있습니다.'}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                className="group relative overflow-hidden rounded-2xl bg-orange-500 px-8 py-4 text-base font-black text-white shadow-[0_0_60px_rgba(249,115,22,0.5)] transition-all duration-300 hover:bg-orange-400 hover:shadow-[0_0_90px_rgba(249,115,22,0.7)] active:scale-95"
                to={finalCta?.cta_href || '/onboarding?plan=free'}
              >
                <span className="relative z-10">{finalCta?.cta_label || '무료로 시작하기'}</span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </Link>
              <button
                className="rounded-2xl border border-white/14 bg-white/[0.06] px-8 py-4 text-base font-bold text-slate-100 backdrop-blur-sm transition hover:bg-white/[0.1]"
                onClick={() => setDemoOpen(true)}
                type="button"
              >
                데모 먼저 보기
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Scroll stagger observer for stagger-children ─────────────────── */}
      <StaggerActivator />

      <DemoPreviewModal onClose={() => setDemoOpen(false)} open={demoOpen} />
    </main>
  );
}

// Activates stagger-children items when their parent enters view
function StaggerActivator() {
  useEffect(() => {
    const groups = document.querySelectorAll<HTMLElement>('.stagger-children');
    const items: HTMLElement[] = [];
    groups.forEach((group) => {
      group.querySelectorAll<HTMLElement>('.reveal-ready').forEach((item) => items.push(item));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('in-view');
          }
        });
      },
      { threshold: 0.08 },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return null;
}
