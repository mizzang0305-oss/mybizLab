import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import type { BillingPlanCode } from '@/shared/lib/billingPlans';
import {
  PortOneCheckoutError,
  getPortOnePaymentErrorMessage,
  getPortOnePaymentSuccessMessage,
  launchPortOneCheckout,
} from '@/shared/lib/portoneCheckout';
import { BUSINESS_INFO, PRICING_PLANS, SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';

type CheckoutMessageTone = 'error' | 'info' | 'success';

interface CheckoutMessageState {
  text: string;
  tone: CheckoutMessageTone;
}

const setupChecklist = ['브랜드 기본값 정리', '공개 스토어 설정', '기본 CTA와 유입 동선 점검', '기본 운영 화면 연결', '초기 진단 결과 반영'] as const;

const comparisonRows = [
  { label: '공개 스토어', values: { FREE: '기본', PRO: '확장', VIP: '확장' } },
  { label: '문의 수집', values: { FREE: '준비', PRO: '실사용', VIP: '실사용' } },
  { label: '예약·웨이팅', values: { FREE: '-', PRO: '실사용', VIP: '실사용' } },
  { label: '고객 기억 축', values: { FREE: '기초', PRO: '핵심', VIP: '확장' } },
  { label: 'AI 운영 제안', values: { FREE: '기본', PRO: '추천', VIP: '심화' } },
  { label: '운영 리포트', values: { FREE: '-', PRO: '주요 요약', VIP: '심화 리포트' } },
] as const;

const planCodeMap: Record<(typeof PRICING_PLANS)[number]['name'], BillingPlanCode> = {
  FREE: 'free',
  PRO: 'pro',
  VIP: 'vip',
};

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

  return '결제 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

export function PricingPage() {
  const [searchParams] = useSearchParams();
  const [activePlan, setActivePlan] = useState<BillingPlanCode | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<CheckoutMessageState | null>(null);

  usePageMeta('마이비즈랩 요금제 | 고객-메모리 매출 시스템', SERVICE_DESCRIPTION);

  const redirectMessage = useMemo<CheckoutMessageState | null>(() => {
    const code = searchParams.get('code');
    const message = searchParams.get('message');
    const paymentId = searchParams.get('paymentId');

    if (code) {
      return {
        text: message || '결제가 완료되지 않았습니다. 다시 시도해 주세요.',
        tone: 'error',
      };
    }

    if (paymentId) {
      return {
        text: `결제창에서 돌아왔습니다. 결제 ID ${paymentId} 상태를 확인해 주세요.`,
        tone: 'info',
      };
    }

    return null;
  }, [searchParams]);

  const visibleMessage = checkoutMessage ?? redirectMessage;

  async function handleCheckout(plan: BillingPlanCode) {
    if (activePlan) {
      return;
    }

    try {
      setActivePlan(plan);
      setCheckoutMessage({
        text: '결제창을 준비하고 있습니다. 테스트 또는 실환경 설정이 올바르면 PortOne 결제로 이어집니다.',
        tone: 'info',
      });

      const { payment } = await launchPortOneCheckout(plan);

      if (!payment) {
        setCheckoutMessage({
          text: '결제창으로 이동했습니다. 모바일에서는 결제 후 다시 이 화면으로 돌아옵니다.',
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

      setCheckoutMessage({
        text: getPortOnePaymentSuccessMessage(payment),
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
            <h1 className="max-w-[12ch] text-balance font-display text-[2.35rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-5xl">
              고객 입력과 기억 구조에 맞는 요금제
            </h1>
            <p className="max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
              MyBiz는 일반 홈페이지 툴이 아니라 고객 입력 채널과 고객 기억 축을 운영하는 시스템입니다. 요금제도 그 운영 깊이에 맞춰 나뉩니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">초기 세팅비</p>
              <p className="mt-2 whitespace-nowrap font-display text-[1.85rem] font-black leading-none sm:text-3xl">390,000원부터</p>
              <p className="mt-2 text-sm text-slate-300">초기 공개 스토어 구성과 운영 흐름 정리를 위한 1회 비용입니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">월 구독</p>
              <p className="mt-2 whitespace-nowrap font-display text-[1.85rem] font-black leading-none sm:text-3xl">무료 ~ 149,000원</p>
              <p className="mt-2 text-sm text-slate-300">FREE, PRO, VIP 구조로 고객 입력 채널과 운영 깊이가 달라집니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">핵심 기준</p>
              <p className="mt-2 whitespace-nowrap font-display text-[1.85rem] font-black leading-none sm:text-3xl">고객 기억 축</p>
              <p className="mt-2 text-sm text-slate-300">문의, 예약, 웨이팅, 주문을 얼마나 깊게 연결할지가 플랜 차이의 핵심입니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">도입 문의</p>
              <p className="mt-2 whitespace-nowrap font-display text-[1.85rem] font-black leading-none sm:text-3xl">상담 기반</p>
              <p className="mt-2 text-sm text-slate-300">실매장 도입은 운영 방식과 채널 구성을 같이 보고 맞춤으로 안내합니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="section-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">도입 준비</span>
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">초기 세팅비</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">공개 유입, 기본 문구, 운영 흐름, 초기 AI 진단 구조를 정리하는 1회 도입 비용입니다.</p>
              </div>
            </div>
            <div className="rounded-3xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-sm font-semibold text-orange-200">안내 기준</p>
              <p className="mt-2 whitespace-nowrap font-display text-[2rem] font-black leading-none sm:text-4xl">390,000원부터</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {setupChecklist.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <Icons.Check className="mt-0.5 text-orange-600" size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a className="btn-secondary" href={`mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent('마이비즈랩 도입 상담 요청')}`}>
              도입 상담 요청
            </a>
            <p className="text-sm text-slate-500">실제 세팅 범위와 초기 비용은 매장 운영 구조를 보고 확정합니다.</p>
          </div>
        </article>

        <article className="section-card p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">운영 기준</span>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            <p>MyBiz는 가격보다 먼저 어떤 고객 입력 채널을 실제로 운영할지, 고객 기억 축을 얼마나 깊게 쌓을지부터 정해야 제대로 맞습니다.</p>
            <p>PRIVATE AI, 데이터 통제, 국내 운영 같은 신뢰 요소는 중요하지만, 첫 메시지는 고객 기억과 매출 개선 가치가 되어야 합니다.</p>
            <p>
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
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">월 구독</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">FREE / PRO / VIP</h2>
          <p className="text-sm text-slate-500 sm:text-base">실결제는 PortOne으로 이어지며, 환경이 준비되지 않은 경우 성공처럼 넘기지 않고 정확한 상태를 보여줍니다.</p>
        </div>

        {visibleMessage ? (
          <p className={getCheckoutMessageClassName(visibleMessage.tone)} role={visibleMessage.tone === 'error' ? 'alert' : 'status'}>
            {visibleMessage.text}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const planCode = planCodeMap[plan.name];
            const isBusy = activePlan === planCode;
            const isDisabled = activePlan !== null;

            return (
              <article
                key={plan.name}
                className={[
                  'section-card flex h-full flex-col p-6 sm:p-8',
                  plan.highlighted ? 'border-orange-200 shadow-[0_25px_65px_-35px_rgba(236,91,19,0.45)]' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">{plan.name}</p>
                    <p className="mt-3 whitespace-nowrap font-display text-[2rem] font-black leading-none text-slate-900 sm:text-3xl">{plan.priceLabel}</p>
                  </div>
                  {plan.highlighted ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">추천</span> : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-500 sm:text-base">{plan.summary}</p>

                <ul className="mt-6 space-y-3 text-sm text-slate-700 sm:text-base">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Icons.Check className="mt-0.5 text-orange-600" size={18} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  <button
                    className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                    data-plan={planCode}
                    disabled={isDisabled}
                    onClick={() => {
                      void handleCheckout(planCode);
                    }}
                    type="button"
                  >
                    {isBusy ? '결제창 준비 중...' : plan.name === 'FREE' ? 'FREE 시작' : '구독 결제'}
                  </button>
                  <p className="text-xs leading-6 text-slate-500">
                    {plan.name === 'FREE'
                      ? 'FREE는 공개 유입과 기본 진단을 중심으로 시작하는 플랜입니다.'
                      : `${plan.name}는 고객 입력 채널과 고객 기억 축을 더 깊게 운영하는 플랜입니다.`}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-6 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">비교 기준</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">무엇이 달라지는지 한눈에 보기</h2>
          <p className="text-sm text-slate-500 sm:text-base">플랜 차이는 단순 카드 수가 아니라, 어떤 채널과 어떤 기억 구조를 운영할 수 있느냐에 있습니다.</p>
        </div>

        <div className="hidden overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] lg:block">
          <div className="grid grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="px-6 py-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">운영 항목</div>
            {PRICING_PLANS.map((plan) => (
              <div key={plan.name} className="border-l border-slate-200 px-4 py-5 text-center">
                <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.priceLabel}</p>
              </div>
            ))}
          </div>

          {comparisonRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] border-b border-slate-100 last:border-b-0">
              <div className="px-6 py-5 text-sm font-semibold text-slate-700">{row.label}</div>
              {PRICING_PLANS.map((plan) => (
                <div key={`${row.label}-${plan.name}`} className="flex items-center justify-center border-l border-slate-100 px-4 py-5 text-sm text-slate-700">
                  {row.values[plan.name]}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:hidden">
          {PRICING_PLANS.map((plan) => (
            <details key={plan.name} className="section-card overflow-hidden p-0" open={plan.name === 'PRO'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                  <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{plan.priceLabel}</p>
                </div>
                {plan.highlighted ? <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">추천</span> : null}
              </summary>
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="space-y-3">
                  {comparisonRows.map((row) => (
                    <div key={`${plan.name}-${row.label}`} className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-slate-600">{row.label}</span>
                      <span>{row.values[plan.name]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_-40px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">다음 단계</p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-tight text-slate-900">먼저 진단으로 시작하는 편이 가장 안전합니다</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              현재 매장에 필요한 채널이 문의인지, 예약·웨이팅인지, 주문과 공개 유입인지 먼저 확인하면 결제 이전에도 어떤 플랜이 맞는지 훨씬 명확해집니다.
            </p>
          </div>
          <Link className="btn-primary" to="/onboarding">
            무료 진단으로 시작
          </Link>
        </div>
      </section>
    </main>
  );
}
