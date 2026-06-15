import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { DEFAULT_PRIORITY_WEIGHTS } from '@/shared/lib/analyticsProfiles';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useAccessibleStores, useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getStoreBrandConfig, getStorePriorityWeights } from '@/shared/lib/storeData';
import {
  getStoreSettings,
  updateStorePrioritySettings,
  updateStoreSettings,
  type UpdateStoreSettingsInput,
} from '@/shared/lib/services/mvpService';
import { buildStorePath, ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug } from '@/shared/lib/storeSlug';
import type { StorePriorityWeights } from '@/shared/types/models';

const THEME_OPTIONS: Array<{
  value: UpdateStoreSettingsInput['themePreset'];
  label: string;
  description: string;
  bg: string;
  text: string;
  accent: string;
}> = [
  { value: 'light',   label: '라이트',   description: '다크 슬레이트 + 브랜드 포인트',  bg: 'bg-slate-950', text: 'text-white',       accent: 'bg-orange-400' },
  { value: 'warm',    label: '따뜻함',   description: '앰버 톤, 카페·푸드에 잘 어울림', bg: 'bg-amber-900',  text: 'text-amber-50',   accent: 'bg-amber-300' },
  { value: 'modern',  label: '모던',     description: '에메랄드 다크, 세련된 인상',       bg: 'bg-teal-950',  text: 'text-emerald-50', accent: 'bg-teal-400' },
  { value: 'minimal', label: '미니멀',   description: '화이트 베이스, 깔끔한 정보 전달', bg: 'bg-white border border-slate-200', text: 'text-slate-900',  accent: 'bg-slate-900' },
  { value: 'bold',    label: '볼드',     description: '풀 블랙, 강렬한 브랜드 인상',     bg: 'bg-black',     text: 'text-white',      accent: 'bg-white' },
];

const FONT_OPTIONS: Array<{
  value: UpdateStoreSettingsInput['fontFamily'];
  label: string;
  description: string;
  sample: string;
}> = [
  { value: 'pretendard', label: 'Pretendard', description: '기본값 · 한국어에 최적화된 현대적 서체', sample: '안녕하세요 Hello 123' },
  { value: 'noto',       label: 'Noto Sans KR', description: '가독성 중심 · 본문이 많은 매장에 적합', sample: '안녕하세요 Hello 123' },
  { value: 'inter',      label: 'Inter',        description: '국제적 감각 · 영문 브랜드에 잘 어울림', sample: 'Hello Store 123' },
];

function createInitialForm(): UpdateStoreSettingsInput {
  return {
    storeName: '',
    slug: '',
    businessType: '',
    phone: '',
    email: '',
    address: '',
    publicStatus: 'private',
    homepageVisible: false,
    consultationEnabled: true,
    inquiryEnabled: true,
    reservationEnabled: true,
    orderEntryEnabled: true,
    logoUrl: '',
    brandColor: '#ec5b13',
    tagline: '',
    description: '',
    openingHours: '',
    directions: '',
    parkingNote: '',
    heroImageUrl: '',
    storefrontImageUrl: '',
    interiorImageUrl: '',
    noticeTitle: '',
    noticeContent: '',
    themePreset: 'light',
    fontFamily: 'pretendard',
  };
}

const priorityFieldDefinitions: Array<{
  description: string;
  key: keyof StorePriorityWeights;
  label: string;
}> = [
  {
    description: '총매출, 객단가, 주문 매출 흐름에 더 큰 가중치를 둡니다.',
    key: 'revenue',
    label: '매출',
  },
  {
    description: '신규 고객보다 재방문 전환과 단골 관리 액션을 우선합니다.',
    key: 'repeatCustomers',
    label: '재방문',
  },
  {
    description: '예약 흐름과 노쇼 관리, 예약 리마인드 운영을 강조합니다.',
    key: 'reservations',
    label: '예약',
  },
  {
    description: '상담 인입 이후 예약·결제 전환 동선을 더 강하게 봅니다.',
    key: 'consultationConversion',
    label: '상담전환',
  },
  {
    description: '리뷰량, 응답률, 브랜드 체감 지표를 더 강하게 반영합니다.',
    key: 'branding',
    label: '브랜딩',
  },
  {
    description: '피크타임 안정성과 운영 점수, 처리 효율을 더 크게 봅니다.',
    key: 'orderEfficiency',
    label: '주문효율',
  },
];

