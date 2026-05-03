import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEMO_ADMIN_CREDENTIALS,
  createDemoAdminSession,
  isPlatformAdminPath,
  signOutAdminSession,
  useAdminSessionStore,
} from '@/shared/lib/adminSession';
import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { useUiStore } from '@/shared/lib/uiStore';

describe('admin session bootstrap', () => {
  beforeEach(() => {
    resetDatabase();
    useAdminSessionStore.setState({ error: null, session: null, status: 'idle' });
    useUiStore.setState({ selectedStoreId: 'store_mint_bbq', sidebarOpen: false });
  });

  it('selects the most dashboard-ready store after demo login', async () => {
    const session = await createDemoAdminSession();
    if (!session) {
      throw new Error('Expected a demo session to be created.');
    }

    expect(session.email).toBe('ops@mybiz.ai.kr');
    expect(session.role).toBe('owner');
    expect(session.provider).toBe('demo');
    expect(session.accessibleStoreIds).toContain('store_golden_coffee');
    expect(session.accessibleStores.some((store) => store.id === 'store_golden_coffee')).toBe(true);
    expect(useUiStore.getState().selectedStoreId).toBe('store_golden_coffee');
  });

  it('still creates a usable demo session when admin profile data needs bootstrapping', async () => {
    updateDatabase((database) => {
      database.profiles = [];
      database.admin_users = [];
      database.store_members = [];
    });

    const session = await createDemoAdminSession({ email: DEMO_ADMIN_CREDENTIALS.email });
    if (!session) {
      throw new Error('Expected a demo session to be created.');
    }

    expect(session.profileId).toBe('profile_platform_owner');
    expect(session.email).toBe(DEMO_ADMIN_CREDENTIALS.email);
    expect(session.role).toBe('owner');
    expect(useUiStore.getState().selectedStoreId).toBe('store_golden_coffee');
  });

  it('clears the selected store when signing out', async () => {
    useAdminSessionStore.setState({
      error: null,
      session: {
        accessibleStoreIds: ['store_golden_coffee'],
        accessibleStores: [],
        profileId: 'profile_platform_owner',
        email: DEMO_ADMIN_CREDENTIALS.email,
        fullName: '운영 관리자',
        authenticatedAt: '2026-03-16T00:00:00.000Z',
        memberships: [],
        provider: 'demo',
        role: 'owner',
      },
      status: 'authenticated',
    });

    await signOutAdminSession();

    expect(useAdminSessionStore.getState().session).toBeNull();
    expect(useUiStore.getState().selectedStoreId).toBeUndefined();
  });

  it('recognizes platform admin routes separately from merchant dashboard routes', () => {
    expect(isPlatformAdminPath('/admin')).toBe(true);
    expect(isPlatformAdminPath('/admin/payment-tests')).toBe(true);
    expect(isPlatformAdminPath('/platform-admin')).toBe(true);
    expect(isPlatformAdminPath('/platform-admin/settings')).toBe(true);
    expect(isPlatformAdminPath('/dashboard')).toBe(false);
    expect(isPlatformAdminPath('/login')).toBe(false);
  });
});
