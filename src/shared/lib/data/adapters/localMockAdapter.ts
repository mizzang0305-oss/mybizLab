import { buildDiagnosisSessionRecord } from '@/shared/lib/diagnosisSessionRecord';
import { getDatabase, updateDatabase } from '@/shared/lib/mockDb';
import type { DemoDataAdapterDescriptor, ResolveAdminAccessInput } from '@/shared/lib/data/contracts';
import { getCurrentProfile, listAccessibleStores } from '@/shared/lib/services/mvpService';

export const localMockAdapter: DemoDataAdapterDescriptor = {
  description: 'Uses bundled seed data plus browser localStorage/sessionStorage for demo-safe offline flows.',
  id: 'local',
  isConfigured: () => true,
  label: 'Local mock',
  saveDiagnosisSession: async (input) => {
    const record = buildDiagnosisSessionRecord(input);

    updateDatabase((database) => {
      database.diagnosis_sessions = [record, ...database.diagnosis_sessions.filter((session) => session.id !== record.id)];
    });

    return record;
  },
  resolveAdminAccess: async (input: ResolveAdminAccessInput) => {
    const [profile, accessibleStores] = await Promise.all([getCurrentProfile(), listAccessibleStores()]);
    const database = getDatabase();
    const normalizedEmail = (input.requestedEmail || profile?.email || input.fallbackEmail).trim().toLowerCase();
    const adminUser =
      database.admin_users.find((item) => item.email.toLowerCase() === normalizedEmail) ||
      database.admin_users.find((item) => item.profile_id === profile?.id) ||
      database.admin_users.find((item) => item.role === 'platform_owner') ||
      null;

    return {
      accessibleStores,
      email: normalizedEmail,
      fullName: input.requestedFullName?.trim() || profile?.full_name || input.fallbackFullName,
      profileId: profile?.id || input.fallbackProfileId,
      provider: 'local',
      role: adminUser?.role || 'platform_owner',
    };
  },
};
