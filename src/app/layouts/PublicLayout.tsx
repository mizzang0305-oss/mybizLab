import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AppFooter } from '@/shared/components/AppFooter';
import { Icons } from '@/shared/components/Icons';
import { PersistentDiagnosisWorldProvider } from '@/shared/components/PersistentDiagnosisWorldShell';
import { DIAGNOSIS_CORRIDOR_LINK_STATE, isDiagnosisShellPath } from '@/shared/lib/diagnosisCorridor';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformChrome } from '@/shared/lib/services/platformAdminContentService';
import { SERVICE_TAGLINE, SITE_NAME, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const navigationLinks = [
  { label: '소개', href: '/' },
  { label: '기능', href: '/features' },
  { label: '요금제', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
  { label: '신뢰와 보안', href: '/trust' },
  { label: '공지', href: '/notices' },
  { label: '문의', href: '/contact' },
  { label: '이용약관', href: '/terms' },
  { label: '개인정보', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

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

export function PublicLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isDiagnosisShell = isDiagnosisShellPath(location.pathname);
  const isPublicCinematicSurface = isDiagnosisShell;
  const hasMybiCompanion =
    !location.pathname.startsWith('/login') &&
    ENABLE_MYBI_COMPANION &&
    !isPublicCinematicSurface;

  const chromeQuery = useQuery({
    queryKey: queryKeys.publicPlatformChrome(location.pathname),
    queryFn: () => getPublicPlatformChrome(location.pathname),
    enabled: !isDiagnosisShell,
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
        className={`flex min-h-screen flex-col ${isDiagnosisShell ? 'bg-[#03050a] text-white' : 'bg-[#f6f2ea] text-slate-900'}`}
        data-public-shell-theme={isDiagnosisShell ? 'diagnosis' : 'default'}
      >
        {isDiagnosisShell ? null : (
          <>
            {chrome.banners.map((banner) => (
              <div key={banner.id || banner.banner_key} className="border-b border-orange-200 bg-orange-50 px-4 py-2 text-center text-sm font-bold text-orange-900">
                <span>{banner.message}</span>
                {banner.cta_href ? (
                  <Link className="ml-3 underline decoration-orange-400 underline-offset-4" to={banner.cta_href}>
                    {banner.cta_label || '자세히 보기'}
                  </Link>
                ) : null}
              </div>
            ))}

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
                        <a className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-slate-900" href="#services">서비스</a>
                        <a className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-slate-900" href="#features">기능</a>
                        <NavLink className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-slate-900" to="/pricing">요금제</NavLink>
                        <a className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-slate-900" href="#cases">고객 사례</a>
                        <NavLink className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-slate-900" to="/notices">리소스</NavLink>
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
                        점주 로그인
                      </Link>

                      <Link className="btn-primary" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                        공개 스토어 시작하기
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
      </div>
    </PersistentDiagnosisWorldProvider>
  );
}
