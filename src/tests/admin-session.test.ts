import { beforeEach, describe, expect, it } from 'vitest';

import { DEMO_ADMIN_CREDENTIALS, createDemoAdminSession, useAdminSessionStore } from '@/shared/lib/adminSession';
import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { useUiStore } from '@/shared/lib/uiStore';

describe('admin session bootstrap', () => {
  beforeEach(() => {
    resetDatabase();
    useAdminSessionStore.setState({ session: null });
    useUiStore.setState({ selectedStoreId: 'store_mint_bbq', sidebarOpen: false });
  });

  it('selects the most dashboard-ready store after demo login', async () => {
    const session = await createDemoAdminSession();

    expect(session.email).toBe('ops@mybiz.ai.kr');
    expect(useUiStore.getState().selectedStoreId).toBe('store_golden_coffee');
  });

  it('still creates a usable demo session when admin profile data needs bootstrapping', async () => {
    updateDatabase((database) => {
      database.profiles = [];
      database.admin_users = [];
      database.store_members = [];
    });

    const session = await createDemoAdminSession({ email: DEMO_ADMIN_CREDENTIALS.email });

    expect(session.profileId).toBe('profile_platform_owner');
    expect(session.email).toBe(DEMO_ADMIN_CREDENTIALS.email);
    expect(useUiStore.getState().selectedStoreId).toBe('store_golden_coffee');
  });

  it('clears the selected store when signing out', () => {
    useAdminSessionStore.setState({
      session: {
        profileId: 'profile_platform_owner',
        email: DEMO_ADMIN_CREDENTIALS.email,
        fullName: '운영 관리자',
        authenticatedAt: '2026-03-16T00:00:00.000Z',
      },
    });

    useAdminSessionStore.getState().signOut();

    expect(useAdminSessionStore.getState().session).toBeNull();
    expect(useUiStore.getState().selectedStoreId).toBeUndefined();
  });
});
