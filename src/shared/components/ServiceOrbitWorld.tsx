import { type CSSProperties, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { HOMEPAGE_SERVICE_NODES, type HomepageServiceNodeLabel } from '@/shared/lib/cinematicScenes';

const toneColor: Record<'blue' | 'orange' | 'purple', string> = {
  blue: '#60a5fa',
  orange: '#fb923c',
  purple: '#a78bfa',
};

const streamParticles = Array.from({ length: 28 }, (_, index) => ({
  delay: (index % 9) * 0.16,
  left: `${6 + ((index * 19) % 88)}%`,
  top: `${7 + ((index * 29) % 84)}%`,
}));

export function ServiceOrbitWorld({
  className = '',
  highlightLabels = [],
}: {
  className?: string;
  highlightLabels?: HomepageServiceNodeLabel[];
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [hoveredLabel, setHoveredLabel] = useState<HomepageServiceNodeLabel | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const activeLabels = useMemo(() => new Set(highlightLabels), [highlightLabels]);
  const selectedLabel = hoveredLabel ?? highlightLabels[0] ?? '고객 기억';
  const selectedNode = HOMEPAGE_SERVICE_NODES.find((node) => node.label === selectedLabel) ?? HOMEPAGE_SERVICE_NODES[6];

  return (
    <div
      className={[
        'relative isolate min-h-[35rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#030712] text-white shadow-[0_34px_120px_-60px_rgba(15,23,42,0.94)]',
        className,
      ].join(' ')}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      data-service-orbit-world="hero"
      data-service-orbit-selected={selectedNode.label}
      onPointerLeave={() => {
        setHoveredLabel(null);
        setPointer({ x: 0, y: 0 });
      }}
      onPointerMove={(event) => {
        if (prefersReducedMotion) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: (event.clientX - rect.left) / rect.width - 0.5,
          y: (event.clientY - rect.top) / rect.height - 0.5,
        });
      }}
    >
      <motion.div
        animate={{
          x: prefersReducedMotion ? 0 : pointer.x * 18,
          y: prefersReducedMotion ? 0 : pointer.y * 18,
        }}
        className="absolute inset-[-8%] bg-[radial-gradient(circle_at_50%_44%,rgba(96,165,250,0.24),transparent_21%),radial-gradient(circle_at_63%_49%,rgba(251,146,60,0.22),transparent_20%),radial-gradient(circle_at_44%_58%,rgba(167,139,250,0.18),transparent_23%),linear-gradient(130deg,#02050a_0%,#071223_54%,#02050a_100%)]"
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.7)_0.7px,transparent_0.8px)] [background-size:38px_38px]" />
      <div className="absolute inset-x-[-12%] bottom-[-14%] h-44 rotate-[-6deg] bg-[radial-gradient(ellipse_at_center,rgba(251,146,60,0.28),transparent_48%),linear-gradient(90deg,transparent,rgba(96,165,250,0.26),rgba(251,146,60,0.32),transparent)] blur-sm" />

      {streamParticles.map((particle, index) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          animate={{
            opacity: prefersReducedMotion ? 0.35 : [0.12, 0.72, 0.18],
            scale: prefersReducedMotion ? 1 : [0.7, 1.24, 0.82],
            y: prefersReducedMotion ? 0 : [0, index % 2 === 0 ? -16 : 14, 0],
          }}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.76)]"
          style={{ left: particle.left, top: particle.top }}
          transition={{
            delay: particle.delay,
            duration: 4.8 + (index % 5) * 0.38,
            ease: 'easeInOut',
            repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
          }}
        />
      ))}

      <svg aria-hidden className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="orbit-core-glow">
            <stop offset="0%" stopColor="rgba(255,255,255,0.96)" />
            <stop offset="54%" stopColor="rgba(251,146,60,0.52)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.06)" />
          </radialGradient>
        </defs>
        <ellipse cx="52" cy="49" rx="31" ry="19" stroke="rgba(125,211,252,0.32)" strokeWidth="0.32" />
        <ellipse cx="52" cy="49" rx="33" ry="20" stroke="rgba(251,146,60,0.24)" strokeWidth="0.28" transform="rotate(34 52 49)" />
        <ellipse cx="52" cy="49" rx="30" ry="18" stroke="rgba(167,139,250,0.25)" strokeWidth="0.28" transform="rotate(-28 52 49)" />
        {HOMEPAGE_SERVICE_NODES.map((node) => {
          const active = hoveredLabel === node.label || activeLabels.has(node.label);
          return (
            <motion.path
              key={node.label}
              animate={{ opacity: active ? 0.82 : 0.24, pathLength: active ? 1 : 0.62 }}
              d={`M 52 49 C ${node.x} ${node.y}, ${node.x} ${node.y}, ${node.x} ${node.y}`}
              stroke={toneColor[node.tone]}
              strokeLinecap="round"
              strokeWidth={active ? 0.6 : 0.28}
              transition={{ duration: prefersReducedMotion ? 0.16 : 0.46, ease: 'easeOut' }}
            />
          );
        })}
      </svg>

      <motion.div
        animate={{
          boxShadow: prefersReducedMotion
            ? '0 0 86px rgba(251,146,60,0.38)'
            : [
                '0 0 72px rgba(96,165,250,0.3)',
                '0 0 118px rgba(251,146,60,0.56)',
                '0 0 82px rgba(167,139,250,0.38)',
              ],
          scale: hoveredLabel ? 1.04 : 1,
        }}
        className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/18 bg-white/[0.035] backdrop-blur-sm"
        transition={{ duration: prefersReducedMotion ? 0.16 : 3.8, ease: 'easeInOut', repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY }}
      >
        <motion.div
          animate={{ rotate: prefersReducedMotion ? 0 : 360 }}
          className="absolute inset-3 rounded-full border border-white/10"
          transition={{ duration: 16, ease: 'linear', repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY }}
        />
        <motion.div
          animate={{ rotate: prefersReducedMotion ? 0 : -360 }}
          className="absolute inset-9 rounded-full border border-orange-300/24"
          transition={{ duration: 11, ease: 'linear', repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY }}
        />
        <div className="absolute inset-[38%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98),rgba(251,146,60,0.76)_42%,rgba(96,165,250,0.12)_100%)] shadow-[0_0_54px_rgba(251,146,60,0.82)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-white/14 bg-[#080f1d]/72 px-4 py-2 font-display text-2xl font-black tracking-[-0.08em] text-orange-300 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.9)]">
            MyBiz
          </span>
        </div>
      </motion.div>

      {HOMEPAGE_SERVICE_NODES.map((node, index) => {
        const active = hoveredLabel === node.label || activeLabels.has(node.label);
        const style = {
          '--node-color': toneColor[node.tone],
          left: `${node.x}%`,
          top: `${node.y}%`,
        } as CSSProperties;

        return (
          <motion.button
            key={node.label}
            animate={{
              opacity: active || !hoveredLabel ? 1 : 0.58,
              scale: active ? 1.06 : 1,
              y: prefersReducedMotion ? 0 : [0, index % 2 === 0 ? -4 : 4, 0],
            }}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/14 bg-[#07101d]/78 px-3.5 py-2.5 text-left text-xs font-bold text-white shadow-[0_18px_50px_-34px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-[var(--node-color)] focus:outline-none focus:ring-2 focus:ring-orange-300/70"
            data-service-orbit-node={node.label}
            onBlur={() => setHoveredLabel(null)}
            onFocus={() => setHoveredLabel(node.label)}
            onMouseEnter={() => setHoveredLabel(node.label)}
            style={style}
            transition={{
              duration: prefersReducedMotion ? 0.16 : 5.4 + index * 0.12,
              ease: 'easeInOut',
              repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
            }}
            type="button"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--node-color)] shadow-[0_0_16px_var(--node-color)]" />
              {node.label}
            </span>
          </motion.button>
        );
      })}

      <div className="absolute bottom-5 left-5 right-5 z-20 rounded-3xl border border-white/12 bg-[#050b14]/78 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] text-orange-300">실시간 MyBiz 월드</p>
            <p className="mt-2 break-keep text-sm font-bold leading-6 text-white">{selectedNode.label}</p>
          </div>
          <span className="rounded-full border border-emerald-300/24 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
            실시간 동기화 중
          </span>
        </div>
        <p className="mt-2 break-keep text-xs leading-5 text-slate-300">{selectedNode.description}</p>
      </div>
    </div>
  );
}
