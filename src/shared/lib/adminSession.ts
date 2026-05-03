import { useEffect } from 'react';
import { create } from 'zustand';

import { supabase } from '../../integrations/supabase/client.js';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, IS_DEMO_RUNTIME } from './appConfig.js';
import { getDatabase } from './mockDb.js';
import { getCanonicalMyBizRepository } from './repositories/index.js';
import { resolveServerApiUrl } from './serverApiUrl.js';
import { useUiStore } from './uiStore.js';
import type { Store, StoreMember } from '../types/models.js';

const DEFAULT_NEXT_PATH = '/dashboard';
const DEMO_STORE_ORDER = ['store_golden_coffee', 'store_mint_bbq', 'store_seoul_buffet'] as const;
const FALLBACK_PROFILE_ID = 'profile_platform_owner';
const FALLBACK_FULL_NAME = '운영 관리자';
const DASHBOARD_ACCESS_ROLES: StoreMember['role'][] = ['owner', 'manager', 'staff'];

export const DEMO_ADMIN_CREDENTIALS = {
  email: DEMO_ADMIN_EMAIL,
  password: DEMO_ADMIN_PASSWORD,
} as const;

export interface AdminSession {
  accessibleStoreIds: string[];
  accessibleStores: Store[];
  authenticatedAt: string;
  email: string;
  fullName: string;
  memberships: StoreMember[];
  profileId: string;
  provider: 'demo' | 'supabase';
  role: StoreMember['role'];
}

type AdminSessionStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'forbidden'
  | 'error';

interface AdminSessionState {
  error: string | null;
  session: AdminSession | null;
  status: AdminSessionStatus;
  setError: (error: string | null) => void;
  setSession: (session: AdminSession | null) => void;
  setStatus: (status: AdminSessionStatus) => void;
}

interface CreateDemoAdminSessionOptions {
  email?: string;
  fullName?: string;
}

class AdminAccessError extends Error {
  code: 'forbidden' | 'unauthenticated';

  constructor(code: 'forbidden' | 'unauthenticated', message: string) {
    super(message);
    this.code = code;
  }
}

function normalizeAdminDisplayName(fullName?: string | null) {
  if (!fullName?.trim() || fullName === 'Platform Owner') {
    return FALLBACK_FULL_NAME;
  }

  return fullName.trim();
}

function normalizeRole(role: StoreMember['role'] | null | undefined) {
  return role && DASHBOARD_ACCESS_ROLES.includes(role) ? role : 'owner';
}

function normalizeSession(value: Partial<AdminSession> | null | undefined) {
  if (!value?.profileId || !value.email) {
    return null;
  }

  return {
    accessibleStoreIds: Array.isArray(value.accessibleStoreIds) ? value.accessibleStoreIds : [],
    accessibleStores: Array.isArray(value.accessibleStores) ? value.accessibleStores : [],
    authenticatedAt: value.authenticatedAt || new Date().toISOString(),
    email: value.email,
    fullName: normalizeAdminDisplayName(value.fullName),
    memberships: Array.isArray(value.memberships) ? value.memberships : [],
    profileId: value.profileId,
    provider: value.provider === 'supabase' ? 'supabase' : 'demo',
    role: normalizeRole(value.role),
  } satisfies AdminSession;
}

function getDemoStoreOperationalScore(storeId: string) {
  const database = getDatabase();
  let score = 0;

  if (database.customers.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.inquiries.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.reservations.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.sales_daily.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.ai_reports.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  return score;
}

function compareDemoStoresByDashboardReady(left: Store, right: Store) {
  const leftDemoIndex = DEMO_STORE_ORDER.indexOf(left.id as (typeof DEMO_STORE_ORDER)[number]);
  const rightDemoIndex = DEMO_STORE_ORDER.indexOf(right.id as (typeof DEMO_STORE_ORDER)[number]);

  if (leftDemoIndex >= 0 && rightDemoIndex >= 0 && leftDemoIndex !== rightDemoIndex) {
    return leftDemoIndex - rightDemoIndex;
  }

  const scoreDelta = getDemoStoreOperationalScore(right.id) - getDemoStoreOperationalScore(left.id);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  if (left.public_status !== right.public_status) {
    return left.public_status === 'public' ? -1 : 1;
  }

  return right.created_at.localeCompare(left.created_at);
}

function orderAccessibleStores(stores: Store[], provider: 'demo' | 'supabase') {
  if (provider !== 'demo') {
    return stores;
  }

  return stores.slice().sort(compareDemoStoresByDashboardReady);
}

function setSelectedStoreFromSession(session: AdminSession | null) {
  if (!session?.accessibleStoreIds.length) {
    useUiStore.getState().setSelectedStoreId(undefined);
    return;
  }

  const currentSelectedStoreId = useUiStore.getState().selectedStoreId;
  if (currentSelectedStoreId && session.accessibleStoreIds.includes(currentSelectedStoreId)) {
    return;
  }

  useUiStore.getState().setSelectedStoreId(session.accessibleStoreIds[0]);
}

let demoSessionCache: AdminSession | null = null;

function applySessionState(session: AdminSession | null, status: AdminSessionStatus, error: string | null = null) {
  const normalized = normalizeSession(session);
  setSelectedStoreFromSession(normalized);
  useAdminSessionStore.setState({
    error,
    session: normalized,
    status,
  });
  return normalized;
}

async function resolveSupabaseAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Supabase session lookup failed: ${error.message}`);
  }

  return data.session?.access_token || null;
}

async function requestServerValidatedAdminSession(accessToken: string) {
  const response = await fetch(resolveServerApiUrl('/api/auth/session'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'GET',
  });
  const rawText = await response.text();
  const payload = rawText
    ? (JSON.parse(rawText) as { data?: AdminSession; error?: string; message?: string })
    : {};

  if (response.status === 401) {
    return null;
  }

  if (response.status === 403) {
    throw new AdminAccessError('forbidden', payload.error || payload.message || 'Store membership is required.');
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Admin session request failed with ${response.status}.`);
  }

  return normalizeSession((payload.data ?? payload) as Partial<AdminSession>);
}

