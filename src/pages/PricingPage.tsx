import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import type { BillingPlanCode } from '@/shared/lib/billingPlans';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_PRODUCT_CODE, formatKrw, formatProductKrw } from '@/shared/lib/platformAdminConfig';
import {
  PortOneCheckoutError,
  getPortOnePaymentErrorMessage,
  getPortOnePaymentSuccessMessage,
  launchPortOneCheckout,
} from '@/shared/lib/portoneCheckout';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformPricingContent } from '@/shared/lib/services/platformAdminContentService';
import { BUSINESS_INFO, SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';

type CheckoutMessageTone = 'error' | 'info' | 'success';

interface CheckoutMessageState {
  text: string;
  tone: CheckoutMessageTone;
}

const setupChecklist = ['브랜드 기본값 정리', '공개 스토어 설정', '기본 CTA와 고객 행동 연결', '기본 운영 화면 연결', '초기 진단 결과 반영'] as const;

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
    if (error.code === 'FUNCTION_INVOCATION_FAILED' || error.code === 'PORTONE_BROWSER_ENV_MISSING') {
      return '결제 설정이 아직 완료되지 않았습니다. 관리자 결제 이벤트와 PortOne 설정을 확인해 주세요.';
    }
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    if (/FUNCTION_INVOCATION_FAILED/i.test(error.message)) {
      return '결제 설정이 아직 완료되지 않았습니다. 관리자 결제 이벤트와 PortOne 설정을 확인해 주세요.';
    }
    return error.message.trim();
  }

  return '결제 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

