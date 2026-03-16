import { create } from 'zustand';

import { getCurrentProfile, listAccessibleStores } from '@/shared/lib/services/mvpService';
import { useUiStore } from '@/shared/lib/uiStore';

const STORAGE_KEY = 'mybizlab:admin-session';
const DEFAULT_NEXT_PATH = '/dashboard';
const FALLBACK_PROFILE_ID = 'profile_platform_owner';
const FALLBACK_FULL_NAME = '운영 관리자';

export const DEMO_ADMIN_CREDENTIALS = {
  email: 'demo@mybizlab.ai',
  password: 'demo123',
} as const;

export interface AdminSession {
  profileId: string;
  email: string;
  fullName: string;
  authenticatedAt: string;
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

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.profileId || !parsed?.email) {
      return null;
    }

    return parsed;
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

function normalizeAdminDisplayName(fullName?: string | null) {
  if (!fullName?.trim() || fullName === 'Platform Owner') {
    return FALLBACK_FULL_NAME;
  }

  return fullName.trim();
}

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  session: readStoredSession(),
  setSession: (session) => {
    persistSession(session);
    set({ session });
  },
  signOut: () => {
    persistSession(null);
    useUiStore.getState().setSelectedStoreId(undefined);
    set({ session: null });
  },
}));

export async function createDemoAdminSession(options: CreateDemoAdminSessionOptions = {}) {
  let profile: Awaited<ReturnType<typeof getCurrentProfile>> = null;
  let stores: Awaited<ReturnType<typeof listAccessibleStores>> = [];

  try {
    [profile, stores] = await Promise.all([getCurrentProfile(), listAccessibleStores()]);
  } catch {
    profile = null;
    stores = [];
  }

  useUiStore.getState().setSelectedStoreId(stores[0]?.id);

  return {
    profileId: profile?.id || FALLBACK_PROFILE_ID,
    email: options.email?.trim() || profile?.email || DEMO_ADMIN_CREDENTIALS.email,
    fullName: normalizeAdminDisplayName(options.fullName || profile?.full_name),
    authenticatedAt: new Date().toISOString(),
  } satisfies AdminSession;
}

export function sanitizeAdminNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//') || nextPath.startsWith('/login')) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}
