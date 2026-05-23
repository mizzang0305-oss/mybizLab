import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

/** Derive CSS custom properties from brand color hex (#rrggbb) */
function brandCssVars(hex: string, theme: string, font: string): Record<string, string> {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 236;
  const g = parseInt(clean.slice(2, 4), 16) || 91;
  const b = parseInt(clean.slice(4, 6), 16) || 19;
  return {
    '--brand': hex,
    '--brand-rgb': `${r} ${g} ${b}`,
    '--brand-muted': `rgba(${r} ${g} ${b} / 0.12)`,
    '--brand-font': fontStack(font),
    '--brand-theme': theme,
  };
}

const FONT_GOOGLE_URLS: Record<string, string> = {
  noto: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap',
  inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap',
};

function fontStack(font: string) {
  if (font === 'noto') return "'Noto Sans KR', sans-serif";
  if (font === 'inter') return "'Inter', system-ui, sans-serif";
  return "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif";
}

const THEME_BG: Record<string, string> = {
  light: '#fffaf3',
  warm: '#fff8f0',
  modern: '#f0faf9',
  minimal: '#fafafa',
  bold: '#0f0f0f',
};

const THEME_HEADER_BG: Record<string, string> = {
  light: 'bg-white/88',
  warm: 'bg-amber-50/90',
  modern: 'bg-teal-950/90',
  minimal: 'bg-white/96',
  bold: 'bg-black/90',
};

const THEME_HEADER_TEXT: Record<string, string> = {
  light: 'text-slate-900',
  warm: 'text-amber-950',
  modern: 'text-white',
  minimal: 'text-slate-900',
  bold: 'text-white',
};

