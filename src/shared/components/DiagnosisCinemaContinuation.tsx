import { Link } from 'react-router-dom';

import { BILLING_PLAN_DETAILS } from '@/shared/lib/billingPlans';

const planCards = [
  {
    code: 'free' as const,
    kicker: 'FREE',
    summary: '공개 스토어를 열고 첫 유입과 기본 신호를 받는 시작 레일',
  },
  {
    code: 'pro' as const,
    kicker: 'PRO',
    summary: '문의·예약·웨이팅을 고객 기억과 다음 행동으로 연결하는 추천 레일',
  },
  {
    code: 'vip' as const,
    kicker: 'VIP',
    summary: '반복 매출 회복과 운영 자동화를 더 깊게 확장하는 상위 레일',
  },
] as const;

function planPriceLabel(code: keyof typeof BILLING_PLAN_DETAILS) {
  const plan = BILLING_PLAN_DETAILS[code];

  if (plan.amount === 0) {
    return '무료';
  }

  return `월 ${plan.amount.toLocaleString('ko-KR')}원`;
}

export function DiagnosisCinemaContinuation({
  onOpenSetupFlow,
  onResetCinema,
}: {
  onOpenSetupFlow: () => void;
  onResetCinema: () => void;
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#02050a]" data-diagnosis-post-cinema="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(236,91,19,0.16),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(96,165,250,0.12),transparent_22%),linear-gradient(180deg,#02050a_0%,#050812_48%,#02050a_100%)]" />
      <div className="absolute inset-0 opacity-12 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="page-shell relative space-y-8 py-10 sm:space-y-10 sm:py-14">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,20,0.82),rgba(4,7,12,0.58))] px-6 py-7 text-white shadow-[0_32px_100px_-70px_rgba(0,0,0,0.98)] backdrop-blur-xl sm:px-8 sm:py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">Post cinema</p>
          <h2 className="mt-3 max-w-[12ch] break-keep font-display text-[2rem] font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-[2.8rem]">
            기억 엔진에서 나온 흐름을 실제 스토어 설정으로 이어갑니다
          </h2>
          <p className="mt-3 max-w-2xl break-keep text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            FREE는 공개 유입을 받고, PRO는 고객 기억과 다음 행동을 운영에 연결하고, VIP는 회복 흐름을 더 넓게 확장합니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={onOpenSetupFlow} type="button">
              스토어 설정 계속
            </button>
            <Link
              className="btn-secondary border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              to="/pricing"
            >
              요금제 전체 보기
            </Link>
            <button
              className="btn-secondary border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              onClick={onResetCinema}
              type="button"
            >
              시네마 다시 보기
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3" data-diagnosis-pricing-ladder="true">
          {planCards.map((plan) => (
            <article
              key={plan.code}
              className={[
                'rounded-[28px] border px-5 py-5 text-white shadow-[0_32px_90px_-72px_rgba(0,0,0,0.98)] backdrop-blur-xl',
                plan.code === 'pro'
                  ? 'border-orange-300/28 bg-[linear-gradient(180deg,rgba(236,91,19,0.14),rgba(7,11,18,0.82))]'
                  : 'border-white/10 bg-[linear-gradient(180deg,rgba(8,12,20,0.82),rgba(4,7,12,0.58))]',
              ].join(' ')}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{plan.kicker}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <h3 className="font-display text-[2rem] font-black tracking-[-0.04em] text-white">{plan.kicker}</h3>
                <p className="text-sm font-semibold text-orange-100">{planPriceLabel(plan.code)}</p>
              </div>
              <p className="mt-3 break-keep text-sm leading-6 text-slate-300">{plan.summary}</p>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
