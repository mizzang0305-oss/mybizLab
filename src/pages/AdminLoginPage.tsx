import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { createDemoAdminSession, sanitizeAdminNextPath, useAdminSessionStore } from '@/shared/lib/adminSession';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useAdminSessionStore((state) => state.session);
  const setSession = useAdminSessionStore((state) => state.setSession);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = sanitizeAdminNextPath(searchParams.get('next'));

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
                루트 홈페이지와 공개 스토어는 일반 방문자에게 열려 있고, 운영 대시보드는 별도 관리자 로그인 경로에서만 진입합니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">Public home</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">`/` 에서 랜딩 페이지를 보여주고, 스토어 공개 페이지는 `/:storeSlug` 구조로 동작합니다.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">Admin console</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">`/login` 또는 `/admin/login` 에서만 관리자 세션을 시작한 뒤 `/dashboard` 로 이동합니다.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">mybiz.ai.kr</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">mybiz.ai.kr/{'{storeSlug}'}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">mybiz.ai.kr/dashboard</span>
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
                <p className="text-sm leading-6 text-slate-500">
                  현재 프로젝트에는 정식 백엔드 인증이 없어 MVP용 관리자 세션으로 대시보드 접근을 분리했습니다.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button className="btn-primary w-full justify-center" disabled={isSubmitting} onClick={handleDemoSignIn} type="button">
                {isSubmitting ? '세션 준비 중...' : '관리자 로그인 후 대시보드 열기'}
              </button>
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">접근 규칙</p>
                <p className="mt-2 leading-6">비로그인 상태에서 `/dashboard` 로 접근하면 현재 페이지를 보존한 채 `/login` 으로 리다이렉트됩니다.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="btn-secondary" to="/">
                홈페이지로 돌아가기
              </Link>
              <Link className="btn-secondary" to="/onboarding">
                스토어 등록 보기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
