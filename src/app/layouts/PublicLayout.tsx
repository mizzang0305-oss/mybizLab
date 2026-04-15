import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { Icons } from '@/shared/components/Icons';
import { DIAGNOSIS_CORRIDOR_LINK_STATE, isDiagnosisShellPath } from '@/shared/lib/diagnosisCorridor';
import { SITE_NAME, SERVICE_TAGLINE, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const navigationLinks = [
  { label: '소개', href: '/' },
  { label: '요금제', href: '/pricing' },
  { label: '이용약관', href: '/terms' },
  { label: '개인정보', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

export function PublicLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isOnboardingPage = location.pathname === SUBSCRIPTION_START_PATH;
  const isDiagnosisShell = isDiagnosisShellPath(location.pathname);

  return (
    <div
      className={`flex min-h-screen flex-col ${isDiagnosisShell ? 'bg-[#03050a] text-white' : 'bg-[#f6f2ea]'}`}
      data-public-shell-theme={isDiagnosisShell ? 'diagnosis' : 'default'}
    >
      <header
        className={[
          'sticky top-0 z-40 border-b backdrop-blur-xl',
          isDiagnosisShell ? 'border-white/10 bg-[#04070d]/88' : 'border-slate-200/80 bg-[#f6f2ea]/90',
        ].join(' ')}
      >
        <div className="page-shell py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link className="flex items-center gap-3" to="/">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-500/20">
                <Icons.Store size={22} />
              </div>
              <div>
                <p className={`font-display text-xl font-black ${isDiagnosisShell ? 'text-white' : 'text-slate-900'}`}>{SITE_NAME}</p>
                <p className={`text-xs ${isDiagnosisShell ? 'text-slate-400' : 'text-slate-500'}`}>{SERVICE_TAGLINE}</p>
              </div>
            </Link>

            <div className="flex flex-col gap-3 lg:items-end">
              {isLandingPage ? (
                <nav className="hidden items-center gap-2 text-sm font-semibold text-slate-400 lg:flex">
                  <NavLink
                    className={({ isActive }) =>
                      ['rounded-full px-3 py-2 transition', isActive ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.05] hover:text-slate-200'].join(' ')
                    }
                    to="/pricing"
                  >
                    요금제
                  </NavLink>
                </nav>
              ) : (
                <nav className={['flex flex-wrap items-center gap-2 text-sm font-semibold', isDiagnosisShell ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                  {navigationLinks.map((item) => (
                    <NavLink
                      key={item.href}
                      className={({ isActive }) =>
                        [
                          'rounded-full px-3 py-2 transition',
                          isDiagnosisShell
                            ? isActive
                              ? 'bg-white/[0.08] text-white'
                              : 'hover:bg-white/[0.05] hover:text-slate-100'
                            : isActive
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'hover:bg-white/70 hover:text-slate-900',
                        ].join(' ')
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
                <Link
                  className={
                    isDiagnosisShell
                      ? 'btn-secondary border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                      : 'btn-secondary'
                  }
                  to={isOnboardingPage ? '/' : '/login'}
                >
                  {isOnboardingPage ? '진단 시네마로 돌아가기' : '관리자 로그인'}
                </Link>

                {isOnboardingPage ? (
                  <Link className="btn-primary" to="/pricing">
                    플랜 비교 보기
                  </Link>
                ) : (
                  <Link className="btn-primary" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                    공개 스토어 진단 생성
                  </Link>
                )}
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
