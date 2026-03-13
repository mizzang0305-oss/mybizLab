import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';

export function StoreMenuPage() {
  const { publicStore } = useStorePublicContext();

  return (
    <div className="space-y-6">
      {publicStore.menu.categories.map((category) => (
        <Panel key={category.id} title={category.name}>
          <div className="grid gap-4 md:grid-cols-2">
            {publicStore.menu.items
              .filter((item) => item.category_id === category.id)
              .map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                    {item.is_popular ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">인기</span> : null}
                  </div>
                  <p className="mt-4 font-display text-2xl font-extrabold text-slate-900">{formatCurrency(item.price)}</p>
                </div>
              ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
