/**
 * DemoDashboardPage — Read-only demo for prospective merchants.
 * Dark theme matching the landing page. AI-driven hooks to convert visitors.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { usePageMeta } from '@/shared/hooks/usePageMeta';

// ─── Easing (matching landing page) ──────────────────────────────────────────
const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_CIRC = [0.22, 1, 0.36, 1] as const;

// ─── Chart data ──────────────────────────────────────────────────────────────
const WEEKLY_DATA = [
  { day: '월', 예약: 4, 웨이팅: 3, 주문: 18 },
  { day: '화', 예약: 6, 웨이팅: 5, 주문: 24 },
  { day: '수', 예약: 5, 웨이팅: 4, 주문: 21 },
  { day: '목', 예약: 8, 웨이팅: 7, 주문: 32 },
  { day: '금', 예약: 11, 웨이팅: 9, 주문: 42 },
  { day: '토', 예약: 14, 웨이팅: 12, 주문: 58 },
  { day: '일', 예약: 10, 웨이팅: 8, 주문: 46 },
];

const RETENTION_DATA = [
  { week: '4주전', 재방문율: 54 },
  { week: '3주전', 재방문율: 61 },
  { week: '2주전', 재방문율: 68 },
  { week: '지난주', 재방문율: 74 },
  { week: '이번주', 재방문율: 82 },
];

// ─── Custom chart tooltip ────────────────────────────────────────────────────
type ChartTooltipPayload = {
  color?: string;
  dataKey?: string | number;
  value?: string | number;
};

function DarkTooltip({ active, payload, label }: { active?: boolean; label?: string | number; payload?: ChartTooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1525] px-4 py-3 text-xs shadow-2xl">
      <p className="mb-2 font-bold text-white/60">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-bold" style={{ color: p.color }}>
          {p.dataKey}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Required by tests ────────────────────────────────────────────────────────
const readonlyMessage =
  '데모 화면에서는 저장되지 않습니다. 무료로 시작하면 실제 매장을 관리할 수 있습니다.';

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        setVal(Math.round(target * ease));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay]);
  return val;
}

// ─── AI Insight Rotator ──────────────────────────────────────────────────────
const AI_INSIGHTS = [
  'AI가 오늘 점심 피크(12:30–14:00)를 예측합니다. 웨이팅 대응을 미리 준비하세요.',
  '김하린 고객의 재방문 가능성이 84%입니다. 맞춤 메뉴를 추천할 타이밍입니다.',
  '이번 주 QR 주문 전환율이 +23% 상승 중입니다. 추천 메뉴 배너 효과가 작동 중입니다.',
  '오늘 예약 고객 6명에게 맞춤 안내 메시지를 발송할 수 있습니다.',
  '고객 기억 데이터 기반: 이번 주 예상 재방문 매출 ₩284,000 이상입니다.',
];

function AIInsightBanner() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % AI_INSIGHTS.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4"
      style={{
        background: 'linear-gradient(135deg, rgba(236,91,19,0.12) 0%, rgba(251,146,60,0.06) 100%)',
        border: '1px solid rgba(236,91,19,0.25)',
      }}
    >
      {/* Pulsing dot */}
      <div className="relative shrink-0">
        <div className="h-2.5 w-2.5 rounded-full bg-[#ec5b13]" />
        <div
          className="absolute inset-0 rounded-full bg-[#ec5b13]"
          style={{ animation: 'ai-ping 1.8s ease-out infinite' }}
        />
      </div>

      <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#ec5b13]/70">
        AI 분석
      </p>

      <div className="h-4 w-px bg-white/10" />

      <AnimatePresence mode="wait">
        {visible && (
          <motion.p
            key={idx}
            className="break-keep text-sm leading-6 text-white/75"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE_CIRC }}
          >
            {AI_INSIGHTS[idx]}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <motion.div
        key={idx}
        className="absolute bottom-0 left-0 h-[2px] rounded-full"
        style={{ background: 'linear-gradient(90deg, #ec5b13, #fb923c)' }}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: 4, ease: 'linear' }}
      />
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MetricCard({
  label, value, unit, note, accent, trend, delay,
}: {
  label: string; value: number; unit: string; note: string;
  accent: string; trend?: string; delay?: number;
}) {
  const count = useCountUp(value, 1200, (delay ?? 0) + 300);
  return (
    <motion.article
      className="relative overflow-hidden rounded-3xl p-6"
      style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE_EXPO, delay: (delay ?? 0) / 1000 + 0.2 }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20"
        style={{ background: accent, filter: 'blur(32px)' }}
      />
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">{label}</p>
      <p
        className="mt-3 font-display font-black leading-none"
        style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', color: accent }}
      >
        {count}
        <span className="ml-1 text-xl font-bold text-white/50">{unit}</span>
      </p>
      <p className="mt-2 text-sm text-white/40">{note}</p>
      {trend && (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/60">
          ↑ {trend}
        </p>
      )}
    </motion.article>
  );
}

