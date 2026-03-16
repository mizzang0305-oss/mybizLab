import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { DiagnosisLoadingPanel } from '@/shared/components/DiagnosisLoadingPanel';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useAccessibleStores } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { createDemoAdminSession, useAdminSessionStore } from '@/shared/lib/adminSession';
import { BILLING_PLAN_DETAILS } from '@/shared/lib/billingPlans';
import { requestStructuredDiagnosis } from '@/shared/lib/diagnosisClient';
import {
  DIAGNOSIS_LOADING_STAGES,
  buildRequestDraftFromDiagnosis,
  clearOnboardingFlowState,
  createInitialOnboardingFlowState,
  createRequestedSlug,
  persistOnboardingFlowState,
  readOnboardingFlowState,
  type DiagnosisAnalysisSource,
  type OnboardingFlowState,
  type OnboardingStep,
} from '@/shared/lib/onboardingFlow';
import {
  PortOneCheckoutError,
  getPortOnePaymentErrorMessage,
  launchPortOneCheckout,
} from '@/shared/lib/portoneCheckout';
import { queryKeys } from '@/shared/lib/queryKeys';
import { ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug } from '@/shared/lib/storeSlug';
import { useUiStore } from '@/shared/lib/uiStore';
import { createStoreFromSetupRequest, saveSetupRequest } from '@/shared/lib/services/mvpService';
import type { FeatureKey, SetupRequestInput } from '@/shared/types/models';

type MessageTone = 'error' | 'info' | 'success';
type MessageState = { tone: MessageTone; text: string };

const steps: Array<{ key: OnboardingStep; label: string; desc: string }> = [
  { key: 'diagnosis', label: '스토어 AI 진단', desc: '매장 상황 입력' },
  { key: 'result', label: '진단 결과', desc: '운영 리포트와 전략 확인' },
  { key: 'request', label: '생성 요청', desc: '스토어 정보 제출' },
  { key: 'payment', label: '구독 결제', desc: 'PortOne 결제 진행' },
  { key: 'activation', label: '운영 시작', desc: '승인 후 대시보드 이동' },
];

const businessTypes = ['카페', '브런치', '고깃집', '레스토랑', '디저트', '배달 전문점'] as const;
const planCards = [
  {
    code: 'starter' as const,
    title: 'Starter',
    desc: '한 매장을 빠르게 시작하는 기본 플랜',
    features: ['AI 진단', '기본 매출 분석', '주문 관리'],
  },
  {
    code: 'pro' as const,
    title: 'Pro',
    desc: '고객 관리와 예약 운영까지 함께 보는 추천 플랜',
    features: ['고객 관리', '예약 관리', 'AI 운영 리포트'],
  },
  {
    code: 'business' as const,
    title: 'Business',
    desc: '운영 자동화와 리포트를 깊게 보는 확장 플랜',
    features: ['주간 운영 리포트', '통합 운영 분석', '브랜드 확장 준비'],
  },
];

function messageClassName(tone: MessageTone) {
  if (tone === 'success') return 'rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700';
  if (tone === 'error') return 'rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700';
  return 'rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700';
}

function businessNumber(seed: string) {
  const hash = Array.from(seed).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1_000_000_000, 13);
  const digits = String(100_000_000 + hash).padStart(10, '0').slice(0, 10);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function featureLabels(features: FeatureKey[]) {
  const labelMap: Partial<Record<FeatureKey, string>> = {
    ai_manager: 'AI 운영 분석',
    ai_business_report: 'AI 리포트',
    customer_management: '고객 관리',
    reservation_management: '예약 관리',
    sales_analysis: '매출 분석',
    order_management: '주문 관리',
    waiting_board: '대기 관리',
    table_order: 'QR 주문',
  };
  return features.map((feature) => labelMap[feature] || feature);
}

