import { buildStoreUrl } from '@/shared/lib/storeSlug';
import { getBusinessTypeLabel } from '@/shared/lib/storeLabels';
import type { Store } from '@/shared/types/models';

const storeModeLabelMap = {
  order_first: '주문 중심',
  survey_first: '설문 중심',
  hybrid: '혼합형',
  brand_inquiry_first: '브랜드/문의 중심',
} as const;

const dataModeLabelMap = {
  order_only: '주문 데이터',
  survey_only: '설문 데이터',
  manual_only: '수기 입력',
  order_survey: '주문 + 설문',
  survey_manual: '설문 + 수기',
  order_survey_manual: '주문 + 설문 + 수기',
} as const;

const previewTargetLabelMap = {
  inquiry: '문의 바로가기',
  order: '주문 바로가기',
  survey: '설문 바로가기',
} as const;

const themeLabelMap = {
  light: '기본 톤',
  modern: '모던 톤',
  warm: '따뜻한 톤',
} as const;

function getStoreTypeLabel(store: Store) {
  return getBusinessTypeLabel(store.business_type || store.brand_config.business_type);
}

function getStoreModeLabel(store: Store) {
  return store.store_mode ? storeModeLabelMap[store.store_mode] : '혼합형';
}

function getDataModeLabel(store: Store) {
  return store.data_mode ? dataModeLabelMap[store.data_mode] : '주문 + 설문 + 수기';
}

function getPreviewTargetLabel(store: Store) {
  return store.preview_target ? previewTargetLabelMap[store.preview_target] : '스토어 바로가기';
}

function getThemeLabel(store: Store) {
  return store.theme_preset ? themeLabelMap[store.theme_preset] : '기본 톤';
}

function getStoreCtaLabel(store: Store) {
  return store.mobile_cta_label || store.primary_cta_label || getPreviewTargetLabel(store);
}

export function StoreSwitcher({
  stores,
  currentStore,
  onChange,
  pageTitle,
  pageDescription,
}: {
  stores: Store[];
  currentStore?: Store;
  onChange: (storeId: string) => void;
  pageTitle: string;
  pageDescription: string;
}) {
  if (!stores.length) {
    return null;
  }

  const selectedStore = currentStore || stores[0];
  const publicStatusLabel = selectedStore.public_status === 'public' ? '운영 중' : '미리보기';
  const publicStatusClassName =
    selectedStore.public_status === 'public'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  const storeInfoBadges = [
    {
      label: `업종 ${getStoreTypeLabel(selectedStore)}`,
      className: 'bg-slate-100 text-slate-700',
    },
    {
      label: `운영 모드 ${getStoreModeLabel(selectedStore)}`,
      className: 'bg-orange-50 text-orange-700',
    },
    {
      label: `데이터 모드 ${getDataModeLabel(selectedStore)}`,
      className: 'bg-blue-50 text-blue-700',
    },
    {
      label: `CTA ${getStoreCtaLabel(selectedStore)}`,
      className: 'bg-violet-50 text-violet-700',
    },
    {
      label: `테마 ${getThemeLabel(selectedStore)}`,
      className: 'bg-white text-slate-600 ring-1 ring-slate-200',
    },
  ];

  return (
    <div className="min-w-0 rounded-[26px] border border-slate-200/90 bg-white/90 px-4 py-4 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.45)] sm:px-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(17rem,21rem)_minmax(0,1.15fr)] lg:items-start">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">현재 화면</p>
          <h1 className="mt-1 break-words font-display text-[1.7rem] font-black leading-[1.12] tracking-[-0.03em] text-slate-950 [word-break:keep-all] sm:text-[1.95rem]">
            {pageTitle}
          </h1>
          <p className="mt-2 text-base font-bold leading-7 text-slate-950 [word-break:keep-all]">{selectedStore.name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 [word-break:keep-all]">{pageDescription}</p>
        </div>

        <div className="min-w-0 rounded-[22px] bg-slate-50/85 p-3.5">
          <label className="min-w-0">
            <span className="field-label !mb-1.5">스토어 선택</span>
            <select className="input-base min-h-[3rem] min-w-0 bg-white py-3 leading-6" onChange={(event) => onChange(event.target.value)} value={selectedStore.id}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex min-h-[2.25rem] items-center rounded-full px-3.5 py-1.5 text-[12px] font-bold leading-5 [word-break:keep-all] ${publicStatusClassName}`}
            >
              운영 상태 {publicStatusLabel}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <a className="btn-secondary shrink-0" href={buildStoreUrl(selectedStore.slug)} rel="noreferrer" target="_blank">
              공개 매장 보기
            </a>
            {storeInfoBadges.map((badge) => (
              <span
                className={`inline-flex min-h-[2.25rem] items-center rounded-full px-3.5 py-1.5 text-[12px] font-bold leading-5 [word-break:keep-all] ${badge.className}`}
                key={badge.label}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
