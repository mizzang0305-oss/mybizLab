import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getBrandProfile, updateBrandProfile } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function BrandPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const brandQuery = useQuery({
    queryKey: queryKeys.brand(currentStore?.id || ''),
    queryFn: () => getBrandProfile(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const [form, setForm] = useState({
    logo_url: '',
    brand_color: '#ec5b13',
    tagline: '',
    description: '',
  });

  useEffect(() => {
    if (brandQuery.data) {
      setForm({
        logo_url: brandQuery.data.logo_url || '',
        brand_color: brandQuery.data.brand_color,
        tagline: brandQuery.data.tagline,
        description: brandQuery.data.description,
      });
    }
  }, [brandQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateBrandProfile(currentStore!.id, form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.brand(currentStore!.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stores });
    },
  });

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Brand management"
        title="브랜드 관리"
        description="로고 URL, 브랜드 컬러, 소개 문구와 기본 브랜딩 정보를 저장합니다."
        actions={
          <button className="btn-primary" onClick={() => saveMutation.mutate()} type="button">
            브랜딩 저장
          </button>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="브랜드 자산">
          <div className="grid gap-4">
            <label>
              <span className="field-label">로고 URL</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))} value={form.logo_url} />
            </label>
            <label>
              <span className="field-label">브랜드 컬러</span>
              <div className="flex gap-3">
                <input className="h-12 w-16 rounded-2xl border border-slate-200" onChange={(event) => setForm((current) => ({ ...current, brand_color: event.target.value }))} type="color" value={form.brand_color} />
                <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, brand_color: event.target.value }))} value={form.brand_color} />
              </div>
            </label>
            <label>
              <span className="field-label">소개 문구</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} value={form.tagline} />
            </label>
            <label>
              <span className="field-label">상세 소개</span>
              <textarea className="input-base min-h-32" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} />
            </label>
          </div>
        </Panel>

        <Panel title="브랜드 프리뷰">
          <div className="rounded-[32px] border border-slate-200 bg-[#fffaf3] p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-white" style={{ backgroundColor: form.brand_color }}>
                {form.logo_url ? (
                  <img alt="Brand logo" className="h-16 w-16 rounded-3xl object-cover" src={form.logo_url} />
                ) : (
                  <span className="font-display text-2xl font-black">{currentStore.name.slice(0, 1)}</span>
                )}
              </div>
              <div>
                <p className="font-display text-3xl font-black text-slate-900">{currentStore.name}</p>
                <p className="mt-1 text-sm text-slate-500">{form.tagline || '스토어 소개 문구를 입력해 주세요.'}</p>
              </div>
            </div>
            <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-sm leading-7 text-slate-600">{form.description || '브랜드 소개가 여기에 표시됩니다.'}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
