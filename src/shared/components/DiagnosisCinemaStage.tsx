import { AnimatePresence, motion } from 'motion/react';

import { clampDiagnosisCorridorStepIndex, getDiagnosisSceneState } from '@/shared/lib/diagnosisCorridor';

const ambientNodes = [
  { left: '8%', top: '16%', size: 6, tone: 'sky' },
  { left: '16%', top: '30%', size: 5, tone: 'white' },
  { left: '12%', top: '62%', size: 7, tone: 'violet' },
  { left: '24%', top: '18%', size: 5, tone: 'white' },
  { left: '28%', top: '44%', size: 6, tone: 'sky' },
  { left: '22%', top: '72%', size: 5, tone: 'violet' },
  { left: '38%', top: '12%', size: 5, tone: 'white' },
  { left: '42%', top: '28%', size: 7, tone: 'sky' },
  { left: '48%', top: '52%', size: 6, tone: 'white' },
  { left: '44%', top: '78%', size: 4, tone: 'violet' },
  { left: '56%', top: '16%', size: 6, tone: 'sky' },
  { left: '62%', top: '32%', size: 7, tone: 'white' },
  { left: '66%', top: '58%', size: 6, tone: 'violet' },
  { left: '74%', top: '20%', size: 5, tone: 'sky' },
  { left: '78%', top: '42%', size: 6, tone: 'white' },
  { left: '82%', top: '70%', size: 7, tone: 'sky' },
  { left: '88%', top: '28%', size: 4, tone: 'violet' },
  { left: '90%', top: '56%', size: 5, tone: 'white' },
  { left: '70%', top: '82%', size: 5, tone: 'violet' },
  { left: '34%', top: '66%', size: 5, tone: 'sky' },
] as const;

const ambientLinks = [
  'M 120 180 C 240 210, 330 240, 460 300',
  'M 180 570 C 320 480, 440 430, 560 400',
  'M 420 130 C 540 210, 660 250, 760 320',
  'M 540 520 C 680 440, 780 380, 900 340',
  'M 640 260 C 760 340, 860 430, 980 520',
  'M 860 190 C 980 260, 1100 300, 1240 340',
  'M 820 640 C 940 580, 1080 560, 1260 560',
  'M 420 760 C 560 700, 640 640, 760 580',
] as const;

const branchPaths = [
  'M 260 520 C 420 460, 560 360, 760 240',
  'M 260 520 C 460 520, 620 520, 820 520',
  'M 260 520 C 420 580, 560 680, 760 800',
] as const;

const outputPaths = [
  'M 760 520 C 920 450, 1060 360, 1240 230',
  'M 760 520 C 940 515, 1080 514, 1260 520',
  'M 760 520 C 920 590, 1060 676, 1240 810',
] as const;

const storeShellSegments = [
  { left: '24%', top: '28%', width: '12%', height: '32%' },
  { left: '24%', top: '22%', width: '12%', height: '4%' },
  { left: '27.2%', top: '40%', width: '5.6%', height: '11%' },
  { left: '24%', top: '62%', width: '12%', height: '7%' },
] as const;

const dashboardSegments = [
  { left: '58%', top: '30%', width: '18%', height: '22%' },
  { left: '60%', top: '56%', width: '4%', height: '10%' },
  { left: '66%', top: '50%', width: '4%', height: '16%' },
  { left: '72%', top: '44%', width: '4%', height: '22%' },
] as const;

function nodeClasses(tone: 'sky' | 'violet' | 'white') {
  if (tone === 'sky') {
    return 'bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.72)]';
  }

  if (tone === 'violet') {
    return 'bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.74)]';
  }

  return 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.82)]';
}

