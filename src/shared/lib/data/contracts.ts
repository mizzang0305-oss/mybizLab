/**
 * @deprecated Phase 1 introduces src/shared/lib/repositories as the canonical
 * repository boundary. Keep this demo adapter contract only for legacy flows
 * until remaining onboarding helpers are migrated.
 */
import type { DiagnosisInput, DiagnosisResult } from '@/shared/lib/onboardingFlow';
import type { AdminUserRole, DiagnosisSession, Store } from '@/shared/types/models';

export type DemoDataAdapterId = 'local' | 'firebase';

export interface ResolveAdminAccessInput {
  fallbackEmail: string;
  fallbackFullName: string;
  fallbackProfileId: string;
  requestedEmail?: string;
  requestedFullName?: string;
}

export interface ResolvedAdminAccess {
  accessibleStores: Store[];
  email: string;
  fullName: string;
  profileId: string;
  provider: DemoDataAdapterId;
  role: AdminUserRole;
}

export interface SaveDiagnosisSessionInput {
  diagnosisInput: DiagnosisInput;
  diagnosisResult: DiagnosisResult;
  visitorKey?: string;
}

export interface DemoDataAdapterDescriptor {
  description: string;
  id: DemoDataAdapterId;
  isConfigured: () => boolean;
  label: string;
  resolveAdminAccess: (input: ResolveAdminAccessInput) => Promise<ResolvedAdminAccess | null>;
  saveDiagnosisSession: (input: SaveDiagnosisSessionInput) => Promise<DiagnosisSession | null>;
}
