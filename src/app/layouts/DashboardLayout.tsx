import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { StoreSwitcher } from '@/shared/components/StoreSwitcher';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { useAdminSessionStore } from '@/shared/lib/adminSession';
import { adminNavigation } from '@/shared/lib/moduleCatalog';
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
  const [searchValue, setSearchValue] = useState('');

  usePageMeta('플랫폼 운영 콘솔', 'dev 관리자 전용 콘솔에서 스토어 요청, billing, 관리자 계정, 시스템 상태를 운영 기준으로 관리합니다.');

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar, location.pathname]);

  useEffect(() => {
    const keyword = new URLSearchParams(location.search).get('keyword') || '';
    setSearchValue(keyword);
  }, [location.search]);

  const currentNav = useMemo(() => {
    return adminNavigation.find((item) => location.pathname === item.route || location.pathname.startsWith(`${item.route}/`));
  }, [location.pathname]);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = searchValue.trim();
    navigate(trimmed ? `/dashboard/stores?keyword=${encodeURIComponent(trimmed)}` : '/dashboard/stores');
  }

  const sidebar = (
    <aside className="flex h-full flex-col gap-6 border-r border-slate-800 bg-slate-950 px-5 py-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xl font-black">My Biz Lab</p>
          <p className="text-xs text-slate-400">Platform Operator Console</p>
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current Admin</p>
        <p className="mt-2 font-semibold text-white">{session?.fullName || 'Platform Admin'}</p>
        <p className="mt-1 text-xs text-slate-400">{session?.email || 'ops@mybiz.ai.kr'}</p>
      </div>

      {currentStore ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Quick Store Context</p>
          <p className="mt-2 font-semibold text-white">{currentStore.name}</p>
          <p className="mt-1 text-xs text-slate-400">/{currentStore.slug}</p>
          <Link className="mt-3 inline-flex text-xs font-bold text-orange-300" to={buildStorePath(currentStore.slug)}>
            공개 스토어 보기
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
                <div className="flex items-center gap-3">
                  <button className="btn-ghost lg:hidden" onClick={toggleSidebar} type="button">
                    <Icons.Menu size={18} />
                    메뉴
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Dev admin dashboard</p>
                    <p className="font-display text-2xl font-black text-slate-950">{currentNav?.label || '운영 콘솔'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-900">{session?.fullName || 'Platform Admin'}</p>
                    <p className="text-xs text-slate-500">{session?.email || 'ops@mybiz.ai.kr'}</p>
                  </div>
                  <button className="btn-secondary" onClick={handleSignOut} type="button">
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                <form className="relative" onSubmit={handleSearchSubmit}>
                  <Icons.Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    className="input-base pl-11"
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="스토어명, slug, 관리자 이메일로 검색"
                    value={searchValue}
                  />
                </form>

                <div className="rounded-[28px] border border-slate-200 bg-white p-3">
                  <StoreSwitcher currentStore={currentStore} onChange={setSelectedStoreId} stores={stores} />
                </div>
              </div>
            </div>
          </header>

          <main className="page-shell flex-1 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
