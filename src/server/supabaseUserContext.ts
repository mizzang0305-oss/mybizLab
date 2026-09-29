import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import type { ResolvedStoreAccess } from '../shared/lib/repositories/contracts.js';
import { mapLiveStoreToAppStore } from '../shared/lib/storeData.js';
import type { StoreMember } from '../shared/types/models.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';
import { readServerEnv } from './serverEnv.js';

/** Call only after the bearer token has been checked with Auth getUser(). */
export function createVerifiedUserClient(accessToken: string): SupabaseClient {
  const url = readServerEnv('SUPABASE_URL') || readServerEnv('VITE_SUPABASE_URL');
  const key = readServerEnv('SUPABASE_ANON_KEY') || readServerEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !key || !accessToken) {
    throw new Error('Supabase user-context configuration is unavailable.');
  }
  return createClient(url, key, {
    accessToken: async () => accessToken,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Call only with the User returned by Auth getUser(accessToken). */
export async function resolveVerifiedUserStoreAccess(
  accessToken: string,
  user: User,
  userClient: SupabaseClient = createVerifiedUserClient(accessToken),
): Promise<ResolvedStoreAccess | null> {
  const { data: businessProfileId, error: identityError } = await getSupabaseAdminClient()
    .rpc('resolve_service_os_business_profile_id', { p_auth_user_id: user.id });
  if (identityError) throw new Error('Failed to resolve the verified business profile.');
  if (!businessProfileId || typeof businessProfileId !== 'string') return null;

  const { data: rows, error: membershipError } = await userClient
    .from('store_members')
    .select('id,store_id,profile_id,role,created_at')
    .eq('profile_id', businessProfileId);
  if (membershipError) throw new Error(`Failed to load RLS-visible store memberships: ${membershipError.message}`);

  const memberships: StoreMember[] = (rows || []).map((row) => ({
    id: row.id,
    store_id: row.store_id,
    profile_id: row.profile_id,
    role: row.role as StoreMember['role'],
    created_at: row.created_at,
  }));
  if (!memberships.length) return null;

  const storeIds = [...new Set(memberships.map((member) => member.store_id))];
  const { data: storeRows, error: storeError } = await userClient
    .from('stores')
    .select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan')
    .in('store_id', storeIds);
  if (storeError) throw new Error(`Failed to load RLS-visible stores: ${storeError.message}`);

  const email = user.email?.trim().toLowerCase() || '';
  const fullName = typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim()
    : email;
  const roleRank = { owner: 3, manager: 2, staff: 1 };
  return {
    accessibleStores: (storeRows || []).map((row) => mapLiveStoreToAppStore(row, null)),
    email,
    fullName,
    memberships,
    primaryRole: memberships.slice().sort((a, b) => roleRank[b.role] - roleRank[a.role])[0]?.role || null,
    profile: { id: businessProfileId, full_name: fullName, email, created_at: user.created_at },
    provider: 'supabase',
  };
}
