import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/lib/queryKeys';
import { getPlatformAdminSession } from '@/shared/lib/services/platformAdminContentService';

export function RequirePlatformAdminAuth() {
  const location = useLocation();
  const sessionQuery = useQuery({
    queryKey: queryKeys.platformAdminSession,
    queryFn: getPlatformAdminSession,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return (
      <main className="page-shell py-16">
        <div className="section-card p-8 text-center">
          <p className="text-sm font-bold text-slate-500">플랫폼 관리자 권한을 확인하는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (sessionQuery.isError) {
    const message =
      sessionQuery.error instanceof Error
        ? sessionQuery.error.message
        : '플랫폼 관리자 권한 확인에 실패했습니다.';

    if (/로그인|토큰|인증|401|Authorization/i.test(message)) {
      return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} />;
    }

    return (
      <main className="page-shell py-16">
        <div className="section-card mx-auto max-w-2xl p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">접근 제한</p>
          <h1 className="mt-3 font-display text-3xl font-black text-slate-950">
            플랫폼 관리자 권한이 필요합니다
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            이 화면은 MyBiz 운영자가 홈페이지, 가격표, 결제 상품, 공지, 팝업, 배너를 관리하는 콘솔입니다.
            점주 운영 화면의 store_members 권한과 분리되어 있습니다.
          </p>
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p>
        </div>
      </main>
    );
  }

  return <Outlet context={sessionQuery.data} />;
}