export function PricingPage() {
  const [searchParams] = useSearchParams();
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<CheckoutMessageState | null>(null);
  const pricingQuery = useQuery({
    queryKey: queryKeys.publicPlatformPricing(searchParams.get('testPayment')),
    queryFn: () => getPublicPlatformPricingContent(searchParams),
  });

  usePageMeta('MyBiz 요금제 | 고객 기억 기반 매출 AI SaaS', SERVICE_DESCRIPTION);

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
  const pricing = pricingQuery.data;
  const plans = pricing?.plans || FALLBACK_PRICING_PLANS;
  const testProducts = pricing?.testProducts || [];

  async function handleCheckout(plan: BillingPlanCode) {
    if (plan === 'free') {
      return;
    }

    try {
      setActivePlan(plan);
      setCheckoutMessage({
        text: '결제창을 준비하고 있습니다. 실제 결제 성공 후에만 구독 권한이 적용됩니다.',
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

  async function handlePaymentTest() {
    const testProduct = testProducts.find((product) => product.product_code === PAYMENT_TEST_PRODUCT_CODE);
    if (!testProduct) return;

    try {
      setActivePlan(PAYMENT_TEST_PRODUCT_CODE);
      setCheckoutMessage({
        text: '100원 테스트 결제창을 준비하고 있습니다. 이 결제는 구독 권한을 변경하지 않습니다.',
        tone: 'info',
      });

      const { payment } = await launchPortOneCheckout('pro', {
        billingProductCode: PAYMENT_TEST_PRODUCT_CODE,
        customData: {
          grantsEntitlement: false,
          productCode: PAYMENT_TEST_PRODUCT_CODE,
          purpose: 'payment_test',
        },
        orderName: testProduct.order_name || testProduct.product_name,
        redirectPath: '/pricing?testPayment=1',
        source: 'public-pricing-test-payment',
      });

      if (payment?.code) {
        setCheckoutMessage({
          text: getPortOnePaymentErrorMessage(payment),
          tone: 'error',
        });
      } else {
        setCheckoutMessage({
          text: '100원 테스트 결제가 완료되었습니다. 구독 권한은 변경되지 않았습니다.',
          tone: 'success',
        });
      }
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
            <h1 className="max-w-3xl text-balance font-display text-[2.35rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-5xl">
              고객 기억이 쌓이는 속도에 맞춰 확장하세요
            </h1>
            <p className="max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
              무료로 시작하고, 고객 기억이 쌓이면 PRO/VIP로 확장하세요. 결제 전 플랜과 제공 범위를 명확히 확인할 수 있고,
              FREE는 유료 결제 없이 시작합니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">무료 시작</p>
              <p className="mt-2 font-display text-3xl font-black">FREE</p>
              <p className="mt-2 text-sm text-slate-300">공개 스토어와 기본 진단으로 고객 접점을 먼저 엽니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">운영 확장</p>
              <p className="mt-2 font-display text-3xl font-black">PRO</p>
              <p className="mt-2 text-sm text-slate-300">고객 관리, 예약 운영, AI 운영 리포트를 함께 봅니다.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-orange-200">성장 분석</p>
              <p className="mt-2 font-display text-3xl font-black">VIP</p>
              <p className="mt-2 text-sm text-slate-300">반복 매출과 운영 자동화 인사이트를 더 깊게 봅니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="section-card p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">도입 준비</span>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-900">초기 설정</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
            공개 스토어와 고객 입력 채널을 실제 매장 운영 흐름에 맞게 정리합니다.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {setupChecklist.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <Icons.Check className="mt-0.5 text-orange-600" size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">운영 기준</span>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            <p>FREE는 결제 없이 시작할 수 있고, PRO/VIP는 선택한 플랜 기준으로 결제가 진행됩니다.</p>
            <p>추천 배지와 할인 표시는 이해를 돕는 안내이며, 실제 결제 금액은 서버의 상품 기준으로 확인됩니다.</p>
            <p>
              문의 메일{' '}
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
          <p className="text-sm text-slate-500 sm:text-base">매장 상황에 맞춰 무료 시작, 운영 확장, 성장 분석 단계로 선택할 수 있습니다.</p>
        </div>

        {visibleMessage ? (
          <p className={getCheckoutMessageClassName(visibleMessage.tone)} role={visibleMessage.tone === 'error' ? 'alert' : 'status'}>
            {visibleMessage.text}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          {plans.map((plan) => {
            const isFree = plan.plan_code === 'free';
            const isBusy = activePlan === plan.plan_code;
            return (
              <article
                key={plan.plan_code}
                className={[
                  'section-card flex h-full flex-col p-6 sm:p-8',
                  plan.is_recommended ? 'border-orange-200 shadow-[0_25px_65px_-35px_rgba(236,91,19,0.45)]' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">{plan.display_name}</p>
                    <p className="mt-3 whitespace-nowrap font-display text-[2rem] font-black leading-none text-slate-900 sm:text-3xl">
                      {formatKrw(plan.price_amount)}
                    </p>
                    {plan.compare_at_amount ? (
                      <p className="mt-2 text-sm font-bold text-slate-400 line-through">{formatKrw(plan.compare_at_amount)}</p>
                    ) : null}
                  </div>
                  {plan.badge_text || plan.is_recommended ? (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{plan.badge_text || '추천'}</span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-500 sm:text-base">{plan.short_description}</p>
                {plan.discount_label ? (
                  <p className="mt-3 inline-flex self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {plan.discount_label}
                  </p>
                ) : null}

                <ul className="mt-6 space-y-3">
                  {plan.bullet_items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                      <Icons.Check className="mt-0.5 text-orange-600" size={18} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {plan.footnote ? <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">{plan.footnote}</p> : null}

                <div className="mt-auto pt-6">
                  {isFree ? (
                    <Link className="btn-primary w-full justify-center" to={plan.cta_href || '/onboarding?plan=free'}>
                      {plan.cta_label || '무료로 시작'}
                    </Link>
                  ) : (
                    <button
                      className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={activePlan !== null}
                      onClick={() => void handleCheckout(plan.plan_code)}
                      type="button"
                    >
                      {isBusy ? '결제 준비 중' : plan.cta_label || `${plan.display_name} 시작`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {testProducts.length ? (
          <div className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Payment Test</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">100원 테스트 결제</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              관리자 검증용 단건 결제입니다. 성공해도 PRO/VIP 구독 권한은 변경되지 않습니다.
            </p>
            <button
              className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activePlan !== null}
              onClick={() => void handlePaymentTest()}
              type="button"
            >
              {activePlan === PAYMENT_TEST_PRODUCT_CODE ? '테스트 결제 준비 중' : `${formatProductKrw(testProducts[0].amount)} 테스트 결제`}
            </button>
          </div>
        ) : null}

        {pricingQuery.isLoading ? <p className="mt-6 text-sm font-bold text-slate-500">가격표를 불러오는 중입니다.</p> : null}
      </section>
    </main>
  );
}
