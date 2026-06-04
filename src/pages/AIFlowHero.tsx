/**
 * AIFlowHero.tsx
 *
 * 히어로 배경 비주얼: "고객 → AI 분석 → SNS/콘텐츠 발행" 스토리 흐름
 *
 * - WebGL/Three.js 없음 → 모든 브라우저 호환
 * - CSS keyframes + SVG + Framer Motion 만 사용
 * - 신경망 노드 펄스, 데이터 흐름 라인, 결과 카드 팝인
 * - Vanta.js 737KB 청크 완전 제거
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── 데이터 흐름 사이클 ────────────────────────────────────────────────────────
const FLOW_STEPS = [
  { id: 'visit',    icon: '📱', label: '고객 방문', sublabel: 'QR · 예약 · 주문', color: '#ec5b13' },
  { id: 'memory',   icon: '💾', label: '고객 기억',  sublabel: '방문·선호 기록',   color: '#3b82f6' },
  { id: 'ai',       icon: '🧠', label: 'AI 분석',   sublabel: '패턴 · 인사이트',  color: '#a855f7' },
  { id: 'content',  icon: '✍️', label: '콘텐츠 생성', sublabel: 'SNS 문안 자동작성', color: '#10b981' },
  { id: 'publish',  icon: '📢', label: 'SNS 발행',  sublabel: 'Instagram · YouTube', color: '#f59e0b' },
];

const OUTPUT_CARDS = [
  { icon: '📸', label: 'Instagram', sub: '사진 + 캡션 자동 게시', color: '#e1306c' },
  { icon: '▶️', label: 'YouTube',   sub: '영상 + 자막 업로드',    color: '#ff0000' },
  { icon: '🟢', label: 'Naver Blog', sub: '블로그 글 자동 발행',   color: '#03C75A' },
  { icon: '🧵', label: 'Threads',   sub: '스레드 자동 게시',       color: '#000000' },
];

// ─── 신경망 노드 좌표 (SVG 뷰박스 200×160 기준) ─────────────────────────────
const NODES = [
  { id: 'n0', x: 30, y: 40, r: 3.5 },
  { id: 'n1', x: 55, y: 20, r: 3 },
  { id: 'n2', x: 55, y: 60, r: 3 },
  { id: 'n3', x: 80, y: 35, r: 4 },
  { id: 'n4', x: 80, y: 75, r: 3 },
  { id: 'n5', x: 100, y: 20, r: 2.5 },
  { id: 'n6', x: 100, y: 50, r: 4.5 }, // center hub
  { id: 'n7', x: 100, y: 85, r: 2.5 },
  { id: 'n8', x: 120, y: 35, r: 3 },
  { id: 'n9', x: 120, y: 65, r: 3 },
  { id: 'n10', x: 145, y: 25, r: 3.5 },
  { id: 'n11', x: 145, y: 55, r: 3 },
  { id: 'n12', x: 145, y: 85, r: 3 },
  { id: 'n13', x: 170, y: 40, r: 3 },
  { id: 'n14', x: 170, y: 70, r: 3 },
];

const EDGES = [
  ['n0','n1'],['n0','n2'],['n1','n3'],['n2','n3'],['n2','n4'],
  ['n3','n5'],['n3','n6'],['n4','n6'],['n4','n7'],
  ['n5','n6'],['n6','n7'],['n6','n8'],['n6','n9'],
  ['n8','n10'],['n8','n11'],['n9','n11'],['n9','n12'],
  ['n10','n13'],['n11','n13'],['n11','n14'],['n12','n14'],
];

// 노드 맵
const nodeMap = new Map(NODES.map((n) => [n.id, n]));

function getEdge(from: string, to: string) {
  const a = nodeMap.get(from)!;
  const b = nodeMap.get(to)!;
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

// ─── 여행하는 파티클 (SVG에서 path를 따라 이동) ──────────────────────────────
function FlowParticle({ edge, delay, color }: { edge: [string,string]; delay: number; color: string }) {
  const a = nodeMap.get(edge[0])!;
  const b = nodeMap.get(edge[1])!;
  return (
    <motion.circle
      r={1.5}
      fill={color}
      initial={{ x: a.x, y: a.y, opacity: 0 }}
      animate={{
        x: [a.x, b.x],
        y: [a.y, b.y],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 1.4,
        delay,
        repeat: Infinity,
        repeatDelay: 3 + Math.random() * 4,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── 신경망 SVG ──────────────────────────────────────────────────────────────
function NeuralNetwork({ activeColor }: { activeColor: string }) {
  return (
    <svg
      viewBox="0 0 200 110"
      className="h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      {/* Edges */}
      {EDGES.map(([from, to]) => (
        <motion.path
          key={`${from}-${to}`}
          d={getEdge(from, to)}
          stroke={`${activeColor}28`}
          strokeWidth={0.6}
          fill="none"
          animate={{ stroke: [`${activeColor}18`, `${activeColor}40`, `${activeColor}18`] }}
          transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 3 }}
        />
      ))}

      {/* Flow particles — 10 travelling dots */}
      {EDGES.slice(0, 10).map(([from, to], i) => (
        <FlowParticle
          key={`particle-${i}`}
          edge={[from, to] as [string,string]}
          delay={i * 0.7}
          color={activeColor}
        />
      ))}

      {/* Nodes */}
      {NODES.map((node) => (
        <g key={node.id}>
          {/* Glow ring */}
          <motion.circle
            cx={node.x} cy={node.y} r={node.r * 2.2}
            fill={`${activeColor}12`}
            animate={{ r: [node.r * 2, node.r * 3, node.r * 2], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 }}
          />
          {/* Core */}
          <motion.circle
            cx={node.x} cy={node.y} r={node.r}
            fill={node.id === 'n6' ? activeColor : `${activeColor}88`}
            animate={{
              opacity: node.id === 'n6' ? [0.9, 1, 0.9] : [0.4, 0.9, 0.4],
              r: node.id === 'n6' ? [node.r, node.r * 1.3, node.r] : [node.r * 0.9, node.r, node.r * 0.9],
            }}
            transition={{ duration: 1.5 + Math.random() * 2, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 1.5 }}
          />
        </g>
      ))}
    </svg>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function AIFlowHero() {
  const [activeStep, setActiveStep] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 단계를 순환 (0→1→2→3→4→0)
    intervalRef.current = setInterval(() => {
      setActiveStep((prev) => {
        const next = (prev + 1) % FLOW_STEPS.length;
        setShowOutput(next === FLOW_STEPS.length - 1); // publish 단계에서 카드 표시
        return next;
      });
    }, 2200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const step = FLOW_STEPS[activeStep];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>

      {/* ── 배경 ambient glow (activeColor 연동) ── */}
      <motion.div
        className="absolute inset-0"
        animate={{ background: `radial-gradient(ellipse 70% 60% at 65% 50%, ${step.color}12, transparent 65%)` }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
      />

      {/* ── 우측 신경망 비주얼 (lg 이상에서만 표시) ── */}
      <div
        className="absolute hidden lg:block"
        style={{ right: '-4%', top: '50%', transform: 'translateY(-50%)', width: '50vw', maxWidth: '680px', height: '55vh', opacity: 0.65 }}
      >
        <NeuralNetwork activeColor={step.color} />
      </div>

      {/* ── 흐름 스텝 인디케이터 (우측 하단) ── */}
      <div className="absolute bottom-16 right-6 hidden flex-col items-end gap-3 lg:flex" style={{ zIndex: 2 }}>
        {FLOW_STEPS.map((s, i) => (
          <motion.div
            key={s.id}
            className="flex items-center gap-2.5"
            animate={{ opacity: i === activeStep ? 1 : 0.22, x: i === activeStep ? 0 : 8 }}
            transition={{ duration: 0.4 }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: i === activeStep ? s.color : 'rgba(255,255,255,0.4)' }}
            >
              {s.label}
            </span>
            <motion.div
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
              style={{
                background: i === activeStep ? `${s.color}22` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${i === activeStep ? s.color + '60' : 'rgba(255,255,255,0.08)'}`,
              }}
              animate={{ scale: i === activeStep ? 1.15 : 1 }}
              transition={{ duration: 0.3 }}
            >
              {s.icon}
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* ── 현재 단계 레이블 (중앙 하단 — 모바일) ── */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 lg:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 backdrop-blur-sm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-sm">{step.icon}</span>
            <span className="text-xs font-bold" style={{ color: step.color }}>{step.label}</span>
            <span className="text-xs text-white/40">{step.sublabel}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── SNS 발행 결과 카드 (publish 단계) ── */}
      <AnimatePresence>
        {showOutput && (
          <div
            className="absolute hidden lg:flex flex-col gap-2.5"
            style={{ right: '3%', top: '50%', transform: 'translateY(-50%)', zIndex: 3 }}
          >
            {OUTPUT_CARDS.map((card, i) => (
              <motion.div
                key={card.label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-2.5 backdrop-blur-md"
                initial={{ opacity: 0, x: 32, scale: 0.88 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.9 }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="text-xl">{card.icon}</span>
                <div>
                  <p className="text-xs font-black text-white/90">{card.label}</p>
                  <p className="text-[10px] text-white/40">{card.sub}</p>
                </div>
                <motion.div
                  className="ml-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: card.color }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── 흐르는 연결선 (텍스트 → 신경망) lg만 ── */}
      <svg
        className="absolute hidden lg:block"
        style={{ inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.18 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={step.color} stopOpacity="0" />
            <stop offset="50%" stopColor={step.color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={step.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Horizontal connecting lines at various heights */}
        {[28, 42, 56, 70].map((pct, i) => (
          <motion.line
            key={i}
            x1="35%" y1={`${pct}%`}
            x2="62%" y2={`${pct}%`}
            stroke="url(#lineGrad)"
            strokeWidth={0.8}
            animate={{ opacity: [0.3, 0.8, 0.3], strokeDashoffset: [100, 0, -100] }}
            strokeDasharray="8 4"
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'linear', delay: i * 0.6 }}
          />
        ))}
      </svg>

    </div>
  );
}
