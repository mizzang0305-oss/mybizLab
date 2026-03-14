import { readPublicEnv, requirePublicEnv } from '@/shared/lib/publicEnv';

export function isPortOneBrowserConfigured() {
  return Boolean(
    readPublicEnv('VITE_PORTONE_STORE_ID') &&
      readPublicEnv('VITE_PORTONE_CHANNEL_KEY') &&
      readPublicEnv('VITE_APP_BASE_URL'),
  );
}

export function getPortOneBrowserEnv() {
  return {
    storeId: requirePublicEnv('VITE_PORTONE_STORE_ID', 'PortOne browser payment and billing-key requests'),
    channelKey: requirePublicEnv('VITE_PORTONE_CHANNEL_KEY', 'PortOne browser payment and billing-key requests'),
    appBaseUrl: requirePublicEnv('VITE_APP_BASE_URL', 'PortOne redirect and callback URL generation'),
  };
}
