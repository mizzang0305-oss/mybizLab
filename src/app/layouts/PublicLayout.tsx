import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { Icons } from '@/shared/components/Icons';
import { PersistentDiagnosisWorldProvider } from '@/shared/components/PersistentDiagnosisWorldShell';
import { DIAGNOSIS_CORRIDOR_LINK_STATE, isDiagnosisShellPath } from '@/shared/lib/diagnosisCorridor';
import { SERVICE_TAGLINE, SITE_NAME, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const navigationLinks = [
  { label: '소개', href: '/' },
  { label: '요금제', href: '/pricing' },
  { label: '이용약관', href: '/terms' },
  { label: '개인정보', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

const ENABLE_PUBLIC_MYBI_COMPANION = false;

export function PublicLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isDiagnosisShell = isDiagnosisShellPath(location.pathname);
  const isPublicCinematicSurface = isDiagnosisShell;
  const hasMybiCompanion =
    !location.pathname.startsWith('/login') &&
    (!isPublicCinematicSurface || ENABLE_PUBLIC_MYBI_COMPANION);

  return (
    <PersistentDiagnosisWorldProvider active={hasMybiCompanion} pathname={location.pathname}>
      <div
        className={`flex min-h-screen flex-col ${isDiagnosisShell ? 'bg-[#03050a] text-white' : 'bg-[#f6f2ea] text-slate-900'}`}
        data-public-shell-theme={isDiagnosisShell ? 'diagnosis' : 'default'}
      >
        {isDiagnosisShell ? null : (
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f6f2ea]/90 backdrop-blur-xl">
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
                  {isLandingPage ? (
                    <nav className="hidden items-center gap-2 text-sm font-semibold text-slate-500 lg:flex">
                      <NavLink
                        className={({ isActive }) =>
                          ['rounded-full px-3 py-2 transition', isActive ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/70 hover:text-slate-900'].join(' ')
                        }
                        to="/pricing"
                      >
                        요금제
                      </NavLink>
                    </nav>
                  ) : (
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
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Link className="btn-secondary" to="/login">
                      관리자 로그인
                    </Link>

                    <Link className="btn-primary" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                      무료로 시작하기
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </header>
        )}

        <div className="flex-1">
          <Outlet />
        </div>

        {isDiagnosisShell ? null : <AppFooter />}
      </div>
    </PersistentDiagnosisWorldProvider>
  );
}
