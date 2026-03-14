import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { EmptyState } from '@/shared/components/EmptyState';
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
  const { currentStore, stores, setSelectedStoreId, isLoading } = useCurrentStore();
  const session = useAdminSessionStore((state) => state.session);
  const signOut = useAdminSessionStore((state) => state.signOut);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const closeSidebar = useUiStore((state) => state.closeSidebar);

  usePageMeta('관리자 대시보드', '마이비즈랩 관리자 대시보드에서 매장 운영, AI 리포트, 주문, 고객 관리를 확인하세요.');

  function handleSignOut() {
    closeSidebar();
    signOut();
    navigate('/login', { replace: true });
  }

  const sidebar = (
    <aside className="flex h-full flex-col gap-6 border-r border-slate-200/70 bg-slate-950 px-5 py-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xl font-black">My Biz Lab</p>
          <p className="text-xs text-slate-400">Operator Console</p>
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

      {currentStore ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="font-bold text-white">{currentStore.name}</p>
          <p className="mt-1 text-xs text-slate-400">{currentStore.address}</p>
          <Link className="mt-3 inline-flex text-xs font-bold text-orange-300" to={buildStorePath(currentStore.slug)}>
            공개 스토어 미리보기
          </Link>
        </div>
      ) : null}
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f6f2ea]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden">
            <div className="h-full w-80 max-w-[85vw]">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f6f2ea]/90 backdrop-blur">
            <div className="page-shell flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button className="btn-ghost lg:hidden" onClick={toggleSidebar} type="button">
                  <Icons.Menu size={18} />
                  메뉴
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-500">운영 워크스페이스</p>
                  <p className="font-display text-xl font-black text-slate-900">{currentStore ? currentStore.name : '스토어 선택 필요'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {session ? <span className="hidden text-sm font-medium text-slate-500 md:inline">{session.email}</span> : null}
                <StoreSwitcher stores={stores} currentStore={currentStore} onChange={setSelectedStoreId} />
                <button className="btn-secondary" onClick={handleSignOut} type="button">
                  로그아웃
                </button>
              </div>
            </div>
          </header>

          <main className="page-shell flex-1 py-8">
            {!isLoading && !currentStore ? (
              <EmptyState
                action={
                  <NavLink className="btn-primary" to="/onboarding">
                    온보딩으로 이동
                  </NavLink>
                }
                description="운영 화면은 스토어가 생성된 뒤 store_id 기준으로 데이터를 보여줍니다."
                title="먼저 스토어를 만들어 주세요"
              />
            ) : (
              <Outlet />
            )}
          </main>

          <AppFooter />
        </div>
      </div>
    </div>
  );
}
