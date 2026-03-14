interface ImportMetaEnv {
  readonly NEXT_PUBLIC_PORTONE_CHANNEL_KEY?: string;
  readonly NEXT_PUBLIC_PORTONE_STORE_ID?: string;
  readonly VITE_APP_BASE_URL?: string;
  readonly VITE_DATA_PROVIDER?: 'mock' | 'supabase';
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_PORTONE_CHANNEL_KEY?: string;
  readonly VITE_PORTONE_STORE_ID?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