function requestPayload(flow: OnboardingFlowState, slug: string): SetupRequestInput {
  return {
    business_name: flow.requestDraft.storeName.trim(),
    owner_name: flow.requestDraft.ownerName.trim(),
    business_number: businessNumber(slug),
    phone: flow.requestDraft.phone.trim(),
    email: flow.requestDraft.email.trim(),
    address: flow.requestDraft.region.trim() || flow.diagnosisInput.region,
    business_type: flow.requestDraft.businessType.trim() || flow.diagnosisInput.businessType,
    requested_slug: slug,
    selected_features: flow.diagnosisResult?.suggestedFeatures ?? ['ai_manager', 'sales_analysis', 'order_management'],
  };
}

function reviewNotes(flow: OnboardingFlowState) {
  if (!flow.diagnosisResult) return '온보딩 결제 완료 후 스토어 생성이 승인되었습니다.';
  return [
    `AI 운영 점수 ${flow.diagnosisResult.score}점`,
    `요약: ${flow.diagnosisResult.summary}`,
    ...flow.diagnosisResult.recommendedStrategies,
  ].join('\n');
}

function allowDemoFallback(error: unknown) {
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) return false;
  if (error instanceof PortOneCheckoutError) {
    return ['PORTONE_BROWSER_ENV_MISSING', 'PORTONE_BROWSER_ENV_INVALID', 'SERVER_MISCONFIGURED', 'FUNCTION_INVOCATION_FAILED'].includes(error.code || '');
  }
  return error instanceof TypeError;
}

function diagnosisSourceLabel(source: DiagnosisAnalysisSource) {
  return source === 'gpt' ? 'GPT 구조화 진단' : '입력 기반 구조화 진단';
}

function analysisToneClasses(source: DiagnosisAnalysisSource) {
  return source === 'gpt'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-slate-50 text-slate-700';
}

