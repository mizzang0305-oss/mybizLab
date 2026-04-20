import { Outlet, useLocation } from 'react-router-dom';

import { PersistentDiagnosisWorldProvider } from '@/shared/components/PersistentDiagnosisWorldShell';

export function PublicCompanionLayout() {
  const location = useLocation();

  return (
    <PersistentDiagnosisWorldProvider active pathname={location.pathname}>
      <Outlet />
    </PersistentDiagnosisWorldProvider>
  );
}
