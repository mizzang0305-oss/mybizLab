import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { DiagnosisLoadingPanel } from '@/shared/components/DiagnosisLoadingPanel';
import { Panel } from '@/shared/components/Panel';
import { usePersistentDiagnosisWorldSurface } from '@/shared/components/PersistentDiagnosisWorldShell';
import { useAccessibleStores } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { createDemoAdminSession, useAdminSessionStore } from '@/shared/lib/adminSession';
import { BILLING_PLAN_DETAILS } from '@/shared/lib/billingPlans';
import { requestStructuredDiagnosis } from '@/shared/lib/diagnosisClient';
import {
  DIAGNOSIS_AVAILABLE_DATA_OPTIONS,
  DIAGNOSIS_CONCERN_OPTIONS,
  DIAGNOSIS_DESIRED_OUTCOME_OPTIONS,
  DIAGNOSIS_INDUSTRY_OPTIONS,
  DIAGNOSIS_STORE_MODE_OPTIONS,
  getAvailableDataLabels,
  getConcernLabel,
  getDesiredOutcomeLabel,
  getIndustryLabel,
  getRecommendedDataModeLabel,
  getRecommendedStoreModeLabel,
  type DiagnosisAvailableDataKey,
} from '@/shared/lib/diagnosisBlueprint';
import { persistDiagnosisSession } from '@/shared/lib/diagnosisSessions';
import { getDiagnosisCorridorStep } from '@/shared/lib/diagnosisCorridor';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import {
  DIAGNOSIS_LOADING_STAGES,
  applyOnboardingSetupRequestSaved,
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
  verifyPortOnePayment,
} from '@/shared/lib/portoneCheckout';
import { getFeatureLabel } from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  STORE_SETUP_DATA_MODE_OPTIONS,
  STORE_SETUP_PREVIEW_TARGET_OPTIONS,
  STORE_SETUP_THEME_OPTIONS,
  collectStoreSetupStepErrors,
  storeSetupDraftSchema,
  type StoreSetupWizardStep,
} from '@/shared/lib/storeSetupSchema';
import { ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug } from '@/shared/lib/storeSlug';
import { useUiStore } from '@/shared/lib/uiStore';
import { createStoreFromSetupRequest, saveSetupRequest } from '@/shared/lib/services/mvpService';
import type { FeatureKey, SetupRequestInput } from '@/shared/types/models';

type MessageTone = 'error' | 'info' | 'success';
type MessageState = { tone: MessageTone; text: string };

const steps: Array<{ key: OnboardingStep; label: string; desc: string }> = [
  { key: 'diagnosis', label: '스토어 AI 진단', desc: '매장 상황 입력' },
  { key: 'result', label: '진단 결과', desc: '운영 리포트와 전략 확인' },
  { key: 'request', label: '생성 요청', desc: '스토어 설정 마법사' },
  { key: 'payment', label: '구독 결제', desc: 'PortOne 결제 진행' },
  { key: 'activation', label: '운영 시작', desc: '승인 후 대시보드 이동' },
];

const requestWizardSteps: Array<{ key: StoreSetupWizardStep; label: string; desc: string }> = [
  { key: 'basic', label: '기본 정보', desc: '스토어와 대표 기본값' },
  { key: 'storeMode', label: '운영 방식', desc: '운영 흐름 선택' },
  { key: 'dataMode', label: '데이터 수집', desc: '수집 방식 선택' },
  { key: 'modules', label: '앱 선택', desc: '포함 모듈 결정' },
  { key: 'public', label: '공개 화면', desc: '대표 문구와 CTA' },
  { key: 'summary', label: '요약', desc: '생성 전 최종 확인' },
];

const requestStepFields: Record<Exclude<StoreSetupWizardStep, 'summary'>, string[]> = {
  basic: ['storeName', 'brandName', 'ownerName', 'phone', 'email', 'businessType', 'address', 'openingHours', 'requestedSlug'],
  dataMode: ['dataMode'],
  modules: ['selectedFeatures'],
  public: ['tagline', 'description', 'primaryCtaLabel', 'mobileCtaLabel', 'publicStatus', 'themePreset', 'previewTarget'],
  storeMode: ['storeMode'],
};

const storeModeWizardOptions = DIAGNOSIS_STORE_MODE_OPTIONS.filter((option) => option.value !== 'not_sure');

const planCards = [
  {
    code: 'free' as const,
    title: 'FREE',
    desc: '한 매장을 빠르게 시작하는 기본 플랜',
    features: ['AI 진단', '기본 매출 분석', '주문 관리'],
  },
  {
    code: 'pro' as const,
    title: 'PRO',
    desc: '고객 관리와 예약 운영까지 함께 보는 추천 플랜',
    features: ['고객 관리', '예약 관리', 'AI 운영 리포트'],
  },
  {
    code: 'vip' as const,
    title: 'VIP',
    desc: '운영 자동화와 리포트를 깊게 보는 확장 플랜',
    features: ['주간 운영 리포트', '통합 운영 분석', '브랜드 확장 준비'],
  },
];

function businessNumber(seed: string) {
  const hash = Array.from(seed).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1_000_000_000, 13);
  const digits = String(100_000_000 + hash).padStart(10, '0').slice(0, 10);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function featureLabels(features: FeatureKey[]) {
  return features.map((feature) => getFeatureLabel(feature));
}

function requestPayload(flow: OnboardingFlowState, slug: string): SetupRequestInput {
  const parsedDraft = storeSetupDraftSchema.parse(flow.requestDraft);

  return {
    business_name: parsedDraft.storeName,
    owner_name: parsedDraft.ownerName,
    business_number: businessNumber(slug),
    phone: parsedDraft.phone,
    email: parsedDraft.email,
    address: parsedDraft.address,
    business_type: parsedDraft.businessType,
    requested_slug: slug,
    selected_features: parsedDraft.selectedFeatures,
    brand_name: parsedDraft.brandName,
    data_mode: parsedDraft.dataMode,
    description: parsedDraft.description,
    mobile_cta_label: parsedDraft.mobileCtaLabel,
    opening_hours: parsedDraft.openingHours,
    preview_target: parsedDraft.previewTarget,
    primary_cta_label: parsedDraft.primaryCtaLabel,
    public_status: parsedDraft.publicStatus,
    store_mode: parsedDraft.storeMode,
    tagline: parsedDraft.tagline,
    theme_preset: parsedDraft.themePreset,
  };
}

