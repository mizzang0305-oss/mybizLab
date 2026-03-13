import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { queryKeys } from '@/shared/lib/queryKeys';
import { buildStorePath, buildStoreUrl, ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug, slugifyStoreName } from '@/shared/lib/storeSlug';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { createStoreFromSetupRequest, listSetupRequests, saveSetupRequest } from '@/shared/lib/services/mvpService';
import { useUiStore } from '@/shared/lib/uiStore';
import type { FeatureKey, SetupRequestInput } from '@/shared/types/models';

const initialForm: SetupRequestInput = {
  business_name: '',
  owner_name: '',
  business_number: '',
  phone: '',
  email: '',
  address: '',
  business_type: '',
  requested_slug: '',
  selected_features: ['ai_manager', 'order_management', 'table_order'],
};

export function OnboardingPage() {
  const [form, setForm] = useState<SetupRequestInput>(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [createdStore, setCreatedStore] = useState<{ name: string; publicUrl: string; path: string } | null>(null);
  const { stores } = useCurrentStore();
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const queryClient = useQueryClient();

  const setupRequestsQuery = useQuery({
    queryKey: queryKeys.setupRequests,
    queryFn: listSetupRequests,
  });

  const normalizedSlug = normalizeStoreSlug(form.requested_slug || form.business_name);
  const uniqueSlugPreview = useMemo(
    () => ensureUniqueStoreSlug(normalizedSlug, stores.map((store) => store.slug)),
    [normalizedSlug, stores],
  );
  const isDuplicateSlug = stores.some((store) => store.slug === normalizedSlug);
  const reservedSlug = isReservedSlug(normalizedSlug);

  const saveRequestMutation = useMutation({
    mutationFn: () => saveSetupRequest(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.setupRequests });
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: () => createStoreFromSetupRequest(form),
    onSuccess: async (result) => {
      setSelectedStoreId(result.store.id);
      setCreatedStore({
        name: result.store.name,
        publicUrl: result.publicUrl,
        path: buildStorePath(result.store.slug),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stores });
      await queryClient.invalidateQueries({ queryKey: queryKeys.setupRequests });
      setForm(initialForm);
      setSlugTouched(false);
    },
  });

  const toggleFeature = (featureKey: FeatureKey) => {
    setForm((current) => ({
      ...current,
      selected_features: current.selected_features.includes(featureKey)
        ? current.selected_features.filter((item) => item !== featureKey)
        : [...current.selected_features, featureKey],
    }));
  };

  const updateField = (field: keyof SetupRequestInput, value: string) => {
    if (field === 'business_name' && !slugTouched) {
      setForm((current) => ({
        ...current,
        business_name: value,
        requested_slug: slugifyStoreName(value),
      }));
      return;
    }

    if (field === 'requested_slug') {
      setSlugTouched(true);
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    const lines = [
      'My Biz Lab Store Setup Request',
      `Business Name: ${form.business_name}`,
      `Owner Name: ${form.owner_name}`,
      `Business Number: ${form.business_number}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email}`,
      `Address: ${form.address}`,
      `Business Type: ${form.business_type}`,
      `Requested Slug: ${uniqueSlugPreview}`,
      `Public URL Preview: ${buildStoreUrl(uniqueSlugPreview)}`,
      'Selected Features:',
      ...form.selected_features.map((feature) => `- ${feature}`),
    ];

    doc.setFontSize(18);
    doc.text('Store Setup Summary', 14, 18);
    doc.setFontSize(11);
    doc.text(lines, 14, 30);
    doc.save(`${uniqueSlugPreview || 'store-setup'}.pdf`);
  };

  const isFormInvalid =
    !form.business_name ||
    !form.owner_name ||
    !form.business_number ||
    !form.phone ||
    !form.email ||
    !form.address ||
    !form.business_type ||
    form.selected_features.length === 0;

  return (
    <div className="page-shell space-y-8 py-10">
      <PageHeader
        eyebrow="Pre-store onboarding"
        title="스토어 생성 전 신청/설정"
        description="사업자 기본 정보를 저장하고, 스토어 slug와 기능 구성을 확인한 뒤 실제 스토어를 생성할 수 있습니다."
        actions={
          <>
            <button className="btn-secondary" onClick={downloadPdf} type="button">
              PDF 다운로드
            </button>
            <button
              className="btn-secondary"
              disabled={isFormInvalid || saveRequestMutation.isPending}
              onClick={() => saveRequestMutation.mutate()}
              type="button"
            >
              신청서 저장
            </button>
            <button
              className="btn-primary"
              disabled={isFormInvalid || createStoreMutation.isPending}
              onClick={() => createStoreMutation.mutate()}
              type="button"
            >
              스토어 생성
            </button>
          </>
        }
      />

      {createdStore ? (
        <Panel title="스토어 생성 완료" subtitle={`${createdStore.name} 스토어가 생성되었습니다.`}>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl bg-orange-50 p-5">
              <p className="text-sm font-semibold text-orange-700">공개 주소</p>
              <p className="mt-2 break-all font-display text-2xl font-black text-slate-900">{createdStore.publicUrl}</p>
              <p className="mt-2 text-sm text-slate-500">개발 경로: {createdStore.path}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link className="btn-primary" to="/login">
                운영 대시보드로 이동
              </Link>
              <Link className="btn-secondary" to={createdStore.path}>
                스토어 바로가기
              </Link>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="사업자 기본 정보" subtitle="store_setup_requests → stores / store_features 흐름을 기준으로 저장됩니다.">
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ['business_name', '사업자명'],
              ['owner_name', '대표자명'],
              ['business_number', '사업자등록번호'],
              ['phone', '전화번호'],
              ['email', '이메일'],
              ['address', '주소'],
              ['business_type', '업종'],
            ].map(([field, label]) => (
              <label key={field} className={field === 'address' ? 'md:col-span-2' : ''}>
                <span className="field-label">{label}</span>
                <input
                  className="input-base"
                  onChange={(event) => updateField(field as keyof SetupRequestInput, event.target.value)}
                  value={form[field as keyof SetupRequestInput] as string}
                />
              </label>
            ))}
            <label className="md:col-span-2">
              <span className="field-label">스토어 주소(URL)</span>
              <input
                className="input-base"
                onChange={(event) => updateField('requested_slug', event.target.value)}
                value={form.requested_slug}
              />
              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preview</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-900">{buildStoreUrl(uniqueSlugPreview)}</p>
                <p className="mt-1 text-xs text-slate-500">개발 경로: {buildStorePath(uniqueSlugPreview)}</p>
                {reservedSlug ? <p className="mt-3 text-sm font-semibold text-rose-600">예약어와 충돌해 자동 보정됩니다.</p> : null}
                {isDuplicateSlug ? <p className="mt-2 text-sm font-semibold text-amber-600">이미 사용 중인 slug라 숫자 suffix가 자동으로 붙습니다.</p> : null}
              </div>
            </label>
          </div>
        </Panel>

        <Panel title="기능 선택" subtitle="선택 결과는 store_features 테이블 생성 규칙으로 연결됩니다.">
          <div className="grid gap-3">
            {featureDefinitions.map((feature) => {
              const checked = form.selected_features.includes(feature.key);
              const Icon = feature.icon;

              return (
                <label
                  key={feature.key}
                  className={`flex cursor-pointer items-start gap-4 rounded-3xl border p-4 transition ${
                    checked ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    checked={checked}
                    className="mt-1 h-4 w-4 accent-orange-600"
                    onChange={() => toggleFeature(feature.key)}
                    type="checkbox"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-2 text-orange-700 shadow-sm">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{feature.label}</p>
                        <p className="text-sm text-slate-500">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="최근 신청 내역" subtitle="저장된 신청서는 PDF 요약과 함께 확인할 수 있습니다.">
        {setupRequestsQuery.data?.length ? (
          <div className="space-y-3">
            {setupRequestsQuery.data.slice(0, 5).map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{request.business_name}</p>
                  <p className="text-sm text-slate-500">
                    {request.owner_name} · {request.business_type} · {request.status}
                  </p>
                  <p className="text-xs text-slate-400">slug: {request.requested_slug}</p>
                </div>
                <div className="text-sm font-semibold text-slate-500">{request.selected_features.length}개 기능 선택</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="아직 저장된 신청서가 없습니다"
            description="양식을 저장하면 신청 내역이 여기 표시됩니다."
          />
        )}
      </Panel>
    </div>
  );
}
