import { Link, NavLink, Outlet } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { Icons } from '@/shared/components/Icons';
import { SITE_NAME, SERVICE_TAGLINE, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const navigationLinks = [
  { label: '소개', href: '/' },
  { label: '요금제', href: '/pricing' },
  { label: '이용약관', href: '/terms' },
  { label: '개인정보', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f2ea]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f6f2ea]/90 backdrop-blur">
        <div className="page-shell py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link className="flex items-center gap-3" to="/">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-500/20">
                <Icons.Store size={22} />
              </div>
              <div>
                <p className="font-display text-xl font-black text-slate-900">{SITE_NAME}</p>
                <p className="text-xs text-slate-500">{SERVICE_TAGLINE}</p>
              </div>
            </Link>

            <div className="flex flex-col gap-3 lg:items-end">
              <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                {navigationLinks.map((item) => (
                  <NavLink
                    key={item.href}
                    className={({ isActive }) =>
                      ['rounded-full px-3 py-2 transition', isActive ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/70 hover:text-slate-900'].join(' ')
                    }
                    end={item.href === '/'}
                    to={item.href}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="flex flex-wrap items-center gap-3">
                <Link className="btn-secondary" to="/login">
                  관리자 로그인
                </Link>
                <Link className="btn-primary" to={SUBSCRIPTION_START_PATH}>
                  무료 공개페이지 시작
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <AppFooter />
    </div>
  );
}
