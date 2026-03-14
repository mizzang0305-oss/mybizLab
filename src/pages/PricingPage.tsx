import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { LEGAL_LINKS, PRICING_PLANS, SERVICE_TAGLINE, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export function PricingPage() {
  usePageMeta('요금제', '마이비즈랩의 Starter, Pro, Business 구독형 SaaS 요금제와 결제 안내를 확인하세요.');

  return (
    <main className="page-shell py-12 sm:py-16">
      <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14 lg:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.48),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,237,213,0.18),_transparent_25%)]" />
        <div className="relative space-y-5">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-200">
            Pricing
          </span>
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">구독형 SaaS 요금제</h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              {SERVICE_TAGLINE}. 실제 결제 연동 전이라도 상품 구조와 구독 시작 CTA를 먼저 검토할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.name}
            className={[
              'section-card flex h-full flex-col p-6 sm:p-8',
              plan.highlighted ? 'border-orange-200 shadow-[0_25px_65px_-35px_rgba(236,91,19,0.45)]' : '',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">{plan.name}</p>
                <p className="mt-3 font-display text-3xl font-black text-slate-900">{plan.priceLabel}</p>
              </div>
              {plan.highlighted ? (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">추천 플랜</span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500 sm:text-base">{plan.summary}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700 sm:text-base">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 space-y-3">
              <Link className="btn-primary w-full justify-center" to={SUBSCRIPTION_START_PATH}>
                구독 시작
              </Link>
              <p className="text-xs leading-5 text-slate-500">현재 CTA는 관리자 로그인 및 구독 준비 흐름으로 연결됩니다.</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">결제 및 해지 안내</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
            <p>모든 플랜은 월 구독형 SaaS 상품입니다.</p>
            <p>구독 해지는 언제든 요청할 수 있으며, 환불은 결제일, 이용 이력, 서비스 제공 여부 및 관련 법령/약관 기준에 따라 검토 후 처리됩니다.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} className="btn-secondary" to={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
