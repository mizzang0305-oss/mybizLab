import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { isDiagnosisShellPath } from '@/shared/lib/diagnosisCorridor';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformHomepageContent } from '@/shared/lib/services/platformAdminContentService';
import { BUSINESS_INFO, LEGAL_LINKS, SERVICE_DOMAIN, SERVICE_TAGLINE, SITE_NAME } from '@/shared/lib/siteConfig';

const DARK_FOOTER_PATHS = [
  '/demo/dashboard',
  '/features',
  '/faq',
  '/trust',
  '/contact',
  '/notices',
  '/updates',
];

export function AppFooter() {
  const location = useLocation();
  const isDiagnosisShell = isDiagnosisShellPath(location.pathname);
  const isDarkSurface =
    DARK_FOOTER_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
  const dark = isDiagnosisShell || isDarkSurface;
  const settingsQuery = useQuery({
    queryKey: queryKeys.publicPlatformHomepage,
    queryFn: getPublicPlatformHomepageContent,
    enabled: !dark,
  });
  const settings = settingsQuery.data?.settings;
  const footerLinks = settings?.footer_links?.length ? settings.footer_links : [
    { href: '/features', label: '기능' },
    { href: '/faq', label: 'FAQ' },
    { href: '/trust', label: '신뢰센터' },
    { href: '/contact', label: '문의하기' },
    ...LEGAL_LINKS,
  ];
  const supportEmail = settings?.support_email || BUSINESS_INFO.email;

  return (
    <footer
      className={[
        'mt-16 border-t',
        dark ? 'border-white/10 bg-[#04070d]' : 'border-slate-200/70 bg-white/75',
      ].join(' ')}
    >
      <div className="page-shell py-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr_1fr]">
          <div className="space-y-4">
            <div>
              <p className={`font-display text-xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{settings?.footer_company_name || SITE_NAME}</p>
              <p className={`mt-2 max-w-xl text-sm leading-6 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                {settings?.footer_business_info || SERVICE_TAGLINE}
              </p>
              <p className={`mt-1 text-sm ${dark ? 'text-slate-500' : 'text-slate-500'}`}>{SERVICE_DOMAIN}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Link
                className={
                  dark
                    ? 'btn-secondary !px-3 !py-2 border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                    : 'btn-secondary !px-3 !py-2'
                }
                to="/pricing"
              >
                요금제
              </Link>
              <Link
                className={
                  dark
                    ? 'btn-secondary !px-3 !py-2 border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                    : 'btn-secondary !px-3 !py-2'
                }
                to="/login?next=/dashboard"
              >
                점주 로그인
              </Link>
              <Link
                className={
                  dark
                    ? 'text-xs font-bold text-slate-500 transition hover:text-orange-300'
                    : 'text-xs font-bold text-slate-500 transition hover:text-orange-700'
                }
                to="/login?next=/admin"
              >
                플랫폼 관리자
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <p className={`text-sm font-bold uppercase tracking-[0.18em] ${dark ? 'text-slate-500' : 'text-slate-500'}`}>정책 및 안내</p>
            <div className={`flex flex-col gap-2 text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  className={dark ? 'transition hover:text-orange-300' : 'transition hover:text-orange-600'}
                  to={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className={`space-y-3 text-sm leading-6 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            <p className={`font-bold uppercase tracking-[0.18em] ${dark ? 'text-slate-500' : 'text-slate-500'}`}>사업자 정보</p>
            <p>상호명: {BUSINESS_INFO.companyName}</p>
            <p>대표자: {BUSINESS_INFO.representative}</p>
            <p>사업자등록번호: {BUSINESS_INFO.businessRegistrationNumber}</p>
            <p>통신판매업 신고번호: {BUSINESS_INFO.ecommerceRegistrationNumber}</p>
            <p>주소: {BUSINESS_INFO.address}</p>
            <p>고객센터: {BUSINESS_INFO.customerCenter}</p>
            <p>
              이메일:{' '}
              <a
                className={dark ? 'font-semibold text-orange-300 transition hover:text-orange-200' : 'font-semibold text-orange-700 transition hover:text-orange-800'}
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