function firstFieldErrorMap(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function reviewNotes(flow: OnboardingFlowState) {
  if (!flow.diagnosisResult) return '온보딩 결제 완료 후 스토어 생성이 승인되었습니다.';
  return [
    `AI 운영 점수 ${flow.diagnosisResult.score}점`,
    `요약: ${flow.diagnosisResult.summary}`,
    ...flow.diagnosisResult.recommendedStrategies,
  ].join('\n');
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}-${item.slice(0, 16)}`}
            className="flex items-start gap-3 px-5 py-3.5"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${accentClassName || 'bg-slate-100 text-slate-600'}`}>
              {index + 1}
            </span>
            <p className="text-[14px] leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosisChoiceCard({
  active,
  caption,
  description,
  onClick,
  title,
}: {
  active: boolean;
  caption: string;
  description: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={[
        'group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200',
        active
          ? 'border-[#ec5b13] bg-gradient-to-br from-orange-50 to-white shadow-[0_8px_32px_-12px_rgba(236,91,19,0.35)]'
          : 'border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_4px_16px_-8px_rgba(0,0,0,0.1)]',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {active && (
        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#ec5b13] text-white">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      )}
      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${active ? 'text-orange-500' : 'text-slate-400'}`}>{caption}</p>
      <p className={`mt-2.5 text-[15px] font-semibold leading-snug ${active ? 'text-[#ec5b13]' : 'text-slate-900'}`}>{title}</p>
      <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{description}</p>
    </button>
  );
}

function DiagnosisToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {active && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )}
      {label}
    </button>
  );
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-medium text-rose-600">{message}</p>;
}

function FeatureSelectionCard({
  active,
  description,
  highlights,
  label,
  onClick,
  recommended,
}: {
  active: boolean;
  description: string;
  highlights: string[];
  label: string;
  onClick: () => void;
  recommended: boolean;
}) {
  return (
    <button
      className={[
        'w-full rounded-3xl border p-4 text-left transition',
        active
          ? 'border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.7)]'
          : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`text-base font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        {recommended ? (
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${active ? 'bg-white/10 text-orange-200' : 'bg-orange-100 text-orange-700'}`}>
            AI 추천
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-sm leading-6 ${active ? 'text-slate-200' : 'text-slate-500'}`}>{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {highlights.slice(0, 3).map((item) => (
          <span
            key={`${label}-${item}`}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${active ? 'bg-white/10 text-slate-100' : 'bg-slate-100 text-slate-600'}`}
          >
            {item}
          </span>
        ))}
      </div>
    </button>
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
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});
  const redirectHandledRef = useRef(false);

  usePageMeta('스토어 AI 진단 신청', 'AI 진단을 통해 매장에 맞는 운영 전략과 플랜을 추천받고, 스토어를 생성하는 과정입니다.');

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
      setFlow((current) => applyOnboardingSetupRequestSaved(current, request.id));
      setMessage({ tone: 'success', text: '스토어 생성 요청이 접수되었습니다. 이제 구독 결제를 진행하면 승인과 스토어 생성이 이어집니다.' });
    },
    onError: (error) => {
      const isInternalRuntimeError =
        error instanceof Error &&
        ['Mock database access is disabled outside explicit demo runtime.', 'Canonical MyBiz repository is unavailable.'].some((message) =>
          error.message.includes(message),
        );
      setMessage({
        tone: 'error',
        text:
          error instanceof Error && !isInternalRuntimeError
            ? error.message
            : '스토어 생성 요청을 저장하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
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
      setMessage({ tone: 'success', text: `${result.store.name} 스토어가 준비되었습니다. 잠시 후 생성된 스토어 상세 화면으로 이동합니다.` });
      window.setTimeout(() => {
        clearOnboardingFlowState();
        navigate(`/dashboard/stores/${result.store.id}`, { replace: true });
      }, 900);
    },
  });

  const runDiagnosis = useMutation({
    mutationFn: requestStructuredDiagnosis,
    onSuccess: async (diagnosisResult, input) => {
      await persistDiagnosisSession({
        diagnosisInput: input,
        diagnosisResult,
      }).catch((error) => {
        console.warn('[onboarding] diagnosis session persistence failed', error);
      });

      const recommendedDraft = buildRequestDraftFromDiagnosis(input, diagnosisResult);

      setFlow((current) => ({
        ...current,
        diagnosisResult,
        requestDraft: {
          ...current.requestDraft,
          businessType: getIndustryLabel(input.industryType),
          address: current.requestDraft.address.trim() || recommendedDraft.address,
          dataMode: diagnosisResult.recommendedDataMode,
          description: recommendedDraft.description,
          mobileCtaLabel: recommendedDraft.mobileCtaLabel,
          openingHours: current.requestDraft.openingHours.trim() || recommendedDraft.openingHours,
          previewTarget: recommendedDraft.previewTarget,
          primaryCtaLabel: recommendedDraft.primaryCtaLabel,
          publicStatus: current.requestDraft.publicStatus,
          region: input.region,
          selectedFeatures: diagnosisResult.recommendedModules,
          storeMode: diagnosisResult.recommendedStoreMode,
          tagline: recommendedDraft.tagline,
          themePreset: recommendedDraft.themePreset,
        },
        requestWizardStep: 'basic',
        selectedPlan: diagnosisResult.recommendedPlan,
        step: 'result',
      }));
      setRequestErrors({});
      setMessage(null);
    },
    onError: (error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'AI 진단 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    },
  });

  async function finalizeActivation(paymentId: string, fallbackUsed: boolean, source: 'browser' | 'demo' | 'redirect' | 'free') {
    setFlow((current) => ({
      ...current,
      paymentId,
      paymentStatus: 'paid',
      paymentFallbackUsed: fallbackUsed,
      activationStatus: 'processing',
      step: 'activation',
    }));
    if (source === 'free') {
      setMessage({
        tone: 'success',
        text: 'FREE 플랜을 바로 활성화하고 스토어 생성을 진행합니다.',
      });
      await activateStore.mutateAsync(paymentId);
      return;
    }
    setMessage({
      tone: 'success',
      text: source === 'demo' ? '데모 결제 확인 후 스토어 승인과 생성을 진행합니다.' : '결제 확인 후 스토어 승인과 생성을 진행합니다.',
    });
    await activateStore.mutateAsync(paymentId);
  }

  async function verifyAndFinalizePaidActivation(paymentId: string, source: 'browser' | 'redirect') {
    try {
      setFlow((current) => ({
        ...current,
        paymentStatus: 'processing',
        step: 'payment',
      }));
      setMessage({ tone: 'info', text: '결제 상태를 확인하는 중입니다. 확인이 끝나면 스토어 생성이 이어집니다.' });
      await verifyPortOnePayment(paymentId);
      await finalizeActivation(paymentId, false, source);
    } catch (error) {
      setFlow((current) => ({
        ...current,
        activationStatus: 'idle',
        paymentStatus: 'failed',
        step: 'payment',
      }));
      setMessage({
        tone: 'error',
        text:
          error instanceof PortOneCheckoutError
            ? error.code === 'PAYMENT_NOT_COMPLETED'
              ? error.message
              : error.code === 'PORTONE_BROWSER_ENV_MISSING' || error.code === 'PORTONE_BROWSER_ENV_INVALID'
                ? '결제 환경 구성이 아직 완료되지 않았습니다. 관리자 설정을 확인한 뒤 다시 시도해 주세요.'
                : error.message
            : '결제 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
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
      void verifyAndFinalizePaidActivation(paymentId, 'redirect');
    }
  }, [flow.requestId, searchParams, setSearchParams]);

  function updateDiagnosis<K extends keyof OnboardingFlowState['diagnosisInput']>(
    field: K,
    value: OnboardingFlowState['diagnosisInput'][K],
  ) {
    setFlow((current) => ({ ...current, diagnosisInput: { ...current.diagnosisInput, [field]: value } }));
  }

  function toggleDiagnosisAvailableData(value: DiagnosisAvailableDataKey) {
    setFlow((current) => {
      const hasValue = current.diagnosisInput.availableData.includes(value);
      const nextAvailableData = hasValue
        ? current.diagnosisInput.availableData.filter((item) => item !== value)
        : [...current.diagnosisInput.availableData, value];

      return {
        ...current,
        diagnosisInput: {
          ...current.diagnosisInput,
          availableData: nextAvailableData,
        },
      };
    });
  }

  function updateRequest<K extends keyof OnboardingFlowState['requestDraft']>(field: K, value: OnboardingFlowState['requestDraft'][K]) {
    setRequestErrors((current) => {
      if (!Object.hasOwn(current, field)) {
        return current;
      }

      const next = { ...current };
      delete next[String(field)];
      return next;
    });
    setFlow((current) => ({ ...current, requestDraft: { ...current.requestDraft, [field]: value } }));
  }

  function toggleRequestFeature(featureKey: FeatureKey) {
    setRequestErrors((current) => {
      if (!current.selectedFeatures) {
        return current;
      }

      const next = { ...current };
      delete next.selectedFeatures;
      return next;
    });
    setFlow((current) => {
      const alreadySelected = current.requestDraft.selectedFeatures.includes(featureKey);

      return {
        ...current,
        requestDraft: {
          ...current.requestDraft,
          selectedFeatures: alreadySelected
            ? current.requestDraft.selectedFeatures.filter((feature) => feature !== featureKey)
            : [...current.requestDraft.selectedFeatures, featureKey],
        },
      };
    });
  }

  function replaceStepErrors(step: Exclude<StoreSetupWizardStep, 'summary'>, nextErrors: Record<string, string>) {
    setRequestErrors((current) => {
      const merged = { ...current };

      requestStepFields[step].forEach((field) => {
        delete merged[field];
      });

      return {
        ...merged,
        ...nextErrors,
      };
    });
  }

  function validateRequestStep(step: Exclude<StoreSetupWizardStep, 'summary'>) {
    const nextErrors = firstFieldErrorMap(collectStoreSetupStepErrors(step, flow.requestDraft));

    if (step === 'basic' && !slugState.available) {
      nextErrors.requestedSlug = slugState.message;
    }

    replaceStepErrors(step, nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setMessage({ tone: 'error', text: '필수 설정을 확인해 주세요. 각 단계 아래의 안내 메시지를 먼저 해결하면 다음 단계로 넘어갈 수 있습니다.' });
      return false;
    }

    return true;
  }

  function validateRequestSummary() {
    const parsed = storeSetupDraftSchema.safeParse(flow.requestDraft);
    const nextErrors = parsed.success ? {} : firstFieldErrorMap(parsed.error.flatten().fieldErrors);

    if (!slugState.available) {
      nextErrors.requestedSlug = slugState.message;
    }

    setRequestErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setMessage({ tone: 'error', text: '생성 전 확인이 필요한 항목이 있습니다. 표시된 필드를 먼저 수정해 주세요.' });
      return false;
    }

    return true;
  }

  function moveRequestWizard(offset: -1 | 1) {
    const currentIndex = requestWizardSteps.findIndex((item) => item.key === flow.requestWizardStep);
    const currentStep = requestWizardSteps[currentIndex]?.key;
    const nextStep = requestWizardSteps[currentIndex + offset]?.key;

    if (!currentStep || !nextStep) {
      return;
    }

    if (offset > 0 && currentStep !== 'summary' && !validateRequestStep(currentStep)) {
      return;
    }

    setMessage(null);
    setFlow((current) => ({
      ...current,
      requestWizardStep: nextStep,
    }));
  }

  async function submitDiagnosis() {
    setMessage(null);
    await runDiagnosis.mutateAsync(flow.diagnosisInput);
  }

  async function startCheckout() {
    if (flow.selectedPlan === 'free') {
      setFlow((current) => ({ ...current, paymentStatus: 'processing' }));
      setMessage({ tone: 'info', text: 'FREE 플랜은 결제 없이 바로 스토어를 활성화합니다.' });
      await finalizeActivation(`free_${Date.now()}`, false, 'free');
      return;
    }

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
      await verifyAndFinalizePaidActivation(payment.paymentId, 'browser');
    } catch (error) {
      setFlow((current) => ({ ...current, paymentStatus: 'failed', step: 'payment' }));
      setMessage({
        tone: 'error',
        text:
          error instanceof PortOneCheckoutError
            ? error.code === 'PORTONE_BROWSER_ENV_MISSING' || error.code === 'PORTONE_BROWSER_ENV_INVALID'
              ? '결제 환경 구성이 아직 완료되지 않았습니다. 관리자 설정을 확인한 뒤 다시 시도해 주세요.'
              : error.message
            : '결제 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  }

  function resetOnboardingFlow() {
    clearOnboardingFlowState();
    startTransition(() => {
      setFlow(createInitialOnboardingFlowState());
      setMessage(null);
      setRequestErrors({});
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('portone');
        next.delete('paymentId');
        next.delete('code');
        return next;
      });
    });
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }

  const selectedIndustryLabel = getIndustryLabel(flow.diagnosisInput.industryType);
  const selectedStoreModeLabel =
    flow.diagnosisInput.storeModeSelection === 'not_sure' ? '아직 모르겠음' : getRecommendedStoreModeLabel(flow.diagnosisInput.storeModeSelection);
  const selectedConcernLabel = getConcernLabel(flow.diagnosisInput.currentConcern);
  const selectedDesiredOutcomeLabel = getDesiredOutcomeLabel(flow.diagnosisInput.desiredOutcome);
  const selectedAvailableDataLabels = getAvailableDataLabels(flow.diagnosisInput.availableData);
  const diagnosisValid = Boolean(flow.diagnosisInput.region.trim()) && flow.diagnosisInput.availableData.length > 0;
  const currentIndex = steps.findIndex((item) => item.key === flow.step);
  const currentRequestWizardIndex = requestWizardSteps.findIndex((item) => item.key === flow.requestWizardStep);
  const suggestionLabels = featureLabels(flow.diagnosisResult?.recommendedModules ?? []);
  const currentPlanTitle = planCards.find((plan) => plan.code === flow.selectedPlan)?.title || 'FREE';
  const recommendedFeatureSet = useMemo(
    () => new Set(flow.diagnosisResult?.recommendedModules ?? []),
    [flow.diagnosisResult?.recommendedModules],
  );
  const selectedFeatureLabels = featureLabels(flow.requestDraft.selectedFeatures);
  const currentStoreLabel = flow.requestDraft.storeName || flow.requestDraft.brandName || '새 스토어 초안';
  const worldStepIndex = runDiagnosis.isPending
    ? 2
    : flow.step === 'result'
      ? 2
      : flow.step === 'request'
        ? 3
        : flow.step === 'payment' || flow.step === 'activation'
          ? 4
          : diagnosisValid
            ? 1
            : 0;
  const worldStep = getDiagnosisCorridorStep(worldStepIndex);
  const mybiCompanionMode =
    message?.tone === 'error'
      ? 'alert'
      : runDiagnosis.isPending
        ? 'thinking'
        : flow.step === 'request'
          ? 'speaking'
        : flow.step === 'diagnosis'
          ? 'listening'
          : 'floating-guide';
  const mybiHighlights = [
    selectedIndustryLabel,
    selectedStoreModeLabel,
    selectedConcernLabel,
    selectedDesiredOutcomeLabel,
    ...selectedAvailableDataLabels.slice(0, 2),
    ...selectedFeatureLabels.slice(0, 3),
  ].filter(Boolean);
  const mybiContextSummary =
    flow.step === 'diagnosis'
      ? `${selectedIndustryLabel} 업종의 공개 유입과 입력 채널 구조를 정리하는 단계입니다.`
      : flow.step === 'result'
        ? `진단 결과를 고객 기억 축으로 묶어 운영 액션과 권장 플랜을 해석하는 단계입니다.`
        : flow.step === 'request'
          ? `${currentStoreLabel}에 들어갈 공개 문구, 운영 모드, 데이터 모드, 앱 구성을 구체화하는 단계입니다.`
          : flow.step === 'payment'
            ? `${currentPlanTitle} 플랜을 기준으로 결제 후 생성과 승인까지 이어지는 단계입니다.`
            : `${currentStoreLabel}의 스토어 쉘과 대시보드가 정착하는 payoff 단계입니다.`;
  const worldSurfaceRef = usePersistentDiagnosisWorldSurface({
    changedAfterInput: message?.text,
    companionMode: mybiCompanionMode,
    contextSummary: mybiContextSummary,
    layoutMode: 'floating',
    nextAction: worldStep.supportLine,
    planLabel: currentPlanTitle,
    pulseKey: worldStepIndex,
    routeLabel: '스토어 진단 온보딩',
    selectedHighlights: mybiHighlights,
    stepLabel: `${worldStep.number} ${worldStep.label}`,
    stepIndex: worldStepIndex,
    storeLabel: currentStoreLabel,
    title: `${worldStep.number} ${worldStep.label}`,
  });

  return (
    <main className="relative min-h-screen bg-[#f6f2ea]" data-onboarding-layout="mybi-flow">
      <div ref={worldSurfaceRef} className="pointer-events-none absolute inset-0" aria-hidden />

      <div className="page-shell relative space-y-7 py-8 sm:py-10 lg:py-12">

        {/* ── 헤더 ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" data-mybi-anchor="onboarding-overview">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500">AI 매장 진단 · 무료 시작</p>
            <h1 className="mt-2 break-keep font-display text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
              {flow.step === 'diagnosis' && '매장 정보를 입력해 주세요'}
              {flow.step === 'result' && 'AI 진단 결과를 확인하세요'}
              {flow.step === 'request' && '스토어 기본 정보를 입력해 주세요'}
              {flow.step === 'payment' && '플랜을 선택하고 시작하세요'}
              {flow.step === 'activation' && '스토어 생성이 완료되었습니다'}
            </h1>
            <p className="mt-1.5 max-w-xl break-keep text-sm leading-relaxed text-slate-500">
              {flow.step === 'diagnosis' && '5가지 질문에 답하면 AI가 매장에 맞는 운영 전략과 추천 플랜을 분석합니다.'}
              {flow.step === 'result' && '운영 점수, 핵심 병목, 즉시 실행 액션을 확인하고 스토어 생성을 이어가세요.'}
              {flow.step === 'request' && '기본 정보를 입력하면 AI 진단 결과가 자동으로 채워집니다.'}
              {flow.step === 'payment' && '결제가 완료되면 스토어가 즉시 활성화되고 대시보드로 이동합니다.'}
              {flow.step === 'activation' && '대시보드에서 매장 운영을 시작하세요.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:mt-1">
            <Link className="btn-secondary !py-2 !text-sm" to="/pricing">요금제 보기</Link>
            <button className="btn-ghost !py-2 !text-sm" onClick={resetOnboardingFlow} type="button">처음부터</button>
          </div>
        </header>

        {/* ── 스텝 인디케이터 ── */}
        <div className="section-card bg-white px-6 py-5" data-mybi-anchor="onboarding-progress">
          <div className="flex items-start">
            {steps.map((step, index) => {
              const done = index < currentIndex;
              const current = index === currentIndex;
              const isLast = index === steps.length - 1;
              return (
                <div key={step.key} className="flex flex-1 items-start">
                  <div className="flex flex-col items-center gap-2 text-center">
                    {/* 원형 번호 */}
                    <div className={[
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                      done
                        ? 'bg-emerald-500 text-white'
                        : current
                          ? 'bg-[#ec5b13] text-white shadow-[0_4px_14px_-2px_rgba(236,91,19,0.55)]'
                          : 'bg-slate-100 text-slate-400',
                    ].join(' ')}>
                      {done ? (
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                          <path d="M1 4.5L4.5 8L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    {/* 라벨 */}
                    <div className="min-w-0 max-w-[72px] sm:max-w-[100px]">
                      <p className={[
                        'break-keep text-[11px] font-semibold leading-tight',
                        current ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400',
                      ].join(' ')}>
                        {step.label}
                      </p>
                      <p className={`mt-0.5 hidden text-[10px] leading-tight sm:block ${current ? 'text-slate-400' : 'text-slate-300'}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                  {/* 구분선 */}
                  {!isLast && (
                    <div className={`mx-2 mt-4 h-px flex-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      {message ? (
        <div className={[
          'flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm font-medium',
          message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
          message.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' :
          'border-blue-200 bg-blue-50 text-blue-800',
        ].join(' ')}>
          <span className="mt-0.5 shrink-0 text-base">
            {message.tone === 'success' ? '✓' : message.tone === 'error' ? '!' : 'ℹ'}
          </span>
          <p className="leading-relaxed">{message.text}</p>
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-6" data-mybi-anchor="onboarding-active-flow">
          {flow.step === 'diagnosis' && !runDiagnosis.isPending ? (
            <Panel
              title="AI 매장 진단"
              subtitle="업종, 운영 방식, 현재 고민, 보유 데이터, 원하는 결과 — 5가지를 선택하면 AI가 맞춤 운영 전략을 분석합니다."
            >
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
                  <label>
                    <span className="field-label">지역</span>
                    <input
                      className="input-base"
                      onChange={(event) => updateDiagnosis('region', event.target.value)}
                      placeholder="예: 서울 성수동"
                      value={flow.diagnosisInput.region}
                    />
                    <p className="mt-2 text-sm leading-6 text-slate-500">지역 상권에 따라 AI 추천 전략이 달라집니다.</p>
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">선택 현황</p>
                    <div className="mt-3 space-y-2.5 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-semibold text-slate-400">업종</span>
                        <span className="font-medium">{selectedIndustryLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-semibold text-slate-400">운영</span>
                        <span className="font-medium">{selectedStoreModeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-semibold text-slate-400">고민</span>
                        <span className="font-medium">{selectedConcernLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-semibold text-slate-400">목표</span>
                        <span className="font-medium">{selectedDesiredOutcomeLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Step 1</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">어떤 업종인가요?</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">업종을 선택하면 그에 맞는 운영 전략을 분석합니다.</p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">필수</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {DIAGNOSIS_INDUSTRY_OPTIONS.map((option) => (
                      <DiagnosisChoiceCard
                        key={option.value}
                        active={flow.diagnosisInput.industryType === option.value}
                        caption="업종"
                        description={option.description}
                        onClick={() => updateDiagnosis('industryType', option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Step 2</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">현재 운영 방식은 어떻게 되나요?</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">주문 중심인지, 예약 중심인지, 아직 모르겠어도 괜찮습니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {DIAGNOSIS_STORE_MODE_OPTIONS.map((option) => (
                      <DiagnosisChoiceCard
                        key={option.value}
                        active={flow.diagnosisInput.storeModeSelection === option.value}
                        caption="운영 방식"
                        description={option.description}
                        onClick={() => updateDiagnosis('storeModeSelection', option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Step 3</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">가장 급한 고민이 무엇인가요?</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">선택하신 고민을 기준으로 AI가 우선 개선 방향을 제안합니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {DIAGNOSIS_CONCERN_OPTIONS.map((option) => (
                      <DiagnosisChoiceCard
                        key={option.value}
                        active={flow.diagnosisInput.currentConcern === option.value}
                        caption="현재 고민"
                        description={option.description}
                        onClick={() => updateDiagnosis('currentConcern', option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Step 4</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">현재 갖고 있는 데이터가 있나요?</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">복수 선택 가능합니다. 아직 없어도 괜찮아요.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">복수 선택</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {DIAGNOSIS_AVAILABLE_DATA_OPTIONS.map((option) => (
                      <DiagnosisToggleChip
                        key={option.value}
                        active={flow.diagnosisInput.availableData.includes(option.value)}
                        label={option.label}
                        onClick={() => toggleDiagnosisAvailableData(option.value)}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    현재 선택: {selectedAvailableDataLabels.length ? selectedAvailableDataLabels.join(', ') : '선택된 데이터가 없습니다.'}
                  </p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Step 5</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">어떤 결과를 원하시나요?</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">목표에 따라 AI가 추천하는 기능과 전략이 달라집니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {DIAGNOSIS_DESIRED_OUTCOME_OPTIONS.map((option) => (
                      <DiagnosisChoiceCard
                        key={option.value}
                        active={flow.diagnosisInput.desiredOutcome === option.value}
                        caption="원하는 결과"
                        description={option.description}
                        onClick={() => updateDiagnosis('desiredOutcome', option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                </section>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button className="btn-primary" disabled={!diagnosisValid} onClick={() => void submitDiagnosis()} type="button">
                  AI 진단 결과 보기
                </button>
                <p className="text-sm leading-6 text-slate-500">운영 점수, 핵심 병목, 즉시 실행 액션, 추천 플랜을 바로 확인할 수 있습니다.</p>
              </div>
            </Panel>
          ) : null}

          {flow.step === 'diagnosis' && runDiagnosis.isPending ? (
            <DiagnosisLoadingPanel
              businessType={selectedIndustryLabel}
              customerType={selectedDesiredOutcomeLabel}
              region={flow.diagnosisInput.region}
              stages={DIAGNOSIS_LOADING_STAGES}
            />
          ) : null}

          {flow.step === 'result' && flow.diagnosisResult ? (
            <Panel
              title="AI 진단 결과"
              subtitle="운영 점수, 핵심 병목, 매출 개선 포인트, 즉시 실행 액션을 한 번에 확인하세요."
            >
              <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl bg-slate-950 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">AI 운영 점수</p>
                        <p className="mt-2 font-display text-5xl font-black leading-none">{flow.diagnosisResult.score}<span className="ml-1 text-2xl text-slate-400">점</span></p>
                      </div>
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${analysisToneClasses(flow.diagnosisResult.analysisSource)}`}>
                        {diagnosisSourceLabel(flow.diagnosisResult.analysisSource)}
                      </span>
                    </div>
                    <div className="border-t border-white/10 px-6 py-4">
                      <p className="break-words text-sm leading-7 text-slate-300">{flow.diagnosisResult.summary}</p>
                    </div>
                    <div className="border-t border-white/10 px-6 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">AI 리포트 요약</p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-300">{flow.diagnosisResult.reportSummary}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">핵심 병목</p>
                      <p className="mt-3 font-display text-4xl font-black text-slate-900">{flow.diagnosisResult.coreBottlenecks.length}<span className="ml-1 text-xl font-semibold text-slate-400">개</span></p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">가장 먼저 해결해야 할 운영 병목입니다.</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">추천 플랜</p>
                      <p className="mt-3 font-display text-4xl font-black text-slate-900">{currentPlanTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">진단 결과 기준 최적 플랜입니다.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">즉시 액션</p>
                      <p className="mt-3 font-display text-4xl font-black text-slate-900">{flow.diagnosisResult.immediateActions.length}<span className="ml-1 text-xl font-semibold text-slate-400">개</span></p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">오늘 바로 실행할 수 있는 액션입니다.</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-500">추천 운영 구조</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">AI 추천</span>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">추천 Store Mode</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {getRecommendedStoreModeLabel(flow.diagnosisResult.recommendedStoreMode)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">점주가 첫 화면에서 먼저 봐야 할 운영 흐름 기준입니다.</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">추천 Data Mode</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {getRecommendedDataModeLabel(flow.diagnosisResult.recommendedDataMode)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">현재 보유 데이터와 원하는 결과를 함께 고려한 수집 방식입니다.</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">추천 Modules</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {flow.diagnosisResult.recommendedModules.map((featureKey) => (
                          <span key={featureKey} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {getFeatureLabel(featureKey)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">추천 질문 4개</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {flow.diagnosisResult.recommendedQuestions.map((question) => (
                          <div key={question} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                            {question}
                          </div>
                        ))}
                      </div>
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
                <button
                  className="btn-primary"
                  onClick={() => setFlow((current) => ({ ...current, requestWizardStep: 'basic', step: 'request' }))}
                  type="button"
                >
                  다음 단계로 계속
                </button>
                <button className="btn-secondary" onClick={() => setFlow((current) => ({ ...current, step: 'diagnosis' }))} type="button">
                  이전으로
                </button>
              </div>
            </Panel>
          ) : null}

          {flow.step === 'request' ? (
            <Panel
              title="스토어 생성"
              subtitle="기본 정보, 운영 모드, 앱 선택, 공개 화면 설정을 단계별로 입력합니다. AI 진단 결과가 기본값으로 채워져 있습니다."
            >
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {requestWizardSteps.map((step, index) => {
                  const done = index < currentRequestWizardIndex;
                  const current = index === currentRequestWizardIndex;
                  const interactive = index <= currentRequestWizardIndex;

                  return (
                    <button
                      key={step.key}
                      className={`rounded-3xl border p-4 text-left transition ${
                        done
                          ? 'border-emerald-200 bg-emerald-50'
                          : current
                            ? 'border-orange-200 bg-orange-50'
                            : 'border-slate-200 bg-white'
                      } ${interactive ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                      disabled={!interactive}
                      onClick={() => {
                        setMessage(null);
                        setFlow((currentFlow) => ({ ...currentFlow, requestWizardStep: step.key }));
                      }}
                      type="button"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">0{index + 1}</p>
                      <p className="mt-3 font-semibold text-slate-900">{step.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{step.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-orange-700">AI가 채운 기본값</p>
                    <p className="mt-1 text-sm leading-6 text-orange-900">
                      AI 진단 결과를 기반으로 운영 방식, 데이터 수집, 추천 앱이 자동으로 입력되었습니다. 필요하면 수정하세요.
                    </p>
                  </div>
                  {flow.diagnosisResult ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-700">
                      {getRecommendedStoreModeLabel(flow.diagnosisResult.recommendedStoreMode)} / {getRecommendedDataModeLabel(flow.diagnosisResult.recommendedDataMode)}
                    </span>
                  ) : null}
                </div>
              </div>

              {flow.requestWizardStep === 'basic' ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <label>
                      <span className="field-label">스토어명</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('storeName', event.target.value)}
                        placeholder="예: 성수 브런치 하우스"
                        value={flow.requestDraft.storeName}
                      />
                      <FieldErrorText message={requestErrors.storeName} />
                    </label>
                    <label>
                      <span className="field-label">브랜드명</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('brandName', event.target.value)}
                        placeholder="예: Aurora Brunch"
                        value={flow.requestDraft.brandName}
                      />
                      <FieldErrorText message={requestErrors.brandName} />
                    </label>
                    <label>
                      <span className="field-label">대표자명</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('ownerName', event.target.value)}
                        placeholder="대표자명을 입력해 주세요"
                        value={flow.requestDraft.ownerName}
                      />
                      <FieldErrorText message={requestErrors.ownerName} />
                    </label>
                    <label>
                      <span className="field-label">연락처</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('phone', event.target.value)}
                        placeholder="예: 010-1234-5678"
                        value={flow.requestDraft.phone}
                      />
                      <FieldErrorText message={requestErrors.phone} />
                    </label>
                    <label>
                      <span className="field-label">이메일</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('email', event.target.value)}
                        placeholder="예: owner@store.kr"
                        type="email"
                        value={flow.requestDraft.email}
                      />
                      <FieldErrorText message={requestErrors.email} />
                    </label>
                    <label>
                      <span className="field-label">업종</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('businessType', event.target.value)}
                        placeholder="업종을 입력해 주세요"
                        value={flow.requestDraft.businessType}
                      />
                      <p className="mt-2 text-sm leading-6 text-slate-500">AI 진단 업종 결과를 기본값으로 넣었습니다.</p>
                      <FieldErrorText message={requestErrors.businessType} />
                    </label>
                    <label className="md:col-span-2">
                      <span className="field-label">주소</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('address', event.target.value)}
                        placeholder="예: 서울특별시 성동구 성수이로 98"
                        value={flow.requestDraft.address}
                      />
                      <FieldErrorText message={requestErrors.address} />
                    </label>
                    <label>
                      <span className="field-label">영업시간</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('openingHours', event.target.value)}
                        placeholder="예: 매일 10:00 - 21:00"
                        value={flow.requestDraft.openingHours}
                      />
                      <FieldErrorText message={requestErrors.openingHours} />
                    </label>
                    <label>
                      <span className="field-label">스토어 주소</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('requestedSlug', event.target.value)}
                        placeholder="예: seongsu-brunch-house"
                        value={flow.requestDraft.requestedSlug}
                      />
                      <p
                        className={`mt-2 text-sm leading-6 ${
                          slugState.tone === 'error'
                            ? 'text-rose-600'
                            : slugState.tone === 'success'
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                        }`}
                      >
                        공개 주소: /{slugPreview} · {slugState.message}
                      </p>
                      <FieldErrorText message={requestErrors.requestedSlug} />
                    </label>
                  </div>
                </div>
              ) : null}

              {flow.requestWizardStep === 'storeMode' ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {storeModeWizardOptions.map((option) => (
                      <DiagnosisChoiceCard
                        key={option.value}
                        active={flow.requestDraft.storeMode === option.value}
                        caption={flow.diagnosisResult?.recommendedStoreMode === option.value ? 'AI 추천' : '운영 모드'}
                        description={option.description}
                        onClick={() => updateRequest('storeMode', option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                  <FieldErrorText message={requestErrors.storeMode} />
                </div>
              ) : null}

              {flow.requestWizardStep === 'dataMode' ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {STORE_SETUP_DATA_MODE_OPTIONS.map((option) => (
                      <DiagnosisChoiceCard
                        key={option.value}
                        active={flow.requestDraft.dataMode === option.value}
                        caption={flow.diagnosisResult?.recommendedDataMode === option.value ? 'AI 추천' : '데이터 모드'}
                        description={option.description}
                        onClick={() => updateRequest('dataMode', option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                  <FieldErrorText message={requestErrors.dataMode} />
                </div>
              ) : null}

              {flow.requestWizardStep === 'modules' ? (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">현재 선택 앱 {flow.requestDraft.selectedFeatures.length}개</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">점주가 처음부터 이해할 수 있는 앱만 남기고, 지금 꼭 필요한 것 위주로 구성합니다.</p>
                    </div>
                    {flow.diagnosisResult ? (
                      <button
                        className="btn-secondary !px-4 !py-2"
                        onClick={() => updateRequest('selectedFeatures', flow.diagnosisResult!.recommendedModules)}
                        type="button"
                      >
                        AI 추천 앱 다시 적용
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {featureDefinitions.map((feature) => (
                      <FeatureSelectionCard
                        key={feature.key}
                        active={flow.requestDraft.selectedFeatures.includes(feature.key)}
                        description={feature.description}
                        highlights={feature.highlights}
                        label={feature.label}
                        onClick={() => toggleRequestFeature(feature.key)}
                        recommended={recommendedFeatureSet.has(feature.key)}
                      />
                    ))}
                  </div>
                  <FieldErrorText message={requestErrors.selectedFeatures} />
                </div>
              ) : null}

              {flow.requestWizardStep === 'public' ? (
                <div className="mt-6 space-y-6">
                  <section>
                    <p className="text-sm font-semibold text-slate-900">공개 화면 테마</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {STORE_SETUP_THEME_OPTIONS.map((option) => (
                        <DiagnosisChoiceCard
                          key={option.value}
                          active={flow.requestDraft.themePreset === option.value}
                          caption="테마"
                          description={option.description}
                          onClick={() => updateRequest('themePreset', option.value)}
                          title={option.label}
                        />
                      ))}
                    </div>
                    <FieldErrorText message={requestErrors.themePreset} />
                  </section>

                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="md:col-span-2">
                      <span className="field-label">대표 문구</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('tagline', event.target.value)}
                        placeholder="예: 오늘 메뉴와 매장 상황을 한 번에 확인하세요"
                        value={flow.requestDraft.tagline}
                      />
                      <FieldErrorText message={requestErrors.tagline} />
                    </label>
                    <label className="md:col-span-2">
                      <span className="field-label">소개 문구</span>
                      <textarea
                        className="input-base min-h-28"
                        onChange={(event) => updateRequest('description', event.target.value)}
                        placeholder="점주가 보여주고 싶은 설명을 입력해 주세요"
                        value={flow.requestDraft.description}
                      />
                      <FieldErrorText message={requestErrors.description} />
                    </label>
                    <label>
                      <span className="field-label">기본 CTA 문구</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('primaryCtaLabel', event.target.value)}
                        placeholder="예: 오늘 메뉴 보기"
                        value={flow.requestDraft.primaryCtaLabel}
                      />
                      <FieldErrorText message={requestErrors.primaryCtaLabel} />
                    </label>
                    <label>
                      <span className="field-label">모바일 CTA 문구</span>
                      <input
                        className="input-base"
                        onChange={(event) => updateRequest('mobileCtaLabel', event.target.value)}
                        placeholder="예: 바로 보기"
                        value={flow.requestDraft.mobileCtaLabel}
                      />
                      <FieldErrorText message={requestErrors.mobileCtaLabel} />
                    </label>
                  </div>

                  <section>
                    <p className="text-sm font-semibold text-slate-900">모바일 첫 CTA 연결 방식</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {STORE_SETUP_PREVIEW_TARGET_OPTIONS.map((option) => (
                        <DiagnosisChoiceCard
                          key={option.value}
                          active={flow.requestDraft.previewTarget === option.value}
                          caption="모바일 CTA"
                          description={option.description}
                          onClick={() => updateRequest('previewTarget', option.value)}
                          title={option.label}
                        />
                      ))}
                    </div>
                    <FieldErrorText message={requestErrors.previewTarget} />
                  </section>

                  <section>
                    <p className="text-sm font-semibold text-slate-900">공개 상태</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {[
                        ['public', '공개로 시작', '스토어 대문을 바로 데모 가능하게 엽니다.'],
                        ['private', '비공개로 시작', '내부 검수 후 공개할 수 있게 준비합니다.'],
                      ].map(([value, label, desc]) => (
                        <button
                          key={value}
                          className={`rounded-3xl border px-4 py-4 text-left transition ${
                            flow.requestDraft.publicStatus === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'
                          }`}
                          onClick={() => updateRequest('publicStatus', value as 'public' | 'private')}
                          type="button"
                        >
                          <p className="font-semibold">{label}</p>
                          <p className={`mt-1 text-sm leading-6 ${flow.requestDraft.publicStatus === value ? 'text-slate-200' : 'text-slate-500'}`}>{desc}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}

              {flow.requestWizardStep === 'summary' ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-500">기본 정보</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm leading-6 text-slate-700">
                          <p>스토어명: {flow.requestDraft.storeName || '입력 필요'}</p>
                          <p>브랜드명: {flow.requestDraft.brandName || '입력 필요'}</p>
                          <p>대표자: {flow.requestDraft.ownerName || '입력 필요'}</p>
                          <p>연락처: {flow.requestDraft.phone || '입력 필요'}</p>
                          <p>이메일: {flow.requestDraft.email || '입력 필요'}</p>
                          <p>영업시간: {flow.requestDraft.openingHours || '입력 필요'}</p>
                          <p className="sm:col-span-2">주소: {flow.requestDraft.address || '입력 필요'}</p>
                          <p className="sm:col-span-2">공개 주소: /{slugPreview}</p>
                        </div>
                        <FieldErrorText message={requestErrors.requestedSlug} />
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-500">운영 구조</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm leading-6 text-slate-700">
                          <p>운영 방식: {getRecommendedStoreModeLabel(flow.requestDraft.storeMode)}</p>
                          <p>데이터 수집: {getRecommendedDataModeLabel(flow.requestDraft.dataMode)}</p>
                          <p>공개 상태: {flow.requestDraft.publicStatus === 'public' ? '공개로 시작' : '비공개로 시작'}</p>
                          <p>모바일 첫 CTA: {STORE_SETUP_PREVIEW_TARGET_OPTIONS.find((option) => option.value === flow.requestDraft.previewTarget)?.label}</p>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-500">포함 앱</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {flow.requestDraft.selectedFeatures.map((featureKey) => (
                            <span key={featureKey} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                              {getFeatureLabel(featureKey)}
                            </span>
                          ))}
                        </div>
                        <FieldErrorText message={requestErrors.selectedFeatures} />
                      </div>
                    </div>

                    <div className="rounded-[32px] bg-slate-950 p-6 text-white">
                      <p className="text-sm font-semibold text-orange-200">공개 화면 미리보기</p>
                      <p className="mt-4 text-2xl font-black">{flow.requestDraft.brandName || flow.requestDraft.storeName || '브랜드명 입력 전'}</p>
                      <p className="mt-3 text-lg font-semibold">{flow.requestDraft.tagline}</p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{flow.requestDraft.description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
                          {STORE_SETUP_THEME_OPTIONS.find((option) => option.value === flow.requestDraft.themePreset)?.label}
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">{flow.requestDraft.primaryCtaLabel}</span>
                        <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">{flow.requestDraft.mobileCtaLabel}</span>
                      </div>
                      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">생성 후 이동</p>
                        <p className="mt-2 text-sm leading-6 text-slate-200">결제와 생성이 끝나면 선택된 demo storeId 기준 스토어 상세 화면으로 이동합니다.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                {currentRequestWizardIndex > 0 ? (
                  <button className="btn-secondary" onClick={() => moveRequestWizard(-1)} type="button">
                    이전 단계
                  </button>
                ) : (
                  <button className="btn-secondary" onClick={() => setFlow((current) => ({ ...current, step: 'result' }))} type="button">
                    진단 결과로 돌아가기
                  </button>
                )}
                {flow.requestWizardStep !== 'summary' ? (
                  <button className="btn-primary" onClick={() => moveRequestWizard(1)} type="button">
                    다음 단계
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={submitRequest.isPending}
                    onClick={() => {
                      if (!validateRequestSummary()) {
                        return;
                      }
                      void submitRequest.mutateAsync();
                    }}
                    type="button"
                  >
                    {submitRequest.isPending ? '요청 저장 중...' : '스토어 생성 요청 제출'}
                  </button>
                )}
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
            {flow.paymentStatus === 'processing'
              ? flow.selectedPlan === 'free'
                ? '스토어 활성화 중...'
                : '결제창 준비 중...'
              : flow.selectedPlan === 'free'
                ? 'FREE 플랜 바로 시작'
                : 'PortOne 결제 진행'}
          </button>
                <button className="btn-secondary" onClick={() => setFlow((current) => ({ ...current, requestWizardStep: 'summary', step: 'request' }))} type="button">
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
                  <button className="btn-primary" onClick={() => navigate(`/dashboard/stores/${flow.createdStoreId}`, { replace: true })} type="button">
                    생성된 스토어 바로 열기
                  </button>
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5" data-mybi-anchor="onboarding-sidebar" data-mybi-avoid>

          {/* AI 상태 카드 */}
          <div className="section-card bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                  <span className="text-sm">🤖</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">MyBiz AI</p>
                  <p className="text-[11px] text-slate-400">{worldStep.number} {worldStep.label}</p>
                </div>
              </div>
              <span className={[
                'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                mybiCompanionMode === 'thinking' ? 'bg-violet-100 text-violet-700' :
                mybiCompanionMode === 'listening' ? 'bg-blue-100 text-blue-700' :
                mybiCompanionMode === 'alert' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-600',
              ].join(' ')}>
                {mybiCompanionMode === 'thinking' ? '분석 중' :
                 mybiCompanionMode === 'listening' ? '입력 대기' :
                 mybiCompanionMode === 'alert' ? '오류' : '안내 중'}
              </span>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm leading-6 text-slate-600">{worldStep.supportLine}</p>
            </div>
          </div>

          {/* 진단 요약 */}
          <Panel title="진단 요약" subtitle="현재까지 입력한 정보를 확인하세요.">
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">추천 플랜</p>
                <p className="mt-1.5 font-display text-2xl font-black">{currentPlanTitle}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  {flow.diagnosisResult ? 'AI 진단 기준 최적 플랜' : '진단 완료 후 자동 추천'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">입력 현황</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: '업종', value: selectedIndustryLabel },
                    { label: '지역', value: flow.diagnosisInput.region || '미입력' },
                    { label: '고민', value: selectedConcernLabel },
                    { label: '목표', value: selectedDesiredOutcomeLabel },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      <span className="w-10 shrink-0 text-[11px] font-semibold text-slate-400">{label}</span>
                      <span className="truncate text-slate-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {flow.diagnosisResult && !runDiagnosis.isPending ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">AI 분석 요약</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${analysisToneClasses(flow.diagnosisResult.analysisSource)}`}>
                      {diagnosisSourceLabel(flow.diagnosisResult.analysisSource)}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-slate-600">{flow.diagnosisResult.reportSummary}</p>
                </div>
              ) : null}

              {flow.requestDraft.storeName ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">스토어 정보</p>
                  <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                    <div className="flex gap-2"><span className="w-12 shrink-0 text-slate-400">이름</span><span className="font-medium">{flow.requestDraft.storeName}</span></div>
                    <div className="flex gap-2"><span className="w-12 shrink-0 text-slate-400">주소</span><span className="font-mono text-xs text-slate-600">/{slugPreview}</span></div>
                    <div className="flex gap-2"><span className="w-12 shrink-0 text-slate-400">운영</span><span>{getRecommendedStoreModeLabel(flow.requestDraft.storeMode)}</span></div>
                  </div>
                </div>
              ) : null}

              {suggestionLabels.length && !runDiagnosis.isPending ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">AI 추천 기능</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {suggestionLabels.map((item) => (
                      <span key={item} className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>

          {/* 다음 단계 안내 */}
          <Panel title="다음 단계" subtitle="현재 단계에서 이어질 내용을 안내합니다.">
            <div className="rounded-xl bg-slate-50 px-4 py-3.5 text-sm leading-7 text-slate-600">
              {flow.step === 'diagnosis' && !runDiagnosis.isPending && <p>5가지 질문을 모두 선택하고 <strong>AI 진단 결과 보기</strong>를 누르세요.</p>}
              {flow.step === 'diagnosis' && runDiagnosis.isPending && <p>AI가 입력값을 분석 중입니다. 잠시만 기다려주세요.</p>}
              {flow.step === 'result' && <p>결과 확인 후 <strong>다음 단계로 계속</strong>을 누르면 스토어 생성 단계로 이동합니다.</p>}
              {flow.step === 'request' && <p>모든 단계를 완료하고 <strong>요청 제출</strong>을 누르면 결제 단계로 이동합니다.</p>}
              {flow.step === 'payment' && <p>플랜을 선택하고 결제하면 스토어가 즉시 생성됩니다.</p>}
              {flow.step === 'activation' && <p>대시보드로 이동하여 매장 운영을 시작하세요.</p>}
            </div>
          </Panel>
        </div>
      </div>
      </div>
    </main>
  );
}
