import { getPublicRuntimeConfig } from '@/shared/lib/env/runtimeConfig';

export const PUBLIC_RUNTIME_CONFIG = getPublicRuntimeConfig();
export const PUBLIC_SERVICE_ORIGIN = PUBLIC_RUNTIME_CONFIG.appBaseUrl;
export const DEV_STORE_ROUTE_PREFIX = '';
export const DATA_PROVIDER = PUBLIC_RUNTIME_CONFIG.dataProvider;
export const STORE_DATA_MODE = PUBLIC_RUNTIME_CONFIG.dataMode;
export const DEMO_ADMIN_EMAIL = PUBLIC_RUNTIME_CONFIG.demoAdminEmail;
export const DEMO_ADMIN_PASSWORD = PUBLIC_RUNTIME_CONFIG.demoAdminPassword;
export const IS_PRODUCTION_RUNTIME = import.meta.env.PROD;

export function isSupabaseConfigured() {
  return Boolean(PUBLIC_RUNTIME_CONFIG.supabase.url && PUBLIC_RUNTIME_CONFIG.supabase.anonKey);
}

export function isFirebaseConfigured() {
  return PUBLIC_RUNTIME_CONFIG.firebase.isConfigured;
}
