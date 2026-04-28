import { type CSSProperties, useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import {
  CINEMATIC_CHANNEL_LABELS,
  getCinematicScene,
  type CinematicChannelLabel,
} from '@/shared/lib/cinematicScenes';

const channelPositions: Record<CinematicChannelLabel, { left: string; top: string }> = {
  결제: { left: '20%', top: '70%' },
  문의: { left: '15%', top: '30%' },
  상담: { left: '29%', top: '54%' },
  예약: { left: '28%', top: '18%' },
  웨이팅: { left: '12%', top: '54%' },
  주문: { left: '34%', top: '36%' },
};

const particlePositions = Array.from({ length: 22 }, (_, index) => ({
  delay: (index % 7) * 0.18,
  left: `${8 + ((index * 17) % 86)}%`,
  size: 2 + (index % 4),
  top: `${10 + ((index * 23) % 78)}%`,
}));

function isChannelActive(label: CinematicChannelLabel, activeChannels: CinematicChannelLabel[]) {
  return activeChannels.includes(label);
}

export function CinematicServiceWorld({
  className = '',
  compact = false,
  forceReducedMotion = false,
  stepIndex,
}: {
  className?: string;
  compact?: boolean;
  forceReducedMotion?: boolean;
  stepIndex: number;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const reducedMotion = forceReducedMotion || prefersReducedMotion;
  const scene = getCinematicScene(stepIndex);
  const gradientId = `cinematic-line-${useId().replace(/:/g, '')}`;
  const sceneStyle = {
    '--cinematic-accent': scene.accent,
  } as CSSProperties;

  return (
    <div
      className={[
        'relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#02050a] text-white shadow-[0_30px_120px_-62px_rgba(15,23,42,0.95)]',
        compact ? 'min-h-[28rem]' : 'min-h-[34rem]',
        className,
      ].join(' ')}
      data-cinematic-scene={scene.id}
      data-cinematic-world="service-memory"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      style={sceneStyle}
    >
      <motion.div
        animate={{ opacity: reducedMotion ? 0.78 : [0.7, 0.92, 0.78] }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(125,211,252,0.16),transparent_22%),radial-gradient(circle_at_70%_30%,rgba(251,146,60,0.16),transparent_24%),radial-gradient(circle_at_52%_62%,rgba(196,181,253,0.14),transparent_28%),linear-gradient(145deg,#02050a_0%,#07101d_50%,#02050a_100%)]"
        transition={{ duration: 7, ease: 'easeInOut', repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY, repeatType: 'mirror' }}
      />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.72)_0.7px,transparent_0.8px)] [background-size:34px_34px]" />

      {particlePositions.map((particle, index) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          animate={{
            opacity: reducedMotion ? 0.42 : [0.18, 0.74, 0.22],
            y: reducedMotion ? 0 : [0, index % 2 === 0 ? -18 : 14, 0],
          }}
          className="pointer-events-none absolute rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.72)]"
          style={{
            height: particle.size,
            left: particle.left,
            top: particle.top,
            width: particle.size,
          }}
          transition={{
            delay: particle.delay,
            duration: 4.8 + (index % 5) * 0.4,
            ease: 'easeInOut',
            repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY,
          }}
        />
      ))}

      <svg aria-hidden className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 100 100">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="52%" stopColor={scene.accent} stopOpacity="0.72" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.42)" />
          </linearGradient>
        </defs>
        {CINEMATIC_CHANNEL_LABELS.map((label) => {
          const position = channelPositions[label];
          const active = isChannelActive(label, scene.activeChannels);

          return (
            <motion.path
              key={label}
              animate={{ opacity: active ? 0.78 : 0.16, pathLength: active ? 1 : 0.35 }}
              d={`M ${parseFloat(position.left)} ${parseFloat(position.top)} C 42 42, 46 50, 50 50`}
              stroke={`url(#${gradientId})`}
              strokeLinecap="round"
              strokeWidth={active ? 0.62 : 0.28}
              transition={{ duration: reducedMotion ? 0.18 : 0.8, ease: 'easeOut' }}
            />
          );
        })}
        <motion.path
          animate={{ opacity: scene.id === 'action-extraction' || scene.id === 'operations-dashboard' ? 0.84 : 0.22 }}
          d="M 52 50 C 66 38, 72 30, 86 24 M 52 50 C 70 50, 78 50, 90 50 M 52 50 C 66 62, 74 70, 88 78"
          stroke={scene.accent}
          strokeLinecap="round"
          strokeWidth="0.42"
          transition={{ duration: reducedMotion ? 0.18 : 0.84, ease: 'easeOut' }}
        />
      </svg>

      <div className="absolute inset-0">
        {CINEMATIC_CHANNEL_LABELS.map((label, index) => {
          const position = channelPositions[label];
          const active = isChannelActive(label, scene.activeChannels);

          return (
            <motion.div
              key={label}
              animate={{
                opacity: active ? 1 : 0.48,
                scale: active ? 1 : 0.92,
                y: reducedMotion ? 0 : [0, index % 2 === 0 ? -5 : 5, 0],
              }}
              className={[
                'absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-xs font-bold backdrop-blur-xl',
                active ? 'border-white/18 bg-white/[0.09] text-white' : 'border-white/8 bg-white/[0.035] text-slate-500',
              ].join(' ')}
              style={position}
              transition={{ duration: reducedMotion ? 0.18 : 5.4 + index * 0.18, ease: 'easeInOut', repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY }}
            >
              {label}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        animate={{
          boxShadow: reducedMotion
            ? `0 0 70px ${scene.accent}44`
            : [`0 0 54px ${scene.accent}38`, `0 0 104px ${scene.accent}66`, `0 0 62px ${scene.accent}44`],
          scale: scene.id === 'memory-core' ? 1.1 : 1,
        }}
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/14 bg-white/[0.035]"
        transition={{ duration: reducedMotion ? 0.18 : 1.1, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ rotate: reducedMotion ? 0 : 360 }}
          className="absolute inset-4 rounded-full border border-white/12"
          transition={{ duration: 14, ease: 'linear', repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY }}
        />
        <motion.div
          animate={{ rotate: reducedMotion ? 0 : -360 }}
          className="absolute inset-10 rounded-full border border-white/18"
          transition={{ duration: 10, ease: 'linear', repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY }}
        />
        <div className="absolute inset-[42%] rounded-full bg-white shadow-[0_0_44px_rgba(255,255,255,0.9)]" />
      </motion.div>

      <motion.div
        animate={{
          opacity: scene.id === 'operations-dashboard' ? 1 : scene.id === 'action-extraction' ? 0.82 : 0.48,
          x: scene.id === 'operations-dashboard' ? 0 : 12,
        }}
        className="absolute right-5 top-1/2 hidden w-48 -translate-y-1/2 rounded-3xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-xl sm:block"
        transition={{ duration: reducedMotion ? 0.18 : 0.64, ease: 'easeOut' }}
      >
        <p className="text-[10px] font-bold tracking-[0.22em] text-slate-400">운영 화면</p>
        <div className="mt-4 space-y-2">
          {['오늘 할 일', '고객 기억', '주문·예약'].map((item, index) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-200">{item}</span>
                <span className="h-1.5 w-10 rounded-full bg-[var(--cinematic-accent)]" style={{ opacity: 0.45 + index * 0.18 }} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        animate={{ opacity: scene.id === 'store-scan' || scene.id === 'operations-dashboard' ? 0.94 : 0.42, x: scene.id === 'store-scan' ? 0 : -8 }}
        className="absolute bottom-5 left-5 hidden w-44 rounded-3xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-xl md:block"
        transition={{ duration: reducedMotion ? 0.18 : 0.58, ease: 'easeOut' }}
      >
        <p className="text-[10px] font-bold tracking-[0.22em] text-slate-400">공개 스토어</p>
        <p className="mt-3 break-keep text-sm font-semibold leading-6 text-white">첫 방문을 고객 기억 입구로 연결</p>
      </motion.div>

      <div className="absolute left-5 right-5 top-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-slate-400">{scene.number} {scene.label}</p>
          <h3 className="mt-2 max-w-[22rem] break-keep font-display text-2xl font-black leading-tight tracking-[-0.04em] text-white">
            {scene.title}
          </h3>
        </div>
        <span className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-slate-200 backdrop-blur">
          MYBI 반응 중
        </span>
      </div>

      <div className="absolute bottom-5 right-5 max-w-[min(28rem,calc(100%-2.5rem))] rounded-3xl border border-white/12 bg-[#050b14]/76 p-4 backdrop-blur-xl">
        <p className="break-keep text-sm leading-6 text-slate-100">{scene.description}</p>
        <p className="mt-2 break-keep text-xs leading-5 text-slate-400">{scene.memoryCaption}</p>
        <p className="mt-2 break-keep text-xs font-semibold leading-5 text-[var(--cinematic-accent)]">{scene.actionCaption}</p>
      </div>
    </div>
  );
}
