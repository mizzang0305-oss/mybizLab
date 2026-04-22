import { afterEach, describe, expect, it, vi } from 'vitest';

const adminAuthMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  resolveStoreAccess: vi.fn(),
}));

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => ({
    auth: {
      getUser: adminAuthMocks.getUser,
    },
  }),
}));

vi.mock('../shared/lib/repositories/supabaseRepository.js', () => ({
  createSupabaseRepository: () => ({
    resolveStoreAccess: adminAuthMocks.resolveStoreAccess,
  }),
}));

import authSessionHandler from '../../api/auth/session';
import { handleAdminSessionRequest } from '@/server/adminAuth';

describe('/api/auth/session', () => {
  afterEach(() => {
    adminAuthMocks.getUser.mockReset();
    adminAuthMocks.resolveStoreAccess.mockReset();
  });

  it('returns 401 when the bearer token is missing', async () => {
    const response = await handleAdminSessionRequest(
      new Request('https://example.com/api/auth/session', {
        method: 'GET',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      ok: false,
      error: 'Authorization bearer token is required.',
    });
  });

  it('returns 403 when the authenticated profile has no store_members access', async () => {
    adminAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'profile_forbidden',
          email: 'forbidden@mybiz.ai.kr',
          user_metadata: {
            full_name: '접근 불가 점주',
          },
        },
      },
      error: null,
    });
    adminAuthMocks.resolveStoreAccess.mockResolvedValue({
      accessibleStores: [],
      email: 'forbidden@mybiz.ai.kr',
      fullName: '접근 불가 점주',
      memberships: [],
      primaryRole: null,
      profile: {
        id: 'profile_forbidden',
        email: 'forbidden@mybiz.ai.kr',
        full_name: '접근 불가 점주',
        phone: '',
        created_at: '2026-04-22T00:00:00.000Z',
      },
      provider: 'supabase',
    });

    const response = await handleAdminSessionRequest(
      new Request('https://example.com/api/auth/session', {
        headers: {
          Authorization: 'Bearer token_forbidden',
        },
        method: 'GET',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      ok: false,
      error: 'The authenticated profile does not have a store_members role for merchant operations.',
    });
  });

  it('returns a server-validated membership session for an authenticated merchant', async () => {
    adminAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'profile_owner',
          email: 'owner@mybiz.ai.kr',
          user_metadata: {
            full_name: '점주 관리자',
          },
        },
      },
      error: null,
    });
    adminAuthMocks.resolveStoreAccess.mockResolvedValue({
      accessibleStores: [
        {
          id: 'store_live',
          name: 'Live Store',
          slug: 'live-store',
        },
      ],
      email: 'owner@mybiz.ai.kr',
      fullName: '점주 관리자',
      memberships: [
        {
          id: 'member_live_owner',
          store_id: 'store_live',
          profile_id: 'profile_owner',
          role: 'owner',
          created_at: '2026-04-22T00:00:00.000Z',
        },
      ],
      primaryRole: 'owner',
      profile: {
        id: 'profile_owner',
        email: 'owner@mybiz.ai.kr',
        full_name: '점주 관리자',
        phone: '010-5555-0000',
        created_at: '2026-04-22T00:00:00.000Z',
      },
      provider: 'supabase',
    });

    const response = await handleAdminSessionRequest(
      new Request('https://example.com/api/auth/session', {
        headers: {
          Authorization: 'Bearer token_owner',
        },
        method: 'GET',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: {
        accessibleStoreIds: ['store_live'],
        email: 'owner@mybiz.ai.kr',
        profileId: 'profile_owner',
        role: 'owner',
      },
    });
  });

  it('returns 405 for non-GET session route requests', async () => {
    const response = await authSessionHandler(
      new Request('https://example.com/api/auth/session', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
