interface ImportMetaEnv {
  readonly VITE_APP_BASE_URL?: string;
  readonly VITE_DATA_PROVIDER?: 'mock' | 'supabase';
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
