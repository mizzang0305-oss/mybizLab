import { readPublicEnv, requirePublicEnv } from './publicEnv.js';

const PORTONE_STORE_ENV_NAMES = ['NEXT_PUBLIC_PORTONE_STORE_ID', 'VITE_PORTONE_STORE_ID'] as const;
const PORTONE_CHANNEL_ENV_NAMES = ['NEXT_PUBLIC_PORTONE_CHANNEL_KEY', 'VITE_PORTONE_CHANNEL_KEY'] as const;

export function isPortOneBrowserConfigured() {
  return Boolean(
    readPublicEnv(PORTONE_STORE_ENV_NAMES) &&
      readPublicEnv(PORTONE_CHANNEL_ENV_NAMES) &&
      readPublicEnv('VITE_APP_BASE_URL'),
  );
}

export function getPortOneBrowserEnv() {
  return {
    storeId: requirePublicEnv(PORTONE_STORE_ENV_NAMES, 'PortOne browser payment and billing-key requests'),
    channelKey: requirePublicEnv(PORTONE_CHANNEL_ENV_NAMES, 'PortOne browser payment and billing-key requests'),
    appBaseUrl: requirePublicEnv('VITE_APP_BASE_URL', 'PortOne redirect and callback URL generation'),
  };
}