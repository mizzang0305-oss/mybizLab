import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { hasDashboardAccess, useAdminSessionStore } from '@/shared/lib/adminSession';

export function RequireAdminAuth() {
  const session = useAdminSessionStore((state) => state.session);
  const location = useLocation();

  if (!session) {
    const nextPath = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate replace to={`/login?next=${nextPath}`} />;
  }

  if (!hasDashboardAccess(session)) {
    return <Navigate replace to="/login?reason=forbidden" />;
  }

  return <Outlet />;
}
