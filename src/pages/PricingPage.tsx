import { Link } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { BUSINESS_INFO, LEGAL_LINKS, PRICING_PLANS, SERVICE_TAGLINE, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

type PricingTier = 'Starter' | 'Pro' | 'Business' | 'Enterprise';
type CompareValue = boolean | 'basic' | 'advanced' | 'enterprise' | 'consult';

const setupFeeItems = ['브랜드 페이지 구축', '메뉴 등록', 'QR 주문 세팅', '관리자 계정 생성', 'AI 초기 분석 세팅'] as const;

const enterpriseHighlights = ['본사 통합 관리', '멀티 매장 운영', '맞춤 구축'] as const;

const onboardingSteps = ['스토어 생성 요청', '검수/승인', '초기 세팅 진행', '월 구독 시작'] as const;

const comparisonRows: Array<{ app: string; values: Record<PricingTier, CompareValue> }> = [
  { app: 'AI 점장', values: { Starter: true, Pro: true, Business: true, Enterprise: true } },
  { app: 'AI 비즈니스 리포트', values: { Starter: false, Pro: true, Business: true, Enterprise: true } },
  { app: '고객 관리', values: { Starter: false, Pro: true, Business: true, Enterprise: true } },
  { app: '예약 관리', values: { Starter: false, Pro: true, Business: true, Enterprise: true } },
  { app: '일정 관리', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { app: '설문 조사', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { app: '브랜드 관리', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { app: '매출 분석', values: { Starter: 'basic', Pro: 'advanced', Business: 'advanced', Enterprise: 'enterprise' } },
  { app: '주문 관리', values: { Starter: true, Pro: true, Business: true, Enterprise: true } },
  { app: '웨이팅보드', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { app: '전자계약', values: { Starter: false, Pro: false, Business: false, Enterprise: true } },
  { app: 'QR 테이블오더', values: { Starter: true, Pro: true, Business: true, Enterprise: true } },
];

const comparePlans: Array<{
  name: PricingTier;
  priceLabel: string;
  note: string;
  badge?: string;
  tone?: 'default' | 'accent';
}> = [
  { name: 'Starter', priceLabel: '월 29,000원', note: '매장 1개' },
  { name: 'Pro', priceLabel: '월 79,000원', note: '매장 3개', badge: '추천' },
  { name: 'Business', priceLabel: '월 149,000원', note: '최대 10개 매장' },
  { name: 'Enterprise', priceLabel: '별도 상담', note: '10개 이상 별도 상담', badge: 'Franchise', tone: 'accent' },
];

function renderCompareValue(value: CompareValue) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
        <Icons.Check size={16} />
        포함
      </span>
    );
  }

  if (value === false) {
    return <span className="text-lg font-semibold text-slate-300">-</span>;
  }

  const labelMap: Record<Exclude<CompareValue, boolean>, string> = {
    basic: 'basic',
    advanced: 'advanced',
    enterprise: 'enterprise',
    consult: '별도 상담',
  };

  const toneMap: Record<Exclude<CompareValue, boolean>, string> = {
    basic: 'bg-slate-100 text-slate-700',
    advanced: 'bg-orange-100 text-orange-700',
    enterprise: 'bg-emerald-100 text-emerald-700',
    consult: 'bg-violet-100 text-violet-700',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneMap[value]}`}>{labelMap[value]}</span>;
}

function getPlanCta(planName: PricingTier) {
  if (planName === 'Enterprise') {
    return {
      label: '상담 요청',
      href: `mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent('Enterprise 상담 요청')}`,
      external: true,
      className:
        'inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800',
    } as const;
  }

  return {
    label: '구독 시작',
    href: SUBSCRIPTION_START_PATH,
    external: false,
    className: 'btn-primary w-full justify-center',
  } as const;
}

export function PricingPage() {
  usePageMeta('요금제', '마이비즈랩의 초기 세팅비, 월 구독 요금제, 앱 포함 기능 비교를 확인하세요.');

  return (
    <main className="page-shell py-12 sm:py-16">
      <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14 lg:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.48),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,237,213,0.18),_transparent_25%)]" />
        <div className="relative space-y-6">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-200">
            Pricing
          </span>
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">월 구독형 SaaS 요금제</h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              {SERVICE_TAGLINE}. 초기 세팅비는 1회성, 구독은 월별로 운영되며 매장 규모에 맞는 도입 구조를 한눈에 확인할 수 있습니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">초기 세팅비</p>
              <p className="mt-2 font-display text-3xl font-black">390,000원부터</p>
              <p className="mt-2 text-sm text-slate-300">스토어 구축 및 운영 시작을 위한 1회성 비용</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">월 구독</p>
              <p className="mt-2 font-display text-3xl font-black">29,000원부터</p>
              <p className="mt-2 text-sm text-slate-300">운영 단계에 따라 Starter부터 Enterprise까지 선택</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">Business 범위</p>
              <p className="mt-2 font-display text-3xl font-black">최대 10개</p>
              <p className="mt-2 text-sm text-slate-300">브랜드 단위 운영과 자동화를 고려한 확장형 플랜</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">Enterprise</p>
              <p className="mt-2 font-display text-3xl font-black">별도 상담</p>
              <p className="mt-2 text-sm text-slate-300">10개 초과 매장과 프랜차이즈를 위한 맞춤 구축</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="section-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">1회성 비용</span>
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">초기 세팅비</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">스토어 구축 및 운영 시작을 위한 1회성 비용</p>
              </div>
            </div>
            <div className="rounded-3xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-sm font-semibold text-orange-200">가격 예시</p>
              <p className="mt-2 font-display text-4xl font-black">390,000원부터</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {setupFeeItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <Icons.Check className="mt-0.5 text-orange-600" size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">요금 구조 안내</span>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            <p>초기 세팅비는 스토어 오픈을 위한 1회성 비용이고, 구독형 SaaS 요금제는 운영 기간 동안 월별로 청구됩니다.</p>
            <p>초기 구축 후에는 요금제에 따라 앱 포함 범위와 매장 수, 분석 깊이가 달라집니다.</p>
            <p>
              고객센터: {BUSINESS_INFO.customerCenter}
              <br />
              문의 이메일:{' '}
              <a className="font-semibold text-orange-700" href={`mailto:${BUSINESS_INFO.email}`}>
                {BUSINESS_INFO.email}
              </a>
            </p>
          </div>
        </article>
      </section>

      <section className="mt-10">
        <div className="mb-6 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">월별 구독</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">운영 규모에 맞는 플랜 선택</h2>
          <p className="text-sm text-slate-500 sm:text-base">초기 세팅비 이후에는 월 구독형 SaaS 요금제로 운영됩니다. Pro는 가장 빠르게 확장하기 좋은 추천 플랜입니다.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          {comparePlans.map((plan) => {
            const isEnterprise = plan.name === 'Enterprise';
            const basePlan = PRICING_PLANS.find((item) => item.name === plan.name);
            const cta = getPlanCta(plan.name);
            const highlights = isEnterprise ? enterpriseHighlights : basePlan?.features ?? [];

            return (
              <article
                key={plan.name}
                className={[
                  'section-card flex h-full flex-col p-6 sm:p-8',
                  plan.badge === '추천' ? 'border-orange-200 shadow-[0_25px_65px_-35px_rgba(236,91,19,0.45)]' : '',
                  plan.tone === 'accent' ? 'border-slate-900 bg-slate-950 text-white shadow-[0_25px_70px_-35px_rgba(15,23,42,0.8)]' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-sm font-bold uppercase tracking-[0.18em] ${plan.tone === 'accent' ? 'text-orange-200' : 'text-orange-600'}`}>{plan.name}</p>
                    <p className={`mt-3 font-display text-3xl font-black ${plan.tone === 'accent' ? 'text-white' : 'text-slate-900'}`}>{plan.priceLabel}</p>
                  </div>
                  {plan.badge ? (
                    <span
                      className={[
                        'rounded-full px-3 py-1 text-xs font-bold',
                        plan.tone === 'accent' ? 'bg-white/10 text-orange-200' : 'bg-orange-100 text-orange-700',
                      ].join(' ')}
                    >
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <p className={`mt-4 text-sm leading-6 sm:text-base ${plan.tone === 'accent' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {isEnterprise ? '10개 초과 매장 / 프랜차이즈 전용' : basePlan?.summary}
                </p>

                <div className={`mt-5 rounded-3xl px-4 py-4 ${plan.tone === 'accent' ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-bold uppercase tracking-[0.18em] ${plan.tone === 'accent' ? 'text-slate-300' : 'text-slate-500'}`}>{isEnterprise ? '상담 범위' : '운영 범위'}</p>
                  <p className={`mt-2 text-sm font-semibold ${plan.tone === 'accent' ? 'text-white' : 'text-slate-900'}`}>{plan.note}</p>
                </div>

                <ul className={`mt-6 space-y-3 text-sm sm:text-base ${plan.tone === 'accent' ? 'text-slate-200' : 'text-slate-700'}`}>
                  {highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Icons.Check className={plan.tone === 'accent' ? 'mt-0.5 text-orange-200' : 'mt-0.5 text-orange-600'} size={18} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  {cta.external ? (
                    <a className={cta.className} href={cta.href}>
                      {cta.label}
                    </a>
                  ) : (
                    <Link className={cta.className} to={cta.href}>
                      {cta.label}
                    </Link>
                  )}
                  <p className={`text-xs leading-5 ${plan.tone === 'accent' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isEnterprise ? '10개 이상 매장, 프랜차이즈, 맞춤 구축은 별도 상담으로 진행됩니다.' : '현재 CTA는 관리자 로그인 및 구독 준비 흐름으로 연결됩니다.'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-6 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">기능 비교</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">앱 포함 기능 비교</h2>
          <p className="text-sm text-slate-500 sm:text-base">각 플랜에서 어떤 운영 앱을 사용할 수 있는지 한 번에 비교할 수 있습니다.</p>
        </div>

        <div className="hidden overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] lg:block">
          <div className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="px-6 py-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">포함 앱</div>
            {comparePlans.map((plan) => (
              <div key={plan.name} className="border-l border-slate-200 px-4 py-5 text-center">
                <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.note}</p>
              </div>
            ))}
          </div>

          {comparisonRows.map((row) => (
            <div key={row.app} className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] border-b border-slate-100 last:border-b-0">
              <div className="px-6 py-5 text-sm font-semibold text-slate-700">{row.app}</div>
              {comparePlans.map((plan) => (
                <div key={plan.name} className="flex items-center justify-center border-l border-slate-100 px-4 py-5 text-sm">
                  {renderCompareValue(row.values[plan.name])}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:hidden">
          {comparePlans.map((plan) => (
            <details key={plan.name} className="section-card overflow-hidden p-0" open={plan.name === 'Pro'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{plan.priceLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-orange-600">{plan.note}</p>
                  {plan.badge ? <span className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">{plan.badge}</span> : null}
                </div>
              </summary>
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="space-y-3">
                  {comparisonRows.map((row) => (
                    <div key={`${plan.name}-${row.app}`} className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-slate-600">{row.app}</span>
                      <span>{renderCompareValue(row.values[plan.name])}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-6 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">도입 절차</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">서비스 도입 절차</h2>
          <p className="text-sm text-slate-500 sm:text-base">상담과 검수를 거쳐 초기 세팅이 끝나면 월 구독이 시작됩니다.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {onboardingSteps.map((step, index) => (
            <article key={step} className="section-card p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 font-display text-lg font-black text-orange-700">
                0{index + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{step}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {index === 0 && '도입할 스토어와 운영 범위를 전달하면 적합한 요금 구조와 세팅 범위를 안내합니다.'}
                {index === 1 && '사업자 정보와 운영 구조를 기준으로 서비스 제공 가능 여부와 세팅 범위를 확인합니다.'}
                {index === 2 && '브랜드 페이지, 메뉴, QR 주문, 관리자 계정, AI 초기 분석 세팅을 진행합니다.'}
                {index === 3 && '세팅 완료 후 운영 상태에 맞는 플랜으로 월 구독이 시작됩니다.'}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">결제 및 해지 안내</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
            <p>초기 세팅비는 1회성 비용이고, 구독은 월별 청구됩니다.</p>
            <p>구독 해지 및 환불 요청은 결제일, 이용 이력, 서비스 제공 여부 및 관련 법령과 정책 기준에 따라 검토됩니다.</p>
            <p>고객센터: {BUSINESS_INFO.customerCenter}</p>
            <p>
              문의 이메일:{' '}
              <a className="font-semibold text-orange-700" href={`mailto:${BUSINESS_INFO.email}`}>
                {BUSINESS_INFO.email}
              </a>
            </p>
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
