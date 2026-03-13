import { create } from 'zustand';

import { getCurrentProfile } from '@/shared/lib/services/mvpService';

const STORAGE_KEY = 'mybizlab:admin-session';
const DEFAULT_NEXT_PATH = '/dashboard';

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

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  session: readStoredSession(),
  setSession: (session) => {
    persistSession(session);
    set({ session });
  },
  signOut: () => {
    persistSession(null);
    set({ session: null });
  },
}));

export async function createDemoAdminSession() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Admin profile not found');
  }

  return {
    profileId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    authenticatedAt: new Date().toISOString(),
  } satisfies AdminSession;
}

export function sanitizeAdminNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}
