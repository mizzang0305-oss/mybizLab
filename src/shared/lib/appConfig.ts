export const PUBLIC_SERVICE_ORIGIN = import.meta.env.VITE_APP_BASE_URL || 'https://mybiz.ai.kr';
export const DEV_STORE_ROUTE_PREFIX = '';
export const DATA_PROVIDER = import.meta.env.VITE_DATA_PROVIDER === 'supabase' ? 'supabase' : 'mock';

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
