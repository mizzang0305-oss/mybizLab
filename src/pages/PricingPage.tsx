import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import type { BillingPlanCode } from '@/shared/lib/billingPlans';
import {
  PortOneCheckoutError,
  getPortOnePaymentErrorMessage,
<<<<<<< HEAD
  getPortOneVerifyMessage,
  launchPortOneCheckout,
  verifyCheckoutPayment,
=======
  getPortOnePaymentSuccessMessage,
  launchPortOneCheckout,
>>>>>>> 84c4d6c (Fix billing checkout env errors)
} from '@/shared/lib/portoneCheckout';
import { BUSINESS_INFO, LEGAL_LINKS, SERVICE_TAGLINE } from '@/shared/lib/siteConfig';

type PricingTier = 'Starter' | 'Pro' | 'Business' | 'Enterprise';
type CompareValue = boolean | 'basic' | 'advanced' | 'enterprise' | 'consult';
type CheckoutMessageTone = 'error' | 'info' | 'success';

interface CheckoutMessageState {
  text: string;
  tone: CheckoutMessageTone;
}

const setupFeeItems = ['브랜드 페이지 구축', '메뉴 등록', 'QR 주문 세팅', '관리자 계정 생성', 'AI 초기 분석 세팅'] as const;

const enterpriseHighlights = ['본사 통합 관리', '멀티 매장 운영', '맞춤 구축'] as const;

const onboardingSteps = ['스토어 생성 요청', '결제 정보 확인', '초기 세팅 진행', '월 구독 시작'] as const;

