import { Link } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePersistentDiagnosisWorldSurface } from '@/shared/components/PersistentDiagnosisWorldShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  '업로드한 neural world를 메인 히어로로 유지하고, 진단을 시작하면 같은 세계가 MYBI 동반자로 이어지는 공개 스토어 진단 화면입니다.';

export function LandingPage() {
  usePageMeta('MyBiz | 공개 스토어 진단', landingDescription);

  const worldSurfaceRef = usePersistentDiagnosisWorldSurface({
    companionMode: 'hero',
    contextSummary: '무료 공개 유입이 들어오면 문의, 예약, 대기 같은 입력 채널로 이어지고 그 신호가 고객 기억 축을 만듭니다.',
    layoutMode: 'hero',
    meaning: 'MYBI는 공개 유입, 고객 기억, AI 운영 제안을 한 화면에서 이어 주는 실시간 동반자입니다.',
    memoryNote: '고객과 타임라인이 핵심 기억 축을 만들고, AI는 그 위에서 요약, 분류, 추천, 리포트를 수행합니다.',
    nextAction: '공개 스토어 진단을 시작하면 같은 세계가 축소되지 않고 살아 있는 MYBI 동반자로 이어집니다.',
    planLabel: '진단 시작 전',
    pulseKey: 0,
    routeLabel: '랜딩 히어로',
    selectedHighlights: ['공개 유입', '고객 기억 축', 'AI 운영 레이어'],
    stepIndex: 0,
    stepLabel: '01 스토어 / 공개 유입',
    title: 'MYBI 히어로',
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Living neural companion</p>
            </div>
          </div>

          <div className="pointer-events-auto max-w-[30rem] space-y-6 pb-4 sm:pb-10 lg:pb-14">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">공개 유입 히어로</p>
              <h1 className="max-w-[10ch] break-keep font-display text-[3.35rem] font-black leading-[0.88] tracking-[-0.08em] text-white sm:text-[4.9rem]">
                고객 기억이 살아 있는 세계로 시작합니다
              </h1>
              <p className="max-w-[24rem] break-keep text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                직접 움직이고 눌러 보세요. 같은 세계가 그대로 살아 있는 상태로 진단 흐름과 MYBI 안내 모드까지 이어집니다.
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