function buildSessionFromAccess(input: {
  accessibleStores: Store[];
  authenticatedAt?: string;
  email: string;
  fullName?: string;
  memberships: StoreMember[];
  profileId: string;
  provider: 'demo' | 'supabase';
  role?: StoreMember['role'] | null;
}) {
  const accessibleStores = orderAccessibleStores(input.accessibleStores, input.provider);

  return normalizeSession({
    accessibleStoreIds: accessibleStores.map((store) => store.id),
    accessibleStores,
    authenticatedAt: input.authenticatedAt || new Date().toISOString(),
    email: input.email,
    fullName: input.fullName,
    memberships: input.memberships,
    profileId: input.profileId,
    provider: input.provider,
    role: input.role || 'owner',
  });
}

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  error: null,
  session: null,
  status: 'idle',
  setError: (error) => set({ error }),
  setSession: (session) => {
    applySessionState(session, session ? 'authenticated' : 'unauthenticated');
  },
  setStatus: (status) => set({ status }),
}));

export async function createDemoAdminSession(options: CreateDemoAdminSessionOptions = {}) {
  if (!IS_DEMO_RUNTIME) {
    throw new Error('Demo admin access is available only in explicit demo runtime.');
  }

  const repository = getCanonicalMyBizRepository();
  const resolvedAccess = await repository.resolveStoreAccess({
    fallbackEmail: DEMO_ADMIN_CREDENTIALS.email,
    fallbackFullName: FALLBACK_FULL_NAME,
    fallbackProfileId: FALLBACK_PROFILE_ID,
    requestedEmail: options.email,
    requestedFullName: options.fullName,
  });

  demoSessionCache =
    buildSessionFromAccess({
      accessibleStores: resolvedAccess?.accessibleStores || [],
      email: resolvedAccess?.email || options.email?.trim().toLowerCase() || DEMO_ADMIN_CREDENTIALS.email,
      fullName: resolvedAccess?.fullName || options.fullName || FALLBACK_FULL_NAME,
      memberships: resolvedAccess?.memberships || [],
      profileId: resolvedAccess?.profile.id || FALLBACK_PROFILE_ID,
      provider: 'demo',
      role: resolvedAccess?.primaryRole || 'owner',
    }) || null;

  useUiStore.getState().setSelectedStoreId(undefined);
  return applySessionState(demoSessionCache, demoSessionCache ? 'authenticated' : 'unauthenticated');
}

export async function refreshAdminSession() {
  useAdminSessionStore.setState({ error: null, status: 'loading' });

  if (IS_DEMO_RUNTIME) {
    return applySessionState(demoSessionCache, demoSessionCache ? 'authenticated' : 'unauthenticated');
  }

  const accessToken = await resolveSupabaseAccessToken();
  if (!accessToken) {
    return applySessionState(null, 'unauthenticated');
  }

  try {
    const session = await requestServerValidatedAdminSession(accessToken);
    return applySessionState(session, session ? 'authenticated' : 'unauthenticated');
  } catch (error) {
    if (error instanceof AdminAccessError && error.code === 'forbidden') {
      return applySessionState(null, 'forbidden', error.message);
    }

    const message = error instanceof Error ? error.message : 'Admin session refresh failed.';
    useAdminSessionStore.setState({
      error: message,
      session: null,
      status: 'error',
    });
    throw error;
  }
}

export async function signOutAdminSession() {
  demoSessionCache = null;

  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Fall through and clear the local cache regardless of SDK errors.
    }
  }

  useUiStore.getState().setSelectedStoreId(undefined);
  applySessionState(null, 'unauthenticated');
}

export function useAdminAccess() {
  const session = useAdminSessionStore((state) => state.session);
  const status = useAdminSessionStore((state) => state.status);
  const error = useAdminSessionStore((state) => state.error);

  useEffect(() => {
    if (status !== 'idle') {
      return;
    }

    void refreshAdminSession().catch(() => {
      // The store captures the error state; callers can inspect it if needed.
    });
  }, [status]);

  return {
    error,
    isLoading: !session && (status === 'idle' || status === 'loading'),
    refreshSession: refreshAdminSession,
    session,
    signOut: signOutAdminSession,
    status,
  };
}

export function sanitizeAdminNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//') || nextPath.startsWith('/login')) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}

export function isPlatformAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/platform-admin' || pathname.startsWith('/platform-admin/');
}

export function isDemoPasswordLoginEnabled() {
  return Boolean(DEMO_ADMIN_CREDENTIALS.password);
}

export function hasDashboardAccess(session: AdminSession | null | undefined) {
  return Boolean(session && session.accessibleStoreIds.length && DASHBOARD_ACCESS_ROLES.includes(session.role));
}
