import { Link } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePersistentDiagnosisWorldSurface } from '@/shared/components/PersistentDiagnosisWorldShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  '몰입형 neural world를 메인 히어로로 사용하고, 진단이 시작되면 같은 세계가 오른쪽으로 이동해 MyBiz 진단 흐름과 이어집니다.';

export function LandingPage() {
  usePageMeta('MyBiz | 공개 스토어 진단', landingDescription);

  const worldSurfaceRef = usePersistentDiagnosisWorldSurface({
    companionMode: 'hero',
    layoutMode: 'hero',
    meaning: 'MYBI is the customer-memory revenue system companion for public acquisition, capture, memory merge, and next action.',
    nextAction: '공개 스토어 진단 생성으로 들어가면 같은 world가 floating companion으로 이어집니다.',
    pulseKey: 0,
    stepIndex: 0,
    title: 'MYBI Hero',
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050a] text-white" data-landing-mode="hero-engine">
      <section className="relative min-h-screen overflow-hidden" data-mybi-anchor="landing-hero">
        <div ref={worldSurfaceRef} aria-hidden className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(125,211,252,0.08),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(2,5,10,0.08)_0%,rgba(2,5,10,0.14)_48%,rgba(2,5,10,0.76)_100%)]" />

        <div className="pointer-events-none relative z-40 flex min-h-screen flex-col justify-between px-5 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white shadow-[0_24px_80px_-52px_rgba(255,255,255,0.4)] backdrop-blur-xl">
              <Icons.Store size={20} />
            </div>
            <div>
              <p className="font-display text-xl font-black tracking-[-0.04em] text-white">MyBiz</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Live diagnosis world</p>
            </div>
          </div>

          <div className="pointer-events-auto max-w-[30rem] space-y-6 pb-4 sm:pb-10 lg:pb-14">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Interactive hero</p>
              <h1 className="max-w-[10ch] break-keep font-display text-[3.35rem] font-black leading-[0.88] tracking-[-0.08em] text-white sm:text-[4.9rem]">
                스토어 진단은 살아있는 세계로 시작합니다
              </h1>
              <p className="max-w-[24rem] break-keep text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                드래그하고 클릭해 맥동을 보내면 같은 세계가 그대로 오른쪽 패널로 이어지며 진단 흐름을 시작합니다.
              </p>
            </div>

            <Link
              className="btn-primary min-w-[240px] rounded-full px-6 py-4 text-base shadow-[0_28px_90px_-40px_rgba(236,91,19,0.8)]"
              state={DIAGNOSIS_CORRIDOR_LINK_STATE}
              to={SUBSCRIPTION_START_PATH}
            >
              공개 스토어 진단 생성
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
