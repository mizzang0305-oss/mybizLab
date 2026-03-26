import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { StoreSwitcher } from '@/shared/components/StoreSwitcher';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { useAdminSessionStore } from '@/shared/lib/adminSession';
import { adminNavigation, resolveAdminNavigation } from '@/shared/lib/moduleCatalog';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { buildStorePath } from '@/shared/lib/storeSlug';
import { useUiStore } from '@/shared/lib/uiStore';

const dashboardNavigationLabelMap: Record<string, string> = {
  '/dashboard': '운영 대시보드',
  '/dashboard/ai-manager': 'AI 점장',
  '/dashboard/customers': '고객 관리',
  '/dashboard/reservations': '예약 관리',
  '/dashboard/orders': '주문 관리',
  '/dashboard/waiting': '웨이팅보드',
  '/dashboard/sales': '매출 분석',
  '/dashboard/ai-reports': 'AI 운영 리포트',
  '/dashboard/table-order': '테이블 주문',
  '/dashboard/brand': '브랜드 설정',
  '/dashboard/store-requests': '스토어 생성 요청',
  '/dashboard/stores': '스토어 목록',
  '/dashboard/billing': '결제 관리',
  '/dashboard/admin-users': '운영 계정',
  '/dashboard/system': '시스템 현황',
};

function getDashboardNavigationLabel(route: string, fallback: string) {
  return dashboardNavigationLabelMap[route] || fallback;
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAdminSessionStore((state) => state.session);
  const signOut = useAdminSessionStore((state) => state.signOut);
  const { currentStore, stores, setSelectedStoreId } = useCurrentStore();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const closeSidebar = useUiStore((state) => state.closeSidebar);
  const currentStoreConfig = currentStore ? getStoreBrandConfig(currentStore) : null;

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar, location.pathname]);

  const currentNav = useMemo(() => resolveAdminNavigation(location.pathname), [location.pathname]);
  const currentNavLabel = currentNav ? getDashboardNavigationLabel(currentNav.route, currentNav.label) : '운영 대시보드';
  const adminDisplayName = session?.fullName === 'Platform Owner' ? '운영 관리자' : session?.fullName || '운영 관리자';
  const adminDisplayEmail = session?.email || 'admin@mybiz.ai.kr';

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  const sidebar = (
    <aside className="flex h-full min-w-0 flex-col gap-5 border-r border-slate-800 bg-slate-950 px-4 py-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-black">MyBizLab</p>
          <p className="text-sm leading-6 text-slate-400 [word-break:keep-all]">사장님용 운영 화면</p>
        </div>
        <button className="btn-ghost sm:hidden" onClick={closeSidebar} type="button">
          닫기
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {adminNavigation.map((item) => {
          const Icon = item.icon;
          const label = getDashboardNavigationLabel(item.route, item.label);

          return (
            <NavLink
              key={item.route}
              className={({ isActive }) =>
                [
                  'flex min-h-[3.25rem] items-center gap-3 rounded-[20px] px-4 py-3 text-[15px] font-semibold leading-6 [word-break:keep-all] transition',
                  isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
              onClick={closeSidebar}
              to={item.route}
            >
              <Icon size={18} />
              <span className="min-w-0">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">로그인 계정</p>
        <p className="mt-2 break-words font-semibold text-white">{adminDisplayName}</p>
        <p className="mt-1 break-all text-xs text-slate-400">{adminDisplayEmail}</p>
      </div>

      {currentStore ? (
        <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">현재 보고 있는 매장</p>
          <p className="mt-2 break-words font-semibold text-white">{currentStore.name}</p>
          <p className="mt-1 break-words text-sm leading-6 text-slate-400 [word-break:keep-all]">
            {currentStoreConfig?.business_type || '-'} · {currentStoreConfig?.address || '-'}
          </p>
          <Link className="mt-3 inline-flex min-h-9 items-center text-sm font-bold text-orange-300" to={buildStorePath(currentStore.slug)}>
            공개 매장 보기
          </Link>
        </div>
      ) : null}
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#eff3f8]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden">
            <div className="h-full w-80 max-w-[85vw]">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#eff3f8]/95 backdrop-blur">
            <div className="page-shell flex flex-col gap-2 py-2.5 sm:gap-3 sm:py-3.5">
              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button className="btn-ghost lg:hidden" onClick={toggleSidebar} type="button">
                    <Icons.Menu size={18} />
                    메뉴
                  </button>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-6 text-slate-500">{currentStore?.name || '데모 매장 준비 중'}</p>
                    <p className="break-words font-display text-[1.7rem] font-black leading-[1.15] text-slate-950 [word-break:keep-all] sm:text-[1.95rem]">
                      {currentNavLabel}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="break-words text-sm font-semibold leading-6 text-slate-900">{adminDisplayName}</p>
                    <p className="break-all text-xs leading-5 text-slate-500">로그인 계정 · {adminDisplayEmail}</p>
                  </div>
                  <button className="btn-secondary" onClick={handleSignOut} type="button">
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-3 sm:p-3.5">
                  <StoreSwitcher currentStore={currentStore} onChange={setSelectedStoreId} stores={stores} />
                </div>

                <nav className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-2 lg:hidden">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {adminNavigation.map((item) => {
                      const Icon = item.icon;
                      const label = getDashboardNavigationLabel(item.route, item.label);

                      return (
                        <NavLink
                          key={item.route}
                          className={({ isActive }) =>
                            [
                              'flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-left text-[14px] font-semibold leading-5 [word-break:keep-all] transition',
                              isActive ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-orange-700',
                            ].join(' ')
                          }
                          to={item.route}
                        >
                          <Icon size={16} />
                          <span className="min-w-0">{label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </nav>
              </div>
            </div>
          </header>

          <main className="page-shell min-w-0 flex-1 pt-4 pb-5 sm:pt-5 sm:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