function InsightCard({
  accentClassName,
  items,
  title,
}: {
  accentClassName?: string;
  items: string[];
  title: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}-${item.slice(0, 16)}`}
            className={[
              'rounded-2xl px-4 py-3.5 text-[15px] leading-7 break-words',
              accentClassName || 'bg-slate-50 text-slate-700',
            ].join(' ')}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const storesQuery = useAccessibleStores();
  const setSession = useAdminSessionStore((state) => state.setSession);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const [flow, setFlow] = useState(() => readOnboardingFlowState());
  const [message, setMessage] = useState<MessageState | null>(null);
  const redirectHandledRef = useRef(false);

  usePageMeta('스토어 AI 진단 신청', 'AI 진단, 생성 요청, 결제, 승인, 대시보드 진입까지 이어지는 MyBizLab 온보딩입니다.');

  const existingSlugs = useMemo(() => (storesQuery.data || []).map((store) => store.slug), [storesQuery.data]);
  const existingSlugSet = useMemo(() => new Set(existingSlugs.map((slug) => normalizeStoreSlug(slug))), [existingSlugs]);
  const autoSuggestedSlug = useMemo(() => {
    const base = normalizeStoreSlug(createRequestedSlug(flow.requestDraft.storeName || 'mybiz-store'));
    return ensureUniqueStoreSlug(base || 'mybiz-store', existingSlugs);
  }, [existingSlugs, flow.requestDraft.storeName]);
  const slugState = useMemo(() => {
    const rawRequestedSlug = flow.requestDraft.requestedSlug.trim();
    const normalizedRequestedSlug = normalizeStoreSlug(rawRequestedSlug);
    const manualEntry = rawRequestedSlug.length > 0;
    const reserved = manualEntry ? isReservedSlug(normalizedRequestedSlug) : false;
    const duplicated = manualEntry ? existingSlugSet.has(normalizedRequestedSlug) : false;
    const preview = manualEntry ? normalizedRequestedSlug : autoSuggestedSlug;
    const suggested = manualEntry ? ensureUniqueStoreSlug(normalizedRequestedSlug, existingSlugs) : autoSuggestedSlug;

    if (!manualEntry) {
      return {
        available: Boolean(preview),
        message: '스토어명을 기준으로 사용할 주소를 자동 제안하고 있습니다.',
        preview,
        suggested,
        tone: 'info' as const,
      };
    }

    if (reserved) {
      return {
        available: false,
        message: '예약된 주소라서 사용할 수 없습니다. 추천 주소를 적용해 주세요.',
        preview,
        suggested,
        tone: 'error' as const,
      };
    }

    if (duplicated) {
      return {
        available: false,
        message: '이미 사용 중인 주소입니다. 추천 주소로 바꾸면 바로 진행할 수 있습니다.',
        preview,
        suggested,
        tone: 'error' as const,
      };
    }

    if (normalizedRequestedSlug !== rawRequestedSlug) {
      return {
        available: true,
        message: '공개 주소에 맞게 안전한 형식으로 정리해 표시하고 있습니다.',
        preview,
        suggested,
        tone: 'info' as const,
      };
    }

    return {
      available: true,
      message: '사용 가능한 스토어 주소입니다.',
      preview,
      suggested,
      tone: 'success' as const,
    };
  }, [autoSuggestedSlug, existingSlugs, existingSlugSet, flow.requestDraft.requestedSlug]);
  const slugPreview = slugState.preview;

  useEffect(() => {
    persistOnboardingFlowState(flow);
  }, [flow]);

  const submitRequest = useMutation({
    mutationFn: async () => saveSetupRequest(requestPayload(flow, slugPreview), { requestedPlan: flow.selectedPlan }),
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.setupRequests });
      setFlow((current) => ({ ...current, requestId: request.id, step: 'payment' }));
      setMessage({ tone: 'success', text: '스토어 생성 요청이 접수되었습니다. 이제 구독 결제를 진행하면 승인과 스토어 생성이 이어집니다.' });
    },
  });

  const activateStore = useMutation({
    mutationFn: async (paymentId: string) =>
      createStoreFromSetupRequest(requestPayload(flow, slugPreview), {
        paymentId,
        paymentMethodStatus: 'ready',
        plan: flow.selectedPlan,
        requestId: flow.requestId,
        requestStatus: 'approved',
        reviewNotes: reviewNotes(flow),
        reviewerEmail: 'onboarding@mybiz.ai.kr',
        setupEventStatus: 'paid',
        setupStatus: 'setup_paid',
        subscriptionEventStatus: 'paid',
        subscriptionStatus: 'subscription_active',
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
        queryClient.invalidateQueries({ queryKey: queryKeys.setupRequests }),
      ]);
      const session = await createDemoAdminSession();
      setSession(session);
      setSelectedStoreId(result.store.id);
      setFlow((current) => ({ ...current, step: 'activation', activationStatus: 'completed', createdStoreId: result.store.id }));
      setMessage({ tone: 'success', text: `${result.store.name} 스토어가 준비되었습니다. 잠시 후 관리자 대시보드로 이동합니다.` });
      window.setTimeout(() => {
        clearOnboardingFlowState();
        navigate('/dashboard', { replace: true });
      }, 900);
    },
  });

  const runDiagnosis = useMutation({
    mutationFn: requestStructuredDiagnosis,
    onSuccess: (diagnosisResult, input) => {
      setFlow((current) => ({
        ...current,
        diagnosisResult,
        requestDraft: {
          ...buildRequestDraftFromDiagnosis(input),
          ...current.requestDraft,
          businessType: input.businessType,
          region: input.region,
        },
        selectedPlan: diagnosisResult.recommendedPlan,
        step: 'result',
      }));
      setMessage(null);
    },
    onError: (error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'AI 진단 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    },
  });

  async function finalizeActivation(paymentId: string, fallbackUsed: boolean, source: 'browser' | 'demo' | 'redirect') {
    setFlow((current) => ({
      ...current,
      paymentId,
      paymentStatus: 'paid',
      paymentFallbackUsed: fallbackUsed,
      activationStatus: 'processing',
      step: 'activation',
    }));
    setMessage({
      tone: 'success',
      text: source === 'demo' ? '데모 결제 확인 후 스토어 승인과 생성을 진행합니다.' : '결제 확인 후 스토어 승인과 생성을 진행합니다.',
    });
    await activateStore.mutateAsync(paymentId);
  }

  useEffect(() => {
    const portone = searchParams.get('portone');
    if (portone !== 'redirect' || redirectHandledRef.current) return;
    redirectHandledRef.current = true;

    const code = searchParams.get('code');
    const paymentId = searchParams.get('paymentId');
    const next = new URLSearchParams(searchParams);
    ['portone', 'code', 'message', 'paymentId', 'plan'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });

    if (code) {
      setFlow((current) => ({ ...current, step: 'payment', paymentStatus: 'failed' }));
      setMessage({ tone: 'error', text: searchParams.get('message') || '결제가 완료되지 않았습니다. 다시 시도해 주세요.' });
      return;
    }

    if (paymentId && flow.requestId) {
      void finalizeActivation(paymentId, false, 'redirect');
    }
  }, [flow.requestId, searchParams, setSearchParams]);

  function updateDiagnosis(field: keyof OnboardingFlowState['diagnosisInput'], value: string) {
    setFlow((current) => ({ ...current, diagnosisInput: { ...current.diagnosisInput, [field]: value } }));
  }

  function updateRequest(field: keyof OnboardingFlowState['requestDraft'], value: string) {
    setFlow((current) => ({ ...current, requestDraft: { ...current.requestDraft, [field]: value } }));
  }

  async function submitDiagnosis() {
    setMessage(null);
    await runDiagnosis.mutateAsync(flow.diagnosisInput);
  }

  async function startCheckout() {
    try {
      setFlow((current) => ({ ...current, paymentStatus: 'processing' }));
      setMessage({ tone: 'info', text: '결제창을 준비하고 있습니다. 결제가 끝나면 승인과 스토어 생성이 바로 이어집니다.' });
      const { payment } = await launchPortOneCheckout(flow.selectedPlan, {
        customer: {
          email: flow.requestDraft.email.trim(),
          fullName: flow.requestDraft.ownerName.trim(),
          phoneNumber: flow.requestDraft.phone.trim(),
        },
        customData: { requestId: flow.requestId, slug: slugPreview },
        orderName: `${flow.requestDraft.storeName.trim()} ${planCards.find((item) => item.code === flow.selectedPlan)?.title || '구독'} 결제`,
        redirectPath: '/onboarding?step=payment',
        source: 'onboarding-flow',
      });

      if (!payment) {
        setMessage({ tone: 'info', text: '모바일 결제 확인을 기다리는 중입니다. 결제 후 이 화면으로 돌아오면 자동으로 이어집니다.' });
        return;
      }
      if (payment.code) {
        setFlow((current) => ({ ...current, paymentStatus: 'failed', step: 'payment' }));
        setMessage({ tone: 'error', text: getPortOnePaymentErrorMessage(payment) });
        return;
      }
      await finalizeActivation(payment.paymentId, false, 'browser');
    } catch (error) {
      if (allowDemoFallback(error)) {
        await finalizeActivation(`demo_${Date.now()}`, true, 'demo');
        return;
      }
      setFlow((current) => ({ ...current, paymentStatus: 'failed', step: 'payment' }));
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : '결제 연결 중 문제가 발생했습니다.' });
    }
  }

  const diagnosisValid = Object.values(flow.diagnosisInput).every((value) => value.trim());
  const requestValid =
    ['storeName', 'ownerName', 'phone', 'email'].every((field) => flow.requestDraft[field as keyof typeof flow.requestDraft].trim()) &&
    slugState.available;
  const currentIndex = steps.findIndex((item) => item.key === flow.step);
  const suggestionLabels = featureLabels(flow.diagnosisResult?.suggestedFeatures ?? []);
  const currentPlanTitle = planCards.find((plan) => plan.code === flow.selectedPlan)?.title || 'Starter';

  return (
    <div className="page-shell space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="스토어 AI 온보딩"
        title="AI 진단부터 결제, 스토어 생성, 대시보드 진입까지 한 번에 연결합니다"
        description="매장 상황을 입력하면 구조화된 AI 진단 결과를 먼저 확인하고, 스토어 생성 요청과 구독 결제, 승인, 관리자 대시보드 준비까지 순서대로 이어집니다."
        actions={
          <>
            <Link className="btn-secondary" to="/pricing">
              요금제 자세히 보기
            </Link>
            <button
              className="btn-secondary"
              onClick={() => {
                clearOnboardingFlowState();
                setFlow(createInitialOnboardingFlowState());
                setMessage(null);
              }}
              type="button"
            >
              처음부터 다시
            </button>
          </>
        }
      />

      <Panel title="온보딩 진행 단계" subtitle="현재 단계와 다음 단계가 자연스럽게 이어지도록 구성했습니다.">
        <div className="grid gap-3 md:grid-cols-5">
          {steps.map((step, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            return (
              <div key={step.key} className={`rounded-3xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50' : current ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">0{index + 1}</p>
                <p className="mt-3 font-semibold text-slate-900">{step.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      {message ? <p className={messageClassName(message.tone)}>{message.text}</p> : null}

      <div className="grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-6">
          {flow.step === 'diagnosis' && !runDiagnosis.isPending ? (
            <Panel
              title="1. 스토어 AI 진단"
              subtitle="업종, 지역, 고객 유형, 운영 고민을 입력하면 구조화된 AI 진단 리포트를 생성합니다. 외부 실시간 데이터가 없더라도 입력값 기반 추론으로 실행 가능한 결과를 정리합니다."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <span className="field-label">업종</span>
                  <select className="input-base" onChange={(event) => updateDiagnosis('businessType', event.target.value)} value={flow.diagnosisInput.businessType}>
                    {businessTypes.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">지역</span>
                  <input className="input-base" onChange={(event) => updateDiagnosis('region', event.target.value)} placeholder="예: 서울 성수동" value={flow.diagnosisInput.region} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">고객 유형</span>
                  <input className="input-base" onChange={(event) => updateDiagnosis('customerType', event.target.value)} placeholder="예: 직장인 점심 고객과 재방문 고객" value={flow.diagnosisInput.customerType} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">운영 고민</span>
                  <textarea
                    className="input-base min-h-36 resize-y"
                    onChange={(event) => updateDiagnosis('operatingConcerns', event.target.value)}
                    placeholder="예: 예약은 들어오는데 대기 관리가 어렵고, 재방문 고객 관리도 잘 안 됩니다."
                    value={flow.diagnosisInput.operatingConcerns}
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button className="btn-primary" disabled={!diagnosisValid} onClick={() => void submitDiagnosis()} type="button">
                  AI 진단 결과 보기
                </button>
                <p className="text-sm leading-6 text-slate-500">진단은 입력값을 기반으로 핵심 병목, 실행 액션, 추천 플랜까지 구조화해서 보여줍니다.</p>
              </div>
            </Panel>
          ) : null}

          {flow.step === 'diagnosis' && runDiagnosis.isPending ? (
            <DiagnosisLoadingPanel
              businessType={flow.diagnosisInput.businessType}
              customerType={flow.diagnosisInput.customerType}
              region={flow.diagnosisInput.region}
              stages={DIAGNOSIS_LOADING_STAGES}
            />
          ) : null}

          {flow.step === 'result' && flow.diagnosisResult ? (
            <Panel
              title="2. 스토어 AI 진단 결과"
              subtitle="운영 점수, 핵심 병목, 매출 개선 포인트, 바로 실행할 액션을 한 번에 정리했습니다. 실시간 외부 데이터가 연결되지 않았더라도 입력 정보를 기반으로 구조화된 진단을 제공합니다."
            >
              <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
                <div className="space-y-4">
                  <div className="rounded-[32px] bg-slate-950 p-6 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-orange-200">운영 점수</p>
                        <p className="mt-3 font-display text-4xl font-black leading-none sm:text-5xl">{flow.diagnosisResult.score}점</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${analysisToneClasses(flow.diagnosisResult.analysisSource)}`}>
                        {diagnosisSourceLabel(flow.diagnosisResult.analysisSource)}
                      </span>
                    </div>
                    <p className="mt-5 max-w-2xl break-words text-pretty text-[15px] leading-7 text-slate-200 sm:text-base sm:leading-8">{flow.diagnosisResult.summary}</p>
                    <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.07] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">리포트 요약</p>
                      <p className="mt-2 break-words text-[15px] leading-7 text-slate-200">{flow.diagnosisResult.reportSummary}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-500">핵심 병목 수</p>
                      <p className="mt-3 font-display text-3xl font-black text-slate-900">{flow.diagnosisResult.coreBottlenecks.length}개</p>
                      <p className="mt-2 text-[15px] leading-7 text-slate-500">가장 먼저 손봐야 할 운영 병목을 우선순위 순서대로 정리했습니다.</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-500">추천 플랜</p>
                      <p className="mt-3 font-display text-3xl font-black text-slate-900">{currentPlanTitle}</p>
                      <p className="mt-2 text-[15px] leading-7 text-slate-500">현재 진단 결과에서 필요한 기능 구성을 기준으로 권장했습니다.</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-500">즉시 실행 액션</p>
                      <p className="mt-3 font-display text-3xl font-black text-slate-900">{flow.diagnosisResult.immediateActions.length}개</p>
                      <p className="mt-2 text-[15px] leading-7 text-slate-500">오늘 바로 시작할 수 있는 액션만 추려 운영 부담을 줄였습니다.</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-500">진단 근거와 한계</p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] leading-7 text-slate-700">{flow.diagnosisResult.analysisBasis}</div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] leading-7 text-slate-600">{flow.diagnosisResult.limitationsNote}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <InsightCard items={flow.diagnosisResult.coreBottlenecks} title="핵심 병목" />
                  <InsightCard accentClassName="bg-orange-50 text-orange-900" items={flow.diagnosisResult.revenueOpportunities} title="매출 개선 포인트" />
                  <InsightCard accentClassName="bg-sky-50 text-sky-900" items={flow.diagnosisResult.recommendedStrategies} title="추천 전략 3개" />
                  <InsightCard accentClassName="bg-emerald-50 text-emerald-900" items={flow.diagnosisResult.immediateActions} title="바로 실행할 액션 3개" />
                  <InsightCard items={flow.diagnosisResult.expansionFeatures} title="확장 가능 기능" />
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <label>
                  <span className="field-label">스토어 주소</span>
                  <input
                    className="input-base"
                    onChange={(event) => updateRequest('requestedSlug', event.target.value)}
                    placeholder="예: seongsu-brunch-house"
                    type="text"
                    value={flow.requestDraft.requestedSlug}
                  />
                  <p className="mt-2 text-sm leading-6 text-slate-500">비워두면 스토어명을 기준으로 자동 제안합니다. 직접 입력하면 중복 여부를 바로 확인합니다.</p>
                </label>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">주소 상태</p>
                  <p className="mt-2 break-all text-base font-semibold text-slate-900">/{slugPreview}</p>
                  <p
                    className={`mt-3 text-sm leading-6 ${
                      slugState.tone === 'error'
                        ? 'text-rose-600'
                        : slugState.tone === 'success'
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {slugState.message}
                  </p>
                  {slugState.suggested !== slugPreview ? (
                    <button
                      className="mt-4 inline-flex text-sm font-bold text-orange-700"
                      onClick={() => updateRequest('requestedSlug', slugState.suggested)}
                      type="button"
                    >
                      추천 주소 사용: /{slugState.suggested}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn-primary" onClick={() => setFlow((current) => ({ ...current, step: 'request' }))} type="button">
                  스토어 생성 요청 계속
                </button>
                <button className="btn-secondary" onClick={() => setFlow((current) => ({ ...current, step: 'diagnosis' }))} type="button">
                  진단 내용 수정
                </button>
              </div>
            </Panel>
          ) : null}

          {flow.step === 'request' ? (
            <Panel title="3. 스토어 생성 요청" subtitle="관리자 대시보드와 스토어 생성을 위해 필요한 기본 정보를 입력합니다.">
              <div className="grid gap-5 md:grid-cols-2">
                {[
                  ['storeName', '스토어명', '예: 성수 브런치 하우스'],
                  ['ownerName', '대표자명', '대표자명을 입력해 주세요'],
                  ['phone', '연락처', '예: 010-1234-5678'],
                  ['email', '이메일', '예: owner@store.kr'],
                  ['businessType', '업종', '업종을 입력해 주세요'],
                  ['region', '지역', '예: 서울 성수동'],
                ].map(([field, label, placeholder]) => (
                  <label key={field}>
                    <span className="field-label">{label}</span>
                    <input
                      className="input-base"
                      onChange={(event) => updateRequest(field as keyof OnboardingFlowState['requestDraft'], event.target.value)}
                      placeholder={placeholder}
                      type={field === 'email' ? 'email' : 'text'}
                      value={flow.requestDraft[field as keyof OnboardingFlowState['requestDraft']]}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 rounded-3xl bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">스토어 주소 미리보기</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">/{slugPreview}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">결제 후 이 주소를 기준으로 스토어와 관리자 대시보드가 연결됩니다.</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn-primary" disabled={!requestValid || submitRequest.isPending} onClick={() => void submitRequest.mutateAsync()} type="button">
                  스토어 생성 요청 제출
                </button>
                <button className="btn-secondary" onClick={() => setFlow((current) => ({ ...current, step: 'result' }))} type="button">
                  이전 단계로
                </button>
              </div>
            </Panel>
          ) : null}

          {flow.step === 'payment' ? (
            <Panel title="4. 구독 결제" subtitle="권장 플랜을 확인하고 PortOne 결제로 구독을 시작합니다. 결제가 완료되면 스토어 승인과 생성이 바로 이어집니다.">
              <div className="grid gap-4 lg:grid-cols-3">
                {planCards.map((plan) => {
                  const details = BILLING_PLAN_DETAILS[plan.code];
                  const selected = flow.selectedPlan === plan.code;
                  const recommended = flow.diagnosisResult?.recommendedPlan === plan.code;
                  return (
                    <button key={plan.code} className={`rounded-3xl border p-5 text-left ${selected ? 'border-orange-300 bg-orange-50 shadow-[0_20px_45px_-30px_rgba(236,91,19,0.45)]' : 'border-slate-200 bg-white'}`} onClick={() => setFlow((current) => ({ ...current, selectedPlan: plan.code }))} type="button">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">{plan.title}</p>
                          <p className="mt-3 font-display text-3xl font-black text-slate-900">월 {details.amount.toLocaleString()}원</p>
                        </div>
                        {recommended ? <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">추천</span> : null}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-600">{plan.desc}</p>
                      <div className="mt-5 space-y-2">
                        {plan.features.map((item) => (
                          <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn-primary" disabled={!flow.requestId || flow.paymentStatus === 'processing' || activateStore.isPending} onClick={() => void startCheckout()} type="button">
                  {flow.paymentStatus === 'processing' ? '결제창 준비 중...' : 'PortOne 결제 진행'}
                </button>
                <button className="btn-secondary" onClick={() => setFlow((current) => ({ ...current, step: 'request' }))} type="button">
                  요청 정보 수정
                </button>
              </div>
            </Panel>
          ) : null}

          {flow.step === 'activation' ? (
            <Panel title="5. 승인 및 운영 시작" subtitle="결제 확인 후 승인, 스토어 생성, 관리자 대시보드 준비가 순서대로 완료됩니다.">
              <div className="space-y-4">
                {[
                  ['결제 확인', flow.paymentStatus === 'paid', flow.paymentStatus === 'processing'],
                  ['스토어 승인', flow.activationStatus === 'completed', flow.activationStatus === 'processing'],
                  ['관리자 대시보드 준비', flow.activationStatus === 'completed' && Boolean(flow.createdStoreId), flow.activationStatus === 'processing'],
                ].map(([label, done, pending]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-5 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{label}</p>
                      <p className="mt-1 text-sm text-slate-500">{done ? '완료' : pending ? '진행 중' : '대기 중'}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-700' : pending ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                      {done ? '완료' : pending ? '처리 중' : '대기'}
                    </span>
                  </div>
                ))}
              </div>
              {flow.activationStatus === 'completed' ? (
                <div className="mt-6">
                  <button className="btn-primary" onClick={() => navigate('/dashboard', { replace: true })} type="button">
                    관리자 대시보드 바로 열기
                  </button>
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel title="현재 요약" subtitle="진단 결과와 신청 정보를 오른쪽에서 바로 확인할 수 있습니다.">
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-sm font-semibold text-orange-200">권장 플랜</p>
                <p className="mt-2 font-display text-3xl font-black">{currentPlanTitle}</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {runDiagnosis.isPending
                    ? '새 진단 결과를 계산하는 동안 요약과 추천 기능을 다시 정리하고 있습니다.'
                    : flow.diagnosisResult
                      ? 'AI 진단 기준으로 가장 적합한 플랜을 선택했습니다.'
                      : 'AI 진단 결과를 기준으로 권장 플랜이 자동 제안됩니다.'}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">진단 입력</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p>업종: {flow.diagnosisInput.businessType}</p>
                  <p>지역: {flow.diagnosisInput.region}</p>
                  <p>고객 유형: {flow.diagnosisInput.customerType}</p>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">스토어 생성 준비</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p>스토어명: {flow.requestDraft.storeName || '아직 입력 전'}</p>
                  <p>관리자 이메일: {flow.requestDraft.email || '아직 입력 전'}</p>
                  <p>스토어 주소: /{slugPreview}</p>
                </div>
              </div>
              {flow.diagnosisResult && !runDiagnosis.isPending ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-500">진단 메모</p>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${analysisToneClasses(flow.diagnosisResult.analysisSource)}`}>
                      {diagnosisSourceLabel(flow.diagnosisResult.analysisSource)}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-[15px] leading-7 text-slate-700">{flow.diagnosisResult.reportSummary}</p>
                </div>
              ) : null}
              {suggestionLabels.length && !runDiagnosis.isPending ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">AI 추천 기능</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestionLabels.map((item) => (
                      <span key={item} className="rounded-full bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
          <Panel title="다음 단계 안내" subtitle="지금 단계에서 무엇이 이어지는지 짧게 안내합니다.">
            <div className="space-y-3 text-sm leading-7 text-slate-600">
              {flow.step === 'diagnosis' && !runDiagnosis.isPending ? <p>운영 고민을 입력하면 AI가 운영 점수, 핵심 병목, 실행 액션, 추천 플랜을 구조화해 정리합니다.</p> : null}
              {flow.step === 'diagnosis' && runDiagnosis.isPending ? <p>현재 AI가 입력값을 분석 중입니다. 결과는 단계별 분석 후 한 번에 정리되어 표시됩니다.</p> : null}
              {flow.step === 'result' ? <p>진단 결과를 확인한 뒤 스토어 생성 요청을 제출하면 결제로 이어집니다.</p> : null}
              {flow.step === 'request' ? <p>스토어 생성 요청이 접수되면 곧바로 구독 결제를 진행할 수 있습니다.</p> : null}
              {flow.step === 'payment' ? <p>결제가 완료되면 승인, 스토어 생성, 관리자 대시보드 연결이 자동으로 이어집니다.</p> : null}
              {flow.step === 'activation' ? <p>승인과 생성이 완료되면 관리자 대시보드로 자동 이동합니다.</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
