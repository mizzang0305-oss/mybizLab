import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicStore, getPublicStoreById } from '@/shared/lib/services/mvpService';
import { touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { buildStoreIdPath, buildStorePath } from '@/shared/lib/storeSlug';
import { getOrCreateVisitorSessionState, saveVisitorSessionState } from '@/shared/lib/visitorSessionClient';

type PublicStoreSnapshot = NonNullable<Awaited<ReturnType<typeof getPublicStore>>>;

export interface StorePublicContextValue {
  publicStore: PublicStoreSnapshot;
  publicBasePath: string;
  publicStoreQueryKey: readonly unknown[];
  tableNo?: string;
  visitorSessionId?: string;
  visitorToken?: string;
}

export function useStorePublicContext() {
  return useOutletContext<StorePublicContextValue>();
}

export function StorePublicLayout() {
  const params = useParams<{ storeSlug?: string; storeId?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [visitorSessionId, setVisitorSessionId] = useState<string | undefined>();
  const [visitorToken, setVisitorToken] = useState<string | undefined>();
  const tableNo = searchParams.get('table') || undefined;
  const storeSlug = params.storeSlug || '';
  const storeId = params.storeId || '';
  const isStoreIdRoute = Boolean(storeId);
  const publicStoreQueryKey = isStoreIdRoute ? queryKeys.publicStoreById(storeId) : queryKeys.publicStoreBySlug(storeSlug);

  const publicStoreQuery = useQuery({
    queryKey: publicStoreQueryKey,
    queryFn: () => (isStoreIdRoute ? getPublicStoreById(storeId) : getPublicStore(storeSlug)),
    enabled: Boolean(storeSlug || storeId),
    retry: false,
  });

  const publicStore = publicStoreQuery.data;
  const publicBasePath =
    isStoreIdRoute && publicStore ? buildStoreIdPath(publicStore.store.id) : buildStorePath(storeSlug);
  const consultationPath = publicStore ? `/s/${publicStore.store.id}/consultation` : '#';
  const inquiryPath = publicStore ? `/s/${publicStore.store.id}/inquiry` : '#';
  const reservationPath = publicStore ? `/s/${publicStore.store.id}/reservation` : '#';
  const waitingPath = publicStore ? `/s/${publicStore.store.id}/waiting` : '#';
  const waitingEnabled = Boolean(publicStore?.capabilities.waitingEnabled);

  usePageMeta(
    publicStore ? `${publicStore.store.name} 공개 스토어` : '공개 스토어',
    publicStore
      ? `${publicStore.store.name}의 메뉴와 방문 안내, 문의·예약·웨이팅·주문 시작 화면입니다.`
      : '매장 공개 페이지입니다.',
  );

  useEffect(() => {
    if (!publicStore) {
      return;
    }

    const sessionState = getOrCreateVisitorSessionState(publicStore.store.id);
    const currentPath = `${location.pathname}${location.search}`;
    const channel =
      currentPath.includes('/order') ? 'order' : currentPath.includes('/menu') ? 'menu' : 'home';
    let cancelled = false;

    setVisitorToken(sessionState.visitorToken);

    void touchVisitorSession({
      channel,
      firstSeenAt: sessionState.firstSeenAt,
      metadata: {
        routeMode: isStoreIdRoute ? 'store-id' : 'slug',
        tableNo: tableNo || null,
      },
      path: currentPath,
      publicPageId: publicStore.publicPageId,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      sessionId: sessionState.sessionId,
      storeId: publicStore.store.id,
      visitorToken: sessionState.visitorToken,
    })
      .then((session) => {
        if (cancelled) {
          return;
        }

        setVisitorSessionId(session.id);
        saveVisitorSessionState(publicStore.store.id, {
          firstSeenAt: session.first_seen_at,
          sessionId: session.id,
          visitorToken: session.visitor_token,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setVisitorSessionId(sessionState.sessionId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isStoreIdRoute, location.pathname, location.search, publicStore, tableNo]);

  if (publicStoreQuery.isLoading) {
    return (
      <div className="page-shell py-20">
        <div className="section-card p-10 text-center text-sm text-slate-500">매장 정보를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (publicStoreQuery.isError) {
    const description =
      publicStoreQuery.error instanceof Error
        ? publicStoreQuery.error.message
        : '공개 스토어 데이터를 불러오지 못했습니다.';

    return (
      <div className="page-shell py-20">
        <EmptyState
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <button
                className="btn-primary"
                onClick={() => void publicStoreQuery.refetch()}
                type="button"
              >
                다시 시도
              </button>
              <Link className="btn-secondary" to="/">
                홈으로 이동
              </Link>
            </div>
          }
          description={description}
          title="공개 스토어를 불러오지 못했습니다"
        />
      </div>
    );
  }

  if (!publicStore) {
    return (
      <div className="page-shell py-20">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              홈으로 돌아가기
            </Link>
          }
          description="아직 공개되지 않았거나 현재 확인할 수 없는 매장입니다."
          title="매장을 찾을 수 없습니다"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf3]">
      <header className="border-b border-slate-200/70 bg-white/88 backdrop-blur">
        <div className="page-shell flex flex-col gap-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                  {publicStore.experience?.eyebrow || '매장 안내'}
                </p>
                {publicStore.store.public_status !== 'public' ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">미리보기</span>
                ) : null}
                {tableNo ? (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">테이블 {tableNo}</span>
                ) : null}
                {publicStore.location?.opening_hours ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{publicStore.location.opening_hours}</span>
                ) : null}
              </div>
              <h1 className="font-display text-3xl font-black text-slate-900 [word-break:keep-all]">
                {publicStore.store.name}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 [word-break:keep-all]">
                {publicStore.store.tagline}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 [word-break:keep-all]">
                {publicStore.experience?.eventDescription || publicStore.store.description}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
                {publicStore.location?.address || publicStore.store.address || `/${publicStore.store.slug}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {publicStore.capabilities.inquiryEnabled ? (
                <Link className="btn-secondary" to={inquiryPath}>
                  문의 남기기
                </Link>
              ) : null}
              {publicStore.capabilities.reservationEnabled ? (
                <Link className="btn-secondary" to={reservationPath}>
                  예약 신청
                </Link>
              ) : null}
              {waitingEnabled ? (
                <Link className="btn-secondary" to={waitingPath}>
                  웨이팅 등록
                </Link>
              ) : null}
              {publicStore.capabilities.consultationEnabled ? (
                <Link className="btn-secondary" to={consultationPath}>
                  AI 상담 시작
                </Link>
              ) : null}
              {publicStore.capabilities.orderEntryEnabled ? (
                <NavLink className="btn-primary" to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}>
                  주문하기
                </NavLink>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NavLink className="btn-secondary" to={publicBasePath}>
              홈
            </NavLink>
            <NavLink className="btn-secondary" to={`${publicBasePath}/menu`}>
              메뉴
            </NavLink>
            {publicStore.capabilities.orderEntryEnabled ? (
              <NavLink className="btn-secondary" to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}>
                주문
              </NavLink>
            ) : null}
            {publicStore.capabilities.inquiryEnabled ? (
              <Link className="btn-secondary" to={inquiryPath}>
                문의
              </Link>
            ) : null}
            {publicStore.capabilities.consultationEnabled ? (
              <Link className="btn-secondary" to={consultationPath}>
                AI 상담
              </Link>
            ) : null}
            {publicStore.capabilities.reservationEnabled ? (
              <Link className="btn-secondary" to={reservationPath}>
                예약
              </Link>
            ) : null}
            {waitingEnabled ? (
              <Link className="btn-secondary" to={waitingPath}>
                웨이팅
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="page-shell flex-1 py-8">
        <Outlet
          context={{
            publicBasePath,
            publicStore,
            publicStoreQueryKey,
            tableNo,
            visitorSessionId,
            visitorToken,
          }}
        />
      </main>

      <AppFooter />
    </div>
  );
}
