import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { hasDashboardAccess, useAdminAccess } from '@/shared/lib/adminSession';

export function RequireAdminAuth() {
  const { isLoading, session } = useAdminAccess();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-shell py-14 text-sm text-slate-500">매장 운영 권한을 확인하는 중입니다...</div>;
  }

  if (!session) {
    const nextPath = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate replace to={`/login?next=${nextPath}`} />;
  }

  if (!hasDashboardAccess(session)) {
    return <Navigate replace to="/login?reason=forbidden" />;
  }

  return <Outlet />;
}