export default function DiagnosisCinemaStage({
  className = '',
  isFrozen = false,
  pulseSeed = 0,
  renderMode = 'fallback',
  stepIndex,
}: {
  className?: string;
  isFrozen?: boolean;
  pulseSeed?: number;
  renderMode?: 'fallback' | 'reduced';
  stepIndex: number;
}) {
  const safeStepIndex = clampDiagnosisCorridorStepIndex(stepIndex);
  const sceneState = getDiagnosisSceneState(safeStepIndex);
  const coreGlowScale = sceneState.isMemoryMergeShot ? 1.18 : sceneState.isPayoffShot ? 0.96 : 1;
  const branchOpacity = sceneState.showSignalBranches ? (sceneState.isMemoryMergeShot ? 0.72 : 0.54) : 0.16;
  const outputOpacity = sceneState.showOutputRays ? (sceneState.isPayoffShot ? 0.2 : 0.48) : 0;

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#02050a] ${className}`}
      data-diagnosis-render-mode={renderMode}
    >
      <motion.div
        animate={{
          opacity: sceneState.isPayoffShot ? 0.96 : 0.82,
        }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(196,181,253,0.14),transparent_18%),radial-gradient(circle_at_18%_22%,rgba(96,165,250,0.12),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.08),transparent_16%),linear-gradient(180deg,#02050a_0%,#030711_56%,#02050a_100%)]"
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0.6px,transparent_0.7px)] [background-size:38px_38px]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,rgba(2,5,10,0),rgba(2,5,10,0.92))]" />

      <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 1440 1024">
        <defs>
          <linearGradient id="crystal-ambient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="55%" stopColor="rgba(125,211,252,0.34)" />
            <stop offset="100%" stopColor="rgba(196,181,253,0.18)" />
          </linearGradient>
          <linearGradient id="crystal-branch" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="45%" stopColor="rgba(96,165,250,0.72)" />
            <stop offset="100%" stopColor="rgba(196,181,253,0.74)" />
          </linearGradient>
          <linearGradient id="crystal-output" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="100%" stopColor="rgba(125,211,252,0.86)" />
          </linearGradient>
        </defs>

        {ambientLinks.map((path, index) => (
          <motion.path
            key={path}
            animate={{ opacity: 0.12 + (index % 3) * 0.04 }}
            d={path}
            stroke="url(#crystal-ambient)"
            strokeLinecap="round"
            strokeWidth="1.3"
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}

        {branchPaths.map((path, index) => (
          <g key={path}>
            <motion.path
              animate={{ opacity: branchOpacity * 0.45 }}
              d={path}
              stroke="url(#crystal-branch)"
              strokeLinecap="round"
              strokeWidth="14"
              style={{ filter: 'blur(12px)' }}
              transition={{ duration: 0.78, delay: index * 0.04, ease: 'easeOut' }}
            />
            <motion.path
              animate={{ opacity: branchOpacity }}
              d={path}
              stroke="url(#crystal-branch)"
              strokeLinecap="round"
              strokeWidth="2.2"
              transition={{ duration: 0.78, delay: index * 0.04, ease: 'easeOut' }}
            />
          </g>
        ))}

        {outputPaths.map((path, index) => (
          <g key={path}>
            <motion.path
              animate={{ opacity: outputOpacity * 0.36 }}
              d={path}
              stroke="url(#crystal-output)"
              strokeLinecap="round"
              strokeWidth="12"
              style={{ filter: 'blur(12px)' }}
              transition={{ duration: 0.78, delay: index * 0.04, ease: 'easeOut' }}
            />
            <motion.path
              animate={{ opacity: outputOpacity }}
              d={path}
              stroke="url(#crystal-output)"
              strokeLinecap="round"
              strokeWidth="1.9"
              transition={{ duration: 0.78, delay: index * 0.04, ease: 'easeOut' }}
            />
          </g>
        ))}

      {ambientNodes.map((node, index) => (
        <motion.div
          key={`${node.left}-${node.top}-${node.tone}`}
          animate={{
            opacity: sceneState.isDetectionShot ? 0.38 + (index % 4) * 0.08 : 0.55 + (index % 4) * 0.08,
            scale: sceneState.isMemoryMergeShot && index % 3 === 0 ? 1.24 : 1,
            y: isFrozen ? 0 : [0, (index % 2 === 0 ? -4 : 4), 0],
          }}
          className={`absolute rounded-full ${nodeClasses(node.tone)}`}
          style={{
            height: node.size,
            left: node.left,
            top: node.top,
            width: node.size,
          }}
          transition={{
            duration: isFrozen ? 0.2 : 5 + (index % 5) * 0.4,
            ease: 'easeInOut',
            repeat: isFrozen ? 0 : Number.POSITIVE_INFINITY,
          }}
        />
      ))}
      </svg>

      <motion.div
        animate={{
          opacity: sceneState.showMemoryCore ? 1 : 0.42,
          scale: coreGlowScale,
        }}
        className="absolute left-1/2 top-1/2 h-[19rem] w-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4),rgba(196,181,253,0.18)_26%,rgba(96,165,250,0.08)_42%,rgba(2,5,10,0)_68%)] blur-[2px]"
        transition={{ duration: 0.82, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ rotate: sceneState.showMemoryCore ? (isFrozen ? 36 : 360) : 0 }}
          className="absolute inset-[20%] rounded-full border border-white/16"
          transition={{ duration: isFrozen ? 0.24 : 14, ease: 'linear', repeat: isFrozen ? 0 : Number.POSITIVE_INFINITY }}
        />
        <motion.div
          animate={{ rotate: sceneState.showMemoryCore ? (isFrozen ? -42 : -360) : 0 }}
          className="absolute inset-[34%] rounded-full border border-violet-200/22"
          transition={{ duration: isFrozen ? 0.24 : 10, ease: 'linear', repeat: isFrozen ? 0 : Number.POSITIVE_INFINITY }}
        />
        <div className="absolute inset-[42%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98),rgba(255,255,255,0.28)_42%,rgba(2,5,10,0)_72%)]" />
      </motion.div>

      <motion.div
        animate={{
          opacity: sceneState.showMemoryCore ? 0.96 : 0.22,
          scale: sceneState.isMemoryMergeShot ? 1.18 : 1,
        }}
        className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,1),rgba(255,255,255,0.18)_46%,rgba(2,5,10,0)_74%)] shadow-[0_0_56px_rgba(255,255,255,0.85)]"
        transition={{ duration: 0.82, ease: 'easeOut' }}
      />

      <AnimatePresence initial={false}>
        {pulseSeed > 0 ? (
          <motion.div
            key={`diagnosis-stage-pulse-${pulseSeed}`}
            animate={{ opacity: [0, 0.82, 0], scale: [0.42, 1.18, 1.42] }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/30 bg-[radial-gradient(circle,rgba(255,255,255,0.92),rgba(251,146,60,0.36)_18%,rgba(251,146,60,0.04)_36%,rgba(2,5,10,0)_68%)] mix-blend-screen"
            initial={{ opacity: 0, scale: 0.32 }}
            transition={{ duration: 0.74, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        animate={{
          opacity: sceneState.showGeneratedStore ? 0.92 : 0,
          scale: sceneState.showGeneratedStore ? 1 : 0.72,
          x: sceneState.showGeneratedStore ? 0 : -24,
          y: sceneState.showGeneratedStore ? 0 : 24,
        }}
        className="absolute inset-0"
        transition={{ duration: 0.86, ease: 'easeOut' }}
      >
        {storeShellSegments.map((segment, index) => (
          <div
            key={`${segment.left}-${segment.top}`}
            className={`absolute rounded-[1.8rem] border border-white/14 bg-white/[0.02] ${index === 1 ? 'border-orange-200/18 bg-orange-300/[0.05]' : ''}`}
            style={segment}
          />
        ))}
      </motion.div>

      <motion.div
        animate={{
          opacity: sceneState.showDashboardPayoff ? 0.96 : 0,
          scale: sceneState.showDashboardPayoff ? 1 : 0.78,
          x: sceneState.showDashboardPayoff ? 0 : 28,
          y: sceneState.showDashboardPayoff ? 0 : 20,
        }}
        className="absolute inset-0"
        transition={{ duration: 0.92, ease: 'easeOut', delay: sceneState.showDashboardPayoff ? 0.18 : 0 }}
      >
        {dashboardSegments.map((segment, index) => (
          <div
            key={`${segment.left}-${segment.top}`}
            className={`absolute rounded-[1.6rem] border ${index === 0 ? 'border-white/14 bg-white/[0.03]' : 'border-sky-200/18 bg-sky-300/[0.05]'}`}
            style={segment}
          />
        ))}
      </motion.div>
    </div>
  );
}
