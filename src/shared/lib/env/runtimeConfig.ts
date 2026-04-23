import { z } from 'zod';

import { readPublicEnv } from '../publicEnv.js';

const LEGACY_DATA_PROVIDER_VALUES = ['local', 'firebase', 'mock', 'supabase'] as const;
const APP_RUNTIME_MODE_VALUES = ['demo', 'live'] as const;

const PublicRuntimeSchema = z.object({
  appBaseUrl: z.string().url().optional(),
  appRuntimeMode: z.enum(APP_RUNTIME_MODE_VALUES).optional(),
  dataProvider: z.enum(LEGACY_DATA_PROVIDER_VALUES).optional(),
  demoAdminEmail: z.string().email().optional(),
  demoAdminPassword: z.string().min(1).optional(),
  firebaseApiKey: z.string().min(1).optional(),
  firebaseAuthDomain: z.string().min(1).optional(),
  firebaseProjectId: z.string().min(1).optional(),
  firebaseStorageBucket: z.string().min(1).optional(),
  firebaseMessagingSenderId: z.string().min(1).optional(),
  firebaseAppId: z.string().min(1).optional(),
  nextPublicPortoneStoreId: z.string().min(1).optional(),
  nextPublicPortoneChannelKey: z.string().min(1).optional(),
  vitePortoneStoreId: z.string().min(1).optional(),
  vitePortoneChannelKey: z.string().min(1).optional(),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
  geminiApiKey: z.string().min(1).optional(),
});

export type LegacyDataProvider = (typeof LEGACY_DATA_PROVIDER_VALUES)[number];
export type AppRuntimeMode = (typeof APP_RUNTIME_MODE_VALUES)[number];
export type StoreDataMode = 'local' | 'firebase';

export interface PublicRuntimeConfig {
  appBaseUrl: string;
  appRuntimeMode: AppRuntimeMode;
  dataMode: StoreDataMode;
  dataProvider: LegacyDataProvider;
  demoAdminEmail: string;
  demoAdminPassword?: string;
  firebase: {
    apiKey?: string;
    appId?: string;
    authDomain?: string;
    isConfigured: boolean;
    messagingSenderId?: string;
    projectId?: string;
    storageBucket?: string;
  };
  geminiApiKey?: string;
  portone: {
    channelKey?: string;
    storeId?: string;
  };
  supabase: {
    anonKey?: string;
    url?: string;
  };
  warnings: string[];
}

function readRawPublicRuntimeInput() {
  if (typeof process !== 'undefined' && process.env.VITEST && process.env.MYBIZ_TEST_USE_REAL_ENV !== 'true') {
    return {};
  }

  return {
    appBaseUrl: readPublicEnv('VITE_APP_BASE_URL'),
    appRuntimeMode: readPublicEnv('VITE_APP_RUNTIME_MODE'),
    dataProvider: readPublicEnv('VITE_DATA_PROVIDER'),
    demoAdminEmail: readPublicEnv('VITE_DEMO_ADMIN_EMAIL'),
    demoAdminPassword: readPublicEnv('VITE_DEMO_ADMIN_PASSWORD'),
    firebaseApiKey: readPublicEnv('VITE_FIREBASE_API_KEY'),
    firebaseAppId: readPublicEnv('VITE_FIREBASE_APP_ID'),
    firebaseAuthDomain: readPublicEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    firebaseMessagingSenderId: readPublicEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    firebaseProjectId: readPublicEnv('VITE_FIREBASE_PROJECT_ID'),
    firebaseStorageBucket: readPublicEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    geminiApiKey: readPublicEnv('VITE_GEMINI_API_KEY'),
    nextPublicPortoneChannelKey: readPublicEnv('NEXT_PUBLIC_PORTONE_CHANNEL_KEY'),
    nextPublicPortoneStoreId: readPublicEnv('NEXT_PUBLIC_PORTONE_STORE_ID'),
    supabaseAnonKey: readPublicEnv('VITE_SUPABASE_ANON_KEY'),
    supabaseUrl: readPublicEnv('VITE_SUPABASE_URL'),
    vitePortoneChannelKey: readPublicEnv('VITE_PORTONE_CHANNEL_KEY'),
    vitePortoneStoreId: readPublicEnv('VITE_PORTONE_STORE_ID'),
  };
}

