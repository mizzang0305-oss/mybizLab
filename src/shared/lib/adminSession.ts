import { create } from 'zustand';

import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from '@/shared/lib/appConfig';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import { useUiStore } from '@/shared/lib/uiStore';
import type { StoreMember } from '@/shared/types/models';

const STORAGE_KEY = 'mybizlab:admin-session';
const DEFAULT_NEXT_PATH = '/dashboard';
const FALLBACK_PROFILE_ID = 'profile_platform_owner';
const FALLBACK_FULL_NAME = '운영 관리자';
const DASHBOARD_ACCESS_ROLES: StoreMember['role'][] = ['owner', 'manager', 'staff'];

export const DEMO_ADMIN_CREDENTIALS = {
  email: DEMO_ADMIN_EMAIL,
  password: DEMO_ADMIN_PASSWORD,
} as const;

export interface AdminSession {
  accessibleStoreIds: string[];
  authenticatedAt: string;
  email: string;
  fullName: string;
  profileId: string;
  provider: 'demo' | 'supabase';
  role: StoreMember['role'];
}

interface AdminSessionState {
  session: AdminSession | null;
  setSession: (session: AdminSession | null) => void;
  signOut: () => void;
}

interface CreateDemoAdminSessionOptions {
  email?: string;
  fullName?: string;
}

function normalizeAdminDisplayName(fullName?: string | null) {
  if (!fullName?.trim() || fullName === 'Platform Owner') {
    return FALLBACK_FULL_NAME;
  }

  return fullName.trim();
}

function normalizeSession(value: Partial<AdminSession> | null | undefined) {
  if (!value?.profileId || !value.email) {
    return null;
  }

  const role = value.role && DASHBOARD_ACCESS_ROLES.includes(value.role) ? value.role : 'owner';

  return {
    accessibleStoreIds: Array.isArray(value.accessibleStoreIds) ? value.accessibleStoreIds : [],
    authenticatedAt: value.authenticatedAt || new Date().toISOString(),
    email: value.email,
    fullName: normalizeAdminDisplayName(value.fullName),
    profileId: value.profileId,
    provider: value.provider === 'supabase' ? 'supabase' : 'demo',
    role,
  } satisfies AdminSession;
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeSession(JSON.parse(raw) as Partial<AdminSession>);
  } catch {
    return null;
  }
}

function persistSession(session: AdminSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  session: readStoredSession(),
  setSession: (session) => {
    const normalized = normalizeSession(session);
    persistSession(normalized);
    set({ session: normalized });
  },
  signOut: () => {
    persistSession(null);
    useUiStore.getState().setSelectedStoreId(undefined);
    set({ session: null });
  },
}));

export async function createDemoAdminSession(options: CreateDemoAdminSessionOptions = {}) {
  const repository = getCanonicalMyBizRepository();
  const resolvedAccess = await repository.resolveStoreAccess({
    fallbackEmail: DEMO_ADMIN_CREDENTIALS.email,
    fallbackFullName: FALLBACK_FULL_NAME,
    fallbackProfileId: FALLBACK_PROFILE_ID,
    requestedEmail: options.email,
    requestedFullName: options.fullName,
  });

  const nextSession =
    normalizeSession(
      resolvedAccess
        ? {
            accessibleStoreIds: resolvedAccess.accessibleStores.map((store) => store.id),
            authenticatedAt: new Date().toISOString(),
            email: resolvedAccess.email,
            fullName: resolvedAccess.fullName,
            profileId: resolvedAccess.profile.id,
            provider: resolvedAccess.provider,
            role: resolvedAccess.primaryRole || 'owner',
          }
        : {
            accessibleStoreIds: [],
            authenticatedAt: new Date().toISOString(),
            email: options.email?.trim().toLowerCase() || DEMO_ADMIN_CREDENTIALS.email,
            fullName: options.fullName || FALLBACK_FULL_NAME,
            profileId: FALLBACK_PROFILE_ID,
            provider: 'demo',
            role: 'owner',
          },
    ) || {
      accessibleStoreIds: [],
      authenticatedAt: new Date().toISOString(),
      email: DEMO_ADMIN_CREDENTIALS.email,
      fullName: FALLBACK_FULL_NAME,
      profileId: FALLBACK_PROFILE_ID,
      provider: 'demo',
      role: 'owner',
    };

  useUiStore.getState().setSelectedStoreId(nextSession.accessibleStoreIds[0]);

  return nextSession;
}

export function sanitizeAdminNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//') || nextPath.startsWith('/login')) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}

export function isDemoPasswordLoginEnabled() {
  return Boolean(DEMO_ADMIN_CREDENTIALS.password);
}

export function hasDashboardAccess(session: AdminSession | null | undefined) {
  return Boolean(session && session.accessibleStoreIds.length && DASHBOARD_ACCESS_ROLES.includes(session.role));
}
