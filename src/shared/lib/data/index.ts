import { DATA_PROVIDER } from '@/shared/lib/appConfig';
import { firebaseAdapter } from '@/shared/lib/data/adapters/firebaseAdapter';
import { localMockAdapter } from '@/shared/lib/data/adapters/localMockAdapter';

export const demoDataAdapters = {
  firebase: firebaseAdapter,
  local: localMockAdapter,
} as const;

export function getPreferredDemoDataAdapter() {
  return DATA_PROVIDER === 'firebase' ? demoDataAdapters.firebase : demoDataAdapters.local;
}

export function getActiveDemoDataAdapter() {
  const preferredAdapter = getPreferredDemoDataAdapter();
  return preferredAdapter.isConfigured() ? preferredAdapter : demoDataAdapters.local;
}