function resolveDataMode(dataProvider: LegacyDataProvider): StoreDataMode {
  return dataProvider === 'firebase' || dataProvider === 'supabase' ? 'firebase' : 'local';
}

function normalizeConfig(parsed: Partial<z.infer<typeof PublicRuntimeSchema>>, warnings: string[]): PublicRuntimeConfig {
  const supabaseConfigured = Boolean(parsed.supabaseUrl && parsed.supabaseAnonKey);
  const explicitDemoRuntime = parsed.appRuntimeMode === 'demo';
  const appRuntimeMode = parsed.appRuntimeMode ?? (supabaseConfigured ? 'live' : 'demo');
  const requestedProvider = parsed.dataProvider;
  const dataProvider =
    explicitDemoRuntime
      ? requestedProvider ?? 'local'
      : supabaseConfigured
        ? 'supabase'
        : requestedProvider ?? 'local';
  const firebaseConfigured =
    Boolean(parsed.firebaseApiKey) &&
    Boolean(parsed.firebaseAuthDomain) &&
    Boolean(parsed.firebaseProjectId) &&
    Boolean(parsed.firebaseStorageBucket) &&
    Boolean(parsed.firebaseMessagingSenderId) &&
    Boolean(parsed.firebaseAppId);

  if ((dataProvider === 'firebase' || dataProvider === 'supabase') && !firebaseConfigured && !parsed.supabaseUrl) {
    warnings.push('Firebase mode was requested without Firebase browser config, so the app will keep demo/local-safe fallbacks.');
  }

  if (requestedProvider === 'mock' && supabaseConfigured && appRuntimeMode === 'live') {
    warnings.push(
      'Ignoring legacy mock provider because live Supabase browser config is present. Set VITE_APP_RUNTIME_MODE=demo to force explicit demo runtime.',
    );
  }

  return {
    appBaseUrl: parsed.appBaseUrl ?? 'https://mybiz.ai.kr',
    appRuntimeMode,
    dataMode: resolveDataMode(dataProvider),
    dataProvider,
    demoAdminEmail: parsed.demoAdminEmail ?? 'demo@mybizlab.ai',
    demoAdminPassword: parsed.demoAdminPassword,
    firebase: {
      apiKey: parsed.firebaseApiKey,
      appId: parsed.firebaseAppId,
      authDomain: parsed.firebaseAuthDomain,
      isConfigured: firebaseConfigured,
      messagingSenderId: parsed.firebaseMessagingSenderId,
      projectId: parsed.firebaseProjectId,
      storageBucket: parsed.firebaseStorageBucket,
    },
    geminiApiKey: parsed.geminiApiKey,
    portone: {
      channelKey: parsed.nextPublicPortoneChannelKey ?? parsed.vitePortoneChannelKey,
      storeId: parsed.nextPublicPortoneStoreId ?? parsed.vitePortoneStoreId,
    },
    supabase: {
      anonKey: parsed.supabaseAnonKey,
      url: parsed.supabaseUrl,
    },
    warnings,
  };
}

function warnRuntimeConfig(message: string, details?: string) {
  if (typeof console === 'undefined') {
    return;
  }

  console.warn(`[runtime-config] ${message}${details ? ` ${details}` : ''}`);
}

let cachedPublicRuntimeConfig: PublicRuntimeConfig | null = null;

export function getPublicRuntimeConfig() {
  if (cachedPublicRuntimeConfig) {
    return cachedPublicRuntimeConfig;
  }

  const parseResult = PublicRuntimeSchema.safeParse(readRawPublicRuntimeInput());
  const warnings: string[] = [];

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ');
    warnings.push(details);
    warnRuntimeConfig('Falling back to safe defaults because browser env validation failed.', details);
    cachedPublicRuntimeConfig = normalizeConfig({}, warnings);
    return cachedPublicRuntimeConfig;
  }

  cachedPublicRuntimeConfig = normalizeConfig(parseResult.data, warnings);
  if (warnings.length) {
    warnings.forEach((warning) => warnRuntimeConfig(warning));
  }

  return cachedPublicRuntimeConfig;
}

export function resetPublicRuntimeConfigForTests() {
  cachedPublicRuntimeConfig = null;
}
