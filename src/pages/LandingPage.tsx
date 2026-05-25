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

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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

// ─── CSS-art mockup previews ─────────────────────────────────────────────────
function StorePreview({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ width: 300, background: '#09101d', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl flex items-center justify-center text-xs font-black" style={{ background: accent }}>☕</div>
          <div>
            <div className="text-[11px] font-black text-white/90">서울 단골 커피</div>
            <div className="text-[9px] text-white/35">공개 스토어</div>
          </div>
        </div>
        <div className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: `${accent}22`, color: accent }}>영업중</div>
      </div>
      {/* Menu items */}
      <div className="flex flex-col gap-0 px-4 py-3">
        {[['아이스 아메리카노', '4,500원'], ['카페라떼', '5,000원'], ['딸기 에이드', '5,500원']].map(([name, price]) => (
          <div key={name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[11px] text-white/75">{name}</span>
            <span className="text-[11px] font-bold" style={{ color: accent }}>{price}</span>
          </div>
        ))}
      </div>
      {/* CTA buttons */}
      <div className="flex gap-2 px-4 pb-4">
        {['예약하기', '웨이팅', 'QR 주문'].map((btn) => (
          <div key={btn} className="flex-1 rounded-xl py-2 text-center text-[10px] font-black text-white/80" style={{ background: 'rgba(255,255,255,0.08)' }}>{btn}</div>
        ))}
      </div>
    </div>
  );
}

