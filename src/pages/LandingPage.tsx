import { Link } from 'react-router-dom';

import { DiagnosisCinemaStage } from '@/shared/components/DiagnosisCinemaStage';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 공개 스토어 유입부터 문의·예약·웨이팅 캡처, 고객 기억 결합, 다음 액션 제안, 운영 대시보드 payoff까지 이어지는 customer-memory revenue system입니다.';

const teaserChips = ['FREE acquisition', '문의 / 예약 / 웨이팅 capture', 'customer memory core', 'revenue recovery payoff'] as const;

export function LandingPage() {
  usePageMeta('마이비즈랩', landingDescription);

  return (
    <main className="relative overflow-hidden bg-[#02050a] text-white" data-landing-mode="teaser">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(236,91,19,0.14),transparent_28%),radial-gradient(circle_at_84%_10%,rgba(96,165,250,0.14),transparent_24%),linear-gradient(180deg,#02050a_0%,#04070d_44%,#02050a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-12 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />

      <section className="page-shell relative flex min-h-[calc(100svh-84px)] flex-col justify-center py-10 sm:py-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
              Customer-memory revenue system
            </span>

            <div className="space-y-4">
              <h1 className="max-w-[11ch] text-balance font-display text-[2.6rem] font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-[3.4rem] lg:text-[4.2rem]">
                공개 스토어로 들어온 신호를 고객 기억과 매출 payoff로 전환합니다.
              </h1>
              <p className="max-w-[30rem] text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                MyBiz는 무료 공개 스토어 유입에서 시작해 문의, 예약, 웨이팅 신호를 고객 기억으로 결합하고 다음 액션과 운영 대시보드 payoff까지 이어집니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {teaserChips.map((chip) => (
                <span key={chip} className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
                  {chip}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="btn-primary min-w-[220px]" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                공개 스토어 진단 생성
              </Link>
              <Link
                className="btn-secondary min-w-[180px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                to="/pricing"
              >
                FREE / PRO / VIP 보기
              </Link>
            </div>

            <p className="max-w-[32rem] text-sm leading-6 text-slate-400">
              메인 랜딩은 teaser만 남기고, 실제 진단 경험은 버튼 클릭 뒤 같은 dark world 안의 full-screen diagnosis cinema로 이어집니다.
            </p>
          </div>

          <DiagnosisCinemaStage className="min-h-[30rem] lg:min-h-[38rem]" stepIndex={2} teaser />
        </div>
      </section>
    </main>
  );
}