const comparisonRows: Array<{ feature: string; values: Record<PricingTier, CompareValue> }> = [
  { feature: 'AI 매장 분석', values: { Starter: true, Pro: true, Business: true, Enterprise: true } },
  { feature: 'AI 비즈니스 리포트', values: { Starter: false, Pro: true, Business: true, Enterprise: true } },
  { feature: '고객 관리', values: { Starter: false, Pro: true, Business: true, Enterprise: true } },
  { feature: '예약 관리', values: { Starter: false, Pro: true, Business: true, Enterprise: true } },
  { feature: '스케줄 관리', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { feature: '설문 조사', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { feature: '브랜드 관리', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { feature: '매출 분석', values: { Starter: 'basic', Pro: 'advanced', Business: 'advanced', Enterprise: 'enterprise' } },
  { feature: '주문 관리', values: { Starter: true, Pro: true, Business: true, Enterprise: true } },
  { feature: '대기열 운영', values: { Starter: false, Pro: false, Business: true, Enterprise: true } },
  { feature: '전자계약', values: { Starter: false, Pro: false, Business: false, Enterprise: true } },
  { feature: 'QR 테이블오더', values: { Starter: true, Pro: true, Business: true, Enterprise: true } },
];

const pricingCards: Array<{
  badge?: string;
  code?: BillingPlanCode;
  ctaNote: string;
  features: readonly string[];
  name: PricingTier;
  note: string;
  priceLabel: string;
  summary: string;
  tone?: 'default' | 'accent';
}> = [
  {
    code: 'starter',
    ctaNote: '월 29,000원으로 가장 빠르게 구독을 시작할 수 있습니다.',
    features: ['매장 1개', 'AI 매장 분석', '기본 매출 리포트', 'QR 주문'],
    name: 'Starter',
    note: '매장 1개',
    priceLabel: '월 29,000원',
    summary: '첫 매장을 빠르게 운영하고 싶은 팀을 위한 기본 플랜입니다.',
  },
  {
    badge: '추천',
    code: 'pro',
    ctaNote: '결제창이 열리면 Pro 월 구독 결제를 바로 진행할 수 있습니다.',
    features: ['매장 3개', 'AI 매니저', 'AI 리포트', '고객 관리', '예약 관리'],
    name: 'Pro',
    note: '매장 3개',
    priceLabel: '월 79,000원',
    summary: '여러 매장을 함께 운영하고 리포트와 고객 관리를 강화하는 팀에 맞습니다.',
  },
  {
    code: 'business',
    ctaNote: 'Business 월 구독은 최대 10개 매장까지 같은 결제 흐름으로 연결됩니다.',
    features: ['매장 최대 10개', 'AI 자동 분석', 'CRM 연동 준비', '브랜드 운영'],
    name: 'Business',
    note: '최대 10개 매장',
    priceLabel: '월 149,000원',
    summary: '브랜드 단위 운영과 확장 흐름을 고려한 팀에 맞는 플랜입니다.',
  },
  {
    badge: 'Franchise',
    ctaNote: '10개 이상 매장이나 프랜차이즈 운영은 상담으로 진행합니다.',
    features: enterpriseHighlights,
    name: 'Enterprise',
    note: '10개 이상 별도 상담',
    priceLabel: '별도 상담',
    summary: '다점포 운영과 별도 구축이 필요한 조직을 위한 전용 요금제입니다.',
    tone: 'accent',
  },
] as const;

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
    advanced: 'advanced',
    basic: 'basic',
    consult: '별도 상담',
    enterprise: 'enterprise',
  };

  const toneMap: Record<Exclude<CompareValue, boolean>, string> = {
    advanced: 'bg-orange-100 text-orange-700',
    basic: 'bg-slate-100 text-slate-700',
    consult: 'bg-violet-100 text-violet-700',
    enterprise: 'bg-emerald-100 text-emerald-700',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneMap[value]}`}>{labelMap[value]}</span>;
}

function getPlanCta(planName: PricingTier) {
  if (planName === 'Enterprise') {
    return {
      action: 'external',
      className:
        'inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800',
      href: `mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent('Enterprise 상담 요청')}`,
      label: '상담 요청',
    } as const;
  }

  const codeMap: Record<Exclude<PricingTier, 'Enterprise'>, BillingPlanCode> = {
    Business: 'business',
    Pro: 'pro',
    Starter: 'starter',
  };

  return {
    action: 'checkout',
    className: 'btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60',
    label: '구독 시작',
    plan: codeMap[planName],
  } as const;
}

function getCheckoutMessageClassName(tone: CheckoutMessageTone) {
  if (tone === 'success') {
    return 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700';
  }

  if (tone === 'error') {
    return 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700';
  }

  return 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700';
}

function getCheckoutErrorMessage(error: unknown) {
  if (error instanceof PortOneCheckoutError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return '결제 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export function PricingPage() {
  const [searchParams] = useSearchParams();
  const [activePlan, setActivePlan] = useState<BillingPlanCode | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<CheckoutMessageState | null>(null);

  usePageMeta('요금제', '마이비즈랩의 초기 세팅비와 월 구독 요금제, 포함 기능, 결제 흐름을 안내합니다.');

  const redirectCode = searchParams.get('code');
  const redirectMessage = searchParams.get('message');
  const redirectPaymentId = searchParams.get('paymentId');
  const redirectBanner =
    redirectCode && redirectMessage
      ? {
          text: `결제가 완료되지 않았습니다. ${redirectMessage}`,
          tone: 'error' as const,
        }
      : redirectPaymentId
        ? {
            text: `결제창에서 돌아왔습니다. 결제 ID ${redirectPaymentId} 상태를 확인해주세요.`,
            tone: 'info' as const,
          }
        : null;
  const visibleMessage = checkoutMessage ?? redirectBanner;

  async function handleCheckout(plan: BillingPlanCode) {
    if (activePlan) {
      return;
    }

    try {
      setActivePlan(plan);
      setCheckoutMessage({
        text: '결제창을 준비하고 있습니다. 팝업 차단이 켜져 있으면 해제해주세요.',
        tone: 'info',
      });

      const { payment } = await launchPortOneCheckout(plan);

      if (!payment) {
        setCheckoutMessage({
          text: '결제창으로 이동했습니다. 모바일에서는 결제 완료 후 이 페이지로 다시 돌아옵니다.',
          tone: 'info',
        });
        return;
      }

      if (payment.code) {
        setCheckoutMessage({
          text: getPortOnePaymentErrorMessage(payment),
          tone: 'error',
        });
        return;
      }

<<<<<<< HEAD
      const verification = await verifyCheckoutPayment(payment.paymentId);
      setCheckoutMessage({
        text: getPortOneVerifyMessage(verification),
=======
      setCheckoutMessage({
        text: getPortOnePaymentSuccessMessage(payment),
>>>>>>> 84c4d6c (Fix billing checkout env errors)
        tone: 'success',
      });
    } catch (error) {
      setCheckoutMessage({
        text: getCheckoutErrorMessage(error),
        tone: 'error',
      });
    } finally {
      setActivePlan(null);
    }
  }

  return (
    <main className="page-shell py-12 sm:py-16">
      <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14 lg:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.48),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,237,213,0.18),_transparent_25%)]" />
        <div className="relative space-y-6">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-200">
            Pricing
          </span>
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">구독형 SaaS 요금제</h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              {SERVICE_TAGLINE}. 초기 세팅비는 1회성으로 운영 시작 전에 결제하고, 월 구독은 매장 규모에 맞는 플랜으로 이어집니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">초기 세팅비</p>
<<<<<<< HEAD
              <p className="mt-2 font-display text-3xl font-black">390,000원</p>
=======
              <p className="mt-2 font-display text-3xl font-black">390,000원부터</p>
>>>>>>> 84c4d6c (Fix billing checkout env errors)
              <p className="mt-2 text-sm text-slate-300">스토어 구축과 운영 시작을 위한 1회성 비용입니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">월 구독</p>
              <p className="mt-2 font-display text-3xl font-black">29,000원부터</p>
              <p className="mt-2 text-sm text-slate-300">Starter부터 Business까지 같은 checkout 흐름으로 바로 결제를 시작합니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">Business 범위</p>
              <p className="mt-2 font-display text-3xl font-black">최대 10개</p>
              <p className="mt-2 text-sm text-slate-300">브랜드 단위 운영과 다점포 관리를 고려한 확장 플랜입니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">Enterprise</p>
              <p className="mt-2 font-display text-3xl font-black">별도 상담</p>
              <p className="mt-2 text-sm text-slate-300">10개 초과 매장이나 프랜차이즈는 상담 후 맞춤 구축으로 진행합니다.</p>
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
                <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">스토어 구축과 운영 시작을 위한 1회성 비용입니다.</p>
              </div>
            </div>
            <div className="rounded-3xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-sm font-semibold text-orange-200">가격 예시</p>
              <p className="mt-2 font-display text-4xl font-black">390,000원</p>
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
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="btn-secondary"
              href={`mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent('초기 세팅 상담 요청')}`}
            >
              초기 세팅 상담
            </a>
            <p className="text-sm text-slate-500">세팅비 결제는 상담 후 일정과 범위를 확인한 뒤 별도로 안내합니다.</p>
          </div>
        </article>

        <article className="section-card p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">요금 구조 안내</span>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            <p>초기 세팅비는 스토어 세팅과 운영 시작을 위한 1회성 비용이고, 구독형 SaaS 요금제는 월 단위로 청구됩니다.</p>
            <p>구독 플랜에 따라 포함 기능과 운영 범위, 분석 깊이가 달라집니다.</p>
            <p>
              고객센터: {BUSINESS_INFO.customerCenter}
              <br />
              문의 이메일{' '}
              <a className="font-semibold text-orange-700" href={`mailto:${BUSINESS_INFO.email}`}>
                {BUSINESS_INFO.email}
              </a>
            </p>
          </div>
        </article>
      </section>

      <section className="mt-10">
        <div className="mb-6 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">월간 구독</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">운영 규모에 맞는 플랜 선택</h2>
          <p className="text-sm text-slate-500 sm:text-base">Starter, Pro, Business는 이제 바로 checkout API와 PortOne 결제창으로 연결됩니다.</p>
        </div>

        {visibleMessage ? (
          <p className={getCheckoutMessageClassName(visibleMessage.tone)} role={visibleMessage.tone === 'error' ? 'alert' : 'status'}>
            {visibleMessage.text}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-4">
          {pricingCards.map((plan) => {
            const isEnterprise = plan.name === 'Enterprise';
            const cta = getPlanCta(plan.name);
            const isBusy = cta.action === 'checkout' && activePlan === cta.plan;
            const isDisabled = cta.action === 'checkout' && activePlan !== null;

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

                <p className={`mt-4 text-sm leading-6 sm:text-base ${plan.tone === 'accent' ? 'text-slate-300' : 'text-slate-500'}`}>{plan.summary}</p>

                <div className={`mt-5 rounded-3xl px-4 py-4 ${plan.tone === 'accent' ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-bold uppercase tracking-[0.18em] ${plan.tone === 'accent' ? 'text-slate-300' : 'text-slate-500'}`}>{isEnterprise ? '상담 범위' : '운영 범위'}</p>
                  <p className={`mt-2 text-sm font-semibold ${plan.tone === 'accent' ? 'text-white' : 'text-slate-900'}`}>{plan.note}</p>
                </div>

                <ul className={`mt-6 space-y-3 text-sm sm:text-base ${plan.tone === 'accent' ? 'text-slate-200' : 'text-slate-700'}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Icons.Check className={plan.tone === 'accent' ? 'mt-0.5 text-orange-200' : 'mt-0.5 text-orange-600'} size={18} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  {cta.action === 'external' ? (
                    <a className={cta.className} href={cta.href}>
                      {cta.label}
                    </a>
                  ) : (
                    <button
                      className={cta.className}
                      data-plan={cta.plan}
                      disabled={isDisabled}
                      onClick={() => {
                        void handleCheckout(cta.plan);
                      }}
                      type="button"
                    >
                      {isBusy ? '결제창 준비 중...' : cta.label}
                    </button>
                  )}
                  <p className={`text-xs leading-5 ${plan.tone === 'accent' ? 'text-slate-400' : 'text-slate-500'}`}>{plan.ctaNote}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-6 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">기능 비교</span>
<<<<<<< HEAD
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">포함 기능 비교</h2>
=======
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">앱 포함 기능 비교</h2>
>>>>>>> 84c4d6c (Fix billing checkout env errors)
          <p className="text-sm text-slate-500 sm:text-base">각 플랜에서 어떤 운영 영역을 사용할 수 있는지 한 번에 비교할 수 있습니다.</p>
        </div>

        <div className="hidden overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] lg:block">
          <div className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="px-6 py-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">포함 기능</div>
            {pricingCards.map((plan) => (
              <div key={plan.name} className="border-l border-slate-200 px-4 py-5 text-center">
                <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.note}</p>
              </div>
            ))}
          </div>

          {comparisonRows.map((row) => (
            <div key={row.feature} className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] border-b border-slate-100 last:border-b-0">
              <div className="px-6 py-5 text-sm font-semibold text-slate-700">{row.feature}</div>
              {pricingCards.map((plan) => (
                <div key={plan.name} className="flex items-center justify-center border-l border-slate-100 px-4 py-5 text-sm">
                  {renderCompareValue(row.values[plan.name])}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:hidden">
          {pricingCards.map((plan) => (
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
                    <div key={`${plan.name}-${row.feature}`} className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-slate-600">{row.feature}</span>
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
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">서비스 도입 순서</h2>
          <p className="text-sm text-slate-500 sm:text-base">상담과 결제를 거친 뒤 초기 세팅이 끝나면 월 구독이 시작됩니다.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {onboardingSteps.map((step, index) => (
            <article key={step} className="section-card p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 font-display text-lg font-black text-orange-700">
                0{index + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{step}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {index === 0 && '도입할 스토어 수와 운영 범위를 알려주시면 적합한 요금 구조와 세팅 범위를 안내합니다.'}
                {index === 1 && '결제 정보와 운영 환경을 확인한 뒤 실제 checkout 또는 상담 흐름을 확정합니다.'}
                {index === 2 && '브랜드 페이지, 메뉴, QR 주문, 관리자 계정, AI 초기 분석 세팅을 진행합니다.'}
                {index === 3 && '세팅이 끝나면 운영 상태에 맞는 플랜으로 월 구독이 시작됩니다.'}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">결제 및 이용 안내</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
            <p>초기 세팅비는 1회성 비용이고, 월 구독은 정기 청구됩니다.</p>
            <p>구독 해지와 환불 요청은 결제 이력, 서비스 제공 여부, 관련 법령과 정책 기준에 따라 검토됩니다.</p>
            <p>고객센터: {BUSINESS_INFO.customerCenter}</p>
            <p>
              문의 이메일{' '}
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
