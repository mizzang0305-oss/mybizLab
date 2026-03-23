interface ImportMetaEnv {
  readonly VITE_DEMO_ADMIN_EMAIL?: string;
  readonly VITE_DEMO_ADMIN_PASSWORD?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly NEXT_PUBLIC_PORTONE_CHANNEL_KEY?: string;
  readonly NEXT_PUBLIC_PORTONE_STORE_ID?: string;
  readonly VITE_APP_BASE_URL?: string;
  readonly VITE_DATA_PROVIDER?: 'local' | 'firebase' | 'mock' | 'supabase';
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_PORTONE_CHANNEL_KEY?: string;
  readonly VITE_PORTONE_STORE_ID?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