function sumPriorityWeights(weights: StorePriorityWeights) {
  return Object.values(weights).reduce((total, value) => total + value, 0);
}

export function BrandPage() {
  const { currentStore } = useCurrentStore();
  const accessibleStoresQuery = useAccessibleStores();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateStoreSettingsInput>(() => createInitialForm());
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [priorityWeights, setPriorityWeights] = useState<StorePriorityWeights>(() => ({ ...DEFAULT_PRIORITY_WEIGHTS }));
  const [priorityMessage, setPriorityMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  usePageMeta('매장 설정', '공개 매장에 필요한 기본 정보와 고객 행동 버튼을 정리하는 점주용 매장 설정 화면입니다.');

  const settingsQuery = useQuery({
    queryKey: queryKeys.brand(currentStore?.id || ''),
    queryFn: () => getStoreSettings(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    const config = getStoreBrandConfig(settingsQuery.data.store);
    const heroMedia = settingsQuery.data.media.find((media) => media.type === 'hero');
    const storefrontMedia = settingsQuery.data.media.find((media) => media.type === 'storefront');
    const interiorMedia = settingsQuery.data.media.find((media) => media.type === 'interior');
    const pinnedNotice = settingsQuery.data.notices.find((notice) => notice.is_pinned) || settingsQuery.data.notices[0];
    const capabilities = {
      consultationEnabled: settingsQuery.data.store.consultation_enabled ?? true,
      inquiryEnabled: settingsQuery.data.store.inquiry_enabled ?? true,
      reservationEnabled: settingsQuery.data.store.reservation_enabled ?? true,
      orderEntryEnabled: settingsQuery.data.store.order_entry_enabled ?? true,
      homepageVisible: settingsQuery.data.store.homepage_visible ?? settingsQuery.data.store.public_status === 'public',
    };

    setForm({
      storeName: settingsQuery.data.store.name,
      slug: settingsQuery.data.store.slug,
      businessType: config.business_type,
      phone: config.phone,
      email: config.email,
      address: config.address,
      publicStatus: settingsQuery.data.store.public_status,
      homepageVisible: capabilities.homepageVisible,
      consultationEnabled: capabilities.consultationEnabled,
      inquiryEnabled: capabilities.inquiryEnabled,
      reservationEnabled: capabilities.reservationEnabled,
      orderEntryEnabled: capabilities.orderEntryEnabled,
      logoUrl: settingsQuery.data.store.logo_url || '',
      brandColor: settingsQuery.data.store.brand_color,
      themePreset: settingsQuery.data.store.theme_preset ?? 'light',
      fontFamily: settingsQuery.data.store.font_family ?? 'pretendard',
      tagline: settingsQuery.data.store.tagline,
      description: settingsQuery.data.store.description,
      openingHours: settingsQuery.data.location?.opening_hours || '',
      directions: settingsQuery.data.location?.directions || '',
      parkingNote: settingsQuery.data.location?.parking_note || '',
      heroImageUrl: heroMedia?.image_url || '',
      storefrontImageUrl: storefrontMedia?.image_url || '',
      interiorImageUrl: interiorMedia?.image_url || '',
      noticeTitle: pinnedNotice?.title || '',
      noticeContent: pinnedNotice?.content || '',
    });
    setPriorityWeights(getStorePriorityWeights(settingsQuery.data.prioritySettings) || DEFAULT_PRIORITY_WEIGHTS);
  }, [settingsQuery.data]);

  const existingSlugs = useMemo(
    () =>
      (accessibleStoresQuery.data || [])
        .filter((store) => store.id !== currentStore?.id)
        .map((store) => normalizeStoreSlug(store.slug)),
    [accessibleStoresQuery.data, currentStore?.id],
  );

  const slugState = useMemo(() => {
    const normalized = normalizeStoreSlug(form.slug || form.storeName || 'mybiz-store');
    const reserved = isReservedSlug(normalized);
    const duplicated = existingSlugs.includes(normalized);
    const suggested = ensureUniqueStoreSlug(normalized, existingSlugs);

    if (!form.slug.trim()) {
      return {
        available: true,
        message: '매장명을 기준으로 주소를 자동 정리하고 있습니다.',
        preview: suggested,
        suggested,
        tone: 'info' as const,
      };
    }

    if (reserved) {
      return {
        available: false,
        message: '예약된 주소라서 사용할 수 없습니다. 추천 주소로 바꿔 주세요.',
        preview: normalized,
        suggested,
        tone: 'error' as const,
      };
    }

    if (duplicated) {
      return {
        available: false,
        message: '이미 사용 중인 주소입니다. 추천 주소를 적용하면 바로 저장할 수 있습니다.',
        preview: normalized,
        suggested,
        tone: 'error' as const,
      };
    }

    return {
      available: true,
      message: '사용 가능한 공개 매장 주소입니다.',
      preview: normalized,
      suggested,
      tone: 'success' as const,
    };
  }, [existingSlugs, form.slug, form.storeName]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateStoreSettings(currentStore!.id, {
        ...form,
        slug: slugState.preview,
      }),
    onSuccess: async (nextSettings) => {
      setMessage({ tone: 'success', text: '매장 설정을 저장했습니다. 공개 매장과 운영 화면에 바로 반영됩니다.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.brand(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStore(currentStore!.slug) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStore(nextSettings?.store.slug || slugState.preview) }),
      ]);
    },
    onError: (error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '매장 설정을 저장하지 못했습니다. 입력값을 다시 확인해 주세요.',
      });
    },
  });

  const priorityTotal = useMemo(() => sumPriorityWeights(priorityWeights), [priorityWeights]);
  const isPriorityValid = priorityTotal === 100;

  const priorityMutation = useMutation({
    mutationFn: () => updateStorePrioritySettings(currentStore!.id, priorityWeights),
    onSuccess: async () => {
      setPriorityMessage({ tone: 'success', text: '운영 우선순위를 저장했습니다. 대시보드 강조 순서가 바로 반영됩니다.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.brand(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(currentStore!.id) }),
      ]);
    },
    onError: (error) => {
      setPriorityMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '운영 우선순위를 저장하지 못했습니다.',
      });
    },
  });

  if (!currentStore) {
    return null;
  }

  const missingRequiredFields = [
    ['매장명', form.storeName],
    ['업종', form.businessType],
    ['연락처', form.phone],
    ['대표 이메일', form.email],
    ['매장 위치', form.address],
  ]
    .filter(([, value]) => !String(value || '').trim())
    .map(([label]) => label);
  const canSave = missingRequiredFields.length === 0 && slugState.available;
  const publicStorePath = buildStorePath(slugState.preview || currentStore.slug);
  const analyticsProfile = settingsQuery.data?.analyticsProfile;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="매장 설정"
        title="매장 설정"
        description="공개 매장에 필요한 기본 정보와 고객 행동 버튼을 한 번에 정리합니다."
        actions={
          <>
            <Link className="btn-secondary" to={publicStorePath}>
              공개 매장 보기
            </Link>
            <button className="btn-primary" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()} type="button">
              설정 저장
            </button>
          </>
        }
      />

      {message ? (
        <div
          className={`rounded-3xl border px-4 py-3 text-sm font-medium ${
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {!canSave ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          저장 전 확인: {missingRequiredFields.length ? `${missingRequiredFields.join(', ')} 입력 필요` : slugState.message}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <Panel title="기본 정보" subtitle="매장명, 주소, 업종, 연락처처럼 공개 매장과 결제 이후 운영 화면에 함께 쓰이는 값을 관리합니다.">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['storeName', '매장명', '예: 성수 브런치 하우스'],
                ['businessType', '업종', '예: 브런치 카페'],
                ['phone', '연락처', '예: 02-1234-5678'],
                ['email', '대표 이메일', '예: hello@store.kr'],
                ['address', '매장 위치', '예: 서울 성동구 성수동 123-4'],
              ].map(([field, label, placeholder]) => (
                <label className={field === 'address' ? 'md:col-span-2' : ''} key={field}>
                  <span className="field-label">{label}</span>
                  <input
                    className="input-base"
                    onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder={placeholder}
                    value={String(form[field as keyof UpdateStoreSettingsInput] || '')}
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <label>
                <span className="field-label">매장 주소</span>
                <input
                  className="input-base"
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="예: seongsu-brunch-house"
                  value={form.slug}
                />
                <p className="mt-2 text-sm leading-6 text-slate-500">공개 매장 URL과 QR 주문 링크에 그대로 사용됩니다.</p>
              </label>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">공개 주소 미리보기</p>
                <p className="mt-2 break-all text-base font-semibold text-slate-900">/{slugState.preview}</p>
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
                {slugState.suggested !== slugState.preview ? (
                  <button
                    className="mt-4 inline-flex text-sm font-bold text-orange-700"
                    onClick={() => setForm((current) => ({ ...current, slug: slugState.suggested }))}
                    type="button"
                  >
                    추천 주소 사용: /{slugState.suggested}
                  </button>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="운영 및 공개 설정" subtitle="매장 노출 상태와 고객이 바로 누를 CTA를 이곳에서 정리합니다.">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="field-label">공개 상태</span>
                <select
                  className="input-base"
                  onChange={(event) => setForm((current) => ({ ...current, publicStatus: event.target.value as UpdateStoreSettingsInput['publicStatus'] }))}
                  value={form.publicStatus}
                >
                  <option value="private">비공개</option>
                  <option value="public">공개</option>
                </select>
              </label>
              <label>
                <span className="field-label">운영 시간</span>
                <input
                  className="input-base"
                  onChange={(event) => setForm((current) => ({ ...current, openingHours: event.target.value }))}
                  placeholder="예: 매일 10:00 - 21:00"
                  value={form.openingHours}
                />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">찾아오는 길</span>
                <textarea
                  className="input-base min-h-24"
                  onChange={(event) => setForm((current) => ({ ...current, directions: event.target.value }))}
                  placeholder="예: 성수역 2번 출구 도보 5분, 골목 초입 오렌지 간판"
                  value={form.directions}
                />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">주차 안내</span>
                <input
                  className="input-base"
                  onChange={(event) => setForm((current) => ({ ...current, parkingNote: event.target.value }))}
                  placeholder="예: 근처 공영주차장 이용 가능"
                  value={form.parkingNote}
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['homepageVisible', '홈페이지 노출', '공개 매장 홈을 외부 방문자가 바로 볼 수 있게 합니다.'],
                ['consultationEnabled', 'AI 상담 버튼', '고객이 공개 매장에서 상담을 바로 시작할 수 있게 합니다.'],
                ['inquiryEnabled', '문의 버튼', '고객 문의를 고객 기억으로 저장합니다.'],
                ['reservationEnabled', '예약 버튼', '예약 문의 CTA를 공개 매장에 표시합니다.'],
                ['orderEntryEnabled', '주문 진입', '메뉴와 QR 주문 진입 버튼을 공개 매장에 노출합니다.'],
              ].map(([field, label, description]) => (
                <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4" key={field}>
                  <input
                    checked={Boolean(form[field as keyof UpdateStoreSettingsInput])}
                    className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                    onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.checked }))}
                    type="checkbox"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{label}</p>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-500">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </Panel>

          <Panel
            action={
              <button
                className="btn-primary"
                disabled={!isPriorityValid || priorityMutation.isPending}
                onClick={() => priorityMutation.mutate()}
                type="button"
              >
                우선순위 저장
              </button>
            }
            subtitle="대시보드 KPI 카드, 주요 차트, AI 액션 추천 순서를 이 설정으로 조정합니다."
            title="운영 우선순위"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3">
                {priorityFieldDefinitions.map((field) => (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4" key={field.key}>
                    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[120px_minmax(0,1fr)_88px] lg:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{field.label}</p>
                        <p className="mt-1 break-words text-sm leading-6 text-slate-500">{field.description}</p>
                      </div>
                      <input
                        className="w-full accent-orange-600"
                        max={100}
                        min={0}
                        onChange={(event) =>
                          setPriorityWeights((current) => ({
                            ...current,
                            [field.key]: Number(event.target.value),
                          }))
                        }
                        step={5}
                        type="range"
                        value={priorityWeights[field.key]}
                      />
                      <input
                        className="input-base text-center"
                        max={100}
                        min={0}
                        onChange={(event) =>
                          setPriorityWeights((current) => ({
                            ...current,
                            [field.key]: Number(event.target.value || 0),
                          }))
                        }
                        step={5}
                        type="number"
                        value={priorityWeights[field.key]}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">가중치 합계</p>
                  <p className={`mt-2 text-3xl font-black ${isPriorityValid ? 'text-slate-950' : 'text-rose-600'}`}>{priorityTotal}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">합계는 반드시 100이어야 저장됩니다.</p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">현재 분석 프로필</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{analyticsProfile?.industry || form.businessType || '-'}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {analyticsProfile?.region || '지역 미설정'} · {analyticsProfile?.customer_focus || '고객 포커스 미설정'}
                  </p>
                </div>

                {priorityMessage ? (
                  <div
                    className={`rounded-3xl border px-4 py-3 text-sm font-medium ${
                      priorityMessage.tone === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {priorityMessage.text}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="브랜딩, 공지, 비주얼" subtitle="공개 매장의 첫인상에 직접 보이는 요소를 이곳에서 다듬습니다.">
            <div className="space-y-7">
              {/* ── Theme Preset ─────────────────────────────────────────── */}
              <div>
                <p className="field-label">테마 프리셋</p>
                <p className="mb-3 text-sm text-slate-500">공개 대문의 전체적인 분위기를 결정합니다. 선택 즉시 오른쪽 미리보기에 반영됩니다.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      className={`group flex flex-col gap-3 rounded-[22px] border-2 p-4 text-left transition-all duration-150 ${
                        form.themePreset === opt.value
                          ? 'border-[color:var(--brand,#ec5b13)] shadow-md ring-2 ring-[color:var(--brand,#ec5b13)]/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      key={opt.value}
                      onClick={() => setForm((c) => ({ ...c, themePreset: opt.value }))}
                      style={form.themePreset === opt.value ? { '--brand': form.brandColor } as React.CSSProperties : {}}
                      type="button"
                    >
                      {/* Mini preview swatch */}
                      <div className={`h-12 w-full rounded-[14px] ${opt.bg} flex items-center justify-center gap-2`}>
                        <div className={`h-3 w-3 rounded-full ${opt.accent} opacity-90`} />
                        <div className={`h-2 w-8 rounded-full bg-current opacity-20 ${opt.text}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold text-slate-900 ${form.themePreset === opt.value ? '' : ''}`}>{opt.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Font Family ──────────────────────────────────────────── */}
              <div>
                <p className="field-label">대표 폰트</p>
                <p className="mb-3 text-sm text-slate-500">공개 매장 전체 텍스트에 적용됩니다.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {FONT_OPTIONS.map((opt) => (
                    <button
                      className={`flex flex-col gap-2 rounded-[20px] border-2 p-4 text-left transition-all duration-150 ${
                        form.fontFamily === opt.value
                          ? 'border-slate-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      key={opt.value}
                      onClick={() => setForm((c) => ({ ...c, fontFamily: opt.value }))}
                      type="button"
                    >
                      <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                      <p className="text-lg font-black text-slate-700 leading-tight">{opt.sample}</p>
                      <p className="text-xs leading-5 text-slate-400">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Logo + Color ──────────────────────────────────────────── */}
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="field-label">로고 URL</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} value={form.logoUrl} />
                </label>
                <label>
                  <span className="field-label">브랜드 컬러</span>
                  <div className="flex gap-3">
                    <input className="h-12 w-16 rounded-2xl border border-slate-200" onChange={(event) => setForm((current) => ({ ...current, brandColor: event.target.value }))} type="color" value={form.brandColor} />
                    <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, brandColor: event.target.value }))} value={form.brandColor} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">버튼, 포인트 컬러, 테마 액센트에 적용됩니다.</p>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">한 줄 소개</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} value={form.tagline} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">매장 설명</span>
                  <textarea className="input-base min-h-28" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} />
                </label>
              </div>

              {/* ── Images ───────────────────────────────────────────────── */}
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="field-label">히어로 이미지 URL</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, heroImageUrl: event.target.value }))} placeholder="https://..." value={form.heroImageUrl} />
                  <p className="mt-1 text-xs text-slate-400">대문 배경 전체를 덮는 대표 이미지</p>
                </label>
                <label>
                  <span className="field-label">매장 전경 이미지 URL</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, storefrontImageUrl: event.target.value }))} placeholder="https://..." value={form.storefrontImageUrl} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">매장 내부 이미지 URL</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, interiorImageUrl: event.target.value }))} placeholder="https://..." value={form.interiorImageUrl} />
                </label>
              </div>

              {/* ── Notice ───────────────────────────────────────────────── */}
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="field-label">대표 공지 제목</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, noticeTitle: event.target.value }))} value={form.noticeTitle} />
                </label>
                <label>
                  <span className="field-label">대표 공지 내용</span>
                  <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, noticeContent: event.target.value }))} value={form.noticeContent} />
                </label>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-8">
          <Panel title="공개 매장 미리보기" subtitle="저장 전에도 지금 구성된 테마, 색상, CTA를 실시간으로 확인할 수 있습니다.">
            {(() => {
              const PREVIEW_BG: Record<string, string> = {
                light: '#0f172a', warm: '#4a1f10', modern: '#052e2b', minimal: '#ffffff', bold: '#000000',
              };
              const PREVIEW_OVERLAY: Record<string, string> = {
                light: 'from-slate-950/90 via-slate-950/70 to-slate-950/40',
                warm: 'from-amber-950/92 via-amber-900/65 to-transparent',
                modern: 'from-teal-950/94 via-teal-800/55 to-transparent',
                minimal: 'from-white/85 via-white/55 to-transparent',
                bold: 'from-black/97 via-black/75 to-black/45',
              };
              const isLight = form.themePreset === 'light' || form.themePreset === 'warm' || form.themePreset === 'modern' || form.themePreset === 'bold';
              const textColor = form.themePreset === 'minimal' ? '#0f172a' : '#ffffff';
              const subtextColor = form.themePreset === 'minimal' ? '#64748b' : 'rgba(255,255,255,0.75)';
              const chipClass = form.themePreset === 'minimal' ? 'bg-slate-100 text-slate-700' : 'bg-white/12 text-white';
              return (
                <div className="overflow-hidden rounded-[28px] border border-slate-200">
                  {/* Hero preview */}
                  <div
                    className="relative overflow-hidden p-6"
                    style={{ backgroundColor: PREVIEW_BG[form.themePreset] || PREVIEW_BG.light, minHeight: 260 }}
                  >
                    {form.heroImageUrl ? (
                      <img alt="히어로" className="absolute inset-0 h-full w-full object-cover opacity-50" src={form.heroImageUrl} />
                    ) : null}
                    <div className={`absolute inset-0 bg-gradient-to-br ${PREVIEW_OVERLAY[form.themePreset] || PREVIEW_OVERLAY.light}`} />
                    <div className="relative space-y-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-white text-lg"
                          style={{ backgroundColor: form.brandColor }}
                        >
                          {form.logoUrl ? (
                            <img alt="로고" className="h-12 w-12 rounded-2xl object-cover" src={form.logoUrl} />
                          ) : (
                            form.storeName.slice(0, 1) || 'S'
                          )}
                        </div>
                        <div>
                          <p className="text-xl font-black leading-tight" style={{ color: textColor }}>
                            {form.storeName || '매장명'}
                          </p>
                          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: form.brandColor }}>
                            {slugState.preview}
                          </p>
                        </div>
                      </div>
                      <p className="max-w-sm text-sm leading-6" style={{ color: subtextColor }}>
                        {form.tagline || '한 줄 소개가 여기에 표시됩니다.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {form.consultationEnabled ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${chipClass}`}>상담</span> : null}
                        {form.inquiryEnabled ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${chipClass}`}>문의</span> : null}
                        {form.reservationEnabled ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${chipClass}`}>예약</span> : null}
                        {form.orderEntryEnabled ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${chipClass}`}>주문</span> : null}
                      </div>
                      <div className="flex gap-3">
                        <span
                          className="rounded-full px-5 py-2 text-sm font-bold text-white"
                          style={{ backgroundColor: form.brandColor }}
                        >
                          주문하기
                        </span>
                        <span
                          className={`rounded-full border px-5 py-2 text-sm font-bold ${
                            isLight ? 'border-white/20 text-white' : 'border-slate-200 text-slate-900'
                          }`}
                        >
                          메뉴 보기
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info strip */}
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-white">
                    <div className="p-4">
                      <p className="text-xs font-semibold text-slate-400">공개 주소</p>
                      <p className="mt-1 break-all text-sm font-bold text-slate-900">/{slugState.preview}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-semibold text-slate-400">대표 공지</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-900">{form.noticeTitle || '공지 제목을 입력해 주세요.'}</p>
                    </div>
                  </div>

                  {/* Theme + font info */}
                  <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 p-4">
                    <div
                      className="h-5 w-5 rounded-full shadow-sm ring-2 ring-white"
                      style={{ backgroundColor: form.brandColor }}
                      title="브랜드 컬러"
                    />
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                      {THEME_OPTIONS.find((t) => t.value === form.themePreset)?.label || form.themePreset} 테마
                    </span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                      {FONT_OPTIONS.find((f) => f.value === form.fontFamily)?.label || form.fontFamily}
                    </span>
                  </div>
                </div>
              );
            })()}
          </Panel>

          <Panel title="바로 연결되는 화면" subtitle="설정 저장 후 운영팀이 바로 이어서 확인하는 화면들입니다.">
            <div className="grid gap-3">
              {[
                { label: '홈', title: '공개 매장 홈', to: publicStorePath },
                { label: '메뉴', title: '공개 메뉴', to: buildStorePath(slugState.preview, 'menu') },
                { label: '주문', title: '공개 주문', to: buildStorePath(slugState.preview, 'order') },
                { label: '운영', title: '테이블오더 관리', to: '/dashboard/table-order' },
              ].map((item) => (
                <Link className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50" key={item.to} to={item.to}>
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-1 break-words font-bold text-slate-900">{item.title}</p>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
