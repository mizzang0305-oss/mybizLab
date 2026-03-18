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

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAdminSessionStore((state) => state.session);
  const signOut = useAdminSessionStore((state) => state.signOut);
  const { currentStore, stores, setSelectedStoreId } = useCurrentStore();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const closeSidebar = useUiStore((state) => state.closeSidebar);
  const adminDisplayName = session?.fullName === 'Platform Owner' ? '운영 관리자' : session?.fullName || '운영 관리자';
  const adminDisplayEmail = session?.email || 'admin@mybiz.ai.kr';
  const currentStoreConfig = currentStore ? getStoreBrandConfig(currentStore) : null;

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar, location.pathname]);

  const currentNav = useMemo(() => resolveAdminNavigation(location.pathname), [location.pathname]);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  const sidebar = (
    <aside className="flex h-full min-w-0 flex-col gap-6 border-r border-slate-800 bg-slate-950 px-5 py-6 text-white">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-display text-xl font-black">MyBizLab</p>
          <p className="text-xs text-slate-400">스토어 운영 대시보드</p>
        </div>
        <button className="btn-ghost sm:hidden" onClick={closeSidebar} type="button">
          닫기
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {adminNavigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.route}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
              onClick={closeSidebar}
              to={item.route}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">로그인 계정</p>
        <p className="mt-2 break-words font-semibold text-white">{adminDisplayName}</p>
        <p className="mt-1 break-all text-xs text-slate-400">{adminDisplayEmail}</p>
      </div>

      {currentStore ? (
        <div className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">현재 스토어</p>
          <p className="mt-2 break-words font-semibold text-white">{currentStore.name}</p>
          <p className="mt-1 break-words text-xs leading-6 text-slate-400">
            {currentStoreConfig?.business_type || '-'} · {currentStoreConfig?.address || '-'}
          </p>
          <Link className="mt-3 inline-flex text-xs font-bold text-orange-300" to={buildStorePath(currentStore.slug)}>
            스토어 홈 보기
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
            <div className="page-shell flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button className="btn-ghost lg:hidden" onClick={toggleSidebar} type="button">
                    <Icons.Menu size={18} />
                    메뉴
                  </button>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-500">{currentStore?.name || '스토어 데이터를 불러오는 중'}</p>
                    <p className="break-words font-display text-2xl font-black text-slate-950">{currentNav?.label || '운영 대시보드'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="break-words font-semibold text-slate-900">{adminDisplayName}</p>
                    <p className="break-all text-xs text-slate-500">로그인 계정 · {adminDisplayEmail}</p>
                  </div>
                  <button className="btn-secondary" onClick={handleSignOut} type="button">
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-3">
                  <StoreSwitcher currentStore={currentStore} onChange={setSelectedStoreId} stores={stores} />
                </div>

                <nav className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    {adminNavigation.map((item) => {
                      const Icon = item.icon;

                      return (
                        <NavLink
                          key={item.route}
                          className={({ isActive }) =>
                            [
                              'inline-flex max-w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                              isActive ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-orange-700',
                            ].join(' ')
                          }
                          to={item.route}
                        >
                          <Icon size={16} />
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </nav>
              </div>
            </div>
          </header>

          <main className="page-shell min-w-0 flex-1 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