function DashboardPreview({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ width: 300, background: '#09101d', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[10px] font-bold tracking-widest text-white/35 uppercase">오늘의 현황</div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-px px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[['예약', '8'], ['웨이팅', '3'], ['주문', '12']].map(([label, val]) => (
          <div key={label} className="text-center">
            <div className="text-xl font-black text-white" style={{ color: accent }}>{val}</div>
            <div className="text-[9px] text-white/35">{label}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mb-1 flex justify-between">
          <span className="text-[9px] text-white/35">운영 달성률</span>
          <span className="text-[9px] font-bold text-white/60">74%</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full" style={{ width: '74%', background: accent }} />
        </div>
      </div>
      {/* Recent list */}
      <div className="px-4 py-3">
        {[['김지수', '예약 확인 요청', '2분전'], ['박민준', '웨이팅 신청', '8분전']].map(([name, action, time]) => (
          <div key={name} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: `${accent}44` }}>{name[0]}</div>
              <span className="text-[10px] text-white/60">{name} · {action}</span>
            </div>
            <span className="text-[9px] text-white/25">{time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoryPreview({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ width: 300, background: '#09101d', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}
    >
      {/* Customer header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: accent }}>김</div>
        <div>
          <div className="text-[12px] font-black text-white">김지수 고객</div>
          <div className="text-[9px] text-white/40">방문 12회 · 마지막 방문 3일 전</div>
        </div>
        <div className="ml-auto text-[10px] font-black" style={{ color: accent }}>VIP</div>
      </div>
      {/* Preference tags */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">선호 패턴</div>
        <div className="flex flex-wrap gap-1.5">
          {['아이스 라떼', '창가 자리', '주말 오후', '혼자 방문'].map((tag) => (
            <span key={tag} className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white/70" style={{ background: 'rgba(255,255,255,0.09)' }}>{tag}</span>
          ))}
        </div>
      </div>
      {/* Timeline dots */}
      <div className="px-4 py-3">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">방문 타임라인</div>
        <div className="flex items-center gap-1.5">
          {[1,1,1,1,0,1,1,0,0,1,1,1].map((v, i) => (
            <div key={i} className="h-2 w-2 rounded-full" style={{ background: v ? accent : 'rgba(255,255,255,0.1)' }} />
          ))}
          <span className="ml-1 text-[9px] text-white/30">12회</span>
        </div>
      </div>
    </div>
  );
}

function SNSPreview({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ width: 300, background: '#09101d', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold tracking-widest text-white/35 uppercase">SNS 자동 발행</div>
          <div className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: `${accent}22`, color: accent }}>AI 생성</div>
        </div>
      </div>
      {/* Instagram post */}
      <div className="mx-4 mt-3 overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="h-5 w-5 rounded-full" style={{ background: 'linear-gradient(135deg,#f9a825,#e91e63,#9c27b0)' }} />
          <span className="text-[9px] font-bold text-white/60">Instagram</span>
          <span className="ml-auto rounded-full px-1.5 py-0.5 text-[8px]" style={{ background: '#22c55e22', color: '#4ade80' }}>발행 완료</span>
        </div>
        <div className="h-16 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent}18, rgba(59,130,246,0.1))` }}>
          <span className="text-2xl">☕</span>
        </div>
        <div className="px-3 py-2">
          <p className="text-[9px] leading-4 text-white/55">오늘의 특별 메뉴를 소개합니다 ✨ <span style={{ color: accent }}>#서울카페 #단골커피</span></p>
        </div>
      </div>
      {/* Naver blog row */}
      <div className="mx-4 my-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: '#03c75a' }}>N</div>
          <span className="text-[9px] text-white/55">네이버 블로그</span>
        </div>
        <span className="text-[9px] font-bold" style={{ color: accent }}>예약 발행 ✓</span>
      </div>
    </div>
  );
}

function AIPreview({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ width: 300, background: '#09101d', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs" style={{ background: accent }}>AI</div>
        <div className="text-[10px] font-bold text-white/70">AI 상담 어시스턴트</div>
        <div className="ml-auto h-2 w-2 rounded-full" style={{ background: '#4ade80' }} />
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">
        {/* Customer message */}
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-3 py-2 text-[10px] text-white/80" style={{ background: 'rgba(255,255,255,0.1)' }}>
            내일 2명 예약 가능한가요?
          </div>
        </div>
        {/* AI reply */}
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 text-[10px] text-white/80" style={{ background: `${accent}22`, border: `1px solid ${accent}33` }}>
            내일 오후 2시 2자리 확인됩니다. 예약 완료해드릴까요? 😊
          </div>
        </div>
        {/* Customer confirm */}
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-3 py-2 text-[10px] text-white/80" style={{ background: 'rgba(255,255,255,0.1)' }}>
            네, 예약해 주세요!
          </div>
        </div>
        {/* Typing */}
        <div className="flex items-center gap-1.5 pl-1">
          {[0,1,2].map(i => (
            <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: accent, opacity: 0.6, animationDelay: `${i * 0.2}s` }} />
          ))}
          <span className="text-[9px] text-white/30">AI 응답 중...</span>
        </div>
      </div>
    </div>
  );
}

// ─── Service row with cursor-following preview ────────────────────────────────
const SERVICE_MOCKUP_MAP: Record<string, (accent: string) => React.ReactElement> = {
  store: (a) => <StorePreview accent={a} />,
  dashboard: (a) => <DashboardPreview accent={a} />,
  memory: (a) => <MemoryPreview accent={a} />,
  sns: (a) => <SNSPreview accent={a} />,
  ai: (a) => <AIPreview accent={a} />,
};

