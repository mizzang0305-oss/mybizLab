import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Toaster } from 'sonner';
import { AppFooter } from '@/shared/components/AppFooter';
import { Icons } from '@/shared/components/Icons';
import { PersistentDiagnosisWorldProvider } from '@/shared/components/PersistentDiagnosisWorldShell';
import { DIAGNOSIS_CORRIDOR_LINK_STATE, isDiagnosisShellPath } from '@/shared/lib/diagnosisCorridor';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformChrome } from '@/shared/lib/services/platformAdminContentService';
import { SERVICE_TAGLINE, SITE_NAME, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const primaryNavigationLinks = [
  { label: '서비스', to: '/' },
  { label: '기능', to: '/features' },
  { label: '요금제', to: '/pricing' },
  { label: '고객 사례', to: '/cases' },
] as const;

const resourceLinks = [
  { label: '공지사항', to: '/notices' },
  { label: '업데이트', to: '/updates' },
  { label: 'FAQ', to: '/faq' },
  { label: '신뢰센터', to: '/trust' },
  { label: '문의하기', to: '/contact' },
] as const;

const mobileNavigationLinks = [...primaryNavigationLinks, ...resourceLinks] as const;

function getPopupDismissKey(popupKey: string, policy?: string | null) {
  if (policy === 'once_per_day') {
    return `mybiz:popup:${popupKey}:${new Date().toISOString().slice(0, 10)}`;
  }

  return `mybiz:popup:${popupKey}`;
}

function readDismissedPopup(popupKey: string, policy?: string | null) {
  if (typeof window === 'undefined') return false;
  const key = getPopupDismissKey(popupKey, policy);
  if (policy === 'once_per_session') return window.sessionStorage.getItem(key) === '1';
  return window.localStorage.getItem(key) === '1';
}

function writeDismissedPopup(popupKey: string, policy?: string | null) {
  if (typeof window === 'undefined') return;
  const key = getPopupDismissKey(popupKey, policy);
  if (policy === 'once_per_session') {
    window.sessionStorage.setItem(key, '1');
    return;
  }
  window.localStorage.setItem(key, '1');
}

// Paths that use dark-content pages — header should match
const DARK_SURFACE_PATHS = [
  '/demo/dashboard',
  '/features',
  '/faq',
  '/trust',
  '/contact',
  '/notices',
  '/updates',
];

export function PublicLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isDiagnosisShell = isDiagnosisShellPath(location.pathname);
  const shouldHidePublicChrome = isDiagnosisShell && !isLandingPage;
  const isPublicCinematicSurface = isDiagnosisShell;
  const isDarkSurface =
    isLandingPage ||
    DARK_SURFACE_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
  const hasMybiCompanion =
    !location.pathname.startsWith('/login') &&
    ENABLE_MYBI_COMPANION &&
    !isPublicCinematicSurface;

  const chromeQuery = useQuery({
    queryKey: queryKeys.publicPlatformChrome(location.pathname),
    queryFn: () => getPublicPlatformChrome(location.pathname),
    enabled: !shouldHidePublicChrome,
  });
  const chrome = chromeQuery.data || { banners: [], popups: [] };
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  useEffect(() => {
    setDismissedKeys([]);
  }, [location.pathname]);

  const visiblePopup = chrome.popups.find((popup) => {
    const popupKey = popup.popup_key || popup.id;
    if (!popupKey || popup.status !== 'published' || !popup.is_active) return false;
    if (dismissedKeys.includes(popupKey)) return false;
    if (popup.frequency_policy !== 'always' && readDismissedPopup(popupKey, popup.frequency_policy)) return false;
    return true;
  });

  function dismissPopup() {
    if (!visiblePopup) return;
    const popupKey = visiblePopup.popup_key || visiblePopup.id;
    if (!popupKey) return;
    if (visiblePopup.frequency_policy !== 'always') {
      writeDismissedPopup(popupKey, visiblePopup.frequency_policy);
    }
    setDismissedKeys((current) => [...current, popupKey]);
  }

  return (
    <PersistentDiagnosisWorldProvider active={hasMybiCompanion} pathname={location.pathname}>
      <div
        className={`flex min-h-screen flex-col ${
          shouldHidePublicChrome
            ? 'bg-[#03050a] text-white'
            : isDarkSurface
              ? 'bg-[#03040a] text-white'
              : 'bg-[#f6f2ea] text-slate-900'
        }`}
        data-public-shell-theme={shouldHidePublicChrome ? 'diagnosis' : isDarkSurface ? 'dark' : 'default'}
      >
        {shouldHidePublicChrome ? null : (
          <>
            {chrome.banners.map((banner) => (
              <div
                key={banner.id || banner.banner_key}
                className={`border-b px-4 py-2 text-center text-sm font-bold ${isDarkSurface ? 'border-white/10 bg-white/[0.04] text-white/70' : 'border-orange-200 bg-orange-50 text-orange-900'}`}
              >
                <span>{banner.message}</span>
                {banner.cta_href ? (
                  <Link
                    className={`ml-3 underline underline-offset-4 ${isDarkSurface ? 'decoration-white/30' : 'decoration-orange-400'}`}
                    to={banner.cta_href}
                  >
                    {banner.cta_label || '자세히 보기'}
                  </Link>
                ) : null}
              </div>
            ))}

            <header
              className={`sticky top-0 z-40 backdrop-blur-xl ${
                isDarkSurface
                  ? 'border-b border-white/[0.07] bg-[#03040a]/90'
                  : 'border-b border-slate-200/80 bg-[#f6f2ea]/90'
              }`}
            >
              <div className="page-shell py-3 sm:py-4">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <Link className="flex min-w-0 items-center gap-3" to="/">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-500/20">
                      <Icons.Store size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate font-display text-xl font-black ${isDarkSurface ? 'text-white' : 'text-slate-900'}`}>{SITE_NAME}</p>
                      <p className={`hidden truncate text-xs xl:block ${isDarkSurface ? 'text-white/40' : 'text-slate-500'}`}>{SERVICE_TAGLINE}</p>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2 lg:gap-3">
                    <nav
                      className={`hidden flex-wrap items-center gap-2 text-sm font-semibold lg:flex ${isDarkSurface ? 'text-white/55' : 'text-slate-600'}`}
                      data-homepage-nav={isLandingPage ? 'primary' : undefined}
                    >
                      {primaryNavigationLinks.map((item) => (
                        <NavLink
                          key={item.to}
                          className={({ isActive }) =>
                            isDarkSurface
                              ? ['rounded-full px-3 py-2 transition', isActive && !item.to.includes('#') ? 'bg-white/10 text-white' : 'hover:bg-white/[0.08] hover:text-white'].join(' ')
                              : ['rounded-full px-3 py-2 transition', isActive && !item.to.includes('#') ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/70 hover:text-slate-900'].join(' ')
                          }
                          to={item.to}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                      <details className="group relative">
                        <summary className={`list-none rounded-full px-3 py-2 transition ${isDarkSurface ? 'hover:bg-white/[0.08] hover:text-white' : 'hover:bg-white/70 hover:text-slate-900'}`}>
                          리소스
                        </summary>
                        <div className={`absolute right-0 z-50 mt-2 min-w-44 rounded-2xl border p-2 shadow-xl ${isDarkSurface ? 'border-white/10 bg-[#0d1525]' : 'border-slate-200 bg-white'}`}>
                          {resourceLinks.map((item) => (
                            <Link
                              key={item.to}
                              className={`block rounded-xl px-3 py-2 text-sm font-bold ${isDarkSurface ? 'text-white/55 hover:bg-white/[0.07] hover:text-white' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'}`}
                              to={item.to}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </details>
                    </nav>

                    <details className="group relative lg:hidden">
                      <summary
                        aria-label="Open navigation"
                        className={`flex h-10 w-10 list-none items-center justify-center rounded-2xl border text-[0px] ${
                          isDarkSurface
                            ? 'border-white/15 bg-white/[0.06] text-white/75'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <Icons.Menu size={18} />
                        메뉴
                      </summary>
                      <div
                        className={`absolute right-0 z-50 mt-2 grid min-w-44 gap-1 rounded-2xl border p-2 shadow-xl ${
                          isDarkSurface ? 'border-white/10 bg-[#0d1525]' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {mobileNavigationLinks.map((item) => (
                          <Link
                            key={item.to}
                            className={`block rounded-xl px-3 py-2 text-sm font-bold ${
                              isDarkSurface
                                ? 'text-white/65 hover:bg-white/[0.07] hover:text-white'
                                : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                            }`}
                            to={item.to}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </details>

                    <div className="flex shrink-0 items-center gap-2 lg:gap-3">
                      <Link
                        className={isDarkSurface
                          ? 'hidden items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white/65 transition hover:border-white/25 hover:text-white sm:inline-flex'
                          : 'hidden sm:inline-flex btn-secondary'}
                        to="/login?next=/dashboard"
                      >
                        로그인
                      </Link>

                      <Link className="btn-primary !min-h-10 shrink-0 !rounded-2xl !px-3 !py-2 text-xs sm:!min-h-[2.75rem] sm:!px-4 sm:!py-2.5 sm:text-sm" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                        무료로 시작하기
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </header>
          </>
        )}

        <div className="flex-1">
          <Outlet />
        </div>

        {visiblePopup ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm sm:items-center">
            <section className="w-full max-w-lg rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl">
              {visiblePopup.image_url ? (
                <img alt={visiblePopup.title} className="mb-4 max-h-56 w-full rounded-3xl object-cover" src={visiblePopup.image_url} />
              ) : null}
              <p className="eyebrow">MyBiz 안내</p>
              <h2 className="mt-2 font-display text-2xl font-black text-slate-950">{visiblePopup.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{visiblePopup.body}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {visiblePopup.cta_href ? (
                  <Link className="btn-primary" onClick={dismissPopup} to={visiblePopup.cta_href}>
                    {visiblePopup.cta_label || '자세히 보기'}
                  </Link>
                ) : null}
                {visiblePopup.dismissible ? (
                  <button className="btn-secondary" onClick={dismissPopup} type="button">
                    닫기
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {isDiagnosisShell && !isLandingPage ? null : <AppFooter />}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: isDarkSurface ? '#1a1a2e' : undefined,
              border: isDarkSurface ? '1px solid rgba(236,91,19,0.3)' : undefined,
              color: isDarkSurface ? '#fff' : undefined,
            },
          }}
        />
      </div>
    </PersistentDiagnosisWorldProvider>
  );
}
