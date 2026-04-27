import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { StoreSwitcher } from '@/shared/components/StoreSwitcher';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { useAdminAccess } from '@/shared/lib/adminSession';
import { adminNavigation, resolveAdminNavigation } from '@/shared/lib/moduleCatalog';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { getBusinessTypeLabel } from '@/shared/lib/storeLabels';
import { buildStorePath } from '@/shared/lib/storeSlug';
import { useUiStore } from '@/shared/lib/uiStore';

const dashboardNavigationLabelMap: Record<string, string> = {
  '/dashboard': '운영 대시보드',
  '/dashboard/ai-manager': 'AI 점장',
  '/dashboard/customers': '고객 기억 관리',
  '/dashboard/reservations': '예약 관리',
  '/dashboard/orders': '주문 관리',
  '/dashboard/waiting': '웨이팅 관리',
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

const dashboardNavigationDescriptionMap: Record<string, string> = {
  '/dashboard': '오늘 운영 흐름과 핵심 숫자를 가장 먼저 확인하는 화면입니다.',
  '/dashboard/ai-manager': '오늘 주문, 매출, 인기 메뉴를 AI 운영 요약으로 빠르게 읽어보세요.',
  '/dashboard/customers': '고객, 문의, 상담, 주문 이력을 한 고객 기억 축으로 관리합니다.',
  '/dashboard/reservations': '예약 현황과 좌석 운영 흐름을 빠르게 정리할 수 있습니다.',
  '/dashboard/orders': '주문 상태와 채널별 흐름을 바로 확인하고 대응하는 화면입니다.',
  '/dashboard/waiting': '현장 대기 팀, 호출, 입장 처리를 한 번에 파악할 수 있습니다.',
  '/dashboard/sales': '수기 운영지표와 최근 흐름을 함께 보며 운영 메모를 남깁니다.',
  '/dashboard/ai-reports': '문제 TOP3와 실행 액션을 AI 운영 리포트로 바로 확인합니다.',
  '/dashboard/table-order': 'QR 주문 진입과 테이블 설정, 메뉴 동선을 한눈에 관리합니다.',
  '/dashboard/brand': '공개 스토어 문구와 버튼, 브랜드 톤을 점주 시점에서 정리합니다.',
  '/dashboard/store-requests': '새 스토어 요청 상태와 검토 흐름을 빠르게 확인합니다.',
  '/dashboard/stores': '전체 스토어 운영 현황과 공개 상태를 살펴보는 화면입니다.',
  '/dashboard/billing': '결제 상태와 구독 흐름을 운영 화면에서 점검합니다.',
  '/dashboard/admin-users': '운영 계정과 접근 권한 상태를 한 곳에서 관리합니다.',
  '/dashboard/system': '주요 시스템 상태와 운영 경고를 빠르게 확인합니다.',
};

function getDashboardNavigationLabel(route: string, fallback: string) {
  return dashboardNavigationLabelMap[route] || fallback;
}

function getDashboardNavigationDescription(route: string) {
  return dashboardNavigationDescriptionMap[route] || '현재 운영 화면에서 필요한 내용을 바로 확인할 수 있습니다.';
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOut } = useAdminAccess();
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
  const currentNavDescription = currentNav ? getDashboardNavigationDescription(currentNav.route) : '현재 운영 화면에서 필요한 내용을 바로 확인할 수 있습니다.';
  const adminDisplayName = session?.fullName === 'Platform Owner' ? '운영 관리자' : session?.fullName || '운영 관리자';
  const adminDisplayEmail = session?.email || 'admin@mybiz.ai.kr';
  const currentStoreAddressLabel = currentStoreConfig?.address || '주소 설정 필요';

  function handleSignOut() {
    void signOut().finally(() => {
      navigate('/login', { replace: true });
    });
  }

  const sidebar = (
    <aside className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto border-r border-slate-800 bg-slate-950 px-4 py-5 text-white lg:h-screen">
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
            {getBusinessTypeLabel(currentStoreConfig?.business_type)} · {currentStoreAddressLabel}
          </p>
          <Link className="mt-3 inline-flex min-h-9 items-center text-sm font-bold text-orange-300" to={buildStorePath(currentStore.slug)}>
            공개 매장 보기
          </Link>
        </div>
      ) : null}
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#eff3f8] lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</div>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden">
            <div className="h-full w-80 max-w-[85vw]">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-col lg:h-screen lg:overflow-y-auto">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#eff3f8]/95 backdrop-blur">
            <div className="page-shell flex flex-col gap-2 py-2.5 sm:py-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <button className="btn-ghost lg:hidden" onClick={toggleSidebar} type="button">
                    <Icons.Menu size={18} />
                    메뉴
                  </button>
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="hidden min-w-0 text-right sm:block">
                    <p className="text-sm font-semibold leading-6 text-slate-900 [word-break:keep-all]">{adminDisplayName}</p>
                    <p className="text-xs leading-5 text-slate-500">{adminDisplayEmail}</p>
                  </div>
                  <button className="btn-secondary" onClick={handleSignOut} type="button">
                    로그아웃
                  </button>
                </div>
              </div>

              <StoreSwitcher
                currentStore={currentStore}
                onChange={setSelectedStoreId}
                pageDescription={currentNavDescription}
                pageTitle={currentNavLabel}
                stores={stores}
              />

              <nav className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-2 lg:hidden">
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
          </header>

          <main className="page-shell min-w-0 flex-1 pt-3 pb-5 sm:pt-4 sm:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
