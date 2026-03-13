import { Link } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Panel } from '@/shared/components/Panel';
import { buildStorePath, buildStoreUrl } from '@/shared/lib/storeSlug';

export function StoreHomePage() {
  const { publicStore, tableNo } = useStorePublicContext();

  return (
    <div className="space-y-8">
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="section-card overflow-hidden bg-slate-950 px-8 py-10 text-white">
          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">{publicStore.store.slug}</p>
            <h2 className="font-display text-4xl font-black tracking-tight">{publicStore.store.name}</h2>
            <p className="text-base leading-7 text-slate-300">{publicStore.store.description}</p>
            <div className="flex flex-wrap gap-3">
              <Link className="btn-primary" to={buildStorePath(publicStore.store.slug, 'menu')}>
                메뉴 보기
              </Link>
              <Link
                className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900"
                to={`${buildStorePath(publicStore.store.slug, 'order')}${tableNo ? `?table=${tableNo}` : ''}`}
              >
                바로 주문하기
              </Link>
            </div>
          </div>
        </div>

        <Panel title="스토어 정보">
          <div className="space-y-3 text-sm text-slate-600">
            <p>업종: {publicStore.store.business_type}</p>
            <p>연락처: {publicStore.store.phone}</p>
            <p>이메일: {publicStore.store.email}</p>
            <p>주소: {publicStore.store.address}</p>
            <p className="break-all">공개 주소: {buildStoreUrl(publicStore.store.slug)}</p>
          </div>
        </Panel>
      </section>

      <Panel title="테이블 / QR 주문 정보" subtitle="QR 코드에는 storeSlug 와 table 번호가 함께 들어갑니다.">
        <div className="grid gap-4 md:grid-cols-3">
          {publicStore.tables.map((table) => (
            <div key={table.id} className="rounded-3xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">Table {table.table_no}</p>
              <p className="mt-1 text-sm text-slate-500">{table.seats} seats</p>
              <Link className="mt-4 inline-flex text-sm font-bold text-orange-700" to={`${buildStorePath(publicStore.store.slug, 'order')}?table=${table.table_no}`}>
                주문 링크 열기
              </Link>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
