import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { createDemoAdminSession, sanitizeAdminNextPath, useAdminSessionStore } from '@/shared/lib/adminSession';
import { LEGAL_LINKS } from '@/shared/lib/siteConfig';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useAdminSessionStore((state) => state.session);
  const setSession = useAdminSessionStore((state) => state.setSession);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = sanitizeAdminNextPath(searchParams.get('next'));

  usePageMeta('관리자 로그인', '마이비즈랩 관리자 로그인 페이지입니다. 홈페이지와 공개 스토어와 분리된 관리자 접근 경로를 제공합니다.');

  if (session) {
    return <Navigate replace to={nextPath} />;
  }

  async function handleDemoSignIn() {
    try {
      setIsSubmitting(true);
      setError(null);
      const nextSession = await createDemoAdminSession();
      setSession(nextSession);
      navigate(nextPath, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '관리자 세션을 시작하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-8 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.85)] sm:px-10 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.18),_transparent_25%)]" />
          <div className="relative space-y-6">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              Admin access
            </span>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">관리자 로그인</h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                `/` 는 방문자용 홈페이지이고, `/login` 은 관리자 전용 진입점입니다. 대시보드와 공개 스토어 흐름을 명확히 분리했습니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">Landing</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">홈페이지에서 서비스 소개와 App Explorer를 먼저 보여주고, 로그인은 별도 경로에서만 실행합니다.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">Dashboard</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">관리자 세션을 시작하면 `/dashboard` 로 이동하고 store_id 기준 앱 데이터를 불러옵니다.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card p-8 sm:p-10">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-100 text-orange-700">
                <Icons.Dashboard size={26} />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-black tracking-tight text-slate-900">운영 콘솔 입장</h2>
                <p className="text-sm leading-6 text-slate-500">현재는 mock/local 기반 데모 세션으로 접근을 분리해 두었고, 이후 실제 인증/결제 흐름을 연결할 수 있습니다.</p>
              </div>
            </div>

            <div className="space-y-4">
              <button className="btn-primary w-full justify-center" disabled={isSubmitting} onClick={handleDemoSignIn} type="button">
                {isSubmitting ? '세션 준비 중...' : '관리자 로그인 후 대시보드 열기'}
              </button>
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">정책 문서</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LEGAL_LINKS.map((link) => (
                    <Link key={link.href} className="btn-secondary !px-3 !py-2" to={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="btn-secondary" to="/">
                홈페이지로 돌아가기
              </Link>
              <Link className="btn-secondary" to="/pricing">
                요금제 보기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
