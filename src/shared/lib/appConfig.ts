import { readPublicEnv } from '@/shared/lib/publicEnv';

export const PUBLIC_SERVICE_ORIGIN = readPublicEnv('VITE_APP_BASE_URL') || 'https://mybiz.ai.kr';
export const DEV_STORE_ROUTE_PREFIX = '';
export const DATA_PROVIDER = readPublicEnv('VITE_DATA_PROVIDER') === 'supabase' ? 'supabase' : 'mock';

export function isSupabaseConfigured() {
  return Boolean(readPublicEnv('VITE_SUPABASE_URL') && readPublicEnv('VITE_SUPABASE_ANON_KEY'));
}
