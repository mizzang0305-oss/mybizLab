import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { resolveVerifiedUserStoreAccess } from '../server/supabaseUserContext.js';

describe('verified merchant identity boundary', () => {
  it('uses only the verified Auth UUID for the privileged identity lookup', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'business-profile-id', error: null });
    const membershipEq = vi.fn().mockResolvedValue({
      data: [{ id: 'own-member', store_id: 'own-store', profile_id: 'business-profile-id', role: 'owner', created_at: '2026-01-01' }],
      error: null,
    });
    const storeIn = vi.fn().mockResolvedValue({
      data: [{ store_id: 'own-store', name: 'Synthetic Store', slug: 'synthetic-store', plan: 'free', created_at: '2026-01-01' }],
      error: null,
    });
    const userClient = {
      from: (table: string) => table === 'store_members'
        ? { select: () => ({ eq: membershipEq }) }
        : { select: () => ({ in: storeIn }) },
    } as unknown as SupabaseClient;
    const user = {
      id: 'verified-auth-uuid', email: 'synthetic@example.invalid', created_at: '2026-01-01',
      user_metadata: { profile_id: 'forged-profile-id', full_name: 'Synthetic Owner' },
    } as unknown as User;

    const result = await resolveVerifiedUserStoreAccess('verified-token', user, userClient);

    expect(mocks.rpc).toHaveBeenCalledWith('resolve_service_os_business_profile_id', {
      p_auth_user_id: 'verified-auth-uuid',
    });
    expect(membershipEq).toHaveBeenCalledWith('profile_id', 'business-profile-id');
    expect(result?.profile.id).toBe('business-profile-id');
    expect(result?.memberships).toHaveLength(1);
    expect(result?.memberships[0]?.profile_id).toBe('business-profile-id');
  });

  it('does not query memberships when the privileged resolver finds no identity', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    const from = vi.fn();
    const userClient = { from } as unknown as SupabaseClient;
    const user = { id: 'unbound-auth-uuid' } as User;

    expect(await resolveVerifiedUserStoreAccess('verified-token', user, userClient)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