// ─── Customer memory card ─────────────────────────────────────────────────────
function CustomerCard({
  name, summary, tag, tags, delay,
}: {
  name: string; summary: string; tag: string;
  tags: string[]; delay: number;
}) {
  const [hovered, setHovered] = useState(false);
  const accentColors: Record<string, string> = {
    재방문: '#ec5b13', 예약: '#3b82f6', 추천: '#a855f7',
  };
  const accent = accentColors[tag] ?? '#ec5b13';

  return (
    <motion.article
      className="relative overflow-hidden rounded-3xl p-5 transition-all duration-300"
      style={{
        background: hovered ? '#0d1525' : '#060810',
        border: `1px solid ${hovered ? accent + '40' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered ? `0 0 40px ${accent}18` : 'none',
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: EASE_EXPO, delay }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Avatar */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-black text-white"
            style={{ background: `linear-gradient(135deg, ${accent}60, ${accent}20)` }}
          >
            {name[0]}
          </div>
          <h3 className="font-display text-lg font-black text-white">{name}</h3>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: `${accent}20`, color: accent }}
        >
          {tag}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/50">{summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white/40"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            {t}
          </span>
        ))}
      </div>
      {hovered && (
        <motion.div
          className="mt-3 flex items-center gap-2 rounded-2xl p-3"
          style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-lg">🤖</span>
          <p className="text-xs text-white/55">AI 추천: 다음 방문 시 맞춤 메뉴 제안 예정</p>
        </motion.div>
      )}
    </motion.article>
  );
}

// ─── Operation item ───────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  '답변 대기': { bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
  확정: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
  '호출 준비': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  '제조 중': { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
};

// ─── Live Activity Feed ───────────────────────────────────────────────────────
const LIVE_EVENTS = [
  { channel: '문의', title: '브런치 단체석 문의', status: '답변 대기', time: '10:24', icon: '💬' },
  { channel: '예약', title: '4명 창가석 예약', status: '확정', time: '11:30', icon: '📅' },
  { channel: '웨이팅', title: '2명 대기 등록', status: '호출 준비', time: '12:08', icon: '⏳' },
  { channel: 'QR 주문', title: '아메리카노 2, 크루아상 1', status: '제조 중', time: '12:16', icon: '🧾' },
];

function LiveFeed({ onReadonly }: { onReadonly: () => void }) {
  const [newBadge, setNewBadge] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setNewBadge(true), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
            <div
              className="absolute inset-0 rounded-full bg-[#4ade80]"
              style={{ animation: 'ai-ping 1.6s ease-out infinite' }}
            />
          </div>
          <h2 className="font-display text-2xl font-black text-white">오늘의 운영</h2>
          {newBadge && (
            <motion.span
              className="rounded-full bg-[#ec5b13] px-2.5 py-0.5 text-xs font-black text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 16 }}
            >
              NEW
            </motion.span>
          )}
        </div>
        <button
          className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white/40 transition hover:text-white/70"
          onClick={onReadonly}
          type="button"
        >
          상태 변경
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LIVE_EVENTS.map((item, i) => {
          const s = STATUS_STYLES[item.status] ?? { bg: 'rgba(255,255,255,0.08)', color: '#fff' };
          return (
            <motion.article
              key={`${item.channel}-${item.time}`}
              className="rounded-3xl p-4"
              style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_EXPO, delay: 0.3 + i * 0.07 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <p className="text-xs font-black text-white/50">{item.channel}</p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{ background: s.bg, color: s.color }}
                >
                  {item.status}
                </span>
              </div>
              <h3 className="mt-2 font-bold text-white/85">{item.title}</h3>
              <p className="mt-1 text-xs text-white/30">{item.time}</p>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

// ─── Revenue Intelligence ─────────────────────────────────────────────────────
function RevenueIntelligence() {
  const est = useCountUp(284000, 1600, 800);
  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl p-8"
      style={{
        background: 'linear-gradient(135deg, #060810 0%, #0d1a2a 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, ease: EASE_EXPO, delay: 0.5 }}
    >
      <div
        className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full"
        style={{ background: 'rgba(59,130,246,0.08)', filter: 'blur(50px)' }}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {/* Column 1: 고객 기억 */}
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#3b82f6]/60">고객 기억</p>
          <p className="mt-3 font-display text-4xl font-black text-white">128<span className="text-xl text-white/40">명</span></p>
          <p className="mt-2 text-sm text-white/40">이번 주 방문 기록됨</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <motion.div
            className="font-display text-3xl text-[#3b82f6]/40"
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            →
          </motion.div>
        </div>

        {/* Column 2: 재방문 예측 */}
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#a855f7]/60">AI 재방문 예측</p>
          <p className="mt-3 font-display text-4xl font-black text-white">24<span className="text-xl text-white/40">명</span></p>
          <p className="mt-2 text-sm text-white/40">3일 내 재방문 후보</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <motion.div
            className="font-display text-3xl text-[#a855f7]/40"
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut', delay: 0.4 }}
          >
            →
          </motion.div>
        </div>

        {/* Column 3: 예상 매출 */}
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#ec5b13]/60">예상 재방문 매출</p>
          <p className="mt-3 font-display text-4xl font-black" style={{ color: '#ec5b13' }}>
            ₩{est.toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-white/40">이번 주 추정치</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/[0.04] px-5 py-3">
        <p className="text-xs text-white/35">
          🤖 <strong className="text-white/55">AI 분석</strong> — 고객 기억에 기록된 방문 패턴과 주문 이력을 기반으로 산출된 예측값입니다.
          실제 매장 데이터로 시작하면 정밀도가 더 높아집니다.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DemoDashboardPage() {
  usePageMeta(
    'MyBiz 운영 대시보드 체험',
    '실제 데이터 없이 MyBiz 점주 화면의 고객 기억, 문의, 예약, 웨이팅, QR 주문 흐름을 둘러봅니다.',
  );

  function showReadonly() {
    toast('🔒 ' + readonlyMessage, {
      duration: 3500,
      style: { background: '#1a1a2e', border: '1px solid rgba(236,91,19,0.3)', color: '#fff' },
    });
  }

  // Metric counts
  const memCount = useCountUp(128, 1200, 200);
  const resCount = useCountUp(18, 900, 350);
  const waitCount = useCountUp(9, 700, 450);
  const qrCount = useCountUp(42, 1100, 550);

  return (
    <main
      className="min-h-screen overflow-x-hidden"
      data-demo-dashboard="readonly"
      style={{ background: '#03040a', color: '#fff' }}
    >
      {/* ── CSS keyframe for ping animation ── */}
      <style>{`
        @keyframes ai-ping {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>


      <div className="mx-auto max-w-[90rem] px-6 py-10 sm:px-10 lg:px-16">

        {/* ── Static readonly notice (required by tests + a11y) ── */}
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-3 text-sm text-white/50"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className="text-base">🔒</span>
          <p>{readonlyMessage}</p>
        </div>

        {/* ── Header ── */}
        <motion.div
          className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_EXPO }}
        >
          <div className="flex items-center gap-4">
            {/* Store avatar */}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black"
              style={{ background: 'linear-gradient(135deg, #ec5b13, #fb923c)', boxShadow: '0 0 32px rgba(236,91,19,0.4)' }}
            >
              ☕
            </div>
            <div>
              <h1 className="font-display text-2xl font-black text-white">서울 단골 커피</h1>
              <div className="mt-1 flex items-center gap-2">
                <div className="relative h-2 w-2">
                  <div className="h-2 w-2 rounded-full bg-[#4ade80]" />
                  <div
                    className="absolute inset-0 rounded-full bg-[#4ade80]"
                    style={{ animation: 'ai-ping 1.6s ease-out infinite' }}
                  />
                </div>
                <p className="text-sm text-white/45">AI 운영 중 · 데모 모드</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest text-[#ec5b13]"
              style={{ background: 'rgba(236,91,19,0.12)', border: '1px solid rgba(236,91,19,0.25)' }}
            >
              Demo
            </span>
            <Link
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90"
              style={{ background: '#ec5b13', boxShadow: '0 0 32px rgba(236,91,19,0.4)' }}
              to="/onboarding?plan=free"
            >
              무료로 시작하기 →
            </Link>
          </div>
        </motion.div>

        {/* ── AI Insight banner ── */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <AIInsightBanner />
        </motion.div>

        {/* ── 4 Metrics ── */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: '이번 주 고객 기억', val: memCount, unit: '명', note: '재방문 후보 24명', accent: '#ec5b13', trend: '+18%' },
            { label: '예약', val: resCount, unit: '건', note: '오늘 확정 6건', accent: '#3b82f6', trend: '+4건' },
            { label: '웨이팅', val: waitCount, unit: '팀', note: '평균 대기 14분', accent: '#a855f7' },
            { label: 'QR 주문', val: qrCount, unit: '건', note: '추천 메뉴 포함 17건', accent: '#10b981', trend: '+23%' },
          ].map((m, i) => (
            <motion.article
              key={m.label}
              className="relative overflow-hidden rounded-3xl p-6"
              style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.2 + i * 0.07 }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20"
                style={{ background: m.accent, filter: 'blur(32px)' }}
              />
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">{m.label}</p>
              <p className="mt-3 font-display font-black leading-none" style={{ fontSize: 'clamp(2rem,3.5vw,3rem)', color: m.accent }}>
                {m.val}<span className="ml-1 text-lg font-bold text-white/40">{m.unit}</span>
              </p>
              <p className="mt-2 text-sm text-white/40">{m.note}</p>
              {m.trend && (
                <span
                  className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{ background: `${m.accent}18`, color: m.accent }}
                >
                  ↑ {m.trend}
                </span>
              )}
            </motion.article>
          ))}
        </section>

        {/* ── Charts: Weekly Trend + Retention ── */}
        <section className="mb-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* Weekly ops area chart */}
          <motion.div
            className="rounded-3xl p-6 sm:p-8"
            style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_EXPO, delay: 0.35 }}
          >
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">Weekly Operations</p>
            <h2 className="mt-2 mb-6 font-display text-2xl font-black text-white">이번 주 운영 현황</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={WEEKLY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOrder" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec5b13" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ec5b13" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gWait" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="주문" stroke="#ec5b13" strokeWidth={2} fill="url(#gOrder)" dot={false} />
                <Area type="monotone" dataKey="예약" stroke="#3b82f6" strokeWidth={2} fill="url(#gRes)" dot={false} />
                <Area type="monotone" dataKey="웨이팅" stroke="#a855f7" strokeWidth={2} fill="url(#gWait)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#ec5b13]" />주문</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#3b82f6]" />예약</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#a855f7]" />웨이팅</span>
            </div>
          </motion.div>

          {/* Retention bar chart */}
          <motion.div
            className="rounded-3xl p-6 sm:p-8"
            style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_EXPO, delay: 0.45 }}
          >
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">AI Retention</p>
            <h2 className="mt-2 mb-6 font-display text-2xl font-black text-white">재방문율 추세</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={RETENTION_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} unit="%" />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="재방문율" radius={[6, 6, 0, 0]}>
                  {RETENTION_DATA.map((_, i) => (
                    <Cell key={i} fill={i === RETENTION_DATA.length - 1 ? '#fb923c' : 'rgba(236,91,19,0.55)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-white/30">🤖 고객 기억 누적 → 재방문율 +28%p 향상</p>
          </motion.div>
        </section>

        {/* ── Customer memory + Live ops ── */}
        <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">

          {/* 고객 기억 */}
          <div
            className="rounded-3xl p-6"
            style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-black text-white">고객 기억</h2>
              <button
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white/40 transition hover:text-white/70"
                onClick={showReadonly}
                type="button"
              >
                메모 저장
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  name: '김하린',
                  summary: '라떼, 창가석 선호. 최근 3회 방문.',
                  tag: '재방문',
                  tags: ['라떼', '창가석', '오전'],
                },
                {
                  name: '박지훈',
                  summary: '점심 시간 예약 선호. 단체 문의 2회.',
                  tag: '예약',
                  tags: ['점심', '단체', '예약'],
                },
                {
                  name: '이서연',
                  summary: '디카페인 요청. 쿠폰 반응 높음.',
                  tag: '추천',
                  tags: ['디카페인', '쿠폰', 'VIP'],
                },
              ].map((c, i) => (
                <CustomerCard key={c.name} {...c} delay={0.25 + i * 0.08} />
              ))}
            </div>
          </div>

          {/* Live ops */}
          <div
            className="rounded-3xl p-6"
            style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <LiveFeed onReadonly={showReadonly} />
          </div>
        </section>

        {/* ── 고객 타임라인 ── */}
        <section
          className="mb-8 rounded-3xl p-6 sm:p-8"
          style={{ background: '#060810', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">Customer timeline</p>
              <h2 className="mt-2 font-display text-2xl font-black text-white">고객 타임라인</h2>
            </div>
            <button
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white/40 transition hover:text-white/70"
              onClick={showReadonly}
              type="button"
            >
              후속 액션 만들기
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              '김하린 고객이 라떼를 다시 주문했습니다.',
              '박지훈 고객의 단체 예약 문의가 생성되었습니다.',
              '이서연 고객에게 디카페인 추천 메모가 연결되었습니다.',
              '테이블 7번 주문이 고객 기억에 안전하게 묶였습니다.',
            ].map((item, i) => (
              <motion.article
                key={item}
                className="flex items-start gap-4 rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: EASE_EXPO, delay: 0.4 + i * 0.08 }}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                  style={{ background: 'rgba(236,91,19,0.2)', color: '#fb923c' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-sm leading-6 text-white/60">{item}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* ── Revenue Intelligence ── */}
        <section className="mb-8">
          <RevenueIntelligence />
        </section>

        {/* ── Conversion CTA ── */}
        <motion.section
          className="relative overflow-hidden rounded-3xl p-10 text-center sm:p-16"
          style={{
            background: 'linear-gradient(135deg, rgba(236,91,19,0.15) 0%, rgba(251,146,60,0.06) 50%, rgba(168,85,247,0.08) 100%)',
            border: '1px solid rgba(236,91,19,0.3)',
          }}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE_EXPO, delay: 0.6 }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 100%, rgba(236,91,19,0.25), transparent)' }}
          />
          <p className="relative font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#ec5b13]/70">
            지금 바로 시작하기
          </p>
          <h2
            className="relative mt-4 break-keep font-display font-black text-white"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', lineHeight: 1.1, letterSpacing: '-0.03em' }}
          >
            이 화면이 실제 매장 데이터로<br />채워집니다
          </h2>
          <p className="relative mt-5 break-keep text-base leading-7 text-white/45">
            결제 없이 FREE 플랜으로 시작하면 고객 기억, 문의·예약·웨이팅·QR 주문이<br className="hidden sm:block" />
            하나의 타임라인으로 연결됩니다.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-black text-white transition hover:opacity-90"
              style={{ background: '#ec5b13', boxShadow: '0 0 48px rgba(236,91,19,0.5)' }}
              to="/onboarding?plan=free"
            >
              무료로 시작하기 →
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-8 py-4 text-base font-bold text-white/65 transition hover:text-white"
              to="/features"
            >
              기능 더 보기
            </Link>
          </div>
        </motion.section>

      </div>
    </main>
  );
}
