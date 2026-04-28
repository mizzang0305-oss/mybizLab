import { Outlet, useLocation } from 'react-router-dom';

import { PersistentDiagnosisWorldProvider } from '@/shared/components/PersistentDiagnosisWorldShell';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';

export function PublicCompanionLayout() {
  const location = useLocation();

  return (
    <PersistentDiagnosisWorldProvider active={ENABLE_MYBI_COMPANION} pathname={location.pathname}>
      <Outlet />
    </PersistentDiagnosisWorldProvider>
  );
}
