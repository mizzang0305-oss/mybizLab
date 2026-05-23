/**
 * LandingPage — Cuberto-inspired premium motion design
 * Full-screen dark aesthetic, magnetic cursor, word-by-word clip reveals,
 * horizontal marquee, giant stat numbers, deeply connected sections.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useSpring,
  useScroll,
  useTransform,
  AnimatePresence,
} from 'motion/react';
import { useQuery } from '@tanstack/react-query';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformHomepageContent } from '@/shared/lib/services/platformAdminContentService';
import { SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';

// ─── Reusable easing ─────────────────────────────────────────────────────────
const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_CIRC = [0.22, 1, 0.36, 1] as const;

// ─── Magnetic cursor ──────────────────────────────────────────────────────────
function MagneticCursor() {
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);

  // Dot: follows immediately
  const dotX = useSpring(mx, { stiffness: 800, damping: 40, mass: 0.2 });
  const dotY = useSpring(my, { stiffness: 800, damping: 40, mass: 0.2 });

  // Ring: follows with lag
  const ringX = useSpring(mx, { stiffness: 130, damping: 22, mass: 0.5 });
  const ringY = useSpring(my, { stiffness: 130, damping: 22, mass: 0.5 });

  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mx.set(e.clientX);
      my.set(e.clientY);
    }
    function onEnter(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest('a,button,[data-magnetic]')) setHovered(true);
    }
    function onLeave(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest('a,button,[data-magnetic]')) setHovered(false);
    }
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onEnter);
    document.addEventListener('mouseout', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onEnter);
      document.removeEventListener('mouseout', onLeave);
    };
  }, [mx, my]);

  return (
    <>
      {/* Outer ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9998] rounded-full border border-white/30"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          mixBlendMode: 'difference',
        }}
        animate={{
          width: hovered ? 64 : 40,
          height: hovered ? 64 : 40,
          opacity: hovered ? 0.7 : 0.45,
        }}
        transition={{ duration: 0.25, ease: EASE_CIRC }}
      />
      {/* Inner dot */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999] rounded-full bg-white"
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          mixBlendMode: 'difference',
        }}
        animate={{ width: hovered ? 6 : 8, height: hovered ? 6 : 8 }}
        transition={{ duration: 0.15, ease: EASE_CIRC }}
      />
    </>
  );
}

