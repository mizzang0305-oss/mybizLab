import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';

import type { PlatformAdminSession } from '@/shared/lib/services/platformAdminContentService';

const navGroups = [
  {
    label: '운영 현황',
    items: [
      { label: '개요', to: '/admin' },
      { label: '결제 이벤트', to: '/admin/payment-events' },
      { label: '감사 로그', to: '/admin/audit-logs' },
    ],
  },
  {
    label: '홈페이지 관리',
    items: [
      { label: '홈페이지 섹션', to: '/admin/homepage' },
      { label: 'SEO/푸터 설정', to: '/admin/settings' },
      { label: '미디어', to: '/admin/media' },
    ],
  },
  {
    label: '상품/가격 관리',
    items: [
      { label: '가격표', to: '/admin/pricing' },
      { label: '결제 상품', to: '/admin/products' },
      { label: '프로모션/할인 표시', to: '/admin/promotions' },
      { label: '100원 테스트 결제', to: '/admin/payment-tests' },
    ],
  },
  {
    label: '공지/콘텐츠',
    items: [
      { label: '공지', to: '/admin/announcements' },
      { label: '게시판', to: '/admin/board' },
      { label: '팝업', to: '/admin/popups' },
      { label: '배너', to: '/admin/banners' },
    ],
  },
  {
    label: '시스템',
    items: [
      { label: '기능 플래그', to: '/admin/feature-flags' },
      { label: '미리보기', to: '/admin/preview' },
    ],
  },
] as const;

const pageTitles: Record<string, string> = {
  '/admin': '플랫폼 관리자 개요',
  '/admin/announcements': '공지 관리',
  '/admin/audit-logs': '감사 로그',
  '/admin/banners': '배너 관리',
  '/admin/board': '게시판 관리',
  '/admin/feature-flags': '기능 플래그',
  '/admin/homepage': '홈페이지 관리',
  '/admin/media': '미디어 관리',
  '/admin/payment-events': '결제 이벤트',
  '/admin/payment-tests': '100원 테스트 결제',
  '/admin/popups': '팝업 관리',
  '/admin/pricing': '가격표 관리',
  '/admin/products': '결제 상품 관리',
  '/admin/promotions': '프로모션/할인 표시',
  '/admin/settings': '플랫폼 설정',
  '/admin/preview': '공개 화면 미리보기',
};

export function PlatformAdminLayout() {
  const session = useOutletContext<PlatformAdminSession>();
  const location = useLocation();
  const title = pageTitles[location.pathname] || '플랫폼 관리자';
  const environment = import.meta.env.MODE === 'production' ? 'production' : import.meta.env.MODE || 'local';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[18rem_1fr]">
        <aside className="border-b border-white/10 bg-slate-950/95 px-4 py-5 lg:border-b-0 lg:border-r">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">MyBiz</p>
            <h1 className="mt-2 font-display text-2xl font-black text-white">플랫폼 관리자</h1>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              공개 서비스, 가격표, 결제 테스트, 공지, 팝업, 배너를 운영하는 MyBiz 내부 콘솔입니다.
            </p>
          </div>

          <nav className="mt-5 space-y-6" aria-label="플랫폼 관리자 메뉴">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[11px] font-black tracking-[0.16em] text-slate-500">{group.label}</p>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      className={({ isActive }) =>
                        [
                          'block rounded-2xl px-3 py-2.5 text-sm font-bold transition',
                          isActive
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-950/30'
                            : 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
                        ].join(' ')
                      }
                      end={item.to === '/admin'}
                      to={item.to}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/88 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Platform Admin</p>
                <h2 className="mt-1 font-display text-2xl font-black text-white">{title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
                  {environment}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-slate-300">
                  {session.email}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-slate-300">
                  {session.role}
                </span>
              </div>
            </div>
          </header>

          <main className="px-5 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
