/**
 * @deprecated Phase 1 introduces src/shared/lib/repositories as the canonical
 * repository boundary. This adapter registry remains only for legacy demo
 * bootstrap flows.
 */
import { DATA_PROVIDER } from '../appConfig.js';
import { firebaseAdapter } from './adapters/firebaseAdapter.js';
import { localMockAdapter } from './adapters/localMockAdapter.js';

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