// ─── Word-by-word reveal (clip from bottom) ───────────────────────────────────
function WordReveal({
  text,
  className = '',
  delay = 0,
  stagger = 0.07,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(' ');
  return (
    <span className={className} style={{ display: 'inline' }}>
      {words.map((word, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '115%', rotate: 2 }}
            whileInView={{ y: '0%', rotate: 0 }}
            viewport={{ once: true, margin: '-8%' }}
            transition={{ duration: 0.85, ease: EASE_EXPO, delay: delay + i * stagger }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

// ─── Single-line clip reveal ───────────────────────────────────────────────────
function LineReveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag style={{ overflow: 'hidden' }} className={className}>
      <motion.div
        initial={{ y: '110%', opacity: 0 }}
        whileInView={{ y: '0%', opacity: 1 }}
        viewport={{ once: true, margin: '-5%' }}
        transition={{ duration: 0.9, ease: EASE_EXPO, delay }}
      >
        {children}
      </motion.div>
    </Tag>
  );
}

// ─── Fade reveal ──────────────────────────────────────────────────────────────
function FadeReveal({
  children,
  delay = 0,
  className = '',
  direction = 'up',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'left' | 'right' | 'none';
}) {
  const initial =
    direction === 'up' ? { opacity: 0, y: 32 }
    : direction === 'left' ? { opacity: 0, x: -40 }
    : direction === 'right' ? { opacity: 0, x: 40 }
    : { opacity: 0 };
  const target = { opacity: 1, y: 0, x: 0 };
  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={target}
      viewport={{ once: true, margin: '-6%' }}
      transition={{ duration: 0.8, ease: EASE_CIRC, delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Magnetic button wrapper ──────────────────────────────────────────────────
function MagneticBtn({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 });
  const sy = useSpring(y, { stiffness: 220, damping: 18 });

  function onMove(e: React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 110) {
      x.set(dx * 0.38);
      y.set(dy * 0.38);
    }
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      data-magnetic
      style={{ x: sx, y: sy, display: 'inline-block' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <div className={className}>{children}</div>
    </motion.div>
  );
}

// ─── Horizontal marquee ───────────────────────────────────────────────────────
function Marquee({ text, speed = 28, dir = -1 }: { text: string; speed?: number; dir?: 1 | -1 }) {
  const items = Array.from({ length: 5 }, (_, i) => (
    <span key={i} className="inline-flex items-center gap-8 pr-8">
      {text}
      <span className="inline-block h-2 w-2 rounded-full bg-[#ec5b13]" />
    </span>
  ));
  return (
    <div className="flex overflow-hidden">
      <motion.div
        className="flex shrink-0 whitespace-nowrap"
        animate={{ x: dir > 0 ? '0%' : '-50%' }}
        initial={{ x: dir > 0 ? '-50%' : '0%' }}
        transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
      >
        {items}
        {items}
      </motion.div>
    </div>
  );
}

// ─── Scroll progress bar ──────────────────────────────────────────────────────
function ProgressBar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      aria-hidden
      className="fixed left-0 top-0 z-[100] h-[2px] origin-left"
      style={{
        scaleX: scrollYProgress,
        background: 'linear-gradient(90deg, #f97316, #fb923c)',
      }}
    />
  );
}

// ─── Demo modal ───────────────────────────────────────────────────────────────
export function DemoPreviewModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
    <AnimatePresence>
      {open && (
        <motion.div
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6"
          data-demo-modal="homepage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" />
          <motion.div
            className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#08080f] p-6 shadow-[0_40px_140px_-20px_rgba(0,0,0,0.9)] sm:p-8"
            initial={{ scale: 0.94, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 24 }}
            transition={{ duration: 0.4, ease: EASE_EXPO }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black tracking-[0.3em] text-[#ec5b13] uppercase">
                  MYBIZ DEMO
                </p>
                <h2 className="mt-2 break-keep font-display text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                  MyBiz 데모 보기
                </h2>
                <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-white/50">
                  공개 스토어에서 고객 신호가 들어오고, 점주 운영 화면과 고객 기억으로 이어지는 흐름을 빠르게 확인해 보세요.
                </p>
              </div>
              <button
                className="self-start rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                onClick={onClose}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {demoItems.map((item, index) => (
                <motion.article
                  className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-5"
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_CIRC, delay: 0.15 + index * 0.08 }}
                >
                  <p className="text-[10px] font-black tracking-[0.22em] text-[#ec5b13] uppercase">
                    0{index + 1}
                  </p>
                  <h3 className="mt-3 break-keep text-lg font-black text-white">{item.title}</h3>
                  <p className="mt-2 break-keep text-sm leading-6 text-white/50">{item.body}</p>
                  <Link
                    className="mt-5 inline-flex rounded-2xl bg-[#ec5b13] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#d94f0b]"
                    onClick={onClose}
                    to={item.to}
                  >
                    {item.cta}
                  </Link>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Number counter animation ─────────────────────────────────────────────────
function AnimatedStat({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true;
        const start = Date.now();
        const dur = 1600;
        function tick() {
          const elapsed = Date.now() - start;
          const t = Math.min(elapsed / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(eased * value));
          if (t < 1) requestAnimationFrame(tick);
        }
        tick();
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  );
}

// ─── Main LandingPage ─────────────────────────────────────────────────────────
export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll();
  const heroParallaxY = useTransform(scrollY, [0, 700], [0, -140]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => setMounted(true), []);

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

  const fallbackFlow = ['공개 스토어', '문의', '예약', '웨이팅', 'QR 주문', '고객 기억', '운영 액션'];
  const fallbackFeatureCards = ['공개 스토어', 'AI 상담', '예약·웨이팅', 'QR 주문', '고객 프로필', '운영 대시보드'];

  const flowSteps = useMemo(() => {
    const v = flowSection?.payload.steps;
    return Array.isArray(v) ? v.map(String).filter(Boolean) : fallbackFlow;
  }, [flowSection]);

  const featureCards = useMemo(() => {
    const v = featureSection?.payload.cards;
    return Array.isArray(v) ? v.map(String).filter(Boolean) : fallbackFeatureCards;
  }, [featureSection]);

  usePageMeta(
    settings?.seo_title || 'MyBiz | 고객 기억 기반 매출 AI SaaS',
    settings?.seo_description || SERVICE_DESCRIPTION,
  );

  const heroLine1 = hero?.title?.split(' ').slice(0, 2).join(' ') || '고객을 기억하는';
  const heroLine2 = hero?.title?.split(' ').slice(2).join(' ') || '매장이 더 많이 팝니다';
  const heroSubtitle =
    hero?.subtitle ||
    '문의·예약·웨이팅·주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.';
  const primaryCta = hero?.cta_href || settings?.primary_cta_href || '/onboarding?plan=free';
  const primaryCtaLabel = hero?.cta_label || settings?.primary_cta_label || '무료로 시작하기';

  return (
    <main
      className="overflow-x-hidden bg-[#03040a] text-white"
      data-cinematic-home="true"
      data-landing-mode="hero-engine"
    >
      {/* Cursor — client-only */}
      {mounted && <MagneticCursor />}

      <ProgressBar />

      {/* ════════════════════════════════════════════════════════════════
          01 · HERO
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-[#03040a] px-6 pb-20 pt-32 sm:px-10 lg:px-16"
        data-cinematic-world="service-memory"
        data-service-orbit-world="hero"
        ref={heroRef}
      >
        {/* Noise overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: '256px 256px',
          }}
        />

        {/* Ambient orbs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -left-1/4 -top-1/4 h-[70vw] w-[70vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(236,91,19,0.14) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-1/4 right-0 h-[60vw] w-[60vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          />
        </div>

        {/* Content with scroll-driven parallax */}
        <motion.div
          className="relative mx-auto w-full max-w-[90rem]"
          style={{ y: heroParallaxY, opacity: heroOpacity }}
        >
          {/* Eyebrow */}
          <LineReveal delay={0.05}>
            <p className="mb-6 font-mono text-[11px] font-bold uppercase tracking-[0.35em] text-[#ec5b13]/80">
              {hero?.eyebrow || 'AI 운영 플랫폼, MyBiz'}
            </p>
          </LineReveal>

          {/* Main headline — full-line clip reveals (keeps text as continuous strings) */}
          <h1
            className="break-keep font-display font-black leading-[1.02] tracking-[-0.055em]"
            style={{ fontSize: 'clamp(3.2rem, 9.5vw, 9rem)' }}
          >
            <span style={{ display: 'block', overflow: 'hidden' }}>
              <motion.span
                style={{ display: 'block' }}
                className="text-white"
                initial={{ y: '110%', rotate: 1 }}
                animate={{ y: '0%', rotate: 0 }}
                transition={{ duration: 1.0, ease: EASE_EXPO, delay: 0.15 }}
              >
                {heroLine1}
              </motion.span>
            </span>
            <span style={{ display: 'block', overflow: 'hidden' }}>
              <motion.span
                style={{ display: 'block' }}
                className="text-[#ec5b13]"
                initial={{ y: '110%', rotate: 1 }}
                animate={{ y: '0%', rotate: 0 }}
                transition={{ duration: 1.0, ease: EASE_EXPO, delay: 0.3 }}
              >
                {heroLine2}
              </motion.span>
            </span>
          </h1>

          {/* Subtitle */}
          <FadeReveal delay={0.65} className="mt-8 max-w-2xl">
            <p className="break-keep text-lg leading-8 text-white/48 sm:text-xl">
              {heroSubtitle}
            </p>
          </FadeReveal>

          {/* CTAs */}
          <FadeReveal delay={0.8} className="mt-10 flex flex-wrap items-center gap-4">
            <MagneticBtn
              className="group relative overflow-hidden rounded-full bg-[#ec5b13] px-9 py-4 text-sm font-black text-white shadow-[0_0_48px_rgba(236,91,19,0.5)] transition-shadow hover:shadow-[0_0_80px_rgba(236,91,19,0.7)]"
            >
              <Link to={primaryCta}>{primaryCtaLabel}</Link>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </MagneticBtn>

            <MagneticBtn
              className="rounded-full border border-white/12 bg-white/[0.05] px-9 py-4 text-sm font-bold text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <Link to="/features">기능 살펴보기</Link>
            </MagneticBtn>

            <MagneticBtn
              className="rounded-full border border-white/12 bg-white/[0.05] px-9 py-4 text-sm font-bold text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              onClick={() => setDemoOpen(true)}
            >
              <button
                data-demo-trigger="homepage"
                type="button"
                className="block"
              >
                데모 보기
              </button>
            </MagneticBtn>
          </FadeReveal>

          {/* Service chips */}
          <FadeReveal delay={0.95} className="mt-10 flex flex-wrap gap-2">
            {flowSteps.slice(0, 6).map((step) => (
              <span
                className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-wide text-white/40"
                key={step}
              >
                {step}
              </span>
            ))}
          </FadeReveal>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25">
            스크롤
          </span>
          <motion.div
            className="h-8 w-px bg-gradient-to-b from-white/30 to-transparent"
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          />
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          TICKER — horizontal marquee
      ════════════════════════════════════════════════════════════════ */}
      <div
        className="overflow-hidden border-y border-white/[0.06] bg-[#03040a] py-4"
        aria-hidden
      >
        <p
          className="font-display text-sm font-black uppercase tracking-[0.2em] text-white/18"
          style={{ whiteSpace: 'nowrap' }}
        >
          <Marquee
            text="문의 · 예약 · 웨이팅 · QR 주문 · 고객 기억 · 운영 대시보드 · AI 상담 · 반복 매출 · 재방문"
            speed={30}
          />
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          02 · SERVICES — 3 panels, numbered editorial
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative bg-[#03040a] px-6 py-24 sm:px-10 lg:px-16"
        id="services"
        data-product-story-flow="connected-panels"
      >
        <div className="mx-auto max-w-[90rem]">
          {/* Section label */}
          <FadeReveal>
            <p className="mb-16 font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-white/30">
              운영 흐름 / Services
            </p>
          </FadeReveal>

          {/* 3 service rows */}
          {[
            {
              num: '01',
              title: '공개 스토어 / 고객 접점',
              body: '문의하기, 예약하기, 웨이팅, QR 주문으로 고객 행동이 자연스럽게 시작됩니다.',
              accent: '#ec5b13',
            },
            {
              num: '02',
              title: '점주 운영 대시보드',
              body: '예약, 웨이팅, 주문, 알림을 한 화면에서 빠르게 확인합니다.',
              accent: '#3b82f6',
            },
            {
              num: '03',
              title: '고객 기억 / 반복 매출 엔진',
              body: '고객명, 방문 횟수, 선호 메뉴, 추천 액션이 운영 근거로 쌓입니다.',
              accent: '#a855f7',
            },
          ].map((item, i) => (
            <motion.article
              key={item.num}
              className="group relative cursor-default border-b border-white/[0.06] py-12 transition-colors last:border-b-0 hover:border-white/[0.14]"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 0.7, ease: EASE_CIRC, delay: i * 0.1 }}
            >
              <div className="grid items-start gap-6 lg:grid-cols-[5rem_1fr_1fr]">
                {/* Number */}
                <div style={{ overflow: 'hidden' }}>
                  <motion.p
                    className="font-mono text-sm font-bold text-white/20 transition-colors group-hover:text-[#ec5b13]/70"
                    initial={{ y: '100%' }}
                    whileInView={{ y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.1 + i * 0.08 }}
                  >
                    {item.num}
                  </motion.p>
                </div>

                {/* Title */}
                <div style={{ overflow: 'hidden' }}>
                  <motion.h2
                    className="break-keep font-display font-black text-white/90 transition-all duration-300 group-hover:text-white"
                    style={{ fontSize: 'clamp(1.6rem, 3.5vw, 3rem)', lineHeight: 1.1, letterSpacing: '-0.03em' }}
                    initial={{ y: '105%' }}
                    whileInView={{ y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.75, ease: EASE_EXPO, delay: 0.15 + i * 0.08 }}
                  >
                    {item.title}
                  </motion.h2>
                </div>

                {/* Body + accent bar */}
                <FadeReveal delay={0.25 + i * 0.08} direction="right">
                  <div className="flex items-start gap-4">
                    <div
                      className="mt-1.5 h-[3px] w-8 shrink-0 rounded-full transition-all duration-500 group-hover:w-12"
                      style={{ background: item.accent }}
                    />
                    <p className="break-keep text-sm leading-7 text-white/38 transition-colors group-hover:text-white/52">
                      {item.body}
                    </p>
                  </div>
                </FadeReveal>
              </div>

              {/* Hover glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-2xl"
                style={{
                  background: `radial-gradient(ellipse 60% 50% at 30% 50%, ${item.accent}08, transparent)`,
                }}
              />
            </motion.article>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          STATS — giant numbers
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden bg-[#03040a] px-6 py-28 sm:px-10 lg:px-16"
        id="cases"
      >
        {/* Faint rule */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(236,91,19,0.2) 40%, transparent)' }} />

        <div className="mx-auto max-w-[90rem]">
          <FadeReveal>
            <p className="mb-20 font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-white/30">
              성과 지표 / Results
            </p>
          </FadeReveal>

          <div className="grid divide-y divide-white/[0.06] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {[
              { value: 34, prefix: '+', suffix: '%', label: '재방문율', note: '고객 기억 활성화 후 평균' },
              { value: 52, prefix: '–', suffix: '%', label: '운영 응대 시간', note: '문의·예약 자동화 도입 후' },
              { value: 18, prefix: '+', suffix: '%', label: '객단가', note: '추천 메뉴 엔진 가동 매장' },
            ].map((stat, i) => (
              <FadeReveal key={stat.label} delay={i * 0.12} className="px-0 py-10 lg:px-12 lg:py-0">
                <div>
                  <p
                    className="font-display font-black leading-none tracking-tight text-white"
                    style={{ fontSize: 'clamp(4rem, 10vw, 9rem)', letterSpacing: '-0.06em' }}
                  >
                    <AnimatedStat value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </p>
                  <p
                    className="mt-4 font-semibold text-white/60"
                    style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)' }}
                  >
                    {stat.label}
                  </p>
                  <p className="mt-2 text-sm text-white/28">{stat.note}</p>
                </div>
              </FadeReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Second ticker — reversed direction */}
      <div className="overflow-hidden border-y border-white/[0.06] bg-[#03040a] py-4" aria-hidden>
        <Marquee
          text="매출 증가 · 고객 기억 · 재방문 설계 · 운영 자동화 · 예약 관리 · QR 주문 · 웨이팅 정리"
          speed={36}
          dir={1}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════
          03 · FEATURES — editorial grid
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative bg-[#03040a] px-6 py-24 sm:px-10 lg:px-16"
        id="features"
      >
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-16 lg:grid-cols-[1fr_2fr]">
            {/* Left sticky label */}
            <div>
              <FadeReveal>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-white/30">
                  핵심 기능 / Features
                </p>
              </FadeReveal>
              <FadeReveal delay={0.1}>
                <h2
                  className="mt-6 break-keep font-display font-black text-white"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.1, letterSpacing: '-0.04em' }}
                >
                  {featureSection?.title || (
                    <>작은 매장의<br /><span className="text-[#ec5b13]">반복 매출</span>을<br />만드는 기능</>
                  )}
                </h2>
              </FadeReveal>
              <FadeReveal delay={0.2} className="mt-8">
                <Link
                  className="inline-flex rounded-full border border-white/12 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  to="/features"
                >
                  모든 기능 보기 →
                </Link>
              </FadeReveal>
            </div>

            {/* Right: feature grid */}
            <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
              {featureCards.map((card, i) => (
                <motion.article
                  key={card}
                  className="group relative overflow-hidden bg-[#03040a] p-6 sm:p-8 transition-colors hover:bg-white/[0.03]"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-5%' }}
                  transition={{ duration: 0.6, ease: EASE_CIRC, delay: i * 0.06 }}
                >
                  <span
                    className="font-mono text-[10px] font-bold tracking-widest"
                    style={{ color: `hsl(${24 + i * 20}deg 90% 65%)` }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-4 break-keep text-lg font-black text-white/85 transition-colors group-hover:text-white">
                    {card}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/30">
                    고객 입력을 고객 기억과 운영 액션으로 연결합니다.
                  </p>
                  {/* Hover accent line */}
                  <motion.div
                    className="absolute bottom-0 left-0 h-[2px] rounded-full"
                    style={{ background: `hsl(${24 + i * 20}deg 90% 65%)` }}
                    initial={{ width: 0 }}
                    whileHover={{ width: '100%' }}
                    transition={{ duration: 0.4, ease: EASE_CIRC }}
                  />
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          04 · FINAL CTA — dramatic close
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden bg-[#03040a] px-6 py-32 sm:px-10 lg:px-16"
        id="resources"
      >
        {/* Massive bg text */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <p
            className="select-none font-display font-black text-white/[0.025]"
            style={{ fontSize: 'clamp(6rem, 28vw, 28rem)', letterSpacing: '-0.06em', lineHeight: 1 }}
          >
            MYBIZ
          </p>
        </div>

        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[60vw] w-[60vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236,91,19,0.12) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="relative mx-auto max-w-[90rem] text-center">
          <FadeReveal>
            <p className="mb-6 font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-[#ec5b13]/60">
              {finalCta?.eyebrow || '시작하기 / Get Started'}
            </p>
          </FadeReveal>

          <h2
            className="break-keep font-display font-black text-white"
            style={{ fontSize: 'clamp(2.8rem, 7vw, 7rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}
          >
            <WordReveal
              text={finalCta?.title || '우리 가게의'}
              delay={0.05}
              stagger={0.08}
            />
            <br />
            <WordReveal
              text="고객 기억 구조부터"
              className="text-[#ec5b13]"
              delay={0.2}
              stagger={0.08}
            />
            <br />
            <WordReveal
              text="확인해 보세요"
              delay={0.38}
              stagger={0.08}
            />
          </h2>

          <FadeReveal delay={0.6} className="mx-auto mt-6 max-w-xl">
            <p className="break-keep text-lg leading-8 text-white/40">
              {finalCta?.subtitle || '결제 전에 고객 접점과 운영 흐름을 먼저 정리할 수 있습니다.'}
            </p>
          </FadeReveal>

          <FadeReveal delay={0.75} className="mt-12 flex flex-wrap items-center justify-center gap-5">
            <MagneticBtn
              className="group relative overflow-hidden rounded-full bg-[#ec5b13] px-12 py-5 text-base font-black text-white shadow-[0_0_60px_rgba(236,91,19,0.55)] transition-shadow hover:shadow-[0_0_100px_rgba(236,91,19,0.8)]"
            >
              <Link to={finalCta?.cta_href || '/onboarding?plan=free'}>
                {finalCta?.cta_label || '무료로 시작하기'}
              </Link>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </MagneticBtn>

            <MagneticBtn
              className="rounded-full border border-white/12 bg-white/[0.05] px-12 py-5 text-base font-bold text-white/75 backdrop-blur-sm transition hover:bg-white/[0.09] hover:text-white"
              onClick={() => setDemoOpen(true)}
            >
              <button type="button" className="block">데모 먼저 보기</button>
            </MagneticBtn>
          </FadeReveal>
        </div>
      </section>

      <DemoPreviewModal onClose={() => setDemoOpen(false)} open={demoOpen} />
    </main>
  );
}
