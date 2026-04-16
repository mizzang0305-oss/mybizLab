import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 공개 스토어 유입을 고객 기억의 중심으로 끌어당기고, 다음 액션과 운영 대시보드까지 연결하는 crystal network onboarding을 제공합니다.';

export function LandingPage() {
  usePageMeta('MyBiz | 공개 스토어 진단', landingDescription);

  return (
    <main className="relative overflow-hidden bg-[#02050a] text-white" data-landing-mode="teaser">
      <section className="relative min-h-[calc(100svh-84px)] overflow-hidden">
        <DiagnosisCinemaStage className="scale-[1.08]" pulseSeed={1} renderMode="fallback" stepIndex={2} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,10,0.2)_0%,rgba(2,5,10,0.42)_36%,rgba(2,5,10,0.84)_100%)]" />

        <div className="page-shell relative flex min-h-[calc(100svh-84px)] items-end py-12 sm:py-14">
          <div className="max-w-[24rem] space-y-5 sm:max-w-[29rem]">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              <span>Teaser</span>
              <span className="h-px flex-1 bg-white/12" />
              <span>Crystal network</span>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-[10ch] break-keep font-display text-[3rem] font-black leading-[0.92] tracking-[-0.08em] text-white sm:text-[4.6rem]">
                흩어진 반응을 기억의 중심으로
              </h1>
              <p className="max-w-[24rem] break-keep text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                공개 스토어의 신호를 빛으로 묶고, 가장 필요한 액션과 운영 화면까지 한 번에 이어 붙입니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link className="btn-primary min-w-[220px]" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                진단 시네마 열기
              </Link>
              <Link className="text-sm font-semibold text-slate-300 transition hover:text-white" to="/pricing">
                FREE / PRO / VIP
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
