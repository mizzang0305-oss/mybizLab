import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/shared/components/Icons';

interface DiagnosisLoadingPanelProps {
  businessType: string;
  customerType: string;
  region: string;
  stages: readonly string[];
}

export function DiagnosisLoadingPanel({
  businessType,
  customerType,
  region,
  stages,
}: DiagnosisLoadingPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, stages.length - 1));
    }, 850);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, stages.length]);

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_36px_80px_-48px_rgba(15,23,42,0.72)] sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.5),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.24),_transparent_26%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-orange-200/30 bg-orange-100/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
            AI 분석 진행 중
          </span>
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300">
            {region} · {businessType}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="max-w-[14ch] font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
                AI가 입력 정보를 교차 분석해 운영 진단 리포트를 만들고 있습니다
              </h3>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                지역, 업종, 고객 유형, 운영 고민을 한 번에 비교해 핵심 병목과 실행 우선순위를 정리합니다. 실제 외부 데이터가
                아닌 입력값 기반 추론이지만, 결과는 바로 운영 액션으로 이어질 수 있도록 구조화하고 있습니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Icons.Store, label: '업종 해석', value: businessType },
                { icon: Icons.Users, label: '고객 맥락', value: customerType },
                { icon: Icons.Chart, label: '운영 포인트', value: '병목과 매출 개선안 도출' },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.08] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-orange-200">
                      <Icon size={18} />
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.08] p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-200">ANALYSIS PIPELINE</p>
                <p className="mt-2 text-xl font-black text-white">진단 단계</p>
              </div>
              <motion.div
                className="relative flex h-14 w-14 items-center justify-center rounded-full border border-orange-200/35 bg-orange-500/15 text-orange-100"
                animate={
                  prefersReducedMotion
                    ? { scale: 1 }
                    : {
                        boxShadow: [
                          '0 0 0 0 rgba(251,146,60,0.0)',
                          '0 0 0 16px rgba(251,146,60,0.12)',
                          '0 0 0 0 rgba(251,146,60,0.0)',
                        ],
                        scale: [1, 1.04, 1],
                      }
                }
                transition={{ duration: 1.8, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
              >
                <Icons.AI size={24} />
              </motion.div>
            </div>

            <div className="mt-5 space-y-3">
              {stages.map((stage, index) => {
                const done = index < stageIndex;
                const current = index === stageIndex;

                return (
                  <div
                    key={stage}
                    className={[
                      'rounded-3xl border px-4 py-4 transition',
                      done
                        ? 'border-emerald-300/30 bg-emerald-400/10'
                        : current
                          ? 'border-orange-300/35 bg-orange-400/10'
                          : 'border-white/10 bg-slate-950/35',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          STEP {String(index + 1).padStart(2, '0')}
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white">{stage}</p>
                      </div>
                      <span
                        className={[
                          'rounded-full px-3 py-1 text-xs font-bold',
                          done
                            ? 'bg-emerald-100 text-emerald-700'
                            : current
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-white/10 text-slate-300',
                        ].join(' ')}
                      >
                        {done ? '완료' : current ? '진행 중' : '대기'}
                      </span>
                    </div>
                    {current ? (
                      <motion.div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                        initial={false}
                      >
                        <motion.div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#fb923c,#f97316,#38bdf8)]"
                          animate={prefersReducedMotion ? { width: '100%' } : { width: ['8%', '62%', '100%'] }}
                          transition={{ duration: 0.95, repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                        />
                      </motion.div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
