import { motion } from 'motion/react';

import {
  DIAGNOSIS_ACTION_LABELS,
  DIAGNOSIS_CHANNEL_LABELS,
  clampDiagnosisCorridorStepIndex,
  getDiagnosisSceneState,
} from '@/shared/lib/diagnosisCorridor';

const stageThemes = [
  {
    glow: 'radial-gradient(circle at 20% 28%, rgba(236,91,19,0.18), transparent 18%)',
    secondaryGlow: 'radial-gradient(circle at 82% 20%, rgba(96,165,250,0.12), transparent 18%)',
    gridOpacity: 0.1,
  },
  {
    glow: 'radial-gradient(circle at 26% 30%, rgba(236,91,19,0.18), transparent 18%)',
    secondaryGlow: 'radial-gradient(circle at 78% 22%, rgba(96,165,250,0.14), transparent 18%)',
    gridOpacity: 0.12,
  },
  {
    glow: 'radial-gradient(circle at 50% 34%, rgba(251,146,60,0.24), transparent 20%)',
    secondaryGlow: 'radial-gradient(circle at 50% 34%, rgba(129,140,248,0.18), transparent 26%)',
    gridOpacity: 0.14,
  },
  {
    glow: 'radial-gradient(circle at 52% 34%, rgba(251,146,60,0.18), transparent 18%)',
    secondaryGlow: 'radial-gradient(circle at 82% 26%, rgba(96,165,250,0.16), transparent 18%)',
    gridOpacity: 0.12,
  },
  {
    glow: 'radial-gradient(circle at 42% 34%, rgba(251,146,60,0.18), transparent 22%)',
    secondaryGlow: 'radial-gradient(circle at 72% 34%, rgba(96,165,250,0.18), transparent 22%)',
    gridOpacity: 0.13,
  },
] as const;

const branchLabels = [
  { left: '62%', top: '24%' },
  { left: '72%', top: '48%' },
  { left: '62%', top: '72%' },
] as const;

const actionLabels = [
  { left: '78%', top: '22%' },
  { left: '84%', top: '48%' },
  { left: '78%', top: '74%' },
] as const;

