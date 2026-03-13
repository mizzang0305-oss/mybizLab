import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAdminSessionStore } from '@/shared/lib/adminSession';

export function RequireAdminAuth() {
  const session = useAdminSessionStore((state) => state.session);
  const location = useLocation();

  if (!session) {
    const nextPath = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate replace to={`/login?next=${nextPath}`} />;
  }

  return <Outlet />;
}
