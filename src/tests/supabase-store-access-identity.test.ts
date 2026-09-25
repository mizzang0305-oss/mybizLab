import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

function createClient(sessionUserId: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: sessionUserId ? { id: sessionUserId } : null }, error: null }) },
    from,
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

  it('queries the verified auth ID instead of a matching email', async () => {
    const { client, eq, from } = createClient(null);

    await expect(
      createSupabaseRepository(client).resolveStoreAccess({ ...input, verifiedAuthUserId: 'auth_owner' }),
    ).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', 'auth_owner');
  });

  it('rejects conflicting session and verified IDs before querying profiles', async () => {
    const { client, from } = createClient('auth_other');

    await expect(
      createSupabaseRepository(client).resolveStoreAccess({ ...input, verifiedAuthUserId: 'auth_owner' }),
    ).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
