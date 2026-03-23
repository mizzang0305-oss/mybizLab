import { buildStoreUrl } from '@/shared/lib/storeSlug';
import type { Store } from '@/shared/types/models';

const storeModeLabelMap = {
  order_first: 'Order first',
  survey_first: 'Survey first',
  hybrid: 'Hybrid',
  brand_inquiry_first: 'Brand and inquiry first',
} as const;

const dataModeLabelMap = {
  order_only: 'Order only',
  survey_only: 'Survey only',
  manual_only: 'Manual only',
  order_survey: 'Order + survey',
  survey_manual: 'Survey + manual',
  order_survey_manual: 'Order + survey + manual',
} as const;

function getStoreTypeLabel(store: Store) {
  const raw = (store.business_type || store.brand_config.business_type || '').toLowerCase();

  if (raw.includes('korean_buffet') || raw.includes('뷔페')) {
    return 'Korean buffet';
  }

  if (raw.includes('izakaya') || raw.includes('이자카야')) {
    return 'Izakaya';
  }

  if (raw.includes('cafe') || raw.includes('카페')) {
    return 'Cafe';
  }

  return store.business_type || store.brand_config.business_type || 'Demo store';
}

function getModeSummary(store: Store) {
  const storeMode = store.store_mode ? storeModeLabelMap[store.store_mode] : 'Hybrid';
  const dataMode = store.data_mode ? dataModeLabelMap[store.data_mode] : 'Order + survey + manual';
  return `${storeMode} / ${dataMode}`;
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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Demo Stores</p>
          <p className="mt-1 text-sm text-slate-600">Switch between cafe, izakaya, and buffet stories without leaving the dashboard.</p>
        </div>
        {currentStore ? (
          <a
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
            href={buildStoreUrl(currentStore.slug)}
            rel="noreferrer"
            target="_blank"
          >
            Open public store
          </a>
        ) : null}
      </div>

      <label className="min-w-0">
        <span className="field-label">Current dashboard store</span>
        <select className="input-base min-w-0" onChange={(event) => onChange(event.target.value)} value={currentStore?.id || stores[0].id}>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-2 lg:grid-cols-3">
        {stores.map((store) => {
          const isActive = currentStore?.id === store.id;

          return (
            <button
              className={[
                'rounded-3xl border px-4 py-4 text-left transition',
                isActive ? 'border-orange-300 bg-orange-50 shadow-[0_18px_50px_-32px_rgba(234,88,12,0.45)]' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
              ].join(' ')}
              key={store.id}
              onClick={() => onChange(store.id)}
              type="button"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">{getStoreTypeLabel(store)}</span>
                <span className={`text-xs font-bold ${store.public_status === 'public' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {store.public_status === 'public' ? 'Public live' : 'Preview only'}
                </span>
              </div>
              <p className="mt-3 text-base font-bold text-slate-950">{store.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{getModeSummary(store)}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <span className="rounded-full bg-white px-2.5 py-1">CTA {store.preview_target || 'store'}</span>
                <span className="rounded-full bg-white px-2.5 py-1">{store.theme_preset || 'default'} theme</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
