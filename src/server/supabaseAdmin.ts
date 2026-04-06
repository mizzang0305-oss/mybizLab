import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readServerEnv, requireServerEnv } from './serverEnv';

let cachedSupabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (cachedSupabaseAdminClient) {
    return cachedSupabaseAdminClient;
  }

  const supabaseUrl =
    readServerEnv('SUPABASE_URL') ||
    readServerEnv('VITE_SUPABASE_URL') ||
    requireServerEnv('SUPABASE_URL', 'public API server access');
  const serviceRoleKey = requireServerEnv('SUPABASE_SERVICE_ROLE_KEY', 'public API server access');

  cachedSupabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedSupabaseAdminClient;
}

export function resetSupabaseAdminClientForTests() {
  cachedSupabaseAdminClient = null;
}
