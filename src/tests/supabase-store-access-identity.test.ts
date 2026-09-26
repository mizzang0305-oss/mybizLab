import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

const authOwnerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const boundProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createClient(sessionUserId: string | null, bindingId: string | null = boundProfileId) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: sessionUserId ? { id: sessionUserId } : null }, error: null }) },
    from,
    rpc: vi.fn().mockResolvedValue({ data: bindingId, error: null }),
  } as unknown as SupabaseClient;

  return { client, eq, from };
}

const input = {
  fallbackEmail: 'same@example.com',
  fallbackFullName: 'Synthetic Owner',
  fallbackProfileId: 'untrusted_fallback',
  requestedEmail: 'same@example.com',
};

describe('Supabase store access identity', () => {
  it('does not query a profile by email when no verified user exists', async () => {
    const { client, from } = createClient(null);

    await expect(createSupabaseRepository(client).resolveStoreAccess(input)).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('queries the unique server-resolved profile ID instead of auth ID or matching email', async () => {
    const { client, eq, from } = createClient(null);

    await expect(
      createSupabaseRepository(client).resolveStoreAccess({ ...input, verifiedAuthUserId: authOwnerId }),
    ).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', boundProfileId);
    expect(client.rpc).toHaveBeenCalledWith('resolve_verified_merchant_profile_for_server', { p_auth_user_id: authOwnerId });
  });

  it('denies a verified Auth user without an active binding before profile lookup', async () => {
    const { client, from } = createClient(null, null);
    await expect(createSupabaseRepository(client).resolveStoreAccess({ ...input, verifiedAuthUserId: authOwnerId })).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects conflicting session and verified IDs before querying profiles', async () => {
    const { client, from } = createClient('auth_other');

    await expect(
      createSupabaseRepository(client).resolveStoreAccess({ ...input, verifiedAuthUserId: authOwnerId }),
    ).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
