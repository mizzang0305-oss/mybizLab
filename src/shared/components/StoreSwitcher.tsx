import { buildStoreUrl } from '@/shared/lib/storeSlug';
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
  const raw = (store.business_type || store.brand_config.business_type || '').toLowerCase();

  if (raw.includes('korean_buffet') || raw.includes('뷔페')) {
    return '한식 뷔페';
  }

  if (raw.includes('izakaya') || raw.includes('이자카야')) {
    return '이자카야';
  }

  if (raw.includes('cafe') || raw.includes('카페')) {
    return '카페';
  }

  return store.business_type || store.brand_config.business_type || '데모 매장';
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

export function StoreSwitcher({
  stores,
  currentStore,
  onChange,
}: {
  stores: Store[];
  currentStore?: Store;
  onChange: (storeId: string) => void;
}) {
  if (!stores.length) {
    return null;
  }

  const selectedStore = currentStore || stores[0];
  const publicStatusLabel = selectedStore.public_status === 'public' ? '운영 중' : '미리보기';
  const publicStatusClassName =
    selectedStore.public_status === 'public'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-slate-100 text-slate-600';

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">데모 스토어</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-base font-bold leading-7 text-slate-950 [word-break:keep-all]">{selectedStore.name}</p>
            <span
              className={`inline-flex min-h-[2rem] items-center rounded-full px-3.5 py-1.5 text-[12px] font-bold leading-5 ${publicStatusClassName}`}
            >
              {publicStatusLabel}
            </span>
          </div>
          <p className="mt-1 hidden text-sm leading-6 text-slate-600 [word-break:keep-all] sm:block">
            지금 보고 있는 매장만 빠르게 바꿔 가며 운영 화면을 비교해서 볼 수 있습니다.
          </p>
        </div>

        <a
          className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold leading-6 text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
          href={buildStoreUrl(selectedStore.slug)}
          rel="noreferrer"
          target="_blank"
        >
          공개 매장 보기
        </a>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <label className="min-w-0">
          <span className="field-label !mb-1.5">현재 보고 있는 매장</span>
          <select className="input-base min-h-[3rem] min-w-0 py-3 leading-6" onChange={(event) => onChange(event.target.value)} value={selectedStore.id}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex min-h-[2rem] items-center rounded-full bg-slate-100 px-3.5 py-1.5 text-[12px] font-bold leading-5 text-slate-700">
            {getStoreTypeLabel(selectedStore)}
          </span>
          <span className="inline-flex min-h-[2rem] items-center rounded-full bg-orange-50 px-3.5 py-1.5 text-[12px] font-bold leading-5 text-orange-700">
            {getStoreModeLabel(selectedStore)}
          </span>
          <span className="inline-flex min-h-[2rem] items-center rounded-full bg-blue-50 px-3.5 py-1.5 text-[12px] font-bold leading-5 text-blue-700">
            {getDataModeLabel(selectedStore)}
          </span>
          <span className="inline-flex min-h-[2rem] items-center rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold leading-5 text-slate-600 ring-1 ring-slate-200">
            {getPreviewTargetLabel(selectedStore)}
          </span>
          <span className="inline-flex min-h-[2rem] items-center rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold leading-5 text-slate-600 ring-1 ring-slate-200">
            {getThemeLabel(selectedStore)}
          </span>
        </div>
      </div>
    </div>
  );
}
