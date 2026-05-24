import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';

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
  '/dashboard/content/reviews': '리뷰 관리',
  '/dashboard/content/review-requests': '리뷰 요청 링크',
  '/dashboard/content/blog': '블로그/소식',
  '/dashboard/content/media': '사진·영상',
  '/dashboard/content/social': '게시 초안/소셜',
  '/dashboard/content/status': '콘텐츠 상태판',
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
  '/dashboard/content/reviews': '고객이 남긴 실제 리뷰를 승인하고 블로그 초안으로 확장합니다.',
  '/dashboard/content/review-requests': '방문·주문·예약 이후 보낼 리뷰 요청 링크와 QR을 준비합니다.',
  '/dashboard/content/blog': '매장 소식과 SEO용 글을 초안, 게시, 보관 상태로 관리합니다.',
  '/dashboard/content/media': '사진과 영상을 URL로 등록하고 캡션·자막 초안을 준비합니다.',
  '/dashboard/content/social': '외부 채널 게시 초안을 만들되 계정 연동 전에는 자동 게시하지 않습니다.',
  '/dashboard/content/status': '리뷰, 블로그, 미디어, SEO, STT, 소셜 게시 준비 상태를 한눈에 점검합니다.',
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
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // ── Cmd+K / Ctrl+K shortcut ──────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
                  {/* Cmd+K trigger */}
                  <button
                    className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition hover:border-orange-300 hover:text-orange-600 sm:flex"
                    onClick={() => setCmdkOpen(true)}
                    type="button"
                  >
                    <Icons.Search size={14} />
                    <span className="hidden text-xs md:inline">빠른 이동</span>
                    <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 lg:inline">
                      ⌘K
                    </kbd>
                  </button>
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

      {/* ── cmdk Command Palette (Cmd+K) ── */}
      {cmdkOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/50 px-4 pt-[14vh] backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setCmdkOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="빠른 이동 팔레트"
        >
          <Command
            className="w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-700 bg-slate-900 shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
            onKeyDown={(e) => { if (e.key === 'Escape') setCmdkOpen(false); }}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
              <Icons.Search size={16} className="shrink-0 text-slate-400" />
              <Command.Input
                autoFocus
                className="flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                placeholder="메뉴 이름으로 이동..."
              />
              <kbd className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-slate-500">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[380px] overflow-y-auto py-2">
              <Command.Empty className="py-8 text-center text-sm text-slate-500">
                결과가 없습니다
              </Command.Empty>

              {[
                {
                  heading: '운영',
                  items: [
                    { label: '운영 대시보드', route: '/dashboard', icon: Icons.Dashboard },
                    { label: 'AI 점장', route: '/dashboard/ai-manager', icon: Icons.AI },
                    { label: '예약 관리', route: '/dashboard/reservations', icon: Icons.Calendar },
                    { label: '웨이팅 관리', route: '/dashboard/waiting', icon: Icons.Waiting },
                    { label: '주문 관리', route: '/dashboard/orders', icon: Icons.Kitchen },
                  ],
                },
                {
                  heading: '고객 · 분석',
                  items: [
                    { label: '고객 기억 관리', route: '/dashboard/customers', icon: Icons.Users },
                    { label: '매출 분석', route: '/dashboard/sales', icon: Icons.Chart },
                    { label: 'AI 운영 리포트', route: '/dashboard/ai-reports', icon: Icons.AI },
                  ],
                },
                {
                  heading: '콘텐츠',
                  items: [
                    { label: '리뷰 관리', route: '/dashboard/content/reviews', icon: Icons.Check },
                    { label: '블로그/소식', route: '/dashboard/content/blog', icon: Icons.Contract },
                    { label: '소셜 게시 초안', route: '/dashboard/content/social', icon: Icons.Globe },
                  ],
                },
                {
                  heading: '설정',
                  items: [
                    { label: '브랜드 설정', route: '/dashboard/brand', icon: Icons.Brand },
                    { label: '테이블 주문', route: '/dashboard/table-order', icon: Icons.Mobile },
                    { label: '결제 관리', route: '/dashboard/billing', icon: Icons.ShieldCheck },
                  ],
                },
              ].map(({ heading, items }) => (
                <Command.Group
                  key={heading}
                  heading={heading}
                  className="[&_[cmdk-group-heading]]:px-5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500"
                >
                  {items.map(({ label, route, icon: Icon }) => (
                    <Command.Item
                      key={route}
                      value={label}
                      className="mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition aria-selected:bg-orange-500/15 aria-selected:text-orange-300 hover:bg-white/[0.06]"
                      onSelect={() => {
                        navigate(route);
                        setCmdkOpen(false);
                      }}
                    >
                      <Icon size={16} className="shrink-0 opacity-60" />
                      {label}
                      {location.pathname === route && (
                        <span className="ml-auto rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                          현재
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