function ServiceRow({
  num, title, body, accent, link, linkLabel, mockupKey, index,
}: {
  num: string; title: string; body: string; accent: string;
  link: string; linkLabel: string; mockupKey: string; index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef<HTMLElement>(null);
  const mx = useMotionValue(300);
  const my = useMotionValue(100);
  const springX = useSpring(mx, { stiffness: 220, damping: 26 });
  const springY = useSpring(my, { stiffness: 220, damping: 26 });

  function onMouseMove(e: React.MouseEvent) {
    const rect = rowRef.current!.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  }

  return (
    <motion.article
      ref={rowRef as React.RefObject<HTMLElement>}
      onMouseMove={onMouseMove}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group relative overflow-hidden border-b border-white/[0.06] py-14 transition-colors last:border-b-0 hover:border-white/[0.15]"
      style={{ cursor: 'none' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.7, ease: EASE_CIRC, delay: index * 0.08 }}
    >
      {/* Cursor-following mockup preview */}
      <motion.div
        className="pointer-events-none absolute z-30"
        style={{ left: springX, top: springY, x: '-45%', y: '-55%' }}
        animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.82, rotate: hovered ? -3 : 2 }}
        transition={{ duration: 0.4, ease: EASE_CIRC }}
      >
        {SERVICE_MOCKUP_MAP[mockupKey]?.(accent)}
      </motion.div>

      {/* Row layout */}
      <div className="grid items-center gap-8 lg:grid-cols-[5rem_1.2fr_1.4fr_auto]">
        {/* Number */}
        <div style={{ overflow: 'hidden' }}>
          <motion.p
            className="font-mono text-sm font-bold text-white/20 transition-colors group-hover:text-[#ec5b13]/80"
            initial={{ y: '100%' }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.08 + index * 0.07 }}
          >
            {num}
          </motion.p>
        </div>

        {/* Title */}
        <div style={{ overflow: 'hidden' }}>
          <motion.h2
            className="break-keep font-display font-black text-white/85 transition-colors group-hover:text-white"
            style={{ fontSize: 'clamp(1.8rem, 3.8vw, 3.2rem)', lineHeight: 1.08, letterSpacing: '-0.035em' }}
            initial={{ y: '108%' }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.78, ease: EASE_EXPO, delay: 0.14 + index * 0.07 }}
          >
            {title}
          </motion.h2>
        </div>

        {/* Body */}
        <FadeReveal delay={0.22 + index * 0.07} direction="right">
          <div className="flex items-start gap-3">
            <div
              className="mt-2 h-[3px] w-7 shrink-0 rounded-full transition-all duration-500 group-hover:w-11"
              style={{ background: accent }}
            />
            <p className="break-keep text-base leading-8 text-white/40 transition-colors group-hover:text-white/65">
              {body}
            </p>
          </div>
        </FadeReveal>

        {/* Link */}
        <FadeReveal delay={0.3 + index * 0.07}>
          <Link
            to={link}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white/60 transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
            style={{ whiteSpace: 'nowrap' }}
          >
            {linkLabel}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </FadeReveal>
      </div>

      {/* Hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-600 group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse 55% 60% at 25% 50%, ${accent}09, transparent)` }}
      />
    </motion.article>
  );
}

// ─── GSAP ScrollTrigger scrollytelling — 5-step feature story ────────────────
const STORY_FEATURES = [
  {
    num: '01',
    badge: '공개 스토어',
    headline: '고객의 첫\n방문을 설계하다',
    body: '문의하기, 예약, 웨이팅, QR 주문으로 고객 행동이 자연스럽게 시작됩니다. 방문 전부터 브랜드를 기억하게 만드세요.',
    accent: '#ec5b13',
    link: '/mybiz-live-cafe',
    linkLabel: '스토어 데모',
    mockupKey: 'store',
    tags: ['문의하기', '예약', '웨이팅', 'QR 주문'],
  },
  {
    num: '02',
    badge: '운영 대시보드',
    headline: '모든 운영을\n한눈에',
    body: '예약, 웨이팅, 주문, 알림을 하나의 화면에서 빠르게 파악하고 즉시 대응합니다. 현장이 조용해집니다.',
    accent: '#3b82f6',
    link: '/demo/dashboard',
    linkLabel: '대시보드 데모',
    mockupKey: 'dashboard',
    tags: ['실시간 현황', '예약 관리', '주문 처리', '알림'],
  },
  {
    num: '03',
    badge: '고객 기억',
    headline: '고객을 기억하면\n매출이 쌓인다',
    body: '고객명, 방문 횟수, 선호 메뉴, 추천 액션이 운영 근거로 쌓입니다. 재방문율이 올라가는 이유입니다.',
    accent: '#a855f7',
    link: '/demo/dashboard',
    linkLabel: '고객 기억 보기',
    mockupKey: 'memory',
    tags: ['방문 기록', '선호 메뉴', 'AI 추천 액션', '재방문'],
  },
  {
    num: '04',
    badge: 'SNS 자동화',
    headline: 'AI가 쓰는\n매장 콘텐츠',
    body: 'AI가 매장 데이터를 읽고 Instagram·네이버 블로그·Threads에 자동으로 콘텐츠를 생성·발행합니다.',
    accent: '#10b981',
    link: '/features',
    linkLabel: '기능 살펴보기',
    mockupKey: 'sns',
    tags: ['Instagram', '네이버 블로그', 'Threads', '자동 발행'],
  },
  {
    num: '05',
    badge: 'AI 상담',
    headline: '24시간\n자동 응대',
    body: '고객 문의를 AI가 24시간 응대하고, 대화 내용은 고객 기억으로 자동 연결됩니다. 잠들어 있어도 매출이 쌓입니다.',
    accent: '#f59e0b',
    link: '/onboarding?plan=free',
    linkLabel: '무료로 시작',
    mockupKey: 'ai',
    tags: ['24시간 응대', '고객 기억 연결', '자동 답변', '다국어'],
  },
];

function FeatureScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mockupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Set initial states
    STORY_FEATURES.forEach((_, i) => {
      gsap.set(contentRefs.current[i], {
        opacity: i === 0 ? 1 : 0,
        y: i === 0 ? 0 : 60,
        visibility: i === 0 ? 'visible' : 'hidden',
      });
      gsap.set(mockupRefs.current[i], {
        opacity: i === 0 ? 1 : 0,
        scale: i === 0 ? 1 : 0.88,
      });
    });

    if (glowRef.current) {
      gsap.set(glowRef.current, { background: `radial-gradient(ellipse 60% 55% at 65% 50%, ${STORY_FEATURES[0].accent}18, transparent 70%)` });
    }

    const ctx = gsap.context(() => {
      // Use GSAP pin instead of CSS sticky — parent overflow:hidden auto breaks sticky
      ScrollTrigger.create({
        trigger: stickyRef.current,
        start: 'top top',
        end: () => `+=${(STORY_FEATURES.length - 1) * window.innerHeight}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate(self) {
          const raw = self.progress * STORY_FEATURES.length;
          const newIdx = Math.min(Math.floor(raw), STORY_FEATURES.length - 1);
          const prevIdx = activeIdxRef.current;
          if (newIdx === prevIdx) return;

          const dir = newIdx > prevIdx ? 1 : -1;
          activeIdxRef.current = newIdx;

          // Animate out previous content
          gsap.to(contentRefs.current[prevIdx], {
            y: dir * -40,
            opacity: 0,
            duration: 0.38,
            ease: 'expo.in',
            onComplete: () => {
              if (contentRefs.current[prevIdx]) {
                gsap.set(contentRefs.current[prevIdx], { visibility: 'hidden' });
              }
            },
          });
          gsap.to(mockupRefs.current[prevIdx], {
            scale: dir === 1 ? 0.84 : 1.1,
            opacity: 0,
            duration: 0.32,
            ease: 'expo.in',
          });

          // Animate in new content
          gsap.set(contentRefs.current[newIdx], { visibility: 'visible', y: dir * 55, opacity: 0 });
          gsap.to(contentRefs.current[newIdx], {
            y: 0,
            opacity: 1,
            duration: 0.7,
            ease: 'expo.out',
            delay: 0.1,
          });
          gsap.set(mockupRefs.current[newIdx], { scale: dir === 1 ? 1.1 : 0.84, opacity: 0 });
          gsap.to(mockupRefs.current[newIdx], {
            scale: 1,
            opacity: 1,
            duration: 0.75,
            ease: 'expo.out',
            delay: 0.07,
          });

          // Shift glow colour
          if (glowRef.current) {
            gsap.to(glowRef.current, {
              duration: 0.6,
              ease: 'power2.out',
              background: `radial-gradient(ellipse 60% 55% at 65% 50%, ${STORY_FEATURES[newIdx].accent}18, transparent 70%)`,
            });
          }

          setActiveIdx(newIdx);
        },
      });
    }, stickyRef);

    return () => ctx.revert();
  }, []);

  const feature = STORY_FEATURES[activeIdx];

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="relative bg-[#03040a]"
      id="services"
      data-product-story-flow="scrollytelling"
    >
      {/* GSAP-pinned viewport — GSAP handles pinning via pin:true (bypasses CSS sticky limitation) */}
      <div
        ref={stickyRef}
        className="h-screen overflow-hidden"
      >
        {/* Ambient glow */}
        <div ref={glowRef} className="pointer-events-none absolute inset-0 transition-none" />

        {/* Subtle top rule */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 40%, transparent)' }}
        />

        <div className="relative flex h-full flex-col px-6 sm:px-10 lg:px-16">
          {/* Section label */}
          <div className="pt-16 lg:pt-20">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.35em] text-white/25">
              운영 흐름 / Services
            </p>
          </div>

          {/* Main content grid */}
          <div className="relative flex flex-1 items-center">
            <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">

              {/* ── Left: text content ── */}
              <div className="relative flex flex-col justify-center" style={{ minHeight: '22rem' }}>
                {STORY_FEATURES.map((f, i) => (
                  <div
                    key={f.num}
                    ref={(el) => { contentRefs.current[i] = el; }}
                    className="absolute inset-0 flex flex-col justify-center"
                  >
                    {/* Badge */}
                    <div className="mb-5 flex items-center gap-3">
                      <span
                        className="rounded-full px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-widest"
                        style={{ background: `${f.accent}22`, color: f.accent, border: `1px solid ${f.accent}44` }}
                      >
                        {f.badge}
                      </span>
                      <span className="font-mono text-xs font-bold text-white/20">{f.num} / 0{STORY_FEATURES.length}</span>
                    </div>

                    {/* Headline */}
                    <h2
                      className="break-keep font-display font-black text-white"
                      style={{
                        fontSize: 'clamp(2.6rem, 5.5vw, 5rem)',
                        lineHeight: 1.05,
                        letterSpacing: '-0.04em',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {f.headline}
                    </h2>

                    {/* Accent bar + body */}
                    <div className="mt-6 flex items-start gap-4">
                      <div
                        className="mt-2 h-[3px] w-9 shrink-0 rounded-full"
                        style={{ background: f.accent }}
                      />
                      <p className="break-keep text-base leading-8 text-white/50 lg:text-lg lg:leading-9">
                        {f.body}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="mt-6 flex flex-wrap gap-2">
                      {f.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full px-3 py-1 text-xs font-semibold text-white/40"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* CTA link */}
                    <div className="mt-8">
                      <Link
                        to={f.link}
                        className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-bold text-white transition-all"
                        style={{ background: f.accent, boxShadow: `0 0 28px ${f.accent}55` }}
                      >
                        {f.linkLabel}
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Right: mockup panel ── */}
              <div className="relative hidden items-center justify-center lg:flex" style={{ minHeight: '26rem' }}>
                {STORY_FEATURES.map((f, i) => (
                  <div
                    key={f.num}
                    ref={(el) => { mockupRefs.current[i] = el; }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div
                      className="w-full max-w-md overflow-hidden rounded-2xl"
                      style={{
                        border: `1px solid ${f.accent}30`,
                        boxShadow: `0 0 60px ${f.accent}18, 0 24px 80px rgba(0,0,0,0.5)`,
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {/* Window chrome */}
                      <div
                        className="flex items-center gap-2 px-4 py-3"
                        style={{ borderBottom: `1px solid ${f.accent}20`, background: 'rgba(0,0,0,0.3)' }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: f.accent }} />
                        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                        <span
                          className="ml-3 font-mono text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: f.accent }}
                        >
                          {f.badge}
                        </span>
                      </div>
                      {/* Mockup content */}
                      <div className="p-2" style={{ height: '340px', overflow: 'hidden' }}>
                        {SERVICE_MOCKUP_MAP[f.mockupKey]?.(f.accent)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Progress dots ── */}
          <div className="pb-10 lg:pb-14">
            <div className="mx-auto flex max-w-[90rem] items-center justify-between">
              {/* Dot rail */}
              <div className="flex items-center gap-3">
                {STORY_FEATURES.map((f, i) => (
                  <div
                    key={f.num}
                    className="rounded-full transition-all duration-500"
                    style={{
                      width: i === activeIdx ? '2.5rem' : '0.5rem',
                      height: '0.5rem',
                      background: i === activeIdx ? f.accent : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>

              {/* Scroll hint */}
              <p className="font-mono text-xs text-white/25 hidden sm:block">
                스크롤하여 다음 기능 →
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Feature card with hover image ────────────────────────────────────────────
const FEATURE_MOCKUP_SCENES = [
  // 공개 스토어
  (accent: string) => (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
      <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="h-4 w-4 rounded-lg flex items-center justify-center text-[8px]" style={{ background: accent }}>☕</div>
          <div className="text-[9px] font-bold text-white/60">서울 단골 커피</div>
        </div>
        {['아이스 아메리카노', '카페라떼', '딸기 에이드'].map(item => (
          <div key={item} className="flex justify-between px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[8px] text-white/50">{item}</span>
            <span className="text-[8px] font-bold" style={{ color: accent }}>주문</span>
          </div>
        ))}
      </div>
    </div>
  ),
  // AI 상담
  (accent: string) => (
    <div className="flex h-full flex-col justify-center gap-2 px-4">
      <div className="flex justify-end"><div className="rounded-2xl rounded-tr-sm px-3 py-1.5 text-[9px] text-white/70" style={{ background: 'rgba(255,255,255,0.09)' }}>예약 가능한가요?</div></div>
      <div className="flex justify-start"><div className="rounded-2xl rounded-tl-sm px-3 py-1.5 text-[9px] text-white/70" style={{ background: `${accent}22` }}>네, 내일 오후 2시 가능합니다 😊</div></div>
      <div className="flex justify-end"><div className="rounded-2xl rounded-tr-sm px-3 py-1.5 text-[9px] text-white/70" style={{ background: 'rgba(255,255,255,0.09)' }}>예약해 주세요!</div></div>
    </div>
  ),
  // 예약·웨이팅
  (accent: string) => (
    <div className="flex h-full flex-col justify-center gap-2 px-4">
      {[['예약', '8명', '#4ade80'], ['웨이팅', '3팀', accent], ['완료', '14건', 'rgba(255,255,255,0.3)']].map(([label, val, col]) => (
        <div key={label} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <span className="text-[9px] text-white/50">{label}</span>
          <span className="text-[11px] font-black" style={{ color: col }}>{val}</span>
        </div>
      ))}
    </div>
  ),
  // QR 주문
  (accent: string) => (
    <div className="flex h-full items-center justify-center gap-4 px-4">
      <div className="grid grid-cols-5 gap-0.5">
        {Array.from({length:25}).map((_, i) => <div key={i} className="h-3 w-3 rounded-[2px]" style={{ background: [0,2,4,5,8,10,12,14,16,20,22,24].includes(i) ? accent : 'rgba(255,255,255,0.1)' }} />)}
      </div>
      <div className="text-[9px] text-white/40 leading-4">테이블 QR<br/>바로 주문</div>
    </div>
  ),
  // 고객 프로필
  (accent: string) => (
    <div className="flex h-full flex-col justify-center gap-2 px-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full flex items-center justify-center font-black text-sm text-white" style={{ background: accent }}>김</div>
        <div>
          <div className="text-[10px] font-bold text-white/80">김지수</div>
          <div className="text-[8px] text-white/40">방문 12회 · VIP</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {['아이스라떼', '창가자리', '주말오후'].map(t => <span key={t} className="rounded-full px-2 py-0.5 text-[8px] text-white/55" style={{ background: 'rgba(255,255,255,0.08)' }}>{t}</span>)}
      </div>
    </div>
  ),
  // 운영 대시보드
  (accent: string) => (
    <div className="flex h-full flex-col justify-center gap-1.5 px-4">
      <div className="text-[8px] font-bold uppercase tracking-widest text-white/30">오늘의 현황</div>
      <div className="grid grid-cols-3 gap-1.5">
        {[['예약','8',accent],['웨이팅','3','#3b82f6'],['주문','12','#a855f7']].map(([l,v,c]) => (
          <div key={l} className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-black" style={{ color: c }}>{v}</div>
            <div className="text-[7px] text-white/40">{l}</div>
          </div>
        ))}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: '74%', background: accent }} />
      </div>
    </div>
  ),
];

function FeatureCard({ card, index }: { card: string; index: number }) {
  const hue = 24 + index * 22;
  const accent = `hsl(${hue}deg 85% 62%)`;
  const Scene = FEATURE_MOCKUP_SCENES[index % FEATURE_MOCKUP_SCENES.length];

  return (
    <motion.article
      className="group relative overflow-hidden bg-[#03040a]"
      style={{ cursor: 'default' }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 0.6, ease: EASE_CIRC, delay: index * 0.07 }}
    >
      {/* Preview image area */}
      <div
        className="relative h-44 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#060810' }}
      >
        {/* Scene content — scales slightly on hover */}
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.06 }}
          whileHover={{ scale: 1 }}
          transition={{ duration: 0.55, ease: EASE_CIRC }}
        >
          {Scene(accent)}
        </motion.div>
        {/* Overlay gradient — lifts on hover */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, #03040a 20%, transparent)' }}
          initial={{ opacity: 0.85 }}
          whileHover={{ opacity: 0.3 }}
          transition={{ duration: 0.45 }}
        />
        {/* Accent corner glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `radial-gradient(circle at 80% 20%, ${accent}16, transparent 60%)` }}
        />
      </div>

      {/* Text content */}
      <div className="p-6 sm:p-7 transition-colors hover:bg-white/[0.02]">
        <span
          className="font-mono text-[10px] font-bold tracking-widest"
          style={{ color: accent }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="mt-3 break-keep text-lg font-black text-white/85 transition-colors group-hover:text-white">
          {card}
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/32 transition-colors group-hover:text-white/50">
          고객 입력을 고객 기억과 운영 액션으로 연결합니다.
        </p>
        {/* Accent line draw */}
        <motion.div
          className="mt-4 h-[2px] rounded-full"
          style={{ background: accent }}
          initial={{ width: 0 }}
          whileHover={{ width: '100%' }}
          transition={{ duration: 0.45, ease: EASE_CIRC }}
        />
      </div>
    </motion.article>
  );
}

// ─── Animated Beam (Magic UI–style SVG path between two refs) ────────────────
function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 60,
  delay = 0,
  color = '#ec5b13',
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  fromRef: React.RefObject<HTMLElement | null>;
  toRef: React.RefObject<HTMLElement | null>;
  curvature?: number;
  delay?: number;
  color?: string;
}) {
  const [d, setD] = useState('');
  const idRef = useRef(`beam-${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    function recalc() {
      const from = fromRef.current;
      const to = toRef.current;
      const box = containerRef.current;
      if (!from || !to || !box) return;
      const cr = box.getBoundingClientRect();
      const fr = from.getBoundingClientRect();
      const tr = to.getBoundingClientRect();
      const x1 = fr.left - cr.left + fr.width / 2;
      const y1 = fr.top - cr.top + fr.height / 2;
      const x2 = tr.left - cr.left + tr.width / 2;
      const y2 = tr.top - cr.top + tr.height / 2;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - curvature;
      setD(`M${x1},${y1} Q${mx},${my} ${x2},${y2}`);
    }
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [fromRef, toRef, containerRef, curvature]);

  if (!d) return null;
  const gradId = idRef.current;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor={color} stopOpacity="0.85" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={d} stroke={`${color}20`} strokeWidth="1.5" fill="none" />
      <motion.path
        d={d}
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: '-5%' }}
        transition={{ duration: 1.6, ease: EASE_EXPO, delay }}
      />
    </svg>
  );
}

// ─── Main LandingPage ─────────────────────────────────────────────────────────
export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const vantaRef = useRef<any>(null);
  // refs for AnimatedBeam in stats section
  const statRef0 = useRef<HTMLDivElement>(null);
  const statRef1 = useRef<HTMLDivElement>(null);
  const statRef2 = useRef<HTMLDivElement>(null);
  const statsContainerRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll();
  const heroParallaxY = useTransform(scrollY, [0, 700], [0, -140]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => setMounted(true), []);

  // ── Vanta.js NET animated hero background ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !heroRef.current) return;
    let effect: any;
    (async () => {
      try {
        const [THREE, vantaMod] = await Promise.all([
          import('three'),
          // @ts-ignore
          import('vanta/dist/vanta.net.min'),
        ]);
        if (!heroRef.current) return;
        const NET = (vantaMod as any).default ?? vantaMod;
        effect = NET({
          el: heroRef.current,
          THREE,
          mouseControls: true,
          touchControls: false,
          gyroControls: false,
          color: 0xec5b13,
          backgroundColor: 0x03040a,
          points: 8.0,
          maxDistance: 22.0,
          spacing: 20.0,
          showDots: false,
        });
        vantaRef.current = effect;
      } catch (_) { /* Vanta optional — fail silently */ }
    })();
    return () => {
      vantaRef.current?.destroy();
      vantaRef.current = null;
    };
  }, []);

  // ── GSAP ScrollTrigger + Lenis integration ───────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = (window as any).__lenis;
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.lagSmoothing(0);
    }
    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

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
          02 · SERVICES — GSAP ScrollTrigger scrollytelling
      ════════════════════════════════════════════════════════════════ */}
      <FeatureScrollStory />

      {/* ════════════════════════════════════════════════════════════════
          STATS — giant numbers
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden bg-[#03040a] px-6 py-28 sm:px-10 lg:px-16"
        id="cases"
        ref={statsContainerRef as React.RefObject<HTMLElement>}
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

          <div className="relative grid divide-y divide-white/[0.06] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {/* Animated beams connecting the three stat blocks */}
            {mounted && (
              <>
                <AnimatedBeam
                  containerRef={statsContainerRef as React.RefObject<HTMLElement>}
                  fromRef={statRef0}
                  toRef={statRef1}
                  curvature={-50}
                  delay={0.5}
                  color="#ec5b13"
                />
                <AnimatedBeam
                  containerRef={statsContainerRef as React.RefObject<HTMLElement>}
                  fromRef={statRef1}
                  toRef={statRef2}
                  curvature={-50}
                  delay={0.8}
                  color="#3b82f6"
                />
              </>
            )}
            {[
              { value: 34, prefix: '+', suffix: '%', label: '재방문율', note: '고객 기억 활성화 후 평균', ref: statRef0 },
              { value: 52, prefix: '–', suffix: '%', label: '운영 응대 시간', note: '문의·예약 자동화 도입 후', ref: statRef1 },
              { value: 18, prefix: '+', suffix: '%', label: '객단가', note: '추천 메뉴 엔진 가동 매장', ref: statRef2 },
            ].map((stat, i) => (
              <FadeReveal key={stat.label} delay={i * 0.12} className="px-0 py-10 lg:px-12 lg:py-0">
                <div ref={stat.ref}>
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
                <p className="font-mono text-sm font-bold uppercase tracking-[0.35em] text-white/30">
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

            {/* Right: feature grid with preview images */}
            <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
              {featureCards.map((card, i) => (
                <FeatureCard key={card} card={card} index={i} />
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
