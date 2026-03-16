import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicStore } from '@/shared/lib/services/mvpService';
import { buildStorePath } from '@/shared/lib/storeSlug';

export interface StorePublicContextValue {
  publicStore: NonNullable<Awaited<ReturnType<typeof getPublicStore>>>;
  tableNo?: string;
}

export function useStorePublicContext() {
  return useOutletContext<StorePublicContextValue>();
}

export function StorePublicLayout() {
  const params = useParams<{ storeSlug: string }>();
  const [searchParams] = useSearchParams();
  const storeSlug = params.storeSlug || '';
  const tableNo = searchParams.get('table') || undefined;

  const publicStoreQuery = useQuery({
    queryKey: queryKeys.publicStore(storeSlug),
    queryFn: () => getPublicStore(storeSlug),
    enabled: Boolean(storeSlug),
  });

  const pageTitle = publicStoreQuery.data ? `${publicStoreQuery.data.store.name} 스토어` : '공개 스토어';
  const pageDescription = publicStoreQuery.data
    ? `${publicStoreQuery.data.store.name}의 공지, 매장 정보, 상담/문의/예약/주문 진입을 한 화면에서 확인할 수 있습니다.`
    : 'MyBizLab 공개 스토어 페이지입니다.';

  usePageMeta(pageTitle, pageDescription);

  if (publicStoreQuery.isLoading) {
    return (
      <div className="page-shell py-20">
        <div className="section-card p-10 text-center text-sm text-slate-500">스토어 정보를 불러오는 중입니다...</div>
      </div>
    );
  }

  if (!publicStoreQuery.data) {
    return (
      <div className="page-shell py-20">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              홈으로 이동
            </Link>
          }
          description="잘못된 주소이거나 아직 공개되지 않은 스토어입니다."
          title="스토어를 찾을 수 없습니다"
        />
      </div>
    );
  }

  const consultationLink = `tel:${publicStoreQuery.data.store.phone.replace(/[^0-9+]/g, '')}`;
  const inquiryLink = `mailto:${publicStoreQuery.data.store.email}?subject=${encodeURIComponent(`[${publicStoreQuery.data.store.name}] 문의`)}`;
  const reservationLink = `mailto:${publicStoreQuery.data.store.email}?subject=${encodeURIComponent(`[${publicStoreQuery.data.store.name}] 예약 문의`)}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf3]">
      <header className="border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="page-shell flex flex-col gap-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">{publicStoreQuery.data.store.slug}</p>
                {publicStoreQuery.data.store.public_status !== 'public' ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">미공개 프리뷰</span>
                ) : null}
              </div>
              <h1 className="font-display text-3xl font-black text-slate-900">{publicStoreQuery.data.store.name}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{publicStoreQuery.data.store.tagline}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {tableNo ? <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">Table {tableNo}</span> : null}
              {publicStoreQuery.data.capabilities.consultationEnabled ? (
                <a className="btn-secondary" href={consultationLink}>
                  상담
                </a>
              ) : null}
              {publicStoreQuery.data.capabilities.inquiryEnabled ? (
                <a className="btn-secondary" href={inquiryLink}>
                  문의
                </a>
              ) : null}
              {publicStoreQuery.data.capabilities.reservationEnabled ? (
                <a className="btn-secondary" href={reservationLink}>
                  예약
                </a>
              ) : null}
              {publicStoreQuery.data.capabilities.orderEntryEnabled ? (
                <NavLink className="btn-primary" to={`${buildStorePath(storeSlug, 'order')}${tableNo ? `?table=${tableNo}` : ''}`}>
                  주문하기
                </NavLink>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NavLink className="btn-secondary" to={buildStorePath(storeSlug)}>
              스토어 홈
            </NavLink>
            <NavLink className="btn-secondary" to={buildStorePath(storeSlug, 'menu')}>
              메뉴
            </NavLink>
            {publicStoreQuery.data.capabilities.orderEntryEnabled ? (
              <NavLink className="btn-secondary" to={`${buildStorePath(storeSlug, 'order')}${tableNo ? `?table=${tableNo}` : ''}`}>
                주문
              </NavLink>
            ) : null}
          </div>
        </div>
      </header>

      <main className="page-shell flex-1 py-8">
        <Outlet context={{ publicStore: publicStoreQuery.data, tableNo }} />
      </main>

      <AppFooter />
    </div>
  );
}