import { AppFooter } from '@/shared/components/AppFooter';
import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta, useStructuredData } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  buildStoreLocalBusinessJsonLd,
  buildStoreSeoDescription,
  buildStoreSeoTitle,
  canonicalUrl,
  safeImageUrl,
} from '@/shared/lib/seo';
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
  const theme = publicStore?.store.theme_preset || 'light';
  const font = publicStore?.store.font_family || 'pretendard';
  const brandColor = publicStore?.store.brand_color || '#ec5b13';
  const cssVars = useMemo(() => brandCssVars(brandColor, theme, font), [brandColor, theme, font]);
  const pageBg = THEME_BG[theme] || THEME_BG.light;
  const headerBgCls = THEME_HEADER_BG[theme] || THEME_HEADER_BG.light;
  const headerTextCls = THEME_HEADER_TEXT[theme] || THEME_HEADER_TEXT.light;
  const publicBasePath =
    isStoreIdRoute && publicStore ? buildStoreIdPath(publicStore.store.id) : buildStorePath(storeSlug);
  const consultationPath = publicStore ? `/s/${publicStore.store.id}/consultation` : '#';
  const inquiryPath = publicStore ? `/s/${publicStore.store.id}/inquiry` : '#';
  const reservationPath = publicStore ? `/s/${publicStore.store.id}/reservation` : '#';
  const waitingPath = publicStore ? `/s/${publicStore.store.id}/waiting` : '#';
  const waitingEnabled = Boolean(publicStore?.capabilities.waitingEnabled);
  const seoStore = publicStore
    ? {
        address: publicStore.location?.address || publicStore.store.address,
        business_type: publicStore.store.business_type,
        description: publicStore.store.description,
        id: publicStore.store.id,
        logo_url: publicStore.store.logo_url || publicStore.media[0]?.image_url,
        name: publicStore.store.name,
        phone: publicStore.store.phone,
        slug: publicStore.store.slug,
        updated_at: publicStore.store.updated_at,
      }
    : null;

  usePageMeta(
    seoStore ? buildStoreSeoTitle(seoStore) : '공개 스토어',
    seoStore ? buildStoreSeoDescription(seoStore) : '매장 공개 페이지입니다.',
    {
      canonicalUrl: publicStore ? canonicalUrl(publicBasePath) : undefined,
      ogImage: safeImageUrl(seoStore?.logo_url),
      ogType: 'website',
    },
  );
  useStructuredData('store-local-business', seoStore ? buildStoreLocalBusinessJsonLd({ store: seoStore }) : null);

  // Inject non-Pretendard Google Font dynamically
  useEffect(() => {
    if (!publicStore || font === 'pretendard') return;
    const url = FONT_GOOGLE_URLS[font];
    if (!url) return;
    const existing = document.head.querySelector(`link[data-brand-font]`);
    if (existing) { (existing as HTMLLinkElement).href = url; return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-brand-font', font);
    document.head.appendChild(link);
  }, [font, publicStore]);

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
    const isDemo = storeSlug === 'mybiz-live-cafe';
    const description = isDemo
      ? '데모 스토어 데이터를 불러오는 중 오류가 발생했습니다. 운영 대시보드 데모를 먼저 체험해 보세요.'
      : publicStoreQuery.error instanceof Error
        ? publicStoreQuery.error.message
        : '공개 스토어 데이터를 불러오지 못했습니다.';

    return (
      <div className="page-shell py-20">
        <EmptyState
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {isDemo ? (
                <>
                  <Link className="btn-primary" to="/demo/dashboard">
                    데모 대시보드 보기
                  </Link>
                  <button
                    className="btn-secondary"
                    onClick={() => void publicStoreQuery.refetch()}
                    type="button"
                  >
                    다시 시도
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          }
          description={description}
          title={isDemo ? '데모 스토어를 불러오지 못했습니다' : '공개 스토어를 불러오지 못했습니다'}
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

  const isBoldOrModern = theme === 'bold' || theme === 'modern';
  const eyebrowColor = isBoldOrModern ? 'text-[color:var(--brand)]' : 'text-[color:var(--brand)]';
  const logoInitial = publicStore.store.name.slice(0, 1) || 'S';

  return (
    <div
      className="flex min-h-screen flex-col transition-colors duration-300"
      style={{ ...cssVars, backgroundColor: pageBg, fontFamily: 'var(--brand-font)' } as React.CSSProperties}
    >
      {/* ── Sticky Header ───────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 border-b border-slate-200/40 backdrop-blur-md ${headerBgCls}`}>
        <div className="page-shell flex items-center justify-between gap-4 py-3">
          {/* Logo + Name */}
          <Link className="flex min-w-0 items-center gap-3 group" to={publicBasePath}>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white text-sm font-black shadow-sm transition-transform duration-200 group-hover:scale-105"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {publicStore.store.logo_url ? (
                <img alt="로고" className="h-10 w-10 rounded-2xl object-cover" src={publicStore.store.logo_url} />
              ) : (
                logoInitial
              )}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-base font-black leading-5 ${headerTextCls}`}>
                {publicStore.store.name}
              </p>
              <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${eyebrowColor}`}>
                {publicStore.experience?.eyebrow || '매장 안내'}
                {publicStore.store.public_status !== 'public' ? (
                  <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] text-slate-600">미리보기</span>
                ) : null}
                {tableNo ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] text-white"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    테이블 {tableNo}
                  </span>
                ) : null}
              </p>
            </div>
          </Link>

          {/* Nav tabs */}
          <nav className="hidden items-center gap-1 md:flex">
            {(
              [
                { label: '홈', to: publicBasePath },
                { label: '메뉴', to: `${publicBasePath}/menu` },
                { label: '블로그', to: `${publicBasePath}/blog` },
                publicStore.capabilities.orderEntryEnabled && { label: '주문', to: `${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}` },
                publicStore.capabilities.reservationEnabled && { label: '예약', to: reservationPath },
                publicStore.capabilities.inquiryEnabled && { label: '문의', to: inquiryPath },
                publicStore.capabilities.consultationEnabled && { label: 'AI 상담', to: consultationPath },
                waitingEnabled && { label: '웨이팅', to: waitingPath },
              ] as Array<{ label: string; to: string } | false>
            )
              .filter(Boolean)
              .map((item) => {
                const { label, to } = item as { label: string; to: string };
                return (
                  <NavLink
                    key={to}
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${
                        isActive
                          ? 'text-white shadow-sm'
                          : isBoldOrModern
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                    style={({ isActive }) => isActive ? { backgroundColor: 'var(--brand)' } : {}}
                    to={to}
                  >
                    {label}
                  </NavLink>
                );
              })}
          </nav>

          {/* Primary CTA */}
          {publicStore.capabilities.orderEntryEnabled ? (
            <NavLink
              className="hidden shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 sm:block"
              style={{ backgroundColor: 'var(--brand)' }}
              to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}
            >
              주문하기
            </NavLink>
          ) : publicStore.capabilities.reservationEnabled ? (
            <Link
              className="hidden shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 sm:block"
              style={{ backgroundColor: 'var(--brand)' }}
              to={reservationPath}
            >
              예약 신청
            </Link>
          ) : null}
        </div>

        {/* Mobile nav strip */}
        <div className="page-shell flex items-center gap-2 overflow-x-auto pb-2 pt-0 md:hidden">
          {(
            [
              { label: '홈', to: publicBasePath },
              { label: '메뉴', to: `${publicBasePath}/menu` },
              publicStore.capabilities.orderEntryEnabled && { label: '주문', to: `${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}` },
              publicStore.capabilities.reservationEnabled && { label: '예약', to: reservationPath },
              publicStore.capabilities.inquiryEnabled && { label: '문의', to: inquiryPath },
              waitingEnabled && { label: '웨이팅', to: waitingPath },
            ] as Array<{ label: string; to: string } | false>
          )
            .filter(Boolean)
            .map((item) => {
              const { label, to } = item as { label: string; to: string };
              return (
                <NavLink
                  key={to}
                  className={({ isActive }) =>
                    `shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors duration-150 ${
                      isActive
                        ? 'text-white'
                        : isBoldOrModern
                          ? 'text-white/60 hover:text-white'
                          : 'text-slate-500 hover:text-slate-900'
                    }`
                  }
                  style={({ isActive }) => isActive ? { backgroundColor: 'var(--brand)' } : {}}
                  to={to}
                >
                  {label}
                </NavLink>
              );
            })}
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

      {/* Mobile floating CTA */}
      {(publicStore.capabilities.orderEntryEnabled || publicStore.capabilities.reservationEnabled) ? (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 gap-3 sm:hidden">
          {publicStore.capabilities.orderEntryEnabled ? (
            <NavLink
              className="rounded-full px-6 py-3 text-sm font-bold text-white shadow-2xl ring-2 ring-white/30 transition-transform duration-150 active:scale-95"
              style={{ backgroundColor: 'var(--brand)' }}
              to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}
            >
              주문하기
            </NavLink>
          ) : null}
          {publicStore.capabilities.reservationEnabled ? (
            <Link
              className="rounded-full bg-white px-6 py-3 text-sm font-bold shadow-2xl ring-1 ring-slate-200 transition-transform duration-150 active:scale-95"
              style={{ color: 'var(--brand)' }}
              to={reservationPath}
            >
              예약 신청
            </Link>
          ) : null}
        </div>
      ) : null}

      <AppFooter />
    </div>
  );
}