export function DiagnosisCinemaStage({
  className = '',
  isFrozen = false,
  renderMode = 'fallback',
  stepIndex,
}: {
  className?: string;
  isFrozen?: boolean;
  renderMode?: 'fallback' | 'reduced';
  stepIndex: number;
}) {
  const safeStepIndex = clampDiagnosisCorridorStepIndex(stepIndex);
  const sceneState = getDiagnosisSceneState(safeStepIndex);
  const theme = stageThemes[safeStepIndex];

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#02050a] ${className}`}
      data-diagnosis-render-mode={renderMode}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        animate={{
          backgroundImage: `${theme.glow}, ${theme.secondaryGlow}, linear-gradient(180deg,#02050a 0%,#060913 48%,#02050a 100%)`,
        }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:64px_64px]"
        animate={{ opacity: theme.gridOpacity }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,rgba(2,5,10,0),rgba(2,5,10,0.96))]" />

      <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 1440 1024">
        <defs>
          <linearGradient id="stage-incoming" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0)" />
            <stop offset="70%" stopColor="rgba(251,146,60,0.98)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
          </linearGradient>
          <linearGradient id="stage-branch" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0.96)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.84)" />
          </linearGradient>
          <linearGradient id="stage-core" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
            <stop offset="55%" stopColor="rgba(251,146,60,0.95)" />
            <stop offset="100%" stopColor="rgba(129,140,248,0.82)" />
          </linearGradient>
        </defs>

        <motion.path
          d="M 40 512 C 250 512, 360 512, 520 512"
          stroke="url(#stage-incoming)"
          strokeLinecap="round"
          strokeWidth="18"
          animate={{ opacity: 0.34 }}
          style={{ filter: 'blur(14px)' }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          d="M 40 512 C 250 512, 360 512, 520 512"
          stroke="url(#stage-incoming)"
          strokeLinecap="round"
          strokeWidth="3.5"
          animate={{ opacity: 0.98 }}
          transition={{ duration: 0.8 }}
        />

        {[
          'M 520 512 C 650 470, 710 360, 860 248',
          'M 520 512 C 690 512, 786 512, 938 512',
          'M 520 512 C 650 554, 710 664, 860 776',
        ].map((path) => (
          <g key={path}>
            <motion.path
              d={path}
              stroke="url(#stage-branch)"
              strokeLinecap="round"
              strokeWidth="16"
              animate={{ opacity: sceneState.showSignalBranches ? 0.32 : 0 }}
              style={{ filter: 'blur(12px)' }}
              transition={{ duration: 0.8 }}
            />
            <motion.path
              d={path}
              stroke="url(#stage-branch)"
              strokeLinecap="round"
              strokeWidth="3.4"
              animate={{ opacity: sceneState.showSignalBranches ? 0.94 : 0 }}
              transition={{ duration: 0.8 }}
            />
          </g>
        ))}

        {[
          'M 860 248 C 980 312, 1040 416, 1056 512',
          'M 938 512 C 986 512, 1022 512, 1056 512',
          'M 860 776 C 980 706, 1040 610, 1056 512',
        ].map((path) => (
          <g key={path}>
            <motion.path
              d={path}
              stroke="url(#stage-core)"
              strokeLinecap="round"
              strokeWidth="18"
              animate={{ opacity: sceneState.showMemoryCore ? 0.34 : 0 }}
              style={{ filter: 'blur(12px)' }}
              transition={{ duration: 0.8 }}
            />
            <motion.path
              d={path}
              stroke="url(#stage-core)"
              strokeLinecap="round"
              strokeWidth="3.4"
              animate={{ opacity: sceneState.showMemoryCore ? 0.94 : 0 }}
              transition={{ duration: 0.8 }}
            />
          </g>
        ))}

      {[
        'M 1056 512 C 1170 468, 1262 386, 1340 256',
        'M 1056 512 C 1198 512, 1276 512, 1384 522',
        'M 1056 512 C 1170 556, 1260 640, 1334 764',
      ].map((path) => (
        <g key={path}>
          <motion.path
            d={path}
            stroke="url(#stage-branch)"
            strokeLinecap="round"
            strokeWidth="13"
            animate={{ opacity: sceneState.showActionOutputs ? (safeStepIndex === 4 ? 0.08 : 0.26) : 0 }}
            style={{ filter: 'blur(10px)' }}
            transition={{ duration: 0.8 }}
          />
          <motion.path
            d={path}
            stroke="url(#stage-branch)"
            strokeLinecap="round"
            strokeWidth="2.8"
            animate={{ opacity: sceneState.showActionOutputs ? (safeStepIndex === 4 ? 0.18 : 0.88) : 0 }}
            transition={{ duration: 0.8 }}
          />
        </g>
      ))}
      </svg>

      <motion.div
        className="absolute left-[73.3%] top-1/2 h-[154px] w-[154px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/16 bg-orange-300/[0.05]"
        animate={{
          opacity: sceneState.showMemoryCore ? 1 : 0,
          scale: sceneState.showMemoryCore ? (safeStepIndex === 4 ? (isFrozen ? 0.82 : 0.88) : 1) : 0.72,
          boxShadow: sceneState.showMemoryCore ? '0 0 120px rgba(251,146,60,0.28)' : '0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          className="absolute inset-[12px] rounded-full border border-white/12"
          animate={{ rotate: sceneState.showMemoryCore ? (isFrozen ? 84 : 120) : 0 }}
          transition={{ duration: isFrozen ? 0.52 : 12, repeat: isFrozen ? 0 : Number.POSITIVE_INFINITY, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[28px] rounded-full border border-white/10"
          animate={{ rotate: sceneState.showMemoryCore ? (isFrozen ? -132 : -180) : 0 }}
          transition={{ duration: isFrozen ? 0.52 : 10, repeat: isFrozen ? 0 : Number.POSITIVE_INFINITY, ease: 'linear' }}
        />
        <div className="absolute inset-[44px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.92),rgba(251,146,60,0.82),rgba(251,146,60,0))]" />
      </motion.div>

      {DIAGNOSIS_CHANNEL_LABELS.map((label, index) => (
        <motion.div
          key={label}
          className="absolute rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-100 backdrop-blur-xl"
          style={branchLabels[index]}
          animate={sceneState.showSignalBranches ? { opacity: 0.96, x: 0, y: 0 } : { opacity: 0, x: 18, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.05 }}
        >
          {label}
        </motion.div>
      ))}

      {sceneState.showMemoryCore ? (
        <motion.div
          className="absolute left-[71.4%] top-[30%] rounded-full border border-orange-300/16 bg-orange-300/[0.08] px-3 py-1.5 text-[11px] font-semibold text-orange-50 backdrop-blur-xl"
          animate={{ opacity: 0.96, y: 0 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.5 }}
        >
          고객 기억 코어
        </motion.div>
      ) : null}

      {DIAGNOSIS_ACTION_LABELS.map((label, index) => (
        <motion.div
          key={label}
          className="absolute rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-100 backdrop-blur-xl"
          style={actionLabels[index]}
          animate={sceneState.showActionOutputs ? { opacity: 0.94, x: 0, y: 0 } : { opacity: 0, x: 18, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.06 }}
        >
          {label}
        </motion.div>
      ))}

      <motion.div
        className="absolute left-[26%] top-[17%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200"
        animate={{ opacity: sceneState.showStoreContext ? 0.9 : 0.4 }}
        transition={{ duration: 0.6 }}
      >
        공개 스토어 신호
      </motion.div>

      <motion.div
        className="absolute left-[56%] top-[23%] h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.12),rgba(251,146,60,0))] blur-3xl"
        animate={{ opacity: sceneState.showMemoryCore ? 0.9 : 0.4, scale: sceneState.showGeneratedStore ? 1.08 : 1 }}
        transition={{ duration: 0.8 }}
      />

      <motion.div
        className="absolute left-[38%] top-[56%] h-[18rem] w-[14rem] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(6,11,18,0.8),rgba(3,6,10,0.36))] shadow-[0_0_80px_rgba(251,146,60,0.16)]"
        animate={{
          opacity: sceneState.showGeneratedStore ? 0.86 : 0,
          scale: sceneState.showGeneratedStore ? 1 : 0.72,
          rotateX: sceneState.showGeneratedStore ? 0 : 10,
          y: sceneState.showGeneratedStore ? 0 : 24,
        }}
        style={{ transformPerspective: 1200 }}
        transition={{ delay: sceneState.showGeneratedStore ? 0.34 : 0, duration: 0.9, ease: 'easeOut' }}
      >
        <div className="absolute inset-x-5 top-5 h-2 rounded-full bg-white/10" />
        <div className="absolute inset-x-5 top-12 h-24 rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
        <div className="absolute inset-x-5 bottom-8 h-14 rounded-[1.2rem] border border-orange-300/16 bg-orange-300/[0.05]" />
      </motion.div>

      <motion.div
        className="absolute left-[68%] top-[54%] h-[16rem] w-[22rem] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,22,0.92),rgba(4,7,12,0.68))] shadow-[0_0_120px_rgba(96,165,250,0.18)]"
        animate={{
          opacity: sceneState.showDashboardPayoff ? 0.94 : 0,
          scale: sceneState.showDashboardPayoff ? 1 : 0.76,
          y: sceneState.showDashboardPayoff ? 0 : 28,
        }}
        transition={{ duration: 0.96, ease: 'easeOut', delay: sceneState.showDashboardPayoff ? 1.08 : 0 }}
      >
        <div className="absolute inset-x-5 top-5 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-300" />
          <div className="h-2.5 w-2.5 rounded-full bg-sky-300/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/30" />
        </div>
        <div className="absolute inset-x-5 top-12 h-20 rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
        <div className="absolute left-5 top-[9.2rem] h-16 w-[7.2rem] rounded-[1.1rem] border border-white/10 bg-white/[0.04]" />
        <div className="absolute right-5 top-[9.2rem] h-16 w-[7.6rem] rounded-[1.1rem] border border-white/10 bg-white/[0.04]" />
      </motion.div>
    </div>
  );
}
