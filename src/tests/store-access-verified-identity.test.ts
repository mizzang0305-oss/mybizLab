import { describe, expect, it, vi } from 'vitest';

import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';

describe('server verified store identity', () => {
  it('looks up the verified Auth user ID and never falls back to a matching email', async () => {
    const eq = vi.fn((_column: string, _value: string) => ({
      maybeSingle: async () => ({ data: null, error: null }),
    }));
    const getUser = vi.fn(() => {
      throw new Error('The admin client has no user session.');
    });
    const client = {
      auth: { getUser },
      from: vi.fn((table: string) => {
        expect(table).toBe('profiles');
        return { select: () => ({ eq }) };
      }),
    };

    const access = await createSupabaseRepository(client as never).resolveStoreAccess({
      fallbackEmail: 'someone@example.invalid',
      fallbackFullName: 'Synthetic User',
      fallbackProfileId: 'untrusted-fallback',
      requestedEmail: 'matching-profile@example.invalid',
      verifiedAuthUserId: 'verified-auth-id',
    });

    expect(access).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
    expect(eq).toHaveBeenCalledExactlyOnceWith('id', 'verified-auth-id');
  });
});
