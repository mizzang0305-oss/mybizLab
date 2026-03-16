import { buildStoreUrl } from '@/shared/lib/storeSlug';
import type { Store } from '@/shared/types/models';

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
    <div className="flex flex-col gap-2 sm:min-w-72">
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">현재 스토어</label>
      <div className="flex items-center gap-3">
        <select
          className="input-base"
          value={currentStore?.id || stores[0].id}
          onChange={(event) => onChange(event.target.value)}
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        {currentStore ? (
          <a
            className="btn-secondary whitespace-nowrap"
            href={buildStoreUrl(currentStore.slug)}
            rel="noreferrer"
            target="_blank"
          >
            스토어 홈
          </a>
        ) : null}
      </div>
    </div>
  );
}
