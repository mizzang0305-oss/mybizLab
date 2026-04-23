import { createClient } from '@supabase/supabase-js';

import { isSupabaseConfigured } from '@/shared/lib/appConfig';
import { readPublicEnv } from '@/shared/lib/publicEnv';

const supabaseUrl = readPublicEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readPublicEnv('VITE_SUPABASE_ANON_KEY');

export const supabase =
  isSupabaseConfigured() && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
